import { Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { ContractOrderPageRow, ContractQueue } from "./contract-orders.dto.js";

/** Native-only query; shared snapshot ownership belongs to the summary repository. */
@Injectable()
export class ContractOrdersRepository {
    /** Latest sequence supplies the optimistic version; historical signed flags are unrelated. */
    async page(tx: Transaction<CrmDatabase>, queue: ContractQueue, after: string, limit: number): Promise<ContractOrderPageRow[]> {
        // Eligible = active, not cancelled/deleted and approved by Formalization;
        // the stage is the latest journal event, defaulting to "pending send" when none exists.
        const stage = queue === "send" ? sql`stage IN ('contract_pending_send','unclassified','pending_approval')` : sql`stage='contract_pending_signature'`;
        const result = await sql<{ sortId: string; id: string; businessId: string; sequence: number }>`
            SELECT /*+ MAX_EXECUTION_TIME(1500) */ sortId,id,businessId,sequence FROM (
                SELECT o.id_sales_order AS sortKey, CAST(o.id_sales_order AS CHAR) AS sortId,
                       o.public_id_sales_order AS id,o.native_code_sales_order AS businessId,
                       COALESCE((SELECT e.to_state_code_sales_order_state_event FROM audit_sales_order_state_event e WHERE e.sales_order_id_sales_order_state_event=o.id_sales_order ORDER BY e.sequence_sales_order_state_event DESC LIMIT 1),'contract_pending_send') AS stage,
                       COALESCE((SELECT e.sequence_sales_order_state_event FROM audit_sales_order_state_event e WHERE e.sales_order_id_sales_order_state_event=o.id_sales_order ORDER BY e.sequence_sales_order_state_event DESC LIMIT 1),0) AS sequence
                FROM crm_sales_order o WHERE o.id_sales_order>${after}
                  AND o.status_sales_order='active' AND o.cancelled_sales_order='no' AND o.deleted_at_sales_order IS NULL
                  AND (SELECT COUNT(*) FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval=o.id_sales_order AND a.type_code_sales_order_approval='formalization' AND a.status_sales_order_approval='approved')=1
            ) eligible WHERE ${stage} ORDER BY sortKey LIMIT ${limit}
        `.execute(tx);
        const state = queue === "send" ? "contract_pending_send" : "contract_pending_signature";
        return result.rows.map((row) => ({ ...row, source: "native", state }));
    }
}
