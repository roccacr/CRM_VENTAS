import { apiRequest } from "../api/api-client";
import type { NetsuiteOrderIdentity } from "./netsuite-order-service";

export type OrderAddendumStatus = "pending" | "completed" | "cancelled" | "sent";
export interface OrderAddendum {
    readonly availableForPending?: boolean;
    readonly note?: string | null;
    readonly canMarkPending?: boolean;
    readonly canMarkSent?: boolean;
    readonly schemaVersion: 1;
    readonly source: "native" | "legacy";
    readonly id: string;
    readonly status: OrderAddendumStatus | null;
    readonly version: number;
    readonly changedAt: string | null;
    readonly canUpdate: boolean;
}
export interface OrderAddendumCommand extends NetsuiteOrderIdentity {
    readonly status: "completed" | "cancelled";
    readonly expectedVersion: number;
    readonly operationId: string;
}
export interface PendingAddendumCommand extends NetsuiteOrderIdentity {
    readonly expectedVersion: number;
    readonly operationId: string;
    readonly note: string;
}
export interface FutureOrderAddendum {
    readonly schemaVersion: 1;
    readonly source: "native" | "legacy";
    readonly id: string;
    readonly blocked: boolean;
    readonly existing: { readonly id: string; readonly start: string } | null;
}
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Respuesta de adéndum inválida.");
    return value as Record<string, unknown>;
}
function identity(value: NetsuiteOrderIdentity): NetsuiteOrderIdentity {
    const id = value.source === "legacy" ? value.id.replace(/^legacy:/u, "") : value.id;
    const valid = value.source === "legacy" ? /^[1-9][0-9]{0,9}$/.test(id) : /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id);
    if (!valid) throw new Error("Identidad de orden inválida.");
    return { source: value.source, id };
}
function validDate(value: unknown): value is string | null {
    return value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)));
}
function read(value: unknown): OrderAddendum {
    const data = object(value);
    const valid = [data.schemaVersion === 1, ["native", "legacy"].includes(String(data.source)), typeof data.id === "string", [null, "pending", "completed", "cancelled", "sent"].includes(data.status as string | null), typeof data.version === "number", Number.isSafeInteger(data.version), Number(data.version) >= 0, validDate(data.changedAt), typeof data.canUpdate === "boolean"].every(Boolean);
    if (!valid) throw new Error("Respuesta de adéndum inválida.");
    const order = identity({ source: data.source as OrderAddendum["source"], id: data.id as string });
    if (data.availableForPending !== undefined && typeof data.availableForPending !== "boolean") throw new Error("Respuesta de adéndum inválida.");
    return { schemaVersion: 1, ...order, ...(data.availableForPending === undefined ? {} : { availableForPending: data.availableForPending }), status: data.status as OrderAddendum["status"], version: data.version as number, changedAt: data.changedAt as string | null, canUpdate: data.canUpdate as boolean, ...readManualMetadata(data) };
}
function readManualMetadata(data: Record<string, unknown>): Pick<OrderAddendum, "note" | "canMarkPending" | "canMarkSent"> {
    const noteValid = [data.note === undefined, data.note === null, typeof data.note === "string"].some(Boolean);
    const capabilityValid = data.canMarkPending === undefined || typeof data.canMarkPending === "boolean";
    if ([!noteValid, !capabilityValid, [data.canMarkSent !== undefined, typeof data.canMarkSent !== "boolean"].every(Boolean)].some(Boolean)) throw new Error("Respuesta de adéndum inválida.");
    return { ...(data.canMarkSent === undefined ? {} : { canMarkSent: data.canMarkSent as boolean }), ...(data.note === undefined ? {} : { note: data.note as string | null }), ...(data.canMarkPending === undefined ? {} : { canMarkPending: data.canMarkPending as boolean }) };
}
/** El marcador se consulta por identidad CRM; nunca por el nombre del cliente o el ID de un evento. */
export async function getOrderAddendum(order: NetsuiteOrderIdentity): Promise<OrderAddendum> {
    const key = identity(order);
    const query = new URLSearchParams({ source: key.source, id: key.id });
    return read(await apiRequest<unknown>(`/formalization/orders/addendum?${query.toString()}`));
}
/** El preflight agrupa lecturas autorizadas para no agotar el límite HTTP al seleccionar todas. */
export async function previewSelectedOrderAddendums(orders: readonly NetsuiteOrderIdentity[]): Promise<readonly (OrderAddendum | null)[]> {
    if (!orders.length || orders.length > 100) throw new Error("Selecciona entre 1 y 100 órdenes por consulta.");
    const targets = orders.map(identity);
    const result = object(await apiRequest<unknown>("/formalization/orders/addendum/pending/preview", { method: "POST", body: { orders: targets }, retryOnUnauthorized: false }));
    if (!Array.isArray(result.items) || result.items.length !== targets.length) throw new Error("Consulta de selección inválida.");
    return result.items.map((value, index) => {
        const entry = object(value);
        const target = targets[index];
        if (!target || entry.source !== target.source || entry.id !== target.id) throw new Error("Consulta de selección inválida.");
        return entry.order === null ? null : read(entry.order);
    });
}
/** Conserva la misma operación en reintentos inciertos; el BFF aporta cookies y CSRF. */
export async function updateOrderAddendum(command: OrderAddendumCommand): Promise<OrderAddendum & { readonly replayed: boolean }> {
    const body = { ...command, ...identity(command) };
    return postAddendum("/formalization/orders/addendum", body);
}
async function postAddendum(path: string, body: unknown): Promise<OrderAddendum & { readonly replayed: boolean }> {
    const result = object(await apiRequest<unknown>(path, { method: "POST", body, retryOnUnauthorized: false }));
    if (typeof result.replayed !== "boolean") throw new Error("Respuesta de adéndum inválida.");
    return { ...read(result), replayed: result.replayed };
}
/** La marcación manual no crea eventos y conserva el motivo obligatorio dentro de la misma operación auditable. */
export async function markOrderAddendumPending(command: PendingAddendumCommand): Promise<OrderAddendum & { readonly replayed: boolean }> {
    return postPendingAddendum(command, "/formalization/orders/addendum/pending");
}
/** La acción masiva permite renovar pendientes; cada orden conserva versión y operación propias. */
export async function markSelectedOrderAddendumPending(command: PendingAddendumCommand): Promise<OrderAddendum & { readonly replayed: boolean }> {
    return postPendingAddendum(command, "/formalization/orders/addendum/pending/bulk-item");
}
async function postPendingAddendum(command: PendingAddendumCommand, path: string): Promise<OrderAddendum & { readonly replayed: boolean }> {
    const note = command.note.trim();
    if (note.length < 3 || note.length > 2000) throw new Error("El motivo debe tener entre 3 y 2000 caracteres.");
    const { note: _note, ...rest } = command;
    return postAddendum(path, { ...rest, ...identity(command), note });
}
/** Un resultado no confirmado nunca se presenta como cero pendientes. */
export async function getPendingAddendumCount(): Promise<number> {
    const result = object(await apiRequest<unknown>("/formalization/addendum/summary"));
    if (typeof result.total !== "number" || !Number.isSafeInteger(result.total) || result.total < 0) throw new Error("Conteo de adéndums inválido.");
    return result.total;
}
/** La API decide el futuro con su reloj y resuelve aliases; el navegador no limita la consulta a la semana visible. */
export async function getFutureOrderAddendum(order: NetsuiteOrderIdentity, excludeEventId?: string): Promise<FutureOrderAddendum> {
    const key = identity(order);
    const query = new URLSearchParams({ source: key.source, id: key.id });
    if (excludeEventId) query.set("excludeEventId", excludeEventId);
    const data = object(await apiRequest<unknown>(`/formalization/orders/addendum/future?${query.toString()}`));
    const valid = [data.schemaVersion === 1, ["native", "legacy"].includes(String(data.source)), typeof data.id === "string", typeof data.blocked === "boolean"].every(Boolean);
    if (!valid) throw new Error("Verificación de adéndum inválida.");
    const existing = futureAddendumReference(data.existing);
    if (data.existing !== null && !existing) throw new Error("Verificación de adéndum inválida.");
    if (data.blocked === false && existing) throw new Error("Verificación de adéndum inválida.");
    return { schemaVersion: 1, ...identity({ source: data.source as NetsuiteOrderIdentity["source"], id: data.id as string }), blocked: data.blocked as boolean, existing };
}
/** Valida únicamente los datos del evento que el API autorizó a mostrar. */
export function futureAddendumReference(value: unknown): FutureOrderAddendum["existing"] {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const reference = value as Record<string, unknown>;
    if (typeof reference.id !== "string" || typeof reference.start !== "string" || !validDate(reference.start)) return null;
    return { id: reference.id, start: reference.start };
}
/** Un evento restringido bloquea igualmente, sin revelar su identidad ni sus datos. */
export function futureAddendumMessage(existing: FutureOrderAddendum["existing"]): string {
    const when = existing ? ` el ${new Date(existing.start).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}` : "";
    return `Ya existe un Adéndum futuro para esta orden${when}. No se puede crear otro.`;
}

/** Registrar enviado conserva la versión y operación; no envía correo ni reintenta automáticamente. */
export async function markOrderAddendumSent(command: Omit<OrderAddendumCommand, "status">): Promise<OrderAddendum & { readonly replayed: boolean }> {
    return postAddendum("/formalization/orders/addendum/sent", { ...command, ...identity(command) });
}
