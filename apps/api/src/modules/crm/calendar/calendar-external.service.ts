import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { z } from "zod";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { IdentityService } from "../identity/identity.service.js";
import type { IdentityProfile } from "../identity/identity.types.js";
import { CALENDAR_MODULES, type CalendarInput, type CalendarRow, type CalendarStatusInput } from "./calendar.contract.js";
import { calendarDetails } from "./calendar.repository.js";
import { calendarAccess } from "./calendar-access.js";
import { EXTERNAL_CALENDAR, type ExternalAvailability, ExternalCalendarError, type ExternalCalendarPort, type ExternalFeedEvent, type ExternalRoom, type ExternalSlot, type RoomAvailability } from "./external-calendar.port.js";

const publicId = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
const base = z.strictObject({ moduleCode: z.enum(CALENDAR_MODULES) });
const roomsQuery = base.extend({ start: z.iso.datetime().optional(), end: z.iso.datetime().optional() }).refine((query) => Boolean(query.start) === Boolean(query.end));
const querySchema = base.extend({ start: z.iso.datetime(), end: z.iso.datetime(), userIds: z.array(publicId).max(100).default([]), roomAddress: z.email().max(254).optional(), eventId: publicId.optional() });
type Tx = Transaction<CrmDatabase>;
export interface CalendarDelivery {
    status: "crm_only" | "synced" | "consent_required" | "unavailable" | "conflict";
    outlookId?: string;
    joinUrl?: string | null;
    roomStatus?: string | null;
}
export interface CalendarFeed {
    status: "connected" | "consent_required" | "unavailable" | "conflict";
    events: ExternalFeedEvent[];
    links: { remoteId: string; eventId: string }[];
}

/** Coordina acceso CRM y puerto externo; las fallas externas no revierten un evento nativo confirmado. */
@Injectable()
export class CalendarExternalService {
    /** Solo el organizador del buzón actual puede editar; la UI no proporciona autoridad. */
    async updateOwnEvent(session: string | undefined, id: string, input: unknown) {
        const schema = base.extend({ title: z.string().trim().min(1).max(300), location: z.string().max(500), start: z.iso.datetime(), end: z.iso.datetime(), allDay: z.boolean(), expectedVersion: z.string().min(1).max(500) });
        const parsed = schema.safeParse(input);
        if (!parsed.success) throw new BadRequestException("Evento de Outlook inválido.");
        if (![Boolean(id), id.length <= 2048].every(Boolean)) throw new BadRequestException("Identidad de Outlook inválida.");
        const profile = await this.authorize(session, parsed.data.moduleCode);
        if (!calendarAccess(profile, parsed.data.moduleCode, "update").allowed || profile.auth.currentProvider !== "microsoft") throw new ForbiddenException("No puedes editar este calendario.");
        const duration = Date.parse(parsed.data.end) - Date.parse(parsed.data.start);
        if (![duration > 0, duration <= 366 * 86400000].every(Boolean)) throw new BadRequestException("Intervalo inválido.");
        const result = await this.delegated(session, ["Calendars.ReadWrite"], (token) => this.external.patchOwnEvent(token, id, parsed.data));
        if (result.status !== "connected") throw new ConflictException("Outlook no confirmó la edición. Recarga el evento y verifica su organizador y versión.");
        await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'calendar_outlook_updated',(SELECT id_user FROM sec_user WHERE public_id_user=${profile.user.publicId}),'Evento propio actualizado en Outlook.','Organizador y versión verificados por Microsoft.',${JSON.stringify({ moduleCode: parsed.data.moduleCode, outlookId: result.data.id })})`.execute(
            this.database.db,
        );
        return { ok: true };
    }
    /** Inyecta identidad, persistencia y puerto externo sin compartir tokens con la UI. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(EXTERNAL_CALENDAR) private readonly external: ExternalCalendarPort,
        @Inject(ConfigService) private readonly config: ConfigService,
    ) {}

    /** Outlook se consulta antes del catálogo de correspondencias de la nueva BD. */
    async feed(session: string | undefined, profile: IdentityProfile, slot: ExternalSlot): Promise<CalendarFeed> {
        const result = await this.delegated(session, ["Calendars.ReadWrite"], (token) => this.external.events(token, slot));
        if (result.status !== "connected") return { status: result.status, events: [], links: [] };
        const account = profile.auth.microsoft;
        if (!account?.tenantId || !account.homeAccountId) return { status: "consent_required", events: [], links: [] };
        const remoteIds = result.data.map((event) => event.id);
        const uids = result.data.flatMap((event) => (event.uid ? [event.uid] : []));
        const start = sql<Date>`${new Date(slot.start).toISOString().slice(0, 23).replace("T", " ")}`;
        const end = sql<Date>`${new Date(slot.end).toISOString().slice(0, 23).replace("T", " ")}`;
        const invited = sql<boolean>`EXISTS(SELECT 1 FROM crm_calendar_participant p JOIN sec_user pu ON pu.id_user=p.user_id_calendar_participant WHERE p.event_id_calendar_participant=e.id_calendar_event AND pu.public_id_user=${profile.user.publicId} AND p.status_calendar_participant='active' AND p.revoked_at_calendar_participant IS NULL)`;
        const links = await this.database.db
            .selectFrom("int_calendar_event_sync as s")
            .innerJoin("int_calendar_connection as c", "c.id_calendar_connection", "s.connection_id_calendar_event_sync")
            .innerJoin("int_external_system as x", "x.id_external_system", "c.external_system_id_calendar_connection")
            .innerJoin("sec_user as u", "u.id_user", "c.owner_user_id_calendar_connection")
            .innerJoin("crm_calendar_event as e", "e.id_calendar_event", "s.event_id_calendar_event_sync")
            .select(["s.external_event_id_calendar_event_sync as remoteId", "s.external_uid_calendar_event_sync as uid", "e.public_id_calendar_event as eventId"])
            .where("x.code_external_system", "=", "microsoft365")
            .where("c.external_tenant_id_calendar_connection", "=", account.tenantId)
            .where("c.external_calendar_id_calendar_connection", "=", "default")
            .where("c.status_calendar_connection", "=", "active")
            .where("s.external_event_id_calendar_event_sync", "is not", null)
            .where((eb) =>
                eb.or([
                    ...(uids.length ? [eb("s.external_uid_calendar_event_sync", "in", uids)] : []),
                    eb.and([invited, eb("e.starts_at_calendar_event", "<", end), eb("e.ends_at_calendar_event", ">", start)]),
                    eb.and([eb("u.public_id_user", "=", profile.user.publicId), eb("c.external_account_id_calendar_connection", "=", account.homeAccountId), eb.or([...(remoteIds.length ? [eb("s.external_event_id_calendar_event_sync", "in", remoteIds)] : []), eb.and([eb("e.starts_at_calendar_event", "<", end), eb("e.ends_at_calendar_event", ">", start)])])]),
                ]),
            )
            .limit(1001)
            .execute();
        if (links.length > 1000) throw new ExternalCalendarError("unavailable");
        return {
            status: "connected",
            events: result.data,
            links: links.flatMap((link) => {
                const copy = result.data.find((event) => event.id === link.remoteId || (link.uid && event.uid === link.uid));
                const remoteId = copy?.id ?? link.remoteId;
                return remoteId ? [{ remoteId, eventId: link.eventId }] : [];
            }),
        };
    }

    private async authorize(session: string | undefined, module: string): Promise<IdentityProfile> {
        const profile = await this.identity.getCurrentUser(session);
        if (!calendarAccess(profile, module as (typeof CALENDAR_MODULES)[number], "read").allowed) throw new ForbiddenException("Calendario no autorizado.");
        return profile;
    }
    private async delegated<T>(session: string | undefined, scopes: string[], callback: (token: string) => Promise<T>): Promise<{ status: "connected"; data: T } | { status: "consent_required" | "unavailable" | "conflict" }> {
        // La bandera tiene que ser exactamente true. Apagada, el evento nativo sigue y la entrega queda no disponible.
        if (this.config.get<boolean>("ENABLE_CALENDAR_EXTERNAL") !== true) return { status: "unavailable" };
        try {
            const data = await this.identity.withMicrosoftAccess(session, scopes, callback);
            return data === null ? { status: "consent_required" } : { status: "connected", data };
        } catch (error) {
            return { status: error instanceof ExternalCalendarError ? error.code : "unavailable" };
        }
    }
    /** Lista salas solo para un calendario que el actor puede consultar. */
    async rooms(session: string | undefined, input: unknown) {
        const query = roomsQuery.safeParse(input);
        if (!query.success) throw new BadRequestException("Consulta de salas inválida.");
        const { start, end } = query.data;
        if (start && end && (Date.parse(end) <= Date.parse(start) || Date.parse(end) - Date.parse(start) > 31 * 86400000)) throw new BadRequestException("Consulta un intervalo de hasta 31 días.");
        await this.authorize(session, query.data.moduleCode);
        return this.delegated(session, ["Place.Read.All"], async (token) => {
            const rooms = await this.external.rooms(token);
            return start && end ? this.roomStatuses(session, rooms, { start, end }) : rooms;
        });
    }
    private async roomStatuses(session: string | undefined, rooms: ExternalRoom[], slot: ExternalSlot): Promise<ExternalRoom[]> {
        let states: Record<string, RoomAvailability> = {};
        try {
            states = (await this.identity.withMicrosoftAccess(session, ["Calendars.ReadWrite"], (token) => this.external.roomAvailability(token, { ...slot, addresses: rooms.map((room) => room.address) }))) ?? {};
        } catch {
            // El catálogo sigue disponible aunque no se pueda confirmar el horario.
        }
        return rooms.map((room) => ({ ...room, availability: states[room.address.toLowerCase()] ?? "unknown" }));
    }
    /** Resuelve colaboradores desde CRM y limita el intervalo antes de consultar al proveedor. */
    async availability(session: string | undefined, input: unknown) {
        const parsed = querySchema.safeParse(input);
        if (!parsed.success) throw new BadRequestException("Consulta de disponibilidad inválida.");
        const query = parsed.data;
        const duration = Date.parse(query.end) - Date.parse(query.start);
        if (duration <= 0 || duration > 31 * 86400000) throw new BadRequestException("Consulta un intervalo de hasta 31 días.");
        const profile = await this.authorize(session, query.moduleCode);
        const emails = await this.emails(this.database.db, query.userIds);
        const remoteId = query.eventId ? await this.remoteId(query.eventId, profile.user.publicId) : undefined;
        const options = { start: query.start, end: query.end, emails, ...(query.roomAddress ? { roomAddress: query.roomAddress } : {}), ...(remoteId ? { excludeId: remoteId } : {}) };
        return this.delegated(session, ["Calendars.ReadWrite"], async (token) => {
            const result = await this.external.availability(token, options);
            if (!result.incomplete) await this.addSuggestions(session, options, result);
            return result;
        });
    }
    /** Reutiliza la sesión actual y aísla el consentimiento adicional de las sugerencias. */
    private async addSuggestions(session: string | undefined, input: ExternalSlot & { emails: string[]; roomAddress?: string }, result: ExternalAvailability): Promise<void> {
        try {
            const suggestions = await this.identity.withMicrosoftAccess(session, ["Calendars.Read.Shared"], (token) => this.external.suggestions(token, input));
            if (suggestions === null) {
                result.incomplete = true;
                result.suggestionsStatus = "consent_required";
                return;
            }
            result.suggestions = suggestions;
            result.suggestionsStatus = "available";
        } catch (error) {
            result.incomplete = true;
            result.suggestionsStatus = error instanceof ExternalCalendarError && error.code === "consent_required" ? "consent_required" : "unavailable";
        }
    }
    private async remoteId(eventId: string, actor: string): Promise<string | undefined> {
        const row = await this.database.db
            .selectFrom("int_calendar_event_sync as s")
            .innerJoin("crm_calendar_event as e", "e.id_calendar_event", "s.event_id_calendar_event_sync")
            .innerJoin("int_calendar_connection as c", "c.id_calendar_connection", "s.connection_id_calendar_event_sync")
            .innerJoin("sec_user as u", "u.id_user", "c.owner_user_id_calendar_connection")
            .select("s.external_event_id_calendar_event_sync as id")
            .where("e.public_id_calendar_event", "=", eventId)
            .where("u.public_id_user", "=", actor)
            .executeTakeFirst();
        return row?.id ?? undefined;
    }
    /** Verifica la propiedad actual del buzón antes de cambiar el registro CRM sincronizado. */
    async assertNativeEdit(session: string | undefined, eventId: string, profile: IdentityProfile): Promise<void> {
        if (profile.auth.currentProvider !== "microsoft") return;
        const remoteId = await this.remoteId(eventId, profile.user.publicId);
        if (!remoteId) return;
        const result = await this.delegated(session, ["Calendars.ReadWrite"], (token) => this.external.read(token, remoteId));
        if (result.status !== "connected" || result.data.isOrganizer !== true) throw new ForbiddenException("Outlook no confirmó que seas el organizador del evento.");
    }
    private async emails(db: Pick<Tx, "selectFrom">, ids: string[]): Promise<string[]> {
        if (!ids.length) return [];
        const rows = await db
            .selectFrom("sec_user")
            .select("normalized_email_user as email")
            .where("public_id_user", "in", [...new Set(ids)])
            .where("status_user", "in", ["active", "inactive", "pending"])
            .where("deleted_at_user", "is", null)
            .execute();
        if (rows.length !== new Set(ids).size) throw new BadRequestException("Uno de los colaboradores ya no está disponible.");
        return rows.map((row) => row.email);
    }
    /** Solo una sesión Microsoft publica en su propio buzón; otras sesiones conservan el guardado CRM. */
    async publishState(session: string | undefined, event: CalendarRow, command: CalendarStatusInput, profile: IdentityProfile): Promise<CalendarDelivery> {
        if ([command.action === "complete", command.expectedStatus === "completed"].some(Boolean)) return { status: "crm_only" };
        const remoteId = await this.remoteId(event.id, profile.user.publicId);
        if (command.action === "cancel" && !remoteId) return { status: "crm_only" };
        if (profile.auth.currentProvider !== "microsoft") return { status: remoteId ? "consent_required" : "crm_only" };
        const result = await this.delegated(session, ["Calendars.ReadWrite"], (token) =>
            command.action === "cancel" ? this.cancelNative(token, event, command, profile) : this.synchronize(token, event, { moduleCode: event.originModule, typeId: event.typeId, title: event.title, start: event.start, end: event.end, allDay: Boolean(event.allDay), details: calendarDetails(event.details), operationId: command.operationId, expectedOutlookVersion: command.expectedOutlookVersion, recreate: true }, profile),
        );
        return result.status === "connected" ? { status: "synced", ...result.data } : result;
    }
    private async cancelNative(token: string, event: CalendarRow, command: CalendarStatusInput, profile: IdentityProfile) {
        // Una transacción mantiene juntas la versión CRM y la confirmación de cancelación.
        // eslint-disable-next-line complexity
        return this.database.db.transaction().execute(async (tx) => {
            const current = await tx.selectFrom("crm_calendar_event").select("version_calendar_event as version").where("id_calendar_event", "=", event.internalId).forUpdate().executeTakeFirstOrThrow();
            if (current.version !== event.version) throw new ExternalCalendarError("conflict");
            const state = await tx
                .selectFrom("int_calendar_event_sync as s")
                .innerJoin("int_calendar_connection as c", "c.id_calendar_connection", "s.connection_id_calendar_event_sync")
                .innerJoin("sec_user as u", "u.id_user", "c.owner_user_id_calendar_connection")
                .select(["s.id_calendar_event_sync as id", "s.external_event_id_calendar_event_sync as remoteId", "s.external_version_calendar_event_sync as version", "s.desired_state_calendar_event_sync as desired", "s.last_synced_version_calendar_event_sync as syncedVersion", "s.status_calendar_event_sync as status"])
                .where("s.event_id_calendar_event_sync", "=", event.internalId)
                .where("u.public_id_user", "=", profile.user.publicId)
                .where("c.external_account_id_calendar_connection", "=", profile.auth.microsoft?.homeAccountId ?? "")
                .where("c.external_tenant_id_calendar_connection", "=", profile.auth.microsoft?.tenantId ?? "")
                .forUpdate()
                .executeTakeFirst();
            if (!state?.remoteId) throw new ExternalCalendarError("consent_required");
            if (state.status === "synced" && state.syncedVersion === event.version && state.desired === "absent") return { outlookId: state.remoteId };
            await this.external.cancel(token, state.remoteId, command.expectedOutlookVersion ?? state.version, command.reason ?? "Cancelado por el organizador desde CRM");
            await tx.updateTable("int_calendar_event_sync").set({ desired_state_calendar_event_sync: "absent", status_calendar_event_sync: "synced", last_synced_version_calendar_event_sync: event.version, last_synced_at_calendar_event_sync: new Date(), error_code_calendar_event_sync: null }).where("id_calendar_event_sync", "=", state.id).execute();
            return { outlookId: state.remoteId };
        });
    }
    /** Solo una sesión Microsoft publica en su propio buzón; otras sesiones conservan el guardado CRM. */
    async publish(session: string | undefined, event: CalendarRow, input: CalendarInput, profile: IdentityProfile): Promise<CalendarDelivery> {
        if ([input.publishToCalendar === false, profile.auth.currentProvider !== "microsoft"].some(Boolean)) return { status: "crm_only" };
        if (![event.ownerPublicId === profile.user.publicId, profile.auth.microsoft?.tenantId, profile.auth.microsoft?.homeAccountId].every(Boolean)) return { status: "consent_required" };
        const result = await this.delegated(session, ["Calendars.ReadWrite"], async (token) => {
            const roomAddress = input.details.roomAddress;
            if (roomAddress) {
                const rooms = await this.identity.withMicrosoftAccess(session, ["Place.Read.All"], (roomToken) => this.external.rooms(roomToken));
                if (!rooms?.some((room) => room.address.toLowerCase() === roomAddress.toLowerCase())) throw new ExternalCalendarError("consent_required");
            }
            return this.synchronize(token, event, input, profile);
        });
        if (result.status !== "connected") return result;
        if (input.details.teamsRequested && !result.data.joinUrl) return { status: "unavailable", ...result.data };
        return { status: "synced", ...result.data };
    }
    /** Una fila bloqueada serializa reintentos; transactionId permanece estable ante resultados inciertos. */
    private async synchronize(token: string, event: CalendarRow, input: CalendarInput & { recreate?: boolean }, profile: IdentityProfile) {
        // Mantiene bloqueo, comparación de versiones y confirmación externa dentro de una única transacción.
        // eslint-disable-next-line complexity
        return this.database.db.transaction().execute(async (tx) => {
            const current = await tx.selectFrom("crm_calendar_event").select("version_calendar_event as version").where("id_calendar_event", "=", event.internalId).forUpdate().executeTakeFirstOrThrow();
            if (current.version !== event.version) throw new ExternalCalendarError("conflict");
            const connection = await this.connection(tx, profile);
            await sql`INSERT INTO int_calendar_event_sync (event_id_calendar_event_sync,connection_id_calendar_event_sync,operation_id_calendar_event_sync) VALUES (${event.internalId},${connection},${`crm:${event.id}`}) ON DUPLICATE KEY UPDATE id_calendar_event_sync=id_calendar_event_sync`.execute(tx);
            const state = await tx.selectFrom("int_calendar_event_sync").selectAll().where("event_id_calendar_event_sync", "=", event.internalId).where("connection_id_calendar_event_sync", "=", connection).forUpdate().executeTakeFirstOrThrow();
            if (state.status_calendar_event_sync === "synced" && state.last_synced_version_calendar_event_sync === event.version) {
                if (!state.external_event_id_calendar_event_sync) throw new ExternalCalendarError("unavailable");
                const remote = await this.external.read(token, state.external_event_id_calendar_event_sync, input.details.roomAddress);
                return { outlookId: remote.id, joinUrl: remote.joinUrl, roomStatus: remote.roomStatus };
            }
            const ids = (event.participants ?? []).flatMap((p) => (p.userId ? [p.userId] : []));
            const emails = [...new Set([...(await this.emails(tx, ids)), ...(event.participants ?? []).flatMap((p) => (p.email ? [p.email] : []))])];
            if (input.recreate && state.external_event_id_calendar_event_sync) await this.external.cancel(token, state.external_event_id_calendar_event_sync, input.expectedOutlookVersion ?? state.external_version_calendar_event_sync, "Reprogramado por el organizador desde CRM");
            const saved = await this.external.write(token, {
                event: { ...event, details: calendarDetails(event.details) },
                emails,
                remoteId: input.recreate ? null : state.external_event_id_calendar_event_sync,
                remoteVersion: input.recreate ? null : (input.expectedOutlookVersion ?? state.external_version_calendar_event_sync),
                transactionId: input.recreate ? `crm:${event.id}:reactivate:${String(event.version)}` : state.operation_id_calendar_event_sync,
                ...(input.details.roomAddress ? { roomAddress: input.details.roomAddress } : {}),
            });
            await tx
                .updateTable("int_calendar_event_sync")
                .set({ external_event_id_calendar_event_sync: saved.id, external_uid_calendar_event_sync: saved.uid ?? null, external_version_calendar_event_sync: saved.version, desired_state_calendar_event_sync: "present", status_calendar_event_sync: "synced", last_synced_version_calendar_event_sync: event.version, last_synced_at_calendar_event_sync: new Date(), attempt_count_calendar_event_sync: state.attempt_count_calendar_event_sync + 1, error_code_calendar_event_sync: null })
                .where("id_calendar_event_sync", "=", state.id_calendar_event_sync)
                .execute();
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'calendar_external_synced',(SELECT id_user FROM sec_user WHERE public_id_user=${profile.user.publicId}),'Evento sincronizado con calendario externo.','Publicación solicitada por el organizador.',${JSON.stringify({ moduleCode: event.originModule, eventId: event.id, version: event.version, operationId: input.operationId, roomStatus: saved.roomStatus })})`.execute(
                tx,
            );
            return { outlookId: saved.id, joinUrl: saved.joinUrl, roomStatus: saved.roomStatus };
        });
    }
    private async connection(tx: Tx, profile: IdentityProfile): Promise<number> {
        const account = profile.auth.microsoft;
        if (!account?.homeAccountId || !account.tenantId) throw new ExternalCalendarError("consent_required");
        const owner = await tx.selectFrom("sec_user").select("id_user as id").where("public_id_user", "=", profile.user.publicId).executeTakeFirstOrThrow();
        await sql`INSERT INTO int_external_system (code_external_system,name_external_system,status_external_system) VALUES ('microsoft365','Microsoft 365','active') ON DUPLICATE KEY UPDATE id_external_system=id_external_system`.execute(tx);
        const system = await tx.selectFrom("int_external_system").select("id_external_system as id").where("code_external_system", "=", "microsoft365").where("status_external_system", "=", "active").executeTakeFirstOrThrow();
        await sql`INSERT INTO int_calendar_connection (public_id_calendar_connection,external_system_id_calendar_connection,owner_user_id_calendar_connection,external_tenant_id_calendar_connection,external_account_id_calendar_connection,external_calendar_id_calendar_connection,status_calendar_connection) VALUES (${ulid()},${system.id},${owner.id},${account.tenantId},${account.homeAccountId},'default','active') ON DUPLICATE KEY UPDATE id_calendar_connection=id_calendar_connection`.execute(tx);
        const row = await tx.selectFrom("int_calendar_connection").select(["id_calendar_connection as id", "status_calendar_connection as status", "owner_user_id_calendar_connection as owner"]).where("external_system_id_calendar_connection", "=", system.id).where("external_account_id_calendar_connection", "=", account.homeAccountId).where("external_tenant_id_calendar_connection", "=", account.tenantId).where("external_calendar_id_calendar_connection", "=", "default").executeTakeFirstOrThrow();
        if (row.status !== "active" || row.owner !== owner.id) throw new ExternalCalendarError("consent_required");
        return row.id;
    }
}
