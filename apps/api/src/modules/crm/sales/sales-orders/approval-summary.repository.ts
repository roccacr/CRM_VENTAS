import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import { DatabaseService } from "../../../../database/database.service.js";
import type { CrmDatabase } from "../../../../database/database.types.js";

/** Queries the canonical database without changing lifecycle or audit records. */
@Injectable()
export class ApprovalSummaryRepository {
    /** Reuses the application database pool. */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

    /** Prevent concurrent migration from changing native precedence halfway through a count. */
    readSnapshot<T>(read: (tx: Transaction<CrmDatabase>) => Promise<T>): Promise<T> {
        return this.database.db.transaction().setIsolationLevel("repeatable read").setAccessMode("read only").execute(read);
    }

    /** Unknown approvals never qualify as explicitly not approved. */
    async countPending(executor = this.database.db): Promise<number> {
        const result = await sql<{ total: string | number }>`
            SELECT /*+ MAX_EXECUTION_TIME(1500) */ COUNT(*) AS total FROM crm_sales_order o
            WHERE o.status_sales_order = 'active'
              AND o.cancelled_sales_order = 'no'
              AND o.deleted_at_sales_order IS NULL
              AND EXISTS (SELECT 1 FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval = o.id_sales_order AND a.type_code_sales_order_approval = 'sales_management' AND a.status_sales_order_approval = 'approved')
              AND EXISTS (SELECT 1 FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval = o.id_sales_order AND a.type_code_sales_order_approval = 'developer' AND a.status_sales_order_approval = 'approved')
              AND EXISTS (SELECT 1 FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval = o.id_sales_order AND a.type_code_sales_order_approval = 'formalization' AND a.status_sales_order_approval = 'not_approved')
        `.execute(executor);
        return Number(result.rows[0]?.total ?? 0);
    }

    /** All migrated rows shadow legacy, even if no longer active or pending. */
    async migratedIds(ids: number[], executor = this.database.db): Promise<number[]> {
        const rows = await executor.selectFrom("crm_sales_order").select("id_old_produccion_sales_order").where("id_old_produccion_sales_order", "in", ids).execute();
        return rows.map((row) => Number(row.id_old_produccion_sales_order));
    }
}
