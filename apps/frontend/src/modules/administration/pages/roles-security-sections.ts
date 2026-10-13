/**
 * Navegación focalizada de permisos: módulo → sección → catálogo.
 *
 * Solo reorganiza el catálogo que entrega el API; no crea módulos, secciones ni
 * permisos. Una sección que el API no expone (por ejemplo, Auditoría sin
 * permisos) no aparece.
 */

export interface PermissionCatalogItem {
    readonly code: string;
    readonly description: string;
    readonly name: string;
    readonly sensitive?: boolean;
}

export interface ModuleViewCatalogItem {
    readonly code: string;
    readonly name: string;
    readonly permissions: readonly PermissionCatalogItem[];
}

export interface ModuleCatalogItem {
    readonly code: string;
    readonly name: string;
    readonly views: readonly ModuleViewCatalogItem[];
}

export type PermissionOverrideState = Record<string, "allow" | "deny">;

export interface PermissionSectionView extends ModuleViewCatalogItem {
    readonly key: string;
    readonly moduleCode: string;
}

export interface PermissionSection {
    readonly isCatalog: boolean;
    readonly key: string;
    readonly moduleCode: string;
    readonly name: string;
    readonly views: readonly PermissionSectionView[];
}

export interface PermissionDisplayModule {
    readonly key: string;
    readonly name: string;
    readonly sections: readonly PermissionSection[];
}

export type PermissionLevel = "read" | "sensitive" | "standard";

export const PERMISSION_LEVEL_LABELS: Readonly<Record<PermissionLevel, string>> = {
    read: "Lectura",
    sensitive: "Sensible",
    standard: "Estándar",
};

/** Usuarios, Roles y seguridad y los catálogos de administración se muestran como un solo módulo. */
const ADMINISTRATION_GROUP_ORDER = ["user", "role", "administration"] as const;
const ADMINISTRATION_DISPLAY_KEY = "administration";
const ADMINISTRATION_DISPLAY_NAME = "Administración";
const CATALOG_SECTION_NAME = "Catálogos";
/** El API entrega estos nombres sin tilde; el código es estable y el texto visible se corrige aquí. */
const MODULE_LABELS: Readonly<Record<string, string>> = {
    contabilidad: "Contabilidad",
    formalizacion: "Formalización",
    mercadeo: "Mercadeo",
    ventas: "Ventas",
};
const READ_ACTION_PATTERN = /\.(?:read|view_list|view_detail)$/u;

/** Los catálogos se agrupan aparte porque se comparten entre perfiles. */
export const isCatalogModuleCode = (code: string): boolean => code.startsWith("catalog_");

const isAdministrationGroupCode = (code: string): boolean => ADMINISTRATION_GROUP_ORDER.includes(code as (typeof ADMINISTRATION_GROUP_ORDER)[number]);

const toSectionView = (module: ModuleCatalogItem, view: ModuleViewCatalogItem): PermissionSectionView => ({ ...view, key: `${module.code}:${view.code}`, moduleCode: module.code });

/**
 * Cada vista propia es una sección; los catálogos del módulo forman una sola
 * sección con una pestaña por catálogo. Un módulo de administración con una sola
 * vista usa el nombre del módulo (Roles y seguridad, no Roles).
 */
const buildModuleSections = (module: ModuleCatalogItem, useModuleNameForSingleView: boolean): readonly PermissionSection[] => {
    const ownViews = module.views.filter((view) => !isCatalogModuleCode(view.code)).map((view) => toSectionView(module, view));
    const catalogViews = module.views.filter((view) => isCatalogModuleCode(view.code)).map((view) => toSectionView(module, view));
    const singleViewName = useModuleNameForSingleView && ownViews.length === 1 ? module.name : null;
    const sections: PermissionSection[] = ownViews.map((view) => ({ isCatalog: false, key: view.key, moduleCode: module.code, name: singleViewName ?? view.name, views: [view] }));

    if (catalogViews.length > 0) {
        sections.push({ isCatalog: true, key: `${module.code}:catalogs`, moduleCode: module.code, name: CATALOG_SECTION_NAME, views: catalogViews });
    }

    return sections;
};

/** Administración primero; el resto conserva el orden ya aplicado a los módulos del API. */
export const buildDisplayModules = (modules: readonly ModuleCatalogItem[]): readonly PermissionDisplayModule[] => {
    const administrationSections = ADMINISTRATION_GROUP_ORDER.flatMap((code) => modules.filter((module) => module.code === code)).flatMap((module) => buildModuleSections(module, true));
    const otherModules = modules.filter((module) => !isAdministrationGroupCode(module.code)).map((module) => ({ key: module.code, name: MODULE_LABELS[module.code] ?? module.name, sections: buildModuleSections(module, false) }));
    const administration = administrationSections.length > 0 ? [{ key: ADMINISTRATION_DISPLAY_KEY, name: ADMINISTRATION_DISPLAY_NAME, sections: administrationSections }] : [];

    return [...administration, ...otherModules].filter((module) => module.sections.length > 0);
};

/** Elemento elegido o, si ya no existe en el contexto actual, el primero disponible. */
export const findByKeyOrFirst = <T extends { readonly key: string }>(items: readonly T[], key: string): T | undefined => items.find((item) => item.key === key) ?? items[0];

export const getPermissionLevel = (permission: PermissionCatalogItem): PermissionLevel => {
    if (permission.sensitive) {
        return "sensitive";
    }

    return READ_ACTION_PATTERN.test(permission.code) ? "read" : "standard";
};

/** Encender el acceso concede la lectura de la sección; si no tiene lectura, todas sus acciones. */
export const getAccessPermissionCodes = (view: ModuleViewCatalogItem): ReadonlySet<string> => {
    const readCodes = view.permissions.filter((permission) => getPermissionLevel(permission) === "read").map((permission) => permission.code);

    return new Set(readCodes.length > 0 ? readCodes : view.permissions.map((permission) => permission.code));
};

export const getAllPermissionCodes = (view: ModuleViewCatalogItem): ReadonlySet<string> => new Set(view.permissions.map((permission) => permission.code));

/** Reemplaza solo los códigos de la vista dentro de la lista del módulo del rol. */
export const replaceViewPermissionCodes = (moduleCodes: readonly string[], view: ModuleViewCatalogItem, enabledCodes: ReadonlySet<string>): readonly string[] => {
    const viewCodes = getAllPermissionCodes(view);

    return [...moduleCodes.filter((code) => !viewCodes.has(code)), ...view.permissions.map((permission) => permission.code).filter((code) => enabledCodes.has(code))];
};

/**
 * Traduce el estado deseado de la vista a excepciones del empleado.
 *
 * Si coincide con lo que dan sus roles, la excepción sobra y se quita; si no,
 * queda `allow` o `deny` directo. El API vuelve a calcular el efecto al guardar.
 */
export const applyUserViewPermissions = (overrides: PermissionOverrideState, view: ModuleViewCatalogItem, enabledCodes: ReadonlySet<string>, baseCodes: ReadonlySet<string>): PermissionOverrideState =>
    view.permissions.reduce<PermissionOverrideState>((next, permission) => {
        const isEnabled = enabledCodes.has(permission.code);

        if (isEnabled === baseCodes.has(permission.code)) {
            return Object.fromEntries(Object.entries(next).filter(([code]) => code !== permission.code));
        }

        return { ...next, [permission.code]: isEnabled ? "allow" : "deny" };
    }, overrides);

/** Origen visible del permiso de un empleado; describe la edición, no autoriza. */
export const getUserPermissionOrigin = (code: string, overrides: PermissionOverrideState, baseCodes: ReadonlySet<string>): string => {
    if (overrides[code] === "allow") {
        return "Excepción: permitido";
    }

    if (overrides[code] === "deny") {
        return "Excepción: denegado";
    }

    return baseCodes.has(code) ? "Por rol" : "Sin permiso del rol";
};
