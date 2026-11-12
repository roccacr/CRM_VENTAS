import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import { type ApprovalLegacyReader, SALES_ORDER_SUMMARY_PAGE_SIZE } from "../../modules/crm/sales/sales-orders/approval-summary.port.js";
import { outsideFiniquito } from "../../modules/crm/sales/sales-orders/finiquito-exclusion.query.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";

/**
 * Ordenes pendientes de aprobacion de formalizacion, solo con lectura.
 *
 * Si el llamador trae transaccion, la pagina corre ahi. Si no, usa el pool
 * legado. Los flags tienen que ser exactamente esos: un nulo o un valor
 * distinto no cuenta como pendiente. Los nombres fisicos se conservan, incluidos
 * `chekJefeVenta` y `aprobacion__rdr_ov`.
 */
@Injectable()
export class LegacyApprovalReader implements ApprovalLegacyReader {
    /** No abre otra conexion ni guarda credenciales. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}

    /** El pool existe. No enciende la escritura. */
    enabled(): boolean {
        return this.database.isConfigured();
    }

    /**
     * Cursor por `id_ov`. Activa, no caida, jefe y desarrollador en 1, y
     * formalizacion en 0. El tope de 1500 ms es de la sentencia.
     */
    async pendingIds(after: number, transaction?: Transaction<CrmDatabase>): Promise<number[]> {
        const result = await sql<{ id_ov: number }>`
            SELECT /*+ MAX_EXECUTION_TIME(1500) */ id_ov FROM ${sql.table("crmdatabase-api.ordenventa")}
            WHERE id_ov > ${after} AND status_ov = 1 AND caida_ov = 0
              AND ${outsideFiniquito("legacy", sql`id_ov`)}
              AND chekJefeVenta = 1 AND aprobacion__rdr_ov = 1 AND aprobacion_forma_ov = 0
            ORDER BY id_ov LIMIT ${sql.lit(SALES_ORDER_SUMMARY_PAGE_SIZE)}
        `.execute(transaction ?? this.database.db);
        return result.rows.map((row) => row.id_ov);
    }
}
