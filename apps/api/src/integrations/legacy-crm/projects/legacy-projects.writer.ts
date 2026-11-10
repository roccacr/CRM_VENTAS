import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { ProjectLegacyPayload, ProjectsLegacyAccess } from "../../../modules/crm/projects/projects-legacy.port.js";
import { isLegacyCrmWriteEnabled } from "../legacy-crm-access.js";
import { mapLegacyProject } from "./legacy-projects.mapper.js";

/**
 * Escritura de `proyectos` dentro de la transaccion nativa.
 *
 * No abre el pool legado. El SQL cruza a `crmdatabase-api` por la misma
 * conexion del CRM nuevo: las dos bases confirman o revierten juntas. Los
 * nombres fisicos se usan tal cual, incluidos `id_ProNetsuite` y
 * `Nombre_proyecto`. Con la compuerta apagada no se copia nada y el proyecto
 * queda solo en `crm_project`. Desarrollo no escribe: la compuerta exige
 * produccion, ademas del opt-in.
 *
 * A diferencia de la lectura, el alta y la edicion exigen un id de NetSuite.
 * No se escribe un nulo en `id_ProNetsuite`.
 */
@Injectable()
export class LegacyProjectsWriter implements ProjectsLegacyAccess {
    /** Solo lee la compuerta. No guarda un pool ni un flag capturado al arrancar. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /**
     * Se vuelve a leer en cada operacion, tambien en la lectura que hace falta
     * para actualizar. Un cambio de configuracion no sigue autorizado por una
     * decision anterior.
     */
    enabled(): boolean {
        return isLegacyCrmWriteEnabled(this.config);
    }

    /**
     * Bloquea la fila vieja hasta que terminen el alta nativa y su auditoria.
     * Apagado devuelve `null`: no es un proyecto inexistente, es ausencia de copia.
     */
    async find(transaction: Transaction<CrmDatabase>, id: number) {
        if (!this.enabled()) return null;
        const result = await sql`SELECT id_proyecto AS legacyId, id_ProNetsuite AS externalId, Nombre_proyecto AS name, estado_proyecto AS status FROM \`crmdatabase-api\`.proyectos WHERE id_proyecto=${id} FOR UPDATE`.execute(transaction);
        return result.rows[0] ? mapLegacyProject(result.rows[0]) : null;
    }

    /**
     * Inserta y devuelve el id generado. No adopta una fila que ya exista con
     * el mismo nombre o el mismo id de NetSuite: hay que editar esa, no
     * enlazarla en silencio a un proyecto nuevo. El bloqueo cubre la
     * comprobacion y el alta.
     */
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

    /**
     * Copia solo nombre, id de NetSuite y estado. No borra la fila vieja y no
     * escribe un detalle: la tabla no tiene esa columna. Si el vinculo ya no
     * existe, o si ese id de NetSuite pertenece a otro proyecto, la transaccion
     * nativa no sigue con una copia a medias.
     */
    async update(transaction: Transaction<CrmDatabase>, id: number, payload: ProjectLegacyPayload): Promise<void> {
        if (!this.enabled()) return;
        if (!(await this.find(transaction, id))) throw new ConflictException("El proyecto vinculado ya no existe en legacy.");
        const externalId = this.externalId(payload);
        const conflict = await sql`SELECT id_proyecto FROM \`crmdatabase-api\`.proyectos WHERE id_ProNetsuite=${externalId} AND id_proyecto<>${id} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (conflict.rows.length) throw new ConflictException("La referencia NetSuite pertenece a otro proyecto legacy.");
        await sql`UPDATE \`crmdatabase-api\`.proyectos SET Nombre_proyecto=${payload.name},id_ProNetsuite=${externalId},estado_proyecto=${payload.status === "active" ? 1 : 0} WHERE id_proyecto=${id}`.execute(transaction);
    }

    /**
     * Columna `id_ProNetsuite`. En esta tabla el id es obligatorio: cero
     * referencias, un texto vacio o mas de una no se guardan como nulo.
     *
     * Tiene que ser un unico entero dentro de INT con signo. No se recorta ni
     * se concatena.
     */
    private externalId(payload: ProjectLegacyPayload): number {
        const references = payload.externalReferences.filter((reference) => reference.systemCode === "netsuite");
        const value = references[0]?.externalId;
        if (references.length !== 1 || !value || !/^-?\d+$/.test(value)) throw new BadRequestException("Legacy requiere exactamente un identificador NetSuite entero.");
        const id = Number(value);
        if (!Number.isSafeInteger(id) || id < -2147483648 || id > 2147483647) throw new BadRequestException("Identificador NetSuite fuera del rango INT legacy.");
        return id;
    }
}
