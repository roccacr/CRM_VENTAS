import { apiRequest } from "../api/api-client";

/** Canonical stage counts; source authority and business classification belong to the API. */
export interface StageCounts {
    readonly contracts: { readonly toSend: number; readonly pendingSignature: number };
    readonly banking: number;
    readonly balance: number;
    readonly transferPending: number;
    readonly transferSigned: number;
    readonly closedThisYear: number;
}

/** Home banners payload: merged counts plus per-source breakdown for traceability. */
export interface HomeSummary {
    readonly schemaVersion: 1;
    readonly observedAt: string;
    readonly period: { readonly year: number; readonly timeZone: string; readonly start: string; readonly endExclusive: string };
    readonly counts: StageCounts;
    readonly sources: { readonly native: StageCounts; readonly legacy: StageCounts; readonly legacyEnabled: boolean; readonly duplicatesExcluded: number };
}

/** Single error type so callers can treat any contract violation the same way. */
const invalid = () => new Error("Invalid home summary");
/** Narrows to a plain object; arrays and null are contract violations. */
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    return value as Record<string, unknown>;
}
/** Counts must be non-negative safe integers; anything else is rejected, never coerced to zero. */
function count(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid();
    return value;
}
/** ISO date string that actually parses. */
function date(value: unknown): string {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw invalid();
    return value;
}
/** Validates one set of stage counters (merged or per source). */
function stages(value: unknown): StageCounts {
    const data = record(value);
    const contracts = record(data.contracts);
    return { contracts: { toSend: count(contracts.toSend), pendingSignature: count(contracts.pendingSignature) }, banking: count(data.banking), balance: count(data.balance), transferPending: count(data.transferPending), transferSigned: count(data.transferSigned), closedThisYear: count(data.closedThisYear) };
}

/** Reads fresh aggregate data; rejects unavailable or malformed data without a zero fallback. */
export async function getHomeSummary(): Promise<HomeSummary> {
    const data = record(await apiRequest<unknown>("/formalization/home/summary"));
    const period = record(data.period);
    const sources = record(data.sources);
    if (data.schemaVersion !== 1 || typeof period.timeZone !== "string" || typeof sources.legacyEnabled !== "boolean") throw invalid();
    try {
        new Intl.DateTimeFormat("en", { timeZone: period.timeZone });
    } catch {
        throw invalid();
    }
    const start = date(period.start);
    const endExclusive = date(period.endExclusive);
    const year = count(period.year);
    if (year === 0 || Date.parse(start) >= Date.parse(endExclusive)) throw invalid();
    const summary: HomeSummary = { schemaVersion: 1, observedAt: date(data.observedAt), period: { year, timeZone: period.timeZone, start, endExclusive }, counts: stages(data.counts), sources: { native: stages(sources.native), legacy: stages(sources.legacy), legacyEnabled: sources.legacyEnabled, duplicatesExcluded: count(sources.duplicatesExcluded) } };
    // Never log arbitrary payload fields or customer data, even in development.
    if (import.meta.env.DEV) console.log("[Formalization API: home/summary] Incoming aggregate", summary);
    return summary;
}
