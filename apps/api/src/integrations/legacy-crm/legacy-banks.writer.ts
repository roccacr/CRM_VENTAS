import { ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { Bank, BankAdvisor } from "../../modules/crm/banks/banks.types.js";
import type { BanksLegacyAccess } from "../../modules/crm/banks/banks-legacy.port.js";
/**
 * Espejo de bancos dentro de la transaccion nativa. No abre el pool legado.
 *
 * Si el fallback esta apagado, no copia y el banco queda solo en el CRM nuevo.
 * Si el fallback esta encendido, escribir exige `ENABLE_LEGACY_WRITES` y el
 * nombre exacto `crmdatabase-api`. Si falta cualquiera de las dos, el alta
 * nativa no sigue: un espejo a medias no se disfraza de exito. No exige
 * `NODE_ENV=production`; esa condicion pertenece a la compuerta de catalogos.
 *
 * La identidad publica y la version las manda el CRM nuevo. Un id que ya
 * existe no se adopta, y una version distinta no se pisa.
 */
@Injectable()
export class LegacyBanksWriter implements BanksLegacyAccess {
    /** Solo lee la configuracion. La conexion es la transaccion que trae el llamador. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
    /** Corta antes de la escritura nativa cuando el espejo pedido no se puede cumplir. */
    assertWritable(): void {
        if (this.config.get<unknown>("ENABLE_LEGACY_FALLBACK") !== true) return;
        if (this.config.get<unknown>("ENABLE_LEGACY_WRITES") !== true || this.config.get<unknown>("LEGACY_CRM_DB_NAME") !== "crmdatabase-api") throw new ServiceUnavailableException("Banks mirror requires explicit legacy writes and exact legacy schema.");
    }
    /** La transaccion tiene que ser la nativa. Sin `isTransaction` no hay espejo. */
    private enabled(tx: unknown): boolean {
        this.assertWritable();
        if (this.config.get<unknown>("ENABLE_LEGACY_FALLBACK") !== true) return false;
        if (tx === null || typeof tx !== "object" || Reflect.get(tx, "isTransaction") !== true) throw new ServiceUnavailableException("Banks mirror requires the native transaction.");
        return true;
    }
    /** Alta si no hay version esperada. Actualizacion solo si la version bloqueada coincide y cambia una fila. */
    async writeBank(tx: Transaction<CrmDatabase>, bank: Bank, expectedVersion?: number): Promise<void> {
        if (!this.enabled(tx)) return;
        const current = await sql<{ version: number }>`SELECT version_bank AS version FROM \`crmdatabase-api\`.crm_bank WHERE public_id_bank=${bank.publicId} FOR UPDATE`.execute(tx);
        if (expectedVersion === undefined) {
            if (current.rows.length) throw new ConflictException({ statusCode: 409, code: "BANK_MIRROR_CONFLICT", message: "Legacy bank identity already exists." });
            await sql`INSERT INTO \`crmdatabase-api\`.crm_bank (public_id_bank,name_bank,status_bank,version_bank,created_at_bank,updated_at_bank) VALUES (${bank.publicId},${bank.name},${bank.status},${bank.version},${new Date(bank.createdAt)},${new Date(bank.updatedAt)})`.execute(tx);
            return;
        }
        if (Number(current.rows[0]?.version) !== expectedVersion) throw new ConflictException({ statusCode: 409, code: "BANK_VERSION_CONFLICT", message: "Legacy bank version differs from native authority." });
        const result = await sql`UPDATE \`crmdatabase-api\`.crm_bank SET name_bank=${bank.name},status_bank=${bank.status},version_bank=${bank.version},created_at_bank=${new Date(bank.createdAt)},updated_at_bank=${new Date(bank.updatedAt)} WHERE public_id_bank=${bank.publicId} AND version_bank=${expectedVersion}`.execute(tx);
        if (result.numAffectedRows !== 1n) throw new ConflictException({ statusCode: 409, code: "BANK_VERSION_CONFLICT", message: "Legacy bank changed." });
    }
    /** El asesor cuelga del banco ya espejado. Sin ese padre, no se crea un asesor suelto. */
    async writeAdvisor(tx: Transaction<CrmDatabase>, advisor: BankAdvisor, expectedVersion?: number): Promise<void> {
        if (!this.enabled(tx)) return;
        const parents = await sql<{ id: string }>`SELECT CAST(id_bank AS CHAR) AS id FROM \`crmdatabase-api\`.crm_bank WHERE public_id_bank=${advisor.bankPublicId} FOR UPDATE`.execute(tx);
        const parent = parents.rows[0];
        if (!parent) throw new ConflictException({ statusCode: 409, code: "BANK_MIRROR_CONFLICT", message: "Legacy parent bank is unavailable." });
        const current = await sql<{ version: number }>`SELECT version_bank_advisor AS version FROM \`crmdatabase-api\`.crm_bank_advisor WHERE public_id_bank_advisor=${advisor.publicId} AND bank_id_bank_advisor=${parent.id} FOR UPDATE`.execute(tx);
        if (expectedVersion === undefined) {
            if (current.rows.length) throw new ConflictException({ statusCode: 409, code: "BANK_MIRROR_CONFLICT", message: "Legacy advisor identity already exists." });
            await sql`INSERT INTO \`crmdatabase-api\`.crm_bank_advisor (public_id_bank_advisor,bank_id_bank_advisor,name_bank_advisor,email_bank_advisor,phone_bank_advisor,area_bank_advisor,status_bank_advisor,version_bank_advisor,created_at_bank_advisor,updated_at_bank_advisor) VALUES (${advisor.publicId},${parent.id},${advisor.name},${advisor.email},${advisor.phone},${advisor.area},${advisor.status},${advisor.version},${new Date(advisor.createdAt)},${new Date(advisor.updatedAt)})`.execute(tx);
            return;
        }
        if (Number(current.rows[0]?.version) !== expectedVersion) throw new ConflictException({ statusCode: 409, code: "BANK_VERSION_CONFLICT", message: "Legacy advisor version differs from native authority." });
        const result =
            await sql`UPDATE \`crmdatabase-api\`.crm_bank_advisor SET name_bank_advisor=${advisor.name},email_bank_advisor=${advisor.email},phone_bank_advisor=${advisor.phone},area_bank_advisor=${advisor.area},status_bank_advisor=${advisor.status},version_bank_advisor=${advisor.version},created_at_bank_advisor=${new Date(advisor.createdAt)},updated_at_bank_advisor=${new Date(advisor.updatedAt)} WHERE public_id_bank_advisor=${advisor.publicId} AND bank_id_bank_advisor=${parent.id} AND version_bank_advisor=${expectedVersion}`.execute(
                tx,
            );
        if (result.numAffectedRows !== 1n) throw new ConflictException({ statusCode: 409, code: "BANK_VERSION_CONFLICT", message: "Legacy advisor changed." });
    }
}
