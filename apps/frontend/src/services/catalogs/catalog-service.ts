/**
 * Cliente de catálogos nativos del CRM.
 *
 * Habla solo con el BFF. Valida la forma de cada respuesta antes de entregarla
 * a la pantalla: un payload dañado se rechaza en lugar de pintarse como un
 * valor del catálogo. Los ids de NetSuite u Odoo viajan como referencias
 * externas; el identificador del CRM sigue siendo `publicId`.
 */
import { apiRequest } from "../api/api-client";

/** Código de catálogo que el API acepta en `/catalogs/:code`. */
export type CatalogCode = "brokers" | "campaigns" | "classes" | "files" | "locations" | "projects" | "subsidiaries";
/** Estado operativo de un valor. El API no acepta otros textos. */
export type CatalogItemStatus = "active" | "inactive";
/**
 * Módulo desde el que se consulta o modifica el catálogo.
 *
 * Administración y cada perfil operativo envían el suyo. El cliente no deduce
 * el módulo a partir de la ruta.
 */
export type CatalogContextModuleCode = "administration" | "contabilidad" | "formalizacion" | "mercadeo" | "ventas";

/** Vínculo ya resuelto entre un valor CRM y un id de un sistema externo. */
export interface CatalogExternalReference {
    readonly externalId: string;
    readonly status: string;
    readonly systemCode: string;
    readonly systemName: string;
}

/** Valor nativo del catálogo, con sus referencias externas ya validadas. */
export interface CatalogItem {
    readonly detail: string | null;
    readonly externalReferences: readonly CatalogExternalReference[];
    readonly name: string;
    readonly nativeCode: string;
    readonly publicId: string;
    readonly status: CatalogItemStatus;
    readonly updatedAt: string;
}

/** Página de valores que devuelve el listado. `total` es el del API, no el largo de `items`. */
export interface CatalogItemsResponse {
    readonly catalog: {
        readonly code: CatalogCode;
        readonly label: string;
        readonly moduleCode: string;
    };
    readonly items: readonly CatalogItem[];
    readonly total: number;
}

/** Referencia externa que se envía al crear o editar. El id vacío no se incluye. */
export interface CatalogExternalReferencePayload {
    readonly externalId: string;
    readonly systemCode: string;
}

/**
 * Cuerpo de alta o edición.
 *
 * `reason` es obligatorio porque el API audita el cambio. `moduleCode` indica
 * el contexto que autoriza la operación.
 */
export interface CatalogItemPayload {
    readonly detail?: string;
    readonly externalReferences?: readonly CatalogExternalReferencePayload[];
    readonly moduleCode: CatalogContextModuleCode;
    readonly name: string;
    readonly reason: string;
}

/** Cambio de estado. El motivo queda en la auditoría del API. */
export interface UpdateCatalogItemStatusPayload {
    readonly moduleCode: CatalogContextModuleCode;
    readonly reason: string;
    readonly status: CatalogItemStatus;
}

/** Filtros del listado. `status: "all"` no se envía: el API lo interpreta como sin filtro. */
export interface ListCatalogItemsOptions {
    readonly offset?: number;
    readonly limit?: number;
    readonly moduleCode: CatalogContextModuleCode;
    readonly search?: string;
    readonly status?: CatalogItemStatus | "all";
}

/** Objeto plano. Un array no cuenta: el contrato de catálogo no es una lista suelta. */
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const parseNullableString = (value: unknown): string | null => (value === null ? null : isString(value) ? value : null);
const isCatalogStatus = (value: unknown): value is CatalogItemStatus => value === "active" || value === "inactive";
const isCatalogCode = (value: unknown): value is CatalogCode => value === "projects" || value === "campaigns" || value === "classes" || value === "brokers" || value === "files" || value === "subsidiaries" || value === "locations";

/** Rechaza una referencia a la que le falte id, estado o sistema. No rellena textos vacíos. */
const parseExternalReference = (value: unknown): CatalogExternalReference => {
    if (!isRecord(value) || !isString(value.externalId) || !isString(value.status) || !isString(value.systemCode) || !isString(value.systemName)) {
        throw new TypeError("Respuesta CatalogExternalReference inválida.");
    }

    return {
        externalId: value.externalId,
        status: value.status,
        systemCode: value.systemCode,
        systemName: value.systemName,
    };
};

/** Copia solo los campos del valor. Un estado distinto de activo o inactivo invalida el ítem. */
const parseCatalogItem = (value: unknown): CatalogItem => {
    if (!isRecord(value) || !isString(value.name) || !isString(value.nativeCode) || !isString(value.publicId) || !isCatalogStatus(value.status) || !isString(value.updatedAt)) {
        throw new TypeError("Respuesta CatalogItem inválida.");
    }

    return {
        detail: parseNullableString(value.detail),
        externalReferences: Array.isArray(value.externalReferences) ? value.externalReferences.map(parseExternalReference) : [],
        name: value.name,
        nativeCode: value.nativeCode,
        publicId: value.publicId,
        status: value.status,
        updatedAt: value.updatedAt,
    };
};

/** Valida el listado completo. Una lista dañada no se sustituye por un arreglo vacío. */
const parseCatalogItemsResponse = (value: unknown): CatalogItemsResponse => {
    if (!isRecord(value) || !isRecord(value.catalog) || !isCatalogCode(value.catalog.code) || !isString(value.catalog.label) || !isString(value.catalog.moduleCode) || !Array.isArray(value.items) || !isNumber(value.total)) {
        throw new TypeError("Respuesta CatalogItemsResponse inválida.");
    }

    return {
        catalog: {
            code: value.catalog.code,
            label: value.catalog.label,
            moduleCode: value.catalog.moduleCode,
        },
        items: value.items.map(parseCatalogItem),
        total: value.total,
    };
};

/**
 * Lista los valores de un catálogo en el contexto de un módulo.
 *
 * @param catalogCode - Código canónico del catálogo
 * @param options - Módulo, búsqueda, estado y tope de filas
 * @returns Página validada
 * @throws {TypeError} Si la respuesta no tiene la forma del contrato
 * @throws {ApiClientError} Si el BFF rechaza la llamada
 */
export const listCatalogItems = async (catalogCode: CatalogCode, options: ListCatalogItemsOptions): Promise<CatalogItemsResponse> => {
    const query = new URLSearchParams();
    query.set("moduleCode", options.moduleCode);

    if (options.search) {
        query.set("search", options.search);
    }

    if (options.status && options.status !== "all") {
        query.set("status", options.status);
    }

    if (options.limit) {
        query.set("limit", String(options.limit));
    }
    if (options.offset !== undefined) {
        query.set("offset", String(options.offset));
    }

    const path = `/catalogs/${encodeURIComponent(catalogCode)}/items${query.size > 0 ? `?${query.toString()}` : ""}`;
    const response = await apiRequest<unknown>(path);
    if (import.meta.env.DEV) {
        console.log(`[Catalog API: ${catalogCode}] Incoming JSON`, response);
    }
    return parseCatalogItemsResponse(response);
};

/**
 * Crea un valor nativo. El API audita `reason` y vuelve a comprobar el permiso.
 *
 * @param catalogCode - Código canónico del catálogo
 * @param payload - Nombre, motivo, módulo y referencias opcionales
 * @returns Valor creado ya validado
 */
export const createCatalogItem = async (catalogCode: CatalogCode, payload: CatalogItemPayload): Promise<CatalogItem> => parseCatalogItem(await apiRequest<unknown>(`/catalogs/${encodeURIComponent(catalogCode)}/items`, { body: payload, method: "POST" }));

/**
 * Edita un valor existente por su `publicId`.
 *
 * @param catalogCode - Código canónico del catálogo
 * @param itemPublicId - Identificador público del valor
 * @param payload - Datos nuevos y motivo de auditoría
 * @returns Valor actualizado ya validado
 */
export const updateCatalogItem = async (catalogCode: CatalogCode, itemPublicId: string, payload: CatalogItemPayload): Promise<CatalogItem> => parseCatalogItem(await apiRequest<unknown>(`/catalogs/${encodeURIComponent(catalogCode)}/items/${encodeURIComponent(itemPublicId)}`, { body: payload, method: "PATCH" }));

/**
 * Activa o inactiva un valor sin reescribir el resto de sus datos.
 *
 * @param catalogCode - Código canónico del catálogo
 * @param itemPublicId - Identificador público del valor
 * @param payload - Estado destino, módulo y motivo
 * @returns Valor con el estado nuevo
 */
export const updateCatalogItemStatus = async (catalogCode: CatalogCode, itemPublicId: string, payload: UpdateCatalogItemStatusPayload): Promise<CatalogItem> => parseCatalogItem(await apiRequest<unknown>(`/catalogs/${encodeURIComponent(catalogCode)}/items/${encodeURIComponent(itemPublicId)}/status`, { body: payload, method: "PATCH" }));
