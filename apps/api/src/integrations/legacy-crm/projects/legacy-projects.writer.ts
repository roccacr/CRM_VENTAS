import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { ProjectLegacyPayload, ProjectsLegacyAccess } from "../../../modules/crm/projects/projects-legacy.port.js";
import { isLegacyCrmEnabled } from "../legacy-crm-access.js";
import { mapLegacyProject } from "./legacy-projects.mapper.js";

/** Project-only DML on the native transaction: both schemas commit or roll back together. */
@Injectable()
export class LegacyProjectsWriter implements ProjectsLegacyAccess {
    /** Uses the shared gate without opening a writable legacy pool. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /** Rechecked before every operation, including reads needed by mutations. */
    enabled(): boolean {
        return isLegacyCrmEnabled(this.config);
    }

    /** Locks the source row until its native promotion and audit finish. */
    async find(transaction: Transaction<CrmDatabase>, id: number) {
        if (!this.enabled()) return null;
        const result = await sql`SELECT id_proyecto AS legacyId, id_ProNetsuite AS externalId, Nombre_proyecto AS name, estado_proyecto AS status FROM \`crmdatabase-api\`.proyectos WHERE id_proyecto=${id} FOR UPDATE`.execute(transaction);
        return result.rows[0] ? mapLegacyProject(result.rows[0]) : null;
    }

    /** Returns the generated legacy link; never adopts a conflicting existing row. */
    async create(transaction: Transaction<CrmDatabase>, payload: ProjectLegacyPayload): Promise<number | null> {
        if (!this.enabled()) return null;
        const externalId = this.externalId(payload);
        const duplicate = await sql`SELECT id_proyecto FROM \`crmdatabase-api\`.proyectos WHERE id_ProNetsuite=${externalId} OR Nombre_proyecto=${payload.name} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (duplicate.rows.length) throw new ConflictException("El proyecto ya existe en legacy; edita el registro existente.");
        const result = await sql`INSERT INTO \`crmdatabase-api\`.proyectos (id_ProNetsuite,Nombre_proyecto,estado_proyecto) VALUES (${externalId},${payload.name},${payload.status === "active" ? 1 : 0})`.execute(transaction);
        const id = Number(result.insertId);
        if (!Number.isSafeInteger(id) || id <= 0) throw new ServiceUnavailableException("Legacy project identity unavailable.");
        return id;
    }

    /** Synchronizes only fields present in the legacy schema, without deleting records. */
    async update(transaction: Transaction<CrmDatabase>, id: number, payload: ProjectLegacyPayload): Promise<void> {
        if (!this.enabled()) return;
        if (!(await this.find(transaction, id))) throw new ConflictException("El proyecto vinculado ya no existe en legacy.");
        const externalId = this.externalId(payload);
        const conflict = await sql`SELECT id_proyecto FROM \`crmdatabase-api\`.proyectos WHERE id_ProNetsuite=${externalId} AND id_proyecto<>${id} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (conflict.rows.length) throw new ConflictException("La referencia NetSuite pertenece a otro proyecto legacy.");
        await sql`UPDATE \`crmdatabase-api\`.proyectos SET Nombre_proyecto=${payload.name},id_ProNetsuite=${externalId},estado_proyecto=${payload.status === "active" ? 1 : 0} WHERE id_proyecto=${id}`.execute(transaction);
    }

    private externalId(payload: ProjectLegacyPayload): number {
        const references = payload.externalReferences.filter((reference) => reference.systemCode === "netsuite");
        const value = references[0]?.externalId;
        if (references.length !== 1 || !value || !/^-?\d+$/.test(value)) throw new BadRequestException("Legacy requiere exactamente un identificador NetSuite entero.");
        const id = Number(value);
        if (!Number.isSafeInteger(id) || id < -2147483648 || id > 2147483647) throw new BadRequestException("Identificador NetSuite fuera del rango INT legacy.");
        return id;
    }
}
