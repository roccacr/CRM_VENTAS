import { sql } from "kysely";

import type { HistoricalLeadEvidence } from "../../../modules/crm/leads/lead-history.contract.js";
import type { LegacyCrmDatabaseService } from "../legacy-crm-database.service.js";
import { classifyLegacyHistory, legacyHistoryRowSchema } from "./legacy-lead-history.model.js";

/** Bounded reads using the separate READ ONLY pool. No writes, business imports or credentials in results. */
export class LegacyLeadHistoryReader {
    /** Only the existing read-only pool is accepted. */
    constructor(private readonly legacy: LegacyCrmDatabaseService) {}

    /** Fix the upper source ID before scanning so subsequent inserts belong to a later run. */
    async boundary() {
        return this.legacy.db.transaction().execute(async (tx) => {
            const result = await sql<{ upperId: number; total: number }>`SELECT COALESCE(MAX(id_bitacora_bit),0) AS upperId,COUNT(*) AS total FROM bitacoras`.execute(tx);
            return result.rows[0] ?? { upperId: 0, total: 0 };
        });
    }

    /** Source IDs, counts and original text are validated before crossing into the core. */
    async batch(afterId: number, upperId: number): Promise<HistoricalLeadEvidence[]> {
        const rows = await this.legacy.db.transaction().execute(async (tx) => {
            const result = await sql`SELECT b.id_bitacora_bit AS id,b.id_lead_bit AS leadReference,b.id_admin_bit AS actorReference,b.id_caida_bit AS reasonId,
              b.detalle_bit AS detail,b.tipo_documento_bit AS documentType,b.estado_bit AS stageLabel,b.estado_lead AS recordState,
              DATE_FORMAT(b.fecha_creado_bit,'%Y-%m-%d %H:%i:%s') AS dateText,b.fech_seg_bit AS followUpText,
              c.nombre_caida AS reasonName,c.estado_caida AS reasonState,c.segui AS reasonScope,
              (SELECT COUNT(*) FROM leads l WHERE l.idinterno_lead=b.id_lead_bit) AS matches,
              (SELECT MIN(id_lead) FROM leads l WHERE l.idinterno_lead=b.id_lead_bit) AS leadId,
              (SELECT COUNT(*) FROM admins a WHERE a.idnetsuite_admin=b.id_admin_bit) AS actorMatches,
              (SELECT MIN(name_admin) FROM admins a WHERE a.idnetsuite_admin=b.id_admin_bit) AS actorName
              FROM bitacoras b LEFT JOIN caidas c ON c.id_caida=b.id_caida_bit
              WHERE b.id_bitacora_bit>${afterId} AND b.id_bitacora_bit<=${upperId} ORDER BY b.id_bitacora_bit LIMIT 500`.execute(tx);
            return result.rows;
        });
        return rows.map((value) => {
            const row = legacyHistoryRowSchema.parse(value);
            const normalized = classifyLegacyHistory(row);
            const { matches: _matches, leadId: _lead, actorMatches: _actorMatches, actorName: _actor, ...original } = row;
            return { id: row.id, leadReference: String(row.leadReference), sourceLeadId: normalized.resolution === "matched" ? row.leadId : null, reasonId: row.reasonId, ...normalized, resolution: normalized.resolution as HistoricalLeadEvidence["resolution"], original };
        });
    }
}
