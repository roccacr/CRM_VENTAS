import { apiRequest } from "../api/api-client";
import { ORDER_STAGES } from "./order-stage-service";

interface ApprovalCommand {
    readonly source: "native" | "legacy";
    readonly id: string;
    readonly expectedSequence: number;
    readonly operationId: string;
}
/** La aprobación conserva la identidad y la idempotencia. Una repetición puede informar una etapa posterior ya conocida y no la devuelve atrás. */
export async function approveFormalizationOrder(command: ApprovalCommand): Promise<{ readonly alreadyApproved: boolean }> {
    const id = command.source === "legacy" ? command.id.replace(/^legacy:/, "") : command.id;
    const result = await apiRequest<unknown>("/formalization/orders/approve", { method: "POST", body: { ...command, id }, retryOnUnauthorized: false });
    return validateApproval(result, command.source, id);
}
function validateApproval(result: unknown, source: string, id: string): { readonly alreadyApproved: boolean } {
    if (!result || typeof result !== "object") throw new Error("Invalid approval response");
    const data = result as Record<string, unknown>;
    if ([!validIdentity(data, source, id), data.approved !== true, !ORDER_STAGES.some((stage) => stage.code === data.state)].some(Boolean)) throw new Error("Invalid approval response");
    if ([!validSequence(data.sequence), typeof data.replayed !== "boolean", data.alreadyApproved !== undefined && typeof data.alreadyApproved !== "boolean"].some(Boolean)) throw new Error("Invalid approval response");
    return { alreadyApproved: data.alreadyApproved === true };
}

function validSequence(value: unknown): boolean {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/** Un alias anterior puede resolverse al ULID nativo autoritativo. Una identidad nativa no se degrada ni se cambia. */
function validIdentity(data: Record<string, unknown>, source: string, id: string): boolean {
    if (data.source === source) return data.id === id;
    return source === "legacy" && data.source === "native" && typeof data.id === "string" && /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(data.id);
}
