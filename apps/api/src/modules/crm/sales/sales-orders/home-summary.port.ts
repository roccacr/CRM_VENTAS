import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { HomeSummaryPeriod, StageCounts } from "./home-summary.types.js";

/** Injection token for the optional legacy source of the Home summary. */
export const HOME_SUMMARY_LEGACY_READER = Symbol("HOME_SUMMARY_LEGACY_READER");

/**
 * Read-only aggregate over legacy orders. It runs inside the caller's transaction so native and
 * legacy counts come from one snapshot; `duplicatesExcluded` reports legacy rows already migrated.
 */
export interface HomeSummaryLegacyReader {
    enabled(): boolean;
    aggregate(tx: Transaction<CrmDatabase>, period: HomeSummaryPeriod): Promise<{ counts: StageCounts; duplicatesExcluded: number }>;
}
