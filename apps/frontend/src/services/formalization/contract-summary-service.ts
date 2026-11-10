import { apiRequest } from "../api/api-client";

/** Etapas agregadas del contrato que devuelve el API canónico. */
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

/** Lee agregados canónicos. Un dato que no está disponible no se convierte en cero. */
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
    // El registro lleva solo los campos agregados ya validados. No lleva datos arbitrarios del payload.
    if (import.meta.env.DEV) console.log("[Formalization API: contracts/summary] Incoming aggregate", summary);
    return summary;
}

/** Exige un objeto plano. Un arreglo o un nulo violan el contrato. */
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid contract summary");
    return value as Record<string, unknown>;
}

/** Los conteos tienen que ser enteros seguros y no negativos. Cualquier otra cosa se rechaza y no se convierte en cero. */
function count(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid contract summary");
    return value;
}
