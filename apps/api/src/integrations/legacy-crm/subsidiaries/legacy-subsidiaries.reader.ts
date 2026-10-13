/**
 * Lectura de solo lectura de `crmdatabase-api.subsidiarias`.
 *
 * Los identificadores de tabla y columna están fijos. El texto de búsqueda,
 * el estado y la página son parámetros. Se omiten las subsidiarias cuyo id viejo
 * ya quedó registrado en el catálogo nuevo.
 */
import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql } from "kysely";

import type { CatalogFallbackReader, CatalogReadInput } from "../../../modules/crm/catalogs/catalog-fallback.js";
import { findCatalogDefinition } from "../../../modules/crm/catalogs/catalogs.constants.js";
import type { CatalogItemsResponse } from "../../../modules/crm/catalogs/catalogs.types.js";
import { isLegacyCrmEnabled } from "../legacy-crm-access.js";
import { LegacyCrmDatabaseService } from "../legacy-crm-database.service.js";
import { mapLegacySubsidiary } from "./legacy-subsidiaries.mapper.js";

/** Nombres reales de la tabla vieja. El usuario no puede cambiarlos. */
const source = { table: "subsidiarias", id: "id_subsidaria", external: "id_NetsuiteSub", name: "Nombre_Subsidiaria", status: "Estado_Subsidiaria" } as const;

/** Reads Subsidiaries through the isolated, read-only legacy connection. */
@Injectable()
export class LegacySubsidiariesReader implements CatalogFallbackReader {
    private readonly logger = new Logger(LegacySubsidiariesReader.name);

    /**
     * @param config - Bandera booleana del fallback
     * @param database - Pool legacy compartido con el resto de readers
     */
    constructor(
        @Inject(ConfigService) private readonly config: ConfigService,
        @Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService,
    ) {}

    /** Solo el booleano `true` habilita la consulta. Un string no se interpreta como encendido. */
    enabled(): boolean {
        return isLegacyCrmEnabled(this.config);
    }

    /**
     * Lista subsidiarias en el contrato del CRM nuevo.
     *
     * Un fallo de conexión o de mapeo responde 503 sin el SQL ni la clave.
     * El código del driver se registra ya saneado.
     *
     * @param input - Filtros y ids de producción ya importados
     * @throws {ServiceUnavailableException} Si el fallback está apagado, el código no es `subsidiaries` o la lectura falla
     */
    async list(input: CatalogReadInput & { excludedLegacyIds?: readonly number[] }): Promise<CatalogItemsResponse> {
        if (!this.enabled()) throw new ServiceUnavailableException("Legacy fallback is disabled.");
        if (input.catalogCode !== "subsidiaries") throw new ServiceUnavailableException("Legacy catalog is unsupported.");
        try {
            return await this.read(input);
        } catch (error) {
            const code = typeof error === "object" && error !== null && "code" in error ? String(error.code).replaceAll(/[^A-Z_0-9]/g, "") : "CONFIGURATION_OR_MAPPING";
            this.logger.error({ event: "legacy_catalog_read_failed", catalog: input.catalogCode, code });
            throw new ServiceUnavailableException("Legacy catalog is temporarily unavailable.");
        }
    }

    /**
     * Una sola transacción de lectura para el total y la página.
     *
     * Un estado nulo cuenta como inactivo. El esquema `crmdatabase-api` está
     * calificado a propósito: no es la base del CRM nuevo.
     */
    private async read(input: CatalogReadInput & { excludedLegacyIds?: readonly number[] }): Promise<CatalogItemsResponse> {
        const code = "subsidiaries";
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
            return { catalog: { code, label: definition.label, moduleCode: definition.moduleCode }, items: rows.rows.map((row) => mapLegacySubsidiary(row)), total: Number(count.rows[0]?.total ?? 0) };
        });
    }
}
