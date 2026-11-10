import { sql } from "kysely";

import type { HistoricalLeadEvidence } from "../../../modules/crm/leads/lead-history.contract.js";
import type { LegacyCrmDatabaseService } from "../legacy-crm-database.service.js";
import { classifyLegacyHistory, legacyHistoryRowSchema } from "./legacy-lead-history.model.js";

/**
 * Lectura acotada de `bitacoras` por el pool legado de solo lectura.
 *
 * No escribe, no importa al CRM nuevo y no selecciona credenciales. El
 * resultado es evidencia para un corte posterior. No se persiste en
 * `CRM_THINK_V2` desde aqui.
 */
export class LegacyLeadHistoryReader {
    /** Recibe el pool que ya existe. No abre otra conexion ni una de escritura. */
    constructor(private readonly legacy: LegacyCrmDatabaseService) {}

    /**
     * Fija el id maximo antes de recorrer. Un alta posterior queda por encima
     * de ese tope y pertenece a otra corrida. La transaccion hace que el maximo
     * y el total vean el mismo corte. Una tabla vacia devuelve cero, no null.
     */
    async boundary() {
        return this.legacy.db.transaction().execute(async (tx) => {
            const result = await sql<{ upperId: number; total: number }>`SELECT COALESCE(MAX(id_bitacora_bit),0) AS upperId,COUNT(*) AS total FROM bitacoras`.execute(tx);
            return result.rows[0] ?? { upperId: 0, total: 0 };
        });
    }

    /**
     * Pagina de hasta 500 filas, del id anterior exclusivo al tope inclusivo,
     * en orden de id. La fecha sale como texto: no se convierte a `Date` ni se
     * le asigna zona.
     *
     * Cada fila se valida antes de cruzar al nucleo. El `MIN` del lead y del
     * nombre solo sirve para armar la columna; si hay mas de una coincidencia,
     * la evidencia no se queda con ese minimo. El original que viaja tampoco
     * lleva esos datos vivos del directorio.
     */
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
