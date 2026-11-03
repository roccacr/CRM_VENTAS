import type { CapturePeriod } from "./capture-period";
import { type CaptureCatalogs, type CaptureDepth, type CaptureMeasure, type CaptureRow, EMPTY_VALUES, lossReasonRows, type PathRow, summaryRows } from "./lead-capture-report";

export type CaptureGrouping = "total" | "day" | "week" | "month" | "quarter" | "year";
export interface CaptureDateRange {
    readonly from: string;
    readonly to: string;
}
export const CAPTURE_GROUPINGS: readonly { id: CaptureGrouping; label: string }[] = [
    { id: "total", label: "Total del rango" },
    { id: "day", label: "Día" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mes" },
    { id: "year", label: "Año" },
    { id: "quarter", label: "Trimestre" },
];
const DAY = 86400000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const dateOf = (value: string) => new Date(`${value}T00:00:00Z`);
function validDay(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(dateOf(value).getTime()) && iso(dateOf(value)) === value;
}
/** Las fechas se aplican como días completos de la cohorte CRM, sin convertirlas a la zona del navegador. */
export function validateCaptureRange(range: CaptureDateRange, today: string): string | null {
    if (!validDay(range.from) || !validDay(range.to)) return "Completa una fecha Desde y Hasta válidas.";
    if (range.from > range.to) return "Desde debe ser anterior o igual a Hasta.";
    if (range.to > today) return "Hasta no puede ser posterior a hoy.";
    return null;
}
function bucketStart(value: string, grouping: Exclude<CaptureGrouping, "total">): string {
    if (grouping === "year") return `${value.slice(0, 4)}-01-01`;
    if (grouping === "month") return `${value.slice(0, 7)}-01`;
    if (grouping === "quarter") return `${value.slice(0, 4)}-${String(Math.floor((Number(value.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
    const date = dateOf(value);
    if (grouping === "week") date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return iso(date);
}
function nextBucket(value: string, grouping: Exclude<CaptureGrouping, "total">): string {
    const date = dateOf(value);
    if (grouping === "year") date.setUTCFullYear(date.getUTCFullYear() + 1);
    else if (grouping === "month" || grouping === "quarter") date.setUTCMonth(date.getUTCMonth() + (grouping === "quarter" ? 3 : 1));
    else date.setUTCDate(date.getUTCDate() + (grouping === "week" ? 7 : 1));
    return iso(date);
}
function bucketLabel(start: string, end: string, grouping: Exclude<CaptureGrouping, "total">): string {
    if (grouping === "year") return start.slice(0, 4);
    if (grouping === "quarter") return `T${String(Math.floor((Number(start.slice(5, 7)) - 1) / 3) + 1)} ${start.slice(0, 4)}`;
    if (grouping === "month") return new Intl.DateTimeFormat("es-CR", { month: "short", year: "numeric", timeZone: "UTC" }).format(dateOf(start));
    const format = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    return grouping === "week" ? `${format.format(dateOf(start))} – ${format.format(dateOf(end))}` : format.format(dateOf(start));
}
interface TimeOptions {
    readonly catalogs: CaptureCatalogs;
    readonly depth: CaptureDepth;
    readonly measure: CaptureMeasure;
    readonly grouping: CaptureGrouping;
    readonly range: CaptureDateRange;
    readonly periods?: readonly CaptureDateRange[];
}
function summarize(items: readonly CaptureRow[], options: TimeOptions): PathRow[] {
    return options.measure === "lossReasons" ? lossReasonRows(items) : summaryRows(items, options.depth, options.measure, options.catalogs);
}
function calendarBuckets(range: CaptureDateRange, grouping: Exclude<CaptureGrouping, "total">) {
    const buckets: { key: string; label: string }[] = [];
    for (let start = bucketStart(range.from, grouping); start <= range.to; start = nextBucket(start, grouping)) {
        if (buckets.length >= 2500) throw new RangeError("Elige un rango más corto o una agrupación mayor.");
        const end = iso(new Date(dateOf(nextBucket(start, grouping)).getTime() - DAY));
        buckets.push({ key: start, label: bucketLabel(start > range.from ? start : range.from, end < range.to ? end : range.to, grouping) });
    }
    return buckets;
}
function fillBucket(totals: readonly PathRow[], observed: readonly PathRow[], bucket: { key: string; label: string }): PathRow[] {
    const own = new Map(observed.map((row) => [row.key, row]));
    return totals.map((total) => {
        const value = own.get(total.key);
        return { key: JSON.stringify([bucket.key, total.key]), colorKey: total.key, path: [bucket.label, ...total.path], value: value?.value ?? 0, detail: value?.detail ?? EMPTY_VALUES };
    });
}
/** Calendario continuo: un proyecto conserva identidad y color; los intervalos sin captaciones cuentan cero. */
export function captureTimeGroups(rows: readonly CaptureRow[], options: TimeOptions): PathRow[] {
    const included = options.periods?.length ? rows.filter((row) => options.periods?.some((period) => row.date >= period.from && row.date <= period.to)) : rows;
    const totals = summarize(included, options);
    const { grouping, range } = options;
    if (grouping === "total" || totals.length === 0) return totals;
    const buckets = calendarBuckets(range, grouping).filter((bucket) => !options.periods?.length || options.periods.some((period) => bucket.key === bucketStart(period.from, grouping)));
    if (buckets.length * totals.length > 2500) throw new RangeError("La comparación tiene demasiadas columnas. Selecciona proyectos, un rango más corto o una agrupación mayor.");
    const byDate = new Map<string, CaptureRow[]>();
    for (const row of included) {
        const key = bucketStart(row.date, grouping);
        const own = byDate.get(key) ?? [];
        own.push(row);
        byDate.set(key, own);
    }
    return buckets.flatMap((bucket) => fillBucket(totals, summarize(byDate.get(bucket.key) ?? [], options), bucket));
}
/** Etiqueta común para gráfico, tabla y exportación. */
export const captureGroupingLabel = (grouping: CaptureGrouping): string => CAPTURE_GROUPINGS.find((item) => item.id === grouping)?.label.toLocaleLowerCase("es") ?? "total";

/** Un solo control define período y agrupación; un rango personalizado elige una escala legible automáticamente. */
export function captureGroupingForPeriod(period: CapturePeriod, range: CaptureDateRange): CaptureGrouping {
    if (period !== "custom") return period;
    const days = (dateOf(range.to).getTime() - dateOf(range.from).getTime()) / DAY + 1;
    if (days <= 31) return "day";
    if (days <= 93) return "week";
    if (days <= 730) return "month";
    return "year";
}

export interface CapturePeriodChoice {
    readonly value: string;
    readonly label: string;
    readonly range: CaptureDateRange;
}
/** El calendario incluye períodos sin leads para poder comparar ceros; las semanas empiezan el lunes. */
export function capturePeriodChoices(period: CapturePeriod, coverage: CaptureDateRange): CapturePeriodChoice[] {
    if (period === "custom" || period === "day" || !validDay(coverage.from) || !validDay(coverage.to)) return [];
    const choices: CapturePeriodChoice[] = [];
    for (let start = bucketStart(coverage.from, period); start <= coverage.to; start = nextBucket(start, period)) {
        const end = iso(new Date(dateOf(nextBucket(start, period)).getTime() - DAY));
        const to = end < coverage.to ? end : coverage.to;
        const label = period === "month" ? new Intl.DateTimeFormat("es-CR", { month: "long", year: "numeric", timeZone: "UTC" }).format(dateOf(start)) : bucketLabel(start, to, period);
        choices.push({ value: start, label, range: { from: start, to } });
    }
    return choices;
}

/** Presentación por dimensión: cada proyecto conserva juntos todos sus períodos y su total. */
export function capturePeriodProjects(groups: readonly PathRow[]) {
    const projects = new Map<string, { key: string; label: string; items: PathRow[]; total: number }>();
    for (const item of groups) {
        const key = item.colorKey ?? item.key;
        const project = projects.get(key) ?? { key, label: item.path.slice(1).join(" › "), items: [], total: 0 };
        project.items.push(item);
        project.total += item.value;
        projects.set(key, project);
    }
    return [...projects.values()];
}
