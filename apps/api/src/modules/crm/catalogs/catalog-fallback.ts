/**
 * Lectura opcional del CRM viejo sin que el core importe ese adaptador.
 *
 * Proyectos siempre mezclan nativo y legado. El resto solo consulta el
 * fallback cuando el catálogo nativo está vacío de verdad: una página filtrada
 * en cero no cuenta, porque el valor puede existir y no coincidir con la búsqueda.
 */
import { mergeProjects } from "../projects/projects-fallback.js";
import type { CatalogRouteCode, CatalogStatus } from "./catalogs.constants.js";
import type { CatalogItemsResponse } from "./catalogs.types.js";

/** Token del lector legacy. Si nadie lo provee, los catálogos quedan solo en el CRM nuevo. */
export const CATALOG_FALLBACK_READER = Symbol("CATALOG_FALLBACK_READER");

/** Filtros comunes del listado. El lector legacy puede recibir además los ids ya migrados. */
export interface CatalogReadInput {
    catalogCode: CatalogRouteCode;
    limit?: number;
    offset?: number;
    search?: string;
    status?: CatalogStatus;
}

/**
 * Puerto hacia afuera.
 *
 * El core solo conoce `enabled` y `list`. Las tablas viejas quedan del otro lado.
 */
export interface CatalogFallbackReader {
    enabled(): boolean;
    list(input: CatalogReadInput & { excludedLegacyIds?: readonly number[] }): Promise<CatalogItemsResponse>;
}

/**
 * Lector nativo que el fallback puede completar.
 *
 * `listMigratedProjectIds` solo lo exige la mezcla de proyectos.
 */
export interface PrimaryCatalogReader {
    listCatalogItems(input: CatalogReadInput): Promise<CatalogItemsResponse>;
    listMigratedProjectIds?(): Promise<readonly number[]>;
}

/**
 * Devuelve la página nativa y, si aplica, la completa con el CRM viejo.
 *
 * Campañas es el único catálogo compartido que puede caer al legado, y solo
 * cuando no hay ninguna fila nativa. Proyectos delegan en `mergeProjects`.
 *
 * @param primary - Repositorio del CRM nuevo
 * @param input - Código, página y filtros
 * @param fallback - Lector legacy. Ausente o apagado deja la respuesta nativa
 */
export async function readCatalogWithFallback(primary: PrimaryCatalogReader, input: CatalogReadInput, fallback?: CatalogFallbackReader): Promise<CatalogItemsResponse> {
    const result = await primary.listCatalogItems(input);
    if (!fallback?.enabled()) return result;
    if (input.catalogCode === "projects") return mergeProjects(primary, input, result, fallback);
    if (result.total > 0) return result;
    if (!["projects", "campaigns"].includes(input.catalogCode)) return result;
    const native = await primary.listCatalogItems({ catalogCode: input.catalogCode, limit: 1 });
    return native.total > 0 ? result : fallback.list(input);
}
