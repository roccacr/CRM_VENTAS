import type { CalendarDescriptor, CalendarEvent, CalendarModule } from "../../services/calendar/calendar-service";
import { agendaWhen, upcomingEvents } from "./calendar-agenda";
import { calendarEventColors, type TypeFilter } from "./calendar-view-tools";

interface Props {
    readonly calendars: readonly CalendarDescriptor[];
    readonly selected: readonly CalendarModule[];
    readonly events: readonly CalendarEvent[];
    readonly today: string;
    readonly onToggle: (code: CalendarModule) => void;
    readonly types: readonly TypeFilter[];
    readonly hiddenTypes: ReadonlySet<string>;
    readonly showOutlook: boolean;
    readonly onToggleType: (code: string) => void;
    readonly onToggleOutlook: () => void;
}

const OUTLOOK_COLOR = "#0369A1";
const style = (color: string) => ({ "--calendar-color": color }) as React.CSSProperties;

function MyCalendars({ calendars, selected, events, onToggle, showOutlook, onToggleOutlook }: Pick<Props, "calendars" | "selected" | "events" | "onToggle" | "showOutlook" | "onToggleOutlook">) {
    const outlookCount = events.filter((event) => event.source === "outlook" && event.status !== "cancelled").length;
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
                {(outlookCount > 0 || !showOutlook) && (
                    <label style={style(OUTLOOK_COLOR)}>
                        <input type="checkbox" checked={showOutlook} onChange={onToggleOutlook} />
                        <span>Outlook</span>
                        <em aria-hidden="true">{outlookCount}</em>
                    </label>
                )}
                <p>Ver otro calendario no da permiso para editar sus eventos.</p>
            </fieldset>
        </section>
    );
}

/** Event types, filtered together across calendars; unchecking one only hides it from view. */
function TypeList({ types, hiddenTypes, onToggleType }: Pick<Props, "types" | "hiddenTypes" | "onToggleType">) {
    if (types.length < 2) return null;
    return (
        <section className="calendar-card">
            <h2 className="calendar-card__head">Tipos de evento</h2>
            <p className="calendar-color-key">Franja izquierda: módulo · derecha: tipo.</p>
            <fieldset className="calendar-sidebar__list">
                <legend className="calendar-sidebar__legend">Tipos de evento visibles</legend>
                {types.map((type) => (
                    <label key={type.code} style={style(type.color)}>
                        <input
                            type="checkbox"
                            checked={!hiddenTypes.has(type.code)}
                            onChange={() => {
                                onToggleType(type.code);
                            }}
                        />
                        <span>{type.label}</span>
                    </label>
                ))}
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
                        const colors = calendarEventColors(event, calendars);
                        return (
                            <li key={`${event.source}:${event.id}`} style={{ ...style(colors.moduleColor), borderRight: `4px solid ${colors.typeColor}` }} title={`${colors.moduleLabel} · ${colors.typeLabel}`}>
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

/** Left column, as in Outlook: "Mis calendarios" (the authorized calendars drawn on top of each other, one colour each) and what comes next. */
export function CalendarSidebar({ calendars, selected, events, today, onToggle, types, hiddenTypes, showOutlook, onToggleType, onToggleOutlook }: Props) {
    return (
        <aside className="calendar-sidebar" aria-label="Navegación del calendario">
            <MyCalendars calendars={calendars} selected={selected} events={events} onToggle={onToggle} showOutlook={showOutlook} onToggleOutlook={onToggleOutlook} />
            <TypeList types={types} hiddenTypes={hiddenTypes} onToggleType={onToggleType} />
            <Upcoming calendars={calendars} events={events} today={today} />
        </aside>
    );
}
