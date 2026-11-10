import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import { DatabaseService } from "../../../../database/database.service.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import { formalizationClosedThisYear } from "./formalization-closure.query.js";
import { type HomeSummaryPeriod, type RecentOrderActivity, type StageAggregateRow, stageCountsFromRow } from "./home-summary.types.js";

/** Lee la etapa vigente y la firma confirmada del contrato. No usa contadores cacheados. */
@Injectable()
export class HomeSummaryRepository {
    /** Las dos lecturas de esquema usan el pool canónico. */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

    /** Una sola foto supone que los dos esquemas están en la misma instancia InnoDB. */
    readSnapshot<T>(read: (tx: Transaction<CrmDatabase>) => Promise<T>): Promise<T> {
        return this.database.db.transaction().setIsolationLevel("repeatable read").setAccessMode("read only").execute(read);
    }

    /** El índice de actor y tiempo acota el feed personal. El id de usuario, el límite y la fuente no vienen del request. */
    async recentActivity(tx: Transaction<CrmDatabase>, actor: string): Promise<RecentOrderActivity[]> {
        const result = await sql<RecentOrderActivity>`
            SELECT e.id_record_event AS id,
                CASE WHEN r.source_schema_record='CRM_THINK_V2' THEN 'native' ELSE 'legacy' END AS source,
                r.source_id_record AS orderId,e.action_record_event AS action,
                DATE_FORMAT(e.recorded_at_record_event,'%Y-%m-%dT%H:%i:%sZ') AS at,
                JSON_UNQUOTE(JSON_EXTRACT(e.before_record_event,'$.state')) AS fromState,
                JSON_UNQUOTE(JSON_EXTRACT(e.after_record_event,'$.state')) AS toState,
                JSON_UNQUOTE(JSON_EXTRACT(e.after_record_event,'$.status')) AS approval
            FROM audit_record_event e JOIN audit_record r ON r.id_record=e.record_id_record_event
            WHERE e.actor_kind_record_event='user' AND e.actor_reference_record_event=${actor}
                AND e.module_record_event='formalizacion' AND r.entity_type_record='sales_order'
                AND ((r.source_schema_record='CRM_THINK_V2' AND r.source_table_record='crm_sales_order')
                  OR (r.source_schema_record='crmdatabase-api' AND r.source_table_record='ordenventa'))
            ORDER BY e.recorded_at_record_event DESC,e.id_record_event DESC LIMIT 6
        `.execute(tx);
        return result.rows;
    }

    /** Resuelve las etiquetas nativas de los mismos seis eventos. El repositorio de núcleo no abre el CRM viejo. */
    async nativeOrderLabels(tx: Transaction<CrmDatabase>, ids: readonly string[]) {
        if (!ids.length) return [];
        if (ids.length > 6 || !ids.every((id) => /^[1-9][0-9]*$/.test(id) && Number.isSafeInteger(Number(id)))) throw new Error("Invalid native activity IDs");
        const result = await tx.selectFrom("crm_sales_order").select(["id_sales_order as id", "native_code_sales_order as number"]).where("id_sales_order", "in", ids.map(Number)).execute();
        return result.map((row) => ({ id: String(row.id), number: row.number }));
    }

    /** La aprobación solo abre el contrato. Un cierre efectivo de este año acredita la orden elegible una vez, aunque después se reabra. */
    async aggregate(tx: Transaction<CrmDatabase>, period: HomeSummaryPeriod) {
        const result = await sql<StageAggregateRow>`
            SELECT /*+ MAX_EXECUTION_TIME(1500) */
                SUM(approved AND COALESCE(stage,'contract_pending_send') IN ('unclassified','pending_approval','contract_pending_send')) AS toSend,
                SUM(approved AND stage='contract_pending_signature') AS pendingSignature,
                SUM(contract_signed AND stage='bank_management') AS banking, SUM(contract_signed AND stage='bank_management_in_progress') AS bankingInProgress, SUM(contract_signed AND stage='pending_balance') AS balance,
                SUM(contract_signed AND stage='pending_transfer' AND installments_paid=1) AS transferPending, SUM(contract_signed AND stage='transfer_signed' AND installments_paid=1 AND keys_delivered=0 AND unit_delivered=0) AS transferSigned,
                SUM(contract_signed AND completed_this_year) AS closedThisYear
            FROM (
                SELECT e.to_state_code_sales_order_state_event AS stage, COALESCE(o.contract_signed_sales_order='yes',0) AS contract_signed,
                    CASE o.installments_fully_paid_sales_order WHEN 'yes' THEN 1 WHEN 'no' THEN 0 ELSE NULL END AS installments_paid,
                    CASE o.keys_delivered_sales_order WHEN 'yes' THEN 1 WHEN 'no' THEN 0 ELSE NULL END AS keys_delivered,
                    CASE o.unit_delivered_sales_order WHEN 'yes' THEN 1 WHEN 'no' THEN 0 ELSE NULL END AS unit_delivered,
                    ${formalizationClosedThisYear("native", period)} AS completed_this_year,
                    (SELECT COUNT(*) FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval=o.id_sales_order
                     AND a.type_code_sales_order_approval='formalization' AND a.status_sales_order_approval='approved')=1 AS approved
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
