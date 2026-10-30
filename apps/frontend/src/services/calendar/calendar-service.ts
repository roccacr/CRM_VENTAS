import { apiRequest } from "../api/api-client";

export const CALENDAR_MODULES = ["formalizacion", "mercadeo", "ventas", "contabilidad"] as const;
export type CalendarModule = (typeof CALENDAR_MODULES)[number];
export interface CalendarType {
    readonly id: string;
    readonly code: string;
    readonly label: string;
    readonly color: string;
    readonly formKey: string;
}
export interface CalendarDescriptor {
    readonly moduleCode: CalendarModule;
    readonly label: string;
    readonly color: string;
    readonly canCreate: boolean;
    readonly canUpdate: boolean;
    readonly types: readonly CalendarType[];
}
export interface CalendarParticipant {
    readonly userId?: string;
    readonly email?: string;
}
export interface CalendarLink {
    readonly entityType: "note" | "lead" | "sales_order";
    readonly source: "native" | "legacy";
    readonly id: string;
}
export type CalendarLookupKind = "users" | "notes" | "leads" | "orders";
export interface CalendarLookupItem {
    readonly id: string;
    readonly source: "native" | "legacy";
    readonly label: string;
    readonly secondary?: string;
}
export type CalendarSelectionOptions = Readonly<Record<CalendarLookupKind, readonly CalendarLookupItem[]>>;
export interface CalendarEvent {
    readonly selectionOptions?: CalendarSelectionOptions;
    readonly linksEditable?: boolean;
    readonly id: string;
    readonly source: "native" | "legacy";
    readonly originModule: CalendarModule;
    readonly typeId: string;
    readonly typeCode: string;
    readonly title: string;
    readonly description: string | null;
    readonly location: string | null;
    readonly start: string;
    readonly end: string;
    readonly allDay: boolean;
    readonly status: "scheduled" | "completed" | "cancelled";
    readonly version: number;
    readonly canEdit: boolean;
    readonly formKey: string;
    readonly participants?: readonly CalendarParticipant[];
    readonly links?: readonly CalendarLink[];
    readonly details: { readonly reference?: string; readonly teamsRequested?: boolean };
}
export interface CalendarInterval {
    readonly start: string;
    readonly end: string;
}
export interface CalendarEventCommand extends CalendarInterval {
    readonly moduleCode: CalendarModule;
    readonly typeId: string;
    readonly title: string;
    readonly description?: string;
    readonly location?: string;
    readonly allDay: boolean;
    readonly participants?: readonly CalendarParticipant[];
    readonly links?: readonly CalendarLink[];
    readonly details: { readonly reference?: string; readonly teamsRequested?: boolean };
    readonly operationId: string;
}
const invalid = () => new Error("Respuesta de calendario inválida.");
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    return value as Record<string, unknown>;
}
function string(value: unknown): string {
    if (typeof value !== "string") throw invalid();
    return value;
}
function boolean(value: unknown): boolean {
    if (typeof value !== "boolean") throw invalid();
    return value;
}
function nullableString(value: unknown): string | null {
    return value === null ? null : string(value);
}
function moduleCode(value: unknown): CalendarModule {
    if (!CALENDAR_MODULES.some((code) => code === value)) throw invalid();
    return value as CalendarModule;
}
function date(value: unknown): string {
    const result = string(value);
    if (!/^\d{4}-\d\d-\d\dT.*Z$/.test(result) || !Number.isFinite(Date.parse(result))) throw invalid();
    return result;
}
function list<T>(value: unknown, read: (entry: unknown) => T): T[] {
    if (!Array.isArray(value)) throw invalid();
    return value.map(read);
}
function optionalList<T>(value: unknown, read: (entry: unknown) => T): T[] {
    return value === undefined ? [] : list(value, read);
}
function envelope(value: unknown) {
    const data = object(value);
    if (data.schemaVersion !== 1) throw invalid();
    return data;
}
function readType(value: unknown): CalendarType {
    const data = object(value);
    return { id: string(data.id), code: string(data.code), label: string(data.label), color: string(data.color), formKey: string(data.formKey) };
}
function readCalendar(value: unknown): CalendarDescriptor {
    const data = object(value);
    return { moduleCode: moduleCode(data.moduleCode), label: string(data.label), color: string(data.color), canCreate: boolean(data.canCreate), canUpdate: boolean(data.canUpdate), types: list(data.types, readType) };
}
function readDetails(details: Record<string, unknown>): CalendarEvent["details"] {
    return { ...(details.reference === undefined ? {} : { reference: string(details.reference) }), ...(details.teamsRequested === undefined ? {} : { teamsRequested: boolean(details.teamsRequested) }) };
}
function readEvent(value: unknown): CalendarEvent {
    const data = object(value);
    if (!["native", "legacy"].includes(string(data.source)) || !["scheduled", "completed", "cancelled"].includes(string(data.status))) throw invalid();
    if (typeof data.version !== "number" || !Number.isSafeInteger(data.version) || data.version < 0) throw invalid();
    const details = object(data.details);
    const start = date(data.start),
        end = date(data.end);
    if (Date.parse(end) <= Date.parse(start)) throw invalid();
    return {
        id: string(data.id),
        source: data.source as CalendarEvent["source"],
        originModule: moduleCode(data.originModule),
        typeId: string(data.typeId),
        typeCode: string(data.typeCode),
        title: string(data.title),
        description: nullableString(data.description),
        location: nullableString(data.location),
        start,
        end,
        allDay: boolean(data.allDay),
        status: data.status as CalendarEvent["status"],
        version: data.version,
        canEdit: boolean(data.canEdit),
        formKey: string(data.formKey),
        ...(data.linksEditable === undefined ? {} : { linksEditable: boolean(data.linksEditable) }),
        ...readSelectionMetadata(data.selectionOptions),
        participants: optionalList(data.participants, readParticipant),
        links: optionalList(data.links, readLink),
        details: readDetails(details),
    };
}
/** The server supplies the authorized catalogs and capabilities; no sample fallback. */
export async function getCalendars(): Promise<CalendarDescriptor[]> {
    return list(envelope(await apiRequest<unknown>("/calendar/calendars")).calendars, readCalendar);
}
/** Only the visible exclusive interval and explicitly selected authorized modules are requested. */
export async function getCalendarEvents(modules: readonly CalendarModule[], interval: CalendarInterval, contextModule: CalendarModule): Promise<CalendarEvent[]> {
    const query = new URLSearchParams({ moduleCodes: modules.join(","), start: interval.start, end: interval.end, contextModule });
    return list(envelope(await apiRequest<unknown>(`/calendar/events?${query.toString()}`)).events, readEvent);
}
/** Caller holds the original event version and operation UUID across retries. */
export async function saveCalendarEvent(command: CalendarEventCommand, edit?: { readonly id: string; readonly expectedVersion: number }): Promise<CalendarEvent> {
    const path = edit ? `/calendar/events/${encodeURIComponent(edit.id)}` : "/calendar/events";
    const result = readEvent(envelope(await apiRequest<unknown>(path, { method: edit ? "PATCH" : "POST", body: edit ? { ...command, expectedVersion: edit.expectedVersion } : command, retryOnUnauthorized: false })).event);
    if (result.source !== "native" || result.originModule !== command.moduleCode || (edit && result.id !== edit.id)) throw invalid();
    return result;
}

function readParticipant(value: unknown): CalendarParticipant {
    const data = object(value);
    if ((data.userId === undefined) === (data.email === undefined)) throw invalid();
    return data.userId === undefined ? { email: string(data.email) } : { userId: string(data.userId) };
}
function readLink(value: unknown): CalendarLink {
    const data = object(value);
    if (!["note", "lead", "sales_order"].includes(string(data.entityType)) || !["native", "legacy"].includes(string(data.source))) throw invalid();
    return { entityType: data.entityType as CalendarLink["entityType"], source: data.source as CalendarLink["source"], id: string(data.id) };
}
/** Results are authorized by the API; source is part of each record identity. */
export async function getCalendarLookup(kind: CalendarLookupKind, search: string, moduleCode: CalendarModule): Promise<CalendarLookupItem[]> {
    const query = new URLSearchParams({ kind, search, moduleCode });
    return list(object(await apiRequest<unknown>(`/calendar/lookup?${query.toString()}`)).items, (value) => readLookupItem(value, kind));
}

function readLookupItem(value: unknown, kind: CalendarLookupKind): CalendarLookupItem {
    const data = object(value);
    if (!["native", "legacy"].includes(string(data.source)) || (kind === "users" && data.source !== "native")) throw invalid();
    return { id: string(data.id), source: data.source as CalendarLookupItem["source"], label: string(data.label), ...(data.secondary === undefined ? {} : { secondary: string(data.secondary) }) };
}
function readSelectionMetadata(value: unknown): Pick<CalendarEvent, "selectionOptions"> {
    if (value === undefined) return {};
    const data = object(value);
    return {
        selectionOptions: {
            users: list(data.users, (item) => readLookupItem(item, "users")),
            notes: list(data.notes, (item) => readLookupItem(item, "notes")),
            leads: list(data.leads, (item) => readLookupItem(item, "leads")),
            orders: list(data.orders, (item) => readLookupItem(item, "orders")),
        },
    };
}
