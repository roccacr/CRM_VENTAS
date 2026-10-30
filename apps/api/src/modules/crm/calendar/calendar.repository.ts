import { createHash } from "node:crypto";

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { z } from "zod";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { RecordAuditService } from "../audit/record-audit.service.js";
import type { CalendarInput, CalendarRow, CalendarType, CalendarUpdate } from "./calendar.contract.js";
import { CALENDAR_EVENT_TYPES, findCalendarEventType } from "./calendar-event-types.catalog.js";
import type { CalendarReadScope } from "./calendar-legacy.port.js";
import { readCalendarRelations, saveCalendarRelations } from "./calendar-relations.persistence.js";

const projection = sql`e.id_calendar_event AS internalId,e.public_id_calendar_event AS id,'native' AS source,o.code_org_unit AS originModule,t.public_id_calendar_event_type AS typeId,t.code_calendar_event_type AS typeCode,t.form_key_calendar_event_type AS formKey,e.title_calendar_event AS title,e.description_calendar_event AS description,e.location_calendar_event AS location,CONCAT(DATE_FORMAT(e.starts_at_calendar_event,'%Y-%m-%dT%H:%i:%s.'),LEFT(DATE_FORMAT(e.starts_at_calendar_event,'%f'),3),'Z') AS start,CONCAT(DATE_FORMAT(e.ends_at_calendar_event,'%Y-%m-%dT%H:%i:%s.'),LEFT(DATE_FORMAT(e.ends_at_calendar_event,'%f'),3),'Z') AS end,e.all_day_calendar_event AS allDay,e.status_calendar_event AS status,e.version_calendar_event AS version,e.details_calendar_event AS details,u.public_id_user AS ownerPublicId`;
const joins = sql`crm_calendar_event e JOIN sec_org_unit o ON o.id_org_unit=e.origin_module_id_calendar_event JOIN conf_calendar_event_type t ON t.id_calendar_event_type=e.type_id_calendar_event JOIN sec_user u ON u.id_user=e.organizer_user_id_calendar_event`;
/** Bounded normalized metadata, never arbitrary JSON returned from storage. */
export function calendarDetails(value: unknown): { reference?: string; teamsRequested?: boolean } {
    const decoded: unknown = typeof value === "string" ? JSON.parse(value) : value;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return {};
    const reference: unknown = Reflect.get(decoded, "reference");
    const teamsRequested: unknown = Reflect.get(decoded, "teamsRequested");
    return { ...(typeof reference === "string" && reference.length <= 160 ? { reference } : {}), ...(typeof teamsRequested === "boolean" ? { teamsRequested } : {}) };
}
function snapshot(row: CalendarRow, commandHash?: string) {
    return { publicId: row.id, moduleCode: row.originModule, typeId: row.typeId, title: row.title, description: row.description, location: row.location, start: row.start, end: row.end, allDay: Boolean(row.allDay), status: row.status, version: row.version, details: calendarDetails(row.details), participants: row.participants ?? [], links: row.links ?? [], ...(commandHash ? { commandHash } : {}) };
}
/** Calendar queries and audited native commands share the canonical pool and transaction. */
@Injectable()
export class CalendarRepository {
    /** Injects the existing identity, persistence or audit dependencies. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(RecordAuditService) private readonly audit: RecordAuditService,
    ) {}
    /** Runs both calendar sources in one repeatable read-only snapshot. */
    read<T>(callback: (tx: Transaction<CrmDatabase>) => Promise<T>): Promise<T> {
        return this.database.db.transaction().setIsolationLevel("repeatable read").setAccessMode("read only").execute(callback);
    }
    /** Returns active types only for the authorized module selection. */
    async types(tx: Transaction<CrmDatabase>, modules: readonly string[]): Promise<CalendarType[]> {
        if (!modules.length) return [];
        const rows = (
            await sql<CalendarType>`SELECT t.public_id_calendar_event_type AS id,o.code_org_unit AS moduleCode,t.code_calendar_event_type AS code,t.name_calendar_event_type AS label,t.color_calendar_event_type AS color,t.form_key_calendar_event_type AS formKey FROM conf_calendar_event_type t JOIN sec_org_unit o ON o.id_org_unit=t.module_id_calendar_event_type WHERE o.code_org_unit IN (${sql.join(modules)}) AND o.status_org_unit='active' AND o.deleted_at_org_unit IS NULL AND t.status_calendar_event_type='active' ORDER BY o.sort_order_org_unit,t.name_calendar_event_type`.execute(
                tx,
            )
        ).rows;
        return rows

            .flatMap((type) => {
                const configured = findCalendarEventType(type.code, type.moduleCode);
                return configured ? [{ ...type, label: configured.tipo, color: configured.color }] : [];
            })
            .sort((a, b) => CALENDAR_EVENT_TYPES.findIndex((type) => type.codigo === a.code) - CALENDAR_EVENT_TYPES.findIndex((type) => type.codigo === b.code));
    }
    /** Reads bounded, authorized events without inventing historical module ownership. */
    async list(tx: Transaction<CrmDatabase>, scope: CalendarReadScope): Promise<CalendarRow[]> {
        if (!scope.modules.length) return [];
        const broad = scope.broadModules.length ? sql`o.code_org_unit IN (${sql.join(scope.broadModules)})` : sql`FALSE`;
        const invitedAllowed = scope.excludedInviteModules?.length ? sql`o.code_org_unit NOT IN (${sql.join(scope.excludedInviteModules)})` : sql`TRUE`;
        const rows = (
            await sql<CalendarRow>`SELECT ${projection} FROM ${joins} WHERE e.deleted_at_calendar_event IS NULL AND o.status_org_unit='active' AND o.deleted_at_org_unit IS NULL AND e.starts_at_calendar_event < ${new Date(scope.end).toISOString().slice(0, 23).replace("T", " ")} AND e.ends_at_calendar_event > ${new Date(scope.start).toISOString().slice(0, 23).replace("T", " ")} AND ((o.code_org_unit IN (${sql.join(scope.modules)}) AND (${broad} OR u.public_id_user=${scope.actorPublicId})) OR (${invitedAllowed} AND EXISTS(SELECT 1 FROM crm_calendar_participant p JOIN sec_user pu ON pu.id_user=p.user_id_calendar_participant WHERE p.event_id_calendar_participant=e.id_calendar_event AND pu.public_id_user=${scope.actorPublicId} AND p.status_calendar_participant='active' AND p.revoked_at_calendar_participant IS NULL))) ORDER BY e.starts_at_calendar_event,e.id_calendar_event LIMIT 501`.execute(
                tx,
            )
        ).rows;
        return readCalendarRelations(tx, rows);
    }
    private async record(tx: Transaction<CrmDatabase>, publicId: string, lock = false): Promise<CalendarRow> {
        const ending = lock ? sql`FOR UPDATE` : sql``;
        const row = (await sql<CalendarRow>`SELECT ${projection} FROM ${joins} WHERE e.public_id_calendar_event=${publicId} AND e.deleted_at_calendar_event IS NULL AND o.status_org_unit='active' AND o.deleted_at_org_unit IS NULL ${ending}`.execute(tx)).rows[0];
        if (!row) throw new NotFoundException("Evento no disponible.");
        if (lock && !findCalendarEventType(row.typeCode, row.originModule)) throw new ConflictException("Este tipo histórico solo está disponible para consulta.");
        const [hydrated] = await readCalendarRelations(tx, [row]);
        return hydrated ?? row;
    }
    /** An actor lock serializes retries before creation; event locks/version protect concurrent edits. */
    // Preserve the established positional command API with a final transaction validation callback.
    // eslint-disable-next-line max-params
    async save(actorPublicId: string, input: CalendarInput | CalendarUpdate, ownOnly: boolean, publicId?: string, validate?: (tx: Transaction<CrmDatabase>, before: CalendarRow | null) => Promise<void>): Promise<CalendarRow> {
        if (!this.audit.enabled) throw new ServiceUnavailableException("La gestión del calendario requiere bitácora habilitada.");
        // One transaction deliberately owns replay, event, relations and audit rollback.
        // eslint-disable-next-line complexity
        return this.database.db.transaction().execute(async (tx) => {
            const actor = await tx.selectFrom("sec_user").select("id_user").where("public_id_user", "=", actorPublicId).where("status_user", "=", "active").where("deleted_at_user", "is", null).forUpdate().executeTakeFirst();
            if (!actor) throw new ForbiddenException("Usuario no disponible.");
            const operation = `calendar:${createHash("sha256").update(`${actorPublicId}:${input.operationId}`).digest("hex")}`;
            const commandHash = createHash("sha256")
                .update(JSON.stringify({ id: publicId ?? null, input }))
                .digest("hex");
            const replay = (await sql<{ data: unknown }>`SELECT e.after_record_event AS data FROM audit_record_event e JOIN audit_record r ON r.id_record=e.record_id_record_event WHERE e.actor_reference_record_event=${actorPublicId} AND e.operation_id_record_event=${operation} AND r.entity_type_record='calendar_event' AND r.source_schema_record='CRM_THINK_V2' AND r.source_table_record='crm_calendar_event' LIMIT 1 FOR UPDATE`.execute(tx)).rows[0];
            if (replay) return this.replay(tx, replay.data, { hash: commandHash, moduleCode: input.moduleCode, actor: actorPublicId, ownOnly });
            const before = publicId ? await this.record(tx, publicId, true) : null;
            this.assertEditable(before, input, actorPublicId, ownOnly);
            await validate?.(tx, before);
            const type = await tx
                .selectFrom("conf_calendar_event_type as t")
                .innerJoin("sec_org_unit as o", "o.id_org_unit", "t.module_id_calendar_event_type")
                .select(["t.id_calendar_event_type", "t.code_calendar_event_type", "o.id_org_unit"])
                .where("t.public_id_calendar_event_type", "=", input.typeId)
                .where("o.code_org_unit", "=", input.moduleCode)
                .where("t.status_calendar_event_type", "=", "active")
                .where("o.status_org_unit", "=", "active")
                .where("o.deleted_at_org_unit", "is", null)
                .forUpdate()
                .executeTakeFirst();
            if (!type) throw new ConflictException("El tipo de evento no pertenece al módulo o ya no está disponible.");
            const id = await this.write(tx, input, { actorId: actor.id_user, moduleId: type.id_org_unit, typeId: type.id_calendar_event_type, typeCode: type.code_calendar_event_type, publicId, before });
            const saved = await this.record(tx, id);
            await saveCalendarRelations(tx, saved.internalId, actor.id_user, input);
            const after = await this.record(tx, id);
            const captured = await this.audit.captureActor(tx, actor.id_user);
            const next = snapshot(after, commandHash);
            await this.audit.append(tx, { source: { schema: "CRM_THINK_V2", table: "crm_calendar_event", entity: "calendar_event", id: String(after.internalId) }, actor: captured, action: before ? "update" : "create", module: after.originModule, before: before ? snapshot(before) : null, after: next, allowedFields: Object.keys(next), operationId: operation, correlationId: input.operationId, snapshotScope: "partial" });
            return after;
        });
    }
    /** Persist only validated event fields; the caller appends audit before committing. */
    private async write(tx: Transaction<CrmDatabase>, input: CalendarInput, context: { actorId: number; moduleId: number; typeId: number; typeCode: string; publicId: string | undefined; before: CalendarRow | null }): Promise<string> {
        if (!findCalendarEventType(context.typeCode, input.moduleCode)) throw new ConflictException("Este tipo de evento no está habilitado para el módulo.");
        const values = {
            type_id_calendar_event: context.typeId,
            title_calendar_event: input.title,
            description_calendar_event: input.description ?? null,
            location_calendar_event: input.location ?? null,
            starts_at_calendar_event: new Date(input.start).toISOString().slice(0, 23).replace("T", " "),
            ends_at_calendar_event: new Date(input.end).toISOString().slice(0, 23).replace("T", " "),
            all_day_calendar_event: input.allDay ? (1 as const) : (0 as const),
            details_calendar_event: JSON.stringify(input.details),
            updated_by_user_id_calendar_event: context.actorId,
        };
        const id = context.publicId ?? ulid();
        if (context.before)
            await tx
                .updateTable("crm_calendar_event")
                .set({ ...values, version_calendar_event: context.before.version + 1, invitation_version_calendar_event: sql`invitation_version_calendar_event+1` })
                .where("id_calendar_event", "=", context.before.internalId)
                .execute();
        else
            await tx
                .insertInto("crm_calendar_event")
                .values({ ...values, public_id_calendar_event: id, origin_module_id_calendar_event: context.moduleId, organizer_user_id_calendar_event: context.actorId, created_by_user_id_calendar_event: context.actorId, timezone_calendar_event: "America/Costa_Rica", legacy_calendar_id_calendar_event: null, color_override_calendar_event: null, cancellation_reason_calendar_event: null, deleted_at_calendar_event: null })
                .execute();
        return id;
    }
    private assertEditable(before: CalendarRow | null, input: CalendarInput | CalendarUpdate, actorPublicId: string, ownOnly: boolean): void {
        if (!before) return;
        if (before.originModule !== input.moduleCode) throw new ForbiddenException("El evento solo se gestiona desde su módulo de origen.");
        if (ownOnly && before.ownerPublicId !== actorPublicId) throw new ForbiddenException("No tiene permiso para editar este evento.");
        if (!("expectedVersion" in input) || before.version !== input.expectedVersion) throw new ConflictException("El evento cambió; recárguelo antes de guardar.");
        if (before.status === "cancelled") throw new ConflictException("No se puede editar un evento cancelado.");
    }
    private async replay(tx: Transaction<CrmDatabase>, value: unknown, context: { hash: string; moduleCode: string; actor: string; ownOnly: boolean }): Promise<CalendarRow> {
        const parsed = z.object({ commandHash: z.string(), publicId: z.string() }).safeParse(typeof value === "string" ? JSON.parse(value) : value);
        if (!parsed.success) throw new ConflictException("Registro de operación inválido.");
        if (parsed.data.commandHash !== context.hash) throw new ConflictException("Identificador de operación reutilizado con otro contenido.");
        const row = await this.record(tx, parsed.data.publicId, true);
        if (row.originModule !== context.moduleCode || (context.ownOnly && row.ownerPublicId !== context.actor)) throw new ForbiddenException("Evento no autorizado.");
        return row;
    }
}
