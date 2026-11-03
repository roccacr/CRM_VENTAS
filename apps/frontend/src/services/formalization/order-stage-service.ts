import { apiRequest } from "../api/api-client";

export const ORDER_STAGES = [
    { code: "contract_pending_send", label: "Por enviar" },
    { code: "contract_pending_signature", label: "Pendiente de firma" },
    { code: "bank_management", label: "Gestión bancaria" },
    { code: "bank_management_in_progress", label: "Gestión bancaria en proceso" },
    { code: "pending_balance", label: "Pendiente de saldo" },
    { code: "pending_transfer", label: "Traspaso pendiente" },
    { code: "transfer_signed", label: "Traspaso firmado" },
    { code: "closed", label: "Formalización cerrada" },
] as const;
export type OrderStage = (typeof ORDER_STAGES)[number]["code"];
export interface StageCommand {
    readonly source: "native" | "legacy";
    readonly id: string;
    readonly expectedSequence: number;
    readonly operationId: string;
    readonly targetState: OrderStage;
    readonly reason?: string;
    readonly purchaseFundsOrigin?: "own_funds" | "bank_financing" | null;
}
/** Uses the BFF's existing cookie/CSRF client; business conflicts never trigger automatic replay. */
export async function updateOrderStage(command: StageCommand) {
    const id = command.source === "legacy" ? command.id.replace(/^legacy:/, "") : command.id;
    const result = await apiRequest<unknown>("/formalization/orders/stage", { method: "POST", body: { ...command, id }, retryOnUnauthorized: false });
    return parseStageResult(result, command.targetState);
}
function parseStageResult(result: unknown, state: OrderStage) {
    if (!result || typeof result !== "object") throw new Error("Invalid order stage response");
    const data = result as Record<string, unknown>;
    if (!["native", "legacy"].includes(String(data.source)) || typeof data.id !== "string" || data.state !== state) throw new Error("Invalid order stage response");
    if (!validSequence(data.sequence) || typeof data.replayed !== "boolean") throw new Error("Invalid order stage response");
    return { source: data.source, id: data.id, state, sequence: data.sequence, replayed: data.replayed };
}

function validSequence(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}
