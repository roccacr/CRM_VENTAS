import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { BankAssignmentLegacy, BankAssignmentOrder } from "../../modules/crm/sales/sales-orders/order-bank-assignment.port.js";
/** Read-only legacy order authority; assignment writes always stay in the native CRM. */
@Injectable()
export class LegacyOrderBankAssignmentReader implements BankAssignmentLegacy {
    /** Usa servicios inyectados para conservar los límites de identidad, catálogo y auditoría. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
    /** Consulta la asignación sin escribir en la orden ni en su bitácora. */
    async read(tx: Transaction<CrmDatabase>, id: string, lock: boolean): Promise<BankAssignmentOrder | undefined> {
        if (this.config.get<unknown>("ENABLE_LEGACY_FALLBACK") !== true || this.config.get<unknown>("LEGACY_CRM_DB_NAME") !== "crmdatabase-api") throw new ServiceUnavailableException("La fuente antigua no está habilitada.");
        const ending = lock ? sql`FOR UPDATE` : sql``;
        const row = (await sql<{ id: string; active: number | string }>`SELECT CAST(id_ov AS CHAR) AS id,(status_ov=1 AND caida_ov=0) AS active FROM \`crmdatabase-api\`.ordenventa WHERE id_ov=${Number(id)} ${ending}`.execute(tx)).rows[0];
        return row ? { source: "legacy", id: row.id, internalId: row.id, active: Number(row.active) === 1 } : undefined;
    }
}
