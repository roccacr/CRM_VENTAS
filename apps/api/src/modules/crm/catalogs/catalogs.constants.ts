/**
 * Catálogos que el API reconoce y los permisos que los protegen.
 *
 * El código de permiso lleva el módulo desde el que se usa el catálogo:
 * `ventas.catalog_campaign.read` no autoriza el mismo catálogo en contabilidad.
 * Los códigos sin módulo son el formato viejo y no se usan para autorizar.
 */
export const CATALOG_STATUSES = ["active", "inactive"] as const;

/** Estado operativo. No hay borrado físico en el contrato público. */
export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

/** Segmento de ruta. Proyectos está en la lista, pero su persistencia es propia. */
export type CatalogRouteCode = "brokers" | "campaigns" | "classes" | "files" | "locations" | "projects" | "subsidiaries";

/**
 * Definición estable de un catálogo.
 *
 * `moduleCode` arma el permiso. `routeCode` es el de la URL. No se calculan uno a partir del otro en cada request.
 */
export interface CatalogDefinition {
    readonly itemLabel: string;
    readonly label: string;
    readonly moduleCode: string;
    readonly routeCode: CatalogRouteCode;
}

/** Módulos que pueden consumir un catálogo. El permiso se evalúa contra uno de estos códigos. */
export const CATALOG_CONTEXT_MODULES = ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"] as const;

export type CatalogContextModuleCode = (typeof CATALOG_CONTEXT_MODULES)[number];

/** Orden del menú. Agregar un catálogo aquí también genera sus permisos. */
export const CATALOG_DEFINITIONS: readonly CatalogDefinition[] = [
    { itemLabel: "proyecto", label: "Proyectos", moduleCode: "catalog_project", routeCode: "projects" },
    { itemLabel: "campaña", label: "Campañas", moduleCode: "catalog_campaign", routeCode: "campaigns" },
    { itemLabel: "clase", label: "Clases", moduleCode: "catalog_class", routeCode: "classes" },
    { itemLabel: "corredor", label: "Corredores", moduleCode: "catalog_broker", routeCode: "brokers" },
    { itemLabel: "expediente", label: "Expedientes", moduleCode: "catalog_file", routeCode: "files" },
    { itemLabel: "subsidiaria", label: "Subsidiarias", moduleCode: "catalog_subsidiary", routeCode: "subsidiaries" },
    { itemLabel: "ubicación", label: "Ubicaciones", moduleCode: "catalog_location", routeCode: "locations" },
] as const;

/** Acciones atómicas. Inactivar no se concede con el permiso de editar. */
export const CATALOG_PERMISSION_ACTIONS = ["read", "create", "update", "inactivate"] as const;

export type CatalogPermissionAction = (typeof CATALOG_PERMISSION_ACTIONS)[number];

/** Etiquetas visibles. El código que autoriza sigue siendo el del permiso, no este texto. */
export const CATALOG_PERMISSION_ACTION_LABELS = {
    create: "Crear",
    inactivate: "Inactivar",
    read: "Ver",
    update: "Editar",
} as const satisfies Record<CatalogPermissionAction, string>;

/** Busca por el segmento de la URL. Un código desconocido no se trata como catálogo vacío. */
export const findCatalogDefinition = (routeCode: string): CatalogDefinition | undefined => CATALOG_DEFINITIONS.find((definition) => definition.routeCode === routeCode);

/** Busca por el módulo de permisos, por ejemplo `catalog_campaign`. */
export const findCatalogDefinitionByModuleCode = (moduleCode: string): CatalogDefinition | undefined => CATALOG_DEFINITIONS.find((definition) => definition.moduleCode === moduleCode);

/** El módulo de contexto tiene que ser uno de los cinco. Otro texto no autoriza por aproximación. */
export const isCatalogContextModuleCode = (moduleCode: string): moduleCode is CatalogContextModuleCode => CATALOG_CONTEXT_MODULES.includes(moduleCode as CatalogContextModuleCode);

/**
 * Permiso efectivo: módulo de contexto, catálogo y acción.
 *
 * @example ventas.catalog_campaign.read
 */
export const getCatalogPermissionCode = (contextModuleCode: CatalogContextModuleCode, definition: CatalogDefinition, action: CatalogPermissionAction): string => `${contextModuleCode}.${definition.moduleCode}.${action}`;

/** Formato anterior, sin módulo de contexto. Se conserva para reconocer códigos viejos, no para autorizar. */
export const getLegacyCatalogPermissionCode = (definition: CatalogDefinition, action: CatalogPermissionAction): string => `${definition.moduleCode}.${action}`;

/** Todos los códigos del formato anterior. */
export const getLegacyCatalogPermissionCodes = (): readonly string[] => CATALOG_DEFINITIONS.flatMap((definition) => CATALOG_PERMISSION_ACTIONS.map((action) => getLegacyCatalogPermissionCode(definition, action)));

/** Permiso de cada catálogo en cada módulo y cada acción. */
export const getCatalogPermissionCodes = (): readonly string[] => CATALOG_DEFINITIONS.flatMap((definition) => CATALOG_CONTEXT_MODULES.flatMap((contextModuleCode) => CATALOG_PERMISSION_ACTIONS.map((action) => getCatalogPermissionCode(contextModuleCode, definition, action))));

/** Permisos de un solo módulo de contexto, para armar su catálogo de seguridad. */
export const getCatalogPermissionCodesForContext = (contextModuleCode: CatalogContextModuleCode): readonly string[] => CATALOG_DEFINITIONS.flatMap((definition) => CATALOG_PERMISSION_ACTIONS.map((action) => getCatalogPermissionCode(contextModuleCode, definition, action)));

/** Nombre visible. "Ver" usa el plural del catálogo; el resto, el singular del valor. */
export const getCatalogPermissionName = (definition: CatalogDefinition, action: CatalogPermissionAction): string => `${CATALOG_PERMISSION_ACTION_LABELS[action]} ${action === "read" ? definition.label.toLowerCase() : definition.itemLabel}`;

/** Descripción corta del permiso. No sustituye la decisión del API. */
export const getCatalogPermissionDescription = (definition: CatalogDefinition, action: CatalogPermissionAction): string => `${CATALOG_PERMISSION_ACTION_LABELS[action]} ${action === "read" ? definition.label.toLowerCase() : definition.itemLabel}.`;
