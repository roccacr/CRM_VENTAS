import { BadRequestException, ConflictException, ForbiddenException, HttpException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { Transaction } from "kysely";
import { z } from "zod";

import type { CrmDatabase } from "../../../database/database.types.js";
import { IdentityService } from "../identity/identity.service.js";
import type { IdentityProfile } from "../identity/identity.types.js";
import { SalesOrderAddendumRepository } from "../sales/sales-orders/sales-order-addendum.repository.js";
import { type CalendarStatusInput, calendarStatusInput, type CalendarUpdate } from "./calendar.contract.js";
import { CALENDAR_COLORS, CALENDAR_LEGACY_READER, CALENDAR_MODULE_LABELS, CALENDAR_MODULES, type CalendarEvent, calendarEventInput, calendarEventUpdate, type CalendarInput, calendarListQuery, type CalendarModuleCode, type CalendarRow } from "./calendar.contract.js";
import { calendarDetails, CalendarRepository, calendarStoredMetadata } from "./calendar.repository.js";
import { calendarAccess, calendarRouteAccess } from "./calendar-access.js";
import { calendarAddendumRelations, calendarOrderLinksLocked, effectiveCalendarLinks } from "./calendar-addendum.policy.js";
import { findCalendarEventType } from "./calendar-event-types.catalog.js";
import { CalendarExternalService, type CalendarFeed } from "./calendar-external.service.js";
import type { CalendarLegacyReader, CalendarReadScope } from "./calendar-legacy.port.js";
import { CalendarLookupService } from "./calendar-lookup.service.js";
import type { ExternalFeedEvent } from "./external-calendar.port.js";

const lookupQuery = z.strictObject({ moduleCode: z.enum(CALENDAR_MODULES), kind: z.enum(["users", "notes", "leads", "orders"]), search: z.string().trim().max(1000).default(""), leads: z.string().max(5000).optional() }).refine((query) => query.search.length <= 100 || (query.kind === "users" && query.search.includes(",")));

/** Strict DTO parsing rejects forged origins, unknown fields and unbounded date intervals before SQL. */
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("Solicitud de calendario inválida.");
    return parsed.data;
}
function interval(start: string, end: string, maximumDays: number): void {
    const duration = Date.parse(end) - Date.parse(start);
    if (!Number.isFinite(duration) || duration <= 0 || duration > maximumDays * 86400000) throw new BadRequestException("El intervalo de calendario no es válido o es demasiado amplio.");
}
/** Solo los campos del proveedor se superponen; relaciones y permisos permanecen en CRM. */
function remoteFields(event: ExternalFeedEvent) {
    return { title: event.title, description: event.description ?? null, location: event.location ?? null, start: event.start, end: event.end, allDay: event.allDay };
}
function mergedEvent(event: CalendarEvent, remote: ExternalFeedEvent): CalendarEvent {
    return { ...event, ...remoteFields(remote), canEdit: event.canEdit && remote.outlook?.isOrganizer === true, canManageStatus: event.canManageStatus === true && remote.outlook?.isOrganizer === true, outlookDetail: remote.outlook, outlookId: remote.id, ...(remote.version ? { outlookVersion: remote.version } : {}) };
}
/** Correlación por identidad, nunca por título/horario; la proyección CRM ya pasó su ACL. */
function mergeOutlook(events: CalendarEvent[], feed: CalendarFeed, outlookCanEdit: boolean): CalendarEvent[] {
    const remoteById = new Map(feed.events.map((event) => [event.id, event]));
    const linkByCrmId = new Map(feed.links.map((link) => [link.eventId, link.remoteId]));
    const consumed = new Set<string>();
    const merged = events.flatMap((event) => {
        const remoteId = event.source === "native" ? linkByCrmId.get(event.id) : undefined;
        const remote = remoteId ? remoteById.get(remoteId) : undefined;
        // Outlook es la fuente del horario; no reaparece una cita movida/cancelada en su fecha CRM anterior.
        if (feed.status === "connected" && remoteId && !remote && event.status === "scheduled") return [];
        if (!remote) return [event];
        consumed.add(remote.id);
        return [mergedEvent(event, remote)];
    });
    return [...merged, ...feed.events.filter((remote) => !consumed.has(remote.id)).map((remote) => ({ ...outlookOnly(remote), canEdit: outlookCanEdit && remote.outlook?.isOrganizer === true }))];
}
function outlookOnly(remote: ExternalFeedEvent): CalendarEvent {
    return { ...remoteFields(remote), id: remote.id, outlookId: remote.id, source: "outlook", ...(remote.version ? { outlookVersion: remote.version } : {}), originModule: null, typeId: "", typeCode: "", formKey: "outlook.readonly", status: "scheduled", version: 0, canEdit: false, linksEditable: false, details: {}, ...(remote.outlook ? { outlookDetail: remote.outlook } : {}) };
}
/** Participar permite consultar este evento, nunca omite un deny explícito ni otorga lectura de sus registros. */
function canReadDetail(row: CalendarRow, profile: IdentityProfile): boolean {
    const denied = profile.permissions.some((permission) => permission.code === `${row.originModule}.calendar.read` && permission.effect === "deny");
    const access = calendarAccess(profile, row.originModule, "read");
    const invited = row.participants?.some((participant) => participant.userId === profile.user.publicId);
    return !denied && ((access.allowed && (!access.ownOnly || row.ownerPublicId === profile.user.publicId)) || invited === true);
} /** Named module origins are independent of the user's current set of roles. */
@Injectable()
export class CalendarService {
    /** Injects the existing identity, persistence or audit dependencies. */
    // Los colaboradores conservan responsabilidades separadas; el marcador reutiliza la transacción del evento.
    // eslint-disable-next-line max-params
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(CalendarRepository) private readonly repository: CalendarRepository,
        @Inject(CALENDAR_LEGACY_READER) private readonly legacy: CalendarLegacyReader,
        @Inject(CalendarLookupService) private readonly selections: CalendarLookupService,
        @Inject(CalendarExternalService) private readonly external: CalendarExternalService,
        @Inject(SalesOrderAddendumRepository) private readonly addendum: SalesOrderAddendumRepository,
    ) {}
    /** Lee los datos CRM actuales al abrir el modal, con ACL del evento y de cada relación. */
    async detail(session: string | undefined, id: string) {
        const profile = await this.identity.getCurrentUser(session);
        if (!calendarRouteAccess(profile, "read")) throw new ForbiddenException("Calendario no autorizado.");
        if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id)) throw new BadRequestException("Evento inválido.");
        return this.safely(() =>
            this.repository.read(async (tx) => {
                const row = await this.repository.detailRecord(tx, id);
                if (!canReadDetail(row, profile)) throw new NotFoundException("Evento no disponible.");
                return { schemaVersion: 1, crmDetail: await this.readCrmDetail(tx, row, profile, true) };
            }),
        );
    } /** Calendar entry does not grant permission to search its linked business records. */
    async lookup(session: string | undefined, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        const query = parse(lookupQuery, input);
        if (!calendarAccess(profile, query.moduleCode, "read").allowed) throw new ForbiddenException("No tiene acceso a este calendario.");
        return this.safely(() => this.selections.lookup(profile, query));
    }
    /** Lists only the calendars and capabilities allowed by the current profile. */
    async calendars(session?: string) {
        const profile = await this.identity.getCurrentUser(session);
        const modules = CALENDAR_MODULES.filter((code) => calendarAccess(profile, code, "read").allowed);
        if (!modules.length) throw new ForbiddenException("No tiene calendarios autorizados.");
        return this.safely(async () => {
            const types = await this.repository.read((tx) => this.repository.types(tx, modules));
            return { schemaVersion: 1 as const, calendars: modules.map((moduleCode) => ({ moduleCode, label: CALENDAR_MODULE_LABELS[moduleCode], color: CALENDAR_COLORS[moduleCode], canCreate: calendarAccess(profile, moduleCode, "create").allowed, canUpdate: calendarAccess(profile, moduleCode, "update").allowed, types: types.filter((type) => type.moduleCode === moduleCode).map(({ moduleCode: _module, ...type }) => type) })) };
        });
    }
    /** Reads bounded, authorized events without inventing historical module ownership. */
    async list(session: string | undefined, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        const query = parse(calendarListQuery, input);
        const codes = query.moduleCodes.split(",");
        if (codes.length > CALENDAR_MODULES.length || new Set(codes).size !== codes.length || codes.some((code) => !CALENDAR_MODULES.some((module) => module === code))) throw new BadRequestException("Selección de calendarios inválida.");
        const modules = codes as CalendarModuleCode[];
        if (!calendarAccess(profile, query.contextModule, "read").allowed || modules.some((code) => !calendarAccess(profile, code, "read").allowed)) throw new ForbiddenException("No tiene acceso a uno de los calendarios solicitados.");
        interval(query.start, query.end, 93);
        const scope: CalendarReadScope = { actorPublicId: profile.user.publicId, modules, broadModules: modules.filter((code) => !calendarAccess(profile, code, "read").ownOnly), start: query.start, end: query.end, excludedInviteModules: CALENDAR_MODULES.filter((code) => profile.permissions.some((permission) => permission.code === `${code}.calendar.read` && permission.effect === "deny")) };
        return this.safely(async () => {
            const outlook = await this.external.feed(session, profile, query);
            return this.repository.read(async (tx) => {
                const remoteById = new Map(outlook.events.map((event) => [event.id, event]));
                const externalEventIds = outlook.links.filter((link) => remoteById.has(link.remoteId)).map((link) => link.eventId);
                const native = await this.repository.list(tx, { ...scope, externalEventIds });
                const legacy = this.legacy.enabled() ? await this.legacy.list(tx, scope) : [];
                if (native.length + legacy.length > 500) throw new ConflictException("Hay demasiados eventos para este intervalo; selecciona una semana, un día o menos calendarios.");
                const rows = [...native, ...legacy].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
                const presented: CalendarEvent[] = [];
                for (const row of rows) presented.push(await this.present(tx, row, { profile, context: query.contextModule }));
                const events = mergeOutlook(presented, outlook, calendarAccess(profile, query.contextModule, "update").allowed);
                if (events.length > 500) throw new ConflictException("Hay demasiados eventos para este intervalo; selecciona una semana o un día.");
                events.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
                return { schemaVersion: 1 as const, events, outlookStatus: outlook.status };
            });
        });
    }
    /** Validates the command and records its event and audit atomically. */
    async changeStatus(session: string | undefined, id: string, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        const command = parse(calendarStatusInput, input);
        if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id)) throw new BadRequestException("Evento inválido.");
        const access = calendarAccess(profile, command.moduleCode, "update");
        if (!access.allowed) throw new ForbiddenException("No puedes gestionar este calendario.");
        const valid = command.action === "reactivate" ? command.expectedStatus !== "scheduled" : command.expectedStatus === "scheduled";
        if (!valid) throw new ConflictException("La acción no corresponde al estado actual.");
        return this.safely(async () => {
            const row = await this.repository.read((tx) => this.repository.detailRecord(tx, id));
            if (row.originModule !== command.moduleCode || row.ownerPublicId !== profile.user.publicId) throw new ForbiddenException("Solo el organizador puede cambiar el estado.");
            const update: CalendarUpdate = { moduleCode: row.originModule, typeId: row.typeId, title: row.title, description: row.description, location: row.location, start: row.start, end: row.end, allDay: Boolean(row.allDay), details: calendarDetails(row.details), operationId: command.operationId, expectedVersion: command.expectedVersion, expectedOutlookVersion: command.expectedOutlookVersion };
            const target = command.action === "complete" ? "completed" : command.action === "cancel" ? "cancelled" : "scheduled";
            const saved = await this.repository.save(profile.user.publicId, update, access.ownOnly, id, (tx, before, typeCode) => this.validateReactivation(tx, profile, before, { command, typeCode, input: update }), { status: target, expectedStatus: command.expectedStatus, reason: command.reason });
            const delivery = await this.external.publishState(session, saved, command, profile);
            const event = await this.repository.read((tx) => this.present(tx, saved, { profile, context: command.moduleCode }));
            return { schemaVersion: 1 as const, event, delivery };
        });
    }
    private async validateReactivation(tx: Transaction<CrmDatabase>, profile: IdentityProfile, before: CalendarRow | null, { command, typeCode, input }: { command: CalendarStatusInput; typeCode: string | undefined; input: CalendarUpdate }): Promise<void> {
        if (!before || command.action !== "reactivate" || typeCode !== "adendum") return;
        if (!(await this.selections.canManageLinks(tx, profile, before.links ?? []))) throw new ForbiddenException("No puedes reactivar los vínculos de este evento.");
        const relations = calendarAddendumRelations(input, before, typeCode);
        if (relations) await this.addendum.prepareEvent(tx, { order: relations.order, lead: relations.lead, actorPublicId: profile.user.publicId, operationId: command.operationId, markPending: false, broad: !calendarAccess(profile, "formalizacion", "read").ownOnly, revealExisting: true, excludeEventId: before.id });
    }
    /** El guardado ordinario conserva los estados; el ciclo de vida tiene su propio comando versionado. */
    async save(session: string | undefined, input: unknown, publicId?: string) {
        const profile = await this.identity.getCurrentUser(session);
        const parsed = publicId ? parse(calendarEventUpdate, input) : parse(calendarEventInput, input);
        if (publicId && !/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(publicId)) throw new BadRequestException("Identidad de evento inválida.");
        const access = calendarAccess(profile, parsed.moduleCode, publicId ? "update" : "create");
        if (!access.allowed) throw new ForbiddenException("No tiene permiso para gestionar este calendario.");
        if (publicId) await this.external.assertNativeEdit(session, publicId, profile);
        this.validateEvent(parsed);
        if (!publicId) this.assertLeadAssignment(profile, parsed);
        return this.safely(async () => {
            // Permisos, relaciones históricas y marcador deben validarse juntos dentro de la transacción del evento.
            // eslint-disable-next-line complexity
            const saved = await this.repository.save(profile.user.publicId, parsed, access.ownOnly, publicId, async (tx, before, typeCode) => {
                const relations = calendarAddendumRelations(parsed, before, typeCode ?? "");
                const createsAddendum = typeCode === "adendum" && before?.typeCode !== "adendum";
                if (createsAddendum && (!parsed.description?.trim() || parsed.description.trim().length < 3 || parsed.description.trim().length > 2000)) throw new BadRequestException("El motivo del adéndum debe tener entre 3 y 2000 caracteres.");
                const validatesLinks = parsed.links !== undefined || createsAddendum;
                if (validatesLinks) {
                    this.assertLeadAssignment(profile, parsed, before);
                    if (before?.links?.length && !(await this.selections.canManageLinks(tx, profile, before.links))) throw new ForbiddenException("Las relaciones restringidas deben conservarse sin cambios.");
                    await this.selections.validateLinks(tx, profile, effectiveCalendarLinks(parsed, before));
                    await this.includeLeadInvitations(tx, profile, parsed, before);
                }
                if (relations && typeCode === "adendum") await this.addendum.prepareEvent(tx, { order: relations.order, lead: relations.lead, actorPublicId: profile.user.publicId, operationId: parsed.operationId, markPending: createsAddendum, reason: parsed.description, broad: !calendarAccess(profile, "formalizacion", "read").ownOnly, revealExisting: validatesLinks, ...(before ? { excludeEventId: before.id } : {}) });
            });
            const delivery = await this.external.publish(session, saved, parsed, profile);
            const event = await this.repository.read((tx) => this.present(tx, saved, { profile, context: parsed.moduleCode }));
            return { delivery, schemaVersion: 1 as const, event: { ...event, ...(delivery.outlookId ? { outlookId: delivery.outlookId } : {}) } };
        });
    }
    /** Los destinatarios derivados forman parte del mismo límite y transacción que los explícitos. */
    private async includeLeadInvitations(tx: Transaction<CrmDatabase>, profile: IdentityProfile, input: CalendarInput, before: CalendarRow | null): Promise<void> {
        const emails = await this.selections.leadInvitationEmails(tx, profile, effectiveCalendarLinks(input, before));
        if (!emails.length) return;
        input.participants = [...new Map([...(input.participants ?? before?.participants ?? []), ...emails.map((email) => ({ email }))].map((participant) => [JSON.stringify(participant), participant])).values()];
        if (input.participants.length > 100) throw new BadRequestException("El evento admite hasta 100 participantes, incluyendo los correos de los leads.");
    }
    /** La vinculación a cliente exige acceso propio; reenviar relaciones existentes no equivale a asignarlas de nuevo. */
    private assertLeadAssignment(profile: IdentityProfile, input: CalendarInput, before?: CalendarRow | null): void {
        if (input.moduleCode !== "formalizacion" || calendarAccess(profile, "formalizacion", "assign_lead").allowed) return;
        const assigned = input.links?.some((link) => link.entityType !== "note" && !before?.links?.some((existing) => existing.entityType === link.entityType && existing.source === link.source && existing.id === link.id));
        if (assigned) throw new ForbiddenException("No tiene permiso para asignar eventos a un lead en Formalización.");
    }
    private validateEvent(input: CalendarInput): void {
        interval(input.start, input.end, 366);
        if (
            input.allDay &&
            [input.start, input.end].some((value) => {
                const date = new Date(value);
                return date.getUTCHours() !== 6 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0;
            })
        )
            throw new BadRequestException("Un evento de día completo debe comenzar y terminar a medianoche de Costa Rica, con fin exclusivo.");
    }
    private project(row: CalendarRow, profile: IdentityProfile, context: CalendarModuleCode): CalendarEvent {
        const access = calendarAccess(profile, row.originModule, "update");
        const { internalId: _internalId, ownerPublicId, storedMetadata: _storedMetadata, ...event } = row;
        const configured = Boolean(findCalendarEventType(row.typeCode, row.originModule));
        const canManageStatus = [configured, row.source === "native", row.originModule === context, access.allowed, ownerPublicId === profile.user.publicId].every(Boolean);
        const canEdit = canManageStatus && row.status !== "cancelled";
        // Invitation access is event-only; attendees do not inherit linked-record or guest-directory access.
        const relations = canEdit ? { participants: event.participants, links: event.links } : { participants: undefined, links: undefined };
        return { ...event, ...relations, selectionOptions: undefined, allDay: Boolean(row.allDay), details: calendarDetails(row.details), canEdit, canManageStatus, orderLinksLocked: calendarOrderLinksLocked(row) };
    }
    /** Private/retired relations stay stored without leaking through broader calendar editing scopes. */
    private async present(tx: Transaction<CrmDatabase>, row: CalendarRow, { profile, context }: { profile: IdentityProfile; context: CalendarModuleCode }): Promise<CalendarEvent> {
        const projected = this.project(row, profile, context);
        const event = { ...projected, crmDetail: row.source === "native" ? await this.readCrmDetail(tx, row, profile) : undefined };
        if (!event.canEdit) return { ...event, linksEditable: false };
        const linksEditable = !row.links?.length || (await this.selections.canManageLinks(tx, profile, row.links));
        const links = linksEditable ? row.links : undefined;
        const selectionOptions = await this.selections.selectionOptions(tx, profile, { links: links ?? [], participants: row.participants ?? [] });
        return { ...event, linksEditable, links, selectionOptions };
    }
    private async readCrmDetail(tx: Transaction<CrmDatabase>, row: CalendarRow, profile: IdentityProfile, loaded = false) {
        const details = calendarDetails(row.details);
        return {
            ...calendarStoredMetadata(row),
            ...(loaded ? await this.selections.detailSelections(tx, profile, row.links ?? [], row.participants ?? []) : { links: [], participants: [], restrictedLinks: false }),
            loaded,
            version: row.version,
            moduleCode: row.originModule,
            title: row.title,
            description: row.description,
            location: row.location,
            start: row.start,
            end: row.end,
            allDay: Boolean(row.allDay),
            status: row.status,
            reference: details.reference ?? null,
            teamsRequested: details.teamsRequested ?? false,
            roomAddress: details.roomAddress ?? null,
        };
    }
    private async safely<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof HttpException) throw error;
            if (error instanceof Error && ["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(String(Reflect.get(error, "code")))) throw new ConflictException("La orden está siendo actualizada; recarga y reintenta la operación.");
            // Los errores SQL pueden contener datos del evento: registrar solo su clasificación.
            const errorCode = z
                .string()
                .regex(/^[A-Z][A-Z0-9_]{1,63}$/)
                .catch("UNCLASSIFIED")
                .parse(error instanceof Error ? Reflect.get(error, "code") : undefined);
            const errorName = z
                .string()
                .regex(/^[A-Za-z][A-Za-z0-9]{0,63}$/)
                .catch("UnknownError")
                .parse(error instanceof Error ? error.name : undefined);
            Logger.error({ event: "calendar_operation_failed", errorName, errorCode }, CalendarService.name);
            throw new ServiceUnavailableException("No fue posible completar la consulta o el guardado del calendario. Reintenta la misma operación.");
        }
    }
}
