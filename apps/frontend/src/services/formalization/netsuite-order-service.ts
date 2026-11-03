import { apiRequest } from "../api/api-client";

export interface NetsuiteOrderIdentity {
    readonly source: "native" | "legacy";
    readonly id: string;
}
export interface NetsuiteOrderResult {
    readonly schemaVersion: 1;
    readonly order: NetsuiteOrderIdentity & { readonly netsuiteId: string };
    readonly data: unknown;
}
/** This endpoint resolves the provider reference server-side; credentials never reach React. */
export async function getNetsuiteOrder(identity: NetsuiteOrderIdentity): Promise<NetsuiteOrderResult> {
    const result = await apiRequest<unknown>(synchronizationPath(identity));
    return parseNetsuiteResult(result);
}
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Respuesta NetSuite invalida");
    return value as Record<string, unknown>;
}
function parseOrder(value: unknown): NetsuiteOrderResult["order"] {
    const order = object(value);
    if (!["native", "legacy"].includes(String(order.source)) || typeof order.id !== "string" || typeof order.netsuiteId !== "string" || !/^[1-9][0-9]{0,19}$/.test(order.netsuiteId)) throw new Error("Respuesta NetSuite invalida");
    return { source: order.source as "native" | "legacy", id: order.id, netsuiteId: order.netsuiteId };
}
function parseNetsuiteResult(value: unknown): NetsuiteOrderResult {
    const response = object(value);
    if (response.schemaVersion !== 1 || !("data" in response)) throw new Error("Respuesta NetSuite invalida");
    return { schemaVersion: 1, order: parseOrder(response.order), data: response.data };
}

export interface NetsuiteSynchronizationContext {
    readonly environment: "production" | "sandbox";
    readonly canSynchronize: boolean;
}
function synchronizationPath(identity: NetsuiteOrderIdentity): string {
    const id = identity.source === "legacy" ? identity.id.replace(/^legacy:/, "") : identity.id;
    const valid = identity.source === "legacy" ? /^[1-9][0-9]{0,9}$/.test(id) : /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id);
    if (!valid) throw new Error("Identidad de orden invalida");
    return "/formalization/orders/" + identity.source + "/" + encodeURIComponent(id) + "/netsuite";
}
/** Environment comes from the authenticated server, independently of browser location. */
export async function getNetsuiteSynchronizationContext(identity: NetsuiteOrderIdentity): Promise<NetsuiteSynchronizationContext> {
    const result = object(await apiRequest<unknown>(synchronizationPath(identity) + "/context"));
    if (!["production", "sandbox"].includes(String(result.environment)) || typeof result.canSynchronize !== "boolean") throw new Error("Contexto NetSuite invalido");
    return { environment: result.environment as "production" | "sandbox", canSynchronize: result.canSynchronize };
}
/** Pull an authorized server snapshot; the browser never supplies provider fields. */
export async function synchronizeNetsuiteOrder(identity: NetsuiteOrderIdentity) {
    const result = object(await apiRequest<unknown>(synchronizationPath(identity) + "/sync", { method: "POST", body: {} }));
    if (result.persisted !== true || !["applied", "unchanged"].includes(String(result.result)) || !["native", "legacy"].includes(String(result.destination)) || !["production", "sandbox"].includes(String(result.environment)) || !Number.isSafeInteger(result.changes) || Number(result.changes) < 0) throw new Error("No se confirmo la sincronizacion");
    return { result: String(result.result), changes: Number(result.changes), environment: result.environment as "production" | "sandbox", destination: result.destination as "native" | "legacy" };
}
