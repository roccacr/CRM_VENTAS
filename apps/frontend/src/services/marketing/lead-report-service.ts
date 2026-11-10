import type { CaptureCatalogs, CaptureLossReason, CaptureNamed, CaptureRow, CaptureSeller } from "../../modules/marketing/lead-capture-report";
import { apiRequest } from "../api/api-client";

export type CaptureApiPeriod = "day" | "week" | "month" | "all";
export type CaptureQualification = "all" | "qualified" | "unqualified";
export interface CaptureApiReport extends CaptureCatalogs {
    readonly schemaVersion: 1;
    readonly observedAt: string;
    readonly today: string;
    readonly timeZone: "America/Costa_Rica";
    readonly period: CaptureApiPeriod;
    readonly qualification?: CaptureQualification;
    readonly range: { readonly start: string; readonly end: string };
    readonly coverage: { readonly start: string; readonly end: string };
    readonly rows: readonly CaptureRow[];
    readonly sources: { readonly native: number; readonly legacy: number; readonly duplicatesExcluded: number; readonly legacyEnabled: boolean };
    readonly quality: { readonly unresolvedSellers: number; readonly unresolvedCampaigns: number; readonly ambiguousLeadReferences: number; readonly unclassifiedAppointments: number; readonly invalidDates: number };
}
const invalid = () => new Error("No fue posible validar los datos de captación.");
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    return value as Record<string, unknown>;
}
function text(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) throw invalid();
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
function entities(value: unknown): CaptureNamed[] {
    if (!Array.isArray(value)) throw invalid();
    const result = value.map((item) => {
        const data = record(item);
        return { id: text(data.id), name: text(data.name) };
    });
    if (new Set(result.map((item) => item.id)).size !== result.length) throw invalid();
    return result;
}
function sellers(value: unknown): CaptureSeller[] {
    entities(value);
    return (value as unknown[]).map((item) => {
        const data = record(item);
        return { id: text(data.id), name: text(data.name), publicId: data.publicId === null ? null : text(data.publicId) };
    });
}
function rows(value: unknown): CaptureRow[] {
    if (!Array.isArray(value)) throw invalid();
    return value.map((item) => {
        const data = record(item);
        const row = { date: day(data.date), sellerId: text(data.sellerId), projectId: text(data.projectId), campaignId: text(data.campaignId), adId: text(data.adId), leads: count(data.leads), noAppointment: count(data.noAppointment), scheduled: count(data.scheduled), completed: count(data.completed), lost: count(data.lost) };
        if (row.noAppointment + row.scheduled + row.completed !== row.leads || row.lost > row.leads) throw invalid();
        return { ...row, lossReasons: lossReasons(data.lossReasons, row.lost) };
    });
}
/** El detalle debe reconciliar exactamente con Perdidos; una versión anterior conserva el total como no documentado. */
function lossReasons(value: unknown, lost: number): CaptureLossReason[] {
    if (value === undefined) return lost > 0 ? [{ code: "unrecorded", name: "Sin motivo registrado", count: lost }] : [];
    if (!Array.isArray(value)) throw invalid();
    const result = value.map((item) => {
        const data = record(item);
        return { code: text(data.code), name: text(data.name), count: count(data.count) };
    });
    if (result.some((item) => item.count === 0) || new Set(result.map((item) => item.code)).size !== result.length || result.reduce((sum, item) => sum + item.count, 0) !== lost) throw invalid();
    return result;
}

/** Valida el agregado completo antes de que un contador o un catálogo pueda verse. */
export function parseCaptureReport(value: unknown, period: CaptureApiPeriod, qualification: CaptureQualification = "all"): CaptureApiReport {
    const data = record(value),
        source = record(data.sources),
        quality = record(data.quality);
    if (data.schemaVersion !== 1 || data.period !== period || data.timeZone !== "America/Costa_Rica" || typeof source.legacyEnabled !== "boolean") throw invalid();
    if ((data.qualification === undefined ? "all" : data.qualification) !== qualification) throw invalid();
    const report: CaptureApiReport = {
        schemaVersion: 1,
        observedAt: text(data.observedAt),
        today: day(data.today),
        timeZone: "America/Costa_Rica",
        period,
        qualification,
        range: range(data.range),
        coverage: range(data.coverage),
        rows: rows(data.rows),
        sellers: sellers(data.sellers),
        projects: entities(data.projects),
        campaigns: entities(data.campaigns),
        ads: entities(data.ads),
        sources: { native: count(source.native), legacy: count(source.legacy), duplicatesExcluded: count(source.duplicatesExcluded), legacyEnabled: source.legacyEnabled },
        quality: { unresolvedSellers: count(quality.unresolvedSellers), unresolvedCampaigns: count(quality.unresolvedCampaigns), ambiguousLeadReferences: count(quality.ambiguousLeadReferences), unclassifiedAppointments: count(quality.unclassifiedAppointments), invalidDates: count(quality.invalidDates) },
    };
    validateEvidence(report);
    return report;
}
function validateEvidence(report: CaptureApiReport): void {
    const catalogs = [report.sellers, report.projects, report.campaigns, report.ads].map((items) => new Set(items.map((item) => item.id)));
    const known = (row: CaptureRow) => [row.sellerId, row.projectId, row.campaignId, row.adId].every((id, index) => catalogs[index]?.has(id));
    if (!Number.isFinite(Date.parse(report.observedAt)) || report.range.end !== report.today || report.coverage.end !== report.today) throw invalid();
    if (report.rows.some((row) => !known(row) || row.date < report.range.start || row.date < report.coverage.start || row.date > report.today)) throw invalid();
    const keys = report.rows.map((row) => JSON.stringify([row.date, row.sellerId, row.projectId, row.campaignId, row.adId]));
    if (new Set(keys).size !== keys.length || report.rows.reduce((sum, row) => sum + row.leads, 0) !== report.sources.native + report.sources.legacy) throw invalid();
    validateSources(report);
}
function validateSources(report: CaptureApiReport): void {
    if (!report.sources.legacyEnabled && report.sources.legacy > 0) throw invalid();
}
/** El BFF existente es dueño de las cookies de sesión y de los permisos. Este endpoint es de solo lectura. */
export async function getCaptureReport(period: CaptureApiPeriod, qualification: CaptureQualification = "all"): Promise<CaptureApiReport> {
    return parseCaptureReport(await apiRequest<unknown>(`/marketing/leads/report?period=${period}${qualification === "all" ? "" : `&qualification=${qualification}`}`), period, qualification);
}
