import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { FollowUpAccess, FollowUpPeriod, FollowUpRead } from "../../modules/crm/sales/sales-orders/follow-up.contract.js";
import type { FollowUpLegacyReader } from "../../modules/crm/sales/sales-orders/follow-up.port.js";
import { followUpSourceQuery, readFollowUpRecord, readFollowUpSource } from "../../modules/crm/sales/sales-orders/follow-up.query.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";

/** Read-only legacy projection. Ambiguous provider relationships remain null instead of duplicating orders. */
@Injectable()
export class LegacyFollowUpReader implements FollowUpLegacyReader {
    /** Reuses the configured legacy switch while executing on the caller's shared snapshot. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}
    /** Uses the existing integration switch; never opens a new request-scoped pool. */
    enabled(): boolean {
        return this.database.isConfigured();
    }
    /** Alias shadowing includes inactive/deleted native orders: authority never falls back implicitly. */
    read(tx: Transaction<CrmDatabase>, query: FollowUpRead, period: FollowUpPeriod, access: FollowUpAccess) {
        return readFollowUpSource(tx, followUpSourceQuery(this.base(period), query, access));
    }
    /** Bounds the source projection to the requested identity before classification. */
    readRecord(tx: Transaction<CrmDatabase>, id: string, period: FollowUpPeriod) {
        return readFollowUpRecord(tx, this.base(period, id));
    }
    /** Exposes the read-only source projection for global portfolio pagination. */
    projection(period: FollowUpPeriod) {
        return this.base(period);
    }
    private base(period: FollowUpPeriod, id?: string) {
        return sql`
            SELECT o.id_ov AS sortId,CONCAT('legacy:',o.id_ov) COLLATE utf8mb4_unicode_ci AS id,'legacy' AS source,
                COALESCE(NULLIF(TRIM(o.id_ov_tranid),''),CONCAT('OV-',o.id_ov)) COLLATE utf8mb4_unicode_ci AS number,NULL AS nativeCode,
                CONVERT(NULLIF(TRIM(l.nombre_lead),'') USING utf8mb4) COLLATE utf8mb4_unicode_ci AS client,CONVERT(NULLIF(TRIM(l.email_lead),'') USING utf8mb4) COLLATE utf8mb4_unicode_ci AS clientEmail,
                IF(p.id_proyecto IS NULL,NULL,COALESCE(np.public_id_project,CONCAT('legacy-project:',p.id_proyecto))) COLLATE utf8mb4_unicode_ci AS projectId,
                CONVERT(NULLIF(TRIM(p.Nombre_proyecto),'') USING utf8mb4) COLLATE utf8mb4_unicode_ci AS projectName,CONVERT(NULLIF(TRIM(f.codigo_exp),'') USING utf8mb4) COLLATE utf8mb4_unicode_ci AS unit,
                COALESCE(nu.public_id_user,IF(a.id_admin IS NULL,NULL,CONCAT('legacy-user:',a.id_admin))) COLLATE utf8mb4_unicode_ci AS ownerId,CONVERT(NULLIF(TRIM(a.name_admin),'') USING utf8mb4) COLLATE utf8mb4_unicode_ci AS ownerName,
                JSON_UNQUOTE(JSON_EXTRACT(e.responsible_snapshot_sales_order_state_event,'$.publicId')) AS stageResponsibleId,
                JSON_UNQUOTE(JSON_EXTRACT(e.responsible_snapshot_sales_order_state_event,'$.name')) AS stageResponsibleName,
                JSON_UNQUOTE(JSON_EXTRACT(e.actor_snapshot_sales_order_state_event,'$.publicId')) AS changedById,
                JSON_UNQUOTE(JSON_EXTRACT(e.actor_snapshot_sales_order_state_event,'$.name')) AS changedByName,
                e.to_state_code_sales_order_state_event AS rawStage,e.effective_at_sales_order_state_event AS effectiveAt,
                COALESCE(e.sequence_sales_order_state_event,0) AS stateVersion,
                CONVERT(o.origen_fondos_compra_ov USING utf8mb4) COLLATE utf8mb4_unicode_ci AS purchaseFundsOrigin,
                CONVERT(o.estado_adendum_ov USING utf8mb4) COLLATE utf8mb4_unicode_ci AS addendumStatus,
                CASE o.cuotas_pagadas_completo_ov WHEN 1 THEN 1 WHEN 0 THEN 0 ELSE NULL END AS installmentsFullyPaid,
                CASE o.unidad_traspasada_ov WHEN 1 THEN 1 WHEN 0 THEN 0 ELSE NULL END AS unitTransferred,
                CASE o.entrega_llaves_ov WHEN 1 THEN 1 WHEN 0 THEN 0 ELSE NULL END AS keysDelivered,
                CASE o.unidad_entregada_ov WHEN 1 THEN 1 WHEN 0 THEN 0 ELSE NULL END AS unitDelivered,
                COALESCE(o.caida_ov=1,0) AS saleLost,
                COALESCE(o.contrado_frima_ov=1,0) AS contractSigned,
                COALESCE(o.aprobacion_forma_ov=1,0) AS approved,
                COALESCE(o.chekJefeVenta=1 AND o.aprobacion__rdr_ov=1 AND o.aprobacion_forma_ov=0,0) AS approvalPending,
                EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} ce WHERE ce.legacy_order_id_sales_order_state_event=o.id_ov
                    AND ce.to_state_code_sales_order_state_event='closed' AND ce.effective_at_sales_order_state_event>=${period.start} AND ce.effective_at_sales_order_state_event<${period.endExclusive}) AS completedThisYear
            FROM ${sql.table("crmdatabase-api.ordenventa")} o
            LEFT JOIN ${sql.table("crmdatabase-api.leads")} l ON l.idinterno_lead=o.id_ov_lead
                AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.leads")} sibling WHERE sibling.idinterno_lead=l.idinterno_lead AND sibling.id_lead<>l.id_lead)
            LEFT JOIN ${sql.table("crmdatabase-api.admins")} a ON a.idnetsuite_admin=l.id_empleado_lead
                AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.admins")} sibling WHERE sibling.idnetsuite_admin=a.idnetsuite_admin AND sibling.id_admin<>a.id_admin)
            LEFT JOIN sec_user nu ON nu.normalized_email_user COLLATE utf8mb4_bin=NULLIF(LOWER(TRIM(a.email_admin)),'') COLLATE utf8mb4_bin AND nu.deleted_at_user IS NULL
                AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.admins")} sibling WHERE NULLIF(LOWER(TRIM(sibling.email_admin)),'') COLLATE utf8mb4_bin=NULLIF(LOWER(TRIM(a.email_admin)),'') COLLATE utf8mb4_bin AND sibling.id_admin<>a.id_admin)
            LEFT JOIN ${sql.table("crmdatabase-api.proyectos")} p ON p.id_ProNetsuite=l.idproyecto_lead
                AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.proyectos")} sibling WHERE sibling.id_ProNetsuite=p.id_ProNetsuite AND sibling.id_proyecto<>p.id_proyecto)
            LEFT JOIN crm_project np ON np.id_old_produccion_project=p.id_proyecto AND np.deleted_at_project IS NULL
            LEFT JOIN ${sql.table("crmdatabase-api.expedientes")} f ON f.ID_interno_expediente=o.idExpediente_ov
                AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.expedientes")} sibling WHERE sibling.ID_interno_expediente=f.ID_interno_expediente AND sibling.id_expediente<>f.id_expediente)
            LEFT JOIN ${sql.table("crmdatabase-api.audit_sales_order_state_event")} e ON e.id_sales_order_state_event=(SELECT latest.id_sales_order_state_event
                FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} latest WHERE latest.legacy_order_id_sales_order_state_event=o.id_ov ORDER BY latest.sequence_sales_order_state_event DESC LIMIT 1)
            WHERE ${id === undefined ? sql`TRUE` : sql`o.id_ov=${Number(id)}`} AND o.status_ov=1 AND (o.caida_ov=0 OR (o.caida_ov=1 AND o.contrado_frima_ov=1)) AND NOT EXISTS(SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov)`;
    }
}
