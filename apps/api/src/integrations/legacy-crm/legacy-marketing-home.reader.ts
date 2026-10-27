import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import { type LegacyMarketingData, type LegacyMarketingOwner, type LegacyMarketingRow, marketingCount, type MarketingWindow } from "../../modules/crm/marketing/marketing-home.contract.js";
import type { MarketingHomeLegacyReader } from "../../modules/crm/marketing/marketing-home.port.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";
import { readLegacyAppointments } from "./legacy-marketing-appointments.reader.js";

/** Aggregates old lead rows without copying them. Calendar evidence is aggregate-only; no customer contact fields are read. */
@Injectable()
export class LegacyMarketingHomeReader implements MarketingHomeLegacyReader {
    /**
     *
     */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}
    /**
     *
     */
    enabled(): boolean {
        return this.database.isConfigured();
    }
    /**
     *
     */
    async read(tx: Transaction<CrmDatabase>, window: MarketingWindow): Promise<LegacyMarketingData> {
        const result = await sql<Omit<LegacyMarketingRow, "date"> & { dayNumber: number | string }>`
            SELECT /*+ MAX_EXECUTION_TIME(5000) */ dayNumber,sellerReference,projectReference,MAX(projectName) AS projectName,
                SUM(NOT (shadowed AND providerMatches=1)) AS leads,
                SUM(shadowed AND providerMatches=1) AS duplicates,
                SUM(shadowed AND providerMatches>1) AS ambiguous
            FROM (
                SELECT FLOOR((UNIX_TIMESTAMP(l.creado_lead)-21600)/86400) AS dayNumber,
                    CAST(l.id_empleado_lead AS CHAR) AS sellerReference,CAST(l.idproyecto_lead AS CHAR) AS projectReference,NULLIF(TRIM(l.proyecto_lead),'') AS projectName,
                    (SELECT COUNT(*) FROM ${sql.table("crmdatabase-api.leads")} sibling WHERE sibling.idinterno_lead=l.idinterno_lead) AS providerMatches,
                    EXISTS(SELECT 1 FROM crm_lead_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference
                        WHERE s.code_external_system='netsuite' AND s.status_external_system='active' AND x.status_lead_external_reference='active'
                        AND l.idinterno_lead>0 AND x.external_id_lead_external_reference COLLATE utf8mb4_bin=CAST(l.idinterno_lead AS CHAR) COLLATE utf8mb4_bin) AS shadowed
                FROM ${sql.table("crmdatabase-api.leads")} l
                WHERE l.creado_lead>=FROM_UNIXTIME(${window.startEpoch}) AND l.creado_lead<FROM_UNIXTIME(${window.endEpoch})
            ) evidence GROUP BY dayNumber,sellerReference,projectReference ORDER BY dayNumber,sellerReference,projectReference LIMIT 50001`.execute(tx);
        if (result.rows.length > 50000) throw new Error("Marketing legacy aggregate limit exceeded");
        const owners = await sql<LegacyMarketingOwner>`SELECT CAST(idnetsuite_admin AS CHAR) AS reference,
            CASE WHEN COUNT(DISTINCT NULLIF(LOWER(TRIM(email_admin)),'') COLLATE utf8mb4_bin)=1 THEN MIN(NULLIF(LOWER(TRIM(email_admin)),'') COLLATE utf8mb4_bin) ELSE NULL END AS email,
            CASE WHEN COUNT(DISTINCT NULLIF(LOWER(TRIM(email_admin)),'') COLLATE utf8mb4_bin)=1 THEN MAX(NULLIF(TRIM(name_admin),'')) ELSE NULL END AS name
            FROM ${sql.table("crmdatabase-api.admins")} GROUP BY idnetsuite_admin`.execute(tx);
        return { appointmentEvidence: await readLegacyAppointments(tx, window), provider: "netsuite", owners: owners.rows, rows: result.rows.map((row) => ({ date: new Date(Number(row.dayNumber) * 86400000).toISOString().slice(0, 10), sellerReference: row.sellerReference, projectReference: row.projectReference, projectName: row.projectName, leads: marketingCount(row.leads), duplicates: marketingCount(row.duplicates), ambiguous: marketingCount(row.ambiguous) })) };
    }
}
