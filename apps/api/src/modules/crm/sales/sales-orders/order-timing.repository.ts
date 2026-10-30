import { Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { TimingOrder, TimingPagination } from "./order-timing.contract.js";
import { readOrderTiming } from "./order-timing.query.js";

/** Native aliases remain authoritative, including inactive or deleted orders. */
@Injectable()
export class OrderTimingRepository {
    /** No legacy access: one explicit lookup includes just the resource authorization projection. */
    async find(tx: Transaction<CrmDatabase>, source: "native" | "legacy", id: string): Promise<TimingOrder | undefined> {
        const where = source === "native" ? sql`o.public_id_sales_order=${id}` : sql`o.id_old_produccion_sales_order=${Number(id)}`;
        const year = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Costa_Rica", year: "numeric" }).format(new Date()));
        const start = `${String(year)}-01-01 06:00:00.000`;
        const end = `${String(year + 1)}-01-01 06:00:00.000`;
        const result = await sql<{ id: string; publicId: string; active: number; pendingApproval: number; ownerId: string | null; rawStage: string | null; approved: number; contractSigned: number; completedThisYear: number }>`
            SELECT (SELECT e.to_state_code_sales_order_state_event FROM audit_sales_order_state_event e WHERE e.sales_order_id_sales_order_state_event=o.id_sales_order ORDER BY e.sequence_sales_order_state_event DESC LIMIT 1) AS rawStage,
                (SELECT COUNT(*) FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval=o.id_sales_order AND a.type_code_sales_order_approval IN ('sales_management','developer','formalization') AND a.status_sales_order_approval='approved')=3 AS approved,
                COALESCE(o.contract_signed_sales_order='yes',0) AS contractSigned,
                EXISTS(SELECT 1 FROM audit_sales_order_state_event ce WHERE ce.sales_order_id_sales_order_state_event=o.id_sales_order AND ce.to_state_code_sales_order_state_event='closed' AND ce.effective_at_sales_order_state_event>=${start} AND ce.effective_at_sales_order_state_event<${end}) AS completedThisYear,
                CAST(o.id_sales_order AS CHAR) AS id,o.public_id_sales_order AS publicId,
                (o.status_sales_order='active' AND o.cancelled_sales_order='no' AND o.deleted_at_sales_order IS NULL) AS active,u.public_id_user AS ownerId,
                (EXISTS(SELECT 1 FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval=o.id_sales_order AND a.type_code_sales_order_approval='sales_management' AND a.status_sales_order_approval='approved')
                 AND EXISTS(SELECT 1 FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval=o.id_sales_order AND a.type_code_sales_order_approval='developer' AND a.status_sales_order_approval='approved')
                 AND EXISTS(SELECT 1 FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval=o.id_sales_order AND a.type_code_sales_order_approval='formalization' AND a.status_sales_order_approval='not_approved')) AS pendingApproval
            FROM crm_sales_order o LEFT JOIN crm_lead l ON l.id_lead=o.lead_id_sales_order AND l.deleted_at_lead IS NULL
            LEFT JOIN sec_user u ON u.id_user=l.owner_user_id_lead AND u.deleted_at_user IS NULL WHERE ${where} LIMIT 1`.execute(tx);
        const row = result.rows[0];
        return row ? { ...row, active: row.active === 1, pendingApproval: row.pendingApproval === 1 } : undefined;
    }
    /** Source ID is resolved internally, never supplied as a SQL identifier. */
    read(tx: Transaction<CrmDatabase>, id: string, page: TimingPagination) {
        return readOrderTiming(tx, { view: sql.table("audit_sales_order_state_duration"), states: sql.table("conf_sales_order_state") }, id, page);
    }
}
