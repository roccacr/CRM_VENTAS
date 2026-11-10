import { apiRequest } from "../api/api-client";

export type PurchaseFundsOrigin = "own_funds" | "bank_financing";
export interface FundsSnapshot {
    readonly purchaseFundsOrigin: PurchaseFundsOrigin | null;
    readonly sequence: number;
    readonly auditSequence: number;
}
export interface FundsCommand {
    readonly source: "native" | "legacy";
    readonly id: string;
    readonly operationId: string;
    readonly expectedSequence: number;
    readonly expectedAuditSequence: number;
    readonly expectedPurchaseFundsOrigin: PurchaseFundsOrigin | null;
    readonly purchaseFundsOrigin: PurchaseFundsOrigin;
}

/** El token de edición sale de la orden autoritativa, no solo de la secuencia de etapa. */
export async function getPurchaseFunds(source: "native" | "legacy", id: string): Promise<FundsSnapshot> {
    const data = await apiRequest<FundsSnapshot | null>(`/formalization/orders/${source}/${encodeURIComponent(id.replace(/^legacy:/, ""))}/purchase-funds`);
    if (!data || ![null, "own_funds", "bank_financing"].includes(data.purchaseFundsOrigin) || !Number.isSafeInteger(data.sequence) || data.sequence < 0 || !Number.isSafeInteger(data.auditSequence) || data.auditSequence < 0) throw new Error("Respuesta de fondos inválida");
    return data;
}

/** El CSRF y la sesión quedan en el cliente compartido. Una mutación no se reintenta sola. */
export async function savePurchaseFunds(command: FundsCommand): Promise<void> {
    const data = await apiRequest<{ purchaseFundsOrigin: PurchaseFundsOrigin; sequence: number; replayed: boolean } | null>("/formalization/orders/purchase-funds", { method: "POST", body: { ...command, id: command.id.replace(/^legacy:/, "") }, retryOnUnauthorized: false });
    if (!data || data.purchaseFundsOrigin !== command.purchaseFundsOrigin || data.sequence !== command.expectedSequence || typeof data.replayed !== "boolean") throw new Error("Respuesta de fondos inválida");
}
