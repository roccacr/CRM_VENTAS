import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import { DatabaseService } from "../../../../database/database.service.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import type { ContractCounts } from "./contract-summary.port.js";

/** La aprobación explícita de formalización abre el flujo nuevo del CRM. Una etapa posterior no regresa el envío. */
@Injectable()
export class ContractSummaryRepository {
    /** Usa la conexión canónica de la aplicación. */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

    /** Los dos esquemas comparten una foto de solo lectura y lectura repetible, incluidas las búsquedas que tapa lo nativo. */
    readSnapshot<T>(read: (tx: Transaction<CrmDatabase>) => Promise<T>): Promise<T> {
        return this.database.db.transaction().setIsolationLevel("repeatable read").setAccessMode("read only").execute(read);
    }

    /** La última secuencia, no la etapa más alta, decide el reingreso después de una reversa explícita. */
    async countNative(transaction: Transaction<CrmDatabase>): Promise<ContractCounts> {
        const result = await sql<{ toSend: string | number | null; pendingSignature: string | number | null }>`
            SELECT /*+ MAX_EXECUTION_TIME(1500) */ SUM(stage IN ('unclassified','pending_approval','contract_pending_send')) AS toSend,
                   SUM(stage = 'contract_pending_signature') AS pendingSignature
            FROM (
                SELECT COALESCE((SELECT e.to_state_code_sales_order_state_event FROM audit_sales_order_state_event e
                    WHERE e.sales_order_id_sales_order_state_event=o.id_sales_order ORDER BY e.sequence_sales_order_state_event DESC LIMIT 1), 'contract_pending_send') AS stage
                FROM crm_sales_order o
                WHERE o.status_sales_order='active' AND o.cancelled_sales_order='no' AND o.deleted_at_sales_order IS NULL
                  AND (SELECT COUNT(*) FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval=o.id_sales_order
                       AND a.type_code_sales_order_approval='formalization' AND a.status_sales_order_approval='approved')=1
            ) eligible
        `.execute(transaction);
        return { toSend: Number(result.rows[0]?.toSend ?? 0), pendingSignature: Number(result.rows[0]?.pendingSignature ?? 0) };
    }
}
