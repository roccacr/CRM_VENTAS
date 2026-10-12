/**
 * Traduce una fila de `proyectos` al contrato canónico de catálogo.
 *
 * No inventa ids de NetSuite: si la columna viene nula, la referencia no
 * existe. El id viejo se conserva en `id_old_produccion` para no volver a
 * importar el mismo registro. El estado `1` es activo; `0` y `null` son inactivos.
 */
import { z } from "zod";

import type { CatalogItem } from "../../../modules/crm/catalogs/catalogs.types.js";

/** Forma mínima que esta tabla puede entregar. Otra forma rechaza la fila. */
const legacyRow = z.object({
    legacyId: z.number().int().positive(),
    externalId: z.number().int().nullable(),
    name: z.string().nullable(),
    status: z.union([z.literal(0), z.literal(1), z.null()]),
});

/**
 * Mapea una fila desconocida a un valor de catálogo.
 *
 * `publicId` lleva el prefijo `legacy:` para no chocar con un `publicId` del CRM nuevo.
 * La tabla no tiene fecha de cambio, así que `updatedAt` queda vacío y la UI lo muestra como no asignado.
 *
 * @param input - Fila cruda de la consulta
 * @throws {ZodError} Si la fila no trae id, nombre o estado en la forma esperada
 */
export function mapLegacyProject(input: unknown): CatalogItem {
    const row = legacyRow.parse(input);
    return {
        publicId: `legacy:projects:${String(row.legacyId)}`,
        nativeCode: `legacy_projects_${String(row.legacyId)}`,
        id_old_produccion: row.legacyId,
        name: row.name?.trim() || "Sin asignar",
        detail: null,
        status: row.status === 1 ? "active" : "inactive",
        updatedAt: "",
        externalReferences: row.externalId === null ? [] : [{ systemCode: "netsuite", systemName: "NetSuite", externalId: String(row.externalId), status: "active" }],
    };
}
