/**
 * Lectura de `crmdatabase-api.clases` por el pool legado, no por la
 * transaccion del CRM nuevo.
 *
 * Los nombres de tabla y columna estan fijos, incluida la grafia historica
 * `estado_calase` y el id `id_clases`. Corregirlos en el SQL buscaria columnas
 * que no existen. Busqueda, estado y pagina viajan como parametros. Se omiten
 * los ids de produccion que el catalogo nuevo ya registro, para no listar dos
 * veces la misma clase.
 */
import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql } from "kysely";

import type { CatalogFallbackReader, CatalogReadInput } from "../../../modules/crm/catalogs/catalog-fallback.js";
import { findCatalogDefinition } from "../../../modules/crm/catalogs/catalogs.constants.js";
import type { CatalogItemsResponse } from "../../../modules/crm/catalogs/catalogs.types.js";
import { isLegacyCrmEnabled } from "../legacy-crm-access.js";
import { LegacyCrmDatabaseService } from "../legacy-crm-database.service.js";
import { mapLegacyClass } from "./legacy-classes.mapper.js";

/** Nombres reales de la tabla vieja. El request no puede cambiarlos. */
const source = { table: "clases", id: "id_clases", external: "idNetsuite_clase", name: "nombre_clase", status: "estado_calase" } as const;

/**
 * Fallback de solo lectura. Apagado responde 503: no se disfraza de catalogo
 * vacio. La escritura no pasa por esta clase ni por este pool.
 */
@Injectable()
export class LegacyClassesReader implements CatalogFallbackReader {
    private readonly logger = new Logger(LegacyClassesReader.name);

    /** La bandera es la de lectura. El pool es el legado compartido, distinto del de `CRM_THINK_V2`. */
    constructor(
        @Inject(ConfigService) private readonly config: ConfigService,
        @Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService,
    ) {}

    /** Solo el booleano `true` enciende la consulta. Un texto no cuenta como encendido. */
    enabled(): boolean {
        return isLegacyCrmEnabled(this.config);
    }

    /**
     * Lista clases ya traducidas al contrato nuevo.
     *
     * Un fallo de conexion o de mapeo sale como 503 generico. El log solo guarda
     * el codigo del driver, y solo si son letras, digitos o guion bajo: no el
     * SQL, no la clave y no el texto de la fila.
     */
    async list(input: CatalogReadInput & { excludedLegacyIds?: readonly number[] }): Promise<CatalogItemsResponse> {
        if (!this.enabled()) throw new ServiceUnavailableException("Legacy fallback is disabled.");
        if (input.catalogCode !== "classes") throw new ServiceUnavailableException("Legacy catalog is unsupported.");
        try {
            return await this.read(input);
        } catch (error) {
            const code = typeof error === "object" && error !== null && "code" in error ? String(error.code).replaceAll(/[^A-Z_0-9]/g, "") : "CONFIGURATION_OR_MAPPING";
            this.logger.error({ event: "legacy_catalog_read_failed", catalog: input.catalogCode, code });
            throw new ServiceUnavailableException("Legacy catalog is temporarily unavailable.");
        }
    }

    /**
     * Total y pagina en la misma transaccion de lectura, para que el conteo y
     * las filas vean el mismo corte.
     *
     * Un estado nulo cuenta como inactivo. El esquema va calificado: aunque la
     * conexion tuviera otra base por defecto, esta consulta no lee el CRM nuevo.
     * `LIKE` recibe el texto como parametro; no abre la sentencia.
     */
    private async read(input: CatalogReadInput & { excludedLegacyIds?: readonly number[] }): Promise<CatalogItemsResponse> {
        const code = "classes";
        const definition = findCatalogDefinition(code);
        if (!definition) throw new Error("Catalog definition missing");
        const status = input.status ? sql`AND COALESCE(${sql.ref(source.status)}, 0) = ${input.status === "active" ? 1 : 0}` : sql``;
        const search = input.search ? sql`AND (${sql.ref(source.name)} LIKE ${`%${input.search}%`} OR CAST(${sql.ref(source.external)} AS CHAR) LIKE ${`%${input.search}%`})` : sql``;
        const exclusions = input.excludedLegacyIds?.length ? sql`AND ${sql.ref(source.id)} NOT IN (${sql.join(input.excludedLegacyIds)})` : sql``;
        const where = sql`WHERE 1 = 1 ${status} ${search} ${exclusions}`;
        const table = sql.ref(`crmdatabase-api.${source.table}`);
        return this.database.db.transaction().execute(async (transaction) => {
            const count = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM ${table} ${where}`.execute(transaction);
            const rows = await sql`SELECT ${sql.ref(source.id)} AS legacyId, ${sql.ref(source.external)} AS externalId, ${sql.ref(source.name)} AS name, ${sql.ref(source.status)} AS status FROM ${table} ${where} ORDER BY ${sql.ref(source.name)}, ${sql.ref(source.id)} LIMIT ${input.limit ?? 100} OFFSET ${input.offset ?? 0}`.execute(transaction);
            return { catalog: { code, label: definition.label, moduleCode: definition.moduleCode }, items: rows.rows.map((row) => mapLegacyClass(row)), total: Number(count.rows[0]?.total ?? 0) };
        });
    }
}
