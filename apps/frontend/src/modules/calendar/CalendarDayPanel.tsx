import type { CalendarDescriptor, CalendarEvent } from "../../services/calendar/calendar-service";
import { utcToLocal } from "./calendar-time";

const HOUR_HEIGHT = 44;
const FIRST_HOUR = 7;
const LAST_HOUR = 22;
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, index) => FIRST_HOUR + index);
const dayFormat = new Intl.DateTimeFormat("es-CR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const minutesOf = (local: string) => Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
const dayTitle = (day: string) => {
    const text = dayFormat.format(new Date(`${day}T00:00:00Z`));
    return text.charAt(0).toUpperCase() + text.slice(1);
};
/** Position inside the 07:00-22:00 window; null when the slot lies entirely outside it. */
const place = (from: number, to: number) => {
    const first = Math.max(from, FIRST_HOUR * 60);
    const last = Math.min(to, LAST_HOUR * 60);
    return last > first ? { top: ((first - FIRST_HOUR * 60) / 60) * HOUR_HEIGHT, height: Math.max(((last - first) / 60) * HOUR_HEIGHT, 20) } : null;
};

interface Props {
    readonly events: readonly CalendarEvent[];
    readonly calendars: readonly CalendarDescriptor[];
    readonly start: string;
    readonly end: string;
    readonly allDay: boolean;
    readonly selfKey: string | null;
}
interface Block {
    readonly key: string;
    readonly label: string;
    readonly color: string;
    readonly top: number;
    readonly height: number;
}

function dayBlocks({ events, calendars, selfKey }: Props, day: string): { readonly timed: readonly Block[]; readonly allDay: readonly CalendarEvent[] } {
    const sameDay = events.filter((event) => event.status !== "cancelled" && `${event.source}:${event.id}` !== selfKey && utcToLocal(event.start).slice(0, 10) === day);
    const timed = sameDay
        .filter((event) => !event.allDay)
        .flatMap((event) => {
            const endLocal = utcToLocal(event.end);
            const to = endLocal.slice(0, 10) === day ? minutesOf(endLocal) : 1440;
            const spot = place(minutesOf(utcToLocal(event.start)), to);
            return spot ? [{ key: `${event.source}:${event.id}`, label: event.title, color: calendars.find((calendar) => calendar.moduleCode === event.originModule)?.color ?? "#303c4e", ...spot }] : [];
        });
    return { timed, allDay: sameDay.filter((event) => event.allDay) };
}

/** Outlook-style day beside the form, 07:00 to 22:00: what is already booked that day and where the event being edited lands. Read-only; it never writes. */
export function CalendarDayPanel(props: Props) {
    const day = props.start.slice(0, 10);
    const { timed, allDay } = dayBlocks(props, day);
    const draft = props.allDay ? null : place(minutesOf(props.start), props.end.slice(0, 10) === day ? minutesOf(props.end) : 1440);
    return (
        <aside className="shared-calendar-editor__detail" aria-labelledby="calendar-event-detail-title">
            <header className="calendar-day__head">
                <h1 id="calendar-event-detail-title">Detalle del evento</h1>
                <span>{dayTitle(day)}</span>
            </header>
            {allDay.length > 0 && (
                <ul className="calendar-day__allday" aria-label="Todo el día">
                    {allDay.map((event) => (
                        <li key={`${event.source}:${event.id}`}>{event.title}</li>
                    ))}
                </ul>
            )}
            <div className="calendar-day__scroll">
                <div className="calendar-day__grid" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_HEIGHT }}>
                    {HOURS.map((hour) => (
                        <div key={hour} className="calendar-day__hour" style={{ top: (hour - FIRST_HOUR) * HOUR_HEIGHT, height: 0 }}>
                            <span>{String(hour).padStart(2, "0")}:00</span>
                        </div>
                    ))}
                    {timed.map((block) => (
                        <div key={block.key} className="calendar-day__event" style={{ top: block.top, height: block.height, borderLeftColor: block.color }} title={block.label}>
                            {block.label}
                        </div>
                    ))}
                    {!draft && !props.allDay && <p className="calendar-day__outside">Este horario queda fuera de la franja mostrada (07:00 a 22:00).</p>}
                    {draft && (
                        <div className="calendar-day__draft" style={{ top: draft.top, height: draft.height }} aria-label="Horario de este evento">
                            {props.start.slice(11, 16)} – {props.end.slice(11, 16)}
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
