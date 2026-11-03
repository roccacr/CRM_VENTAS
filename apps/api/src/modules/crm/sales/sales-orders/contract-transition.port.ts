import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { AuditActorSnapshot } from "../../audit/audit-actor.js";
import type { PurchaseFundsOrigin } from "./contract-transition.dto.js";

/** Injection token for the legacy contract-transition adapter. */
export const CONTRACT_TRANSITION_LEGACY = Symbol("CONTRACT_TRANSITION_LEGACY");
/** Locked order snapshot; `active` and `approved` gate whether a transition is allowed at all. */
export interface ContractOrder {
    id: string;
    businessId: string;
    active: boolean;
    approved: boolean;
    /** Available excludes deleted/inactive records, independently of the lost-sale checkbox. */
    available?: boolean;
    saleLost?: boolean;
    contractSigned: boolean;
    installmentsFullyPaid: boolean | null;
    unitTransferred: boolean | null;
    keysDelivered: boolean | null;
    unitDelivered: boolean | null;
    purchaseFundsOrigin?: PurchaseFundsOrigin | null;
}
/** One entry of the stage journal; `sequence` is the optimistic-concurrency version. */
export interface ContractEvent {
    sequence: number;
    state: string;
    actor: string | null;
    reason: string;
}
/** New journal entry; `operationId` makes retries idempotent and `correlationId` ties it to audit. */
export interface ContractEventWrite extends ContractEvent {
    actor: string;
    from: string | null;
    operationId: string;
    correlationId: string;
    /** New API writes capture attribution; historical entries may have no evidence. */
    actorSnapshot?: AuditActorSnapshot;
    responsibleSnapshot?: AuditActorSnapshot;
    purchaseFundsOrigin?: PurchaseFundsOrigin | undefined;
}

/** Adapter uses ONLY the provided canonical transaction; never a separate writable pool. */
export interface ContractTransitionLegacy {
    lock(tx: Transaction<CrmDatabase>, id: string, readOnly?: boolean): Promise<ContractOrder | undefined>;
    /** Resolve a unique live native owner under the caller's transaction; ambiguity returns null. */
    owner(tx: Transaction<CrmDatabase>, id: string): Promise<string | null>;
    event(tx: Transaction<CrmDatabase>, id: string, operationId?: string): Promise<ContractEvent | undefined>;
    append(tx: Transaction<CrmDatabase>, id: string, event: ContractEventWrite): Promise<void>;
    /** Classification only: never creates a stage visit. Uses the same gated transaction. */
    updatePurchaseFunds(tx: Transaction<CrmDatabase>, id: string, origin: PurchaseFundsOrigin): Promise<void>;
}
