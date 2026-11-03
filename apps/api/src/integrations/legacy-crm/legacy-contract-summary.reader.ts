import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import { SALES_ORDER_SUMMARY_PAGE_SIZE } from "../../modules/crm/sales/sales-orders/approval-summary.port.js";
import type { ContractOrderPageRow, ContractQueue } from "../../modules/crm/sales/sales-orders/contract-orders.dto.js";
import type { ContractOrdersLegacyReader } from "../../modules/crm/sales/sales-orders/contract-orders.port.js";
import type { ContractSummaryLegacyReader, LegacyContractRow } from "../../modules/crm/sales/sales-orders/contract-summary.port.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";

/**
 * Eligible = approved by the Formalization flag. `pending` feeds the banner totals and `orders` the paged
 * queues; the latter skips orders that already have a native alias. Both journal and order are read from legacy; the source order itself is never updated. */
@Injectable()
export class LegacyContractSummaryReader implements ContractSummaryLegacyReader, ContractOrdersLegacyReader {
    /** Shared legacy read-only connection. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}

    /** Legacy is removable once migration finishes. */
    enabled(): boolean {
        return this.database.isConfigured();
    }

    /** Bounded keyset page includes later stages to keep the cursor progressing. */
    async pending(after: number, transaction: Transaction<CrmDatabase>): Promise<LegacyContractRow[]> {
        const result = await sql<{ id: number; stage: string }>`
            SELECT /*+ MAX_EXECUTION_TIME(1500) */ id_ov AS id, COALESCE((SELECT e.to_state_code_sales_order_state_event FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} e
                WHERE e.legacy_order_id_sales_order_state_event=o.id_ov ORDER BY e.sequence_sales_order_state_event DESC LIMIT 1), 'contract_pending_send') AS stage
            FROM ${sql.table("crmdatabase-api.ordenventa")} o
            WHERE id_ov > ${after} AND status_ov=1 AND caida_ov=0
              AND aprobacion_forma_ov=1
            ORDER BY id_ov LIMIT ${sql.lit(SALES_ORDER_SUMMARY_PAGE_SIZE)}
        `.execute(transaction);
        // Return all eligible IDs for keyset progress and native-shadow exclusion; later stages are ignored by the service.
        return result.rows.map((row) => ({ id: row.id, state: row.stage }));
    }

    /** Native aliases shadow legacy irrespective of native status; keyset reads preserve integer precision. */
    async orders(tx: Transaction<CrmDatabase>, queue: ContractQueue, after: string, limit: number): Promise<ContractOrderPageRow[]> {
        const stage = queue === "send" ? sql`stage IN ('contract_pending_send','unclassified','pending_approval')` : sql`stage='contract_pending_signature'`;
        const result = await sql<{ sortId: string; id: string; businessId: string; sequence: number }>`
            SELECT /*+ MAX_EXECUTION_TIME(1500) */ sortId,id,businessId,sequence FROM (
                SELECT o.id_ov AS sortKey,CAST(o.id_ov AS CHAR) AS sortId,CAST(o.id_ov AS CHAR) AS id,COALESCE(NULLIF(o.id_ov_tranid,''),CONCAT('LEGACY-OV-',o.id_ov)) AS businessId,
                       COALESCE((SELECT e.to_state_code_sales_order_state_event FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} e WHERE e.legacy_order_id_sales_order_state_event=o.id_ov ORDER BY e.sequence_sales_order_state_event DESC LIMIT 1),'contract_pending_send') AS stage,
                       COALESCE((SELECT e.sequence_sales_order_state_event FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} e WHERE e.legacy_order_id_sales_order_state_event=o.id_ov ORDER BY e.sequence_sales_order_state_event DESC LIMIT 1),0) AS sequence
                FROM ${sql.table("crmdatabase-api.ordenventa")} o
                WHERE o.id_ov>${after} AND o.status_ov=1 AND o.caida_ov=0 AND o.aprobacion_forma_ov=1
                  AND NOT EXISTS (SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov)
            ) eligible WHERE ${stage} ORDER BY sortKey LIMIT ${limit}
        `.execute(tx);
        const state = queue === "send" ? "contract_pending_send" : "contract_pending_signature";
        return result.rows.map((row) => ({ ...row, source: "legacy", state }));
    }
}
