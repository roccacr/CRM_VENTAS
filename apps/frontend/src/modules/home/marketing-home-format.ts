import { daysBetween, type MarketingRange, type MarketingView } from "./marketing-home-preview.model";

export const countFormat = new Intl.NumberFormat("es-CR");
export const percentFormat = new Intl.NumberFormat("es-CR", { maximumFractionDigits: 1 });

export interface MarketingDelta {
    readonly direction: "up" | "down" | "flat";
    readonly text: string;
}

/** Below these sizes a difference is treated as no change, so noise never shows up red or green. */
const FLAT_RELATIVE_PERCENT = 0.5;
const FLAT_POINTS = 1;

/** Arrow and magnitude of a change; `points` compares two rates, otherwise it is a relative percentage. */
export function describeChange(change: number | null, unit: "%" | "puntos"): MarketingDelta | null {
    if (change === null) return null;
    if (Math.abs(change) < (unit === "%" ? FLAT_RELATIVE_PERCENT : FLAT_POINTS)) return { direction: "flat", text: "Sin cambio" };
    return { direction: change > 0 ? "up" : "down", text: `${change > 0 ? "▲" : "▼"} ${percentFormat.format(Math.abs(change))} ${unit}` };
}

const longDay = new Intl.DateTimeFormat("es-CR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const shortDay = new Intl.DateTimeFormat("es-CR", { weekday: "short", day: "numeric", month: "short" });

/** "jue 23 oct 2026" or "lun 19 – dom 25 oct 2026"; the year only appears once. */
export function describeRange(range: MarketingRange): string {
    return daysBetween(range.start, range.end) === 0 ? longDay.format(range.start) : `${shortDay.format(range.start)} – ${longDay.format(range.end)}`;
}

/** Short wording for sentences: "hoy", "ayer" or the dates. */
export function nameRange(range: MarketingRange, today: Date): string {
    if (daysBetween(range.start, range.end) === 0) {
        const ago = daysBetween(range.start, today);
        if (ago === 0) return "hoy";
        if (ago === 1) return "ayer";
    }
    return daysBetween(range.start, range.end) === 0 ? shortDay.format(range.start) : `${shortDay.format(range.start)} – ${shortDay.format(range.end)}`;
}

/** First and last day of the bars in a chart window, for the caption. */
export function describeWindow(range: MarketingRange): string {
    return `${shortDay.format(range.start)} – ${shortDay.format(range.end)}`;
}

/** Spell out what changed instead of relying on arrows or color. */
export function describeLeadChange(change: number | null): MarketingDelta | null {
    const delta = describeChange(change, "%");
    if (!delta || delta.direction === "flat") return delta;
    return { ...delta, text: `${delta.text} ${delta.direction === "up" ? "más" : "menos"} leads` };
}

/** A one-day selection plots a seven-day context; other charts use the actual comparison bounds. */
export function describeChartComparison(view: MarketingView): string {
    return describeRange(daysBetween(view.period.start, view.period.end) === 0 ? view.compareWindow : view.comparison);
}
