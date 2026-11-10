/**
 * Fila de `proyectos` al contrato de catalogo.
 *
 * El id de NetSuite se conserva tal como viene. Si la columna es nula, no se
 * fabrica una referencia: la lectura tolera un nulo que ya esta en la tabla.
 * El id de produccion queda en `id_old_produccion` para que la lectura
 * posterior lo excluya. Solo el estado `1` se publica como activo; `0` y
 * `null` quedan inactivos. La tabla vieja no tiene detalle, asi que `detail`
 * sale nulo.
 *
 * El parseo no inventa un proyecto. La lectura convierte ese fallo en 503; la
 * escritura lo deja salir para que la transaccion nativa no promueva una fila
 * que este contrato no acepta.
 */
import { z } from "zod";

import type { CatalogItem } from "../../../modules/crm/catalogs/catalogs.types.js";

/** Forma minima de la fila. Otro tipo no se convierte en un valor del catalogo. */
const legacyRow = z.object({
    legacyId: z.number().int().positive(),
    externalId: z.number().int().nullable(),
    name: z.string().nullable(),
    status: z.union([z.literal(0), z.literal(1), z.null()]),
});

/**
 * Traduce una fila desconocida.
 *
 * `legacy:` en el id publico evita que se confunda con uno nativo. No hay
 * columna de actualizacion, asi que `updatedAt` va vacio. Un nombre nulo o en
 * blanco se publica como "Sin asignar": el contrato nuevo exige nombre y la
 * tabla vieja no.
 *
 * El estado de la referencia NetSuite no copia el del proyecto. La referencia
 * existe, o no existe; el proyecto puede estar inactivo y conservar su id.
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
