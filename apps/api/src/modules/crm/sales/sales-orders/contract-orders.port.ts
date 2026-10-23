import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { ContractOrderPageRow, ContractQueue } from "./contract-orders.dto.js";

/** Injection token for the legacy contract-orders reader. */
export const CONTRACT_ORDERS_LEGACY_READER = Symbol("CONTRACT_ORDERS_LEGACY_READER");

/** Only nonmigrated legacy rows qualify; every read uses the caller's shared snapshot. */
export interface ContractOrdersLegacyReader {
    enabled(): boolean;
    orders(tx: Transaction<CrmDatabase>, queue: ContractQueue, after: string, limit: number): Promise<ContractOrderPageRow[]>;
}
