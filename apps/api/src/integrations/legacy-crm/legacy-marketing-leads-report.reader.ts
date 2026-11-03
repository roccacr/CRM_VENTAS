import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { AppointmentState } from "../../modules/crm/marketing/marketing-appointments.contract.js";
import type { LegacyMarketingOwner, NativeMarketingProject } from "../../modules/crm/marketing/marketing-home.contract.js";
import type { ReportEvent, ReportLead, ReportSource } from "../../modules/crm/marketing/marketing-leads-report.contract.js";
import type { MarketingLeadsReportLegacyReader } from "../../modules/crm/marketing/marketing-leads-report.port.js";
import { readReportPages, REPORT_READ_PAGE_SIZE } from "../../modules/crm/marketing/marketing-leads-report.repository.js";
import { HISTORY_REASONS } from "./lead-history/legacy-lead-history.model.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";
import { legacyAppointmentDate } from "./legacy-marketing-appointments.reader.js";

const states: Record<string, AppointmentState> = { pendiente: "scheduled", completado: "completed", cancelado: "cancelled", scheduled: "scheduled", completed: "completed", cancelled: "cancelled" };
/** Reads old evidence in the approved native read-only snapshot, without importing records. */
@Injectable()
export class LegacyMarketingLeadsReportReader implements MarketingLeadsReportLegacyReader {
    /** Existing integration owns configuration; this reader never changes it. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}
    /** Disabled legacy is omitted; enabled-source failure fails the whole report. */
    enabled(): boolean {
        return this.database.isConfigured();
    }
    // El catálogo mezcla actividades y motivos: estado3/segui0 son pérdidas manuales; se conservan motivos históricos y automáticos confirmados.
    /** Provider lead/campaign references are never mistaken for legacy primary keys. */
    async read(tx: Transaction<CrmDatabase>): Promise<ReportSource> {
        const leads = await readReportPages(
            async (offset) =>
                (
                    await sql<Omit<ReportLead, "date" | "lost"> & { dayNumber: string | number | null; lost: number; lossReasonId: number | null; lossReasonName: string | null }>`SELECT /*+ MAX_EXECUTION_TIME(5000) */
            CAST(l.id_lead AS CHAR) AS id,COALESCE(CAST(l.idinterno_lead AS CHAR),'') AS providerId,FLOOR((UNIX_TIMESTAMP(l.creado_lead)-21600)/86400) AS dayNumber,
            COALESCE(CAST(l.id_empleado_lead AS CHAR),'') AS sellerId,COALESCE(CAST(l.idproyecto_lead AS CHAR),'') AS projectId,NULLIF(TRIM(l.proyecto_lead),'') AS projectName,
            COALESCE(NULLIF(TRIM(l.idcampana_lead),''),'') AS campaignId,NULLIF(TRIM(l.campana_lead),'') AS campaignName,
            l.calificado_lead AS qualified,
            EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.estimaciones")} e WHERE e.idLead_est=l.idinterno_lead) AS hasEstimate,
            EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.ordenventa")} o WHERE o.id_ov_lead=l.idinterno_lead) AS hasSalesOrder,
            l.custentityaccion_campana AS ad,(BINARY l.segimineto_lead='07-LEAD-PERDIDO') AS lost,c.id_caida AS lossReasonId,c.nombre_caida AS lossReasonName
            FROM ${sql.table("crmdatabase-api.leads")} l
            LEFT JOIN ${sql.table("crmdatabase-api.caidas")} c ON c.id_caida=l.id_Caida
                AND ((c.estado_caida=3 AND c.segui=0) OR c.id_caida IN (10,19,20,60,61,65,66,68))
            ORDER BY l.id_lead LIMIT ${REPORT_READ_PAGE_SIZE} OFFSET ${offset}`.execute(tx)
                ).rows,
        );
        const owners = await sql<LegacyMarketingOwner>`SELECT CAST(idnetsuite_admin AS CHAR) AS reference,
            CASE WHEN COUNT(DISTINCT NULLIF(LOWER(TRIM(email_admin)),'') COLLATE utf8mb4_bin)=1 THEN MIN(NULLIF(LOWER(TRIM(email_admin)),'') COLLATE utf8mb4_bin) ELSE NULL END AS email,
            CASE WHEN COUNT(DISTINCT NULLIF(LOWER(TRIM(email_admin)),'') COLLATE utf8mb4_bin)=1 THEN MAX(NULLIF(TRIM(name_admin),'')) ELSE NULL END AS name
            FROM ${sql.table("crmdatabase-api.admins")} GROUP BY idnetsuite_admin`.execute(tx);
        const campaigns = await sql<NativeMarketingProject>`SELECT CAST(id_NetsauiteCampana AS CHAR) AS id,MAX(NULLIF(TRIM(Nombre_Campana),'')) AS name
            FROM ${sql.table("crmdatabase-api.campanas")} GROUP BY id_NetsauiteCampana HAVING COUNT(*)=1`.execute(tx);
        const events = await readReportPages(
            async (offset) =>
                (
                    await sql<{ id: string; leadId: string; status: string | null; date: string | null }>`SELECT /*+ MAX_EXECUTION_TIME(5000) */
            CAST(c.id_calendar AS CHAR) AS id,COALESCE(CAST(c.id_lead AS CHAR),'') AS leadId,
            CASE WHEN n.id_calendar_event IS NULL THEN c.accion_calendar WHEN n.deleted_at_calendar_event IS NOT NULL THEN 'cancelled' ELSE n.status_calendar_event END AS status,
            CASE WHEN n.id_calendar_event IS NULL THEN c.fechaIni_calendar ELSE DATE_FORMAT(DATE_SUB(n.starts_at_calendar_event,INTERVAL 6 HOUR),'%Y-%m-%dT%H:%i:%s') END AS date
            FROM ${sql.table("crmdatabase-api.calendars")} c
            LEFT JOIN crm_calendar_event n ON n.legacy_calendar_id_calendar_event=c.id_calendar
            WHERE LOWER(TRIM(c.tipo_calendar))='cita'
            ORDER BY c.id_calendar LIMIT ${REPORT_READ_PAGE_SIZE} OFFSET ${offset}`.execute(tx)
                ).rows,
        );
        const linkedEvents = await readReportPages(async (offset) =>
            (
                await sql<Omit<ReportEvent, "invalidDate"> & { invalidDate: number }>`SELECT DISTINCT
            e.public_id_calendar_event AS id,CONCAT('legacy-pk:',CAST(l.id_lead AS CHAR)) AS leadId,e.status_calendar_event AS status,
            (e.starts_at_calendar_event IS NULL) AS invalidDate
            FROM crm_calendar_event_link x JOIN ${sql.table("crmdatabase-api.leads")} l ON CAST(l.id_lead AS CHAR)=x.entity_public_id_calendar_event_link
            JOIN crm_calendar_event e ON e.id_calendar_event=x.event_id_calendar_event_link
            JOIN conf_calendar_event_type t ON t.id_calendar_event_type=e.type_id_calendar_event
            WHERE x.source_calendar_event_link='legacy' AND x.entity_type_calendar_event_link='lead' AND x.deleted_at_calendar_event_link IS NULL
            AND e.deleted_at_calendar_event IS NULL
            AND (LOWER(TRIM(t.code_calendar_event_type)) IN ('cita','appointment') OR LOWER(TRIM(t.name_calendar_event_type))='cita')
            ORDER BY e.public_id_calendar_event,leadId LIMIT ${REPORT_READ_PAGE_SIZE} OFFSET ${offset}`.execute(tx)
            ).rows.map((row) => ({ ...row, invalidDate: Boolean(row.invalidDate) })),
        );
        return {
            leads: leads.map((row) => ({
                ...row,
                date: row.dayNumber === null ? null : new Date(Number(row.dayNumber) * 86400000).toISOString().slice(0, 10),
                qualified: Number(row.qualified) === 1,
                hasEstimate: Number(row.hasEstimate) === 1,
                hasSalesOrder: Number(row.hasSalesOrder) === 1,
                lost: row.lost === 1,
                lossReason: row.lossReasonId && row.lossReasonName?.trim() ? (HISTORY_REASONS[row.lossReasonId] ?? { code: `legacy:${String(row.lossReasonId)}`, name: row.lossReasonName.trim() }) : null,
            })),
            events: [...linkedEvents, ...events.map((row): ReportEvent => ({ id: row.id, leadId: row.leadId, status: states[(row.status ?? "").trim().toLowerCase()] ?? "unknown", invalidDate: legacyAppointmentDate(row.date ?? "") === null }))],
            users: [],
            projects: [],
            campaigns: campaigns.rows,
            owners: owners.rows,
            userAliases: [],
            projectAliases: [],
            campaignAliases: [],
            leadAliases: [],
        };
    }
}
