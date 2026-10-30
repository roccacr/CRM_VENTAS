import type { CalendarDescriptor, CalendarEvent, CalendarModule } from "../../services/calendar/calendar-service";
import { agendaWhen, upcomingEvents } from "./calendar-agenda";
import { MiniMonth } from "./MiniMonth";

interface Props {
    readonly calendars: readonly CalendarDescriptor[];
    readonly selected: readonly CalendarModule[];
    readonly events: readonly CalendarEvent[];
    readonly focus: string;
    readonly today: string;
    readonly onToggle: (code: CalendarModule) => void;
    readonly onPick: (date: string) => void;
}

const colorOf = (calendars: readonly CalendarDescriptor[], event: CalendarEvent) => calendars.find((calendar) => calendar.moduleCode === event.originModule)?.color ?? "#303c4e";
const style = (color: string) => ({ "--calendar-color": color }) as React.CSSProperties;

function MyCalendars({ calendars, selected, events, onToggle }: Pick<Props, "calendars" | "selected" | "events" | "onToggle">) {
    return (
        <section className="calendar-card">
            <h2 className="calendar-card__head">Mis calendarios</h2>
            <fieldset className="calendar-sidebar__list">
                <legend className="calendar-sidebar__legend">Calendarios superpuestos</legend>
                {calendars.map((calendar) => (
                    <label key={calendar.moduleCode} style={style(calendar.color)}>
                        <input
                            type="checkbox"
                            checked={selected.includes(calendar.moduleCode)}
                            onChange={() => {
                                onToggle(calendar.moduleCode);
                            }}
                        />
                        <span>{calendar.label}</span>
                        <em aria-hidden="true">{events.filter((event) => event.originModule === calendar.moduleCode && event.status !== "cancelled").length}</em>
                    </label>
                ))}
                <p>Ver otro calendario no da permiso para editar sus eventos.</p>
            </fieldset>
        </section>
    );
}

function Upcoming({ calendars, events, today }: Pick<Props, "calendars" | "events" | "today">) {
    const next = upcomingEvents(events, today, 5);
    return (
        <section className="calendar-card">
            <h2 className="calendar-card__head">Próximos eventos</h2>
            {next.length === 0 ? (
                <p className="calendar-upcoming__empty">Sin eventos próximos en el período cargado.</p>
            ) : (
                <ol className="calendar-upcoming">
                    {next.map((event) => {
                        const when = agendaWhen(event, today);
                        return (
                            <li key={`${event.source}:${event.id}`} style={style(colorOf(calendars, event))}>
                                <strong>{event.title}</strong>
                                <span>
                                    {when.day} · {when.hour}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

/** Left column, as in Outlook: a small month to jump by date, "Mis calendarios" (the authorized calendars drawn on top of each other, one colour each) and what comes next. */
export function CalendarSidebar({ calendars, selected, events, focus, today, onToggle, onPick }: Props) {
    return (
        <aside className="calendar-sidebar" aria-label="Navegación del calendario">
            <section className="calendar-card">
                <h2 className="calendar-card__head">Navegar</h2>
                <MiniMonth focus={focus} today={today} onPick={onPick} />
            </section>
            <MyCalendars calendars={calendars} selected={selected} events={events} onToggle={onToggle} />
            <Upcoming calendars={calendars} events={events} today={today} />
        </aside>
    );
}
