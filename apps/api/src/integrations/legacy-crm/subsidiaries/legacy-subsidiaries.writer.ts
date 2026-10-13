import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { SubsidiariesLegacyAccess, SubsidiaryLegacyPayload } from "../../../modules/crm/subsidiaries/subsidiaries-legacy.port.js";
import { isLegacyCrmEnabled } from "../legacy-crm-access.js";
import { mapLegacySubsidiary } from "./legacy-subsidiaries.mapper.js";

/** Subsidiary-only DML on the native transaction: both schemas commit or roll back together. */
@Injectable()
export class LegacySubsidiariesWriter implements SubsidiariesLegacyAccess {
    /** Uses the shared gate without opening a writable legacy pool. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /** Rechecked before every operation, including reads needed by mutations. */
    enabled(): boolean {
        return isLegacyCrmEnabled(this.config);
    }

    /** Locks the source row until its native promotion and audit finish. */
    async find(transaction: Transaction<CrmDatabase>, id: number) {
        if (!this.enabled()) return null;
        const result = await sql`SELECT id_subsidaria AS legacyId, id_NetsuiteSub AS externalId, Nombre_Subsidiaria AS name, Estado_Subsidiaria AS status FROM \`crmdatabase-api\`.subsidiarias WHERE id_subsidaria=${id} FOR UPDATE`.execute(transaction);
        return result.rows[0] ? mapLegacySubsidiary(result.rows[0]) : null;
    }

    /** Returns the generated legacy link; never adopts a conflicting existing row. */
    async create(transaction: Transaction<CrmDatabase>, payload: SubsidiaryLegacyPayload): Promise<number | null> {
        if (!this.enabled()) return null;
        if (payload.name.length > 250) throw new BadRequestException("Legacy subsidiary name exceeds 250 characters.");
        const externalId = this.externalId(payload);
        const duplicate = await sql`SELECT id_subsidaria FROM \`crmdatabase-api\`.subsidiarias WHERE id_NetsuiteSub=${externalId} OR Nombre_Subsidiaria=${payload.name} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (duplicate.rows.length) throw new ConflictException("La subsidiaria ya existe en legacy; edita el registro existente.");
        const result = await sql`INSERT INTO \`crmdatabase-api\`.subsidiarias (id_NetsuiteSub,Nombre_Subsidiaria,Estado_Subsidiaria) VALUES (${externalId},${payload.name},${payload.status === "active" ? 1 : 0})`.execute(transaction);
        const id = Number(result.insertId);
        if (!Number.isSafeInteger(id) || id <= 0) throw new ServiceUnavailableException("Legacy subsidiary identity unavailable.");
        return id;
    }

    /** Synchronizes only fields present in the legacy schema, without deleting records. */
    async update(transaction: Transaction<CrmDatabase>, id: number, payload: SubsidiaryLegacyPayload): Promise<void> {
        if (!this.enabled()) return;
        if (payload.name.length > 250) throw new BadRequestException("Legacy subsidiary name exceeds 250 characters.");
        if (!(await this.find(transaction, id))) throw new ConflictException("La subsidiaria vinculada ya no existe en legacy.");
        const externalId = this.externalId(payload);
        const conflict = await sql`SELECT id_subsidaria FROM \`crmdatabase-api\`.subsidiarias WHERE id_NetsuiteSub=${externalId} AND id_subsidaria<>${id} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (conflict.rows.length) throw new ConflictException("La referencia NetSuite pertenece a otra subsidiaria legacy.");
        await sql`UPDATE \`crmdatabase-api\`.subsidiarias SET Nombre_Subsidiaria=${payload.name},id_NetsuiteSub=${externalId},Estado_Subsidiaria=${payload.status === "active" ? 1 : 0} WHERE id_subsidaria=${id}`.execute(transaction);
    }

    private externalId(payload: SubsidiaryLegacyPayload): number | null {
        const references = payload.externalReferences.filter((reference) => reference.systemCode === "netsuite");
        const value = references[0]?.externalId;
        if (value === undefined) return null;
        if (references.length !== 1 || !/^-?\d+$/.test(value)) throw new BadRequestException("Legacy requiere exactamente un identificador NetSuite entero.");
        const id = Number(value);
        if (!Number.isSafeInteger(id) || id < -2147483648 || id > 2147483647) throw new BadRequestException("Identificador NetSuite fuera del rango INT legacy.");
        return id;
    }
}
