import { apiRequest } from "../api/api-client";

export const DISTRIBUTION_KEYS = ["approvals", "send", "signature", "bank_not_started", "bank_in_progress", "balance", "transfer", "signed", "closed", "addendum"] as const;
export type DistributionKey = (typeof DISTRIBUTION_KEYS)[number];
export interface ProjectDistributionRow {
    readonly id: string | null;
    readonly name: string;
    readonly total: number;
    readonly counts: Readonly<Partial<Record<DistributionKey, number>>>;
}
export interface ProjectDistribution {
    readonly schemaVersion: 1;
    readonly observedAt: string;
    readonly totalOrders: number;
    readonly series: readonly DistributionKey[];
    readonly projects: readonly ProjectDistributionRow[];
}
const invalid = () => new Error("La distribución por proyecto recibida no es válida.");
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    return value as Record<string, unknown>;
}
function count(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid();
    return value;
}
function series(value: unknown): DistributionKey[] {
    if (!Array.isArray(value) || value.length > DISTRIBUTION_KEYS.length) throw invalid();
    if (!value.every((key: unknown) => DISTRIBUTION_KEYS.some((known) => known === key)) || new Set(value).size !== value.length) throw invalid();
    return value as DistributionKey[];
}
function project(value: unknown, keys: readonly DistributionKey[]): ProjectDistributionRow {
    const row = object(value);
    const valid = [row.id === null || (typeof row.id === "string" && row.id.length > 0), typeof row.name === "string" && row.name.trim().length > 0].every(Boolean);
    if (!valid) throw invalid();
    const total = count(row.total);
    const raw = object(row.counts);
    if (Object.keys(raw).length !== keys.length || !Object.keys(raw).every((key) => keys.some((known) => known === key))) throw invalid();
    const counts = Object.fromEntries(keys.map((key) => [key, count(raw[key])]));
    if (!Object.values(counts).every((value) => value <= total)) throw invalid();
    return { id: row.id as string | null, name: row.name as string, total, counts };
}
function read(value: unknown): ProjectDistribution {
    const data = object(value);
    if (data.schemaVersion !== 1 || typeof data.observedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(data.observedAt) || !Number.isFinite(Date.parse(data.observedAt))) throw invalid();
    const keys = series(data.series);
    if (!Array.isArray(data.projects) || data.projects.length > 5000) throw invalid();
    const projects = data.projects.map((row: unknown) => project(row, keys));
    const totalOrders = count(data.totalOrders);
    if ([new Set(projects.map((row) => JSON.stringify(row.id))).size !== projects.length, projects.reduce((total, row) => total + row.total, 0) !== totalOrders].some(Boolean)) throw invalid();
    return { schemaVersion: 1, observedAt: data.observedAt, totalOrders, series: keys, projects };
}
/** Una consulta agregada completa, independiente de la página y filtros abiertos en Inicio. */
export async function getProjectDistribution(): Promise<ProjectDistribution> {
    return read(await apiRequest<unknown>("/formalization/home/project-distribution"));
}
