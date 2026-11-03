import type { OrderEventDestination, OrderFlagChange } from "./netsuite-order-event.mapper.js";

export const CANCELLATION_DATE_FIELD = "cancellationMarkedOn";
export const CANCELLATION_DATE_NATIVE = "cancellation_marked_on_sales_order";
export interface CancellationDateChange {
    field: string;
    column: string;
    before: unknown;
    after: string;
}
const marked = (value: unknown): boolean => value === "yes" || value === 1;

/** Fecha de la modificacion ERP, no de recepcion HTTP. Solo al entrar en caida; no toca lead, unidad, etapas ni comisiones. */
export function planSalesOrderCancellation(input: { destination: OrderEventDestination; before: Record<string, unknown>; changes: readonly OrderFlagChange[]; at: Date }): CancellationDateChange[] {
    const flag = input.changes.find((change) => change.field === "custbody43");
    if (!flag || !marked(flag.after) || marked(flag.before)) return [];
    const column = input.destination === "native" ? CANCELLATION_DATE_NATIVE : "envioReservaCaida";
    const value = input.before[column];
    // mysql2 representa DATE como Date local; recuperar su calendario, sin convertirlo a otra zona.
    const before = value instanceof Date ? [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-") : (value ?? null);
    const after = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit" }).format(input.at);
    return before === after ? [] : [{ field: CANCELLATION_DATE_FIELD, column, before, after }];
}
