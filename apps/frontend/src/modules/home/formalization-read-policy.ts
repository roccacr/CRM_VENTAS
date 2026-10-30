import type { IdentityRole } from "../../services/auth/identity-contracts";
import { FOLLOW_UP_QUEUES, type FollowUpQueue } from "../../services/formalization/follow-up-service";

const categoryByQueue = { approvals: "approvals", contracts: "contracts", send: "contracts", signature: "contracts", bank: "banking", balance: "balance", transfer: "transfer_pending", signed: "transfer_signed", closed: "closed" } as const;
const granularCodes = [
    ...new Set(
        Object.values(categoryByQueue)
            .filter((category) => category !== "approvals")
            .map((category) => `formalizacion.home.${category}.read`),
    ),
];
type Permission = { readonly code: string; readonly effect: string };

/** Effective API grants only; a granular entry disables umbrella compatibility for every category. */
export function formalizationReadQueues(roles: readonly IdentityRole[] | undefined, permissions: readonly Permission[] = []): readonly FollowUpQueue[] {
    if (!roles?.some((role) => ["formalizacion", "jefe_formalizaciones"].includes(role.code) && role.status === "active")) return [];
    const allowed = (code: string) => permissions.some((entry) => entry.code === code && entry.effect === "allow") && !permissions.some((entry) => entry.code === code && entry.effect === "deny");
    const legacy = !permissions.some((entry) => granularCodes.includes(entry.code)) && allowed("formalizacion.home.stages.read");
    const queues = FOLLOW_UP_QUEUES.filter((queue) => queue !== "all" && (allowed(`formalizacion.home.${categoryByQueue[queue]}.read`) || (queue !== "approvals" && legacy)));
    return queues.length ? ["all", ...queues] : [];
}

/** Detail authority is independent of every banner/list grant; explicit deny wins. */
export function canReadFormalizationOrder(roles: readonly IdentityRole[] | undefined, permissions: readonly Permission[] = []): boolean {
    return roles?.some((role) => ["formalizacion", "jefe_formalizaciones"].includes(role.code) && role.status === "active") === true && permissions.some((entry) => entry.code === "formalizacion.orders.read" && entry.effect === "allow") && !permissions.some((entry) => entry.code === "formalizacion.orders.read" && entry.effect === "deny");
}
