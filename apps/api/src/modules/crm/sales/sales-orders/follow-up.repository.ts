import { Injectable } from "@nestjs/common";
import { type RawBuilder, sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { FollowUpAccess, FollowUpPeriod, FollowUpRead } from "./follow-up.contract.js";
import { followUpSourceQuery, readFollowUpRecord, readFollowUpSource, readProjectDistribution } from "./follow-up.query.js";

/** Native relationships use native PKs. Provider transaction numbers are labels, never identity. */
@Injectable()
export class FollowUpRepository {
    /** Includes inactive/deleted aliases so authoritative native records can never fall back to legacy. */
    async findRecordAuthority(tx: Transaction<CrmDatabase>, source: "native" | "legacy", id: string) {
        const where = source === "native" ? sql`o.public_id_sales_order=${id}` : sql`o.id_old_produccion_sales_order=${Number(id)}`;
        const result = await sql<{ publicId: string; active: number }>`
            SELECT o.public_id_sales_order AS publicId,
                (o.status_sales_order='active' AND (o.cancelled_sales_order='no' OR (o.cancelled_sales_order='yes' AND o.contract_signed_sales_order='yes')) AND o.deleted_at_sales_order IS NULL) AS active
            FROM crm_sales_order o WHERE ${where} LIMIT 1`.execute(tx);
        const row = result.rows[0];
        return row ? { publicId: row.publicId, active: row.active === 1 } : undefined;
    }
    /** One bounded SELECT: joins project/contact/seller through the order's explicit lead FK. */
    read(tx: Transaction<CrmDatabase>, query: FollowUpRead, period: FollowUpPeriod, access: FollowUpAccess) {
        return readFollowUpSource(tx, followUpSourceQuery(this.base(period), query, access));
    }
    /** Federates source rows before permissions, filters and the bounded global page. */
    readCombined(tx: Transaction<CrmDatabase>, query: FollowUpRead, period: FollowUpPeriod, options: { access: FollowUpAccess; legacy?: RawBuilder<unknown> }) {
        const { access, legacy } = options;
        const base = legacy ? sql`${this.base(period)} UNION ALL ${legacy}` : this.base(period);
        return readFollowUpSource(tx, followUpSourceQuery(base, query, access));
    }
    /** Uses the same native authority and optional legacy projection inside one snapshot. */
    projectDistribution(tx: Transaction<CrmDatabase>, period: FollowUpPeriod, options: { access: FollowUpAccess; legacy?: RawBuilder<unknown> }) {
        const base = options.legacy ? sql`${this.base(period)} UNION ALL ${options.legacy}` : this.base(period);
        return readProjectDistribution(tx, base, options.access);
    }
    /** Bounds the source projection to the requested identity before classification. */
    readRecord(tx: Transaction<CrmDatabase>, id: string, period: FollowUpPeriod) {
        return readFollowUpRecord(tx, this.base(period, id));
    }
    private base(period: FollowUpPeriod, id?: string) {
        return sql`
            SELECT o.id_sales_order AS sortId,o.public_id_sales_order AS id,'native' AS source,
                COALESCE((SELECT NULLIF(TRIM(x.transaction_number_sales_order_external_reference),'') FROM crm_sales_order_external_reference x
                    WHERE x.sales_order_id_sales_order_external_reference=o.id_sales_order AND x.status_sales_order_external_reference='active'
                    ORDER BY x.external_system_id_sales_order_external_reference,x.id_sales_order_external_reference LIMIT 1),o.native_code_sales_order) AS number,
                o.native_code_sales_order AS nativeCode,c.full_name_contact AS client,NULLIF(TRIM(c.email_contact),'') AS clientEmail,
                p.public_id_project AS projectId,p.name_project AS projectName,f.code_unit_file AS unit,
                u.public_id_user AS ownerId,u.display_name_user AS ownerName,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.responsible_snapshot_sales_order_state_event,'$.publicId')),responsible.public_id_user) AS stageResponsibleId,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.responsible_snapshot_sales_order_state_event,'$.name')),responsible.display_name_user) AS stageResponsibleName,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.actor_snapshot_sales_order_state_event,'$.publicId')),actor.public_id_user) AS changedById,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.actor_snapshot_sales_order_state_event,'$.name')),actor.display_name_user) AS changedByName,
                e.to_state_code_sales_order_state_event AS rawStage,e.effective_at_sales_order_state_event AS effectiveAt,
                COALESCE(e.sequence_sales_order_state_event,0) AS stateVersion,
                o.purchase_funds_origin_sales_order AS purchaseFundsOrigin,
                o.addendum_status_sales_order AS addendumStatus,
                CASE o.installments_fully_paid_sales_order WHEN 'yes' THEN 1 WHEN 'no' THEN 0 ELSE NULL END AS installmentsFullyPaid,
                CASE o.unit_transferred_sales_order WHEN 'yes' THEN 1 WHEN 'no' THEN 0 ELSE NULL END AS unitTransferred,
                CASE o.keys_delivered_sales_order WHEN 'yes' THEN 1 WHEN 'no' THEN 0 ELSE NULL END AS keysDelivered,
                CASE o.unit_delivered_sales_order WHEN 'yes' THEN 1 WHEN 'no' THEN 0 ELSE NULL END AS unitDelivered,
                COALESCE(o.cancelled_sales_order='yes',0) AS saleLost,
                COALESCE(o.contract_signed_sales_order='yes',0) AS contractSigned,
                (SELECT COUNT(*) FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval=o.id_sales_order
                    AND a.type_code_sales_order_approval='formalization' AND a.status_sales_order_approval='approved')=1 AS approved,
                (EXISTS(SELECT 1 FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval=o.id_sales_order AND a.type_code_sales_order_approval='sales_management' AND a.status_sales_order_approval='approved')
                    AND EXISTS(SELECT 1 FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval=o.id_sales_order AND a.type_code_sales_order_approval='developer' AND a.status_sales_order_approval='approved')
                    AND EXISTS(SELECT 1 FROM crm_sales_order_approval a WHERE a.sales_order_id_sales_order_approval=o.id_sales_order AND a.type_code_sales_order_approval='formalization' AND a.status_sales_order_approval='not_approved')) AS approvalPending,
                EXISTS(SELECT 1 FROM audit_sales_order_state_event ce WHERE ce.sales_order_id_sales_order_state_event=o.id_sales_order AND ce.to_state_code_sales_order_state_event='closed'
                    AND ce.effective_at_sales_order_state_event>=${period.start} AND ce.effective_at_sales_order_state_event<${period.endExclusive}) AS completedThisYear
            FROM crm_sales_order o
            LEFT JOIN crm_lead l ON l.id_lead=o.lead_id_sales_order AND l.deleted_at_lead IS NULL
            LEFT JOIN crm_contact c ON c.id_contact=l.primary_contact_id_lead AND c.deleted_at_contact IS NULL
            LEFT JOIN crm_project p ON p.id_project=l.project_id_lead AND p.deleted_at_project IS NULL
            LEFT JOIN sec_user u ON u.id_user=l.owner_user_id_lead AND u.deleted_at_user IS NULL
            LEFT JOIN crm_unit_file f ON f.id_unit_file=o.unit_file_id_sales_order
            LEFT JOIN audit_sales_order_state_event e ON e.id_sales_order_state_event=(SELECT latest.id_sales_order_state_event FROM audit_sales_order_state_event latest
                WHERE latest.sales_order_id_sales_order_state_event=o.id_sales_order ORDER BY latest.sequence_sales_order_state_event DESC LIMIT 1)
            LEFT JOIN sec_user responsible ON responsible.id_user=e.responsible_user_id_sales_order_state_event
            LEFT JOIN sec_user actor ON actor.id_user=e.actor_user_id_sales_order_state_event
            WHERE ${id === undefined ? sql`TRUE` : sql`o.public_id_sales_order=${id}`} AND o.status_sales_order='active' AND (o.cancelled_sales_order='no' OR (o.cancelled_sales_order='yes' AND o.contract_signed_sales_order='yes')) AND o.deleted_at_sales_order IS NULL`;
    }
}
