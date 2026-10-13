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

/** Token de inyección. Es opcional: sin adaptador, la campaña vive solo en el CRM nuevo. */
export const CAMPAIGNS_LEGACY_ACCESS = Symbol("CAMPAIGNS_LEGACY_ACCESS");

/** Datos que se copian al CRM viejo. El id público del CRM nuevo no viaja aquí. */
export interface CampaignLegacyPayload {
    name: string;
    status: "active" | "inactive";
    externalReferences: readonly CatalogExternalReferenceInput[];
}

/**
 * Lectura y escritura dla campaña viejo dentro de la transacción nativa.
 *
 * `create` devuelve el id de producción viejo, o `null` si no se insertó.
 * `enabled` en `false` deja el agregado solo en `crm_campaign`.
 */
export interface CampaignsLegacyAccess {
    enabled(): boolean;
    find(transaction: Transaction<CrmDatabase>, id: number): Promise<CatalogItem | null>;
    create(transaction: Transaction<CrmDatabase>, payload: CampaignLegacyPayload): Promise<number | null>;
    update(transaction: Transaction<CrmDatabase>, id: number, payload: CampaignLegacyPayload): Promise<void>;
}
