import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { AppointmentState } from "../../modules/crm/marketing/marketing-appointments.contract.js";
import type { LegacyMarketingOwner, NativeMarketingProject } from "../../modules/crm/marketing/marketing-home.contract.js";
import type { ReportEvent, ReportLead, ReportSource } from "../../modules/crm/marketing/marketing-leads-report.contract.js";
import type { MarketingLeadsReportLegacyReader } from "../../modules/crm/marketing/marketing-leads-report.port.js";
import { readReportPages, REPORT_READ_PAGE_SIZE } from "../../modules/crm/marketing/marketing-leads-report.repository.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";
import { legacyAppointmentDate } from "./legacy-marketing-appointments.reader.js";

const states: Record<string, AppointmentState> = { pendiente: "scheduled", completado: "completed", cancelado: "cancelled" };
/** Reads old evidence in the approved native read-only snapshot, without importing records. */
@Injectable()
export class LegacyMarketingLeadsReportReader implements MarketingLeadsReportLegacyReader {
    /** Existing integration owns configuration; this reader never changes it. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}
    /** Disabled legacy is omitted; enabled-source failure fails the whole report. */
    enabled(): boolean {
        return this.database.isConfigured();
    }
    /** Provider lead/campaign references are never mistaken for legacy primary keys. */
    async read(tx: Transaction<CrmDatabase>): Promise<ReportSource> {
        const leads = await readReportPages(
            async (offset) =>
                (
                    await sql<Omit<ReportLead, "date" | "lost"> & { dayNumber: string | number | null; lost: number }>`SELECT /*+ MAX_EXECUTION_TIME(5000) */
            CAST(l.id_lead AS CHAR) AS id,COALESCE(CAST(l.idinterno_lead AS CHAR),'') AS providerId,FLOOR((UNIX_TIMESTAMP(l.creado_lead)-21600)/86400) AS dayNumber,
            COALESCE(CAST(l.id_empleado_lead AS CHAR),'') AS sellerId,COALESCE(CAST(l.idproyecto_lead AS CHAR),'') AS projectId,NULLIF(TRIM(l.proyecto_lead),'') AS projectName,
            COALESCE(NULLIF(TRIM(l.idcampana_lead),''),'') AS campaignId,NULLIF(TRIM(l.campana_lead),'') AS campaignName,
            l.custentityaccion_campana AS ad,(BINARY l.segimineto_lead='07-LEAD-PERDIDO') AS lost
            FROM ${sql.table("crmdatabase-api.leads")} l ORDER BY l.id_lead LIMIT ${REPORT_READ_PAGE_SIZE} OFFSET ${offset}`.execute(tx)
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
            CAST(id_calendar AS CHAR) AS id,COALESCE(CAST(id_lead AS CHAR),'') AS leadId,accion_calendar AS status,fechaIni_calendar AS date
            FROM ${sql.table("crmdatabase-api.calendars")} WHERE LOWER(TRIM(tipo_calendar))='cita'
            ORDER BY id_calendar LIMIT ${REPORT_READ_PAGE_SIZE} OFFSET ${offset}`.execute(tx)
                ).rows,
        );
        return {
            leads: leads.map((row) => ({ ...row, date: row.dayNumber === null ? null : new Date(Number(row.dayNumber) * 86400000).toISOString().slice(0, 10), lost: row.lost === 1 })),
            events: events.map((row): ReportEvent => ({ id: row.id, leadId: row.leadId, status: states[(row.status ?? "").trim().toLowerCase()] ?? "unknown", invalidDate: legacyAppointmentDate(row.date ?? "") === null })),
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
