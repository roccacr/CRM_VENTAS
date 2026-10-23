/** Fictional aggregate sample for design review only. Never a fallback for operational data. */
export interface MarketingSampleRow {
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
export type MarketingPreviewFilters = Record<MarketingDimension, string> & { selection: MarketingSelection };

/** Below this many leads a rate is noise, so the UI flags it and alerts ignore it. */
export const MARKETING_MIN_SAMPLE = 25;

const DAY_MS = 86_400_000;
const SAMPLE_DAYS = 800;

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

const COMBINATIONS: readonly { project: string; campaign: string; ad: string; seller: string; rate: number; since?: number }[] = [
    { project: "Proyecto Norte", campaign: "Lanzamiento", ad: "Recorrido en video", seller: "Asesor A", rate: 0.34 },
    { project: "Proyecto Norte", campaign: "Lanzamiento", ad: "Carrusel de espacios", seller: "Asesor B", rate: 0.3 },
    { project: "Proyecto Norte", campaign: "Visita guiada", ad: "Recorrido en video", seller: "Asesor A", rate: 0.36 },
    { project: "Proyecto Parque", campaign: "Lanzamiento", ad: "Recorrido en video", seller: "Asesor C", rate: 0.38 },
    { project: "Proyecto Parque", campaign: "Visita guiada", ad: "Carrusel de espacios", seller: "Asesor B", rate: 0.42 },
    { project: "Proyecto Parque", campaign: "Visita guiada", ad: "Imagen del proyecto", seller: "Asesor A", rate: 0.33 },
    { project: "Proyecto Centro", campaign: "Fin de semana", ad: "Imagen del proyecto", seller: "Asesor C", rate: 0.35 },
    { project: "Proyecto Centro", campaign: "Fin de semana", ad: "Recorrido en video", seller: "Asesor B", rate: 0.37 },
    // A recent ad, so "since it started" has something real to show.
    { project: "Proyecto Parque", campaign: "Lanzamiento", ad: "Reel nuevo", seller: "Asesor C", rate: 0.44, since: 18 },
];

/** Deterministic pseudo-random value in [0, 1) so the demo never changes between renders or tests. */
function noise(day: number, slot: number, salt: number): number {
    const hash = Math.imul(day * 31 + slot * 17 + salt * 7 + 12345, 2654435761) >>> 0;
    return ((hash >>> 8) % 1000) / 1000;
}

/** Only recent appointments can still be pending; older ones are either done or missed. */
function pendingAppointments(daysAgo: number, appointments: number): number {
    if (daysAgo <= 2) return appointments;
    if (daysAgo <= 7) return Math.round(appointments * 0.5);
    return daysAgo <= 14 ? Math.round(appointments * 0.15) : 0;
}

type Combination = (typeof COMBINATIONS)[number];

/** Combinations that exist on that day: a recent ad only appears after its launch. */
function activeCombination(daysAgo: number, slot: number): Combination {
    const pool = COMBINATIONS.filter((combination) => combination.since === undefined || daysAgo < combination.since);
    return pool[(daysAgo * 3 + slot + (daysAgo % 5)) % pool.length] ?? COMBINATIONS[0] ?? { project: "", campaign: "", ad: "", seller: "", rate: 0.35 };
}

/** Appointment outcomes for the leads of one row. */
function appointmentOutcome(daysAgo: number, slot: number, withAppointment: number) {
    const appointments = withAppointment + (withAppointment > 0 && noise(daysAgo, slot, 3) < 0.25 ? 1 : 0);
    const pending = pendingAppointments(daysAgo, appointments);
    // Rounding a 14% rate over one or two appointments always yields zero, so roll the dice per row instead.
    const settled = appointments - pending;
    const missed = settled > 0 && noise(daysAgo, slot, 4) < settled * 0.16 ? 1 : 0;
    return { appointments, attended: settled - missed, missed };
}

/** One combination on one day, with recent growth and a mild seasonal swing so periods differ. */
function buildRow(daysAgo: number, slot: number): MarketingSampleRow {
    const { project, campaign, ad, seller, rate } = activeCombination(daysAgo, slot);
    const growth = (1 + Math.max(0, (360 - daysAgo) / 360) * 0.2) * (1 + 0.15 * Math.sin(daysAgo / 9));
    const leads = Math.max(1, Math.round((3 + noise(daysAgo, slot, 1) * 7) * growth));
    const withAppointment = Math.min(leads, Math.round(leads * (rate + (noise(daysAgo, slot, 2) - 0.5) * 0.1)));
    return { project, campaign, ad, seller, daysAgo, leads, withAppointment, ...appointmentOutcome(daysAgo, slot, withAppointment) };
}

/** Three active combinations per day over more than two years: any period and its year-ago twin have data. */
function buildSample(): MarketingSampleRow[] {
    return Array.from({ length: SAMPLE_DAYS * 3 }, (_, index) => buildRow(Math.floor(index / 3), index % 3));
}

export const MARKETING_SAMPLE: readonly MarketingSampleRow[] = buildSample();

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
    const length = rangeLength(period);
    if (mode === "range") {
        const end = addDays(period.start, -1);
        return { start: addDays(end, -(length - 1)), end };
    }
    const start = shiftedStart(mode, period.start);
    const end = addDays(start, length - 1);
    if (mode !== "month" && mode !== "year") return { start, end };
    const limit = mode === "year" ? new Date(start.getFullYear(), 11, 31) : new Date(start.getFullYear(), start.getMonth() + 1, 0);
    // A closed month or year is compared with the whole previous one, whatever its length; one in progress keeps its elapsed days.
    const closed = period.end.getTime() === (mode === "year" ? new Date(period.start.getFullYear(), 11, 31) : new Date(period.start.getFullYear(), period.start.getMonth() + 1, 0)).getTime();
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
    return MARKETING_DIMENSIONS.every(({ key }) => !filters[key] || row[key] === filters[key]);
}

function rowsIn(range: MarketingRange, filters: MarketingPreviewFilters, today: Date): readonly MarketingSampleRow[] {
    const newest = daysBetween(range.end, today);
    const oldest = daysBetween(range.start, today);
    return MARKETING_SAMPLE.filter((row) => row.daysAgo >= newest && row.daysAgo <= oldest && matchesDimensions(row, filters));
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
export function resolveMarketingView(filters: MarketingPreviewFilters, today: Date = startOfDay(new Date())) {
    const period = resolveMarketingPeriod(filters.selection, today);
    const comparison = resolveMarketingComparison(filters.selection, period, today);
    // A single day has no shape, so the chart shows the week that ends on it.
    const window: MarketingRange = rangeLength(period) <= 1 ? { start: addDays(period.end, -6), end: period.end } : period;
    const offset = daysBetween(comparison.start, period.start);
    const compareWindow: MarketingRange = { start: addDays(window.start, -offset), end: addDays(window.end, -offset) };
    return {
        today,
        period,
        comparison,
        window,
        compareWindow,
        grain: grainFor(rangeLength(window)),
        rows: rowsIn(period, filters, today),
        previousRows: rowsIn(comparison, filters, today),
        windowRows: rowsIn(window, filters, today),
        comparedRows: comparedChartRows(rowsIn(compareWindow, filters, today), period, comparison, today),
    };
}
export type MarketingView = ReturnType<typeof resolveMarketingView>;

/** Leads captured in the last 7 days with no appointment: what still needs follow-up, whatever period is chosen. */
export function recentWithoutAppointment(filters: MarketingPreviewFilters, today: Date = startOfDay(new Date())): number {
    return summarizeMarketingSample(rowsIn({ start: addDays(today, -6), end: today }, filters, today)).withoutAppointment;
}

/** First day with leads under the other filters, so an ad can be followed "since it started". */
export function firstMarketingActivity(filters: MarketingPreviewFilters, today: Date = startOfDay(new Date())): Date | null {
    const active = MARKETING_SAMPLE.filter((row) => matchesDimensions(row, filters) && row.leads > 0);
    return active.length ? addDays(today, -Math.max(...active.map((row) => row.daysAgo))) : null;
}

/** All banners and tables use the same filtered sample; repeated appointments are not unique leads. */
export function summarizeMarketingSample(rows: readonly MarketingSampleRow[]) {
    const totals = rows.reduce(
        (sum, row) => ({ leads: sum.leads + row.leads, withAppointment: sum.withAppointment + row.withAppointment, appointments: sum.appointments + row.appointments, attended: sum.attended + row.attended, missed: sum.missed + row.missed }),
        { leads: 0, withAppointment: 0, appointments: 0, attended: 0, missed: 0 },
    );
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
export function recentWithoutAppointmentSeries(filters: MarketingPreviewFilters, today: Date = startOfDay(new Date())): number[] {
    const window = { start: addDays(today, -6), end: today };
    return bucketMarketingSample({ window, compareWindow: window, grain: 1, today }, rowsIn(window, filters, today)).map((bucket) => bucket.leads - bucket.withAppointment);
}

/** Leads captured today, this week, this month and this year (each up to today), whatever period is displayed. */
export function horizonLeads(filters: MarketingPreviewFilters, today: Date = startOfDay(new Date())) {
    const leadsIn = (mode: MarketingPeriodMode) => summarizeMarketingSample(rowsIn(resolveMarketingPeriod({ ...filters.selection, mode, anchor: toISODate(today) }, today), filters, today)).leads;
    return { day: leadsIn("day"), week: leadsIn("week"), month: leadsIn("month"), year: leadsIn("year") };
}

/** Projects a seller works on, or every project when no seller is chosen. */
export function projectsForSeller(seller: string): string[] {
    return [...new Set(COMBINATIONS.filter((combination) => !seller || combination.seller === seller).map((combination) => combination.project))].sort((first, second) => first.localeCompare(second, "es"));
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
            return { name, ...summary, previousLeads: before.leads, change: relativeChange(summary.leads, before.leads), movement };
        })
        .sort((first, second) => second.leads - first.leads || first.name.localeCompare(second.name, "es"));
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
            .filter((group) => group.previousLeads >= MARKETING_MIN_SAMPLE && group.change !== null && group.change <= DROP_THRESHOLD)
            .map((group) => {
                const name = `${group.name.toLowerCase().startsWith(label.toLowerCase()) ? "" : `${label} `}${group.name}`;
                return { key: `${dimension}:${group.name}`, text: group.leads === 0 ? `${name}: sin leads en este periodo (antes ${String(group.previousLeads)}).` : `${name}: ${String(Math.round(Math.abs(group.change ?? 0)))} % menos leads que en la comparación.` };
            });
    });
}

/** Sellers whose share of leads without appointment is clearly above the team average. */
function sellerAlerts(view: MarketingView): MarketingAlert[] {
    const total = summarizeMarketingSample(view.rows);
    const average = total.leads ? (total.withoutAppointment / total.leads) * 100 : 0;
    return groupMarketingSample(view, "seller")
        .filter((group) => group.leads >= MARKETING_MIN_SAMPLE && (group.withoutAppointment / group.leads) * 100 >= average + SELLER_GAP_POINTS)
        .map((group) => ({ key: `seller:${group.name}`, text: `${group.name}: ${String(Math.round((group.withoutAppointment / group.leads) * 100))} % de sus leads sin cita (el equipo promedia ${String(Math.round(average))} %).` }));
}

/** At most three alerts, empty when everything is within range. */
export function alertMarketingSample(view: MarketingView): MarketingAlert[] {
    return [...dropAlerts(view), ...sellerAlerts(view)].slice(0, 3);
}
