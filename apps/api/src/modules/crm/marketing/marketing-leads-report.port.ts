import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { ReportSource } from "./marketing-leads-report.contract.js";

export const MARKETING_LEADS_REPORT_LEGACY_READER = Symbol("MARKETING_LEADS_REPORT_LEGACY_READER");
/** Fuente opcional. Comparte la foto nativa de solo lectura y no copia registros de negocio. */
export interface MarketingLeadsReportLegacyReader {
    enabled(): boolean;
    read(tx: Transaction<CrmDatabase>): Promise<ReportSource>;
}
