/**
 * Puerto opcional hacia el CRM viejo.
 *
 * El repositorio nativo no nombra tablas legacy. Quien implementa este puerto
 * entra en la misma transacción del CRM nuevo: si el alta nativa falla, el
 * alta vieja también se revierte.
 */
import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { CatalogExternalReferenceInput, CatalogItem } from "../catalogs/catalogs.types.js";

/** Token de inyección. Es opcional: sin adaptador, la ubicación vive solo en el CRM nuevo. */
export const LOCATIONS_LEGACY_ACCESS = Symbol("LOCATIONS_LEGACY_ACCESS");

/** Datos que se copian al CRM viejo. El id público del CRM nuevo no viaja aquí. */
export interface LocationLegacyPayload {
    name: string;
    status: "active" | "inactive";
    externalReferences: readonly CatalogExternalReferenceInput[];
}

/**
 * Lectura y escritura dla ubicación viejo dentro de la transacción nativa.
 *
 * `create` devuelve el id de producción viejo, o `null` si no se insertó.
 * `enabled` en `false` deja el agregado solo en `crm_location`.
 */
export interface LocationsLegacyAccess {
    enabled(): boolean;
    find(transaction: Transaction<CrmDatabase>, id: number): Promise<CatalogItem | null>;
    create(transaction: Transaction<CrmDatabase>, payload: LocationLegacyPayload): Promise<number | null>;
    update(transaction: Transaction<CrmDatabase>, id: number, payload: LocationLegacyPayload): Promise<void>;
}
