/**
 * Traduce una fila de `corredores` al contrato canónico de catálogo.
 *
 * Conserva el id de NetSuite tal como viene. No se fabrica uno cuando la
 * columna es nula. El id de producción viejo queda en `id_old_produccion`
 * para excluirlo de lecturas posteriores. Solo el estado `1` se publica como activo.
 */
import { z } from "zod";

import type { CatalogItem } from "../../../modules/crm/catalogs/catalogs.types.js";

/** Forma mínima de la fila. Un tipo distinto no se convierte en un valor del catálogo. */
const legacyRow = z.object({
    legacyId: z.number().int().positive(),
    externalId: z.number().int().nullable(),
    name: z.string().nullable(),
    status: z.union([z.literal(0), z.literal(1), z.null()]),
});

/**
 * Mapea una fila desconocida a un valor de catálogo.
 *
 * El prefijo `legacy:` evita que este id público se confunda con uno nativo.
 * No hay columna de actualización, por eso `updatedAt` va vacío.
 *
 * @param input - Fila cruda de la consulta
 * @throws {ZodError} Si id, nombre o estado no coinciden con la tabla vieja
 */
export function mapLegacyBroker(input: unknown): CatalogItem {
    const row = legacyRow.parse(input);
    return {
        publicId: `legacy:brokers:${String(row.legacyId)}`,
        nativeCode: `legacy_brokers_${String(row.legacyId)}`,
        id_old_produccion: row.legacyId,
        name: row.name?.trim() || "Sin asignar",
        detail: null,
        status: row.status === 1 ? "active" : "inactive",
        updatedAt: "",
        externalReferences: row.externalId === null ? [] : [{ systemCode: "netsuite", systemName: "NetSuite", externalId: String(row.externalId), status: "active" }],
    };
}
