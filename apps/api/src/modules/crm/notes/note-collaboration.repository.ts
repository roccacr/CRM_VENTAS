import { createHash } from "node:crypto";

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { RecordAuditService } from "../audit/record-audit.service.js";
import type { CollaborationCommand, CollaborationInbox, CollaborationResult, NoteLocation, NoteParticipant, NoteReply } from "./note-collaboration.contract.js";
import { NoteNotificationsRepository } from "./note-notifications.repository.js";
import { persistNoteRelatedRecords, readNoteRelatedRecords } from "./note-related-records.repository.js";
import type { NoteContext, NoteRecord } from "./notes.contract.js";
import type { NoteModule } from "./notes.permissions.js";
import { NotesRepository } from "./notes.repository.js";
import { NotesRealtimeEventsRepository } from "./notes-realtime.repository.js";
import { retryNoteDeadlock } from "./notes-transaction.js";
export type CollaborationTx = Transaction<CrmDatabase>;
type Recipient = { publicId: string; kind: "shared" | "reply" | "mention" };
type WriteContext = { tx: CollaborationTx; state: CollaborationNote; actor: number; result: CollaborationResult; recipients: Recipient[] };
type Executor = DatabaseService["db"] | CollaborationTx;
export interface CollaborationNote {
    note: NoteRecord;
    context: NoteContext;
    collaborationVersion: number;
    participants: NoteParticipant[];
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Persistence for one conversation; every command locks actor and note before receipts and metadata events. */
@Injectable()
export class NoteCollaborationRepository {
    /** Injects existing authorization and native persistence collaborators. */
    // Explicit collaborators keep durable publication in the same command transaction.
    // eslint-disable-next-line max-params
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(NotesRepository) private readonly notes: NotesRepository,
        @Inject(RecordAuditService) private readonly audit: RecordAuditService,
        @Inject(NoteNotificationsRepository) private readonly notifications: NoteNotificationsRepository,
        @Inject(NotesRealtimeEventsRepository) private readonly realtime: NotesRealtimeEventsRepository,
    ) {}
    /** Only IDs are loaded before service authorization; no private content is exposed. */
    async metadata(id: string, executor: Executor = this.database.db) {
        return (await sql<{ moduleCode: NoteModule }>`SELECT origin_module_code_note AS moduleCode FROM crm_note WHERE public_id_note=${id}`.execute(executor)).rows[0];
    }
    /** Repository ACL includes self-scoped invitees; service separately enforces live capabilities and context. */
    async load(actor: string, id: string, executor: Executor = this.database.db, lock = false): Promise<CollaborationNote> {
        const metadata = await this.metadata(id, executor);
        if (!metadata) throw new NotFoundException("Nota disponible no encontrada.");
        const note = await this.notes.find({ actorPublicId: actor, moduleCode: metadata.moduleCode, ownOnly: false }, id, executor, lock);
        const context = await this.notes.context(note, executor);
        const version = (await sql<{ version: number }>`SELECT collaboration_version_note AS version FROM crm_note WHERE id_note=${note.internalId}`.execute(executor)).rows[0]?.version;
        if (!version) throw new ServiceUnavailableException("Colaboracion no disponible.");
        return { note, context, collaborationVersion: version, participants: await this.participants(note.internalId, executor) };
    }
    /** Reuses the existing actor-bound layout query only after service authorization. */
    async placement(actorPublicId: string, note: NoteRecord) {
        return this.notes.placement({ actorPublicId, moduleCode: note.moduleCode, ownOnly: false }, note);
    }
    private async participants(id: number, executor: Executor): Promise<NoteParticipant[]> {
        return (
            await sql<NoteParticipant>`SELECT u.public_id_user AS userId,u.display_name_user AS displayName,u.status_user AS status,p.access_note_participant AS access,p.following_note_participant AS following,(u.status_user='active' AND u.deleted_at_user IS NULL) AS active FROM crm_note_participant p JOIN sec_user u ON u.id_user=p.user_id_note_participant WHERE p.note_id_note_participant=${id} AND p.status_note_participant='active' AND p.revoked_at_note_participant IS NULL AND u.deleted_at_user IS NULL ORDER BY u.display_name_user,u.public_id_user`.execute(
                executor,
            )
        ).rows.map((p) => ({ ...p, following: Number(p.following) === 1, active: Number(p.active) === 1 }));
    }
    /** Directory includes dormant accounts for future invitations; it never activates them. */
    async directory(search: string, page = 1) {
        return (await sql<{ publicId: string; displayName: string; status: "active" | "inactive" | "pending" }>`SELECT public_id_user AS publicId,display_name_user AS displayName,status_user AS status FROM sec_user WHERE status_user IN ('active','inactive','pending') AND deleted_at_user IS NULL AND (${search}='' OR LOCATE(${search},display_name_user)>0) ORDER BY display_name_user,public_id_user LIMIT 101 OFFSET ${(page - 1) * 100}`.execute(this.database.db)).rows;
    }
    /** Dormant recipients may be invited, but cannot authenticate or read notes until activated. */
    async recipientStatus(publicId: string): Promise<string | null> {
        return (await sql<{ status: string }>`SELECT status_user AS status FROM sec_user WHERE public_id_user=${publicId} AND deleted_at_user IS NULL`.execute(this.database.db)).rows[0]?.status ?? null;
    }
    /** Display references never replace the primary canonical record identity. */
    async locations(noteId: number, executor: Executor = this.database.db): Promise<NoteLocation[]> {
        if (!(await this.locationsReady(executor))) return [];
        return (await sql<NoteLocation>`SELECT module_code_note_location AS moduleCode,view_code_note_location AS code FROM crm_note_location WHERE note_id_note_location=${noteId} ORDER BY module_code_note_location,view_code_note_location`.execute(executor)).rows;
    }
    private async locationsReady(executor: Executor) {
        return (await sql`SELECT migration_name_schema_migration FROM conf_schema_migration WHERE migration_name_schema_migration='202610280052_notes_locations'`.execute(executor)).rows.length === 1;
    }
    /** Attributed metadata only: no historical text or restoration payload is exposed. */
    async activity(note: NoteRecord, page: number, actorPublicId: string) {
        const filter = sql`r.source_schema_record='CRM_THINK_V2' AND r.entity_type_record='note' AND r.source_table_record='crm_note' AND r.source_id_record=${note.publicId} AND ((NOT JSON_CONTAINS_PATH(COALESCE(e.after_record_event,JSON_OBJECT()),'one','$.remindAt') AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.after_record_event,'$.command')),'')<>'following') OR JSON_UNQUOTE(JSON_EXTRACT(e.actor_snapshot_record_event,'$.publicId'))=${actorPublicId})`;
        const total = (await sql<{ total: number }>`SELECT COUNT(*) AS total FROM audit_record r JOIN audit_record_event e ON e.record_id_record_event=r.id_record WHERE ${filter}`.execute(this.database.db)).rows[0]?.total ?? 0;
        const items = (
            await sql<{
                id: string;
                action: string;
                actor: unknown;
                createdAt: string;
                command: string | null;
                status: string | null;
            }>`SELECT e.id_record_event AS id,e.action_record_event AS action,e.actor_snapshot_record_event AS actor,DATE_FORMAT(e.recorded_at_record_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS createdAt,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.after_record_event,'$.command')),CASE WHEN JSON_CONTAINS_PATH(e.after_record_event,'one','$.remindAt') THEN 'reminder' WHEN JSON_CONTAINS_PATH(e.after_record_event,'one','$.workflowVersion') THEN 'task' END) AS command,JSON_UNQUOTE(JSON_EXTRACT(e.after_record_event,'$.status')) AS status FROM audit_record r JOIN audit_record_event e ON e.record_id_record_event=r.id_record WHERE ${filter} ORDER BY e.sequence_record_event DESC LIMIT 100 OFFSET ${(page - 1) * 100}`.execute(
                this.database.db,
            )
        ).rows;
        return { items, page: { number: page, size: 100, total } };
    }
    /** Reads metadata IDs first so service filters resource permissions before pagination/content. */
    async inboxIds(actor: string, query: CollaborationInbox) {
        return (await this.inboxPage(actor, query, ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"])).items;
    }
    /** Complete author choices come only from notes visible to this session, never from the current page. */
    async inboxAuthors(actor: string, modules: readonly NoteModule[]) {
        if (!modules.length) return [];
        return (
            await sql<{
                publicId: string;
                displayName: string;
            }>`SELECT DISTINCT a.public_id_user AS publicId,a.display_name_user AS displayName FROM crm_note n JOIN sec_user a ON a.id_user=n.author_user_id_note JOIN sec_user u ON u.public_id_user=${actor} AND u.status_user='active' AND u.deleted_at_user IS NULL WHERE n.origin_module_code_note IN (${sql.join(modules)}) AND (n.author_user_id_note=u.id_user OR (n.visibility_note='shared' AND EXISTS(SELECT 1 FROM crm_note_participant p WHERE p.note_id_note_participant=n.id_note AND p.user_id_note_participant=u.id_user AND p.status_note_participant='active' AND p.revoked_at_note_participant IS NULL))) ORDER BY a.display_name_user,a.public_id_user`.execute(
                this.database.db,
            )
        ).rows;
    }
    /** Database count and page share one snapshot; private content loads are bounded by pageSize. */
    async inboxPage(actor: string, query: CollaborationInbox, modules: readonly NoteModule[]) {
        if (!modules.length) return { items: [], total: 0 };
        const filter = this.inboxFilter(query, modules);
        const from = sql`FROM crm_note n JOIN sec_user u ON u.public_id_user=${actor} AND u.status_user='active' AND u.deleted_at_user IS NULL`;
        return this.database.db
            .transaction()
            .setIsolationLevel("repeatable read")
            .execute(async (tx) => {
                const total = (await sql<{ total: number }>`SELECT COUNT(*) AS total ${from} WHERE ${filter}`.execute(tx)).rows[0]?.total ?? 0;
                const items = (await sql<{ id: string }>`SELECT n.public_id_note AS id ${from} WHERE ${filter} ORDER BY n.collaboration_updated_at_note DESC,n.id_note DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`.execute(tx)).rows;
                return { items, total };
            });
    }
    private inboxFilter(query: CollaborationInbox, modules: readonly NoteModule[]) {
        const search = query.search ? `%${query.search.replace(/[=%_]/g, "=$&")}%` : undefined;
        const text = search ? sql`(n.title_note LIKE ${search} ESCAPE '=' OR n.plain_text_note LIKE ${search} ESCAPE '=' OR EXISTS(SELECT 1 FROM crm_note_reply sr WHERE sr.note_id_note_reply=n.id_note AND sr.withdrawn_at_note_reply IS NULL AND sr.plain_text_note_reply LIKE ${search} ESCAPE '=') OR EXISTS(SELECT 1 FROM sec_user au WHERE au.id_user=n.author_user_id_note AND au.display_name_user LIKE ${search} ESCAPE '='))` : sql`1=1`;
        const author = query.authorUserId ? sql`n.author_user_id_note=(SELECT id_user FROM sec_user WHERE public_id_user=${query.authorUserId})` : sql`1=1`;
        const origin = query.moduleCode ? sql`n.origin_module_code_note=${query.moduleCode}` : sql`1=1`;
        const source = query.recordSource ? sql`EXISTS(SELECT 1 FROM crm_note_link sl WHERE sl.note_id_note_link=n.id_note AND sl.entity_type_note_link='sales_order' AND sl.target_kind_note_link=${query.recordSource === "legacy" ? "external" : "native"})` : sql`1=1`;
        const assigned = query.kind === "assigned" ? sql`EXISTS(SELECT 1 FROM crm_note_task t WHERE t.note_id_note_task=n.id_note AND t.assignee_user_id_note_task=u.id_user)` : sql`1=0`;
        const record = this.inboxRecordFilter(query);
        const filter = sql`(${query.status}='all' OR n.status_note=${query.status}) AND ${text} AND ${author} AND ${origin} AND ${source} AND ${record} AND (${query.kind} IN ('all','created') AND n.author_user_id_note=u.id_user OR ${query.kind} IN ('all','shared') AND n.visibility_note='shared' AND EXISTS(SELECT 1 FROM crm_note_participant p WHERE p.note_id_note_participant=n.id_note AND p.user_id_note_participant=u.id_user AND p.status_note_participant='active' AND p.revoked_at_note_participant IS NULL) OR ${query.kind}='mentions' AND EXISTS(SELECT 1 FROM crm_note_mention m WHERE m.note_id_note_mention=n.id_note AND m.user_id_note_mention=u.id_user) OR ${assigned}) AND n.origin_module_code_note IN (${sql.join(modules)}) AND (n.author_user_id_note=u.id_user OR (n.visibility_note='shared' AND EXISTS(SELECT 1 FROM crm_note_participant ap WHERE ap.note_id_note_participant=n.id_note AND ap.user_id_note_participant=u.id_user AND ap.status_note_participant='active' AND ap.revoked_at_note_participant IS NULL)))`;
        return filter;
    }
    private inboxRecordFilter(query: CollaborationInbox) {
        const record = query.recordId
            ? sql`EXISTS(SELECT 1 FROM crm_note_link rl LEFT JOIN crm_sales_order ro ON ro.id_sales_order=rl.sales_order_id_note_link WHERE rl.note_id_note_link=n.id_note AND rl.entity_type_note_link='sales_order' AND ${query.recordSource === "legacy" ? sql`rl.external_id_note_link=${query.recordId} AND rl.target_kind_note_link='external' AND rl.external_system_id_note_link=(SELECT id_external_system FROM int_external_system WHERE code_external_system='legacy_crm')` : sql`ro.public_id_sales_order=${query.recordId} AND rl.target_kind_note_link='native'`})`
            : sql`1=1`;
        const from = query.createdFrom ? sql`n.created_at_note>=${new Date(query.createdFrom).toISOString().slice(0, 23).replace("T", " ")}` : sql`1=1`;
        const to = query.createdTo ? sql`n.created_at_note<=${new Date(query.createdTo).toISOString().slice(0, 23).replace("T", " ")}` : sql`1=1`;
        return sql`${record} AND ${from} AND ${to}`;
    }
    /** Loads or changes structured mentions within the authorized conversation. */
    async mentions(noteId: number, replyId: number | null, executor: Executor = this.database.db) {
        return (await sql<{ id: string }>`SELECT DISTINCT u.public_id_user AS id FROM crm_note_mention m JOIN sec_user u ON u.id_user=m.user_id_note_mention WHERE m.note_id_note_mention=${noteId} AND ${replyId === null ? sql`m.reply_id_note_mention IS NULL` : sql`m.reply_id_note_mention=${replyId}`}`.execute(executor)).rows.map((r) => r.id);
    }
    /** Reads one bounded reply page after note authorization. */
    async replies(note: NoteRecord, page: number) {
        const total = (await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_note_reply WHERE note_id_note_reply=${note.internalId}`.execute(this.database.db)).rows[0]?.total ?? 0;
        const rows = (
            await sql<
                Omit<NoteReply, "mentionUserIds">
            >`SELECT r.public_id_note_reply AS id,r.id_note_reply AS internalId,r.author_user_id_note_reply AS authorId,u.public_id_user AS authorPublicId,u.display_name_user AS authorName,IF(r.withdrawn_at_note_reply IS NULL,r.plain_text_note_reply,NULL) AS text,r.version_note_reply AS version,DATE_FORMAT(r.created_at_note_reply,'%Y-%m-%dT%H:%i:%s.%fZ') AS createdAt,DATE_FORMAT(r.updated_at_note_reply,'%Y-%m-%dT%H:%i:%s.%fZ') AS updatedAt,(r.withdrawn_at_note_reply IS NOT NULL) AS withdrawn FROM crm_note_reply r JOIN sec_user u ON u.id_user=r.author_user_id_note_reply WHERE r.note_id_note_reply=${note.internalId} ORDER BY r.created_at_note_reply,r.id_note_reply LIMIT 25 OFFSET ${(page - 1) * 25}`.execute(
                this.database.db,
            )
        ).rows;
        const items: NoteReply[] = [];
        for (const r of rows) items.push({ ...r, mentionUserIds: r.withdrawn ? [] : await this.mentions(note.internalId, r.internalId) });
        return { items, total };
    }
    /** Actor operation key is global across note commands; failures roll back body, ACL, audit and notification outbox. */
    async command(actorPublicId: string, id: string, input: CollaborationCommand, authorize: (state: CollaborationNote, tx: CollaborationTx, phase: "read" | "write") => Promise<void>): Promise<CollaborationResult> {
        if (!this.audit.enabled) throw new ServiceUnavailableException("Notas requiere auditoria central habilitada.");
        // Metadata reads before the note lock must not freeze an invitation revoked while waiting.
        return retryNoteDeadlock(() =>
            this.database.db
                .transaction()
                .setIsolationLevel("read committed")
                .execute(async (tx) => {
                    const actor = (await sql<{ id: number }>`SELECT id_user AS id FROM sec_user WHERE public_id_user=${actorPublicId} AND status_user='active' AND deleted_at_user IS NULL FOR UPDATE`.execute(tx)).rows[0]?.id;
                    if (!actor) throw new ForbiddenException();
                    const state = await this.load(actorPublicId, id, tx, true);
                    await authorize(state, tx, "read");
                    const clientInput = input.kind === "relatedRecords" ? { kind: input.kind, operationId: input.operationId, expectedCollaborationVersion: input.expectedCollaborationVersion, relatedRecords: input.relatedRecords } : input;
                    const digest = hash({ id, input: clientInput });
                    const receipt = (await sql<{ hash: string; result: CollaborationResult | string }>`SELECT request_hash_note_command AS hash,result_note_command AS result FROM int_note_command WHERE actor_user_id_note_command=${actor} AND operation_id_note_command=${input.operationId} FOR UPDATE`.execute(tx)).rows[0];
                    if (receipt) {
                        if (receipt.hash !== digest) throw new ConflictException("La clave de operacion ya se utilizo con otro contenido.");
                        return { ...(typeof receipt.result === "string" ? (JSON.parse(receipt.result) as CollaborationResult) : receipt.result), replayed: true };
                    }
                    await authorize(state, tx, "write");
                    const result = await this.applyCommand({ tx, state, actor }, input);
                    await sql`INSERT INTO int_note_command (actor_user_id_note_command,operation_id_note_command,request_hash_note_command,result_note_command) VALUES (${actor},${input.operationId},${digest},${JSON.stringify(result)})`.execute(tx);
                    return result;
                }),
        );
    }
    private async applyCommand(context: { tx: CollaborationTx; state: CollaborationNote; actor: number }, input: CollaborationCommand) {
        const { tx, state, actor } = context;
        if ("expectedCollaborationVersion" in input && input.expectedCollaborationVersion !== state.collaborationVersion) throw new ConflictException("La conversacion cambio; recargue antes de guardar.");
        if (state.collaborationVersion >= 4294967295) throw new ConflictException("Version agotada.");
        const result: CollaborationResult = { noteId: state.note.publicId, version: state.note.version, collaborationVersion: state.collaborationVersion + 1, replayed: false };
        const recipients: Recipient[] = [];
        const before = { collaborationVersion: state.collaborationVersion, ...(await this.relatedAudit(context, input)) };
        await this.writeCommand({ ...context, result, recipients }, input);
        await sql`UPDATE crm_note SET collaboration_version_note=${result.collaborationVersion},collaboration_updated_at_note=UTC_TIMESTAMP(3) WHERE id_note=${state.note.internalId}`.execute(tx);
        const capture = await this.audit.captureActor(tx, actor);
        const after = { collaborationVersion: result.collaborationVersion, command: input.kind, ...(await this.relatedAudit(context, input)), ...(result.replyId ? { replyId: result.replyId, replyVersion: result.replyVersion } : {}) };
        await this.audit.append(tx, { source: { schema: "CRM_THINK_V2", table: "crm_note", entity: "note", id: state.note.publicId }, actor: capture, action: "annotation", module: state.note.moduleCode, before, after, allowedFields: Object.keys(after), operationId: input.operationId, correlationId: input.operationId, snapshotScope: "partial" });
        if (input.kind !== "following") {
            const actorPublicId = await this.actorPublicId(tx, actor);
            await this.notifications.enqueue(tx, { noteId: state.note.publicId, moduleCode: state.note.moduleCode, actorPublicId, version: result.collaborationVersion, recipients });
            const revokedUserIds = input.kind === "participants" ? state.participants.filter((p) => p.userId !== state.note.authorPublicId && !input.participants.some((target) => target.userId === p.userId)).map((p) => p.userId) : [];
            await this.realtime.enqueueNoteChange(tx, { noteId: state.note.publicId, actorPublicId, revokedUserIds });
        }
        return result;
    }
    private async relatedAudit(context: { tx: CollaborationTx; state: CollaborationNote }, input: CollaborationCommand) {
        if (input.kind !== "relatedRecords") return {};
        const stored = (await readNoteRelatedRecords(context.tx, [context.state.note])).get(context.state.note.internalId) ?? [];
        return { relatedRecords: stored.map((row) => row.reference) };
    }
    private async actorPublicId(tx: CollaborationTx, actor: number) {
        const row = (await sql<{ id: string }>`SELECT public_id_user AS id FROM sec_user WHERE id_user=${actor}`.execute(tx)).rows[0];
        if (!row) throw new ForbiddenException();
        return row.id;
    }
    private async writeCommand(context: WriteContext, input: CollaborationCommand) {
        if (input.kind === "relatedRecords") return persistNoteRelatedRecords(context.tx, context.state.note, input.persistedRelatedRecords ?? input.relatedRecords, input.preservedLinkIds);
        if (input.kind === "locations") return this.replaceLocations(context, input);
        if (input.kind === "participants") return this.replaceParticipants(context, input);
        if (input.kind === "mentions") {
            await this.replaceMentions(context.tx, { noteId: context.state.note.internalId, replyId: null, ids: input.userIds, version: context.state.note.version });
            context.recipients.push(...input.userIds.map((publicId) => ({ publicId, kind: "mention" as const })));
            return;
        }
        if (input.kind === "following") return this.follow(context.tx, context.state, context.actor, input.following);
        return this.writeReply(context, input);
    }
    private async replaceLocations(context: WriteContext, input: Extract<CollaborationCommand, { kind: "locations" }>) {
        if (!(await this.locationsReady(context.tx))) throw new ServiceUnavailableException("Ubicaciones de notas no disponibles.");
        // Preserve destinations the author can no longer administer; visible edits must not silently remove them.
        const editable = input.editableModules ?? ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"];
        if (editable.length) await sql`DELETE FROM crm_note_location WHERE note_id_note_location=${context.state.note.internalId} AND module_code_note_location IN (${sql.join(editable)})`.execute(context.tx);
        for (const location of input.locations) await sql`INSERT INTO crm_note_location (note_id_note_location,module_code_note_location,view_code_note_location,created_by_user_id_note_location) VALUES (${context.state.note.internalId},${location.moduleCode},${location.code},${context.actor})`.execute(context.tx);
        return;
    }
    private async replaceParticipants(context: WriteContext, input: Extract<CollaborationCommand, { kind: "participants" }>) {
        const { tx, state, actor, recipients } = context;
        const revoked = state.participants.filter((p) => p.userId !== state.note.authorPublicId && !input.participants.some((n) => n.userId === p.userId)).map((p) => p.userId);
        if (revoked.length) {
            await sql`UPDATE crm_note_participant p JOIN sec_user u ON u.id_user=p.user_id_note_participant SET p.status_note_participant='revoked',p.revoked_at_note_participant=UTC_TIMESTAMP(3),p.revoked_by_user_id_note_participant=${actor},p.updated_at_note_participant=UTC_TIMESTAMP(3) WHERE p.note_id_note_participant=${state.note.internalId} AND u.public_id_user IN (${sql.join(revoked)})`.execute(tx);
            await this.notifications.suppressForNote(tx, state.note.publicId, revoked);
            const workflow = await sql`SELECT migration_name_schema_migration FROM conf_schema_migration WHERE migration_name_schema_migration='202610280053_notes_workflow'`.execute(tx);
            if (workflow.rows.length) {
                await sql`UPDATE crm_note_workflow_event SET status_note_workflow_event='suppressed' WHERE note_id_note_workflow_event=${state.note.internalId} AND recipient_user_id_note_workflow_event IN (SELECT id_user FROM sec_user WHERE public_id_user IN (${sql.join(revoked)})) AND status_note_workflow_event IN ('pending','processing')`.execute(tx);
                const cleared = await sql`UPDATE crm_note_task SET assignee_user_id_note_task=NULL,version_note_task=version_note_task+1,updated_at_note_task=UTC_TIMESTAMP(3) WHERE note_id_note_task=${state.note.internalId} AND assignee_user_id_note_task IN (SELECT id_user FROM sec_user WHERE public_id_user IN (${sql.join(revoked)}))`.execute(tx);
                // An unassigned due date belongs to the author; revocation must not silently lose that deadline.
                await sql`INSERT INTO crm_note_workflow_event (note_id_note_workflow_event,recipient_user_id_note_workflow_event,kind_note_workflow_event,scheduled_at_note_workflow_event,available_at_note_workflow_event) SELECT t.note_id_note_task,n.author_user_id_note,'due',t.due_at_note_task,t.due_at_note_task FROM crm_note_task t JOIN crm_note n ON n.id_note=t.note_id_note_task WHERE ${Number(cleared.numAffectedRows) > 0} AND t.note_id_note_task=${state.note.internalId} AND t.due_at_note_task IS NOT NULL AND n.status_note='open'`.execute(
                    tx,
                );
            }
            await sql`DELETE m FROM crm_note_mention m JOIN sec_user u ON u.id_user=m.user_id_note_mention WHERE m.note_id_note_mention=${state.note.internalId} AND u.public_id_user IN (${sql.join(revoked)})`.execute(tx);
        }
        for (const p of input.participants) {
            await sql`INSERT INTO crm_note_participant (note_id_note_participant,user_id_note_participant,access_note_participant,granted_by_user_id_note_participant) SELECT ${state.note.internalId},id_user,${p.access},${actor} FROM sec_user WHERE public_id_user=${p.userId} AND status_user IN ('active','inactive','pending') AND deleted_at_user IS NULL ON DUPLICATE KEY UPDATE access_note_participant=${p.access},status_note_participant='active',granted_by_user_id_note_participant=${actor},revoked_by_user_id_note_participant=NULL,revoked_at_note_participant=NULL,updated_at_note_participant=UTC_TIMESTAMP(3)`.execute(
                tx,
            );
            if (!state.participants.some((old) => old.userId === p.userId)) recipients.push({ publicId: p.userId, kind: "shared" });
        }
        await sql`UPDATE crm_note SET visibility_note=${input.participants.length ? "shared" : "private"} WHERE id_note=${state.note.internalId}`.execute(tx);
    }
    private async replaceMentions(tx: CollaborationTx, input: { noteId: number; replyId: number | null; ids: string[]; version: number }) {
        const { noteId, replyId, ids, version } = input;
        await sql`DELETE FROM crm_note_mention WHERE note_id_note_mention=${noteId} AND ${replyId === null ? sql`reply_id_note_mention IS NULL` : sql`reply_id_note_mention=${replyId}`}`.execute(tx);
        for (const id of ids) await sql`INSERT INTO crm_note_mention (note_id_note_mention,reply_id_note_mention,user_id_note_mention,content_version_note_mention) SELECT ${noteId},${replyId},id_user,${version} FROM sec_user WHERE public_id_user=${id} AND status_user IN ('active','inactive','pending') AND deleted_at_user IS NULL`.execute(tx);
    }
    private async writeReply(context: WriteContext, input: Extract<CollaborationCommand, { kind: "reply" | "editReply" | "withdrawReply" }>) {
        const { tx, state, result, recipients } = context;
        const row = input.kind === "reply" ? await this.createReply(context, input) : await this.changeReply(context, input);
        const { id: replyId, version } = row;
        result.replyVersion = version;
        const mentions = input.kind === "withdrawReply" ? [] : input.mentionUserIds;
        await this.replaceMentions(tx, { noteId: state.note.internalId, replyId, ids: mentions, version });
        recipients.push(...mentions.map((publicId) => ({ publicId, kind: "mention" as const })));
        if (input.kind === "reply") {
            if (state.participants.find((p) => p.userId === state.note.authorPublicId)?.following !== false) recipients.push({ publicId: state.note.authorPublicId, kind: "reply" });
            recipients.push(...state.participants.filter((p) => p.following).map((p) => ({ publicId: p.userId, kind: "reply" as const })));
        }
    }
    private async createReply(context: WriteContext, input: Extract<CollaborationCommand, { kind: "reply" }>) {
        const { tx, state, actor, result } = context;
        const quoted = input.quotedReplyId ? (await sql<{ id: number }>`SELECT id_note_reply AS id FROM crm_note_reply WHERE public_id_note_reply=${input.quotedReplyId} AND note_id_note_reply=${state.note.internalId}`.execute(tx)).rows[0]?.id : null;
        if (input.quotedReplyId && !quoted) throw new NotFoundException("Respuesta citada no encontrada.");
        result.replyId = ulid();
        await sql`INSERT INTO crm_note_reply (public_id_note_reply,note_id_note_reply,author_user_id_note_reply,quoted_reply_id_note_reply,content_note_reply,plain_text_note_reply) VALUES (${result.replyId},${state.note.internalId},${actor},${quoted},${JSON.stringify({ format: "plain_text", text: input.text })},${input.text})`.execute(tx);
        const row = (await sql<{ id: number }>`SELECT id_note_reply AS id FROM crm_note_reply WHERE public_id_note_reply=${result.replyId}`.execute(tx)).rows[0];
        if (!row) throw new NotFoundException("Respuesta no disponible.");
        return { id: row.id, version: 1 };
    }
    private async changeReply(context: WriteContext, input: Extract<CollaborationCommand, { kind: "editReply" | "withdrawReply" }>) {
        const { tx, state, actor, result } = context;
        const row = (await sql<{ id: number; author: number; version: number; withdrawn: number }>`SELECT id_note_reply AS id,author_user_id_note_reply AS author,version_note_reply AS version,(withdrawn_at_note_reply IS NOT NULL) AS withdrawn FROM crm_note_reply WHERE public_id_note_reply=${input.replyId} AND note_id_note_reply=${state.note.internalId} FOR UPDATE`.execute(tx)).rows[0];
        if (!row) throw new NotFoundException("Respuesta disponible no encontrada.");
        if (row.author !== actor) throw new ForbiddenException("Solo el autor puede modificar su respuesta.");
        if (row.version !== input.expectedVersion || row.withdrawn) throw new ConflictException("La respuesta cambio; recargue.");
        const version = row.version + 1;
        result.replyId = input.replyId;
        if (input.kind === "editReply") await sql`UPDATE crm_note_reply SET content_note_reply=${JSON.stringify({ format: "plain_text", text: input.text })},plain_text_note_reply=${input.text},version_note_reply=${version},updated_at_note_reply=UTC_TIMESTAMP(3) WHERE id_note_reply=${row.id}`.execute(tx);
        else await sql`UPDATE crm_note_reply SET withdrawn_at_note_reply=UTC_TIMESTAMP(3),version_note_reply=${version},updated_at_note_reply=UTC_TIMESTAMP(3) WHERE id_note_reply=${row.id}`.execute(tx);
        return { id: row.id, version };
    }
    private async follow(tx: CollaborationTx, state: CollaborationNote, actor: number, following: boolean) {
        if (state.note.authorId === actor) {
            await sql`INSERT INTO crm_note_participant (note_id_note_participant,user_id_note_participant,access_note_participant,granted_by_user_id_note_participant,following_note_participant) VALUES (${state.note.internalId},${actor},'reply',${actor},${Number(following)}) ON DUPLICATE KEY UPDATE following_note_participant=${Number(following)},updated_at_note_participant=UTC_TIMESTAMP(3)`.execute(tx);
        } else await sql`UPDATE crm_note_participant SET following_note_participant=${Number(following)},updated_at_note_participant=UTC_TIMESTAMP(3) WHERE note_id_note_participant=${state.note.internalId} AND user_id_note_participant=${actor} AND status_note_participant='active' AND revoked_at_note_participant IS NULL`.execute(tx);
    }
}
