import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { TimingOrder, TimingPagination } from "../../modules/crm/sales/sales-orders/order-timing.contract.js";
import type { OrderTimingLegacyReader } from "../../modules/crm/sales/sales-orders/order-timing.port.js";
import { readOrderTiming } from "../../modules/crm/sales/sales-orders/order-timing.query.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";

/** Legacy ownership is resolved without conflating provider IDs with native public IDs. */
@Injectable()
export class LegacyOrderTimingReader implements OrderTimingLegacyReader {
    /** Reuses the existing optional fallback switch, never a writable pool. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}
    /** Disabled legacy fallback is never silently treated as an available source. */
    enabled(): boolean {
        return this.database.isConfigured();
    }
    /** Ambiguous lead/admin references do not become resource authorization grants. */
    async find(tx: Transaction<CrmDatabase>, id: string): Promise<TimingOrder | undefined> {
        const year = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Costa_Rica", year: "numeric" }).format(new Date()));
        const start = `${String(year)}-01-01 06:00:00.000`;
        const end = `${String(year + 1)}-01-01 06:00:00.000`;
        const result = await sql<{ id: string; publicId: string; active: number; pendingApproval: number; ownerId: string | null; rawStage: string | null; approved: number; contractSigned: number; completedThisYear: number }>`
            SELECT (SELECT e.to_state_code_sales_order_state_event FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} e WHERE e.legacy_order_id_sales_order_state_event=o.id_ov ORDER BY e.sequence_sales_order_state_event DESC LIMIT 1) AS rawStage,
                COALESCE(o.chekJefeVenta=1 AND o.aprobacion__rdr_ov=1 AND o.aprobacion_forma_ov=1,0) AS approved,
                COALESCE(o.contrado_frima_ov=1,0) AS contractSigned,
                EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} ce WHERE ce.legacy_order_id_sales_order_state_event=o.id_ov AND ce.to_state_code_sales_order_state_event='closed' AND ce.effective_at_sales_order_state_event>=${start} AND ce.effective_at_sales_order_state_event<${end}) AS completedThisYear,
                CAST(o.id_ov AS CHAR) AS id,CONCAT('legacy:',o.id_ov) AS publicId,(o.status_ov=1 AND o.caida_ov=0) AS active,
                COALESCE(o.chekJefeVenta=1 AND o.aprobacion__rdr_ov=1 AND o.aprobacion_forma_ov=0,0) AS pendingApproval,nu.public_id_user AS ownerId
            FROM ${sql.table("crmdatabase-api.ordenventa")} o
            LEFT JOIN ${sql.table("crmdatabase-api.leads")} l ON l.idinterno_lead=o.id_ov_lead
                AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.leads")} sibling WHERE sibling.idinterno_lead=l.idinterno_lead AND sibling.id_lead<>l.id_lead)
            LEFT JOIN ${sql.table("crmdatabase-api.admins")} a ON a.idnetsuite_admin=l.id_empleado_lead
                AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.admins")} sibling WHERE sibling.idnetsuite_admin=a.idnetsuite_admin AND sibling.id_admin<>a.id_admin)
            LEFT JOIN sec_user nu ON nu.normalized_email_user COLLATE utf8mb4_bin=NULLIF(LOWER(TRIM(a.email_admin)),'') COLLATE utf8mb4_bin AND nu.deleted_at_user IS NULL
                AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.admins")} sibling WHERE NULLIF(LOWER(TRIM(sibling.email_admin)),'') COLLATE utf8mb4_bin=NULLIF(LOWER(TRIM(a.email_admin)),'') COLLATE utf8mb4_bin AND sibling.id_admin<>a.id_admin)
            WHERE o.id_ov=${Number(id)} LIMIT 1`.execute(tx);
        const row = result.rows[0];
        return row ? { ...row, active: row.active === 1, pendingApproval: row.pendingApproval === 1 } : undefined;
    }
    /** Every page retains full-record duration calculations from the view. */
    read(tx: Transaction<CrmDatabase>, id: string, page: TimingPagination) {
        return readOrderTiming(tx, { view: sql.table("crmdatabase-api.audit_sales_order_state_duration"), states: sql.table("crmdatabase-api.conf_sales_order_state") }, id, page);
    }
}
