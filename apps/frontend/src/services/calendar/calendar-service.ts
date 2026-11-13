import { apiRequest } from "../api/api-client";

export const CALENDAR_MODULES = ["formalizacion", "mercadeo", "ventas"] as const;
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
    readonly lead?: { readonly id: string; readonly source: "native" | "legacy"; readonly label: string };
}
export type CalendarSelectionOptions = Readonly<Record<CalendarLookupKind, readonly CalendarLookupItem[]>>;
export type OutlookResponse = "accepted" | "declined" | "tentativelyAccepted" | "notResponded" | "organizer" | "none";
export interface OutlookPerson {
    readonly name: string | null;
    readonly email: string | null;
}
export interface OutlookAttendee extends OutlookPerson {
    readonly kind: "required" | "optional" | "resource";
    readonly response: OutlookResponse;
}
/** Datos de solo lectura que Outlook tiene del evento. Mostrarlos no concede nada y no escribe de vuelta. */
export interface OutlookEventDetail {
    readonly organizer: OutlookPerson | null;
    readonly attendees: readonly OutlookAttendee[];
    readonly attendeeCount: number;
    readonly isOrganizer: boolean;
    readonly myResponse: OutlookResponse | null;
    readonly isOnlineMeeting: boolean;
    readonly joinUrl: string | null;
    readonly isRecurring: boolean;
    readonly showAs: string | null;
    readonly sensitivity: string | null;
    readonly importance: "low" | "normal" | "high" | null;
    readonly webLink: string | null;
}
export interface CalendarEvent {
    readonly canManageStatus?: boolean;
    readonly crmDetail?: CalendarCrmDetail;
    readonly orderLinksLocked?: boolean;
    readonly selectionOptions?: CalendarSelectionOptions;
    readonly delivery?: CalendarDelivery;
    readonly linksEditable?: boolean;
    readonly id: string;
    readonly source: "native" | "legacy" | "outlook";
    readonly originModule: CalendarModule | null;
    readonly outlookId?: string;
    readonly outlookVersion?: string;
    readonly outlookDetail?: OutlookEventDetail;
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
    readonly details: { readonly reference?: string; readonly teamsRequested?: boolean; readonly roomAddress?: string };
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
    readonly details: { readonly reference?: string; readonly teamsRequested?: boolean; readonly roomAddress?: string };
    readonly operationId: string;
    readonly publishToCalendar?: boolean;
    readonly expectedOutlookVersion?: string;
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
    return { ...(details.roomAddress === undefined ? {} : { roomAddress: string(details.roomAddress) }), ...(details.reference === undefined ? {} : { reference: string(details.reference) }), ...(details.teamsRequested === undefined ? {} : { teamsRequested: boolean(details.teamsRequested) }) };
}
const OUTLOOK_RESPONSES: readonly OutlookResponse[] = ["accepted", "declined", "tentativelyAccepted", "notResponded", "organizer", "none"];
function readOutlookPerson(value: unknown): OutlookPerson {
    const data = object(value);
    return { name: nullableString(data.name), email: nullableString(data.email) };
}
function readOutlookAttendee(value: unknown): OutlookAttendee {
    const data = object(value);
    if (!["required", "optional", "resource"].includes(string(data.kind))) throw invalid();
    if (!OUTLOOK_RESPONSES.some((response) => response === data.response)) throw invalid();
    return { ...readOutlookPerson(data), kind: data.kind as OutlookAttendee["kind"], response: data.response as OutlookResponse };
}
const httpsOrNull = (value: unknown): string | null => (typeof value === "string" && value.startsWith("https://") ? value : null);
/** El detalle es información extra. Uno mal formado se descarta y no vacía todo el calendario. */
function readOutlookDetail(value: unknown): { outlookDetail?: OutlookEventDetail } {
    try {
        const data = object(value);
        if (typeof data.attendeeCount !== "number") throw invalid();
        return {
            outlookDetail: {
                organizer: data.organizer === null ? null : readOutlookPerson(data.organizer),
                attendees: list(data.attendees, readOutlookAttendee),
                attendeeCount: data.attendeeCount,
                isOrganizer: boolean(data.isOrganizer),
                myResponse: data.myResponse === null ? null : (OUTLOOK_RESPONSES.find((response) => response === data.myResponse) ?? null),
                isOnlineMeeting: boolean(data.isOnlineMeeting),
                joinUrl: httpsOrNull(data.joinUrl),
                isRecurring: boolean(data.isRecurring),
                showAs: nullableString(data.showAs),
                sensitivity: nullableString(data.sensitivity),
                importance: ["low", "normal", "high"].includes(String(data.importance)) ? (data.importance as "low" | "normal" | "high") : null,
                webLink: httpsOrNull(data.webLink),
            },
        };
    } catch {
        return {};
    }
}
function readEvent(value: unknown): CalendarEvent {
    const data = object(value);
    if (!["scheduled", "completed", "cancelled"].includes(string(data.status))) throw invalid();
    if (typeof data.version !== "number" || !Number.isSafeInteger(data.version) || data.version < 0) throw invalid();
    const details = object(data.details);
    const start = date(data.start),
        end = date(data.end);
    if (Date.parse(end) <= Date.parse(start)) throw invalid();
    return {
        id: string(data.id),
        source: data.source as CalendarEvent["source"],
        originModule: readOrigin(data),
        ...(data.crmDetail === undefined ? {} : { crmDetail: readCrmDetail(data.crmDetail) }),
        ...readOutlookIdentity(data),
        ...(data.outlookDetail === undefined ? {} : readOutlookDetail(data.outlookDetail)),
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
        ...readRelationAccess(data),
        ...readSelectionMetadata(data.selectionOptions),
        participants: optionalList(data.participants, readParticipant),
        links: optionalList(data.links, readLink),
        details: readDetails(details),
    };
}
function readRelationAccess(data: Record<string, unknown>): Pick<CalendarEvent, "linksEditable" | "orderLinksLocked" | "canManageStatus"> {
    return { ...(data.canManageStatus === undefined ? {} : { canManageStatus: boolean(data.canManageStatus) }), ...(data.linksEditable === undefined ? {} : { linksEditable: boolean(data.linksEditable) }), ...(data.orderLinksLocked === undefined ? {} : { orderLinksLocked: boolean(data.orderLinksLocked) }) };
}
function readOrigin(data: Record<string, unknown>): CalendarModule | null {
    if (!["native", "legacy", "outlook"].includes(string(data.source))) throw invalid();
    if (data.source !== "outlook") return moduleCode(data.originModule);
    if (data.originModule !== null) throw invalid();
    return null;
}
/** Identidad y versión externas se mantienen separadas del ID y versión del CRM. */
function readOutlookIdentity(data: Record<string, unknown>) {
    return { ...(data.outlookId === undefined ? {} : { outlookId: string(data.outlookId) }), ...(data.outlookVersion === undefined ? {} : { outlookVersion: string(data.outlookVersion) }) };
}
/** El servidor entrega los catálogos y las capacidades autorizadas. No hay un ejemplo de respaldo. */
export async function getCalendars(): Promise<CalendarDescriptor[]> {
    return list(envelope(await apiRequest<unknown>("/calendar/calendars")).calendars, readCalendar);
}
/** Se pide solo el intervalo exclusivo visible y los módulos autorizados elegidos de forma explícita. */
export async function getCalendarEvents(modules: readonly CalendarModule[], interval: CalendarInterval, contextModule: CalendarModule): Promise<CalendarEvent[]> {
    return (await getCalendarFeed(modules, interval, contextModule)).events;
}
export type OutlookFeedStatus = "connected" | "consent_required" | "unavailable" | "conflict";
/** El API une Outlook y CRM; una falla externa queda visible sin ocultar los eventos locales. */
export async function getCalendarFeed(modules: readonly CalendarModule[], interval: CalendarInterval, contextModule: CalendarModule): Promise<{ events: CalendarEvent[]; outlookStatus: OutlookFeedStatus }> {
    const query = new URLSearchParams({ moduleCodes: modules.join(","), start: interval.start, end: interval.end, contextModule });
    const response = envelope(await apiRequest<unknown>(`/calendar/events?${query.toString()}`));
    const outlookStatus = response.outlookStatus ?? "unavailable";
    if (!["connected", "consent_required", "unavailable", "conflict"].includes(string(outlookStatus))) throw invalid();
    return { events: list(response.events, readEvent), outlookStatus: outlookStatus as OutlookFeedStatus };
}
/** Quien llama conserva la versión original del evento y el UUID de la operación entre reintentos. */
export async function saveCalendarEvent(command: CalendarEventCommand, edit?: { readonly id: string; readonly expectedVersion: number }): Promise<CalendarEvent> {
    const path = edit ? `/calendar/events/${encodeURIComponent(edit.id)}` : "/calendar/events";
    const response = envelope(await apiRequest<unknown>(path, { method: edit ? "PATCH" : "POST", body: edit ? { ...command, expectedVersion: edit.expectedVersion } : command, retryOnUnauthorized: false }));
    const result = readEvent(response.event);

    if (result.source !== "native" || result.originModule !== command.moduleCode || (edit && result.id !== edit.id)) throw invalid();
    return { ...result, delivery: readDelivery(response.delivery) };
}
export interface CalendarStatusCommand {
    readonly moduleCode: CalendarModule;
    readonly action: "complete" | "cancel" | "reactivate";
    readonly expectedStatus: CalendarEvent["status"];
    readonly expectedVersion: number;
    readonly operationId: string;
    readonly reason?: string;
    expectedOutlookVersion?: string;
}
/** Comando independiente con versión y UUID estables ante respuestas inciertas. */
export async function changeCalendarStatus(id: string, command: CalendarStatusCommand): Promise<{ event: CalendarEvent; delivery: CalendarDelivery }> {
    const response = envelope(await apiRequest<unknown>(`/calendar/events/${encodeURIComponent(id)}/status`, { method: "PATCH", body: command, retryOnUnauthorized: false }));
    const event = readEvent(response.event);
    if (event.id !== id || event.originModule !== command.moduleCode || event.source !== "native") throw invalid();
    return { event, delivery: readDelivery(response.delivery) };
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
/** El API autoriza los resultados. El origen forma parte de la identidad de cada registro. */
export async function getCalendarLookup(kind: CalendarLookupKind, search: string, moduleCode: CalendarModule, leads?: readonly CalendarLink[]): Promise<CalendarLookupItem[]> {
    const query = new URLSearchParams({ kind, search, moduleCode });
    if (leads?.length) query.set("leads", JSON.stringify(leads));
    return list(object(await apiRequest<unknown>(`/calendar/lookup?${query.toString()}`)).items, (value) => readLookupItem(value, kind));
}

function readLookupItem(value: unknown, kind: CalendarLookupKind): CalendarLookupItem {
    const data = object(value);
    if (!["native", "legacy"].includes(string(data.source)) || (kind === "users" && data.source !== "native")) throw invalid();
    return { id: string(data.id), source: data.source as CalendarLookupItem["source"], label: string(data.label), ...(data.secondary === undefined ? {} : { secondary: string(data.secondary) }), ...(data.lead === undefined ? {} : { lead: readLookupItem(data.lead, "leads") }) };
}
function readSelectionMetadata(value: unknown): Pick<CalendarEvent, "selectionOptions"> {
    if (value === undefined) return {};
    const data = object(value);
    return {
        selectionOptions: {
            users: optionalList(data.users, (item) => readLookupItem(item, "users")),
            notes: optionalList(data.notes, (item) => readLookupItem(item, "notes")),
            leads: optionalList(data.leads, (item) => readLookupItem(item, "leads")),
            orders: optionalList(data.orders, (item) => readLookupItem(item, "orders")),
        },
    };
}

export interface CalendarDelivery {
    readonly status: "crm_only" | "synced" | "consent_required" | "unavailable" | "conflict";
    readonly joinUrl?: string | null;
    readonly roomStatus?: string | null;
}
function readDelivery(value: unknown): CalendarDelivery {
    if (value === undefined) return { status: "crm_only" };
    const row = object(value);
    if (!["crm_only", "synced", "consent_required", "unavailable", "conflict"].includes(string(row.status))) throw invalid();
    return { status: row.status as CalendarDelivery["status"], ...(row.joinUrl === undefined ? {} : { joinUrl: nullableString(row.joinUrl) }), ...(row.roomStatus === undefined ? {} : { roomStatus: nullableString(row.roomStatus) }) };
}
export interface OutlookSlot {
    readonly start: string;
    readonly end: string;
}
export interface OutlookBusy extends OutlookSlot {
    readonly id: string;
    readonly title: string;
    readonly allDay: boolean;
}
export interface OutlookRoom {
    readonly address: string;
    readonly label: string;
    readonly capacity: number | null;
    readonly availability?: "available" | "busy" | "unknown";
}
export interface OutlookAvailability {
    readonly events: readonly OutlookBusy[];
    readonly conflicts: readonly (OutlookSlot & { readonly label: string })[];
    readonly suggestions: readonly OutlookSlot[];
    readonly incomplete: boolean;
    readonly suggestionsStatus?: "available" | "consent_required" | "unavailable";
}
export type OutlookResult<T> = { readonly status: "connected"; readonly data: T } | { readonly status: "consent_required" | "unavailable" | "conflict" };
function readOutlook<T>(value: unknown, read: (data: unknown) => T): OutlookResult<T> {
    const row = object(value);
    if (row.status === "connected") return { status: "connected", data: read(row.data) };
    if (!["consent_required", "unavailable", "conflict"].includes(string(row.status))) throw invalid();
    return { status: row.status as "consent_required" | "unavailable" | "conflict" };
}
const readSlot = (value: unknown): OutlookSlot => {
    const row = object(value);
    return { start: date(row.start), end: date(row.end) };
};
/**
 *
 */
export async function getCalendarAvailability(input: OutlookSlot & { readonly moduleCode: CalendarModule; readonly userIds: readonly string[]; readonly roomAddress?: string; readonly eventId?: string }): Promise<OutlookResult<OutlookAvailability>> {
    return readOutlook(await apiRequest<unknown>("/calendar/availability", { method: "POST", body: input }), (value) => {
        const row = object(value);
        return {
            events: list(row.events, (value) => {
                const event = object(value);
                return { ...readSlot(value), id: string(event.id), title: string(event.title), allDay: boolean(event.allDay) };
            }),
            conflicts: list(row.conflicts, (value) => ({ ...readSlot(value), label: string(object(value).label) })),
            suggestions: list(row.suggestions, readSlot),
            incomplete: boolean(row.incomplete),
            ...readSuggestionsStatus(row.suggestionsStatus),
        };
    });
}
/**
 *
 */
export async function getCalendarRooms(moduleCode: CalendarModule, interval?: OutlookSlot): Promise<OutlookResult<readonly OutlookRoom[]>> {
    return readOutlook(await apiRequest<unknown>(`/calendar/rooms?${new URLSearchParams({ moduleCode, ...interval })}`), (value) =>
        list(value, (item) => {
            const row = object(item);
            if (row.capacity !== null && typeof row.capacity !== "number") throw invalid();
            if (row.availability !== undefined && !["available", "busy", "unknown"].includes(string(row.availability))) throw invalid();
            return { address: string(row.address), label: string(row.label), capacity: row.capacity, ...(row.availability === undefined ? {} : { availability: row.availability as NonNullable<OutlookRoom["availability"]> }) };
        }),
    );
}

function readSuggestionsStatus(value: unknown): Pick<OutlookAvailability, "suggestionsStatus"> {
    if (value === undefined) return {};
    if (!["available", "consent_required", "unavailable"].includes(string(value))) throw invalid();
    return { suggestionsStatus: value as "available" | "consent_required" | "unavailable" };
}

export interface CalendarNotification {
    readonly id: string;
    readonly eventId: string;
    readonly title: string;
    readonly start: string;
    readonly moduleCode: CalendarModule;
    readonly contextModule: CalendarModule;
    readonly organizer: string;
    readonly kind: string;
    readonly readAt: string | null;
}
/** Solo metadatos del destinatario actual; la lectura no confirma asistencia. */
export async function getCalendarNotifications(): Promise<{ items: CalendarNotification[]; unreadCount: number }> {
    const data = object(await apiRequest<unknown>("/calendar/notifications"));
    if (typeof data.unreadCount !== "number" || !Number.isSafeInteger(data.unreadCount) || data.unreadCount < 0) throw invalid();
    const items = list(data.items, (value): CalendarNotification => {
        const row = object(value);
        const moduleCode = string(row.moduleCode) as CalendarModule;
        const contextModule = string(row.contextModule) as CalendarModule;
        if (!CALENDAR_MODULES.includes(moduleCode) || !CALENDAR_MODULES.includes(contextModule)) throw invalid();
        return { id: string(row.id), eventId: string(row.eventId), title: string(row.title), start: date(row.start), moduleCode, contextModule, organizer: string(row.organizer), kind: string(row.kind), readAt: row.readAt === null ? null : date(row.readAt) };
    });
    return { items, unreadCount: data.unreadCount };
}
/** Marca una notificación propia sin responder a la invitación. */
export async function markCalendarNotificationRead(id: string): Promise<void> {
    if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id)) throw invalid();
    await apiRequest(`/calendar/notifications/${id}/read`, { method: "PUT", retryOnUnauthorized: false });
}
/** Se acusa lectura después de cargar el detalle; el servidor conserva destinatario y ACL. */
export async function markCalendarEventRead(id: string): Promise<void> {
    if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id)) throw invalid();
    await apiRequest(`/calendar/notifications/events/${id}/read`, { method: "PUT", retryOnUnauthorized: false });
    window.dispatchEvent(new Event("calendar-notifications-changed"));
}

/** Edición limitada al organizador: los asistentes y el bloque Teams se conservan en Outlook. */
export async function updateOwnOutlookEvent(event: CalendarEvent, moduleCode: CalendarModule, fields: { title: string; location: string; start: string; end: string; allDay: boolean }): Promise<void> {
    if (!event.outlookVersion) throw new Error("Recarga el evento para obtener su versión actual.");
    await apiRequest(`/calendar/outlook-events/${encodeURIComponent(event.outlookId ?? event.id)}`, { method: "PATCH", retryOnUnauthorized: false, body: { ...fields, moduleCode, expectedVersion: event.outlookVersion } });
}

export interface CalendarCrmDetail {
    readonly loaded: boolean;
    readonly version: number;
    readonly moduleCode: CalendarModule;
    readonly typeLabel: string;
    readonly typeColor: string | null;
    readonly colorOverride: string | null;
    readonly title: string;
    readonly description: string | null;
    readonly location: string | null;
    readonly start: string;
    readonly end: string;
    readonly allDay: boolean;
    readonly status: CalendarEvent["status"];
    readonly reference: string | null;
    readonly teamsRequested: boolean;
    readonly roomAddress: string | null;
    readonly organizerName: string | null;
    readonly timezone: string | null;
    readonly cancellationReason: string | null;
    readonly createdAt: string | null;
    readonly updatedAt: string | null;
    readonly invitationVersion: number | null;
    readonly links: readonly (CalendarLink & { readonly label: string; readonly secondary?: string; readonly canOpen?: boolean })[];
    readonly participants: readonly { readonly label: string; readonly email: string | null }[];
    readonly restrictedLinks: boolean;
}
function crmColor(value: unknown): string | null {
    if (value === null) return null;
    const color = string(value);
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw invalid();
    return color;
}
function crmInteger(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid();
    return value;
}
/** Conserva la copia CRM sin sobrescribirla con campos del proveedor. */
function readCrmDetail(value: unknown): CalendarCrmDetail {
    const row = object(value);
    const status = string(row.status);
    if (!["scheduled", "completed", "cancelled"].includes(status)) throw invalid();
    return {
        loaded: boolean(row.loaded),
        version: crmInteger(row.version),
        moduleCode: moduleCode(row.moduleCode),
        typeLabel: string(row.typeLabel),
        typeColor: crmColor(row.typeColor),
        colorOverride: crmColor(row.colorOverride),
        title: string(row.title),
        description: nullableString(row.description),
        location: nullableString(row.location),
        start: date(row.start),
        end: date(row.end),
        allDay: boolean(row.allDay),
        status: status as CalendarEvent["status"],
        reference: nullableString(row.reference),
        teamsRequested: boolean(row.teamsRequested),
        roomAddress: nullableString(row.roomAddress),
        organizerName: nullableString(row.organizerName),
        timezone: nullableString(row.timezone),
        cancellationReason: nullableString(row.cancellationReason),
        createdAt: row.createdAt === null ? null : date(row.createdAt),
        updatedAt: row.updatedAt === null ? null : date(row.updatedAt),
        invitationVersion: row.invitationVersion === null ? null : crmInteger(row.invitationVersion),
        links: list(row.links, (value) => {
            const link = object(value);
            return { ...readLink(link), label: string(link.label), ...(link.canOpen === undefined ? {} : { canOpen: boolean(link.canOpen) }), ...(link.secondary === undefined ? {} : { secondary: string(link.secondary) }) };
        }),
        participants: list(row.participants, (value) => {
            const person = object(value);
            return { label: string(person.label), email: nullableString(person.email) };
        }),
        restrictedLinks: boolean(row.restrictedLinks),
    };
}

/** Carga las relaciones CRM solo para el detalle abierto. */
export async function getCalendarCrmDetail(id: string): Promise<CalendarCrmDetail> {
    const response = object(await apiRequest<unknown>(`/calendar/events/${encodeURIComponent(id)}/detail`));
    const detail = readCrmDetail(response.crmDetail);
    if (!detail.loaded) throw invalid();
    return detail;
}
