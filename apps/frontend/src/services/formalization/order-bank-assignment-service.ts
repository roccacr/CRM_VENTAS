import { apiRequest } from "../api/api-client";
import { type Bank, type BankAdvisor, parseBank, parseBankAdvisor } from "../catalogs/banks-service";
import type { NetsuiteOrderIdentity } from "./netsuite-order-service";
export interface OrderBankAssignment extends NetsuiteOrderIdentity {
    readonly version: number;
    readonly bank: Bank | null;
    readonly advisor: BankAdvisor | null;
    readonly changedAt: string | null;
}
export interface OrderBankAssignmentCommand {
    readonly bankPublicId: string;
    readonly advisorPublicId: string;
    readonly expectedVersion: number;
    readonly reason: string;
}
function path(order: NetsuiteOrderIdentity) {
    const id = order.source === "legacy" ? order.id.replace(/^legacy:/u, "") : order.id;
    return `/formalization/orders/${order.source}/${encodeURIComponent(id)}/bank-assignment`;
}
function parse(value: unknown): OrderBankAssignment {
    if ([!value, typeof value !== "object"].some(Boolean)) throw new TypeError("Asignación bancaria inválida.");
    const data = value as Record<string, unknown>;
    const validDate = assignmentDate(data.changedAt);
    if (![["native", "legacy"].includes(String(data.source)), typeof data.id === "string", Number.isSafeInteger(data.version), Number(data.version) >= 0, validDate].every(Boolean)) throw new TypeError("Asignación bancaria inválida.");
    const bank = data.bank === null ? null : parseBank(data.bank);
    const advisor = data.advisor === null ? null : parseBankAdvisor(data.advisor);
    if ([Boolean(bank) !== Boolean(advisor), advisor?.bankPublicId !== bank?.publicId].some(Boolean)) throw new TypeError("Asignación bancaria inválida.");
    return { source: data.source as OrderBankAssignment["source"], id: data.id as string, version: data.version as number, bank, advisor, changedAt: data.changedAt as string | null };
}
/** Reads the management link without changing the sales order. */
export async function getOrderBankAssignment(order: NetsuiteOrderIdentity, signal?: AbortSignal): Promise<OrderBankAssignment> {
    return parse(await apiRequest<unknown>(path(order), signal ? { signal } : {}));
}
/** Explicit versioned writes must never be automatically replayed after authentication. */
export async function saveOrderBankAssignment(order: NetsuiteOrderIdentity, body: OrderBankAssignmentCommand, signal?: AbortSignal): Promise<OrderBankAssignment> {
    return parse(await apiRequest<unknown>(path(order), { method: "POST", body, retryOnUnauthorized: false, ...(signal ? { signal } : {}) }));
}

function assignmentDate(value: unknown) {
    return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}
/** Unlink is an explicit versioned command and must never be replayed automatically. */
export async function unlinkOrderBankAssignment(order: NetsuiteOrderIdentity, body: Pick<OrderBankAssignmentCommand, "expectedVersion" | "reason">, signal?: AbortSignal): Promise<OrderBankAssignment> {
    return parse(await apiRequest<unknown>(`${path(order)}/unlink`, { method: "POST", body, retryOnUnauthorized: false, ...(signal ? { signal } : {}) }));
}
