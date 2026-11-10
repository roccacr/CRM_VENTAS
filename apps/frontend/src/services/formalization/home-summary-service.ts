import { apiRequest } from "../api/api-client";

/** Conteos canónicos de etapa. La autoridad de la fuente y la clasificación de negocio son del API. */
export interface StageCounts {
    readonly contracts: { readonly toSend: number; readonly pendingSignature: number };
    readonly banking: number;
    readonly bankingInProgress?: number;
    readonly balance: number;
    readonly transferPending: number;
    readonly transferSigned: number;
    readonly closedThisYear: number;
}

/** Carga de los banners de Inicio: conteos unidos y el desglose por fuente, para poder rastrearlos. */
export interface HomeSummary {
    readonly schemaVersion: 1;
    readonly observedAt: string;
    readonly period: { readonly year: number; readonly timeZone: string; readonly start: string; readonly endExclusive: string };
    readonly counts: StageCounts;
    readonly sources: { readonly native: StageCounts; readonly legacy: StageCounts; readonly legacyEnabled: boolean; readonly duplicatesExcluded: number };
}

/** Un solo tipo de error, para que quien llama trate igual cualquier violación del contrato. */
const invalid = () => new Error("Invalid home summary");
/** Exige un objeto plano. Un arreglo o un nulo violan el contrato. */
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    return value as Record<string, unknown>;
}
/** Los conteos tienen que ser enteros seguros y no negativos. Cualquier otra cosa se rechaza y no se convierte en cero. */
function count(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid();
    return value;
}
/** Texto de fecha ISO que de verdad se puede leer. */
function date(value: unknown): string {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw invalid();
    return value;
}
/** Valida un conjunto de contadores de etapa, unidos o por fuente. */
function stages(value: unknown): StageCounts {
    const data = record(value);
    const contracts = record(data.contracts);
    return { contracts: { toSend: count(contracts.toSend), pendingSignature: count(contracts.pendingSignature) }, banking: count(data.banking), ...(data.bankingInProgress === undefined ? {} : { bankingInProgress: count(data.bankingInProgress) }), balance: count(data.balance), transferPending: count(data.transferPending), transferSigned: count(data.transferSigned), closedThisYear: count(data.closedThisYear) };
}

/** Lee datos agregados frescos. Rechaza un dato ausente o mal formado y no lo sustituye por cero. */
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
    // No se registran campos arbitrarios del payload ni datos del cliente, tampoco en desarrollo.
    if (import.meta.env.DEV) console.log("[Formalization API: home/summary] Incoming aggregate", summary);
    return summary;
}
