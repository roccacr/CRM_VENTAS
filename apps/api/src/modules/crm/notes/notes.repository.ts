import { createHash } from "node:crypto";

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { RecordAuditService } from "../audit/record-audit.service.js";
import type { NoteRelatedReference } from "./note-related-records.contract.js";
import { noteRelatedRecordKey, persistNoteRelatedRecords } from "./note-related-records.repository.js";
import type { CreateNote, EditNote, NoteAccess, NoteContext, NoteLifecycle, NoteList, NotePlacement, NoteRecord, NoteResult, NoteState } from "./notes.contract.js";
import type { NoteModule } from "./notes.permissions.js";
import { decodeNoteLink, noteHomeViewCode, noteViewStorageCode } from "./notes-context.js";
import { NotesRealtimeEventsRepository } from "./notes-realtime.repository.js";
import { retryNoteDeadlock } from "./notes-transaction.js";

type Executor = DatabaseService["db"];
type Tx = Transaction<CrmDatabase>;
type NoteCommand = { access: NoteAccess; action: string; id: string | null; input: { operationId: string } };
type AuditChange = { actor: number; operationId: string; action: "create" | "update" | "state_change"; after: NoteRecord; before: NoteRecord | null; context: NoteContext; relatedRecords?: readonly NoteRelatedReference[] };
export const noteContextKey = (moduleCode: string, context: NoteContext): string =>
    createHash("sha256")
        .update(JSON.stringify([moduleCode, context]))
        .digest("hex");
const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const projection = sql`n.id_note AS internalId,n.public_id_note AS publicId,n.author_user_id_note AS authorId,a.public_id_user AS authorPublicId,a.display_name_user AS authorName,n.origin_module_code_note AS moduleCode,n.title_note AS title,n.plain_text_note AS text,n.color_note AS color,n.priority_note AS priority,n.status_note AS status,n.visibility_note AS visibility,n.version_note AS version,DATE_FORMAT(n.created_at_note,'%Y-%m-%dT%H:%i:%s.%fZ') AS createdAt,DATE_FORMAT(n.updated_at_note,'%Y-%m-%dT%H:%i:%s.%fZ') AS updatedAt,DATE_FORMAT(n.completed_at_note,'%Y-%m-%dT%H:%i:%s.%fZ') AS completedAt,DATE_FORMAT(n.archived_at_note,'%Y-%m-%dT%H:%i:%s.%fZ') AS archivedAt`;
const actorId = (access: NoteAccess) => sql`(SELECT id_user FROM sec_user WHERE public_id_user=${access.actorPublicId} AND status_user='active' AND deleted_at_user IS NULL)`;
const acl = (access: NoteAccess) => sql`(n.author_user_id_note=${actorId(access)} OR (n.visibility_note='shared' AND EXISTS(SELECT 1 FROM crm_note_participant p WHERE p.note_id_note_participant=n.id_note AND p.user_id_note_participant=${actorId(access)} AND p.status_note_participant='active' AND p.revoked_at_note_participant IS NULL)))`;
const snapshot = (n: NoteRecord, context: NoteContext) => ({ version: n.version, status: n.status, priority: n.priority, color: n.color, titleDigest: digest(n.title), contentDigest: digest(n.text), contextKey: noteContextKey(n.moduleCode, context) });

const orderContextReferences = (context: NoteContext, aliases: readonly NoteRelatedReference[]): readonly NoteRelatedReference[] => {
    if (context.kind !== "sales_order") return [];
    return aliases.length ? aliases : [{ kind: "sales_order", source: context.source, id: context.id }];
};

const noteListOrigin = (access: NoteAccess, modules: readonly NoteModule[], acrossModules: boolean) => (acrossModules ? sql`n.origin_module_code_note IN (${sql.join(modules)})` : sql`n.origin_module_code_note=${access.moduleCode}`);

/** Native-only transactions. Author, note, receipt, audit and pending deliveries share one commit. */
@Injectable()
export class NotesRepository {
    /** Inject the native database and central audit writer. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(RecordAuditService) private readonly audit: RecordAuditService,
        @Inject(NotesRealtimeEventsRepository) private readonly realtime: NotesRealtimeEventsRepository,
    ) {}

    /** Read one note through module and author or participant visibility. */
    async find(access: NoteAccess, publicId: string, executor: Executor = this.database.db, lock = false): Promise<NoteRecord> {
        const rows = await sql<NoteRecord>`SELECT ${projection} FROM crm_note n JOIN sec_user a ON a.id_user=n.author_user_id_note WHERE n.public_id_note=${publicId} AND n.origin_module_code_note=${access.moduleCode} AND ${acl(access)} ${lock ? sql`FOR UPDATE` : sql``}`.execute(executor);
        const note = rows.rows[0];
        if (!note) throw new NotFoundException("Nota disponible no encontrada.");
        return note;
    }

    /** Decode immutable linked identity independently of resource lifecycle; presentation checks current access. */
    async context(note: NoteRecord, executor: Executor = this.database.db): Promise<NoteContext> {
        const result = await sql<{
            kind: string;
            entity: string;
            viewCode: string | null;
            orderId: string | null;
            externalId: string | null;
            system: string | null;
            key: string;
            primary: number;
        }>`SELECT l.target_kind_note_link AS kind,l.entity_type_note_link AS entity,l.view_code_note_link AS viewCode,o.public_id_sales_order AS orderId,l.external_id_note_link AS externalId,s.code_external_system AS ${sql.ref("system")},l.target_key_note_link AS ${sql.ref("key")},l.is_primary_note_link AS ${sql.ref("primary")} FROM crm_note_link l LEFT JOIN crm_sales_order o ON o.id_sales_order=l.sales_order_id_note_link LEFT JOIN int_external_system s ON s.id_external_system=l.external_system_id_note_link WHERE l.note_id_note_link=${note.internalId} AND l.is_primary_note_link=1`.execute(
            executor,
        );
        const row = result.rows[0];
        if (result.rows.length !== 1 || row?.primary !== 1) throw new ConflictException("Contexto de nota no soportado en esta etapa.");
        const context = decodeNoteLink(note.moduleCode, row);
        if (!context || row.key !== noteContextKey(note.moduleCode, context)) throw new ConflictException("Contexto de nota no soportado en esta etapa.");
        return context;
    }

    /** List one validated context with a consistent count and page. */
    // Preserve the established positional list contract while adding confirmed resource aliases.
    // eslint-disable-next-line max-params
    async list(access: NoteAccess, query: NoteList, context: NoteContext, modules: readonly NoteModule[] = [access.moduleCode], aliases: readonly NoteRelatedReference[] = []): Promise<{ items: NoteRecord[]; total: number }> {
        const resources = orderContextReferences(context, aliases);
        const matchContext =
            context.kind !== "sales_order"
                ? sql`l.target_kind_note_link='view' AND l.entity_type_note_link='view' AND l.view_code_note_link=${noteViewStorageCode(access.moduleCode, context)}`
                : context.source === "legacy"
                  ? sql`l.target_kind_note_link='external' AND l.entity_type_note_link='sales_order' AND l.external_id_note_link=${context.id} AND l.external_system_id_note_link=(SELECT id_external_system FROM int_external_system WHERE code_external_system='legacy_crm' AND status_external_system='active')`
                  : sql`l.target_kind_note_link='native' AND l.entity_type_note_link='sales_order' AND l.sales_order_id_note_link=(SELECT id_sales_order FROM crm_sales_order WHERE public_id_sales_order=${context.id} AND status_sales_order='active' AND cancelled_sales_order='no' AND deleted_at_sales_order IS NULL)`;
        const matchAliases = resources.length
            ? sql`(${sql.join(
                  resources.map((reference) =>
                      reference.source === "legacy"
                          ? sql`l.target_kind_note_link='external' AND l.entity_type_note_link='sales_order' AND l.external_id_note_link=${reference.id} AND l.external_system_id_note_link=(SELECT id_external_system FROM int_external_system WHERE code_external_system='legacy_crm' AND status_external_system='active')`
                          : sql`l.target_kind_note_link='native' AND l.entity_type_note_link='sales_order' AND l.sales_order_id_note_link=(SELECT id_sales_order FROM crm_sales_order WHERE public_id_sales_order=${reference.id})`,
                  ),
                  sql` OR `,
              )})`
            : matchContext;
        const key =
            context.kind === "sales_order"
                ? sql`(${sql.join(
                      modules.flatMap((module) => resources.map((reference) => sql`(n.origin_module_code_note=${module} AND l.target_key_note_link=${noteContextKey(module, { kind: "sales_order", source: reference.source, id: reference.id })})`)),
                      sql` OR `,
                  )})`
                : sql`l.target_key_note_link=${noteContextKey(access.moduleCode, context)}`;
        return this.database.db
            .transaction()
            .setIsolationLevel("repeatable read")
            .execute(async (tx) => {
                // Order identity is shared across workspaces; existing origin-scoped hashes remain valid for view links.
                const locationsEnabled = context.kind === "view" && (await sql`SELECT migration_name_schema_migration FROM conf_schema_migration WHERE migration_name_schema_migration='202610280052_notes_locations'`.execute(tx)).rows.length === 1;
                const origin = noteListOrigin(access, modules, context.kind === "sales_order" || locationsEnabled);
                const secondary = resources.length ? sql`(l.is_primary_note_link=0 AND l.target_key_note_link IN (${sql.join(resources.map(noteRelatedRecordKey))}))` : sql`1=0`;
                const canonical = sql`EXISTS(SELECT 1 FROM crm_note_link l WHERE l.note_id_note_link=n.id_note AND ((${key} AND l.is_primary_note_link=1) OR ${secondary}) AND ${matchAliases})`;
                const display = locationsEnabled ? sql`EXISTS(SELECT 1 FROM crm_note_location dl WHERE dl.note_id_note_location=n.id_note AND dl.module_code_note_location=${access.moduleCode} AND dl.view_code_note_location=${context.code ?? noteHomeViewCode(access.moduleCode)})` : sql`1=0`;
                const filter = sql`${origin} AND ${acl(access)} AND (${query.status === "all"} OR n.status_note=${query.status}) AND (${canonical} OR ${display}) AND (SELECT COUNT(*) FROM crm_note_link all_links WHERE all_links.note_id_note_link=n.id_note AND all_links.is_primary_note_link=1)=1`;
                const count = await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_note n WHERE ${filter}`.execute(tx);
                const rows = await sql<NoteRecord>`SELECT ${projection} FROM crm_note n JOIN sec_user a ON a.id_user=n.author_user_id_note WHERE ${filter} ORDER BY n.updated_at_note DESC,n.id_note DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`.execute(tx);
                return { total: count.rows[0]?.total ?? 0, items: rows.rows };
            });
    }

    /** Batch layout reads avoid one query per sticky note; actor and ACL are still enforced. */
    async placements(access: NoteAccess, notes: readonly NoteRecord[]) {
        type Placement = { noteId: string; viewportClass: string; anchorMode: string; x: number | string; y: number | string; width: number; height: number; collapsed: number; hidden: number; layoutVersion: number };
        const result = new Map<string, { viewportClass: string; anchorMode: string; x: number; y: number; width: number; height: number; collapsed: boolean; hidden: boolean; layoutVersion: number }[]>();
        if (!notes.length) return result;
        const rows =
            await sql<Placement>`SELECT n.public_id_note AS noteId,p.viewport_class_note_placement AS viewportClass,p.anchor_mode_note_placement AS anchorMode,p.x_note_placement AS x,p.y_note_placement AS y,p.width_note_placement AS width,p.height_note_placement AS height,p.collapsed_note_placement AS collapsed,(p.hidden_at_note_placement IS NOT NULL) AS hidden,p.layout_version_note_placement AS layoutVersion FROM crm_note_placement p JOIN crm_note n ON n.id_note=p.note_id_note_placement WHERE n.public_id_note IN (${sql.join(notes.map((note) => note.publicId))}) AND ${acl(access)} AND p.user_id_note_placement=${actorId(access)} AND p.context_code_note_placement=CONCAT('notes:',n.public_id_note)`.execute(
                this.database.db,
            );
        for (const row of rows.rows) {
            const list = result.get(row.noteId) ?? [];
            list.push({ viewportClass: row.viewportClass, anchorMode: row.anchorMode, x: Number(row.x), y: Number(row.y), width: row.width, height: row.height, collapsed: row.collapsed === 1, hidden: row.hidden === 1, layoutVersion: row.layoutVersion });
            result.set(row.noteId, list);
        }
        return result;
    }
    /** Read the current actor personal placements for a visible note. */
    async placement(access: NoteAccess, note: NoteRecord) {
        return (await this.placements(access, [note])).get(note.publicId) ?? [];
    }

    /** Read bounded central history for an already authorized note. */
    async history(note: NoteRecord, actorPublicId: string) {
        const rows = await sql<{
            id: string;
            action: string;
            occurredAt: string;
            actor: string;
            before: string | object | null;
            after: string | object | null;
        }>`SELECT e.id_record_event AS id,e.action_record_event AS action,DATE_FORMAT(e.recorded_at_record_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS occurredAt,e.actor_snapshot_record_event AS actor,JSON_REMOVE(e.before_record_event,'$.relatedRecords') AS ${sql.ref("before")},JSON_REMOVE(e.after_record_event,'$.relatedRecords') AS ${sql.ref("after")} FROM audit_record r JOIN audit_record_event e ON e.record_id_record_event=r.id_record WHERE r.source_schema_record='CRM_THINK_V2' AND r.entity_type_record='note' AND r.source_table_record='crm_note' AND r.source_id_record=${note.publicId} AND ((NOT JSON_CONTAINS_PATH(COALESCE(e.after_record_event,JSON_OBJECT()),'one','$.remindAt') AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.after_record_event,'$.command')),'')<>'following') OR JSON_UNQUOTE(JSON_EXTRACT(e.actor_snapshot_record_event,'$.publicId'))=${actorPublicId}) ORDER BY e.sequence_record_event DESC LIMIT 100`.execute(
            this.database.db,
        );
        return rows.rows;
    }

    /** Create the note, primary context, audit, deliveries and receipt atomically. */
    async create(access: NoteAccess, input: CreateNote, context: NoteContext, authorizeRelated?: () => Promise<readonly NoteRelatedReference[] | undefined>): Promise<NoteResult> {
        return this.command({ access, action: "create", id: null, input }, async (tx, actor) => {
            const relatedRecords = (await authorizeRelated?.()) ?? input.relatedRecords;
            const id = ulid();
            await sql`INSERT INTO crm_note (public_id_note,author_user_id_note,title_note,content_note,plain_text_note,color_note,priority_note,updated_by_user_id_note,origin_module_code_note) VALUES (${id},${actor},${input.title},${JSON.stringify({ format: "plain_text", text: input.text })},${input.text},${input.color},${input.priority},${actor},${input.moduleCode})`.execute(tx);
            const note = await this.find(access, id, tx, true);
            await this.linkContext(tx, note, context);
            if (relatedRecords?.length) await persistNoteRelatedRecords(tx, note, relatedRecords);
            await this.record(tx, { actor, operationId: input.operationId, action: "create", after: note, before: null, context, ...(relatedRecords ? { relatedRecords } : {}) });
            await this.enqueue(tx, access, note, "note_created");
            return { noteId: id, version: 1, replayed: false };
        });
    }

    /** Edit only an open note owned by the actor at the expected version. */
    async edit(access: NoteAccess, id: string, input: EditNote): Promise<NoteResult> {
        return this.command({ access, action: "edit", id, input }, async (tx, actor, note) => {
            if (!note) throw new NotFoundException();
            this.assertVersion(note, input.expectedVersion);
            if (note.status !== "open") throw new ConflictException("Reabra la nota antes de editarla.");
            const context = await this.context(note, tx);
            if (note.title === input.title && note.text === input.text && note.color === input.color && note.priority === input.priority) return { noteId: id, version: note.version, replayed: false };
            await sql`UPDATE crm_note SET title_note=${input.title},content_note=${JSON.stringify({ format: "plain_text", text: input.text })},plain_text_note=${input.text},color_note=${input.color},priority_note=${input.priority},version_note=version_note+1,updated_by_user_id_note=${actor},updated_at_note=UTC_TIMESTAMP(3) WHERE id_note=${note.internalId} AND author_user_id_note=${actor} AND version_note=${input.expectedVersion}`.execute(tx);
            const after = await this.find(access, id, tx);
            await this.record(tx, { actor, operationId: input.operationId, action: "update", after, before: note, context });
            await this.enqueue(tx, access, after, "note_updated");
            return { noteId: id, version: after.version, replayed: false };
        });
    }

    /** Apply author-only completion, reopening or archival atomically. */
    async lifecycle(access: NoteAccess, id: string, input: NoteState, action: NoteLifecycle): Promise<NoteResult> {
        return this.command({ access, action, id, input }, async (tx, actor, note) => {
            if (!note) throw new NotFoundException();
            this.assertVersion(note, input.expectedVersion);
            const context = await this.context(note, tx);
            const { status, completion, archive } = this.transition(note, action, actor);
            await sql`UPDATE crm_note SET status_note=${status},version_note=version_note+1,updated_by_user_id_note=${actor},updated_at_note=UTC_TIMESTAMP(3) ${completion} ${archive} WHERE id_note=${note.internalId} AND author_user_id_note=${actor} AND version_note=${input.expectedVersion}`.execute(tx);
            const after = await this.find(access, id, tx);
            if (action !== "reopen") {
                const workflow = await sql`SELECT migration_name_schema_migration FROM conf_schema_migration WHERE migration_name_schema_migration='202610280053_notes_workflow'`.execute(tx);
                if (workflow.rows.length) await sql`UPDATE crm_note_workflow_event SET status_note_workflow_event='cancelled' WHERE note_id_note_workflow_event=${note.internalId} AND status_note_workflow_event IN ('pending','processing')`.execute(tx);
            }
            await this.record(tx, { actor, operationId: input.operationId, action: "state_change", after, before: note, context });
            await this.enqueue(tx, access, after, `note_${status}`);
            return { noteId: id, version: after.version, replayed: false };
        });
    }

    /** Persist personal layout without changing content or its version. */
    async move(access: NoteAccess, id: string, input: NotePlacement): Promise<NoteResult> {
        return this.command({ access, action: "move", id, input }, async (tx, actor, note) => {
            if (!note) throw new NotFoundException();
            if (note.status !== "open") throw new ConflictException("Solo se recolocan notas abiertas.");
            const code = this.contextCode(note);
            const rows = await sql<{ id: number; version: number }>`SELECT id_note_placement AS id,layout_version_note_placement AS version FROM crm_note_placement WHERE note_id_note_placement=${note.internalId} AND user_id_note_placement=${actor} AND context_code_note_placement=${code} AND viewport_class_note_placement=${input.viewportClass} FOR UPDATE`.execute(tx);
            const current = rows.rows[0];
            if ((current ? current.version : 0) !== input.expectedLayoutVersion) throw new ConflictException("La posicion cambio; recargue la nota.");
            const hiddenAt = input.hidden ? sql`UTC_TIMESTAMP(3)` : null;
            if (current)
                await sql`UPDATE crm_note_placement SET anchor_mode_note_placement=${input.anchorMode},x_note_placement=${input.x},y_note_placement=${input.y},width_note_placement=${input.width},height_note_placement=${input.height},collapsed_note_placement=${Number(input.collapsed)},hidden_at_note_placement=${hiddenAt},layout_version_note_placement=layout_version_note_placement+1,updated_at_note_placement=UTC_TIMESTAMP(3) WHERE id_note_placement=${current.id} AND user_id_note_placement=${actor}`.execute(
                    tx,
                );
            else
                await sql`INSERT INTO crm_note_placement (note_id_note_placement,user_id_note_placement,context_code_note_placement,viewport_class_note_placement,anchor_mode_note_placement,x_note_placement,y_note_placement,width_note_placement,height_note_placement,collapsed_note_placement,hidden_at_note_placement) VALUES (${note.internalId},${actor},${code},${input.viewportClass},${input.anchorMode},${input.x},${input.y},${input.width},${input.height},${Number(input.collapsed)},${hiddenAt})`.execute(
                    tx,
                );
            const capture = await this.audit.captureActor(tx, actor);
            const after = { layoutVersion: input.expectedLayoutVersion + 1, anchorMode: input.anchorMode, hidden: input.hidden, collapsed: input.collapsed };
            await this.audit.append(tx, { source: { schema: "CRM_THINK_V2", table: "crm_note_placement", entity: "note_placement", id: `${id}:${access.actorPublicId}:${input.viewportClass}` }, actor: capture, action: "annotation", module: access.moduleCode, before: current ? { layoutVersion: current.version } : null, after, allowedFields: Object.keys(after), operationId: input.operationId, correlationId: input.operationId, snapshotScope: "partial" });
            return { noteId: id, version: note.version, layoutVersion: input.expectedLayoutVersion + 1, replayed: false };
        });
    }

    /** Resolve only existing native targets or registered external systems in the native transaction. */
    private async linkContext(tx: Tx, note: NoteRecord, context: NoteContext): Promise<void> {
        let kind = "view";
        let entity = "view";
        let viewCode: string | null = null;
        let orderId: number | null = null;
        let externalSystemId: number | null = null;
        let externalId: string | null = null;
        if (context.kind !== "sales_order") viewCode = noteViewStorageCode(note.moduleCode, context);
        else if (context.source === "legacy") {
            const system = (await sql<{ id: number }>`SELECT id_external_system AS id FROM int_external_system WHERE code_external_system='legacy_crm' AND status_external_system='active' FOR SHARE`.execute(tx)).rows[0];
            if (!system) throw new ServiceUnavailableException("Sistema de origen no disponible.");
            kind = "external";
            entity = "sales_order";
            externalSystemId = system.id;
            externalId = context.id;
        } else {
            const order = (await sql<{ id: number }>`SELECT id_sales_order AS id FROM crm_sales_order WHERE public_id_sales_order=${context.id} AND status_sales_order='active' AND cancelled_sales_order='no' AND deleted_at_sales_order IS NULL FOR SHARE`.execute(tx)).rows[0];
            if (!order) throw new NotFoundException("Orden disponible no encontrada.");
            kind = "native";
            entity = "sales_order";
            orderId = order.id;
        }
        await sql`INSERT INTO crm_note_link (note_id_note_link,target_key_note_link,target_kind_note_link,entity_type_note_link,view_code_note_link,sales_order_id_note_link,external_system_id_note_link,external_id_note_link,is_primary_note_link) VALUES (${note.internalId},${noteContextKey(note.moduleCode, context)},${kind},${entity},${viewCode},${orderId},${externalSystemId},${externalId},1)`.execute(tx);
    }

    /** Archived notes are terminal; completion metadata is reset only by reopening. */
    private transition(note: NoteRecord, action: NoteLifecycle, actor: number) {
        const allowed = { complete: ["open"], reopen: ["completed"], archive: ["open", "completed"] };
        if (!allowed[action].includes(note.status)) throw new ConflictException("Cambio de estado no disponible.");
        const status = { complete: "completed", reopen: "open", archive: "archived" }[action];
        const completion = action === "complete" ? sql`,completed_at_note=UTC_TIMESTAMP(3),completed_by_user_id_note=${actor}` : action === "reopen" ? sql`,completed_at_note=NULL,completed_by_user_id_note=NULL` : sql``;
        const archive = action === "archive" ? sql`,archived_at_note=UTC_TIMESTAMP(3),archived_by_user_id_note=${actor}` : sql``;
        return { status, completion, archive };
    }

    private contextCode(note: NoteRecord): string {
        return `notes:${note.publicId}`;
    }
    private assertVersion(note: NoteRecord, expected: number): void {
        if (note.version !== expected || expected >= 4294967295) throw new ConflictException("La nota cambio; recargue antes de guardar.");
    }

    /** Lock the actor first to serialize their operation IDs, including concurrent creates. */
    private async command(command: NoteCommand, execute: (tx: Tx, actor: number, note?: NoteRecord) => Promise<NoteResult>): Promise<NoteResult> {
        const { access, action, id, input } = command;
        if (!this.audit.enabled) throw new ServiceUnavailableException("Notas requiere auditoria central habilitada.");
        const hash = digest({ action, id, input });
        // Authorization after waiting for a note must observe the latest committed invitation state.
        return retryNoteDeadlock(() =>
            this.database.db
                .transaction()
                .setIsolationLevel("read committed")
                .execute(async (tx) => {
                    const users = await sql<{ id: number }>`SELECT id_user AS id FROM sec_user WHERE public_id_user=${access.actorPublicId} AND status_user='active' AND deleted_at_user IS NULL FOR UPDATE`.execute(tx);
                    const actor = users.rows[0]?.id;
                    if (!actor) throw new ForbiddenException("Usuario no disponible.");
                    const note = await this.lockCommandNote(tx, command);
                    const receipts = await sql<{ hash: string; result: string | object }>`SELECT request_hash_note_command AS hash,result_note_command AS result FROM int_note_command WHERE actor_user_id_note_command=${actor} AND operation_id_note_command=${input.operationId} FOR UPDATE`.execute(tx);
                    const receipt = receipts.rows[0];
                    if (receipt) return this.replay(tx, command, receipt, hash);
                    const result = await execute(tx, actor, note);
                    if (action !== "move") await this.realtime.enqueueNoteChange(tx, { noteId: result.noteId, actorPublicId: access.actorPublicId });
                    await sql`INSERT INTO int_note_command (actor_user_id_note_command,operation_id_note_command,request_hash_note_command,result_note_command) VALUES (${actor},${input.operationId},${hash},${JSON.stringify(result)})`.execute(tx);
                    return result;
                }),
        );
    }

    /** Recheck resource visibility, immutable authorship and supported context under the note lock. */
    private async lockCommandNote(tx: Tx, { access, action, id }: NoteCommand): Promise<NoteRecord | undefined> {
        if (!id) return undefined;
        const note = await this.find(access, id, tx, true);
        if (action !== "move" && note.authorPublicId !== access.actorPublicId) throw new ForbiddenException("Solo el autor puede modificar la nota.");
        await this.context(note, tx);
        return note;
    }

    private async replay(tx: Tx, command: NoteCommand, receipt: { hash: string; result: string | object }, hash: string): Promise<NoteResult> {
        if (receipt.hash !== hash) throw new ConflictException("La clave de operacion ya se utilizo con otro contenido.");
        const result = (typeof receipt.result === "string" ? JSON.parse(receipt.result) : receipt.result) as Omit<NoteResult, "replayed">;
        if (!command.id) await this.context(await this.find(command.access, result.noteId, tx), tx);
        return { ...result, replayed: true };
    }

    private async record(tx: Tx, change: AuditChange): Promise<void> {
        const { actor, operationId, action, after, before, context } = change;
        const capture = await this.audit.captureActor(tx, actor);
        const next = { ...snapshot(after, context), ...(change.relatedRecords ? { relatedRecords: change.relatedRecords } : {}) };
        await this.audit.append(tx, { source: { schema: "CRM_THINK_V2", table: "crm_note", entity: "note", id: after.publicId }, actor: capture, action, module: after.moduleCode, before: before ? snapshot(before, context) : null, after: next, allowedFields: Object.keys(next), operationId, correlationId: operationId, snapshotScope: "partial" });
    }

    /** Only references leave the transaction; no notification or legacy worker is activated. */
    private async enqueue(tx: Tx, access: NoteAccess, note: NoteRecord, eventType: string): Promise<void> {
        const payload = JSON.stringify({ schemaVersion: 1, noteId: note.publicId, moduleCode: note.moduleCode, actorPublicId: access.actorPublicId, version: note.version });
        for (const destination of ["notification", "legacy_projection"]) await sql`INSERT INTO int_event_outbox (public_id_event_outbox,aggregate_type_event_outbox,aggregate_public_id_event_outbox,aggregate_version_event_outbox,event_type_event_outbox,destination_code_event_outbox,payload_event_outbox) VALUES (${ulid()},'note',${note.publicId},${note.version},${eventType},${destination},${payload})`.execute(tx);
    }
}
