import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";

import type { ApprovalLegacyReader } from "../../modules/crm/sales/sales-orders/approval-summary.port.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";

/** Reads existing production columns only, using the catalog fallback pool. */
@Injectable()
export class LegacyApprovalReader implements ApprovalLegacyReader {
    /** No independent connection or credentials. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}

    /** Configuration remains removable with the shared fallback. */
    enabled(): boolean {
        return this.database.isConfigured();
    }

    /** Exact legacy eligibility; no assumptions for null or unknown flags. */
    async pendingIds(after: number): Promise<number[]> {
        const result = await sql<{ id_ov: number }>`
            SELECT id_ov FROM ordenventa
            WHERE id_ov > ${after} AND status_ov = 1 AND caida_ov = 0
              AND chekJefeVenta = 1 AND aprobacion__rdr_ov = 1 AND aprobacion_forma_ov = 0
            ORDER BY id_ov LIMIT 500
        `.execute(this.database.db);
        return result.rows.map((row) => row.id_ov);
    }
}
