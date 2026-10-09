export const CATALOG_STATUSES = ["active", "inactive"] as const;

export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

export type CatalogRouteCode = "brokers" | "campaigns" | "classes" | "files" | "locations" | "projects" | "subsidiaries";

export interface CatalogDefinition {
    readonly itemLabel: string;
    readonly label: string;
    readonly moduleCode: string;
    readonly routeCode: CatalogRouteCode;
}

export const CATALOG_CONTEXT_MODULES = ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"] as const;

export type CatalogContextModuleCode = (typeof CATALOG_CONTEXT_MODULES)[number];

export const CATALOG_DEFINITIONS: readonly CatalogDefinition[] = [
    { itemLabel: "proyecto", label: "Proyectos", moduleCode: "catalog_project", routeCode: "projects" },
    { itemLabel: "campaña", label: "Campañas", moduleCode: "catalog_campaign", routeCode: "campaigns" },
    { itemLabel: "clase", label: "Clases", moduleCode: "catalog_class", routeCode: "classes" },
    { itemLabel: "corredor", label: "Corredores", moduleCode: "catalog_broker", routeCode: "brokers" },
    { itemLabel: "expediente", label: "Expedientes", moduleCode: "catalog_file", routeCode: "files" },
    { itemLabel: "subsidiaria", label: "Subsidiarias", moduleCode: "catalog_subsidiary", routeCode: "subsidiaries" },
    { itemLabel: "ubicación", label: "Ubicaciones", moduleCode: "catalog_location", routeCode: "locations" },
] as const;

export const CATALOG_PERMISSION_ACTIONS = ["read", "create", "update", "inactivate"] as const;

export type CatalogPermissionAction = (typeof CATALOG_PERMISSION_ACTIONS)[number];

export const CATALOG_PERMISSION_ACTION_LABELS = {
    create: "Crear",
    inactivate: "Inactivar",
    read: "Ver",
    update: "Editar",
} as const satisfies Record<CatalogPermissionAction, string>;

export const findCatalogDefinition = (routeCode: string): CatalogDefinition | undefined => CATALOG_DEFINITIONS.find((definition) => definition.routeCode === routeCode);

export const findCatalogDefinitionByModuleCode = (moduleCode: string): CatalogDefinition | undefined => CATALOG_DEFINITIONS.find((definition) => definition.moduleCode === moduleCode);

export const isCatalogContextModuleCode = (moduleCode: string): moduleCode is CatalogContextModuleCode => CATALOG_CONTEXT_MODULES.includes(moduleCode as CatalogContextModuleCode);

export const getCatalogPermissionCode = (contextModuleCode: CatalogContextModuleCode, definition: CatalogDefinition, action: CatalogPermissionAction): string => `${contextModuleCode}.${definition.moduleCode}.${action}`;

export const getLegacyCatalogPermissionCode = (definition: CatalogDefinition, action: CatalogPermissionAction): string => `${definition.moduleCode}.${action}`;

export const getLegacyCatalogPermissionCodes = (): readonly string[] => CATALOG_DEFINITIONS.flatMap((definition) => CATALOG_PERMISSION_ACTIONS.map((action) => getLegacyCatalogPermissionCode(definition, action)));

export const getCatalogPermissionCodes = (): readonly string[] => CATALOG_DEFINITIONS.flatMap((definition) => CATALOG_CONTEXT_MODULES.flatMap((contextModuleCode) => CATALOG_PERMISSION_ACTIONS.map((action) => getCatalogPermissionCode(contextModuleCode, definition, action))));

export const getCatalogPermissionCodesForContext = (contextModuleCode: CatalogContextModuleCode): readonly string[] => CATALOG_DEFINITIONS.flatMap((definition) => CATALOG_PERMISSION_ACTIONS.map((action) => getCatalogPermissionCode(contextModuleCode, definition, action)));

export const getCatalogPermissionName = (definition: CatalogDefinition, action: CatalogPermissionAction): string => `${CATALOG_PERMISSION_ACTION_LABELS[action]} ${action === "read" ? definition.label.toLowerCase() : definition.itemLabel}`;

export const getCatalogPermissionDescription = (definition: CatalogDefinition, action: CatalogPermissionAction): string => `${CATALOG_PERMISSION_ACTION_LABELS[action]} ${action === "read" ? definition.label.toLowerCase() : definition.itemLabel}.`;
