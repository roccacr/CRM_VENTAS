import { apiRequest } from "../api/api-client";

export const FOLLOW_UP_QUEUES = ["all", "approvals", "contracts", "send", "signature", "bank", "balance", "transfer", "signed", "closed"] as const;
export type FollowUpQueue = (typeof FOLLOW_UP_QUEUES)[number];
export interface FollowUpFilters {
    readonly recordId?: string;
    readonly search: string;
    readonly projectId: string;
    readonly queue: FollowUpQueue;
    readonly page: number;
    readonly pageSize: number;
}
export interface FollowUpItem {
    readonly id: string;
    readonly source: "native" | "legacy";
    readonly number: string;
    readonly nativeCode: string | null;
    readonly client: string | null;
    readonly clientEmail?: string | null;
    readonly project: { id: string; name: string } | null;
    readonly unit: string | null;
    readonly responsible: { id: string | null; name: string } | null;
    /** Salesperson and change author are distinct from the recorded stage assignee. */
    readonly seller?: { id: string | null; name: string } | null;
    readonly changedBy?: { id: string | null; name: string } | null;
    readonly state: { code: string; label: string; since: string | null; days: number | null };
    readonly approvalsComplete?: boolean;
    readonly contractSigned?: boolean | undefined;
    readonly stateVersion?: number;
    readonly nextStep: string;
    readonly completedThisYear: boolean;
}
export interface FollowUp {
    readonly schemaVersion: 1;
    readonly observedAt: string;
    readonly filters: Pick<FollowUpFilters, "search" | "projectId" | "queue">;
    readonly page: { number: number; size: number; total: number; totalPages: number };
    readonly counts: Record<FollowUpQueue, number>;
    readonly projects: { id: string; name: string }[];
    readonly items: FollowUpItem[];
    readonly sources: { native: { total: number }; legacy: { total: number; enabled: boolean } };
}
const invalid = () => new Error("Invalid formalization follow-up");
function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    return value as Record<string, unknown>;
}
function text(value: unknown): string {
    if (typeof value !== "string") throw invalid();
    return value;
}
function count(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid();
    return value;
}
function bool(value: unknown): boolean {
    if (typeof value !== "boolean") throw invalid();
    return value;
}
function date(value: unknown): string {
    const result = text(value);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) throw invalid();
    return result;
}
function queue(value: unknown): FollowUpQueue {
    const result = FOLLOW_UP_QUEUES.find((item) => item === value);
    if (!result) throw invalid();
    return result;
}
function project(value: unknown): { id: string; name: string } {
    const item = record(value);
    return { id: text(item.id), name: text(item.name) };
}
function array<T>(value: unknown, parse: (entry: unknown) => T): T[] {
    if (!Array.isArray(value)) throw invalid();
    return value.map(parse);
}
function nullable<T>(value: unknown, parse: (entry: unknown) => T): T | null {
    return value === null ? null : parse(value);
}
function responsible(value: unknown): NonNullable<FollowUpItem["responsible"]> {
    const data = record(value);
    return { id: nullable(data.id, text), name: text(data.name) };
}
/** A single valid recipient only; rejects header injection and address lists. */
function clientEmail(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const email = value.trim();
    return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) ? email : null;
}
function item(value: unknown): FollowUpItem {
    const data = record(value);
    const state = record(data.state);
    if (data.source !== "native" && data.source !== "legacy") throw invalid();
    return {
        id: text(data.id),
        source: data.source,
        number: text(data.number),
        nativeCode: nullable(data.nativeCode, text),
        client: nullable(data.client, text),
        clientEmail: clientEmail(data.clientEmail),
        project: nullable(data.project, project),
        unit: nullable(data.unit, text),
        responsible: nullable(data.responsible, responsible),
        ...(data.seller === undefined ? {} : { seller: nullable(data.seller, responsible) }),
        ...(data.changedBy === undefined ? {} : { changedBy: nullable(data.changedBy, responsible) }),
        state: { code: text(state.code), label: text(state.label), since: nullable(state.since, date), days: nullable(state.days, count) },
        ...(data.contractSigned === undefined ? {} : { contractSigned: bool(data.contractSigned) }),
        ...(data.approvalsComplete === undefined ? {} : { approvalsComplete: bool(data.approvalsComplete) }),
        ...(data.stateVersion === undefined ? {} : { stateVersion: count(data.stateVersion) }),
        nextStep: text(data.nextStep),
        completedThisYear: bool(data.completedThisYear),
    };
}
function positive(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
    const result = count(value);
    if (result < 1 || result > maximum) throw invalid();
    return result;
}
/** Validates and reconstructs the canonical contract, excluding arbitrary provider/contact fields. */
export async function getFollowUp(filters: FollowUpFilters): Promise<FollowUp> {
    positive(filters.page);
    positive(filters.pageSize, 100);
    const params = new URLSearchParams({ search: text(filters.search), projectId: text(filters.projectId), queue: queue(filters.queue), page: String(filters.page), pageSize: String(filters.pageSize) });
    if (filters.recordId) params.set("recordId", filters.recordId);
    const data = record(await apiRequest<unknown>(`/formalization/home/follow-up?${params.toString()}`));
    const applied = record(data.filters);
    const page = record(data.page);
    const counts = record(data.counts);
    const sources = record(data.sources);
    const native = record(sources.native);
    const legacy = record(sources.legacy);
    if (data.schemaVersion !== 1) throw invalid();
    const parsedCounts = {} as Record<FollowUpQueue, number>;
    for (const key of FOLLOW_UP_QUEUES) parsedCounts[key] = count(counts[key]);
    const result: FollowUp = {
        schemaVersion: 1,
        observedAt: date(data.observedAt),
        filters: { search: text(applied.search), projectId: text(applied.projectId), queue: queue(applied.queue) },
        page: { number: positive(page.number), size: positive(page.size, 100), total: count(page.total), totalPages: count(page.totalPages) },
        counts: parsedCounts,
        projects: array(data.projects, project),
        items: array(data.items, item),
        sources: { native: { total: count(native.total) }, legacy: { total: count(legacy.total), enabled: bool(legacy.enabled) } },
    };
    if (result.items.length > result.page.size) throw invalid();
    // Log only the validated canonical JSON; credentials and raw provider/contact fields are never copied.
    if (import.meta.env.DEV) console.log("[Formalization API: home/follow-up]", JSON.stringify({ ...result, items: result.items.map(({ clientEmail: _clientEmail, ...entry }) => entry) }));
    return result;
}
