import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { AppointmentState, LegacyAppointmentEvent, LegacyAppointmentEvidence, LegacyAppointmentLead } from "../../modules/crm/marketing/marketing-appointments.contract.js";
import type { MarketingWindow } from "../../modules/crm/marketing/marketing-home.contract.js";

/** Reject invalid legacy dates without interpreting text notes or appointment flags as attendance. */
export function legacyAppointmentDate(value: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) return null;
    const day = value.slice(0, 10);
    const parsed = new Date(`${day}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : null;
}
const states: Record<string, AppointmentState> = { pendiente: "scheduled", completado: "completed", cancelado: "cancelled" };
/** Read legacy cohorts and unique calendar identities; provider lead reference is not the old lead PK. */
export async function readLegacyAppointments(tx: Transaction<CrmDatabase>, window: MarketingWindow): Promise<LegacyAppointmentEvidence> {
    const cohorts = await sql<Omit<LegacyAppointmentLead, "date" | "providerMatches"> & { dayNumber: number | string; providerMatches: number | string }>`SELECT /*+ MAX_EXECUTION_TIME(5000) */ CAST(l.id_lead AS CHAR) AS id,
        FLOOR((UNIX_TIMESTAMP(l.creado_lead)-21600)/86400) AS dayNumber,CAST(l.idinterno_lead AS CHAR) AS providerId,
        (SELECT COUNT(*) FROM ${sql.table("crmdatabase-api.leads")} sibling WHERE sibling.idinterno_lead=l.idinterno_lead) AS providerMatches,
        CAST(l.id_empleado_lead AS CHAR) AS sellerReference,CAST(l.idproyecto_lead AS CHAR) AS projectReference,NULLIF(TRIM(l.proyecto_lead),'') AS projectName
        FROM ${sql.table("crmdatabase-api.leads")} l WHERE l.creado_lead>=FROM_UNIXTIME(${window.startEpoch}) AND l.creado_lead<FROM_UNIXTIME(${window.endEpoch}) LIMIT 100001`.execute(tx);
    const events = await sql<Omit<LegacyAppointmentEvent, "status" | "attendance" | "providerMatches"> & { status: string; providerMatches: number | string }>`SELECT /*+ MAX_EXECUTION_TIME(5000) */ CAST(c.id_calendar AS CHAR) AS eventId,c.fechaIni_calendar AS date,
        c.accion_calendar AS status,CAST(l.id_lead AS CHAR) AS id,CAST(l.idinterno_lead AS CHAR) AS providerId,
        (SELECT COUNT(*) FROM ${sql.table("crmdatabase-api.leads")} sibling WHERE sibling.idinterno_lead=l.idinterno_lead) AS providerMatches,
        CAST(l.id_empleado_lead AS CHAR) AS sellerReference,CAST(l.idproyecto_lead AS CHAR) AS projectReference,NULLIF(TRIM(l.proyecto_lead),'') AS projectName
        FROM ${sql.table("crmdatabase-api.calendars")} c JOIN ${sql.table("crmdatabase-api.leads")} l ON l.idinterno_lead=c.id_lead
        WHERE LOWER(TRIM(c.tipo_calendar))='cita' AND c.id_lead>0 LIMIT 50001`.execute(tx);
    if (cohorts.rows.length > 100000 || events.rows.length > 50000) throw new Error("Marketing legacy appointment evidence limit exceeded");
    const unresolved = await sql<{ id: string }>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ CAST(c.id_calendar AS CHAR) AS id
        FROM ${sql.table("crmdatabase-api.calendars")} c WHERE LOWER(TRIM(c.tipo_calendar))='cita'
        AND (c.id_lead IS NULL OR c.id_lead<=0 OR (SELECT COUNT(*) FROM ${sql.table("crmdatabase-api.leads")} l WHERE l.idinterno_lead=c.id_lead)<>1) LIMIT 50001`.execute(tx);
    if (unresolved.rows.length > 50000) throw new Error("Marketing unresolved appointment limit exceeded");
    let invalidDates = 0;
    const valid: LegacyAppointmentEvent[] = [];
    for (const row of events.rows) {
        const date = legacyAppointmentDate(row.date);
        if (!date) {
            invalidDates++;
            continue;
        }
        valid.push({ ...row, date, status: states[row.status.trim().toLowerCase()] ?? "unknown", attendance: null, providerMatches: Number(row.providerMatches) });
    }
    return { cohorts: cohorts.rows.map((row) => ({ ...row, date: new Date(Number(row.dayNumber) * 86400000).toISOString().slice(0, 10), providerMatches: Number(row.providerMatches) })), events: valid, invalidDates, unresolvedEventIds: unresolved.rows.map((row) => row.id) };
}
