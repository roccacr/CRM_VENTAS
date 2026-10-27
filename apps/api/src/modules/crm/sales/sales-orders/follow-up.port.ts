import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { FollowUpAccess, FollowUpPeriod, FollowUpRead, FollowUpSourcePage } from "./follow-up.contract.js";

export const FOLLOW_UP_LEGACY_READER = Symbol("FOLLOW_UP_LEGACY_READER");
/** One bounded legacy SELECT inside the native-first read-only transaction. */
export interface FollowUpLegacyReader {
    enabled(): boolean;
    read(tx: Transaction<CrmDatabase>, query: FollowUpRead, period: FollowUpPeriod, access: FollowUpAccess): Promise<FollowUpSourcePage>;
}
