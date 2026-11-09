import { useCallback, useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import { type CalendarDelivery, type CalendarDescriptor, type CalendarEvent, type CalendarEventCommand, type CalendarLink, type CalendarLookupItem, type CalendarModule, type CalendarSelectionOptions, saveCalendarEvent } from "../../services/calendar/calendar-service";
import { futureAddendumMessage, futureAddendumReference } from "../../services/formalization/order-addendum-service";
import { calendarNextDay, localToUtc, utcToLocal } from "./calendar-time";
import { useAddendumConflict } from "./useAddendumConflict";

const emptySelectionOptions: CalendarSelectionOptions = { users: [], notes: [], leads: [], orders: [] };

export interface CalendarOrderContext {
    readonly reference: string;
    readonly order: CalendarLookupItem & { readonly lead: NonNullable<CalendarLookupItem["lead"]> };
}
function contextLinks(context: CalendarOrderContext): CalendarLink[] {
    return [
        { entityType: "lead", source: context.order.lead.source, id: context.order.lead.id },
        { entityType: "sales_order", source: context.order.source, id: context.order.id },
    ];
}
function fixedOrderLinks(event: CalendarEvent | null, context?: CalendarOrderContext): CalendarLink[] | null {
    if (context) return contextLinks(context);
    if (!event || event.originModule !== "formalizacion") return null;
    if (![event.typeCode === "adendum", event.orderLinksLocked].some(Boolean)) return null;
    return [...(event.links ?? [])].filter((link) => link.entityType !== "note");
}
function contextDefaults(context?: CalendarOrderContext) {
    return { reference: context?.reference ?? "", links: context ? contextLinks(context) : [] };
}
function selectionOptions(event: CalendarEvent | null, context?: CalendarOrderContext): CalendarSelectionOptions {
    return event?.selectionOptions ?? (context ? { ...emptySelectionOptions, leads: [context.order.lead], orders: [context.order] } : emptySelectionOptions);
}

export interface CalendarFields {
    typeId: string;
    roomAddress: string;
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
function eventFields(event: CalendarEvent): CalendarFields {
    return {
        ...participantFields(event),
        roomAddress: event.details.roomAddress ?? "",
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
}
/** A new event starts at 09:00-10:00 of the chosen day, or at the slot picked on the time grid. */
function blankFields(date: string, context?: CalendarOrderContext, range?: { readonly start: string; readonly end: string }): CalendarFields {
    return { roomAddress: "", typeId: "", title: "", description: "", location: "", start: range?.start ?? `${date}T09:00`, end: range?.end ?? `${date}T10:00`, allDay: false, userIds: [], externalEmails: "", teamsRequested: false, ...contextDefaults(context) };
}
function initialFields(event: CalendarEvent | null, date: string, context?: CalendarOrderContext, range?: { readonly start: string; readonly end: string }): CalendarFields {
    return event ? eventFields(event) : blankFields(date, context, range);
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
    return {
        publishToCalendar: true,
        participants: [...fields.userIds.map((userId) => ({ userId })), ...emails.map((email) => ({ email }))],
        links: fields.links,
        moduleCode,
        typeId: fields.typeId,
        title: fields.title.trim(),
        description: fields.description,
        location: fields.location,
        start,
        end,
        allDay: fields.allDay,
        details: commandDetails(fields),
        operationId,
    };
}
function commandDetails(fields: CalendarFields) {
    return { ...(fields.reference.trim() ? { reference: fields.reference.trim() } : {}), teamsRequested: fields.teamsRequested, ...(fields.roomAddress ? { roomAddress: fields.roomAddress } : {}) };
}
function pendingDelivery(command: CalendarEventCommand, saved: CalendarEvent): boolean {
    return command.publishToCalendar === true && !["synced", "crm_only"].includes(saved.delivery?.status ?? "");
}
function deliveryFailure(saved: CalendarEvent) {
    const stale = saved.delivery?.status === "conflict";
    const message = stale ? `Evento ${saved.id} guardado en Habita. Outlook detectó otra versión del evento. Recarga el calendario para revisar sus datos antes de volver a sincronizar.` : `Evento ${saved.id} guardado en Habita. Outlook no confirmó la sincronización. Reintenta la misma operación o conserva solo el registro Habita.`;
    return { stale, uncertain: !stale, message };
}
function writeFailure(error: unknown) {
    const conflict = futureConflict(error);
    if (conflict) return { stale: true, uncertain: false, message: conflict };
    const definite = error instanceof ApiClientError && [400, 401, 403, 404, 409].includes(error.status);
    const invalid = error instanceof ApiClientError && error.status === 400;
    if (invalid) return { stale: false, uncertain: false, message: "Los datos no son válidos. Revisa el evento antes de guardar." };
    return { stale: definite, uncertain: !definite, message: definite ? "El evento o tus permisos cambiaron. Recarga el calendario antes de editar." : "No se confirmó el guardado. Reintenta la misma operación; se conservan sus datos e identificador." };
}
function futureConflict(error: unknown): string | null {
    if (!(error instanceof ApiClientError) || error.status !== 409) return null;
    const body = error.responseBody;
    if (!body || typeof body !== "object" || !("code" in body) || body.code !== "EXISTING_FUTURE_ADDENDUM") return null;
    return futureAddendumMessage(futureAddendumReference("existing" in body ? body.existing : null));
}
function addendumPairError(fields: CalendarFields, options: readonly CalendarLookupItem[]): string | null {
    const orders = fields.links.filter((link) => link.entityType === "sales_order");
    const leads = fields.links.filter((link) => link.entityType === "lead");
    const order = orders[0];
    if (orders.length !== 1 || !order) return "El evento Adéndum debe vincular exactamente una orden de venta.";
    if (leads.length !== 1) return "El Adéndum debe vincular únicamente el cliente de la orden seleccionada.";
    const owner = options.find((option) => option.source === order.source && option.id === order.id)?.lead;
    if (!owner) return null;
    return leads.some((lead) => lead.source === owner.source && lead.id === owner.id) ? null : "El cliente vinculado no corresponde a la orden del Adéndum.";
}
function addendumOrderRequirement(fields: CalendarFields, calendar: CalendarDescriptor, linksEditable: boolean, options: readonly CalendarLookupItem[]) {
    const requiresOrder = calendar.moduleCode === "formalizacion" && calendar.types.some((type) => type.id === fields.typeId && type.code === "adendum");
    return { requiresOrder, orderError: requiresOrder && linksEditable ? addendumPairError(fields, options) : null };
}
/** Keeps the original version and retry key. Unknown writes freeze the draft until the same operation is retried. */
export function useCalendarEventForm(event: CalendarEvent | null, calendar: CalendarDescriptor, date: string, { onSaved, orderContext, range }: { readonly onSaved: () => void; readonly orderContext?: CalendarOrderContext | undefined; readonly range?: { readonly start: string; readonly end: string } | undefined }) {
    const context = event ? undefined : orderContext;
    const [fields, setFields] = useState(() => initialFields(event, date, context, range));
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<{ stale: boolean; uncertain: boolean; message: string } | null>(null);
    const operation = useRef<string | null>(null);
    const pending = useRef(false);
    const [orderOptions, setOrderOptions] = useState<readonly CalendarLookupItem[]>(event?.selectionOptions?.orders ?? []);
    const [leadOptions, setLeadOptions] = useState<CalendarLookupItem[]>([]);
    const [confirmedId, setConfirmedId] = useState<string | null>(null);
    const [receipt, setReceipt] = useState<CalendarDelivery | null>(null);
    const linksEditable = event?.linksEditable !== false;
    const orderRequirement = addendumOrderRequirement(fields, calendar, linksEditable, orderOptions);
    const requiresAddendumReason = [orderRequirement.requiresOrder, event?.typeCode !== "adendum"].every(Boolean);
    const fixedLinks = fixedOrderLinks(event, context);
    const addendumConflict = useAddendumConflict([orderRequirement.requiresOrder, linksEditable, orderRequirement.orderError === null].every(Boolean), fields.links, event?.id);
    const validationMessage = [orderRequirement.orderError, addendumConflict.message].find(Boolean);
    const change = <K extends keyof CalendarFields>(key: K, value: CalendarFields[K]) => {
        // Un resultado incierto solo admite reintentar la misma operación, incluso desde sugerencias externas.
        if (pending.current || failure?.stale || failure?.uncertain || receipt) return;
        // Desde una orden, sus relaciones no pueden sustituirse ni quitarse; las notas siguen siendo editables.
        setFields((previous) => ({ ...previous, [key]: value, ...(key === "links" && fixedLinks ? { links: [...fixedLinks, ...(value as CalendarLink[]).filter((link) => link.entityType === "note")] } : {}) }));
        operation.current = null;
        setFailure(null);
    };
    const changeAllDay = (checked: boolean) => {
        change("allDay", checked);
        if (checked && fields.end.slice(0, 10) <= fields.start.slice(0, 10)) change("end", `${calendarNextDay(fields.start.slice(0, 10))}T00:00`);
    };
    // El guardado conserva una sola secuencia para validar, congelar y reintentar la operación incierta.
    // eslint-disable-next-line complexity
    const save = async () => {
        if (pending.current || failure?.stale || receipt) return;
        operation.current ??= crypto.randomUUID();
        let command: CalendarEventCommand;
        try {
            if (validationMessage) throw new Error(validationMessage);
            if ([requiresAddendumReason, [fields.description.trim().length < 3, fields.description.trim().length > 2000].some(Boolean)].every(Boolean)) throw new Error("El motivo del adéndum debe tener entre 3 y 2000 caracteres.");
            command = commandBody(fields, calendar.moduleCode, operation.current);
            if (event?.outlookVersion) command = { ...command, expectedOutlookVersion: event.outlookVersion };
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
            const saved = await saveCalendarEvent(command, event ? { id: event.id, expectedVersion: event.version } : undefined);
            if (pendingDelivery(command, saved)) {
                setConfirmedId(saved.id);
                setFailure(deliveryFailure(saved));
                return;
            }
            if (saved.delivery?.status === "synced") {
                setConfirmedId(saved.id);
                setReceipt(saved.delivery);
                return;
            }
            onSaved();
        } catch (error) {
            setFailure(writeFailure(error));
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };
    const addUsers = useCallback((ids: readonly string[]) => {
        setFields((previous) => ({ ...previous, userIds: [...new Set([...previous.userIds, ...ids])] }));
    }, []);
    /** Solo usa la consulta completa del lead; un resultado filtrado nunca decide la orden. */
    const autoSelectOnlyOrder = useCallback((order: CalendarLookupItem, lead: CalendarLink) => {
        if (pending.current || order.lead?.source !== lead.source || order.lead.id !== lead.id) return;
        operation.current = null;
        setOrderOptions((previous) => [...previous.filter((item) => item.id !== order.id || item.source !== order.source), order]);
        setFields((previous) => {
            const leads = previous.links.filter((link) => link.entityType === "lead");
            if (leads.length !== 1 || !leads.some((item) => item.source === lead.source && item.id === lead.id) || previous.links.some((link) => link.entityType === "sales_order")) return previous;
            return { ...previous, links: [...previous.links, { entityType: "sales_order", source: order.source, id: order.id }] };
        });
    }, []);
    return {
        autoSelectOnlyOrder,
        addUsers,
        addendumConflict,
        ...orderRequirement,
        requiresAddendumReason,
        receipt,
        orderOptions,
        rememberOrder: (order: CalendarLookupItem) => {
            setOrderOptions((previous) => [...previous.filter((item) => item.id !== order.id || item.source !== order.source), order]);
        },
        leadOptions,
        rememberLead: (lead: CalendarLookupItem) => {
            setLeadOptions((previous) => [...previous.filter((item) => item.id !== lead.id || item.source !== lead.source), lead]);
        },
        confirmedId,
        finishCrmOnly: onSaved,
        initialSelectionOptions: selectionOptions(event, context),
        orderContextLocked: fixedLinks !== null,
        linksEditable,
        fields,
        change,
        changeAllDay,
        busy,
        failure,
        save,
        pending,
    };
}
