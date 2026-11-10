import { apiRequest } from "../api/api-client";

export interface RecentOrderActivity {
    readonly id: string;
    readonly orderNumber: string;
    readonly action: string;
    readonly at: string;
    readonly fromState: string | null;
    readonly toState: string | null;
    readonly approval: string | null;
}

/** El servidor elige al actor autenticado y aplica el límite de seis eventos. */
export async function getRecentOrderActivity(): Promise<readonly RecentOrderActivity[]> {
    const body = object(await apiRequest<unknown>("/formalization/home/recent-activity"));
    if (body.schemaVersion !== 1 || !Array.isArray(body.items) || body.items.length > 6) throw new Error("Movimientos inválidos");
    return body.items.map(readEvent);
}
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Movimientos inválidos");
    return value as Record<string, unknown>;
}
function text(value: unknown): string {
    if (typeof value !== "string" || !value.trim() || value.length > 140) throw new Error("Movimiento inválido");
    return value;
}
function nullableText(value: unknown): string | null {
    return value === null ? null : text(value);
}
function readEvent(value: unknown): RecentOrderActivity {
    const row = object(value);
    const at = text(row.at);
    if (!at.endsWith("Z") || !Number.isFinite(Date.parse(at))) throw new Error("Fecha de movimiento inválida");
    return { id: text(row.id), orderNumber: text(row.orderNumber), action: text(row.action), at, fromState: nullableText(row.fromState), toState: nullableText(row.toState), approval: nullableText(row.approval) };
}
