import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { HomeSummaryLegacyReader } from "../../modules/crm/sales/sales-orders/home-summary.port.js";
import { aggregateNumber, type HomeSummaryPeriod, type StageAggregateRow, stageCountsFromRow } from "../../modules/crm/sales/sales-orders/home-summary.types.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";

/**
 * Legacy side of the Home counters. `shadowed` marks legacy orders that already have a native alias:
 * they are excluded from every counter and reported in `duplicatesExcluded`. Approvals are the legacy
 * flags (sales head, RDR, formalization). One bounded result, using the same native transaction for cross-schema snapshot consistency. */
@Injectable()
export class LegacyHomeSummaryReader implements HomeSummaryLegacyReader {
    /** Reuses the configured fallback switch; no additional pool is opened. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}

    /** Disabled fallback contributes no rows and triggers no aggregate SELECT. */
    enabled(): boolean {
        return this.database.isConfigured();
    }

    /** Every native alias shadows legacy. Any effective closure this year credits an eligible order once, even after reopening. */
    async aggregate(tx: Transaction<CrmDatabase>, period: HomeSummaryPeriod) {
        const result = await sql<StageAggregateRow>`
            SELECT /*+ MAX_EXECUTION_TIME(1500) */
                SUM(NOT shadowed AND approved AND COALESCE(stage,'contract_pending_send') IN ('unclassified','pending_approval','contract_pending_send')) AS toSend,
                SUM(NOT shadowed AND approved AND stage='contract_pending_signature') AS pendingSignature,
                SUM(NOT shadowed AND stage='bank_management') AS banking, SUM(NOT shadowed AND stage='pending_balance') AS balance,
                SUM(NOT shadowed AND stage='pending_transfer') AS transferPending, SUM(NOT shadowed AND stage='transfer_signed') AS transferSigned,
                SUM(NOT shadowed AND completed_this_year) AS closedThisYear,
                SUM(shadowed) AS duplicatesExcluded
            FROM (
                SELECT e.to_state_code_sales_order_state_event AS stage,
                    EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} closed_event
                        WHERE closed_event.legacy_order_id_sales_order_state_event=o.id_ov AND closed_event.to_state_code_sales_order_state_event='closed'
                        AND closed_event.effective_at_sales_order_state_event >= ${period.start.slice(0, 23).replace("T", " ")} AND closed_event.effective_at_sales_order_state_event < ${period.endExclusive.slice(0, 23).replace("T", " ")}) AS completed_this_year,
                    (o.chekJefeVenta=1 AND o.aprobacion__rdr_ov=1 AND o.aprobacion_forma_ov=1) AS approved,
                    EXISTS(SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov) AS shadowed
                FROM ${sql.table("crmdatabase-api.ordenventa")} o
                LEFT JOIN ${sql.table("crmdatabase-api.audit_sales_order_state_event")} e ON e.id_sales_order_state_event=(
                    SELECT latest.id_sales_order_state_event FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} latest
                    WHERE latest.legacy_order_id_sales_order_state_event=o.id_ov ORDER BY latest.sequence_sales_order_state_event DESC LIMIT 1)
                WHERE o.status_ov=1 AND o.caida_ov=0
            ) current_orders
        `.execute(tx);
        const row = result.rows[0];
        const counts = stageCountsFromRow(row);
        if (row?.duplicatesExcluded === undefined) throw new Error("Missing Home duplicate aggregate");
        return { counts, duplicatesExcluded: aggregateNumber(row.duplicatesExcluded) };
    }
}
