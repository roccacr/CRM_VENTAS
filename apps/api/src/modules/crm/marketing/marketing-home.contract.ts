import { z } from "zod";

import type { LegacyAppointmentEvidence, MarketingAppointments, NativeAppointmentEvidence } from "./marketing-appointments.contract.js";

export const marketingHomeQuery = z.object({ period: z.enum(["day", "week", "month", "year"]).default("month") }).strict();
export type MarketingPeriod = z.infer<typeof marketingHomeQuery>["period"];
export interface MarketingDateRange {
    start: string;
    end: string;
}
const DAY = 86400000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const utcDay = (value: string) => new Date(`${value}T00:00:00Z`);
const shift = (value: string, days: number) => isoDay(new Date(utcDay(value).getTime() + days * DAY));
const startOfMonth = (value: string) => `${value.slice(0, 7)}-01`;
const startOfYear = (value: string) => `${value.slice(0, 4)}-01-01`;
const elapsed = (from: string, to: string) => Math.round((utcDay(to).getTime() - utcDay(from).getTime()) / DAY);

/**
 * El periodo anterior dura los mismos días corridos.
 * Un mes o un año más corto termina en su último día real. El 29 de febrero que no existe cae en el día anterior.
 */
function previousRange(period: MarketingPeriod, selected: MarketingDateRange): MarketingDateRange {
    if (period === "day") return { start: shift(selected.start, -1), end: shift(selected.end, -1) };
    if (period === "week") return { start: shift(selected.start, -7), end: shift(selected.end, -7) };
    const previousEnd = shift(selected.start, -1);
    if (period === "year") {
        const start = startOfYear(previousEnd);
        const candidate = `${start.slice(0, 4)}${selected.end.slice(4)}`;
        const normalized = isoDay(utcDay(candidate));
        return { start, end: normalized === candidate ? candidate : shift(normalized, -1) };
    }
    const start = startOfMonth(previousEnd);
    const end = shift(start, elapsed(selected.start, selected.end));
    const closedMonth = shift(selected.end, 1).slice(8) === "01";
    return { start, end: closedMonth || end > previousEnd ? previousEnd : end };
}

/**
 * Los límites salen del calendario de Costa Rica, no de la zona de Node ni de la sesión de MySQL.
 * No hay horario de verano. La semana empieza el lunes y la medianoche local es las 06:00 UTC.
 */
export function createMarketingWindow(period: MarketingPeriod, now = new Date()) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const weekday = utcDay(today).getUTCDay();
    const starts = { day: today, week: shift(today, -((weekday + 6) % 7)), month: startOfMonth(today), year: startOfYear(today) };
    const selected = { start: starts[period], end: today };
    const comparison = previousRange(period, selected);
    const from = [startOfYear(today), comparison.start, shift(today, -13)].sort()[0] as string;
    return { period, today, selected, comparison, from, to: today, startEpoch: Date.parse(`${from}T06:00:00Z`) / 1000, endEpoch: Date.parse(`${shift(today, 1)}T06:00:00Z`) / 1000 };
}
export type MarketingWindow = ReturnType<typeof createMarketingWindow>;
export interface MarketingEntity {
    id: string;
    publicId: string | null;
    name: string;
}
export interface MarketingDailyRow {
    date: string;
    sellerId: string;
    projectId: string;
    leads: number;
}
export interface NativeMarketingUser {
    id: string;
    name: string;
    email: string;
}
export interface NativeMarketingProject {
    id: string;
    name: string;
}
export interface MarketingExternalIdentity {
    id: string;
    system: string;
    externalId: string;
}
export interface NativeMarketingData {
    appointmentEvidence?: NativeAppointmentEvidence;
    rows: MarketingDailyRow[];
    users: NativeMarketingUser[];
    projects: NativeMarketingProject[];
    userAliases: MarketingExternalIdentity[];
    projectAliases: MarketingExternalIdentity[];
}
export interface LegacyMarketingRow {
    date: string;
    sellerReference: string;
    projectReference: string;
    projectName: string | null;
    leads: number;
    duplicates: number;
    ambiguous: number;
}
export interface LegacyMarketingOwner {
    reference: string;
    email: string | null;
    name: string | null;
}
export interface LegacyMarketingData {
    appointmentEvidence?: LegacyAppointmentEvidence;
    rows: LegacyMarketingRow[];
    owners: LegacyMarketingOwner[];
    provider: string;
}
export interface MarketingHomeSummary {
    schemaVersion: 1;
    observedAt: string;
    today: string;
    period: MarketingPeriod;
    timeZone: "America/Costa_Rica";
    selected: MarketingDateRange;
    comparison: MarketingDateRange;
    coverage: MarketingDateRange;
    rows: MarketingDailyRow[];
    sellers: MarketingEntity[];
    projects: MarketingEntity[];
    counts: { leads: number; previousLeads: number };
    appointments: MarketingAppointments;
    sources: { native: number; legacy: number; legacyEnabled: boolean; duplicatesExcluded: number; ambiguousOverlaps: number };
}
export const marketingCount = (value: unknown): number => z.coerce.number().int().nonnegative().parse(value);
export const inMarketingRange = (date: string, range: MarketingDateRange) => date >= range.start && date <= range.end;
