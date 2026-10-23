import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";

/** Injection token for the legacy approval reader. */
export const APPROVAL_LEGACY_READER = Symbol("APPROVAL_LEGACY_READER");
/** Shared keyset limit: a shorter page is the end of the current read. */
export const SALES_ORDER_SUMMARY_PAGE_SIZE = 500;

/** Temporary read-only source; cursor pages contain legacy identities only. */
export interface ApprovalLegacyReader {
    enabled(): boolean;
    pendingIds(after: number, transaction?: Transaction<CrmDatabase>): Promise<number[]>;
}
