import type { AgendaStats } from "./calendar-agenda";

const TILES: readonly { readonly key: keyof AgendaStats; readonly label: string; readonly hint: string }[] = [
    { key: "today", label: "Hoy", hint: "eventos del día" },
    { key: "week", label: "Próximos 7 días", hint: "incluye hoy" },
    { key: "total", label: "En el período", hint: "según la vista" },
    { key: "calendars", label: "Calendarios activos", hint: "superpuestos" },
];

/** Four counters above the calendar, so the day's load is readable before opening any event. */
export function CalendarSummary({ stats }: { readonly stats: AgendaStats }) {
    return (
        <section className="calendar-summary" aria-label="Resumen del calendario">
            {TILES.map((tile) => (
                <div key={tile.key} className="calendar-summary__tile" data-empty={stats[tile.key] === 0}>
                    <span>{tile.label}</span>
                    <strong>{stats[tile.key]}</strong>
                    <small>{tile.hint}</small>
                </div>
            ))}
        </section>
    );
}
