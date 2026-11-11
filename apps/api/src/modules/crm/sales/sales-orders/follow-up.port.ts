import type { RawBuilder, Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { FollowUpAccess, FollowUpDatabaseRow, FollowUpPeriod, FollowUpRead, FollowUpSourcePage } from "./follow-up.contract.js";

export const FOLLOW_UP_LEGACY_READER = Symbol("FOLLOW_UP_LEGACY_READER");
/** La lectura vieja y el portafolio federado comparten la foto de solo lectura de quien llama. */
export interface FollowUpLegacyReader {
    enabled(): boolean;
    /** Los alias de origen se componen en una lectura paginada global, sobre la foto compartida. */
    projection(period: FollowUpPeriod, includeInactive?: boolean): RawBuilder<unknown>;
    readRecord(tx: Transaction<CrmDatabase>, id: string, period: FollowUpPeriod): Promise<FollowUpDatabaseRow | undefined>;
    read(tx: Transaction<CrmDatabase>, query: FollowUpRead, period: FollowUpPeriod, access: FollowUpAccess): Promise<FollowUpSourcePage>;
}
