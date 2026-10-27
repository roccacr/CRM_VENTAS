/** Aggregate row consumed by the view. Runtime has no demonstration data or synthetic fallback. */
export interface MarketingSampleRow {
    readonly sellerName?: string;
    readonly sellerPublicId?: string | null;
    readonly projectName?: string;
    readonly project: string;
    readonly campaign: string;
    readonly ad: string;
    readonly seller: string;
    /** Days before "today"; 0 is today. */
    readonly daysAgo: number;
    readonly leads: number;
    readonly withAppointment: number;
    readonly appointments: number;
    /** Appointments that took place. */
    readonly attended: number;
    /** Due appointments the lead did not attend. */
    readonly missed: number;
}

export type MarketingDirectoryRow = Pick<MarketingSampleRow, "seller" | "project" | "sellerName" | "sellerPublicId" | "projectName">;

export const MARKETING_DIMENSIONS = [
    { key: "project", label: "Proyecto" },
    { key: "campaign", label: "Campaña" },
    { key: "ad", label: "Anuncio" },
    { key: "seller", label: "Vendedor" },
] as const;
export type MarketingDimension = (typeof MARKETING_DIMENSIONS)[number]["key"];

export const MARKETING_PERIOD_MODES = [
    { key: "day", label: "Día" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mes" },
    { key: "range", label: "Rango" },
    { key: "year", label: "Año" },
] as const;
export type MarketingPeriodMode = (typeof MARKETING_PERIOD_MODES)[number]["key"];

export const MARKETING_COMPARISONS = [
    { key: "previous", label: "Periodo anterior" },
    { key: "lastMonth", label: "Mismo periodo del mes pasado" },
    { key: "lastYear", label: "Mismo periodo del año pasado" },
    { key: "custom", label: "Elegir fechas" },
] as const;
export type MarketingComparison = (typeof MARKETING_COMPARISONS)[number]["key"];

/** What the person picked: a unit of time, a date inside it and what to compare with. Dates are ISO `YYYY-MM-DD`. */
export interface MarketingSelection {
    readonly mode: MarketingPeriodMode;
    readonly anchor: string;
    readonly rangeStart: string;
    readonly rangeEnd: string;
    readonly comparison: MarketingComparison;
    readonly compareStart: string;
    readonly compareEnd: string;
}
export type MarketingPreviewFilters = Record<MarketingDimension, string> & { selection: MarketingSelection; sellers?: readonly string[]; projects?: readonly string[] };

/** Below this many leads a rate is noise, so the UI flags it and alerts ignore it. */
export const MARKETING_MIN_SAMPLE = 25;

const DAY_MS = 86_400_000;
export const EMPTY_MARKETING_ROWS: readonly MarketingSampleRow[] = [];

export const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const addDays = (date: Date, days: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
export const daysBetween = (from: Date, to: Date): number => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
const pad = (value: number): string => String(value).padStart(2, "0");
export const toISODate = (date: Date): string => `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Same day-of-month `months` away, clamped to the last day (31 Mar - 1 month = 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
    const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), lastDay));
}

/** Strict ISO parser; impossible dates such as 2026-02-31 are rejected instead of rolling over. */
export function parseISODate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return toISODate(date) === value ? date : null;
}

/** Quick summary on entry: today against yesterday. The person then chooses any other period. */
export function emptyMarketingFilters(today: Date = startOfDay(new Date())): MarketingPreviewFilters {
    const iso = toISODate(today);
    const selection: MarketingSelection = { mode: "day", anchor: iso, rangeStart: toISODate(addDays(today, -6)), rangeEnd: iso, comparison: "previous", compareStart: toISODate(addDays(today, -13)), compareEnd: toISODate(addDays(today, -7)) };
    return { project: "", campaign: "", ad: "", seller: "", selection };
}

/** Inclusive date range. */
export interface MarketingRange {
    readonly start: Date;
    readonly end: Date;
}

/** Orders the ends and never reaches into the future, where the sample (and reality) has no data. */
function clampRange(start: Date, end: Date, today: Date): MarketingRange {
    const [from, to] = start <= end ? [start, end] : [end, start];
    const last = to > today ? today : to;
    return { start: from > last ? last : from, end: last };
}

const PERIOD_RESOLVERS: Record<MarketingPeriodMode, (selection: MarketingSelection, today: Date) => MarketingRange> = {
    day: (selection, today) => {
        const day = parseISODate(selection.anchor) ?? today;
        return clampRange(day, day, today);
    },
    week: (selection, today) => {
        const anchor = parseISODate(selection.anchor) ?? today;
        const monday = addDays(anchor, -((anchor.getDay() + 6) % 7));
        return clampRange(monday, addDays(monday, 6), today);
    },
    month: (selection, today) => {
        const anchor = parseISODate(selection.anchor) ?? today;
        return clampRange(new Date(anchor.getFullYear(), anchor.getMonth(), 1), new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0), today);
    },
    range: (selection, today) => clampRange(parseISODate(selection.rangeStart) ?? today, parseISODate(selection.rangeEnd) ?? today, today),
    year: (selection, today) => {
        const anchor = parseISODate(selection.anchor) ?? today;
        return clampRange(new Date(anchor.getFullYear(), 0, 1), new Date(anchor.getFullYear(), 11, 31), today);
    },
};

/** The dates the person is looking at. A week or month in progress ends today. */
export function resolveMarketingPeriod(selection: MarketingSelection, today: Date = startOfDay(new Date())): MarketingRange {
    return PERIOD_RESOLVERS[selection.mode](selection, today);
}

const rangeLength = (range: MarketingRange): number => daysBetween(range.start, range.end) + 1;

/** Start of the unit right before: yesterday, last week, last month or last year. */
function shiftedStart(mode: MarketingPeriodMode, start: Date): Date {
    if (mode === "day") return addDays(start, -1);
    if (mode === "week") return addDays(start, -7);
    return addMonths(start, mode === "year" ? -12 : -1);
}

/** "Periodo anterior" keeps the same elapsed length so a week in progress is not judged against a full week. */
function previousRange(mode: MarketingPeriodMode, period: MarketingRange): MarketingRange {
    if (mode === "year") return { start: addMonths(period.start, -12), end: addMonths(period.end, -12) };
    const length = rangeLength(period);
    if (mode === "range") {
        const end = addDays(period.start, -1);
        return { start: addDays(end, -(length - 1)), end };
    }
    const start = shiftedStart(mode, period.start);
    const end = addDays(start, length - 1);
    if (mode !== "month") return { start, end };
    const limit = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    // A closed month or year is compared with the whole previous one, whatever its length; one in progress keeps its elapsed days.
    const closed = period.end.getTime() === new Date(period.start.getFullYear(), period.start.getMonth() + 1, 0).getTime();
    return { start, end: closed || end > limit ? limit : end };
}

/** The dates the period is compared with. */
export function resolveMarketingComparison(selection: MarketingSelection, period: MarketingRange, today: Date = startOfDay(new Date())): MarketingRange {
    switch (selection.comparison) {
        case "lastMonth":
            return { start: addMonths(period.start, -1), end: addMonths(period.end, -1) };
        case "lastYear":
            return { start: addMonths(period.start, -12), end: addMonths(period.end, -12) };
        case "custom":
            return clampRange(parseISODate(selection.compareStart) ?? period.start, parseISODate(selection.compareEnd) ?? period.end, today);
        default:
            return previousRange(selection.mode, period);
    }
}

/** Start of the neighbouring unit; months and years step from their first day so the length never drifts. */
function steppedStart(mode: MarketingPeriodMode, start: Date, direction: -1 | 1): Date {
    if (mode === "day") return addDays(start, direction);
    if (mode === "week") return addDays(start, direction * 7);
    return addMonths(new Date(start.getFullYear(), mode === "year" ? 0 : start.getMonth(), 1), direction * (mode === "year" ? 12 : 1));
}

/** Moves the selection one unit back or forward; a range moves by its own length. */
export function shiftMarketingSelection(selection: MarketingSelection, direction: -1 | 1, today: Date = startOfDay(new Date())): MarketingSelection {
    const period = resolveMarketingPeriod(selection, today);
    const length = rangeLength(period);
    if (selection.mode === "range") {
        return { ...selection, rangeStart: toISODate(addDays(period.start, direction * length)), rangeEnd: toISODate(addDays(period.end, direction * length)) };
    }
    const next = steppedStart(selection.mode, period.start, direction);
    return { ...selection, anchor: toISODate(next > today ? today : next) };
}

/** True while the period ends before today, so moving forward still lands on real data. */
export function canAdvanceMarketingSelection(selection: MarketingSelection, today: Date = startOfDay(new Date())): boolean {
    return resolveMarketingPeriod(selection, today).end < today;
}

function matchesDimensions(row: MarketingSampleRow, filters: MarketingPreviewFilters): boolean {
    const multi = { seller: filters.sellers, project: filters.projects };
    return MARKETING_DIMENSIONS.every(({ key }) => {
        const selected = key === "seller" || key === "project" ? multi[key] : undefined;
        return selected ? selected.length === 0 || selected.includes(row[key]) : !filters[key] || row[key] === filters[key];
    });
}

function rowsIn(range: MarketingRange, filters: MarketingPreviewFilters, today: Date, source: readonly MarketingSampleRow[]): readonly MarketingSampleRow[] {
    const newest = daysBetween(range.end, today);
    const oldest = daysBetween(range.start, today);
    return source.filter((row) => row.daysAgo >= newest && row.daysAgo <= oldest && matchesDimensions(row, filters));
}

/** Granularity of a chart: one point per day up to a month, per week up to a quarter, per calendar month beyond. */
export type MarketingGrain = 1 | 7 | "month";
const grainFor = (days: number): MarketingGrain => (days <= 31 ? 1 : days <= 100 ? 7 : "month");

/** The chart must show the same data the cards compare against, so a longer shifted window is cut to the comparison dates. */
function comparedChartRows(shifted: readonly MarketingSampleRow[], period: MarketingRange, comparison: MarketingRange, today: Date): readonly MarketingSampleRow[] {
    // With one day the chart shows its week and pairs each day with the equivalent one, as context.
    if (rangeLength(period) <= 1) return shifted;
    const newest = daysBetween(comparison.end, today);
    const oldest = daysBetween(comparison.start, today);
    return shifted.filter((row) => row.daysAgo >= newest && row.daysAgo <= oldest);
}

/** Everything the page needs, resolved once from the selection so every block reads the same dates. */
export function resolveMarketingView(filters: MarketingPreviewFilters, today: Date = startOfDay(new Date()), source: readonly MarketingSampleRow[] = EMPTY_MARKETING_ROWS) {
    const period = resolveMarketingPeriod(filters.selection, today);
    const comparison = resolveMarketingComparison(filters.selection, period, today);
    // A single day has no shape, so the chart shows the week that ends on it.
    const window: MarketingRange = rangeLength(period) <= 1 ? { start: addDays(period.end, -6), end: period.end } : period;
    const offset = daysBetween(comparison.start, period.start);
    const compareWindow: MarketingRange = { start: addDays(window.start, -offset), end: addDays(window.end, -offset) };
    return {
        today,
        source,
        period,
        comparison,
        window,
        compareWindow,
        grain: grainFor(rangeLength(window)),
        rows: rowsIn(period, filters, today, source),
        previousRows: rowsIn(comparison, filters, today, source),
        windowRows: rowsIn(window, filters, today, source),
        comparedRows: comparedChartRows(rowsIn(compareWindow, filters, today, source), period, comparison, today),
    };
}
export type MarketingView = ReturnType<typeof resolveMarketingView>;

/** Leads captured in the last 7 days with no appointment: what still needs follow-up, whatever period is chosen. */
export function recentWithoutAppointment(filters: MarketingPreviewFilters, today: Date = startOfDay(new Date()), source: readonly MarketingSampleRow[] = EMPTY_MARKETING_ROWS): number {
    return summarizeMarketingSample(rowsIn({ start: addDays(today, -6), end: today }, filters, today, source)).withoutAppointment;
}

/** First day with leads under the other filters, so an ad can be followed "since it started". */
export function firstMarketingActivity(filters: MarketingPreviewFilters, today: Date = startOfDay(new Date()), source: readonly MarketingSampleRow[] = EMPTY_MARKETING_ROWS): Date | null {
    const active = source.filter((row) => matchesDimensions(row, filters) && row.leads > 0);
    return active.length ? addDays(today, -Math.max(...active.map((row) => row.daysAgo))) : null;
}

/** All banners and tables use the same filtered sample; repeated appointments are not unique leads. */
export function summarizeMarketingSample(rows: readonly MarketingSampleRow[]) {
    const totals = rows.reduce((sum, row) => ({ leads: sum.leads + row.leads, withAppointment: sum.withAppointment + row.withAppointment, appointments: sum.appointments + row.appointments, attended: sum.attended + row.attended, missed: sum.missed + row.missed }), { leads: 0, withAppointment: 0, appointments: 0, attended: 0, missed: 0 });
    const due = totals.attended + totals.missed;
    return {
        ...totals,
        pending: totals.appointments - due,
        withoutAppointment: totals.leads - totals.withAppointment,
        rate: totals.leads ? (totals.withAppointment / totals.leads) * 100 : 0,
        // Attendance only counts appointments already due; pending ones are neither attended nor missed yet.
        attendance: due ? (totals.attended / due) * 100 : 0,
    };
}

/** Relative change in percent, or null when there is no previous value to compare with. */
export function relativeChange(current: number, previous: number): number | null {
    return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

/** One point of a chart, oldest first; `compared` is the same point of the comparison. */
export interface MarketingBucket {
    readonly label: string;
    readonly leads: number;
    readonly compared: number;
    readonly withAppointment: number;
    readonly attended: number;
}

const dayLabel = new Intl.DateTimeFormat("es-CR", { weekday: "short", day: "numeric" });
const dateLabel = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short" });
const monthLabel = new Intl.DateTimeFormat("es-CR", { month: "short" });

function bucketCount(window: MarketingRange, grain: MarketingGrain): number {
    if (grain === "month") return (window.end.getFullYear() - window.start.getFullYear()) * 12 + window.end.getMonth() - window.start.getMonth() + 1;
    return Math.ceil(rangeLength(window) / grain);
}

function bucketLabelFor(window: MarketingRange, grain: MarketingGrain, index: number): string {
    if (grain === "month") return monthLabel.format(new Date(window.start.getFullYear(), window.start.getMonth() + index, 1));
    return (grain === 1 ? dayLabel : dateLabel).format(addDays(window.start, index * grain));
}

function bucketIndex(row: MarketingSampleRow, from: Date, grain: MarketingGrain, today: Date): number {
    if (grain === "month") {
        const date = addDays(today, -row.daysAgo);
        return (date.getFullYear() - from.getFullYear()) * 12 + date.getMonth() - from.getMonth();
    }
    return Math.floor((daysBetween(from, today) - row.daysAgo) / grain);
}

/** Splits the chart window into days, weeks or months and lines the comparison up point by point. */
export function bucketMarketingSample(view: Pick<MarketingView, "window" | "compareWindow" | "grain" | "today">, rows: readonly MarketingSampleRow[], compared: readonly MarketingSampleRow[] = []): MarketingBucket[] {
    const { window, compareWindow, grain, today } = view;
    const buckets = Array.from({ length: bucketCount(window, grain) }, (_, index) => ({ label: bucketLabelFor(window, grain, index), leads: 0, compared: 0, withAppointment: 0, attended: 0 }));
    for (const row of rows) {
        const bucket = buckets[bucketIndex(row, window.start, grain, today)];
        if (!bucket) continue;
        bucket.leads += row.leads;
        bucket.withAppointment += row.withAppointment;
        bucket.attended += row.attended;
    }
    for (const row of compared) {
        const bucket = buckets[bucketIndex(row, compareWindow.start, grain, today)];
        if (bucket) bucket.compared += row.leads;
    }
    return buckets;
}

/** Leads without appointment per day over the last week, for the follow-up card. */
export function recentWithoutAppointmentSeries(filters: MarketingPreviewFilters, today: Date = startOfDay(new Date()), source: readonly MarketingSampleRow[] = EMPTY_MARKETING_ROWS): number[] {
    const window = { start: addDays(today, -6), end: today };
    return bucketMarketingSample({ window, compareWindow: window, grain: 1, today }, rowsIn(window, filters, today, source)).map((bucket) => bucket.leads - bucket.withAppointment);
}

/** Leads captured today, this week, this month and this year (each up to today), whatever period is displayed. */
export function horizonLeads(filters: MarketingPreviewFilters, today: Date = startOfDay(new Date()), source: readonly MarketingSampleRow[] = EMPTY_MARKETING_ROWS) {
    const leadsIn = (mode: MarketingPeriodMode) => summarizeMarketingSample(rowsIn(resolveMarketingPeriod({ ...filters.selection, mode, anchor: toISODate(today) }, today), filters, today, source)).leads;
    return { day: leadsIn("day"), week: leadsIn("week"), month: leadsIn("month"), year: leadsIn("year") };
}

/** Projects a seller works on, or every project when no seller is chosen. */
export function projectsForSeller(seller: string | readonly string[], source: readonly MarketingDirectoryRow[] = EMPTY_MARKETING_ROWS): string[] {
    const selected = typeof seller === "string" ? [seller].filter(Boolean) : seller;
    return [...new Set(source.filter((combination) => selected.length === 0 || selected.includes(combination.seller)).map((combination) => combination.project))].sort((first, second) => first.localeCompare(second, "es"));
}

/** Reconcile each dimension against the same totals used by the banners, with its movement and change. */
export function groupMarketingSample(view: MarketingView, dimension: MarketingDimension) {
    const split = (source: readonly MarketingSampleRow[]) => {
        const groups = new Map<string, MarketingSampleRow[]>();
        for (const row of source) groups.set(row[dimension], [...(groups.get(row[dimension]) ?? []), row]);
        return groups;
    };
    const current = split(view.rows);
    const previous = split(view.previousRows);
    const inWindow = split(view.windowRows);
    // A source that had leads before and none now is exactly what a supervisor must see, so it stays in the list.
    return [...new Set([...current.keys(), ...previous.keys()])]
        .map((name) => {
            const items = current.get(name) ?? [];
            const summary = summarizeMarketingSample(items);
            const before = summarizeMarketingSample(previous.get(name) ?? []);
            const movement = bucketMarketingSample(view, inWindow.get(name) ?? []).map((bucket) => bucket.leads);
            const label = marketingGroupLabel(dimension, name, items.concat(previous.get(name) ?? []));
            return { name, label, ...summary, previousLeads: before.leads, change: relativeChange(summary.leads, before.leads), movement };
        })
        .sort((first, second) => second.leads - first.leads || first.name.localeCompare(second.name, "es"));
}

function marketingGroupLabel(dimension: MarketingDimension, name: string, rows: readonly MarketingSampleRow[]): string {
    const first = rows[0];
    if (dimension === "seller") return first?.sellerName ?? name;
    if (dimension === "project") return first?.projectName ?? name;
    return name;
}

/** Sellers against campaigns: how many leads each seller holds per campaign, and how many have an appointment. */
export function matrixMarketingSample(rows: readonly MarketingSampleRow[]) {
    const campaigns = [...new Set(rows.map((row) => row.campaign))].sort((first, second) => first.localeCompare(second, "es"));
    const sellers = [...new Set(rows.map((row) => row.seller))].map((seller) => {
        const own = rows.filter((row) => row.seller === seller);
        const cells = campaigns.map((campaign) => summarizeMarketingSample(own.filter((row) => row.campaign === campaign)));
        return { seller, cells, total: summarizeMarketingSample(own) };
    });
    return { campaigns, sellers: sellers.sort((first, second) => second.total.leads - first.total.leads || first.seller.localeCompare(second.seller, "es")) };
}

/** Something that needs a look. Only sources with enough leads can raise one, so noise never alarms anyone. */
export interface MarketingAlert {
    readonly key: string;
    readonly text: string;
}

const DROP_THRESHOLD = -20;
const SELLER_GAP_POINTS = 8;
const MIN_ALERT_DAYS = 7;

/** Sources that lost a fifth or more of their leads against the comparison. */
function dropAlerts(view: MarketingView): MarketingAlert[] {
    // Day-to-day swings of 50% are normal, so a drop only means something over at least a week.
    if (rangeLength(view.period) < MIN_ALERT_DAYS) return [];
    return (["project", "campaign", "ad"] as const).flatMap((dimension) => {
        const label = MARKETING_DIMENSIONS.find((item) => item.key === dimension)?.label ?? "";
        return groupMarketingSample(view, dimension)
            .sort((a, b) => b.previousLeads - b.leads - (a.previousLeads - a.leads) || a.label.localeCompare(b.label, "es"))
            .filter((group) => group.name.trim().length > 0 && group.previousLeads >= MARKETING_MIN_SAMPLE && group.change !== null && group.change <= DROP_THRESHOLD)
            .map((group) => {
                const name = `${group.label.toLowerCase().startsWith(label.toLowerCase()) ? "" : `${label} `}${group.label}`;
                return { key: `${dimension}:${group.name}`, text: `${name}: ${(group.previousLeads - group.leads).toLocaleString("es-CR")} leads menos (${String(Math.round(Math.abs(group.change ?? 0)))} %) · ${group.leads.toLocaleString("es-CR")} vs. ${group.previousLeads.toLocaleString("es-CR")}` };
            });
    });
}

/** Sellers whose share of leads without appointment is clearly above the team average. */
function sellerAlerts(view: MarketingView): MarketingAlert[] {
    const total = summarizeMarketingSample(view.rows);
    const average = total.leads ? (total.withoutAppointment / total.leads) * 100 : 0;
    return groupMarketingSample(view, "seller")
        .filter((group) => group.leads >= MARKETING_MIN_SAMPLE && (group.withoutAppointment / group.leads) * 100 >= average + SELLER_GAP_POINTS)
        .map((group) => ({ key: `seller:${group.name}`, text: `${group.label}: ${String(Math.round((group.withoutAppointment / group.leads) * 100))} % de sus leads sin cita (el equipo promedia ${String(Math.round(average))} %).` }));
}

/** At most three alerts, empty when everything is within range. */
export function alertMarketingSample(view: MarketingView): MarketingAlert[] {
    return [...dropAlerts(view), ...sellerAlerts(view)].slice(0, 3);
}
