import { apiRequest } from "../api/api-client";

/** Reads the canonical count; errors must never be rendered as zero. */
export async function getApprovalCount(): Promise<number> {
    const result = await apiRequest<{ total: unknown }>("/formalization/approvals/summary");
    if (import.meta.env.DEV) {
        console.log("[Formalization API: approvals/summary] Incoming JSON", result);
    }
    if (typeof result.total !== "number" || !Number.isSafeInteger(result.total) || result.total < 0) {
        throw new Error("Invalid approval summary");
    }
    return result.total;
}
