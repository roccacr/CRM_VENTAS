import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";

/** Token del lector viejo de aprobaciones. */
export const APPROVAL_LEGACY_READER = Symbol("APPROVAL_LEGACY_READER");
/** Límite compartido de la página por clave. Una página más corta es el fin de esa lectura. */
export const SALES_ORDER_SUMMARY_PAGE_SIZE = 500;

/** Fuente temporal de solo lectura. Las páginas del cursor traen solo identidades viejas. */
export interface ApprovalLegacyReader {
    enabled(): boolean;
    pendingIds(after: number, transaction?: Transaction<CrmDatabase>): Promise<number[]>;
}
