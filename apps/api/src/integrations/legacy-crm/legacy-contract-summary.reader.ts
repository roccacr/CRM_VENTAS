import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import { SALES_ORDER_SUMMARY_PAGE_SIZE } from "../../modules/crm/sales/sales-orders/approval-summary.port.js";
import type { ContractOrderPageRow, ContractQueue } from "../../modules/crm/sales/sales-orders/contract-orders.dto.js";
import type { ContractOrdersLegacyReader } from "../../modules/crm/sales/sales-orders/contract-orders.port.js";
import type { ContractSummaryLegacyReader, LegacyContractRow } from "../../modules/crm/sales/sales-orders/contract-summary.port.js";
import { outsideFiniquito } from "../../modules/crm/sales/sales-orders/finiquito-exclusion.query.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";

/**
 * Lectura de ordenes ya aprobadas por formalizacion. No actualiza la orden ni su bitacora.
 *
 * Elegible es `aprobacion_forma_ov=1`, activa y no caida. `pending` alimenta el
 * total. `orders` arma las colas y omite la orden que ya tiene alias nativo,
 * sea cual sea el estado nativo. Ambas corren en la transaccion del llamador.
 */
@Injectable()
export class LegacyContractSummaryReader implements ContractSummaryLegacyReader, ContractOrdersLegacyReader {
    /** El pool solo responde `enabled`. La pagina no lo abre. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}

    /** El pool existe. No enciende escrituras. */
    enabled(): boolean {
        return this.database.isConfigured();
    }

    /**
     * Devuelve tambien etapas posteriores. El cursor tiene que avanzar; el
     * servicio descarta esas etapas. Sin evento, la etapa es `contract_pending_send`.
     */
    async pending(after: number, transaction: Transaction<CrmDatabase>): Promise<LegacyContractRow[]> {
        const result = await sql<{ id: number; stage: string }>`
            SELECT /*+ MAX_EXECUTION_TIME(1500) */ id_ov AS id, COALESCE((SELECT e.to_state_code_sales_order_state_event FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} e
                WHERE e.legacy_order_id_sales_order_state_event=o.id_ov ORDER BY e.sequence_sales_order_state_event DESC LIMIT 1), 'contract_pending_send') AS stage
            FROM ${sql.table("crmdatabase-api.ordenventa")} o
            WHERE id_ov > ${after} AND status_ov=1 AND caida_ov=0 AND ${outsideFiniquito("legacy", sql`o.id_ov`)}
              AND aprobacion_forma_ov=1
            ORDER BY id_ov LIMIT ${sql.lit(SALES_ORDER_SUMMARY_PAGE_SIZE)}
        `.execute(transaction);
        return result.rows.map((row) => ({ id: row.id, state: row.stage }));
    }

    /**
     * La cola de envio admite tambien `unclassified` y `pending_approval`, pero
     * la fila publicada dice `contract_pending_send`. La de firma solo admite
     * `contract_pending_signature`. El id de negocio es el tranid, o `LEGACY-OV-{id}`.
     */
    async orders(tx: Transaction<CrmDatabase>, queue: ContractQueue, after: string, limit: number): Promise<ContractOrderPageRow[]> {
        const stage = queue === "send" ? sql`stage IN ('contract_pending_send','unclassified','pending_approval')` : sql`stage='contract_pending_signature'`;
        const result = await sql<{ sortId: string; id: string; businessId: string; sequence: number }>`
            SELECT /*+ MAX_EXECUTION_TIME(1500) */ sortId,id,businessId,sequence FROM (
                SELECT o.id_ov AS sortKey,CAST(o.id_ov AS CHAR) AS sortId,CAST(o.id_ov AS CHAR) AS id,COALESCE(NULLIF(o.id_ov_tranid,''),CONCAT('LEGACY-OV-',o.id_ov)) AS businessId,
                       COALESCE((SELECT e.to_state_code_sales_order_state_event FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} e WHERE e.legacy_order_id_sales_order_state_event=o.id_ov ORDER BY e.sequence_sales_order_state_event DESC LIMIT 1),'contract_pending_send') AS stage,
                       COALESCE((SELECT e.sequence_sales_order_state_event FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} e WHERE e.legacy_order_id_sales_order_state_event=o.id_ov ORDER BY e.sequence_sales_order_state_event DESC LIMIT 1),0) AS sequence
                FROM ${sql.table("crmdatabase-api.ordenventa")} o
                WHERE o.id_ov>${after} AND o.status_ov=1 AND o.caida_ov=0 AND o.aprobacion_forma_ov=1 AND ${outsideFiniquito("legacy", sql`o.id_ov`)}
                  AND NOT EXISTS (SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov)
            ) eligible WHERE ${stage} ORDER BY sortKey LIMIT ${limit}
        `.execute(tx);
        const state = queue === "send" ? "contract_pending_send" : "contract_pending_signature";
        return result.rows.map((row) => ({ ...row, source: "legacy", state }));
    }
}
