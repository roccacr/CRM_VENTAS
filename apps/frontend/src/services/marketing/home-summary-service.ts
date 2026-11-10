import { apiRequest } from "../api/api-client";

export type MarketingApiPeriod = "day" | "week" | "month" | "year";
export interface MarketingApiEntity {
    readonly id: string;
    readonly publicId: string | null;
    readonly name: string;
}
export interface MarketingApiDailyRow {
    readonly date: string;
    readonly sellerId: string;
    readonly projectId: string;
    readonly leads: number;
}
export interface MarketingAppointmentEvent {
    readonly id: string;
    readonly date: string;
    readonly status: "scheduled" | "completed" | "cancelled" | "unknown";
    readonly attendance: "attended" | "missed" | null;
    readonly links: readonly { readonly sellerId: string; readonly projectId: string }[];
}
export type MarketingApiAppointments = { readonly available: false } | { readonly available: true; readonly events: readonly MarketingAppointmentEvent[]; readonly leadsWithAppointment: readonly { readonly date: string; readonly sellerId: string; readonly projectId: string; readonly withAppointment: number }[]; readonly quality: { readonly unresolvedLinks: number; readonly invalidDates: number; readonly unknownStatuses: number; readonly nativeTypeConfigured: boolean } };
export interface MarketingApiSummary {
    readonly schemaVersion: 1;
    readonly observedAt: string;
    readonly today: string;
    readonly period: MarketingApiPeriod;
    readonly timeZone: "America/Costa_Rica";
    readonly selected: { readonly start: string; readonly end: string };
    readonly comparison: { readonly start: string; readonly end: string };
    readonly coverage: { readonly start: string; readonly end: string };
    readonly rows: readonly MarketingApiDailyRow[];
    readonly sellers: readonly MarketingApiEntity[];
    readonly projects: readonly MarketingApiEntity[];
    readonly counts: { readonly leads: number; readonly previousLeads: number };
    readonly appointments: MarketingApiAppointments;
    readonly sources: { readonly native: number; readonly legacy: number; readonly legacyEnabled: boolean; readonly duplicatesExcluded: number; readonly ambiguousOverlaps: number };
}
const invalid = () => new Error("No fue posible validar los datos de Mercadeo.");
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    return value as Record<string, unknown>;
}
function text(value: unknown): string {
    if (typeof value !== "string" || value.length === 0 || value.length > 250) throw invalid();
    return value;
}
function count(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid();
    return value;
}
function day(value: unknown): string {
    const date = text(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw invalid();
    return date;
}
function range(value: unknown) {
    const data = record(value);
    const result = { start: day(data.start), end: day(data.end) };
    if (result.start > result.end) throw invalid();
    return result;
}
function entities(value: unknown): MarketingApiEntity[] {
    if (!Array.isArray(value)) throw invalid();
    return value.map((item) => {
        const data = record(item);
        return { id: text(data.id), publicId: data.publicId === null ? null : text(data.publicId), name: text(data.name) };
    });
}
function rows(value: unknown): MarketingApiDailyRow[] {
    if (!Array.isArray(value) || value.length > 50000) throw invalid();
    return value.map((item) => {
        const data = record(item);
        return { date: day(data.date), sellerId: text(data.sellerId), projectId: text(data.projectId), leads: count(data.leads) };
    });
}

/** Valida identificadores, totales y fuentes incompletas antes de que un valor pueda verse como contador. */
export function parseMarketingHomeSummary(value: unknown, period: MarketingApiPeriod): MarketingApiSummary {
    const data = record(value);
    const sources = record(data.sources);
    const counts = record(data.counts);

    if (data.schemaVersion !== 1 || data.period !== period || data.timeZone !== "America/Costa_Rica" || typeof sources.legacyEnabled !== "boolean") throw invalid();
    const summary: MarketingApiSummary = {
        schemaVersion: 1,
        observedAt: text(data.observedAt),
        today: day(data.today),
        period,
        timeZone: "America/Costa_Rica",
        selected: range(data.selected),
        comparison: range(data.comparison),
        coverage: range(data.coverage),
        rows: rows(data.rows),
        sellers: entities(data.sellers),
        projects: entities(data.projects),
        counts: { leads: count(counts.leads), previousLeads: count(counts.previousLeads) },
        appointments: parseAppointments(data.appointments),
        sources: { native: count(sources.native), legacy: count(sources.legacy), legacyEnabled: sources.legacyEnabled, duplicatesExcluded: count(sources.duplicatesExcluded), ambiguousOverlaps: count(sources.ambiguousOverlaps) },
    };
    validateEvidence(summary);
    validateAppointments(summary);
    return summary;
}
/** El BFF existente maneja las cookies de sesión y la autenticación. El GET no muta ni persiste. */
export async function getMarketingHomeSummary(period: MarketingApiPeriod): Promise<MarketingApiSummary> {
    return parseMarketingHomeSummary(await apiRequest<unknown>(`/marketing/home/summary?period=${period}`), period);
}

/** Rechaza filas y totales desconectados. No publica un reporte parcial. */
function validateEvidence(summary: MarketingApiSummary): void {
    const sellers = new Set(summary.sellers.map((item) => item.id));
    const projects = new Set(summary.projects.map((item) => item.id));
    const total = (interval: { start: string; end: string }) => summary.rows.filter((row) => row.date >= interval.start && row.date <= interval.end).reduce((sum, row) => sum + row.leads, 0);
    if (!Number.isFinite(Date.parse(summary.observedAt)) || sellers.size !== summary.sellers.length || projects.size !== summary.projects.length) throw invalid();
    if (summary.rows.some((row) => !sellers.has(row.sellerId) || !projects.has(row.projectId) || row.date < summary.coverage.start || row.date > summary.coverage.end)) throw invalid();
    if (summary.sources.native + summary.sources.legacy !== summary.counts.leads || total(summary.selected) !== summary.counts.leads || total(summary.comparison) !== summary.counts.previousLeads) throw invalid();
}

/** El volumen de citas se cuenta por evento. La conversión es un agregado de la cohorte de leads únicos. */
function parseAppointments(value: unknown): MarketingApiAppointments {
    const data = record(value);
    if (data.available === false) return { available: false };
    if (data.available !== true || !Array.isArray(data.events) || data.events.length > 50000 || !Array.isArray(data.leadsWithAppointment) || data.leadsWithAppointment.length > 50000) throw invalid();
    const events: MarketingAppointmentEvent[] = data.events.map((item) => {
        const event = record(item);
        if (!["scheduled", "completed", "cancelled", "unknown"].includes(String(event.status)) || (event.attendance !== null && event.attendance !== "attended" && event.attendance !== "missed") || !Array.isArray(event.links) || event.links.length === 0 || event.links.length > 50000) throw invalid();
        return {
            id: text(event.id),
            date: day(event.date),
            status: event.status as MarketingAppointmentEvent["status"],
            attendance: event.attendance,
            links: event.links.map((item) => {
                const link = record(item);
                return { sellerId: text(link.sellerId), projectId: text(link.projectId) };
            }),
        };
    });
    const cohorts = data.leadsWithAppointment.map((item) => {
        const row = record(item);
        return { date: day(row.date), sellerId: text(row.sellerId), projectId: text(row.projectId), withAppointment: count(row.withAppointment) };
    });
    const quality = record(data.quality);
    if (typeof quality.nativeTypeConfigured !== "boolean") throw invalid();
    return { available: true, events, leadsWithAppointment: cohorts, quality: { unresolvedLinks: count(quality.unresolvedLinks), invalidDates: count(quality.invalidDates), unknownStatuses: count(quality.unknownStatuses), nativeTypeConfigured: quality.nativeTypeConfigured } };
}
function validateAppointments(summary: MarketingApiSummary): void {
    if (!summary.appointments.available) return;
    const { events, leadsWithAppointment } = summary.appointments;
    const sellers = new Set(summary.sellers.map((item) => item.id));
    const projects = new Set(summary.projects.map((item) => item.id));
    const known = (row: { sellerId: string; projectId: string }) => sellers.has(row.sellerId) && projects.has(row.projectId);
    const inCoverage = (date: string) => date >= summary.coverage.start && date <= summary.coverage.end;
    if (new Set(events.map((event) => event.id)).size !== events.length || events.some((event) => !inCoverage(event.date) || event.links.some((link) => !known(link)))) throw invalid();
    const key = (row: { date: string; sellerId: string; projectId: string }) => JSON.stringify([row.date, row.sellerId, row.projectId]);
    const totals = new Map(summary.rows.map((row) => [key(row), row.leads]));
    validateConversionRows(leadsWithAppointment, totals, known, inCoverage);
}
function validateConversionRows(leadsWithAppointment: Extract<MarketingApiAppointments, { available: true }>["leadsWithAppointment"], totals: ReadonlyMap<string, number>, known: (row: { sellerId: string; projectId: string }) => boolean, inCoverage: (date: string) => boolean): void {
    const key = (row: { date: string; sellerId: string; projectId: string }) => JSON.stringify([row.date, row.sellerId, row.projectId]);
    const seen = new Set<string>();
    for (const row of leadsWithAppointment) {
        const id = key(row);
        if (seen.has(id) || !known(row) || !inCoverage(row.date) || row.withAppointment > (totals.get(id) ?? 0)) throw invalid();
        seen.add(id);
    }
}
