/**
 * Contrato público de un valor de catálogo.
 *
 * `publicId` es la identidad del CRM. El id de un sistema externo viaja en
 * `externalReferences` y no la reemplaza. `id_old_produccion` solo aparece
 * cuando la fila ya se vinculó con el CRM viejo.
 */
import type { CatalogRouteCode, CatalogStatus } from "./catalogs.constants.js";

/** Vínculo ya resuelto con un sistema externo configurado en el CRM. */
export interface CatalogExternalReference {
    externalId: string;
    status: string;
    systemCode: string;
    systemName: string;
}

/** Valor nativo listo para la API. No incluye el id interno de MySQL. */
export interface CatalogItem {
    id_old_produccion?: number;
    detail: string | null;
    externalReferences: readonly CatalogExternalReference[];
    name: string;
    nativeCode: string;
    publicId: string;
    status: CatalogStatus;
    updatedAt: string;
}

/** Página de un catálogo. `total` es el del filtro, no el largo de `items`. */
export interface CatalogItemsResponse {
    catalog: {
        code: CatalogRouteCode;
        label: string;
        moduleCode: string;
    };
    items: readonly CatalogItem[];
    total: number;
}

/** Referencia que se va a guardar. Un id vacío no llega hasta aquí. */
export interface CatalogExternalReferenceInput {
    externalId: string;
    systemCode: string;
}

/** Alta o edición ya autorizada. El motivo queda en la auditoría. */
export interface CatalogMutationInput {
    actorPublicId: string;
    catalogCode: CatalogRouteCode;
    detail?: string | undefined;
    externalReferences: readonly CatalogExternalReferenceInput[];
    ipAddress?: string | undefined;
    name: string;
    reason: string;
    userAgent?: string | undefined;
}

/** Cambio de estado. El permiso de inactivar es distinto del de editar. */
export interface CatalogStatusMutationInput {
    actorPublicId: string;
    catalogCode: CatalogRouteCode;
    ipAddress?: string | undefined;
    itemPublicId: string;
    reason: string;
    status: CatalogStatus;
    userAgent?: string | undefined;
}
