import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import ClockCircleOutlined from "@ant-design/icons/ClockCircleOutlined";
import WarningOutlined from "@ant-design/icons/WarningOutlined";
import { useState } from "react";

import type { OutlookAvailability, OutlookSlot } from "../../services/calendar/calendar-service";
import type { CalendarDescriptor, CalendarEvent } from "../../services/calendar/calendar-service";
import { calendarNextDay, utcToLocal } from "./calendar-time";
import { calendarEventColors } from "./calendar-view-tools";
import { arrange, overlaps, type Placed } from "./day-layout";

const HOUR_HEIGHT = 44;
const FIRST_HOUR = 0;
const LAST_HOUR = 24;
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, index) => FIRST_HOUR + index);
const dayFormat = new Intl.DateTimeFormat("es-CR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const minutesOf = (local: string) => Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const dayTitle = (day: string) => {
    const text = dayFormat.format(new Date(`${day}T00:00:00Z`));
    return text.charAt(0).toUpperCase() + text.slice(1);
};
/** Position inside the 00:00-24:00 window; null when the slot lies entirely outside it. */
const place = (from: number, to: number) => {
    const first = Math.max(from, FIRST_HOUR * 60);
    const last = Math.min(to, LAST_HOUR * 60);
    return last > first ? { from: first, to: last, top: ((first - FIRST_HOUR * 60) / 60) * HOUR_HEIGHT, height: Math.max(((last - first) / 60) * HOUR_HEIGHT, 20) } : null;
};

interface Props {
    readonly events: readonly CalendarEvent[];
    readonly calendars: readonly CalendarDescriptor[];
    readonly start: string;
    readonly end: string;
    readonly allDay: boolean;
    readonly selfKey: string | null;
    readonly suggestionsDisabled?: boolean;
    readonly outlook?: OutlookAvailability | undefined;
    readonly onSuggest?: ((slot: OutlookSlot) => void) | undefined;
}
interface Block {
    readonly key: string;
    readonly label: string;
    readonly color: string;
    readonly typeColor?: string;
    readonly from: number;
    readonly to: number;
    readonly top: number;
    readonly height: number;
}

function dayBlocks({ events, calendars, selfKey }: Props, day: string): { readonly timed: Block[]; readonly allDay: readonly CalendarEvent[] } {
    const sameDay = events.filter((event) => event.status !== "cancelled" && `${event.source}:${event.id}` !== selfKey && isOnDay(event, day));
    const timed = sameDay
        .filter((event) => !event.allDay)
        .flatMap((event) => {
            const endLocal = utcToLocal(event.end);
            const to = endLocal.slice(0, 10) === day ? minutesOf(endLocal) : 1440;
            const spot = place(utcToLocal(event.start).slice(0, 10) < day ? 0 : minutesOf(utcToLocal(event.start)), to);
            const colors = calendarEventColors(event, calendars);
            return spot ? [{ key: `${event.source}:${event.id}`, label: event.title, color: colors.moduleColor, typeColor: colors.typeColor, ...spot }] : [];
        });
    return { timed, allDay: sameDay.filter((event) => event.allDay) };
}
function externalBlocks(value: OutlookAvailability | undefined, day: string): Block[] {
    return (value?.events ?? [])
        .filter((event) => !event.allDay)
        .flatMap((event) => {
            const start = utcToLocal(event.start),
                end = utcToLocal(event.end);
            if (!isOnDay(event, day)) return [];
            const spot = place(start.slice(0, 10) < day ? 0 : minutesOf(start), end.slice(0, 10) > day ? 1440 : minutesOf(end));
            return spot ? [{ key: `outlook:${event.id}`, label: `Outlook · ${event.title}`, color: "#0369A1", ...spot }] : [];
        });
}

/** One column slot of the day: the width and left edge come from how many events share its time. */
function columnStyle<T extends { readonly top: number; readonly height: number }>(placed: Placed<T & { readonly from: number; readonly to: number }>) {
    const width = `calc((100% - 12px) / ${String(placed.lanes)})`;
    return { top: placed.item.top, height: placed.item.height, width, left: `calc(6px + ${width} * ${String(placed.lane)})`, right: "auto" } as const;
}

interface DayModel {
    readonly day: string;
    readonly allDay: readonly CalendarEvent[];
    readonly outlook: OutlookAvailability | undefined;
    readonly draft: ReturnType<typeof place>;
    readonly clashing: readonly Block[];
    readonly items: ReturnType<typeof arrange<Block & { readonly kind: "event" | "draft" }>>;
}
/** Everything the day grid draws: the loaded events, Outlook's busy times, the event being edited and which of them collide with it. */
function buildDay(props: Props): DayModel {
    const day = props.start.slice(0, 10);
    const { timed, allDay } = dayBlocks(props, day);
    const loadedRemoteIds = new Set(props.events.flatMap((event) => (event.outlookId ? [event.outlookId] : [])));
    const outlook = props.outlook ? { ...props.outlook, events: props.outlook.events.filter((event) => !loadedRemoteIds.has(event.id)) } : undefined;
    timed.push(...externalBlocks(outlook, day));
    const draft = props.allDay ? null : place(minutesOf(props.start), props.end.slice(0, 10) === day ? minutesOf(props.end) : 1440);
    const clashing = draft ? timed.filter((block) => overlaps(block, draft)) : [];
    const draftBlock = draft ? [{ ...draft, key: "draft", label: "", color: "", kind: "draft" as const }] : [];
    return { day, allDay, outlook, draft, clashing, items: arrange([...timed.map((block) => ({ ...block, kind: "event" as const })), ...draftBlock]) };
}
function DayItem({ placed, clashKeys, clashing, start, end }: { readonly placed: DayModel["items"][number]; readonly clashKeys: ReadonlySet<string>; readonly clashing: readonly Block[]; readonly start: string; readonly end: string }) {
    const { item } = placed;
    if (item.kind === "draft") {
        const title = clashing.length > 0 ? `Se cruza con ${clashing.map((block) => block.label).join(", ")}` : undefined;
        return (
            <div className="calendar-day__draft" data-conflict={clashing.length > 0} style={columnStyle(placed)} aria-label="Horario de este evento" title={title}>
                {start.slice(11, 16)} – {end.slice(11, 16)}
            </div>
        );
    }
    const clash = clashKeys.has(item.key);
    return (
        <div className="calendar-day__event" data-conflict={clash} style={{ ...columnStyle(placed), borderLeftColor: clash ? undefined : item.color, borderRight: `4px solid ${item.typeColor ?? item.color}` }} title={item.label}>
            {item.label}
        </div>
    );
}

/** Outlook-style day beside the form, 00:00 to 24:00: what is already booked that day and where the event being edited lands. Overlaps share the width and turn red on both sides. Read-only; it never writes. */
export function CalendarDayPanel(props: Props) {
    const { day, allDay, outlook, draft, clashing, items } = buildDay(props);
    const clashKeys = new Set(clashing.map((block) => block.key));
    return (
        <aside className="shared-calendar-editor__detail" aria-labelledby="calendar-event-detail-title">
            <header className="calendar-day__head">
                <h1 id="calendar-event-detail-title">Detalle del evento</h1>
                <span>{dayTitle(day)}</span>
            </header>
            <ConflictNotice clashing={clashing} external={outlook?.conflicts ?? []} />
            <AvailabilitySummary value={outlook} day={day} onSuggest={props.onSuggest} disabled={props.suggestionsDisabled === true} />
            {allDay.length > 0 && (
                <ul className="calendar-day__allday" aria-label="Todo el día">
                    {allDay.map((event) => {
                        const colors = calendarEventColors(event, props.calendars);
                        return (
                            <li key={`${event.source}:${event.id}`} style={{ borderLeft: `4px solid ${colors.moduleColor}`, borderRight: `4px solid ${colors.typeColor}` }} title={`${colors.moduleLabel} · ${colors.typeLabel}`}>
                                {event.title}
                            </li>
                        );
                    })}
                </ul>
            )}
            <div className="calendar-day__scroll">
                <div className="calendar-day__grid" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_HEIGHT }}>
                    {HOURS.map((hour) => (
                        <div key={hour} className="calendar-day__hour" style={{ top: (hour - FIRST_HOUR) * HOUR_HEIGHT, height: 0 }}>
                            <span>{String(hour).padStart(2, "0")}:00</span>
                        </div>
                    ))}
                    {items.map((placed) => (
                        <DayItem key={placed.item.key} placed={placed} clashKeys={clashKeys} clashing={clashing} start={props.start} end={props.end} />
                    ))}
                    {!draft && !props.allDay && <p className="calendar-day__outside">Este horario queda fuera de la franja mostrada (00:00 a 24:00).</p>}
                </div>
            </div>
        </aside>
    );
}

const VISIBLE_SUGGESTIONS = 4;
const SHORT_DAY = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", timeZone: "UTC" });
/** "10:00 – 11:00", with the day in front only when the slot is not on the day being edited. */
function slotLabel(slot: OutlookSlot, day: string): string {
    const start = utcToLocal(slot.start);
    const times = `${start.slice(11, 16)} – ${utcToLocal(slot.end).slice(11, 16)}`;
    return start.slice(0, 10) === day ? times : `${SHORT_DAY.format(new Date(`${start.slice(0, 10)}T00:00:00Z`)).replace(".", "")} · ${times}`;
}
/**
 * Free times Outlook proposes, as compact green chips two per row. Only the first few show; the rest sit behind one button,
 * so a long list never pushes the day grid out of sight.
 */
function Suggestions({ slots, day, disabled, onSuggest }: { readonly slots: readonly OutlookSlot[]; readonly day: string; readonly disabled: boolean; readonly onSuggest: ((slot: OutlookSlot) => void) | undefined }) {
    const [expanded, setExpanded] = useState(false);
    const shown = expanded ? slots : slots.slice(0, VISIBLE_SUGGESTIONS);
    const hidden = slots.length - VISIBLE_SUGGESTIONS;
    return (
        <div className="calendar-suggestions">
            <h2>
                <CheckCircleOutlined aria-hidden="true" /> Horarios libres sugeridos <em>{slots.length}</em>
            </h2>
            <div className="calendar-suggestions__list" data-expanded={expanded}>
                {shown.map((slot) => (
                    <button type="button" className="calendar-suggestion" key={slot.start} disabled={disabled} aria-label={`Usar el horario ${slotLabel(slot, day)}`} onClick={() => onSuggest?.(slot)}>
                        <ClockCircleOutlined aria-hidden="true" />
                        {slotLabel(slot, day)}
                    </button>
                ))}
            </div>
            {hidden > 0 && (
                <button
                    type="button"
                    className="calendar-suggestions__more"
                    aria-expanded={expanded}
                    onClick={() => {
                        setExpanded((value) => !value);
                    }}
                >
                    {expanded ? "Ver menos" : `Ver ${String(hidden)} más`}
                </button>
            )}
        </div>
    );
}
function AvailabilitySummary({ value, day, onSuggest, disabled }: { readonly disabled: boolean; readonly day: string; readonly value: OutlookAvailability | undefined; readonly onSuggest: ((slot: OutlookSlot) => void) | undefined }) {
    if (!value || !(value.suggestions.length || value.events.some((event) => event.allDay))) return null;
    return (
        <section className="calendar-availability" aria-label="Disponibilidad de Outlook">
            {value.events
                .filter((event) => event.allDay)
                .map((event) => (
                    <p key={event.id}>Todo el día · {event.title}</p>
                ))}
            {value.suggestions.length > 0 && <Suggestions slots={value.suggestions} day={day} disabled={disabled} onSuggest={onSuggest} />}
        </section>
    );
}
/** Names what the new time lands on. Events already drawn on the grid are listed first; Outlook's own conflicts cover the ones outside the loaded view. */
function ConflictNotice({ clashing, external }: { readonly clashing: readonly Block[]; readonly external: OutlookAvailability["conflicts"] }) {
    const rows = clashing.length ? clashing.map((block) => ({ key: block.key, label: block.label, when: `${clock(block.from)} – ${clock(block.to)}` })) : external.map((event, index) => ({ key: String(index), label: event.label, when: `${utcToLocal(event.start).slice(11, 16)} – ${utcToLocal(event.end).slice(11, 16)}` }));
    if (rows.length === 0) return null;
    return (
        <section className="calendar-conflict" role="alert">
            <p className="calendar-conflict__title">
                <WarningOutlined aria-hidden="true" /> Se cruza con {rows.length} {rows.length === 1 ? "evento" : "eventos"}
            </p>
            <ul>
                {rows.map((row) => (
                    <li key={row.key}>
                        <strong>{row.label}</strong>
                        <span>{row.when}</span>
                    </li>
                ))}
            </ul>
            <small>El horario coincide con otros eventos. Puedes guardar de todos modos. El evento nuevo y los que se cruzan aparecen en rojo.</small>
        </section>
    );
}

function isOnDay(event: OutlookSlot, day: string): boolean {
    return utcToLocal(event.start) < `${calendarNextDay(day)}T00:00` && utcToLocal(event.end) > `${day}T00:00`;
}
