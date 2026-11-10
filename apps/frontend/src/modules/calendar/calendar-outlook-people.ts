import type { OutlookAttendee, OutlookEventDetail, OutlookPerson, OutlookResponse } from "../../services/calendar/calendar-service";

export const KIND_LABEL: Record<OutlookAttendee["kind"], string> = { required: "Obligatorio", optional: "Opcional", resource: "Recurso" };
export const RESPONSE_LABEL: Record<OutlookResponse, string> = { accepted: "Aceptado", declined: "Rechazado", tentativelyAccepted: "Provisional", notResponded: "Sin respuesta", organizer: "Organizador", none: "Sin respuesta" };
const GROUPS: readonly { readonly key: "accepted" | "tentative" | "declined" | "pending"; readonly label: string }[] = [
    { key: "accepted", label: "Aceptado" },
    { key: "tentative", label: "Provisional" },
    { key: "declined", label: "Rechazado" },
    { key: "pending", label: "Sin respuesta" },
];

function groupOf(response: OutlookResponse): (typeof GROUPS)[number]["key"] {
    if (response === "accepted" || response === "organizer") return "accepted";
    if (response === "tentativelyAccepted") return "tentative";
    return response === "declined" ? "declined" : "pending";
}
const sameEmail = (a: OutlookPerson | null, b: OutlookPerson) => Boolean(a?.email && b.email && a.email.toLowerCase() === b.email.toLowerCase());
/** Asistentes sin el organizador, que se muestra aparte. Outlook los lista en los dos lugares. */
export const invitees = (detail: OutlookEventDetail): readonly OutlookAttendee[] => detail.attendees.filter((attendee) => !sameEmail(detail.organizer, attendee));
/** La lista de invitación muestra personas. Las salas y el equipo no cuentan como quien respondió. */
const people = (detail: OutlookEventDetail) => invitees(detail).filter((attendee) => attendee.kind !== "resource");

/** Asistentes agrupados como el panel Seguimiento de Outlook. Un grupo vacío no se muestra. */
export function groupAttendees(attendees: readonly OutlookAttendee[]) {
    return GROUPS.map((group) => ({ ...group, items: attendees.filter((attendee) => groupOf(attendee.response) === group.key) })).filter((group) => group.items.length > 0);
}
/** "2 de 4 han aceptado", or null when nobody was invited. */
export function acceptedSummary(detail: OutlookEventDetail): string | null {
    const invited = people(detail);
    if (invited.length === 0) return null;
    const accepted = invited.filter((attendee) => groupOf(attendee.response) === "accepted").length;
    return `${String(accepted)} de ${String(invited.length)} han aceptado`;
}
export const displayName = (person: OutlookPerson): string => person.name?.trim() || person.email || "Sin nombre";
/** Dos letras para el avatar: la primera y la segunda palabra del nombre, o del correo si no hay nombre. */
export function initials(person: OutlookPerson): string {
    const parts = displayName(person)
        .split(/[\s@.]+/)
        .filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[1]?.[0] ?? "") : "")).toUpperCase() || "?";
}
/** "Ana, Luis, Rosa y 2 más": the first names, then how many remain. */
export function whoLine(detail: OutlookEventDetail, shown = 3): string {
    const names = [...(detail.organizer ? [detail.organizer] : []), ...people(detail)].map(displayName);
    const unique = [...new Set(names)];
    if (unique.length <= shown) return unique.join(", ");
    return `${unique.slice(0, shown).join(", ")} y ${String(unique.length - shown)} más`;
}
/** La línea de quiénes para la tarjeta rápida: nombres y, si hay invitados, cuántos aceptaron. */
export function peopleLine(detail: OutlookEventDetail | undefined, shown = 2): string {
    if (!detail) return "";
    const names = whoLine(detail, shown);
    const accepted = acceptedSummary(detail);
    return names && accepted ? `${names}, ${accepted}` : names;
}
