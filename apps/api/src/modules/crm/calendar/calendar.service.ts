import { BadRequestException, ConflictException, ForbiddenException, HttpException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Transaction } from "kysely";
import { z } from "zod";

import type { CrmDatabase } from "../../../database/database.types.js";
import { IdentityService } from "../identity/identity.service.js";
import type { IdentityProfile } from "../identity/identity.types.js";
import { CALENDAR_COLORS, CALENDAR_LEGACY_READER, CALENDAR_MODULE_LABELS, CALENDAR_MODULES, type CalendarEvent, calendarEventInput, calendarEventUpdate, type CalendarInput, calendarListQuery, type CalendarModuleCode, type CalendarRow } from "./calendar.contract.js";
import { calendarDetails, CalendarRepository } from "./calendar.repository.js";
import { calendarAccess } from "./calendar-access.js";
import { findCalendarEventType } from "./calendar-event-types.catalog.js";
import type { CalendarLegacyReader, CalendarReadScope } from "./calendar-legacy.port.js";
import { CalendarLookupService } from "./calendar-lookup.service.js";

const lookupQuery = z.strictObject({ moduleCode: z.enum(CALENDAR_MODULES), kind: z.enum(["users", "notes", "leads", "orders"]), search: z.string().trim().max(100).default("") });

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
/** Named module origins are independent of the user's current set of roles. */
@Injectable()
export class CalendarService {
    /** Injects the existing identity, persistence or audit dependencies. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(CalendarRepository) private readonly repository: CalendarRepository,
        @Inject(CALENDAR_LEGACY_READER) private readonly legacy: CalendarLegacyReader,
        @Inject(CalendarLookupService) private readonly selections: CalendarLookupService,
    ) {}
    /** Calendar entry does not grant permission to search its linked business records. */
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
        return this.safely(() =>
            this.repository.read(async (tx) => {
                const native = await this.repository.list(tx, scope);
                const legacy = this.legacy.enabled() ? await this.legacy.list(tx, scope) : [];
                if (native.length + legacy.length > 500) throw new ConflictException("Hay demasiados eventos para este intervalo; selecciona una semana, un día o menos calendarios.");
                const rows = [...native, ...legacy].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
                const events = [];
                for (const row of rows) events.push(await this.present(tx, row, { profile, context: query.contextModule }));
                return { schemaVersion: 1 as const, events };
            }),
        );
    }
    /** Validates the command and records its event and audit atomically. */
    async save(session: string | undefined, input: unknown, publicId?: string) {
        const profile = await this.identity.getCurrentUser(session);
        const parsed = publicId ? parse(calendarEventUpdate, input) : parse(calendarEventInput, input);
        if (publicId && !/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(publicId)) throw new BadRequestException("Identidad de evento inválida.");
        const access = calendarAccess(profile, parsed.moduleCode, publicId ? "update" : "create");
        if (!access.allowed) throw new ForbiddenException("No tiene permiso para gestionar este calendario.");
        this.validateEvent(parsed);
        return this.safely(async () => {
            const saved = await this.repository.save(profile.user.publicId, parsed, access.ownOnly, publicId, async (tx, before) => {
                if (parsed.links === undefined) return;
                if (before?.links?.length && !(await this.selections.canManageLinks(tx, profile, before.links))) throw new ForbiddenException("Las relaciones restringidas deben conservarse sin cambios.");
                await this.selections.validateLinks(tx, profile, parsed.links);
            });
            return { schemaVersion: 1 as const, event: await this.repository.read((tx) => this.present(tx, saved, { profile, context: parsed.moduleCode })) };
        });
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
        const { internalId: _internalId, ownerPublicId, ...event } = row;
        const configured = Boolean(findCalendarEventType(row.typeCode, row.originModule));
        const canEdit = configured && row.source === "native" && row.status !== "cancelled" && row.originModule === context && access.allowed && (!access.ownOnly || ownerPublicId === profile.user.publicId);
        // Invitation access is event-only; attendees do not inherit linked-record or guest-directory access.
        const relations = canEdit ? { participants: event.participants, links: event.links } : { participants: undefined, links: undefined };
        return { ...event, ...relations, selectionOptions: undefined, allDay: Boolean(row.allDay), details: calendarDetails(row.details), canEdit };
    }
    /** Private/retired relations stay stored without leaking through broader calendar editing scopes. */
    private async present(tx: Transaction<CrmDatabase>, row: CalendarRow, { profile, context }: { profile: IdentityProfile; context: CalendarModuleCode }): Promise<CalendarEvent> {
        const event = this.project(row, profile, context);
        if (!event.canEdit) return { ...event, linksEditable: false };
        const linksEditable = !row.links?.length || (await this.selections.canManageLinks(tx, profile, row.links));
        const links = linksEditable ? row.links : undefined;
        const selectionOptions = await this.selections.selectionOptions(tx, profile, { links: links ?? [], participants: row.participants ?? [] });
        return { ...event, linksEditable, links, selectionOptions };
    }
    private async safely<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new ServiceUnavailableException("No fue posible completar la consulta o el guardado del calendario. Reintenta la misma operación.");
        }
    }
}
