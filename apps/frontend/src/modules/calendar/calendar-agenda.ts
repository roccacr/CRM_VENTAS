import type { CalendarEvent } from "../../services/calendar/calendar-service";
import { calendarNextDay, utcToLocal } from "./calendar-time";

export interface AgendaStats {
    readonly today: number;
    readonly week: number;
    readonly total: number;
    readonly calendars: number;
}

const localDay = (event: CalendarEvent) => utcToLocal(event.start).slice(0, 10);
const active = (event: CalendarEvent) => event.status !== "cancelled";

/** Conteos de la franja de resumen, siempre sobre los eventos ya cargados. Aquí no se consulta nada. */
export function agendaStats(events: readonly CalendarEvent[], today: string, calendars: number): AgendaStats {
    let weekEnd = today;
    for (let day = 0; day < 7; day += 1) weekEnd = calendarNextDay(weekEnd);
    const live = events.filter(active);
    return {
        today: live.filter((event) => localDay(event) === today).length,
        week: live.filter((event) => localDay(event) >= today && localDay(event) < weekEnd).length,
        total: live.length,
        calendars,
    };
}

/** Los próximos eventos desde hoy, el más cercano primero, para la agenda lateral. */
export function upcomingEvents(events: readonly CalendarEvent[], today: string, limit: number): readonly CalendarEvent[] {
    return events
        .filter((event) => event.status === "scheduled" && localDay(event) >= today)
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, limit);
}

const dayFormat = new Intl.DateTimeFormat("es-CR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const hourFormat = new Intl.DateTimeFormat("es-CR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

/** "mié, 29 oct" and "14:30" read from the Costa Rica wall time, or "Todo el día". */
export function agendaWhen(event: CalendarEvent, today: string): { readonly day: string; readonly hour: string } {
    const local = utcToLocal(event.start);
    const stamp = new Date(`${local.slice(0, 19)}Z`);
    const day = localDay(event) === today ? "Hoy" : dayFormat.format(stamp).replace(".", "");
    return { day, hour: event.allDay ? "Todo el día" : hourFormat.format(stamp) };
}
