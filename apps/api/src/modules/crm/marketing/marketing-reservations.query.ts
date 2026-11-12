import { type RawBuilder, sql } from "kysely";

/** Evidencia de reserva/pre-reserva vigente. EXISTS cuenta el lead una sola vez, no sus documentos. */
export function legacyLeadReservation(reference: RawBuilder<unknown>) {
    return sql<boolean>`(
        EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.ordenventa")} reservation
            WHERE reservation.id_ov_lead=${reference} AND (
                EXISTS(SELECT 1 FROM crm_sales_order authoritative WHERE authoritative.id_old_produccion_sales_order=reservation.id_ov
                    AND authoritative.status_sales_order='active' AND authoritative.cancelled_sales_order='no' AND authoritative.deleted_at_sales_order IS NULL)
                OR (reservation.status_ov=1 AND reservation.caida_ov=0 AND reservation.reserva_ov=1
                    AND NOT EXISTS(SELECT 1 FROM crm_sales_order authoritative WHERE authoritative.id_old_produccion_sales_order=reservation.id_ov))))
        OR EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.estimaciones")} estimate
            WHERE estimate.idLead_est=${reference} AND estimate.pre_reserva=1 AND COALESCE(estimate.pre_caida,0)=0
            AND (NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.ordenventa")} any_order WHERE any_order.id_ov_est=estimate.idEstimacion_est)
                OR EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.ordenventa")} pre_order
                    WHERE pre_order.id_ov_est=estimate.idEstimacion_est AND pre_order.status_ov=1 AND pre_order.caida_ov=0 AND COALESCE(pre_order.reserva_ov,0)=0
                    AND NOT EXISTS(SELECT 1 FROM crm_sales_order authoritative WHERE authoritative.id_old_produccion_sales_order=pre_order.id_ov))))
    )`;
}

/** La orden nativa activa es evidencia comercial. El puente legacy requiere un lead y un alias inequívocos. */
export function nativeLeadReservation(legacyEnabled: boolean) {
    const native = sql<boolean>`EXISTS(SELECT 1 FROM crm_sales_order reservation
        WHERE reservation.lead_id_sales_order=l.id_lead AND reservation.status_sales_order='active'
        AND reservation.cancelled_sales_order='no' AND reservation.deleted_at_sales_order IS NULL)`;
    if (!legacyEnabled) return native;
    return sql<boolean>`(${native} OR EXISTS(
        SELECT 1 FROM crm_lead_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference
        JOIN ${sql.table("crmdatabase-api.leads")} linked ON linked.idinterno_lead>0
            AND CAST(linked.idinterno_lead AS CHAR) COLLATE utf8mb4_bin=x.external_id_lead_external_reference COLLATE utf8mb4_bin
        WHERE x.lead_id_lead_external_reference=l.id_lead AND x.status_lead_external_reference='active'
        AND s.code_external_system='netsuite' AND s.status_external_system='active'
        AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.leads")} sibling WHERE sibling.idinterno_lead=linked.idinterno_lead AND sibling.id_lead<>linked.id_lead)
        AND NOT EXISTS(SELECT 1 FROM crm_lead_external_reference other_alias
            WHERE other_alias.external_system_id_lead_external_reference=x.external_system_id_lead_external_reference
            AND other_alias.external_id_lead_external_reference=x.external_id_lead_external_reference
            AND other_alias.status_lead_external_reference='active' AND other_alias.lead_id_lead_external_reference<>l.id_lead)
        AND ${legacyLeadReservation(sql.ref("linked.idinterno_lead"))}
    ))`;
}
