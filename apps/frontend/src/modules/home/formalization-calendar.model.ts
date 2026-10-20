export interface FormalizationCalendarEvent {
    readonly history?: readonly { readonly at: string; readonly actor: string; readonly detail: string }[];
    readonly id: string;
    readonly title: string;
    readonly kind: "meeting" | "task";
    readonly date: string;
    readonly start: string;
    readonly end: string;
    readonly orderId: string;
    readonly owner: string;
    readonly participants: string;
    readonly location: string;
    readonly notes: string;
    readonly status: "scheduled" | "completed" | "cancelled";
}

/** Conserva el antes/después completo del evento en la sesión visual. */
export function recordCalendarChange(event: FormalizationCalendarEvent, previous: FormalizationCalendarEvent | undefined, at: string): FormalizationCalendarEvent {
    const before = previous ? calendarEventSummary(previous) : "Sin evento";
    const after = calendarEventSummary(event);
    return { ...event, history: [{ at, actor: "Usuario de demostración", detail: `${previous ? "Evento actualizado" : "Evento creado"} · ${event.orderId} · Antes: ${before} · Después: ${after}` }, ...(previous?.history ?? [])] };
}

function calendarEventSummary(event: FormalizationCalendarEvent): string {
    return `${event.title} · ${EVENT_KIND_LABELS[event.kind]} · ${event.orderId} · ${event.owner} · ${event.date} ${event.start}–${event.end} · ${EVENT_STATUS_LABELS[event.status]} · Participantes: ${event.participants} · Lugar: ${event.location} · Notas: ${event.notes}`;
}

export const EVENT_STATUS_LABELS = { scheduled: "Programado", completed: "Completado", cancelled: "Cancelado" } as const;
export const EVENT_KIND_LABELS = { meeting: "Reunión", task: "Tarea" } as const;
export const calendarDateKey = (date: Date): string => [String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
export const calendarDateLabel = (date: string): string => new Intl.DateTimeFormat("es-CR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));

/** Valores iniciales locales; todavía sin orden seleccionada. */
export function newCalendarEvent(date: string): FormalizationCalendarEvent {
    return { id: "", title: "", kind: "meeting", date, start: "09:00", end: "09:30", orderId: "", owner: "Gestor de ejemplo 1", participants: "", location: "", notes: "", status: "scheduled" };
}

/** Eventos ficticios relativos al día del dispositivo; no representan operaciones reales. */
export function initialCalendarEvents(today: string): readonly FormalizationCalendarEvent[] {
    const tomorrow = new Date(`${today}T12:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const base = newCalendarEvent(today);
    return [
        { ...base, id: "demo-calendar-1", title: "Seguimiento bancario", orderId: "DEMO-OV-103", participants: "Asesor bancario de ejemplo", location: "Llamada de ejemplo", notes: "Revisar el avance del crédito y definir el siguiente seguimiento." },
        { ...base, id: "demo-calendar-2", title: "Revisar contrato firmado", kind: "task", start: "11:00", end: "11:30", orderId: "DEMO-OV-102", owner: "Gestor de ejemplo 2", notes: "Comprobar la referencia documental de la orden." },
        { ...base, id: "demo-calendar-3", title: "Coordinar traspaso", date: calendarDateKey(tomorrow), start: "14:00", end: "15:00", orderId: "DEMO-OV-105", location: "Reunión de ejemplo", notes: "Confirmar documentación y coordinación del traspaso." },
    ];
}

/** Impide ejemplos incompletos y horarios invertidos antes de actualizar React. */
export function validateCalendarEvent(event: FormalizationCalendarEvent): void {
    if (!event.title.trim() || !event.orderId || !event.owner.trim()) throw new Error("Completa título, orden y responsable.");
    if (!event.date || !event.start || !event.end) throw new Error("Completa la fecha y el horario.");
    if (event.end <= event.start) throw new Error("La hora de fin debe ser posterior al inicio.");
}
