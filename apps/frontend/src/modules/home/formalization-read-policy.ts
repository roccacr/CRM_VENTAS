import type { IdentityRole } from "../../services/auth/identity-contracts";
import { FOLLOW_UP_QUEUES, type FollowUpQueue } from "../../services/formalization/follow-up-service";
import { canReadOrderAddendum } from "./order-addendum-permissions";

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
export function formalizationReadQueues(_roles: readonly IdentityRole[] | undefined, permissions: readonly Permission[] = []): readonly FollowUpQueue[] {
    const allowed = (code: string) => permissions.some((entry) => entry.code === code && entry.effect === "allow") && !permissions.some((entry) => entry.code === code && entry.effect === "deny");
    const legacy = !permissions.some((entry) => granularCodes.includes(entry.code)) && allowed("formalizacion.home.stages.read");
    const queues = FOLLOW_UP_QUEUES.filter((queue) => {
        if (queue === "addendum") return canReadOrderAddendum(permissions);
        return queue !== "all" && (allowed(`formalizacion.home.${categoryByQueue[queue]}.read`) || (queue !== "approvals" && legacy));
    });
    return queues.length ? ["all", ...queues] : [];
}

/** Detail authority is independent of every banner/list grant; explicit deny wins. */
export function canReadFormalizationOrder(_roles: readonly IdentityRole[] | undefined, permissions: readonly Permission[] = []): boolean {
    return permissions.some((entry) => entry.code === "formalizacion.orders.read" && entry.effect === "allow") && !permissions.some((entry) => entry.code === "formalizacion.orders.read" && entry.effect === "deny");
}

/** El conteo del banner no concede acceso a las órdenes de su bandeja. */
export function canReadAddendumBanner(_roles: readonly IdentityRole[] | undefined, permissions: readonly Permission[] = []): boolean {
    const entries = permissions.filter((entry) => entry.code === "formalizacion.home.addendum.read");
    return [entries.some((entry) => entry.effect === "allow"), !entries.some((entry) => entry.effect === "deny")].every(Boolean);
}
