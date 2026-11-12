import { Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { MarketingExternalIdentity, NativeMarketingProject, NativeMarketingUser } from "./marketing-home.contract.js";
import type { ReportEvent, ReportLead, ReportSource } from "./marketing-leads-report.contract.js";
import { nativeLeadReservation } from "./marketing-reservations.query.js";

export const REPORT_READ_PAGE_SIZE = 10000;
/** Cada página interna se consume en la misma foto. Una página corta termina la lectura; el reporte no se recorta en silencio. */
export async function readReportPages<T>(readPage: (offset: number) => Promise<T[]>): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += REPORT_READ_PAGE_SIZE) {
        const page = await readPage(offset);
        rows.push(...page);
        if (page.length < REPORT_READ_PAGE_SIZE) return rows;
    }
}
/**
 * Evidencia nativa de captación, sin datos de contacto.
 * No filtra por estado ni por baja. La fecha resta seis horas al alta. El motivo de pérdida es solo la última transición a `lost`, y sin nombre no se informa.
 */
@Injectable()
export class MarketingLeadsReportRepository {
    /** Cohortes nativas primero. El puente opcional incorpora evidencia comercial legacy inequívoca, sin copiar leads. */
    async readNative(tx: Transaction<CrmDatabase>, legacyEnabled = false): Promise<ReportSource> {
        const leads = await readReportPages(
            async (offset) =>
                (
                    await sql<Omit<ReportLead, "lost"> & { lost: number; lossReasonCode: string | null; lossReasonName: string | null }>`SELECT /*+ MAX_EXECUTION_TIME(5000) */
            l.public_id_lead AS id,DATE_FORMAT(DATE_SUB(l.created_at_lead,INTERVAL 6 HOUR),'%Y-%m-%d') AS date,
            COALESCE(u.public_id_user,'unassigned') AS sellerId,COALESCE(p.public_id_project,'') AS projectId,
            l.is_qualified_lead AS qualified,
            ${nativeLeadReservation(legacyEnabled)} AS hasReservation,
            EXISTS(SELECT 1 FROM crm_sales_order o WHERE o.lead_id_sales_order=l.id_lead AND o.deleted_at_sales_order IS NULL) AS hasSalesOrder,
            COALESCE(c.public_id_campaign,'') AS campaignId,l.ad_name_lead AS ad,COALESCE(s.code_lead_status='lost',0) AS lost,
            e.reason_code_lead_status_event AS lossReasonCode,COALESCE(NULLIF(TRIM(e.reason_name_snapshot_lead_status_event),''),r.name_action_reason) AS lossReasonName
            FROM crm_lead l LEFT JOIN sec_user u ON u.id_user=l.owner_user_id_lead
            LEFT JOIN crm_project p ON p.id_project=l.project_id_lead LEFT JOIN crm_campaign c ON c.id_campaign=l.campaign_id_lead
            LEFT JOIN conf_lead_status s ON s.code_lead_status=l.status_code_lead
            LEFT JOIN audit_lead_status_event e ON e.id_lead_status_event=(
                SELECT se.id_lead_status_event FROM audit_lead_status_event se
                WHERE l.status_code_lead='lost' AND se.lead_id_lead_status_event=l.id_lead AND se.to_status_code_lead_status_event='lost'
                ORDER BY se.sequence_lead_status_event DESC,se.id_lead_status_event DESC LIMIT 1)
            LEFT JOIN conf_action_reason r ON r.code_action_reason=e.reason_code_lead_status_event
            ORDER BY l.id_lead LIMIT ${REPORT_READ_PAGE_SIZE} OFFSET ${offset}`.execute(tx)
                ).rows,
        );
        const users = await sql<NativeMarketingUser>`SELECT public_id_user AS id,display_name_user AS name,normalized_email_user AS email FROM sec_user`.execute(tx);
        const projects = await sql<NativeMarketingProject>`SELECT public_id_project AS id,name_project AS name FROM crm_project`.execute(tx);
        const campaigns = await sql<NativeMarketingProject>`SELECT public_id_campaign AS id,name_campaign AS name FROM crm_campaign`.execute(tx);
        const userAliases = await sql<MarketingExternalIdentity>`SELECT u.public_id_user AS id,s.code_external_system AS ${sql.ref("system")},x.external_user_id_user_external_identity AS externalId
            FROM int_user_external_identity x JOIN sec_user u ON u.id_user=x.user_id_user_external_identity JOIN int_external_system s ON s.id_external_system=x.external_system_id_user_external_identity
            WHERE x.status_user_external_identity='active' AND x.deleted_at_user_external_identity IS NULL AND s.status_external_system='active'`.execute(tx);
        const projectAliases = await sql<MarketingExternalIdentity>`SELECT p.public_id_project AS id,s.code_external_system AS ${sql.ref("system")},x.external_id_project_external_reference AS externalId
            FROM crm_project_external_reference x JOIN crm_project p ON p.id_project=x.project_id_project_external_reference JOIN int_external_system s ON s.id_external_system=x.external_system_id_project_external_reference
            WHERE x.status_project_external_reference='active' AND x.deleted_at_project_external_reference IS NULL AND s.status_external_system='active'`.execute(tx);
        const campaignAliases = await sql<MarketingExternalIdentity>`SELECT c.public_id_campaign AS id,s.code_external_system AS ${sql.ref("system")},x.external_id_campaign_external_reference AS externalId
            FROM crm_campaign_external_reference x JOIN crm_campaign c ON c.id_campaign=x.campaign_id_campaign_external_reference JOIN int_external_system s ON s.id_external_system=x.external_system_id_campaign_external_reference
            WHERE x.status_campaign_external_reference='active' AND x.deleted_at_campaign_external_reference IS NULL AND s.status_external_system='active'`.execute(tx);
        const leadAliases = await sql<MarketingExternalIdentity>`SELECT l.public_id_lead AS id,s.code_external_system AS ${sql.ref("system")},x.external_id_lead_external_reference AS externalId
            FROM crm_lead_external_reference x JOIN crm_lead l ON l.id_lead=x.lead_id_lead_external_reference JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference
            WHERE x.status_lead_external_reference='active' AND s.status_external_system='active'`.execute(tx);
        return {
            leads: leads.map((row) => ({ ...row, qualified: Number(row.qualified) === 1, hasSalesOrder: Number(row.hasSalesOrder) === 1, hasReservation: Number(row.hasReservation) === 1, lost: row.lost === 1, lossReason: row.lossReasonCode && row.lossReasonName?.trim() ? { code: row.lossReasonCode, name: row.lossReasonName.trim() } : null })),
            users: users.rows,
            projects: projects.rows,
            campaigns: campaigns.rows,
            userAliases: userAliases.rows,
            projectAliases: projectAliases.rows,
            campaignAliases: campaignAliases.rows,
            leadAliases: leadAliases.rows,
            events: await this.events(tx),
        };
    }
    private async events(tx: Transaction<CrmDatabase>): Promise<ReportEvent[]> {
        return readReportPages(async (offset) =>
            (
                await sql<Omit<ReportEvent, "invalidDate"> & { invalidDate: number }>`WITH linked AS (
            SELECT event_id_calendar_appointment AS eventId,lead_id_calendar_appointment AS leadId FROM crm_calendar_appointment WHERE lead_id_calendar_appointment IS NOT NULL
            UNION SELECT x.event_id_calendar_event_link,l.id_lead FROM crm_calendar_event_link x JOIN crm_lead l ON l.public_id_lead=x.entity_public_id_calendar_event_link
            WHERE x.entity_type_calendar_event_link='lead' AND x.deleted_at_calendar_event_link IS NULL
        ) SELECT /*+ MAX_EXECUTION_TIME(5000) */ e.public_id_calendar_event AS id,l.public_id_lead AS leadId,e.status_calendar_event AS status,
            (e.starts_at_calendar_event IS NULL) AS invalidDate
            FROM linked k JOIN crm_calendar_event e ON e.id_calendar_event=k.eventId JOIN crm_lead l ON l.id_lead=k.leadId
            JOIN conf_calendar_event_type t ON t.id_calendar_event_type=e.type_id_calendar_event
            WHERE e.deleted_at_calendar_event IS NULL AND (LOWER(TRIM(t.code_calendar_event_type)) IN ('cita','appointment') OR LOWER(TRIM(t.name_calendar_event_type))='cita')
            ORDER BY e.id_calendar_event,l.id_lead LIMIT ${REPORT_READ_PAGE_SIZE} OFFSET ${offset}`.execute(tx)
            ).rows.map((row) => ({ ...row, invalidDate: Boolean(row.invalidDate) })),
        );
    }
}
