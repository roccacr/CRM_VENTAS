import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";

/** Injection token for the legacy contract-transition adapter. */
export const CONTRACT_TRANSITION_LEGACY = Symbol("CONTRACT_TRANSITION_LEGACY");
/** Locked order snapshot; `active` and `approved` gate whether a transition is allowed at all. */
export interface ContractOrder {
    id: string;
    businessId: string;
    active: boolean;
    approved: boolean;
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
}

/** Adapter uses ONLY the provided canonical transaction; never a separate writable pool. */
export interface ContractTransitionLegacy {
    lock(tx: Transaction<CrmDatabase>, id: string): Promise<ContractOrder | undefined>;
    event(tx: Transaction<CrmDatabase>, id: string, operationId?: string): Promise<ContractEvent | undefined>;
    append(tx: Transaction<CrmDatabase>, id: string, event: ContractEventWrite): Promise<void>;
}
