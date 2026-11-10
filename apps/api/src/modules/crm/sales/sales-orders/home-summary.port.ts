import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { HomeSummaryPeriod, StageCounts } from "./home-summary.types.js";

/** Token de la fuente vieja opcional del resumen de inicio. */
export const HOME_SUMMARY_LEGACY_READER = Symbol("HOME_SUMMARY_LEGACY_READER");

/**
 * Agregado de solo lectura sobre órdenes viejas. Corre dentro de la transacción de quien llama,
 * así los conteos nativos y viejos salen de una sola foto. `duplicatesExcluded` informa las filas viejas ya migradas.
 */
export interface HomeSummaryLegacyReader {
    enabled(): boolean;
    /** Como máximo seis etiquetas. Se resuelven sin trasladar registros comerciales. */
    orderLabels(tx: Transaction<CrmDatabase>, ids: readonly string[]): Promise<{ id: string; number: string | null }[]>;
    aggregate(tx: Transaction<CrmDatabase>, period: HomeSummaryPeriod): Promise<{ counts: StageCounts; duplicatesExcluded: number }>;
}
