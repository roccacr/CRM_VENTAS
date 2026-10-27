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
    const id = identity.source === "legacy" ? identity.id.replace(/^legacy:/, "") : identity.id;
    const valid = identity.source === "legacy" ? /^[1-9][0-9]{0,9}$/.test(id) : /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id);
    if (!valid) throw new Error("Identidad de orden invalida");
    const result = await apiRequest<unknown>("/formalization/orders/" + identity.source + "/" + encodeURIComponent(id) + "/netsuite");
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
