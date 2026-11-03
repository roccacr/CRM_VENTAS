import type { RawBuilder, Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { FollowUpAccess, FollowUpDatabaseRow, FollowUpPeriod, FollowUpRead, FollowUpSourcePage } from "./follow-up.contract.js";

export const FOLLOW_UP_LEGACY_READER = Symbol("FOLLOW_UP_LEGACY_READER");
/** Legacy reads and the federated portfolio share the caller's read-only snapshot. */
export interface FollowUpLegacyReader {
    enabled(): boolean;
    /** Source aliases are composed into one globally paginated read on the shared snapshot. */
    projection(period: FollowUpPeriod): RawBuilder<unknown>;
    readRecord(tx: Transaction<CrmDatabase>, id: string, period: FollowUpPeriod): Promise<FollowUpDatabaseRow | undefined>;
    read(tx: Transaction<CrmDatabase>, query: FollowUpRead, period: FollowUpPeriod, access: FollowUpAccess): Promise<FollowUpSourcePage>;
}
