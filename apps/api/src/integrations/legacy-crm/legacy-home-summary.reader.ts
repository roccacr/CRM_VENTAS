import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import { outsideFiniquito } from "../../modules/crm/sales/sales-orders/finiquito-exclusion.query.js";
import { formalizationClosedThisYear } from "../../modules/crm/sales/sales-orders/formalization-closure.query.js";
import type { HomeSummaryLegacyReader } from "../../modules/crm/sales/sales-orders/home-summary.port.js";
import { aggregateNumber, type HomeSummaryPeriod, type StageAggregateRow, stageCountsFromRow } from "../../modules/crm/sales/sales-orders/home-summary.types.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";

/**
 * Contadores de inicio del lado viejo, un solo agregado en la misma transaccion.
 *
 * `shadowed` es la orden que ya tiene alias nativo. Sale de todos los conteos de
 * etapa y entra en `duplicatesExcluded`. Si ese total no viene, el agregado se
 * rechaza: no se publica cero por un hueco. Un flag distinto de 1 o 0 queda nulo
 * y no suma. La etapa ausente cuenta como `contract_pending_send`.
 */
@Injectable()
export class LegacyHomeSummaryReader implements HomeSummaryLegacyReader {
    /** El pool solo responde `enabled`. El agregado no abre otra conexion. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}

    /** Apagado devuelve vacio y no lanza el `SELECT`. */
    enabled(): boolean {
        return this.database.isConfigured();
    }

    /**
     * Etiquetas de ordenes que la actividad ya eligio. Como maximo seis ids, cada
     * uno un entero positivo de hasta diez digitos. Fuera de eso, no se consulta.
     */
    async orderLabels(tx: Transaction<CrmDatabase>, ids: readonly string[]) {
        if (!this.enabled() || !ids.length) return [];
        if (ids.length > 6 || !ids.every((id) => /^[1-9][0-9]{0,9}$/.test(id))) throw new Error("Invalid activity order IDs");
        const result = await sql<{ id: string; number: string | null }>`SELECT CAST(id_ov AS CHAR) AS id,id_ov_tranid AS number FROM ${sql.table("crmdatabase-api.ordenventa")} WHERE id_ov IN (${sql.join(ids.map(Number))})`.execute(tx);
        return result.rows;
    }

    /** El cierre del anio acredita la orden una vez, aunque despues se reabra. El alias nativo no entra en las etapas. */
    async aggregate(tx: Transaction<CrmDatabase>, period: HomeSummaryPeriod) {
        const result = await sql<StageAggregateRow>`
            SELECT /*+ MAX_EXECUTION_TIME(1500) */
                SUM(NOT shadowed AND approved AND COALESCE(stage,'contract_pending_send') IN ('unclassified','pending_approval','contract_pending_send')) AS toSend,
                SUM(NOT shadowed AND approved AND stage='contract_pending_signature') AS pendingSignature,
                SUM(NOT shadowed AND contract_signed AND stage='bank_management') AS banking, SUM(NOT shadowed AND contract_signed AND stage='bank_management_in_progress') AS bankingInProgress, SUM(NOT shadowed AND contract_signed AND stage='pending_balance') AS balance,
                SUM(NOT shadowed AND contract_signed AND stage='pending_transfer' AND installments_paid=1) AS transferPending, SUM(NOT shadowed AND contract_signed AND stage='transfer_signed' AND installments_paid=1 AND keys_delivered=0 AND unit_delivered=0) AS transferSigned,
                SUM(NOT shadowed AND contract_signed AND completed_this_year) AS closedThisYear,
                SUM(shadowed) AS duplicatesExcluded
            FROM (
                SELECT e.to_state_code_sales_order_state_event AS stage, COALESCE(o.contrado_frima_ov=1,0) AS contract_signed,
                    CASE o.cuotas_pagadas_completo_ov WHEN 1 THEN 1 WHEN 0 THEN 0 ELSE NULL END AS installments_paid,
                    CASE o.entrega_llaves_ov WHEN 1 THEN 1 WHEN 0 THEN 0 ELSE NULL END AS keys_delivered,
                    CASE o.unidad_entregada_ov WHEN 1 THEN 1 WHEN 0 THEN 0 ELSE NULL END AS unit_delivered,
                    ${formalizationClosedThisYear("legacy", period)} AS completed_this_year,
                    (o.aprobacion_forma_ov=1) AS approved,
                    EXISTS(SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov) AS shadowed
                FROM ${sql.table("crmdatabase-api.ordenventa")} o
                LEFT JOIN ${sql.table("crmdatabase-api.audit_sales_order_state_event")} e ON e.id_sales_order_state_event=(
                    SELECT latest.id_sales_order_state_event FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} latest
                    WHERE latest.legacy_order_id_sales_order_state_event=o.id_ov ORDER BY latest.sequence_sales_order_state_event DESC LIMIT 1)
                WHERE o.status_ov=1 AND o.caida_ov=0 AND ${outsideFiniquito("legacy", sql`o.id_ov`)}
            ) current_orders
        `.execute(tx);
        const row = result.rows[0];
        const counts = stageCountsFromRow(row);
        if (row?.duplicatesExcluded === undefined) throw new Error("Missing Home duplicate aggregate");
        return { counts, duplicatesExcluded: aggregateNumber(row.duplicatesExcluded) };
    }
}
