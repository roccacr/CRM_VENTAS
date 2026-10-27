import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { NativeAppointmentAlias, NativeAppointmentEvent, NativeAppointmentEvidence, NativeAppointmentLead } from "./marketing-appointments.contract.js";
import type { MarketingWindow } from "./marketing-home.contract.js";

/** Native evidence only. Participant copies and event creator never determine commercial attribution. */
export async function readNativeAppointments(tx: Transaction<CrmDatabase>, window: MarketingWindow): Promise<NativeAppointmentEvidence> {
    const from = new Date(window.startEpoch * 1000).toISOString().slice(0, 23).replace("T", " ");
    const to = new Date(window.endEpoch * 1000).toISOString().slice(0, 23).replace("T", " ");
    const cohorts = await sql<NativeAppointmentLead>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ l.public_id_lead AS id,
        DATE_FORMAT(DATE_SUB(l.created_at_lead,INTERVAL 6 HOUR),'%Y-%m-%d') AS date,
        COALESCE(u.public_id_user,'unassigned') AS sellerId,p.public_id_project AS projectId
        FROM crm_lead l LEFT JOIN sec_user u ON u.id_user=l.owner_user_id_lead JOIN crm_project p ON p.id_project=l.project_id_lead
        WHERE l.created_at_lead>=${from} AND l.created_at_lead<${to} LIMIT 100001`.execute(tx);
    const aliases = await sql<NativeAppointmentAlias>`SELECT l.public_id_lead AS id,s.code_external_system AS ${sql.ref("system")},x.external_id_lead_external_reference AS externalId,
        COALESCE(u.public_id_user,'unassigned') AS sellerId,p.public_id_project AS projectId
        FROM crm_lead_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference
        JOIN crm_lead l ON l.id_lead=x.lead_id_lead_external_reference LEFT JOIN sec_user u ON u.id_user=l.owner_user_id_lead JOIN crm_project p ON p.id_project=l.project_id_lead
        WHERE x.status_lead_external_reference='active' AND s.status_external_system='active' LIMIT 100001`.execute(tx);
    const type = sql`(LOWER(TRIM(t.code_calendar_event_type)) IN ('cita','appointment') OR LOWER(TRIM(t.name_calendar_event_type))='cita')`;
    const types = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM conf_calendar_event_type t WHERE ${type}`.execute(tx);
    const events = await sql<NativeAppointmentEvent>`WITH linked AS (
        SELECT event_id_calendar_appointment AS eventId,lead_id_calendar_appointment AS leadId FROM crm_calendar_appointment WHERE lead_id_calendar_appointment IS NOT NULL
        UNION
        SELECT x.event_id_calendar_event_link,l.id_lead FROM crm_calendar_event_link x JOIN crm_lead l ON l.public_id_lead=x.entity_public_id_calendar_event_link
        WHERE x.entity_type_calendar_event_link='lead' AND x.deleted_at_calendar_event_link IS NULL
    ) SELECT /*+ MAX_EXECUTION_TIME(5000) */ e.public_id_calendar_event AS eventId,l.public_id_lead AS id,
        DATE_FORMAT(DATE_SUB(e.starts_at_calendar_event,INTERVAL 6 HOUR),'%Y-%m-%d') AS date,
        e.status_calendar_event AS status,CASE WHEN a.progress_calendar_appointment IN ('attended','missed') THEN a.progress_calendar_appointment ELSE NULL END AS attendance,
        COALESCE(u.public_id_user,'unassigned') AS sellerId,p.public_id_project AS projectId
        FROM linked k JOIN crm_calendar_event e ON e.id_calendar_event=k.eventId JOIN conf_calendar_event_type t ON t.id_calendar_event_type=e.type_id_calendar_event
        JOIN crm_lead l ON l.id_lead=k.leadId LEFT JOIN sec_user u ON u.id_user=l.owner_user_id_lead JOIN crm_project p ON p.id_project=l.project_id_lead
        LEFT JOIN crm_calendar_appointment a ON a.event_id_calendar_appointment=e.id_calendar_event
        WHERE e.deleted_at_calendar_event IS NULL AND ${type}
        AND ((e.starts_at_calendar_event>=${from} AND e.starts_at_calendar_event<${to}) OR (l.created_at_lead>=${from} AND l.created_at_lead<${to})) LIMIT 50001`.execute(tx);
    if (cohorts.rows.length > 100000 || aliases.rows.length > 100000 || events.rows.length > 50000) throw new Error("Marketing native appointment evidence limit exceeded");
    return { cohorts: cohorts.rows, aliases: aliases.rows, events: events.rows, typeCount: Number(types.rows[0]?.total ?? 0) };
}
