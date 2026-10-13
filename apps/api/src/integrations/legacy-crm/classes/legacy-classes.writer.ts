import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { ClassesLegacyAccess, ClassLegacyPayload } from "../../../modules/crm/classes/classes-legacy.port.js";
import { isLegacyCrmEnabled } from "../legacy-crm-access.js";
import { mapLegacyClass } from "./legacy-classes.mapper.js";

/** Class-only DML on the native transaction: both schemas commit or roll back together. */
@Injectable()
export class LegacyClassesWriter implements ClassesLegacyAccess {
    /** Uses the shared gate without opening a writable legacy pool. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /** Rechecked before every operation, including reads needed by mutations. */
    enabled(): boolean {
        return isLegacyCrmEnabled(this.config);
    }

    /** Locks the source row until its native promotion and audit finish. */
    async find(transaction: Transaction<CrmDatabase>, id: number) {
        if (!this.enabled()) return null;
        const result = await sql`SELECT id_clases AS legacyId, idNetsuite_clase AS externalId, nombre_clase AS name, estado_calase AS status FROM \`crmdatabase-api\`.clases WHERE id_clases=${id} FOR UPDATE`.execute(transaction);
        return result.rows[0] ? mapLegacyClass(result.rows[0]) : null;
    }

    /** Returns the generated legacy link; never adopts a conflicting existing row. */
    async create(transaction: Transaction<CrmDatabase>, payload: ClassLegacyPayload): Promise<number | null> {
        if (!this.enabled()) return null;
        if (payload.name.length > 100) throw new BadRequestException("Legacy class name exceeds 100 characters.");
        const externalId = this.externalId(payload);
        const duplicate = await sql`SELECT id_clases FROM \`crmdatabase-api\`.clases WHERE idNetsuite_clase=${externalId} OR nombre_clase=${payload.name} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (duplicate.rows.length) throw new ConflictException("La clase ya existe en legacy; edita el registro existente.");
        const result = await sql`INSERT INTO \`crmdatabase-api\`.clases (idNetsuite_clase,nombre_clase,estado_calase) VALUES (${externalId},${payload.name},${payload.status === "active" ? 1 : 0})`.execute(transaction);
        const id = Number(result.insertId);
        if (!Number.isSafeInteger(id) || id <= 0) throw new ServiceUnavailableException("Legacy class identity unavailable.");
        return id;
    }

    /** Synchronizes only fields present in the legacy schema, without deleting records. */
    async update(transaction: Transaction<CrmDatabase>, id: number, payload: ClassLegacyPayload): Promise<void> {
        if (!this.enabled()) return;
        if (payload.name.length > 100) throw new BadRequestException("Legacy class name exceeds 100 characters.");
        if (!(await this.find(transaction, id))) throw new ConflictException("La clase vinculada ya no existe en legacy.");
        const externalId = this.externalId(payload);
        const conflict = await sql`SELECT id_clases FROM \`crmdatabase-api\`.clases WHERE idNetsuite_clase=${externalId} AND id_clases<>${id} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (conflict.rows.length) throw new ConflictException("La referencia NetSuite pertenece a otra clase legacy.");
        await sql`UPDATE \`crmdatabase-api\`.clases SET nombre_clase=${payload.name},idNetsuite_clase=${externalId},estado_calase=${payload.status === "active" ? 1 : 0} WHERE id_clases=${id}`.execute(transaction);
    }

    private externalId(payload: ClassLegacyPayload): number | null {
        const references = payload.externalReferences.filter((reference) => reference.systemCode === "netsuite");
        const value = references[0]?.externalId;
        if (value === undefined) return null;
        if (references.length !== 1 || !/^-?\d+$/.test(value)) throw new BadRequestException("Legacy requiere exactamente un identificador NetSuite entero.");
        const id = Number(value);
        if (!Number.isSafeInteger(id) || id < -2147483648 || id > 2147483647) throw new BadRequestException("Identificador NetSuite fuera del rango INT legacy.");
        return id;
    }
}
