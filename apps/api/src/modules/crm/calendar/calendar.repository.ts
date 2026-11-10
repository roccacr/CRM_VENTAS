import { createHash } from "node:crypto";

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { z } from "zod";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { RecordAuditService } from "../audit/record-audit.service.js";
import type { CalendarInput, CalendarRow, CalendarStatusTransition, CalendarType, CalendarUpdate } from "./calendar.contract.js";
import { calendarAddendumRelations, readCalendarAddendumLock } from "./calendar-addendum.policy.js";
import { CALENDAR_EVENT_TYPES, findCalendarEventType } from "./calendar-event-types.catalog.js";
import type { CalendarReadScope } from "./calendar-legacy.port.js";
import { saveCalendarNotifications } from "./calendar-notifications.js";
import { readCalendarRelations, saveCalendarRelations } from "./calendar-relations.persistence.js";

const projection = sql`e.id_calendar_event AS internalId,e.public_id_calendar_event AS id,'native' AS source,o.code_org_unit AS originModule,t.public_id_calendar_event_type AS typeId,t.code_calendar_event_type AS typeCode,t.form_key_calendar_event_type AS formKey,e.title_calendar_event AS title,e.description_calendar_event AS description,e.location_calendar_event AS location,CONCAT(DATE_FORMAT(e.starts_at_calendar_event,'%Y-%m-%dT%H:%i:%s.'),LEFT(DATE_FORMAT(e.starts_at_calendar_event,'%f'),3),'Z') AS start,CONCAT(DATE_FORMAT(e.ends_at_calendar_event,'%Y-%m-%dT%H:%i:%s.'),LEFT(DATE_FORMAT(e.ends_at_calendar_event,'%f'),3),'Z') AS end,e.all_day_calendar_event AS allDay,e.status_calendar_event AS status,e.version_calendar_event AS version,e.details_calendar_event AS details,u.public_id_user AS ownerPublicId,JSON_OBJECT('typeLabel',t.name_calendar_event_type,'typeColor',t.color_calendar_event_type,'colorOverride',e.color_override_calendar_event,'timezone',e.timezone_calendar_event,'cancellationReason',e.cancellation_reason_calendar_event,'organizerName',u.display_name_user,'createdAt',DATE_FORMAT(e.created_at_calendar_event,'%Y-%m-%dT%H:%i:%s.000Z'),'updatedAt',DATE_FORMAT(e.updated_at_calendar_event,'%Y-%m-%dT%H:%i:%s.000Z'),'invitationVersion',e.invitation_version_calendar_event) AS storedMetadata`;
const joins = sql`crm_calendar_event e JOIN sec_org_unit o ON o.id_org_unit=e.origin_module_id_calendar_event JOIN conf_calendar_event_type t ON t.id_calendar_event_type=e.type_id_calendar_event JOIN sec_user u ON u.id_user=e.organizer_user_id_calendar_event`;
const storedMetadataSchema = z.object({
    typeLabel: z.string(),
    typeColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .nullable(),
    colorOverride: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .nullable()
        .catch(null)
        .default(null),
    timezone: z.string().nullable().default(null),
    cancellationReason: z.string().nullable().default(null),
    organizerName: z.string().nullable().default(null),
    createdAt: z.iso.datetime().nullable().default(null),
    updatedAt: z.iso.datetime().nullable().default(null),
    invitationVersion: z.number().int().nullable().default(null),
});
/** Solo metadatos de negocio conocidos; no entrega IDs internos ni JSON arbitrario. */
export function calendarStoredMetadata(row: CalendarRow) {
    const configured = findCalendarEventType(row.typeCode, row.originModule);
    const stored: unknown = typeof row.storedMetadata === "string" ? JSON.parse(row.storedMetadata) : row.storedMetadata;
    return storedMetadataSchema.parse({ typeLabel: configured?.tipo ?? row.typeCode, typeColor: configured?.color ?? null, ...(stored as Record<string, unknown> | undefined) });
}
/** Del JSON guardado solo salen referencia, Teams y sala. Lo demás, incluido el candado del adéndum, no se proyecta como detalle editable. */
export function calendarDetails(value: unknown): { reference?: string; teamsRequested?: boolean; roomAddress?: string } {
    const decoded: unknown = typeof value === "string" ? JSON.parse(value) : value;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return {};
    const parsed = z.object({ reference: z.string().max(160).optional().catch(undefined), teamsRequested: z.boolean().optional().catch(undefined), roomAddress: z.email().max(254).optional().catch(undefined) }).parse(decoded);
    return { ...(parsed.reference === undefined ? {} : { reference: parsed.reference }), ...(parsed.teamsRequested === undefined ? {} : { teamsRequested: parsed.teamsRequested }), ...(parsed.roomAddress === undefined ? {} : { roomAddress: parsed.roomAddress }) };
}
function snapshot(row: CalendarRow, commandHash?: string) {
    return {
        publicId: row.id,
        moduleCode: row.originModule,
        typeId: row.typeId,
        title: row.title,
        description: row.description,
        location: row.location,
        start: row.start,
        end: row.end,
        allDay: Boolean(row.allDay),
        status: row.status,
        cancellationReason: calendarStoredMetadata(row).cancellationReason,
        version: row.version,
        details: calendarDetails(row.details),
        participants: row.participants ?? [],
        links: row.links ?? [],
        ...(readCalendarAddendumLock(row.details) ? { orderLinksLocked: true } : {}),
        ...(commandHash ? { commandHash } : {}),
    };
}
/** Consultas y comandos usan el pool nativo. Sin bitácora encendida el guardado responde 503 y no escribe el evento. */
@Injectable()
export class CalendarRepository {
    /** Pool nativo y bitácora de registros. El actor se captura dentro de la transacción de escritura. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(RecordAuditService) private readonly audit: RecordAuditService,
    ) {}
    /** Una foto de lectura repetible y solo lectura. Aquí no se puede escribir ni ver una fila confirmada a medias. */
    read<T>(callback: (tx: Transaction<CrmDatabase>) => Promise<T>): Promise<T> {
        return this.database.db.transaction().setIsolationLevel("repeatable read").setAccessMode("read only").execute(callback);
    }
    /** Tipos activos de los módulos autorizados. El rótulo y el color salen del catálogo; un tipo que ya no está ahí no se ofrece para crear. */
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
    /** Hasta 501 filas. El módulo amplio ve el equipo; el propio, solo lo que organiza. La invitación no atraviesa un deny. Coincidir con Outlook alarga la ventana, no el permiso. */
    async list(tx: Transaction<CrmDatabase>, scope: CalendarReadScope): Promise<CalendarRow[]> {
        if (!scope.modules.length) return [];
        const broad = scope.broadModules.length ? sql`o.code_org_unit IN (${sql.join(scope.broadModules)})` : sql`FALSE`;
        const invitedAllowed = scope.excludedInviteModules?.length ? sql`o.code_org_unit NOT IN (${sql.join(scope.excludedInviteModules)})` : sql`TRUE`;
        const matched = scope.externalEventIds?.length ? sql`e.public_id_calendar_event IN (${sql.join(scope.externalEventIds)})` : sql`FALSE`;
        const rows = (
            await sql<CalendarRow>`SELECT ${projection} FROM ${joins} WHERE e.deleted_at_calendar_event IS NULL AND o.status_org_unit='active' AND o.deleted_at_org_unit IS NULL AND ((e.starts_at_calendar_event < ${new Date(scope.end).toISOString().slice(0, 23).replace("T", " ")} AND e.ends_at_calendar_event > ${new Date(scope.start).toISOString().slice(0, 23).replace("T", " ")}) OR ${matched}) AND ((o.code_org_unit IN (${sql.join(scope.modules)}) AND (${broad} OR u.public_id_user=${scope.actorPublicId})) OR (${invitedAllowed} AND EXISTS(SELECT 1 FROM crm_calendar_participant p JOIN sec_user pu ON pu.id_user=p.user_id_calendar_participant WHERE p.event_id_calendar_participant=e.id_calendar_event AND pu.public_id_user=${scope.actorPublicId} AND p.status_calendar_participant='active' AND p.revoked_at_calendar_participant IS NULL))) ORDER BY e.starts_at_calendar_event,e.id_calendar_event LIMIT 501`.execute(
                tx,
            )
        ).rows;
        return readCalendarRelations(tx, rows);
    }
    /** Lectura interna; el servicio revalida la visibilidad antes de proyectar el detalle. */
    async detailRecord(tx: Transaction<CrmDatabase>, id: string): Promise<CalendarRow> {
        return this.record(tx, id);
    }
    private async record(tx: Transaction<CrmDatabase>, publicId: string, lock = false): Promise<CalendarRow> {
        const ending = lock ? sql`FOR UPDATE` : sql``;
        const row = (await sql<CalendarRow>`SELECT ${projection} FROM ${joins} WHERE e.public_id_calendar_event=${publicId} AND e.deleted_at_calendar_event IS NULL AND o.status_org_unit='active' AND o.deleted_at_org_unit IS NULL ${ending}`.execute(tx)).rows[0];
        if (!row) throw new NotFoundException("Evento no disponible.");
        if (lock && !findCalendarEventType(row.typeCode, row.originModule)) throw new ConflictException("Este tipo histórico solo está disponible para consulta.");
        const [hydrated] = await readCalendarRelations(tx, [row]);
        return hydrated ?? row;
    }
    /**
     * El usuario activo se bloquea antes de crear, para serializar el reintento.
     * El mismo `operationId` y el mismo contenido devuelven la fila ya guardada. Otro contenido es conflicto.
     * Solo el organizador edita, desde el módulo de origen, con la versión leída. Un cancelado no cambia campos; el cambio de estado sí entra, con el estado esperado.
     */
    // El callback de validación corre dentro de esta transacción, después de resolver el tipo y antes de escribir.
    // eslint-disable-next-line max-params
    async save(actorPublicId: string, input: CalendarInput | CalendarUpdate, ownOnly: boolean, publicId?: string, validate?: (tx: Transaction<CrmDatabase>, before: CalendarRow | null, typeCode?: string) => Promise<void>, transition?: CalendarStatusTransition): Promise<CalendarRow> {
        if (!this.audit.enabled) throw new ServiceUnavailableException("La gestión del calendario requiere bitácora habilitada.");
        // Reintento, evento, relaciones y bitácora revierten juntos. Un fallo no deja el evento sin su aviso.
        // eslint-disable-next-line complexity, sonarjs/cognitive-complexity
        return this.database.db.transaction().execute(async (tx) => {
            const actor = await tx.selectFrom("sec_user").select("id_user").where("public_id_user", "=", actorPublicId).where("status_user", "=", "active").where("deleted_at_user", "is", null).forUpdate().executeTakeFirst();
            if (!actor) throw new ForbiddenException("Usuario no disponible.");
            const operation = `calendar:${createHash("sha256").update(`${actorPublicId}:${input.operationId}`).digest("hex")}`;
            const commandHash = createHash("sha256")
                .update(JSON.stringify({ id: publicId ?? null, input, ...(transition ? { transition } : {}) }))
                .digest("hex");
            const replay = (await sql<{ data: unknown }>`SELECT e.after_record_event AS data FROM audit_record_event e JOIN audit_record r ON r.id_record=e.record_id_record_event WHERE e.actor_reference_record_event=${actorPublicId} AND e.operation_id_record_event=${operation} AND r.entity_type_record='calendar_event' AND r.source_schema_record='CRM_THINK_V2' AND r.source_table_record='crm_calendar_event' LIMIT 1 FOR UPDATE`.execute(tx)).rows[0];
            if (replay) {
                const row = await this.replay(tx, replay.data, { hash: commandHash, moduleCode: input.moduleCode, actor: actorPublicId, ownOnly });
                if (transition && (!("expectedVersion" in input) || row.version !== input.expectedVersion + 1 || row.status !== transition.status)) throw new ConflictException("El evento cambió después de esta operación.");
                return row;
            }
            const before = publicId ? await this.record(tx, publicId, true) : null;
            this.assertEditable(before, input, actorPublicId, transition);
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
            // El tipo se resuelve en servidor antes de cualquier efecto de negocio del Adéndum.
            await validate?.(tx, before, type.code_calendar_event_type);
            const id = transition ? publicId : await this.write(tx, input, { actorId: actor.id_user, moduleId: type.id_org_unit, typeId: type.id_calendar_event_type, typeCode: type.code_calendar_event_type, publicId, before });
            if (!id) throw new ConflictException("El evento no está disponible.");
            if (transition) {
                if (!before) throw new ConflictException("El evento no está disponible.");
                await tx
                    .updateTable("crm_calendar_event")
                    .set({ status_calendar_event: transition.status, cancellation_reason_calendar_event: transition.status === "cancelled" ? (transition.reason ?? "Cancelado por el organizador") : null, version_calendar_event: before.version + 1, invitation_version_calendar_event: sql`invitation_version_calendar_event+1`, updated_by_user_id_calendar_event: actor.id_user })
                    .where("public_id_calendar_event", "=", id)
                    .execute();
                if (transition.status === "cancelled" || transition.expectedStatus === "cancelled")
                    await tx
                        .updateTable("int_calendar_event_sync")
                        .set({ desired_state_calendar_event_sync: transition.status === "cancelled" ? "absent" : "present", status_calendar_event_sync: "pending" })
                        .where("event_id_calendar_event_sync", "=", before.internalId)
                        .execute();
            }
            const saved = await this.record(tx, id);
            await saveCalendarRelations(tx, saved.internalId, actor.id_user, input);
            const after = await this.record(tx, id);
            await saveCalendarNotifications(tx, before, after, actor.id_user);
            const captured = await this.audit.captureActor(tx, actor.id_user);
            const next = snapshot(after, commandHash);
            await this.audit.append(tx, { source: { schema: "CRM_THINK_V2", table: "crm_calendar_event", entity: "calendar_event", id: String(after.internalId) }, actor: captured, action: before ? "update" : "create", module: after.originModule, before: before ? snapshot(before) : null, after: next, allowedFields: Object.keys(next), operationId: operation, correlationId: input.operationId, snapshotScope: "partial" });
            return after;
        });
    }
    /** Solo campos ya validados. La zona al crear es America/Costa_Rica. El candado del adéndum se guarda junto al detalle y no lo manda el cliente como campo suelto. */
    private async write(tx: Transaction<CrmDatabase>, input: CalendarInput, context: { actorId: number; moduleId: number; typeId: number; typeCode: string; publicId: string | undefined; before: CalendarRow | null }): Promise<string> {
        if (!findCalendarEventType(context.typeCode, input.moduleCode)) throw new ConflictException("Este tipo de evento no está habilitado para el módulo.");
        const addendumRelations = calendarAddendumRelations(input, context.before, context.typeCode);
        const values = {
            type_id_calendar_event: context.typeId,
            title_calendar_event: input.title,
            description_calendar_event: input.description ?? null,
            location_calendar_event: input.location ?? null,
            starts_at_calendar_event: new Date(input.start).toISOString().slice(0, 23).replace("T", " "),
            ends_at_calendar_event: new Date(input.end).toISOString().slice(0, 23).replace("T", " "),
            all_day_calendar_event: input.allDay ? (1 as const) : (0 as const),
            details_calendar_event: JSON.stringify({ ...input.details, ...(addendumRelations ? { addendumRelations } : {}) }),
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
    private assertEditable(before: CalendarRow | null, input: CalendarInput | CalendarUpdate, actorPublicId: string, transition?: CalendarStatusTransition): void {
        if (!before) return;
        if (before.originModule !== input.moduleCode) throw new ForbiddenException("El evento solo se gestiona desde su módulo de origen.");
        if (before.ownerPublicId !== actorPublicId) throw new ForbiddenException("Solo el organizador puede editar este evento.");
        if (!["expectedVersion" in input, before.version === (input as CalendarUpdate).expectedVersion].every(Boolean)) throw new ConflictException("El evento cambió; recárguelo antes de guardar.");
        if ([Boolean(transition), before.status !== transition?.expectedStatus].every(Boolean)) throw new ConflictException("El estado del evento cambió.");
        if ([before.status === "cancelled", !transition].every(Boolean)) throw new ConflictException("No se puede editar un evento cancelado.");
    }
    private async replay(tx: Transaction<CrmDatabase>, value: unknown, context: { hash: string; moduleCode: string; actor: string; ownOnly: boolean }): Promise<CalendarRow> {
        const parsed = z.object({ commandHash: z.string(), publicId: z.string() }).safeParse(typeof value === "string" ? JSON.parse(value) : value);
        if (!parsed.success) throw new ConflictException("Registro de operación inválido.");
        if (parsed.data.commandHash !== context.hash) throw new ConflictException("Identificador de operación reutilizado con otro contenido.");
        const row = await this.record(tx, parsed.data.publicId, true);
        if (row.originModule !== context.moduleCode || row.ownerPublicId !== context.actor) throw new ForbiddenException("Evento no autorizado.");
        return row;
    }
}
