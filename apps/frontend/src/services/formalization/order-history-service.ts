import { apiRequest } from "../api/api-client";
import type { NetsuiteOrderIdentity } from "./netsuite-order-service";

type Value = string | number | boolean | null;
export interface OrderHistoryChange {
    field: string;
    before: Value;
    after: Value;
    beforeExists: boolean;
    afterExists: boolean;
}
export interface OrderHistoryEntry {
    id: string;
    source: "native" | "legacy";
    action: string;
    label: string;
    reason: string | null;
    occurredAt: string | null;
    recordedAt: string | null;
    actorName: string | null;
    fromState: string | null;
    toState: string | null;
    fromStateLabel: string | null;
    toStateLabel: string | null;
    snapshotScope: string;
    changes: OrderHistoryChange[];
    hiddenChanges: number;
}
export interface OrderHistoryPage {
    schemaVersion: 1;
    source: "native" | "legacy";
    items: OrderHistoryEntry[];
    hasMore: boolean;
    nextCursor: string | null;
    coverage: { legacyAvailable: boolean; legacyLinked: boolean; note: string };
}
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Bitácora inválida");
    return value as Record<string, unknown>;
}
function scalar(value: unknown): value is Value {
    return value === null || ["string", "number", "boolean"].includes(typeof value);
}
function change(value: unknown): OrderHistoryChange {
    const row = object(value);
    if (typeof row.field !== "string" || !scalar(row.before) || !scalar(row.after) || typeof row.beforeExists !== "boolean" || typeof row.afterExists !== "boolean") throw new Error("Cambio inválido");
    return row as unknown as OrderHistoryChange;
}
function entry(value: unknown): OrderHistoryEntry {
    const row = object(value);
    for (const key of ["id", "action", "label", "snapshotScope"]) if (typeof row[key] !== "string") throw new Error("Evento inválido");
    for (const key of ["reason", "occurredAt", "recordedAt", "actorName", "fromState", "toState", "fromStateLabel", "toStateLabel"]) if (row[key] !== null && typeof row[key] !== "string") throw new Error("Evento inválido");
    if (!["native", "legacy"].includes(String(row.source)) || typeof row.hiddenChanges !== "number") throw new Error("Evento inválido");
    return { ...row, changes: changeList(row.changes) } as unknown as OrderHistoryEntry;
}
function changeList(value: unknown): OrderHistoryChange[] {
    if (!Array.isArray(value)) throw new Error("Cambios inválidos");
    return value.map(change);
}
function pagination(row: Record<string, unknown>) {
    if (!(row.nextCursor === null || typeof row.nextCursor === "string") || Boolean(row.nextCursor) !== row.hasMore) throw new Error("Paginación inválida");
}
function validateCoverage(coverage: Record<string, unknown>) {
    if (typeof coverage.legacyAvailable !== "boolean" || typeof coverage.legacyLinked !== "boolean" || typeof coverage.note !== "string") throw new Error("Cobertura inválida");
}
function parse(value: unknown): OrderHistoryPage {
    const row = object(value);
    const coverage = object(row.coverage);
    if (row.schemaVersion !== 1 || !["native", "legacy"].includes(String(row.source)) || !Array.isArray(row.items) || row.items.length > 50 || typeof row.hasMore !== "boolean") throw new Error("Bitácora inválida");
    pagination(row);
    validateCoverage(coverage);
    return { ...row, items: row.items.map(entry) } as unknown as OrderHistoryPage;
}
/** Always consults the authorized order; no arbitrary audit record ID or browser persistence. */
export async function getOrderHistory(identity: NetsuiteOrderIdentity, cursor?: string): Promise<OrderHistoryPage> {
    const id = identity.source === "legacy" ? identity.id.replace(/^legacy:/, "") : identity.id;
    const valid = identity.source === "legacy" ? /^[1-9][0-9]{0,9}$/.test(id) : /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id);
    if (!valid) throw new Error("Identidad de orden inválida");
    return parse(await apiRequest<unknown>("/formalization/orders/" + identity.source + "/" + encodeURIComponent(id) + "/history" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : "")));
}
