import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";

/** Injection token for the legacy contract-summary reader. */
export const CONTRACT_SUMMARY_LEGACY_READER = Symbol("CONTRACT_SUMMARY_LEGACY_READER");
/** Banner counters: orders waiting to be sent vs. sent and waiting for the customer signature. */
export type ContractCounts = { toSend: number; pendingSignature: number };
/** `state` is the latest stage-journal value; `id` is the keyset cursor. */
export type LegacyContractRow = { id: number; state: string };

/** Read-only pages from the authoritative legacy stage journal, not inferred ERP send flags. */
export interface ContractSummaryLegacyReader {
    enabled(): boolean;
    pending(after: number, transaction: Transaction<CrmDatabase>): Promise<LegacyContractRow[]>;
}
