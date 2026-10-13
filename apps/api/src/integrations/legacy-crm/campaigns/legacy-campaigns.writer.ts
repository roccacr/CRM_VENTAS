import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { CampaignLegacyPayload, CampaignsLegacyAccess } from "../../../modules/crm/campaigns/campaigns-legacy.port.js";
import { isLegacyCrmEnabled } from "../legacy-crm-access.js";
import { mapLegacyCampaign } from "./legacy-campaigns.mapper.js";

/** Campaign-only DML on the native transaction: both schemas commit or roll back together. */
@Injectable()
export class LegacyCampaignsWriter implements CampaignsLegacyAccess {
    /** Uses the shared gate without opening a writable legacy pool. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /** Rechecked before every operation, including reads needed by mutations. */
    enabled(): boolean {
        return isLegacyCrmEnabled(this.config);
    }

    /** Locks the source row until its native promotion and audit finish. */
    async find(transaction: Transaction<CrmDatabase>, id: number) {
        if (!this.enabled()) return null;
        const result = await sql`SELECT id_Campana AS legacyId, id_NetsauiteCampana AS externalId, Nombre_Campana AS name, Estado_Campana AS status FROM \`crmdatabase-api\`.campanas WHERE id_Campana=${id} FOR UPDATE`.execute(transaction);
        return result.rows[0] ? mapLegacyCampaign(result.rows[0]) : null;
    }

    /** Returns the generated legacy link; never adopts a conflicting existing row. */
    async create(transaction: Transaction<CrmDatabase>, payload: CampaignLegacyPayload): Promise<number | null> {
        if (!this.enabled()) return null;
        const externalId = this.externalId(payload);
        const duplicate = await sql`SELECT id_Campana FROM \`crmdatabase-api\`.campanas WHERE id_NetsauiteCampana=${externalId} OR Nombre_Campana=${payload.name} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (duplicate.rows.length) throw new ConflictException("La campaña ya existe en legacy; edita el registro existente.");
        const result = await sql`INSERT INTO \`crmdatabase-api\`.campanas (id_NetsauiteCampana,Nombre_Campana,Estado_Campana) VALUES (${externalId},${payload.name},${payload.status === "active" ? 1 : 0})`.execute(transaction);
        const id = Number(result.insertId);
        if (!Number.isSafeInteger(id) || id <= 0) throw new ServiceUnavailableException("Legacy campaign identity unavailable.");
        return id;
    }

    /** Synchronizes only fields present in the legacy schema, without deleting records. */
    async update(transaction: Transaction<CrmDatabase>, id: number, payload: CampaignLegacyPayload): Promise<void> {
        if (!this.enabled()) return;
        if (!(await this.find(transaction, id))) throw new ConflictException("La campaña vinculada ya no existe en legacy.");
        const externalId = this.externalId(payload);
        const conflict = await sql`SELECT id_Campana FROM \`crmdatabase-api\`.campanas WHERE id_NetsauiteCampana=${externalId} AND id_Campana<>${id} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (conflict.rows.length) throw new ConflictException("La referencia NetSuite pertenece a otra campaña legacy.");
        await sql`UPDATE \`crmdatabase-api\`.campanas SET Nombre_Campana=${payload.name},id_NetsauiteCampana=${externalId},Estado_Campana=${payload.status === "active" ? 1 : 0} WHERE id_Campana=${id}`.execute(transaction);
    }

    private externalId(payload: CampaignLegacyPayload): number | null {
        const references = payload.externalReferences.filter((reference) => reference.systemCode === "netsuite");
        const value = references[0]?.externalId;
        if (value === undefined) return null;
        if (references.length !== 1 || !/^-?\d+$/.test(value)) throw new BadRequestException("Legacy requiere exactamente un identificador NetSuite entero.");
        const id = Number(value);
        if (!Number.isSafeInteger(id) || id < -2147483648 || id > 2147483647) throw new BadRequestException("Identificador NetSuite fuera del rango INT legacy.");
        return id;
    }
}
