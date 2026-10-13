/**
 * Mezcla la página nativa con las clases que todavía solo existen en el CRM viejo.
 *
 * Primero van las filas de `crm_class`. El espacio que falta del límite se
 * llena con el fallback, omitiendo los ids viejos ya migrados, incluso si el
 * nativo fue borrado: si no, la clase eliminada volvería a aparecer.
 */
import type { CatalogFallbackReader, CatalogReadInput, PrimaryCatalogReader } from "../catalogs/catalog-fallback.js";
import type { CatalogItemsResponse } from "../catalogs/catalogs.types.js";

/**
 * Completa el listado nativo con clases no migradas.
 *
 * El offset del fallback resta el total nativo. Mientras la página todavía
 * cae en filas nativas, ese offset queda en cero y no se salta legado de más.
 *
 * @param primary - Lector nativo que conoce los ids ya migrados
 * @param input - Límite, offset y filtros pedidos por el cliente
 * @param result - Página nativa ya leída
 * @param fallback - Lector del CRM viejo
 * @throws {Error} Si el repositorio nativo no puede decir qué ids ya migró
 */
export async function mergeClasses(primary: PrimaryCatalogReader, input: CatalogReadInput, result: CatalogItemsResponse, fallback: CatalogFallbackReader): Promise<CatalogItemsResponse> {
    if (!primary.listMigratedClassIds) throw new Error("Class migration identity reader unavailable");
    const excludedLegacyIds = await primary.listMigratedClassIds();
    const remaining = Math.max(0, (input.limit ?? 100) - result.items.length);
    const legacy = await fallback.list({ ...input, excludedLegacyIds, limit: Math.max(1, remaining), offset: Math.max(0, (input.offset ?? 0) - result.total) });
    return { ...result, total: result.total + legacy.total, items: [...result.items, ...legacy.items.slice(0, remaining)] };
}
