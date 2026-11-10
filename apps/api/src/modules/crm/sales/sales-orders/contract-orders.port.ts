import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { ContractOrderPageRow, ContractQueue } from "./contract-orders.dto.js";

/** Token del lector viejo de órdenes de contrato. */
export const CONTRACT_ORDERS_LEGACY_READER = Symbol("CONTRACT_ORDERS_LEGACY_READER");

/** Califican solo las filas viejas que no migraron. Cada lectura usa la foto compartida de quien llama. */
export interface ContractOrdersLegacyReader {
    enabled(): boolean;
    orders(tx: Transaction<CrmDatabase>, queue: ContractQueue, after: string, limit: number): Promise<ContractOrderPageRow[]>;
}
