import { apiRequest } from "../api/api-client";

/** Aggregate contract stages returned by the canonical API. */
export interface ContractSummary {
    readonly schemaVersion: 1;
    readonly observedAt: string;
    readonly total: number;
    readonly toSend: number;
    readonly pendingSignature: number;
    readonly sources: {
        readonly native: { readonly toSend: number; readonly pendingSignature: number };
        readonly legacy: { readonly toSend: number; readonly pendingSignature: number };
        readonly legacyEnabled: boolean;
        readonly duplicatesExcluded: number;
    };
}

/** Reads canonical aggregates; unavailable data must never become zero. */
export async function getContractSummary(): Promise<ContractSummary> {
    const result = record(await apiRequest<unknown>("/formalization/contracts/summary"));
    const sources = record(result.sources);
    const native = record(sources.native);
    const legacy = record(sources.legacy);
    if (result.schemaVersion !== 1 || typeof result.observedAt !== "string" || !Number.isFinite(Date.parse(result.observedAt)) || typeof sources.legacyEnabled !== "boolean") {
        throw new Error("Invalid contract summary");
    }
    const summary: ContractSummary = {
        schemaVersion: 1,
        observedAt: result.observedAt,
        total: count(result.total),
        toSend: count(result.toSend),
        pendingSignature: count(result.pendingSignature),
        sources: {
            native: { toSend: count(native.toSend), pendingSignature: count(native.pendingSignature) },
            legacy: { toSend: count(legacy.toSend), pendingSignature: count(legacy.pendingSignature) },
            legacyEnabled: sources.legacyEnabled,
            duplicatesExcluded: count(sources.duplicatesExcluded),
        },
    };
    // Log only validated aggregate fields, never arbitrary incoming payload data.
    if (import.meta.env.DEV) console.log("[Formalization API: contracts/summary] Incoming aggregate", summary);
    return summary;
}

/** Narrows to a plain object; arrays and null are contract violations. */
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid contract summary");
    return value as Record<string, unknown>;
}

/** Counts must be non-negative safe integers; anything else is rejected, never coerced to zero. */
function count(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid contract summary");
    return value;
}
