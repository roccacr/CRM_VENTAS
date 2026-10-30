import LeftOutlined from "@ant-design/icons/LeftOutlined";
import RightOutlined from "@ant-design/icons/RightOutlined";
import { useState } from "react";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const pad = (value: number) => String(value).padStart(2, "0");
const iso = (year: number, month: number, day: number) => `${String(year)}-${pad(month + 1)}-${pad(day)}`;
const monthTitle = (year: number, month: number) => {
    const text = new Intl.DateTimeFormat("es-CR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, 1)));
    return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Monday-first grid of the shown month, padded with the neighbouring days so every week is complete. */
function monthDays(year: number, month: number): readonly { readonly iso: string; readonly day: number; readonly outside: boolean }[] {
    const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
    const total = Math.ceil((offset + new Date(Date.UTC(year, month + 1, 0)).getUTCDate()) / 7) * 7;
    return Array.from({ length: total }, (_, index) => {
        const date = new Date(Date.UTC(year, month, index - offset + 1));
        return { iso: iso(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()), day: date.getUTCDate(), outside: date.getUTCMonth() !== month };
    });
}

/**
 * Small month for jumping around, like the one beside Outlook's calendar: it marks today and the day being viewed, and
 * choosing a day moves the main calendar there. It only navigates; it never reads or writes events.
 */
export function MiniMonth({ focus, today, onPick }: { readonly focus: string; readonly today: string; readonly onPick: (date: string) => void }) {
    const [shown, setShown] = useState(() => ({ year: Number(focus.slice(0, 4)), month: Number(focus.slice(5, 7)) - 1 }));
    const step = (delta: number) => {
        setShown(({ year, month }) => {
            const next = new Date(Date.UTC(year, month + delta, 1));
            return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
        });
    };
    return (
        <section className="mini-month" aria-label="Navegar por fecha">
            <header>
                <h2>{monthTitle(shown.year, shown.month)}</h2>
                <button
                    type="button"
                    aria-label="Mes previo del selector"
                    onClick={() => {
                        step(-1);
                    }}
                >
                    <LeftOutlined aria-hidden="true" />
                </button>
                <button
                    type="button"
                    aria-label="Mes posterior del selector"
                    onClick={() => {
                        step(1);
                    }}
                >
                    <RightOutlined aria-hidden="true" />
                </button>
            </header>
            <div className="mini-month__grid" role="grid" aria-label={monthTitle(shown.year, shown.month)}>
                {WEEKDAYS.map((label) => (
                    <span key={label} className="mini-month__weekday" role="columnheader">
                        {label}
                    </span>
                ))}
                {monthDays(shown.year, shown.month).map((cell) => (
                    <button
                        key={cell.iso}
                        type="button"
                        role="gridcell"
                        className="mini-month__day"
                        data-outside={cell.outside}
                        data-today={cell.iso === today}
                        data-selected={cell.iso === focus}
                        aria-label={cell.iso}
                        aria-current={cell.iso === today ? "date" : undefined}
                        onClick={() => {
                            onPick(cell.iso);
                        }}
                    >
                        {cell.day}
                    </button>
                ))}
            </div>
        </section>
    );
}
