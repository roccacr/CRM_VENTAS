import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { TimingOrder, TimingPage, TimingPagination } from "./order-timing.contract.js";

export const ORDER_TIMING_LEGACY_READER = Symbol("ORDER_TIMING_LEGACY_READER");
/** All reads use the canonical transaction; the adapter never grants authority to itself. */
export interface OrderTimingLegacyReader {
    enabled(): boolean;
    find(tx: Transaction<CrmDatabase>, id: string): Promise<TimingOrder | undefined>;
    read(tx: Transaction<CrmDatabase>, id: string, page: TimingPagination): Promise<TimingPage>;
}
