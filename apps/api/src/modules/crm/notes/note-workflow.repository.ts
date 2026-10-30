import { createHash } from "node:crypto";

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { RecordAuditService } from "../audit/record-audit.service.js";
import { type CollaborationNote, NoteCollaborationRepository } from "./note-collaboration.repository.js";
import type { ClaimedWorkflowEvent, NoteWorkflow, WorkflowCommand, WorkflowResult } from "./note-workflow.contract.js";
import { NotesRealtimeEventsRepository } from "./notes-realtime.repository.js";
import { retryNoteDeadlock } from "./notes-transaction.js";

type Tx = Transaction<CrmDatabase>;
type Executor = DatabaseService["db"] | Tx;
const mysqlDate = (date: string | null) => (date === null ? null : new Date(date).toISOString().slice(0, 23).replace("T", " "));
/** Native task metadata and durable per-recipient schedules; no legacy records are read or copied. */
@Injectable()
export class NoteWorkflowRepository {
    /** Keeps metadata, receipts, audit and socket intentions in the same native transaction. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(NoteCollaborationRepository) private readonly collaboration: NoteCollaborationRepository,
        @Inject(RecordAuditService) private readonly audit: RecordAuditService,
        @Inject(NotesRealtimeEventsRepository) private readonly realtime: NotesRealtimeEventsRepository,
    ) {}
    /** The additive schema ledger gates HTTP and scheduled delivery alike. */
    async schemaReady(): Promise<boolean> {
        const r = await sql<{ ready: number }>`SELECT COUNT(*) AS ready FROM conf_schema_migration WHERE migration_name_schema_migration='202610280053_notes_workflow'`.execute(this.database.db);
        return Number(r.rows[0]?.ready) === 1;
    }
    /** Returns only task metadata; the caller must have authorized the note first. */
    async read(actor: string, state: CollaborationNote, executor: Executor = this.database.db): Promise<NoteWorkflow> {
        const task = (await sql<{ version: number; publicId: string | null; displayName: string | null; dueAt: string | null }>`SELECT t.version_note_task AS version,u.public_id_user AS publicId,u.display_name_user AS displayName,DATE_FORMAT(t.due_at_note_task,'%Y-%m-%dT%H:%i:%s.%fZ') AS dueAt FROM crm_note_task t LEFT JOIN sec_user u ON u.id_user=t.assignee_user_id_note_task WHERE t.note_id_note_task=${state.note.internalId}`.execute(executor)).rows[0] ?? {
            version: 0,
            publicId: null,
            displayName: null,
            dueAt: null,
        };
        const reminder =
            (
                await sql<
                    NonNullable<NoteWorkflow["reminder"]>
                >`SELECT DATE_FORMAT(e.scheduled_at_note_workflow_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS remindAt,IF(e.status_note_workflow_event='processing','pending',e.status_note_workflow_event) AS status FROM crm_note_workflow_event e JOIN sec_user u ON u.id_user=e.recipient_user_id_note_workflow_event WHERE e.note_id_note_workflow_event=${state.note.internalId} AND u.public_id_user=${actor} AND e.kind_note_workflow_event='reminder' ORDER BY e.id_note_workflow_event DESC LIMIT 1`.execute(
                    executor,
                )
            ).rows[0] ?? null;
        return { schemaVersion: 1, version: task.version, assignee: task.publicId ? { publicId: task.publicId, displayName: task.displayName ?? "" } : null, dueAt: task.dueAt, reminder, canManage: actor === state.note.authorPublicId && state.note.status === "open" };
    }
    /** Serializes against collaboration/lifecycle commands before rechecking ACL and optimistic task version. */
    async command(actor: string, id: string, input: WorkflowCommand, authorize: (state: CollaborationNote) => Promise<void>): Promise<WorkflowResult> {
        if (!this.audit.enabled || !(await this.schemaReady())) throw new ServiceUnavailableException("Flujo de notas no disponible.");
        // Recheck post-lock membership from committed state, not a pre-lock metadata snapshot.
        return retryNoteDeadlock(() =>
            this.database.db
                .transaction()
                .setIsolationLevel("read committed")
                .execute(async (tx) => {
                    const user = (await sql<{ id: number }>`SELECT id_user AS id FROM sec_user WHERE public_id_user=${actor} AND status_user='active' AND deleted_at_user IS NULL FOR UPDATE`.execute(tx)).rows[0];
                    if (!user) throw new ForbiddenException();
                    const state = await this.collaboration.load(actor, id, tx, true);
                    await authorize(state);
                    const hash = createHash("sha256").update(JSON.stringify({ id, input })).digest("hex");
                    const receipt = (await sql<{ hash: string; result: WorkflowResult | string }>`SELECT request_hash_note_command AS hash,result_note_command AS result FROM int_note_command WHERE actor_user_id_note_command=${user.id} AND operation_id_note_command=${input.operationId} FOR UPDATE`.execute(tx)).rows[0];
                    if (receipt) {
                        if (receipt.hash !== hash) throw new ConflictException("Operacion reutilizada con otro contenido.");
                        return { ...(typeof receipt.result === "string" ? (JSON.parse(receipt.result) as WorkflowResult) : receipt.result), replayed: true };
                    }
                    const before = await this.read(actor, state, tx);
                    if (input.kind === "task") await this.task(tx, { actor, state, before }, input);
                    else await this.reminder(tx, { actor, state, userId: user.id }, input);
                    const result: WorkflowResult = { ...(await this.read(actor, state, tx)), noteId: id, replayed: false };
                    await this.audit.append(tx, {
                        source: { schema: "CRM_THINK_V2", table: "crm_note", entity: "note", id },
                        actor: await this.audit.captureActor(tx, user.id),
                        action: "annotation",
                        module: state.note.moduleCode,
                        before: this.auditFields(before, input.kind),
                        after: this.auditFields(result, input.kind),
                        allowedFields: input.kind === "task" ? ["workflowVersion", "assigneeUserId", "dueAt"] : ["reminderUserId", "remindAt"],
                        operationId: input.operationId,
                        correlationId: input.operationId,
                        snapshotScope: "partial",
                    });
                    await sql`INSERT INTO int_note_command (actor_user_id_note_command,operation_id_note_command,request_hash_note_command,result_note_command) VALUES (${user.id},${input.operationId},${hash},${JSON.stringify(result)})`.execute(tx);
                    if (input.kind === "task") await this.realtime.enqueueNoteChange(tx, { noteId: id, actorPublicId: actor });
                    return result;
                }),
        );
    }
    private auditFields(state: NoteWorkflow, kind: WorkflowCommand["kind"]) {
        return kind === "task" ? { workflowVersion: state.version, assigneeUserId: state.assignee?.publicId ?? null, dueAt: state.dueAt } : { remindAt: state.reminder?.remindAt ?? null };
    }
    private async task(tx: Tx, context: { actor: string; state: CollaborationNote; before: NoteWorkflow }, input: Extract<WorkflowCommand, { kind: "task" }>) {
        const { state, before } = context;
        this.validateTask(context, input);
        const assignee = await this.assignee(tx, input.assigneeUserId);
        await sql`INSERT INTO crm_note_task (note_id_note_task,assignee_user_id_note_task,due_at_note_task,version_note_task) VALUES (${state.note.internalId},${assignee},${mysqlDate(input.dueAt)},${before.version + 1}) ON DUPLICATE KEY UPDATE assignee_user_id_note_task=${assignee},due_at_note_task=${mysqlDate(input.dueAt)},version_note_task=${before.version + 1},updated_at_note_task=UTC_TIMESTAMP(3)`.execute(tx);
        await this.taskSchedules(tx, { state, before, assignee }, input);
    }
    private async taskSchedules(tx: Tx, context: { state: CollaborationNote; before: NoteWorkflow; assignee: number | null }, input: Extract<WorkflowCommand, { kind: "task" }>) {
        const { state, before, assignee } = context;
        const changedAssignee = input.assigneeUserId !== (before.assignee ? before.assignee.publicId : null);
        const changedDue = mysqlDate(input.dueAt) !== mysqlDate(before.dueAt);
        if (!changedAssignee && !changedDue) return;
        // Editing only the due date must not erase an assignment notice still awaiting its first delivery.
        await sql`UPDATE crm_note_workflow_event SET status_note_workflow_event='cancelled' WHERE note_id_note_workflow_event=${state.note.internalId} AND (kind_note_workflow_event='due' OR (${changedAssignee} AND kind_note_workflow_event='assigned')) AND status_note_workflow_event IN ('pending','processing')`.execute(tx);
        if (assignee && changedAssignee) await this.schedule(tx, { noteId: state.note.internalId, userId: assignee, kind: "assigned", at: null });
        if (input.dueAt) await this.schedule(tx, { noteId: state.note.internalId, userId: assignee ?? state.note.authorId, kind: "due", at: input.dueAt });
    }
    private validateTask(context: { actor: string; state: CollaborationNote; before: NoteWorkflow }, input: Extract<WorkflowCommand, { kind: "task" }>) {
        const { state, before, actor } = context;
        if (actor !== state.note.authorPublicId) throw new ForbiddenException("Solo el autor cambia responsable y fecha.");
        if (state.note.status !== "open" || before.version !== input.expectedVersion) throw new ConflictException("La tarea cambio o ya no esta abierta.");
        if (input.assigneeUserId && input.assigneeUserId !== actor && !state.participants.some((p) => p.userId === input.assigneeUserId)) throw new ForbiddenException("El responsable debe estar invitado.");
    }
    private async assignee(tx: Tx, userId: string | null) {
        if (!userId) return null;
        const assignee = (await sql<{ id: number }>`SELECT id_user AS id FROM sec_user WHERE public_id_user=${userId} AND status_user IN ('active','inactive','pending') AND deleted_at_user IS NULL`.execute(tx)).rows[0];
        if (!assignee) throw new ForbiddenException("Responsable no disponible.");
        return assignee.id;
    }
    private async reminder(tx: Tx, context: { actor: string; state: CollaborationNote; userId: number }, input: Extract<WorkflowCommand, { kind: "reminder" }>) {
        if (input.remindAt && (Date.parse(input.remindAt) <= Date.now() || context.state.note.status !== "open")) throw new BadRequestException("El recordatorio requiere una nota abierta y fecha futura UTC.");
        await sql`UPDATE crm_note_workflow_event SET status_note_workflow_event='cancelled' WHERE note_id_note_workflow_event=${context.state.note.internalId} AND recipient_user_id_note_workflow_event=${context.userId} AND kind_note_workflow_event='reminder' AND status_note_workflow_event IN ('pending','processing')`.execute(tx);
        if (input.remindAt) await this.schedule(tx, { noteId: context.state.note.internalId, userId: context.userId, kind: "reminder", at: input.remindAt });
    }
    private async schedule(tx: Tx, input: { noteId: number; userId: number; kind: ClaimedWorkflowEvent["kind"]; at: string | null }) {
        await sql`INSERT INTO crm_note_workflow_event (note_id_note_workflow_event,recipient_user_id_note_workflow_event,kind_note_workflow_event,scheduled_at_note_workflow_event,available_at_note_workflow_event) VALUES (${input.noteId},${input.userId},${input.kind},COALESCE(${mysqlDate(input.at)},UTC_TIMESTAMP(3)),COALESCE(${mysqlDate(input.at)},UTC_TIMESTAMP(3)))`.execute(tx);
    }
    /** Bounded metadata candidates are authorization-filtered by the service before counts are exposed. */
    async overviewIds(actor: string) {
        return (
            await sql<{
                id: string;
                dueAt: string | null;
                explicitAssigned: number;
            }>`SELECT n.public_id_note AS id,DATE_FORMAT(t.due_at_note_task,'%Y-%m-%dT%H:%i:%s.%fZ') AS dueAt,(t.assignee_user_id_note_task IS NOT NULL) AS explicitAssigned FROM crm_note_task t JOIN crm_note n ON n.id_note=t.note_id_note_task JOIN sec_user u ON u.id_user=COALESCE(t.assignee_user_id_note_task,n.author_user_id_note) WHERE u.public_id_user=${actor} AND n.status_note='open' ORDER BY t.note_id_note_task LIMIT 1001`.execute(this.database.db)
        ).rows;
    }
    /** Claims only a schedule row; note-first delivery avoids inverted locks against note commands. */
    async claim(): Promise<ClaimedWorkflowEvent | null> {
        return this.database.db.transaction().execute(async (tx) => {
            const row = (
                await sql<ClaimedWorkflowEvent>`SELECT e.id_note_workflow_event AS id,e.attempts_note_workflow_event AS attempt,(SELECT public_id_note FROM crm_note WHERE id_note=e.note_id_note_workflow_event) AS noteId,(SELECT public_id_user FROM sec_user WHERE id_user=e.recipient_user_id_note_workflow_event) AS userId,e.kind_note_workflow_event AS kind FROM crm_note_workflow_event e WHERE e.status_note_workflow_event IN ('pending','processing') AND e.available_at_note_workflow_event<=UTC_TIMESTAMP(3) ORDER BY e.available_at_note_workflow_event,e.id_note_workflow_event LIMIT 1 FOR UPDATE SKIP LOCKED`.execute(
                    tx,
                )
            ).rows[0];
            if (!row) return null;
            await sql`UPDATE crm_note_workflow_event SET status_note_workflow_event='processing',attempts_note_workflow_event=attempts_note_workflow_event+1,available_at_note_workflow_event=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 60 SECOND) WHERE id_note_workflow_event=${row.id}`.execute(tx);
            return { ...row, attempt: row.attempt + 1 };
        });
    }
    /** A lease attempt fences stale processes; rollback preserves schedules on any delivery failure. */
    async deliver(event: ClaimedWorkflowEvent, authorize: (user: string, note: string) => Promise<unknown>) {
        await this.database.db
            .transaction()
            .setIsolationLevel("read committed")
            .execute(async (tx) => {
                const note = (await sql<{ id: number; authorId: number; moduleCode: string; status: string; version: number }>`SELECT id_note AS id,author_user_id_note AS authorId,origin_module_code_note AS moduleCode,status_note AS status,collaboration_version_note AS version FROM crm_note WHERE public_id_note=${event.noteId} FOR UPDATE`.execute(tx)).rows[0];
                const current = (await sql`SELECT id_note_workflow_event FROM crm_note_workflow_event WHERE id_note_workflow_event=${event.id} AND status_note_workflow_event='processing' AND attempts_note_workflow_event=${event.attempt} AND available_at_note_workflow_event>UTC_TIMESTAMP(3) FOR UPDATE`.execute(tx)).rows[0];
                if (!current || !note) return;
                const eligible = note.status === "open" && (await this.authorizedRecipient(tx, event, { note, authorize }));
                if (eligible) await this.publish(tx, event, note);
                await sql`UPDATE crm_note_workflow_event SET status_note_workflow_event=${eligible ? "delivered" : "suppressed"} WHERE id_note_workflow_event=${event.id} AND attempts_note_workflow_event=${event.attempt}`.execute(tx);
            });
    }
    private async authorizedRecipient(tx: Tx, event: ClaimedWorkflowEvent, context: { note: { id: number; authorId: number }; authorize: (user: string, note: string) => Promise<unknown> }): Promise<boolean> {
        const { note, authorize } = context;
        const rows = await sql<{
            status: string;
        }>`SELECT u.id_user,u.status_user AS status FROM sec_user u WHERE u.public_id_user=${event.userId} AND u.status_user IN ('active','inactive','pending') AND u.deleted_at_user IS NULL AND (u.id_user=${note.authorId} OR EXISTS(SELECT 1 FROM crm_note_participant p JOIN crm_note n ON n.id_note=p.note_id_note_participant WHERE p.note_id_note_participant=${note.id} AND p.user_id_note_participant=u.id_user AND p.status_note_participant='active' AND p.revoked_at_note_participant IS NULL AND n.visibility_note='shared'))`.execute(
            tx,
        );
        const member = rows.rows[0];
        if (!member) return false;
        if (member.status === "active") return Boolean(await authorize(event.userId, event.noteId));
        // Dormant assignees retain unread metadata; REST and sockets still require an active authorized account.
        return event.kind !== "reminder";
    }
    private async publish(tx: Tx, event: ClaimedWorkflowEvent, note: { id: number; authorId: number; moduleCode: string; version: number }) {
        const eventId = ulid();
        await sql`INSERT INTO int_event_outbox (public_id_event_outbox,aggregate_type_event_outbox,aggregate_public_id_event_outbox,aggregate_version_event_outbox,event_type_event_outbox,destination_code_event_outbox,payload_event_outbox,status_event_outbox,delivered_at_event_outbox) VALUES (${eventId},'note_workflow',${event.noteId},${event.id},${event.kind},'notification',${JSON.stringify({ noteId: event.noteId, kind: event.kind, scheduleId: event.id })},'delivered',UTC_TIMESTAMP(3))`.execute(
            tx,
        );
        const notificationId = ulid();
        await sql`INSERT INTO sec_notification (public_id_notification,recipient_user_id_notification,actor_user_id_notification,source_event_id_notification,note_id_notification,module_code_notification,kind_notification) SELECT ${notificationId},u.id_user,IF(${event.kind}='reminder',u.id_user,${note.authorId}),e.id_event_outbox,${note.id},${note.moduleCode},${event.kind} FROM sec_user u JOIN int_event_outbox e ON e.public_id_event_outbox=${eventId} WHERE u.public_id_user=${event.userId}`.execute(
            tx,
        );
        await this.realtime.enqueueUserEvent(tx, event.userId, { kind: "notification.created", noteId: event.noteId, notificationId, collaborationVersion: note.version });
    }
    /** Retries indefinitely with capped delay: a DB outage must never silently lose a personal reminder. */
    async retry(event: ClaimedWorkflowEvent) {
        await sql`UPDATE crm_note_workflow_event SET status_note_workflow_event='pending',available_at_note_workflow_event=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ${Math.min(3600, event.attempt * 30)} SECOND) WHERE id_note_workflow_event=${event.id} AND attempts_note_workflow_event=${event.attempt} AND status_note_workflow_event='processing'`.execute(this.database.db);
    }
}
