import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { TimingOrder, TimingPage, TimingPagination } from "./order-timing.contract.js";

export const ORDER_TIMING_LEGACY_READER = Symbol("ORDER_TIMING_LEGACY_READER");
/** Todas las lecturas usan la transacción canónica. El adaptador no se concede autoridad. */
export interface OrderTimingLegacyReader {
    enabled(): boolean;
    find(tx: Transaction<CrmDatabase>, id: string): Promise<TimingOrder | undefined>;
    read(tx: Transaction<CrmDatabase>, id: string, page: TimingPagination): Promise<TimingPage>;
}
