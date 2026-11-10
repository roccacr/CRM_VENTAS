import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { LegacyMarketingData, MarketingWindow } from "./marketing-home.contract.js";

export const MARKETING_HOME_LEGACY_READER = Symbol("MARKETING_HOME_LEGACY_READER");
/** Adaptador de lectura opcional. Durante el reporte no importa registros ni crea usuarios o proyectos. */
export interface MarketingHomeLegacyReader {
    enabled(): boolean;
    read(transaction: Transaction<CrmDatabase>, window: MarketingWindow): Promise<LegacyMarketingData>;
}
