import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { OutlookAttendee, OutlookEventDetail, OutlookPerson, OutlookResponse } from "../../modules/crm/calendar/calendar.contract.js";
import { type ExternalAvailability, ExternalCalendarError, type ExternalCalendarPort, type ExternalFeedEvent, type ExternalRoom, type ExternalSlot, type ExternalWrite, type RoomAvailability } from "../../modules/crm/calendar/external-calendar.port.js";

const graph = "https://graph.microsoft.com/v1.0";
const graphTime = z.object({ dateTime: z.string(), timeZone: z.string().optional() });
const eventSchema = z.object({ id: z.string(), subject: z.string().optional(), sensitivity: z.string().optional(), showAs: z.string().optional(), isCancelled: z.boolean().optional(), isAllDay: z.boolean().optional(), start: graphTime, end: graphTime });
const feedSchema = eventSchema.extend({ "@odata.etag": z.string().optional(), iCalUId: z.string().optional(), body: z.object({ contentType: z.string(), content: z.string() }).optional(), location: z.object({ displayName: z.string().optional() }).optional() });
const graphPerson = z.object({ emailAddress: z.object({ name: z.string().nullish(), address: z.string().nullish() }).nullish() });
const detailSchema = z.object({
    organizer: graphPerson.nullish(),
    attendees: z.array(graphPerson.extend({ type: z.string().nullish(), status: z.object({ response: z.string().nullish() }).nullish() })).nullish(),
    isOrganizer: z.boolean().nullish(),
    responseStatus: z.object({ response: z.string().nullish() }).nullish(),
    isOnlineMeeting: z.boolean().nullish(),
    onlineMeeting: z.object({ joinUrl: z.string().nullish() }).nullish(),
    type: z.string().nullish(),
    showAs: z.string().nullish(),
    importance: z.string().nullish(),
    sensitivity: z.string().nullish(),
    webLink: z.string().nullish(),
});
const MAX_ATTENDEES = 100;
const RESPONSES: readonly OutlookResponse[] = ["accepted", "declined", "tentativelyAccepted", "notResponded", "organizer", "none"];
const JOIN_HOSTS = ["teams.microsoft.com"] as const;
const OUTLOOK_HOSTS = ["outlook.office.com", "outlook.office365.com", "outlook.live.com", "office.com"] as const;
const pageSchema = z.object({ value: z.array(z.unknown()), "@odata.nextLink": z.string().optional() });
function instant(value: z.infer<typeof graphTime>): string {
    if (value.timeZone && value.timeZone !== "UTC") throw new ExternalCalendarError("unavailable");
    const input = /(?:Z|[+-]\d\d:\d\d)$/.test(value.dateTime) ? value.dateTime : `${value.dateTime}Z`;
    const parsed = new Date(input);
    if (!Number.isFinite(parsed.getTime())) throw new ExternalCalendarError("unavailable");
    return parsed.toISOString();
}
// Una sola proyección conserva juntas la privacidad y la normalización de los campos opcionales de Graph.
// eslint-disable-next-line complexity
function feedEvent(row: z.infer<typeof feedSchema>, outlook?: OutlookEventDetail): ExternalFeedEvent {
    if (row.body && row.body.contentType.toLowerCase() !== "text") throw new ExternalCalendarError("unavailable");
    // /me/calendarView devuelve el buzón propio: conservar su contenido editable, incluso si es privado.
    // Los calendarios de terceros solo se consultan por disponibilidad y mantienen la redacción allí.
    const content = { title: row.subject ?? "Evento", description: row.body?.content ?? null, location: row.location?.displayName ?? null };
    return { id: row.id, ...content, start: instant(row.start), end: instant(row.end), allDay: row.isAllDay ?? false, uid: row.iCalUId, version: row["@odata.etag"], ...(outlook ? { outlook } : {}) };
}
/** Links from Graph are shown to people, so only https links on known Microsoft hosts pass. */
function trustedLink(value: string | null | undefined, hosts: readonly string[]): string | null {
    try {
        const url = new URL(value ?? "");
        return url.protocol === "https:" && hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.toString() : null;
    } catch {
        return null;
    }
}
const person = (value: z.infer<typeof graphPerson> | null | undefined): OutlookPerson | null => (value?.emailAddress ? { name: value.emailAddress.name ?? null, email: value.emailAddress.address ?? null } : null);
const response = (value: string | null | undefined): OutlookResponse => RESPONSES.find((known) => known === value) ?? "none";
const attendeeKind = (value: string | null | undefined): OutlookAttendee["kind"] => (value === "optional" || value === "resource" ? value : "required");
// Una sola proyección normaliza los campos opcionales de Graph; un campo nuevo malformado no debe romper la agenda.
// eslint-disable-next-line complexity
function outlookDetail(raw: unknown): OutlookEventDetail | undefined {
    const parsed = detailSchema.safeParse(raw);
    if (!parsed.success) return undefined;
    const row = parsed.data;
    const all = row.attendees ?? [];
    const importance = row.importance === "low" || row.importance === "high" ? row.importance : row.importance ? "normal" : null;
    return {
        organizer: person(row.organizer),
        attendees: all.slice(0, MAX_ATTENDEES).map((attendee) => ({ name: attendee.emailAddress?.name ?? null, email: attendee.emailAddress?.address ?? null, kind: attendeeKind(attendee.type), response: response(attendee.status?.response) })),
        attendeeCount: all.length,
        isOrganizer: row.isOrganizer ?? false,
        myResponse: row.responseStatus ? response(row.responseStatus.response) : null,
        isOnlineMeeting: row.isOnlineMeeting ?? false,
        joinUrl: trustedLink(row.onlineMeeting?.joinUrl, JOIN_HOSTS),
        isRecurring: ["occurrence", "exception", "seriesMaster"].includes(row.type ?? ""),
        showAs: row.showAs ?? null,
        sensitivity: row.sensitivity ?? null,
        importance,
        webLink: trustedLink(row.webLink, OUTLOOK_HOSTS),
    };
}
function overlap(a: ExternalSlot, b: ExternalSlot): boolean {
    return Date.parse(a.start) < Date.parse(b.end) && Date.parse(a.end) > Date.parse(b.start);
}
const asTime = (value: string) => ({ dateTime: new Date(value).toISOString(), timeZone: "UTC" });
const attendees = (emails: string[], room?: string) => [...emails.map((address) => ({ emailAddress: { address }, type: "required" })), ...(room ? [{ emailAddress: { address: room }, type: "resource" }] : [])];

function assertResponse(response: Response): void {
    if ([401, 403].includes(response.status)) throw new ExternalCalendarError("consent_required");
    if (response.status === 412) throw new ExternalCalendarError("conflict");
    if (!response.ok) throw new ExternalCalendarError("unavailable");
}
/** Graph exige medianoche en la zona declarada para eventos de día completo; CRM persiste UTC. */
function eventTime(value: string, allDay: boolean) {
    return allDay ? { dateTime: new Date(Date.parse(value) - 6 * 3600000).toISOString().slice(0, 19), timeZone: "Central America Standard Time" } : asTime(value);
}
function eventBody(input: Parameters<ExternalCalendarPort["write"]>[1]) {
    const event = input.event;
    const details = z.object({ teamsRequested: z.boolean().optional() }).parse(event.details);
    return {
        subject: event.title,
        body: { contentType: "text", content: event.description ?? "" },
        start: eventTime(event.start, Boolean(event.allDay)),
        end: eventTime(event.end, Boolean(event.allDay)),
        isAllDay: Boolean(event.allDay),
        location: { displayName: event.location ?? "" },
        attendees: attendees(input.emails, input.roomAddress),
        ...(details.teamsRequested ? { isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" } : {}),
        ...(!input.remoteId ? { transactionId: input.transactionId } : {}),
    };
}
function readRemote(value: unknown, roomAddress?: string): ExternalWrite {
    const schema = z.object({ id: z.string(), isOrganizer: z.boolean().optional(), iCalUId: z.string().optional(), "@odata.etag": z.string().min(1), onlineMeeting: z.object({ joinUrl: z.url() }).nullable().optional(), attendees: z.array(z.object({ type: z.string(), emailAddress: z.object({ address: z.string() }), status: z.object({ response: z.string() }).optional() })).optional() });
    const saved = schema.parse(value);
    const room = saved.attendees?.find((a) => a.type === "resource" && a.emailAddress.address.toLowerCase() === roomAddress?.toLowerCase());
    return { id: saved.id, isOrganizer: saved.isOrganizer === true, uid: saved.iCalUId, version: saved["@odata.etag"], joinUrl: saved.onlineMeeting?.joinUrl ?? null, roomStatus: room?.status?.response ?? (roomAddress ? "notResponded" : null) };
}
const scheduleSchema = z.object({ scheduleId: z.string(), error: z.unknown().optional(), scheduleItems: z.array(z.object({ status: z.string(), start: graphTime, end: graphTime })).optional() });
function roomState(schedule: z.infer<typeof scheduleSchema>, slot: ExternalSlot): RoomAvailability {
    if (schedule.error || !schedule.scheduleItems) return "unknown";
    const statuses = schedule.scheduleItems.filter((entry) => overlap({ start: instant(entry.start), end: instant(entry.end) }, slot)).map((entry) => entry.status.toLowerCase());
    if (statuses.some((status) => ["busy", "tentative", "oof", "workingelsewhere"].includes(status))) return "busy";
    return statuses.every((status) => status === "free") ? "available" : "unknown";
}
function appendSchedule(schedule: z.infer<typeof scheduleSchema>, input: ExternalSlot, result: ExternalAvailability): void {
    if (schedule.error || !schedule.scheduleItems) {
        result.incomplete = true;
        return;
    }
    for (const entry of schedule.scheduleItems) {
        const slot = { start: instant(entry.start), end: instant(entry.end) };
        if (entry.status !== "free" && overlap(slot, input)) result.conflicts.push({ label: schedule.scheduleId, ...slot });
    }
}

/** Graph queda aislado: no registra tokens, respuestas crudas ni asuntos de otros colaboradores. */
@Injectable()
export class Microsoft365CalendarService implements ExternalCalendarPort {
    /** No cambia asistentes, contenido Teams ni recurrencia; Graph revalida el ETag al escribir. */
    async patchOwnEvent(token: string, id: string, input: Parameters<ExternalCalendarPort["patchOwnEvent"]>[2]): Promise<ExternalWrite> {
        const current = await this.read(token, id);
        if (!current.isOrganizer || current.version !== input.expectedVersion) throw new ExternalCalendarError("conflict");
        const saved = await this.request(token, `/me/events/${encodeURIComponent(id)}`, { method: "PATCH", version: input.expectedVersion, body: { subject: input.title, location: { displayName: input.location }, ...(!input.allDay ? { start: asTime(input.start), end: asTime(input.end) } : {}) } });
        return readRemote(saved);
    }
    /** Solo consulta libre/ocupado; no expone títulos ni reserva las salas. */
    async roomAvailability(token: string, input: ExternalSlot & { addresses: string[] }): Promise<Record<string, RoomAvailability>> {
        const result: Record<string, RoomAvailability> = {};
        const addresses = [...new Set(input.addresses.map((address) => address.toLowerCase()))];
        for (const address of addresses) result[address] = "unknown";
        for (let offset = 0; offset < addresses.length; offset += 20) {
            const batch = addresses.slice(offset, offset + 20);
            try {
                const data = z.object({ value: z.array(z.unknown()) }).parse(await this.request(token, "/me/calendar/getSchedule", { body: { schedules: batch, startTime: asTime(input.start), endTime: asTime(input.end), availabilityViewInterval: 30 } }));
                data.value.forEach((value) => {
                    const parsed = scheduleSchema.safeParse(value);
                    if (!parsed.success) return;
                    const address = parsed.data.scheduleId.toLowerCase();
                    if (batch.includes(address)) result[address] = roomState(parsed.data, input);
                });
            } catch {
                // Un lote sin respuesta conserva «unknown», nunca se asume libre.
            }
        }
        return result;
    }
    /** Lee primero Outlook para el intervalo visible, incluidos eventos libres y ocurrencias. */
    async events(token: string, input: ExternalSlot): Promise<ExternalFeedEvent[]> {
        const query = new URLSearchParams({ startDateTime: input.start, endDateTime: input.end, $top: "100", $select: "id,subject,start,end,isAllDay,isCancelled,sensitivity,body,location,iCalUId,organizer,attendees,isOrganizer,responseStatus,isOnlineMeeting,onlineMeeting,type,showAs,importance,webLink" });
        const rows = await this.collection(token, `/me/calendarView?${query.toString()}`);
        if (rows.length > 500) throw new ExternalCalendarError("unavailable");
        return rows
            .map((row) => ({ event: feedSchema.parse(row), detail: outlookDetail(row) }))
            .filter(({ event }) => !event.isCancelled)
            .map(({ event, detail }) => feedEvent(event, detail));
    }
    private async request(token: string, path: string, options: { body?: unknown; method?: string; version?: string | null; acceptMissing?: boolean; emptyResponse?: boolean } = {}): Promise<unknown> {
        const headers = new Headers({ Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: 'outlook.timezone="UTC", IdType="ImmutableId", outlook.body-content-type="text"' });
        if (options.version) headers.set("If-Match", options.version);
        try {
            const response = await fetch(`${graph}${path}`, { method: options.method ?? (options.body === undefined ? "GET" : "POST"), headers, redirect: "error", signal: AbortSignal.timeout(12000), ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
            return await this.responseBody(response, options);
        } catch (error) {
            if (error instanceof ExternalCalendarError) throw error;
            throw new ExternalCalendarError("unavailable");
        }
    }
    /** Las cancelaciones responden sin JSON; un 404 es éxito solo en operaciones idempotentes. */
    private async responseBody(response: Response, options: { acceptMissing?: boolean; emptyResponse?: boolean }): Promise<unknown> {
        if (options.acceptMissing && response.status === 404) return null;
        assertResponse(response);
        if (options.emptyResponse && [202, 204].includes(response.status)) return null;
        return response.json();
    }
    private async collection(token: string, path: string): Promise<unknown[]> {
        const rows: unknown[] = [];
        let next: string | undefined = path;
        for (let count = 0; next && count < 10; count++) {
            const result = pageSchema.parse(await this.request(token, next));
            rows.push(...result.value);
            next = result["@odata.nextLink"];
            if (next) {
                if (!next.startsWith(`${graph}/`)) throw new ExternalCalendarError("unavailable");
                next = next.slice(graph.length);
            }
        }
        if (next) throw new ExternalCalendarError("unavailable");
        return rows;
    }
    /** Lee salas reales del tenant con paginación acotada. */
    async rooms(token: string): Promise<ExternalRoom[]> {
        const rows = await this.collection(token, "/places/microsoft.graph.room?$select=displayName,emailAddress,capacity&$top=100");
        const schema = z.object({ displayName: z.string(), emailAddress: z.email(), capacity: z.number().nullable().optional() });
        return rows.map((row) => {
            const room = schema.parse(row);
            return { label: room.displayName, address: room.emailAddress.toLowerCase(), capacity: room.capacity ?? null };
        });
    }
    /** Combina agenda propia y disponibilidad sin revelar asuntos de otras personas. */
    async availability(token: string, input: ExternalSlot & { emails: string[]; roomAddress?: string; excludeId?: string }): Promise<ExternalAvailability> {
        const day = new Date(Date.parse(input.start) - 6 * 3600000).toISOString().slice(0, 10);
        const dayStart = `${day}T06:00:00.000Z`;
        const dayEnd = new Date(Date.parse(dayStart) + 86400000).toISOString();
        const query = new URLSearchParams({ startDateTime: dayStart, endDateTime: new Date(Math.max(Date.parse(dayEnd), Date.parse(input.end))).toISOString(), $top: "100", $select: "id,subject,start,end,isAllDay,isCancelled,sensitivity,showAs" });
        const rows = await this.collection(token, `/me/calendarView?${query.toString()}`);
        const events = rows.map((row) => eventSchema.parse(row)).filter((row) => !row.isCancelled && row.id !== input.excludeId);
        const result: ExternalAvailability = { events: events.map((row) => ({ id: row.id, title: row.sensitivity === "private" ? "Evento privado" : (row.subject ?? "Evento"), start: instant(row.start), end: instant(row.end), allDay: row.isAllDay ?? false })), conflicts: [], suggestions: [], incomplete: false };
        for (const row of events) {
            const slot = { start: instant(row.start), end: instant(row.end) };
            if (row.showAs !== "free" && overlap(slot, input)) result.conflicts.push({ label: row.sensitivity === "private" ? "Evento privado" : (row.subject ?? "Evento"), ...slot });
        }
        await this.participantConflicts(token, input, result);
        return result;
    }
    private async participantConflicts(token: string, input: ExternalSlot & { emails: string[]; roomAddress?: string }, result: ExternalAvailability): Promise<void> {
        const schedules = [...new Set([...input.emails, ...(input.roomAddress ? [input.roomAddress] : [])])];
        if (!schedules.length) return;
        try {
            for (let offset = 0; offset < schedules.length; offset += 20) {
                const batch = schedules.slice(offset, offset + 20);
                const data = z.object({ value: z.array(scheduleSchema) }).parse(await this.request(token, "/me/calendar/getSchedule", { body: { schedules: batch, startTime: asTime(input.start), endTime: asTime(input.end), availabilityViewInterval: 30 } }));
                if (data.value.length !== batch.length) result.incomplete = true;
                data.value.forEach((schedule) => {
                    appendSchedule(schedule, input, result);
                });
            }
        } catch {
            result.incomplete = true;
        }
    }
    /** Las sugerencias usan un consentimiento independiente; su falta no impide leer la agenda. */
    async suggestions(token: string, input: ExternalSlot & { emails: string[]; roomAddress?: string }): Promise<ExternalSlot[]> {
        const minutes = Math.ceil((Date.parse(input.end) - Date.parse(input.start)) / 60000);
        if (minutes > 1440) return [];
        const schema = z.object({ meetingTimeSuggestions: z.array(z.object({ confidence: z.number().optional(), meetingTimeSlot: z.object({ start: graphTime, end: graphTime }) })) });
        const start = new Date(Math.max(Date.parse(input.start), Date.now())).toISOString();
        const data = schema.parse(await this.request(token, "/me/findMeetingTimes", { body: { attendees: attendees(input.emails, input.roomAddress), meetingDuration: `PT${String(minutes)}M`, maxCandidates: 5, minimumAttendeePercentage: 100, returnSuggestionReasons: true, timeConstraint: { activityDomain: "work", timeSlots: [{ start: asTime(start), end: asTime(new Date(Date.parse(start) + 7 * 86400000).toISOString()) }] } } }));
        return data.meetingTimeSuggestions.filter((s) => s.confidence === undefined || s.confidence === 100).map((s) => ({ start: instant(s.meetingTimeSlot.start), end: instant(s.meetingTimeSlot.end) }));
    }
    /** Relee una entrega confirmada sin repetir invitaciones. */
    async cancel(token: string, id: string, version: string | null, reason: string): Promise<void> {
        const current = await this.request(token, `/me/events/${encodeURIComponent(id)}`, { acceptMissing: true });
        if (current === null) return;
        const remote = readRemote(current);
        if (!remote.isOrganizer || (version !== null && remote.version !== version)) throw new ExternalCalendarError("conflict");
        await this.request(token, `/me/events/${encodeURIComponent(id)}/cancel`, { method: "POST", body: { comment: reason }, acceptMissing: true, emptyResponse: true });
    }
    /** Relee una entrega confirmada sin repetir invitaciones. */
    async read(token: string, id: string, roomAddress?: string): Promise<ExternalWrite> {
        return readRemote(await this.request(token, `/me/events/${encodeURIComponent(id)}`), roomAddress);
    }
    /** Usa transactionId estable y ETag para evitar duplicados o sobreescrituras. */
    async write(token: string, input: Parameters<ExternalCalendarPort["write"]>[1]): Promise<ExternalWrite> {
        const path = input.remoteId ? `/me/events/${encodeURIComponent(input.remoteId)}` : "/me/events";
        const saved = await this.request(token, path, { body: eventBody(input), method: input.remoteId ? "PATCH" : "POST", version: input.remoteVersion });
        return readRemote(saved, input.roomAddress);
    }
}
