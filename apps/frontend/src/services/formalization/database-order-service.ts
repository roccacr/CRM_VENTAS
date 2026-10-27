import { apiRequest } from "../api/api-client";
import type { NetsuiteOrderIdentity } from "./netsuite-order-service";

export interface DatabaseOrderResult {
    readonly schemaVersion: 1;
    readonly observedAt: string;
    readonly source: "native" | "legacy";
    readonly order: Record<string, unknown>;
    readonly lead: Record<string, unknown> | null;
    readonly contact: Record<string, unknown> | null;
    readonly unitFile: Record<string, unknown> | null;
    readonly references: readonly Record<string, unknown>[];
    readonly warnings: readonly string[];
}
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Datos de orden invalidos");
    return value as Record<string, unknown>;
}
function parseDatabaseResult(value: unknown): DatabaseOrderResult {
    const data = object(value);
    const checks = [data.schemaVersion === 1, ["native", "legacy"].includes(String(data.source)), typeof data.observedAt === "string", Array.isArray(data.references), Array.isArray(data.warnings)];
    if (!checks.every(Boolean)) throw new Error("Datos de orden invalidos");
    const warnings = data.warnings as unknown[];
    if (!warnings.every((entry) => typeof entry === "string")) throw new Error("Datos de orden invalidos");
    return { schemaVersion: 1, observedAt: String(data.observedAt), source: data.source as "native" | "legacy", order: object(data.order), lead: data.lead === null ? null : object(data.lead), contact: data.contact === null ? null : object(data.contact), unitFile: data.unitFile === null ? null : object(data.unitFile), references: (data.references as unknown[]).map(object), warnings: warnings };
}
/** Same authorized CRM identity as the provider call. No copied records or browser persistence. */
export async function getDatabaseOrder(identity: NetsuiteOrderIdentity): Promise<DatabaseOrderResult> {
    const id = identity.source === "legacy" ? identity.id.replace(/^legacy:/, "") : identity.id;
    const valid = identity.source === "legacy" ? /^[1-9][0-9]{0,9}$/.test(id) : /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id);
    if (!valid) throw new Error("Identidad de orden invalida");
    return parseDatabaseResult(await apiRequest<unknown>("/formalization/orders/" + identity.source + "/" + encodeURIComponent(id) + "/database"));
}
