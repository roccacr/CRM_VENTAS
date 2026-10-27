import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { LegacyMarketingData, MarketingWindow } from "./marketing-home.contract.js";

export const MARKETING_HOME_LEGACY_READER = Symbol("MARKETING_HOME_LEGACY_READER");
/** Optional read adapter. Never imports records and never creates users/projects during a report. */
export interface MarketingHomeLegacyReader {
    enabled(): boolean;
    read(transaction: Transaction<CrmDatabase>, window: MarketingWindow): Promise<LegacyMarketingData>;
}
