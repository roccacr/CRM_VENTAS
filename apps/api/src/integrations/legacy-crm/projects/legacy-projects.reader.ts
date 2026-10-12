/**
 * Lectura de solo lectura de `crmdatabase-api.proyectos`.
 *
 * Tabla y columnas salen de una lista fija. Búsqueda, estado y paginación
 * viajan como valores enlazados. Los ids que el CRM nuevo ya guardó se
 * excluyen para no mostrar el mismo proyecto dos veces.
 */
import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql } from "kysely";

import type { CatalogFallbackReader, CatalogReadInput } from "../../../modules/crm/catalogs/catalog-fallback.js";
import { findCatalogDefinition } from "../../../modules/crm/catalogs/catalogs.constants.js";
import type { CatalogItemsResponse } from "../../../modules/crm/catalogs/catalogs.types.js";
import { isLegacyCrmEnabled } from "../legacy-crm-access.js";
import { LegacyCrmDatabaseService } from "../legacy-crm-database.service.js";
import { mapLegacyProject } from "./legacy-projects.mapper.js";

/** Nombres reales de la tabla vieja. No se arman con texto del usuario. */
const source = { table: "proyectos", id: "id_proyecto", external: "id_ProNetsuite", name: "Nombre_proyecto", status: "estado_proyecto" } as const;

/**
 *
 */
@Injectable()
export class LegacyProjectsReader implements CatalogFallbackReader {
    private readonly logger = new Logger(LegacyProjectsReader.name);

    /**
     * @param config - Bandera booleana del fallback
     * @param database - Pool legacy; este reader no abre otra conexión
     */
    constructor(
        @Inject(ConfigService) private readonly config: ConfigService,
        @Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService,
    ) {}

    /** `"false"` como texto no cuenta. Solo el booleano `true` enciende la lectura. */
    enabled(): boolean {
        return isLegacyCrmEnabled(this.config);
    }

    /**
     * Lista proyectos ya traducidos al contrato nuevo.
     *
     * El error HTTP no incluye SQL ni credenciales. El código de MySQL se
     * deja en el log, ya filtrado a letras, números y guion bajo.
     *
     * @param input - Filtros y ids de producción que ya viven en el CRM nuevo
     * @throws {ServiceUnavailableException} Si el fallback está apagado, el código no es `projects` o la base no responde
     */
    async list(input: CatalogReadInput & { excludedLegacyIds?: readonly number[] }): Promise<CatalogItemsResponse> {
        if (!this.enabled()) throw new ServiceUnavailableException("Legacy fallback is disabled.");
        if (input.catalogCode !== "projects") throw new ServiceUnavailableException("Legacy catalog is unsupported.");
        try {
            return await this.read(input);
        } catch (error) {
            const code = typeof error === "object" && error !== null && "code" in error ? String(error.code).replaceAll(/[^A-Z_0-9]/g, "") : "CONFIGURATION_OR_MAPPING";
            this.logger.error({ event: "legacy_catalog_read_failed", catalog: input.catalogCode, code });
            throw new ServiceUnavailableException("Legacy catalog is temporarily unavailable.");
        }
    }

    /**
     * Cuenta y página dentro de la misma transacción de solo lectura.
     *
     * Así el total no cambia respecto de las filas devueltas. `COALESCE` trata
     * un estado nulo como inactivo, igual que el mapper.
     */
    private async read(input: CatalogReadInput & { excludedLegacyIds?: readonly number[] }): Promise<CatalogItemsResponse> {
        const code = "projects";
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
            return { catalog: { code, label: definition.label, moduleCode: definition.moduleCode }, items: rows.rows.map((row) => mapLegacyProject(row)), total: Number(count.rows[0]?.total ?? 0) };
        });
    }
}
