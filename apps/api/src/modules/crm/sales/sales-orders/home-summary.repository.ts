import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import { DatabaseService } from "../../../../database/database.service.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import { type HomeSummaryPeriod, type StageAggregateRow, stageCountsFromRow } from "./home-summary.types.js";

/** Reads current stage truth and confirmed contract signature without cached counters. */
@Injectable()
export class HomeSummaryRepository {
    /** Uses the canonical pool for both schema reads. */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

    /** One snapshot assumes the two schemas are on the same InnoDB instance. */
    readSnapshot<T>(read: (tx: Transaction<CrmDatabase>) => Promise<T>): Promise<T> {
        return this.database.db.transaction().setIsolationLevel("repeatable read").setAccessMode("read only").execute(read);
    }

    /** Approvals gate contracts only. Any effective closure this year credits an eligible order once, even after reopening. */
    async aggregate(tx: Transaction<CrmDatabase>, period: HomeSummaryPeriod) {
        const result = await sql<StageAggregateRow>`
            SELECT /*+ MAX_EXECUTION_TIME(1500) */
                SUM(approved AND COALESCE(stage,'contract_pending_send') IN ('unclassified','pending_approval','contract_pending_send')) AS toSend,
                SUM(approved AND stage='contract_pending_signature') AS pendingSignature,
                SUM(contract_signed AND stage='bank_management') AS banking, SUM(contract_signed AND stage='pending_balance') AS balance,
                SUM(contract_signed AND stage='pending_transfer') AS transferPending, SUM(contract_signed AND stage='transfer_signed') AS transferSigned,
                SUM(contract_signed AND completed_this_year) AS closedThisYear
            FROM (
                SELECT e.to_state_code_sales_order_state_event AS stage, COALESCE(o.contract_signed_sales_order='yes',0) AS contract_signed,
                    EXISTS(SELECT 1 FROM audit_sales_order_state_event closed_event
                        WHERE closed_event.sales_order_id_sales_order_state_event=o.id_sales_order AND closed_event.to_state_code_sales_order_state_event='closed'
                        AND closed_event.effective_at_sales_order_state_event >= ${period.start.slice(0, 23).replace("T", " ")} AND closed_event.effective_at_sales_order_state_event < ${period.endExclusive.slice(0, 23).replace("T", " ")}) AS completed_this_year,
                    (SELECT COUNT(*) FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval=o.id_sales_order
                     AND a.type_code_sales_order_approval IN ('sales_management','developer','formalization') AND a.status_sales_order_approval='approved')=3 AS approved
                FROM crm_sales_order o
                LEFT JOIN audit_sales_order_state_event e ON e.id_sales_order_state_event=(
                    SELECT latest.id_sales_order_state_event FROM audit_sales_order_state_event latest
                    WHERE latest.sales_order_id_sales_order_state_event=o.id_sales_order ORDER BY latest.sequence_sales_order_state_event DESC LIMIT 1)
                WHERE o.status_sales_order='active' AND o.cancelled_sales_order='no' AND o.deleted_at_sales_order IS NULL
            ) current_orders
        `.execute(tx);
        return stageCountsFromRow(result.rows[0]);
    }
}
