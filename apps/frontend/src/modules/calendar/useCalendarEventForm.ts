import { useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import { type CalendarDescriptor, type CalendarEvent, type CalendarEventCommand, type CalendarLink, type CalendarModule, type CalendarSelectionOptions, saveCalendarEvent } from "../../services/calendar/calendar-service";
import { calendarNextDay, localToUtc, utcToLocal } from "./calendar-time";

const emptySelectionOptions: CalendarSelectionOptions = { users: [], notes: [], leads: [], orders: [] };

export interface CalendarFields {
    typeId: string;
    title: string;
    description: string;
    location: string;
    start: string;
    end: string;
    allDay: boolean;
    reference: string;
    userIds: string[];
    externalEmails: string;
    teamsRequested: boolean;
    links: CalendarLink[];
}
function initialFields(event: CalendarEvent | null, date: string): CalendarFields {
    if (event)
        return {
            ...participantFields(event),
            typeId: event.typeId,
            title: event.title,
            description: event.description ?? "",
            location: event.location ?? "",
            start: utcToLocal(event.start),
            end: utcToLocal(event.end),
            allDay: event.allDay,
            reference: event.details.reference ?? "",
            teamsRequested: event.details.teamsRequested ?? false,
            links: [...(event.links ?? [])],
        };
    return { typeId: "", title: "", description: "", location: "", start: `${date}T09:00`, end: `${date}T10:00`, allDay: false, reference: "", userIds: [], externalEmails: "", teamsRequested: false, links: [] };
}
function participantFields(event: CalendarEvent) {
    const participants = event.participants ?? [];
    return { userIds: participants.flatMap((p) => (p.userId ? [p.userId] : [])), externalEmails: participants.flatMap((p) => (p.email ? [p.email] : [])).join(", ") };
}
/** Unknown form keys stay readable and cannot accidentally select a different module's editor. */
export function calendarEditAccess(event: CalendarEvent | null, calendar: CalendarDescriptor, currentModule: CalendarModule) {
    const supportedTypes = calendar.types.filter((type) => type.formKey === `${calendar.moduleCode}.general.v1`);
    const supported = event ? event.formKey === `${calendar.moduleCode}.general.v1` && supportedTypes.some((type) => type.id === event.typeId) : supportedTypes.length > 0;
    const capability = event ? [event.source === "native", event.canEdit, calendar.canUpdate].every(Boolean) : calendar.canCreate;
    return { types: supportedTypes, supported, editable: supported && calendar.moduleCode === currentModule && capability };
}
function commandBody(fields: CalendarFields, moduleCode: CalendarModule, operationId: string): CalendarEventCommand {
    const start = localToUtc(fields.allDay ? `${fields.start.slice(0, 10)}T00:00` : fields.start);
    const end = localToUtc(fields.allDay ? `${fields.end.slice(0, 10)}T00:00` : fields.end);
    if (!fields.title.trim() || !fields.typeId) throw new Error("Completa título y tipo.");
    if (Date.parse(end) <= Date.parse(start)) throw new Error("El fin debe ser posterior al inicio. En día completo, el fin es exclusivo.");
    const emails = [
        ...new Set(
            fields.externalEmails
                .split(/[,;\s]+/)
                .filter(Boolean)
                .map((email) => email.toLowerCase()),
        ),
    ];
    if (emails.some((email) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) throw new Error("Revisa los correos de invitados externos.");
    return { participants: [...fields.userIds.map((userId) => ({ userId })), ...emails.map((email) => ({ email }))], links: fields.links, moduleCode, typeId: fields.typeId, title: fields.title.trim(), description: fields.description, location: fields.location, start, end, allDay: fields.allDay, details: { ...(fields.reference.trim() ? { reference: fields.reference.trim() } : {}), teamsRequested: fields.teamsRequested }, operationId };
}
function writeFailure(error: unknown) {
    const definite = error instanceof ApiClientError && [400, 401, 403, 404, 409].includes(error.status);
    const invalid = error instanceof ApiClientError && error.status === 400;
    if (invalid) return { stale: false, uncertain: false, message: "Los datos no son válidos. Revisa el evento antes de guardar." };
    return { stale: definite, uncertain: !definite, message: definite ? "El evento o tus permisos cambiaron. Recarga el calendario antes de editar." : "No se confirmó el guardado. Reintenta la misma operación; se conservan sus datos e identificador." };
}
/** Keeps the original version and retry key. Unknown writes freeze the draft until the same operation is retried. */
export function useCalendarEventForm(event: CalendarEvent | null, calendar: CalendarDescriptor, date: string, onSaved: () => void) {
    const [fields, setFields] = useState(() => initialFields(event, date));
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<{ stale: boolean; uncertain: boolean; message: string } | null>(null);
    const operation = useRef<string | null>(null);
    const pending = useRef(false);
    const linksEditable = event?.linksEditable !== false;
    const change = <K extends keyof CalendarFields>(key: K, value: CalendarFields[K]) => {
        setFields((previous) => ({ ...previous, [key]: value }));
        operation.current = null;
        setFailure(null);
    };
    const changeAllDay = (checked: boolean) => {
        change("allDay", checked);
        if (checked && fields.end.slice(0, 10) <= fields.start.slice(0, 10)) change("end", `${calendarNextDay(fields.start.slice(0, 10))}T00:00`);
    };
    const save = async () => {
        if (pending.current) return;
        operation.current ??= crypto.randomUUID();
        let command: CalendarEventCommand;
        try {
            command = commandBody(fields, calendar.moduleCode, operation.current);
            if (!linksEditable) {
                // Omission preserves API-redacted relations; an empty array would remove them.
                const { links: _links, ...preserved } = command;
                command = preserved;
            }
        } catch (error) {
            setFailure({ stale: false, uncertain: false, message: error instanceof Error ? error.message : "Revisa las fechas." });
            return;
        }
        pending.current = true;
        setBusy(true);
        try {
            await saveCalendarEvent(command, event ? { id: event.id, expectedVersion: event.version } : undefined);
            onSaved();
        } catch (error) {
            setFailure(writeFailure(error));
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };
    return { initialSelectionOptions: event?.selectionOptions ?? emptySelectionOptions, linksEditable, fields, change, changeAllDay, busy, failure, save, pending };
}
