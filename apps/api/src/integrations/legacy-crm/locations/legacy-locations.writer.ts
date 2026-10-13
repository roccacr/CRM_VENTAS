import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { LocationLegacyPayload, LocationsLegacyAccess } from "../../../modules/crm/locations/locations-legacy.port.js";
import { isLegacyCrmEnabled } from "../legacy-crm-access.js";
import { mapLegacyLocation } from "./legacy-locations.mapper.js";

/** Location-only DML on the native transaction: both schemas commit or roll back together. */
@Injectable()
export class LegacyLocationsWriter implements LocationsLegacyAccess {
    /** Uses the shared gate without opening a writable legacy pool. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /** Rechecked before every operation, including reads needed by mutations. */
    enabled(): boolean {
        return isLegacyCrmEnabled(this.config);
    }

    /** Locks the source row until its native promotion and audit finish. */
    async find(transaction: Transaction<CrmDatabase>, id: number) {
        if (!this.enabled()) return null;
        const result = await sql`SELECT id_ubicaciones AS legacyId, idNetsuite_ubicaciones AS externalId, nombre_ubicaciones AS name, estado_ubicaciones AS status FROM \`crmdatabase-api\`.ubicaciones WHERE id_ubicaciones=${id} FOR UPDATE`.execute(transaction);
        return result.rows[0] ? mapLegacyLocation(result.rows[0]) : null;
    }

    /** Returns the generated legacy link; never adopts a conflicting existing row. */
    async create(transaction: Transaction<CrmDatabase>, payload: LocationLegacyPayload): Promise<number | null> {
        if (!this.enabled()) return null;
        if (payload.name.length > 100) throw new BadRequestException("Legacy location name exceeds 100 characters.");
        const externalId = this.externalId(payload);
        const duplicate = await sql`SELECT id_ubicaciones FROM \`crmdatabase-api\`.ubicaciones WHERE idNetsuite_ubicaciones=${externalId} OR nombre_ubicaciones=${payload.name} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (duplicate.rows.length) throw new ConflictException("La ubicación ya existe en legacy; edita el registro existente.");
        const result = await sql`INSERT INTO \`crmdatabase-api\`.ubicaciones (idNetsuite_ubicaciones,nombre_ubicaciones,estado_ubicaciones) VALUES (${externalId},${payload.name},${payload.status === "active" ? 1 : 0})`.execute(transaction);
        const id = Number(result.insertId);
        if (!Number.isSafeInteger(id) || id <= 0) throw new ServiceUnavailableException("Legacy location identity unavailable.");
        return id;
    }

    /** Synchronizes only fields present in the legacy schema, without deleting records. */
    async update(transaction: Transaction<CrmDatabase>, id: number, payload: LocationLegacyPayload): Promise<void> {
        if (!this.enabled()) return;
        if (payload.name.length > 100) throw new BadRequestException("Legacy location name exceeds 100 characters.");
        if (!(await this.find(transaction, id))) throw new ConflictException("La ubicación vinculada ya no existe en legacy.");
        const externalId = this.externalId(payload);
        const conflict = await sql`SELECT id_ubicaciones FROM \`crmdatabase-api\`.ubicaciones WHERE idNetsuite_ubicaciones=${externalId} AND id_ubicaciones<>${id} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (conflict.rows.length) throw new ConflictException("La referencia NetSuite pertenece a otra ubicación legacy.");
        await sql`UPDATE \`crmdatabase-api\`.ubicaciones SET nombre_ubicaciones=${payload.name},idNetsuite_ubicaciones=${externalId},estado_ubicaciones=${payload.status === "active" ? 1 : 0} WHERE id_ubicaciones=${id}`.execute(transaction);
    }

    private externalId(payload: LocationLegacyPayload): number | null {
        const references = payload.externalReferences.filter((reference) => reference.systemCode === "netsuite");
        const value = references[0]?.externalId;
        if (value === undefined) return null;
        if (references.length !== 1 || !/^-?\d+$/.test(value)) throw new BadRequestException("Legacy requiere exactamente un identificador NetSuite entero.");
        const id = Number(value);
        if (!Number.isSafeInteger(id) || id < -2147483648 || id > 2147483647) throw new BadRequestException("Identificador NetSuite fuera del rango INT legacy.");
        return id;
    }
}
