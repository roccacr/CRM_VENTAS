/**
 * Consola de roles, módulos y permisos.
 *
 * Permite revisar un rol o un empleado y proponer cambios. Guardar exige un
 * motivo auditable. Los permisos efectivos los calcula el API; lo que se ve
 * aquí es el catálogo persistido más las excepciones que el usuario está editando.
 */
import "./RolesSecurityPage.css";

import CloseOutlined from "@ant-design/icons/CloseOutlined";
import DownOutlined from "@ant-design/icons/DownOutlined";
import EditOutlined from "@ant-design/icons/EditOutlined";
import SaveOutlined from "@ant-design/icons/SaveOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import { notification } from "antd";
import ConfigProvider from "antd/es/config-provider";
import esES from "antd/es/locale/es_ES";
import Select from "antd/es/select";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getIdentitySecurityCatalog, getIdentityUserAccess, getSystemUsers, replaceIdentityRolePermissions, replaceIdentityUserAccess, updateIdentityRole } from "../../../services/auth/auth-service";
import type { IdentityUserPermissionOverride, SystemUserDirectoryItem } from "../../../services/auth/identity-contracts";
import { ADMINISTRATION_THEME } from "../administration-theme";

interface RoleCatalogItem {
    readonly code: string;
    readonly locked: boolean;
    readonly name: string;
    readonly users: number;
}

interface PermissionCatalogItem {
    readonly code: string;
    readonly description: string;
    readonly name: string;
    readonly sensitive?: boolean;
}

interface ModuleViewCatalogItem {
    readonly code: string;
    readonly name: string;
    readonly permissions: readonly PermissionCatalogItem[];
}

interface ModuleCatalogItem {
    readonly code: string;
    readonly name: string;
    readonly views: readonly ModuleViewCatalogItem[];
}

type PermissionCode = string;
type RolePermissionState = Record<string, Record<string, readonly PermissionCode[]>>;
type PermissionOverrideState = Record<string, "allow" | "deny">;

interface RenameRoleFormState {
    readonly name: string;
    readonly reason: string;
}

interface SavePermissionsFormState {
    readonly reason: string;
}

interface ViewExpansionState {
    readonly openViewCodes: ReadonlySet<string>;
    readonly scopeKey: string;
}

interface ModuleDisplayGroup {
    readonly key: string;
    readonly modules: readonly ModuleCatalogItem[];
    readonly title: string;
}

interface UserModuleAccessSummary {
    readonly baseGranted: number;
    readonly directOverrideCount: number;
    readonly effectiveGranted: number;
    readonly isVisible: boolean;
    readonly module: ModuleCatalogItem;
    readonly total: number;
}

interface PermissionViewSection extends ModuleViewCatalogItem {
    readonly moduleCode: string;
}

interface PermissionViewSections {
    readonly catalogViews: readonly PermissionViewSection[];
    readonly moduleViews: readonly PermissionViewSection[];
}

const INITIAL_ROLES: readonly RoleCatalogItem[] = [
    { code: "owner", locked: true, name: "Owner", users: 1 },
    { code: "jefe_general", locked: false, name: "Jefe general", users: 5 },
    { code: "subjefe_area", locked: false, name: "Subjefe", users: 8 },
    { code: "ventas", locked: false, name: "Ventas", users: 31 },
    { code: "mercadeo", locked: false, name: "Mercadeo", users: 0 },
    { code: "formalizacion", locked: false, name: "Formalización", users: 0 },
    { code: "contabilidad", locked: false, name: "Contabilidad", users: 0 },
] as const satisfies readonly RoleCatalogItem[];

const INITIAL_MODULES: readonly ModuleCatalogItem[] = [
    {
        code: "ventas",
        name: "Ventas",
        views: [
            {
                code: "leads",
                name: "Leads",
                permissions: [
                    { code: "lead.read", description: "Permite leer la tabla de prospectos.", name: "Ver lista de leads" },
                    { code: "lead.create", description: "Habilita el botón Nuevo lead.", name: "Crear lead" },
                    { code: "lead.update", description: "Permite modificar datos del expediente.", name: "Editar lead" },
                    { code: "lead.status", description: "Permite mover etapa en el pipeline.", name: "Cambiar estado" },
                    { code: "lead.assign", description: "Permite reasignar responsable.", name: "Asignar responsable" },
                ],
            },
            {
                code: "opportunities",
                name: "Oportunidades",
                permissions: [
                    { code: "opportunity.read", description: "Permite consultar oportunidades abiertas.", name: "Ver oportunidades" },
                    { code: "opportunity.create", description: "Habilita creación de oportunidades.", name: "Crear oportunidad" },
                    { code: "opportunity.close", description: "Permite cerrar oportunidad ganada o perdida.", name: "Cerrar oportunidad" },
                ],
            },
            {
                code: "estimates",
                name: "Estimaciones",
                permissions: [
                    { code: "estimate.read", description: "Permite ver estimaciones asociadas.", name: "Ver estimaciones" },
                    { code: "estimate.create", description: "Habilita cálculo y guardado de estimaciones.", name: "Crear estimación" },
                    { code: "estimate.approve", description: "Permiso sensible para aprobar estimaciones.", name: "Aprobar estimación", sensitive: true },
                ],
            },
        ],
    },
    {
        code: "mercadeo",
        name: "Mercadeo",
        views: [
            {
                code: "campaigns",
                name: "Campañas",
                permissions: [
                    { code: "campaign.read", description: "Permite ver campañas activas.", name: "Ver campañas" },
                    { code: "campaign.create", description: "Permite crear campañas.", name: "Crear campaña" },
                    { code: "source.update", description: "Permite modificar fuentes de tráfico.", name: "Editar fuentes" },
                ],
            },
        ],
    },
    {
        code: "formalizacion",
        name: "Formalización",
        views: [
            {
                code: "files",
                name: "Expedientes",
                permissions: [
                    { code: "file.read", description: "Permite ver expedientes.", name: "Ver expedientes" },
                    { code: "contract.review", description: "Permite revisar contratos.", name: "Revisar contrato" },
                    { code: "signature.manage", description: "Permite gestionar firmas.", name: "Gestionar firmas" },
                ],
            },
        ],
    },
    {
        code: "contabilidad",
        name: "Contabilidad",
        views: [
            {
                code: "billing",
                name: "Cobros",
                permissions: [
                    { code: "wallet.read", description: "Permite ver cartera.", name: "Ver cartera" },
                    { code: "invoice.read", description: "Permite consultar facturas.", name: "Ver facturas" },
                    { code: "payment.reconcile", description: "Permiso sensible para conciliación.", name: "Conciliar pago", sensitive: true },
                ],
            },
        ],
    },
] as const satisfies readonly ModuleCatalogItem[];

const EMPTY_RENAME_ROLE_FORM: RenameRoleFormState = {
    name: "",
    reason: "",
};

const EMPTY_SAVE_PERMISSIONS_FORM: SavePermissionsFormState = {
    reason: "",
};

const EMPTY_OPEN_VIEW_CODES: ReadonlySet<string> = new Set();
/** El motivo de un cambio de rol exige al menos dos palabras para que la auditoría diga algo. */
const AUDIT_REASON_MIN_WORDS = 2;
/** Rol con alcance de empresa. Sus módulos de administración no se ofrecen al resto. */
const OWNER_ROLE_CODE = "owner";
/** Grupo visual de los catálogos compartidos. No es un código de módulo del API. */
const SHARED_CATALOGS_GROUP_CODE = "__shared_catalogs__";
const ADMINISTRATION_MODULE_CODES = ["administration", "role", "user"] as const;
const OPERATIONAL_MODULE_CODES = ["ventas", "mercadeo", "formalizacion", "contabilidad"] as const;
/** Grupo que nace abierto: el trabajo diario está en los módulos operativos. */
const DEFAULT_EXPANDED_MODULE_GROUP_KEY = "operational";
const MODULE_DISPLAY_ORDER = ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration", "user", "role"] as const;

/** Módulos de estructura. Fuera del contexto Owner no se muestran como áreas asignables. */
const isAdministrationModuleCode = (moduleCode: string): boolean => ADMINISTRATION_MODULE_CODES.includes(moduleCode as (typeof ADMINISTRATION_MODULE_CODES)[number]);
/** Los catálogos se agrupan aparte porque se comparten entre perfiles. */
const isCatalogModuleCode = (moduleCode: string): boolean => moduleCode.startsWith("catalog_");
/** Perfiles de trabajo diario, distintos de administración y de catálogos. */
const isOperationalModuleCode = (moduleCode: string): boolean => OPERATIONAL_MODULE_CODES.includes(moduleCode as (typeof OPERATIONAL_MODULE_CODES)[number]);

/** Orden fijo del menú. Un módulo desconocido queda al final, ordenado por nombre. */
const sortModulesForDisplay = (items: readonly ModuleCatalogItem[]): readonly ModuleCatalogItem[] =>
    [...items]
        .filter((module) => module.code !== "org")
        .sort((first, second) => {
            const firstIndex = MODULE_DISPLAY_ORDER.indexOf(first.code as (typeof MODULE_DISPLAY_ORDER)[number]);
            const secondIndex = MODULE_DISPLAY_ORDER.indexOf(second.code as (typeof MODULE_DISPLAY_ORDER)[number]);

            return (firstIndex === -1 ? Number.MAX_SAFE_INTEGER : firstIndex) - (secondIndex === -1 ? Number.MAX_SAFE_INTEGER : secondIndex) || first.name.localeCompare(second.name);
        });

/** Rechaza un motivo de una sola palabra: no alcanza para explicar el cambio. */
const hasValidAuditReason = (reason: string): boolean => reason.trim().split(/\s+/u).filter(Boolean).length >= AUDIT_REASON_MIN_WORDS;

/** Acciones de un módulo. Si el código no existe, no se inventan permisos. */
const getModulePermissionCodes = (modules: readonly ModuleCatalogItem[], moduleCode: string): PermissionCode[] => {
    const module = modules.find((item) => item.code === moduleCode);

    return module ? module.views.flatMap((view) => view.permissions.map((permission) => permission.code)) : [];
};

/** Reparte una lista plana de permisos en el módulo al que pertenece cada código. */
const groupPermissionCodesByModule = (modules: readonly ModuleCatalogItem[], permissionCodes: readonly string[]): Record<string, readonly PermissionCode[]> => {
    const grantedCodes = new Set(permissionCodes);

    return Object.fromEntries(modules.map((module) => [module.code, getModulePermissionCodes(modules, module.code).filter((permissionCode) => grantedCodes.has(permissionCode))]));
};

/**
 * Matriz de respaldo mientras el catálogo del API no llega.
 *
 * No autoriza: en cuanto responde el BFF, este estado se reemplaza por el persistido.
 */
const DEFAULT_ROLE_PERMISSIONS: RolePermissionState = {
    jefe_general: {
        contabilidad: ["wallet.read", "invoice.read", "payment.reconcile"],
        formalizacion: ["file.read", "contract.review", "signature.manage"],
        mercadeo: ["campaign.read", "campaign.create", "source.update"],
        ventas: getModulePermissionCodes(INITIAL_MODULES, "ventas"),
    },
    owner: {
        contabilidad: getModulePermissionCodes(INITIAL_MODULES, "contabilidad"),
        formalizacion: getModulePermissionCodes(INITIAL_MODULES, "formalizacion"),
        mercadeo: getModulePermissionCodes(INITIAL_MODULES, "mercadeo"),
        ventas: getModulePermissionCodes(INITIAL_MODULES, "ventas"),
    },
    subjefe_area: {
        contabilidad: getModulePermissionCodes(INITIAL_MODULES, "contabilidad"),
        formalizacion: getModulePermissionCodes(INITIAL_MODULES, "formalizacion"),
        mercadeo: getModulePermissionCodes(INITIAL_MODULES, "mercadeo"),
        ventas: getModulePermissionCodes(INITIAL_MODULES, "ventas"),
    },
    contabilidad: {
        contabilidad: getModulePermissionCodes(INITIAL_MODULES, "contabilidad"),
        formalizacion: [],
        mercadeo: [],
        ventas: [],
    },
    formalizacion: {
        contabilidad: [],
        formalizacion: getModulePermissionCodes(INITIAL_MODULES, "formalizacion"),
        mercadeo: [],
        ventas: [],
    },
    mercadeo: {
        contabilidad: [],
        formalizacion: [],
        mercadeo: getModulePermissionCodes(INITIAL_MODULES, "mercadeo"),
        ventas: [],
    },
    ventas: {
        contabilidad: [],
        formalizacion: [],
        mercadeo: [],
        ventas: ["lead.read", "lead.create", "lead.update"],
    },
};

/** Rol y módulo de respaldo para no dejar la consola sin selección si el código ya no existe. */
const FALLBACK_ROLE = INITIAL_ROLES[0] as RoleCatalogItem;
const FALLBACK_MODULE = INITIAL_MODULES[0] as ModuleCatalogItem;

const getRole = (roles: readonly RoleCatalogItem[], code: string): RoleCatalogItem => roles.find((role) => role.code === code) ?? FALLBACK_ROLE;
const getModule = (modules: readonly ModuleCatalogItem[], code: string): ModuleCatalogItem => modules.find((module) => module.code === code) ?? FALLBACK_MODULE;

/** Texto del fallo. Un valor que no sea `Error` no muestra el objeto crudo. */
const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : "No se pudo completar la acción.");

/** Compara listas sin importar el orden: lo que cuenta es el conjunto de códigos. */
const arePermissionListsEqual = (first: readonly string[], second: readonly string[]): boolean => first.length === second.length && first.every((code) => second.includes(code));

/** Cuenta módulos cuyo conjunto de permisos cambió respecto de lo último guardado. */
const countRolePermissionChanges = (current: RolePermissionState, saved: RolePermissionState, roleCode: string): number => {
    const moduleCodes = new Set([...Object.keys(current[roleCode] ?? {}), ...Object.keys(saved[roleCode] ?? {})]);

    return [...moduleCodes].filter((moduleCode) => !arePermissionListsEqual(current[roleCode]?.[moduleCode] ?? [], saved[roleCode]?.[moduleCode] ?? [])).length;
};

/** Permisos del rol limitados a los módulos que la consola está mostrando. */
const getRolePermissionCodesForModules = (state: RolePermissionState, roleCode: string, visibleModules: readonly ModuleCatalogItem[]): readonly string[] => {
    const visibleModuleCodes = new Set(visibleModules.map((module) => module.code));

    return [
        ...new Set(
            Object.entries(state[roleCode] ?? {})
                .filter(([moduleCode]) => visibleModuleCodes.has(moduleCode))
                .flatMap(([, permissionCodes]) => permissionCodes),
        ),
    ].sort();
};

/** Unión de lo que aportan los roles del empleado, antes de aplicar excepciones. */
const getUserBasePermissionCodes = (state: RolePermissionState, roleCodes: ReadonlySet<string>, moduleCode: string): readonly string[] => [...new Set([...roleCodes].flatMap((roleCode) => state[roleCode]?.[moduleCode] ?? []))];

/**
 * Permisos del empleado en un módulo.
 *
 * `allow` suma y `deny` quita. Es una vista previa de la consola; el efecto
 * final lo vuelve a calcular el API al guardar.
 */
const getEffectiveUserPermissionCodes = (state: RolePermissionState, roleCodes: ReadonlySet<string>, overrides: PermissionOverrideState, moduleCode: string): readonly string[] => {
    const codes = new Set(getUserBasePermissionCodes(state, roleCodes, moduleCode));

    for (const [code, effect] of Object.entries(overrides)) {
        if (effect === "allow") {
            codes.add(code);
        } else {
            codes.delete(code);
        }
    }

    return [...codes].sort();
};

/** Dos conjuntos iguales aunque el orden de inserción sea distinto. */
const areStringSetsEqual = (first: ReadonlySet<string> | undefined, second: ReadonlySet<string> | undefined): boolean => {
    if (!first || !second) {
        return first === second;
    }

    return first.size === second.size && [...first].every((value) => second.has(value));
};

/** Una excepción cuenta como cambio si aparece, desaparece o pasa de allow a deny. */
const areOverrideStatesEqual = (first: PermissionOverrideState, second: PermissionOverrideState): boolean => {
    const codes = new Set([...Object.keys(first), ...Object.keys(second)]);

    return [...codes].every((code) => first[code] === second[code]);
};

/** Roles, áreas y excepciones actuales frente a lo último que confirmó el API. */
interface UserAccessComparisonInput {
    readonly currentOrgUnits: ReadonlySet<string>;
    readonly currentOverrides: PermissionOverrideState;
    readonly currentRoles: ReadonlySet<string>;
    readonly savedOrgUnits: ReadonlySet<string>;
    readonly savedOverrides: PermissionOverrideState;
    readonly savedRoles: ReadonlySet<string>;
}

/** Hasta tres cambios: roles, áreas y excepciones. No cuenta cada permiso por separado. */
const countUserAccessChanges = ({ currentOrgUnits, currentOverrides, currentRoles, savedOrgUnits, savedOverrides, savedRoles }: UserAccessComparisonInput): number => {
    let changes = 0;

    if (!areStringSetsEqual(currentRoles, savedRoles)) {
        changes += 1;
    }

    if (!areStringSetsEqual(currentOrgUnits, savedOrgUnits)) {
        changes += 1;
    }

    if (!areOverrideStatesEqual(currentOverrides, savedOverrides)) {
        changes += 1;
    }

    return changes;
};

/** Quita la excepción para que el permiso vuelva a salir solo del rol. */
const withoutPermissionOverride = (state: PermissionOverrideState, permissionCode: string): PermissionOverrideState => Object.fromEntries(Object.entries(state).filter(([code]) => code !== permissionCode));

/** Fija allow o deny directo. Deny gana sobre lo que el rol concedería. */
const withPermissionOverride = (state: PermissionOverrideState, permissionCode: string, effect: "allow" | "deny"): PermissionOverrideState => ({
    ...state,
    [permissionCode]: effect,
});

/** Pasa la lista del API a un mapa por código para editarla en la consola. */
const mapOverridesToState = (overrides: readonly IdentityUserPermissionOverride[]): PermissionOverrideState => Object.fromEntries(overrides.map((override) => [override.code, override.effect]));

/** Vuelve al cuerpo que el API espera, ordenado para que el diff sea estable. */
const mapOverrideStateToList = (overrides: PermissionOverrideState): readonly IdentityUserPermissionOverride[] =>
    Object.entries(overrides)
        .map(([code, effect]) => ({ code, effect }))
        .sort((first, second) => first.code.localeCompare(second.code));

/** Texto que el diálogo muestra antes de guardar el acceso de un empleado. */
const buildUserSaveSummary = (input: { readonly modules: readonly ModuleCatalogItem[]; readonly roles: readonly RoleCatalogItem[]; readonly selectedUser: SystemUserDirectoryItem; readonly userOrgUnitCodes: ReadonlySet<string>; readonly userPermissionOverrides: PermissionOverrideState; readonly userRoleCodes: ReadonlySet<string> }): readonly string[] => {
    const selectedRoleNames = input.roles.filter((role) => input.userRoleCodes.has(role.code)).map((role) => role.name);
    const selectedModuleNames = input.modules.filter((module) => !isCatalogModuleCode(module.code) && input.userOrgUnitCodes.has(module.code)).map((module) => module.name);

    return [`Empleado: ${input.selectedUser.name}`, `Roles: ${selectedRoleNames.length > 0 ? selectedRoleNames.join(", ") : "Sin roles"}`, `Módulos visibles: ${selectedModuleNames.length > 0 ? selectedModuleNames.join(", ") : "Sin módulos"}`, `Excepciones directas: ${String(Object.keys(input.userPermissionOverrides).length)}`];
};

/** Resumen del rol: cuántas acciones quedan concedidas en cada módulo. */
const buildRoleSaveSummary = (input: { readonly modules: readonly ModuleCatalogItem[]; readonly permissionState: RolePermissionState; readonly selectedRole: RoleCatalogItem; readonly selectedRoleCode: string }): readonly string[] => {
    const moduleSummary = input.modules
        .map((module) => {
            const granted = input.permissionState[input.selectedRoleCode]?.[module.code]?.length ?? 0;
            const total = getModulePermissionCodes(input.modules, module.code).length;

            return `${module.name} ${String(granted)}/${String(total)}`;
        })
        .join(" · ");

    return [`Rol: ${input.selectedRole.name}`, moduleSummary];
};

/** Owner ve administración. El resto no asigna módulos de estructura. */
const getVisibleModulesForContext = (modules: readonly ModuleCatalogItem[], isOwnerContext: boolean): readonly ModuleCatalogItem[] => modules.filter((module) => isOwnerContext || !isAdministrationModuleCode(module.code));

/** La búsqueda mira nombre y código del módulo y de sus vistas. */
const matchesModuleQuery = (module: ModuleCatalogItem, normalizedQuery: string): boolean => {
    if (!normalizedQuery) {
        return true;
    }

    return [module.name, module.code, ...module.views.flatMap((view) => [view.name, view.code])].some((value) => value.toLocaleLowerCase("es").includes(normalizedQuery));
};

/** Agrupa lo visible en operativos, administración y el resto. Un grupo vacío no se pinta. */
const buildModuleDisplayGroups = (modules: readonly ModuleCatalogItem[], normalizedQuery: string): readonly ModuleDisplayGroup[] => {
    const visibleModules = modules.filter((module) => !isCatalogModuleCode(module.code) && matchesModuleQuery(module, normalizedQuery));
    const operational = visibleModules.filter((module) => isOperationalModuleCode(module.code));
    const administration = visibleModules.filter((module) => isAdministrationModuleCode(module.code));
    const other = visibleModules.filter((module) => !isOperationalModuleCode(module.code) && !isAdministrationModuleCode(module.code) && !isCatalogModuleCode(module.code));

    return [
        { key: "operational", modules: operational, title: "Módulos operativos" },
        { key: "administration", modules: administration, title: "Administración del sistema" },
        { key: "other", modules: other, title: "Otros módulos" },
    ].filter((group) => group.modules.length > 0);
};

/** Deja solo las acciones cuyo nombre, vista o descripción coinciden con la búsqueda. */
const filterPermissionViews = (views: readonly PermissionViewSection[], normalizedQuery: string): readonly PermissionViewSection[] =>
    views
        .map((view) => ({
            ...view,
            permissions: view.permissions.filter((permission) => {
                const haystack = `${view.name} ${permission.name} ${permission.description}`.toLowerCase();

                return normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
            }),
        }))
        .filter((view) => view.permissions.length > 0);

/** El código de vista de un catálogo se prefija con el módulo para no chocar entre catálogos. */
const getViewBaseCode = (viewCode: string): string => viewCode.split(":").pop() ?? viewCode;

/** Separa las vistas propias del módulo y las de catálogos compartidos. */
const buildPermissionViewSections = (selectedModule: ModuleCatalogItem, normalizedQuery: string): PermissionViewSections => {
    const views = selectedModule.views.map((view) => ({ ...view, code: isCatalogModuleCode(view.code) ? `${selectedModule.code}:${view.code}` : view.code, moduleCode: selectedModule.code }));

    return {
        catalogViews: filterPermissionViews(
            views.filter((view) => isCatalogModuleCode(getViewBaseCode(view.code))),
            normalizedQuery,
        ),
        moduleViews: filterPermissionViews(
            views.filter((view) => !isCatalogModuleCode(getViewBaseCode(view.code))),
            normalizedQuery,
        ),
    };
};

/** Por módulo: visibilidad en el menú, permisos del rol y excepciones directas. */
const buildUserModuleAccessSummaries = (input: { readonly modules: readonly ModuleCatalogItem[]; readonly permissionState: RolePermissionState; readonly userOrgUnitCodes: ReadonlySet<string>; readonly userPermissionOverrides: PermissionOverrideState; readonly userRoleCodes: ReadonlySet<string> }): readonly UserModuleAccessSummary[] =>
    input.modules.map((module) => {
        const permissionCodes = getModulePermissionCodes(input.modules, module.code);

        return {
            baseGranted: getUserBasePermissionCodes(input.permissionState, input.userRoleCodes, module.code).length,
            directOverrideCount: permissionCodes.filter((permissionCode) => input.userPermissionOverrides[permissionCode]).length,
            effectiveGranted: getEffectiveUserPermissionCodes(input.permissionState, input.userRoleCodes, input.userPermissionOverrides, module.code).length,
            isVisible: input.userOrgUnitCodes.has(module.code),
            module,
            total: permissionCodes.length,
        };
    });

/**
 * Etiqueta de cómo llega el acceso.
 *
 * "Por rol" y "Permiso directo" no autorizan: describen el origen que la
 * consola está editando.
 */
const getUserModuleAccessLabel = (summary: UserModuleAccessSummary): string => {
    if (!summary.isVisible) {
        return "Oculto del menú";
    }

    if (summary.effectiveGranted === 0) {
        return "Visible sin permisos";
    }

    if (summary.directOverrideCount > 0) {
        return "Con excepciones";
    }

    return summary.baseGranted > 0 ? "Por rol" : "Permiso directo";
};

/** Estado de los dos diálogos: renombrar el rol o confirmar los permisos. */
interface RoleSecurityDialogsProps {
    readonly changes: number;
    readonly isRenameRoleDialogOpen: boolean;
    readonly isSavePermissionsDialogOpen: boolean;
    readonly isSubmitting: boolean;
    readonly onClose: () => void;
    readonly onRenameRole: () => void;
    readonly onSavePermissions: () => void;
    readonly renameRoleForm: RenameRoleFormState;
    readonly roleName: string;
    readonly savePermissionsForm: SavePermissionsFormState;
    readonly saveSummary: readonly string[];
    readonly setRenameRoleForm: Dispatch<SetStateAction<RenameRoleFormState>>;
    readonly setSavePermissionsForm: Dispatch<SetStateAction<SavePermissionsFormState>>;
}

/**
 * Consola visual para gestionar permisos desde el rol hacia módulos, vistas y acciones.
 */
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Pantalla operativa con modo rol y modo empleado; separar ahora seria un refactor mayor.
export function RolesSecurityPage() {
    const [roles, setRoles] = useState<readonly RoleCatalogItem[]>(INITIAL_ROLES);
    const [modules, setModules] = useState<readonly ModuleCatalogItem[]>(INITIAL_MODULES);
    const [selectedRoleCode, setSelectedRoleCode] = useState("ventas");
    const [selectedModuleCode, setSelectedModuleCode] = useState("ventas");
    const [permissionState, setPermissionState] = useState<RolePermissionState>(DEFAULT_ROLE_PERMISSIONS);
    const [savedPermissionState, setSavedPermissionState] = useState<RolePermissionState>(DEFAULT_ROLE_PERMISSIONS);
    const [query, setQuery] = useState("");
    const [moduleQuery, setModuleQuery] = useState("");
    const [expandedModuleGroupKey, setExpandedModuleGroupKey] = useState<string | null>(DEFAULT_EXPANDED_MODULE_GROUP_KEY);
    const [isRenameRoleDialogOpen, setIsRenameRoleDialogOpen] = useState(false);
    const [isSavePermissionsDialogOpen, setIsSavePermissionsDialogOpen] = useState(false);
    const [renameRoleForm, setRenameRoleForm] = useState<RenameRoleFormState>(EMPTY_RENAME_ROLE_FORM);
    const [savePermissionsForm, setSavePermissionsForm] = useState<SavePermissionsFormState>(EMPTY_SAVE_PERMISSIONS_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notificationApi, notificationContextHolder] = notification.useNotification();
    const [viewExpansion, setViewExpansion] = useState<ViewExpansionState>({ openViewCodes: EMPTY_OPEN_VIEW_CODES, scopeKey: "" });
    const [users, setUsers] = useState<readonly SystemUserDirectoryItem[]>([]);
    const [userQuery, setUserQuery] = useState("");
    const [selectedUserPublicId, setSelectedUserPublicId] = useState("");
    const [isLoadingUserAccess, setIsLoadingUserAccess] = useState(false);
    const [userRoleCodes, setUserRoleCodes] = useState<ReadonlySet<string>>(new Set());
    const [savedUserRoleCodes, setSavedUserRoleCodes] = useState<ReadonlySet<string>>(new Set());
    const [userOrgUnitCodes, setUserOrgUnitCodes] = useState<ReadonlySet<string>>(new Set());
    const [savedUserOrgUnitCodes, setSavedUserOrgUnitCodes] = useState<ReadonlySet<string>>(new Set());
    const [userPermissionOverrides, setUserPermissionOverrides] = useState<PermissionOverrideState>({});
    const [savedUserPermissionOverrides, setSavedUserPermissionOverrides] = useState<PermissionOverrideState>({});

    const selectedRole = getRole(roles, selectedRoleCode);
    const selectedUser = users.find((user) => user.publicId === selectedUserPublicId) ?? null;
    const isUserMode = Boolean(selectedUser);
    const isOwnerContext = isUserMode ? userRoleCodes.has(OWNER_ROLE_CODE) : selectedRoleCode === OWNER_ROLE_CODE;
    const visibleModules = useMemo(() => getVisibleModulesForContext(modules, isOwnerContext), [isOwnerContext, modules]);
    const normalizedModuleQuery = moduleQuery.trim().toLocaleLowerCase("es");
    const moduleDisplayGroups = useMemo(() => buildModuleDisplayGroups(visibleModules, normalizedModuleQuery), [normalizedModuleQuery, visibleModules]);
    const activeExpandedModuleGroupKey = expandedModuleGroupKey === null ? null : moduleDisplayGroups.some((group) => group.key === expandedModuleGroupKey) ? expandedModuleGroupKey : (moduleDisplayGroups[0]?.key ?? null);
    const selectedModule = visibleModules.find((module) => module.code === selectedModuleCode) ?? visibleModules[0] ?? getModule(modules, selectedModuleCode);
    const activeModuleCode = selectedModule.code;
    const isSystemRole = !isUserMode && selectedRole.locked;
    const isAccessEditorBusy = isLoadingUserAccess;
    const roleDirtyCount = countRolePermissionChanges(permissionState, savedPermissionState, selectedRoleCode);
    const userDirtyCount = countUserAccessChanges({
        currentOrgUnits: userOrgUnitCodes,
        currentOverrides: userPermissionOverrides,
        currentRoles: userRoleCodes,
        savedOrgUnits: savedUserOrgUnitCodes,
        savedOverrides: savedUserPermissionOverrides,
        savedRoles: savedUserRoleCodes,
    });
    const dirtyCount = isUserMode ? userDirtyCount : roleDirtyCount;
    const viewScopeKey = `${isUserMode ? selectedUserPublicId : selectedRoleCode}:${activeModuleCode}`;
    const openViewCodes = viewExpansion.scopeKey === viewScopeKey ? viewExpansion.openViewCodes : EMPTY_OPEN_VIEW_CODES;
    const userModuleAccessSummaries = useMemo(() => buildUserModuleAccessSummaries({ modules: visibleModules, permissionState, userOrgUnitCodes, userPermissionOverrides, userRoleCodes }), [permissionState, userOrgUnitCodes, userPermissionOverrides, userRoleCodes, visibleModules]);
    const userModuleAccessSummaryByCode = useMemo(() => new Map(userModuleAccessSummaries.map((summary) => [summary.module.code, summary])), [userModuleAccessSummaries]);
    const userTopModuleAccessSummaries = useMemo(() => userModuleAccessSummaries.filter((summary) => !isCatalogModuleCode(summary.module.code)), [userModuleAccessSummaries]);
    const selectedUserRoleNames = useMemo(() => roles.filter((role) => userRoleCodes.has(role.code)).map((role) => role.name), [roles, userRoleCodes]);
    const visibleUserModuleNames = useMemo(() => userTopModuleAccessSummaries.filter((summary) => summary.isVisible).map((summary) => summary.module.name), [userTopModuleAccessSummaries]);
    const saveSummary = useMemo(() => {
        if (isUserMode && selectedUser) {
            return buildUserSaveSummary({ modules: visibleModules, roles, selectedUser, userOrgUnitCodes, userPermissionOverrides, userRoleCodes });
        }

        return buildRoleSaveSummary({ modules: visibleModules, permissionState, selectedRole, selectedRoleCode });
    }, [isUserMode, permissionState, roles, selectedRole, selectedRoleCode, selectedUser, userOrgUnitCodes, userPermissionOverrides, userRoleCodes, visibleModules]);

    const showSuccessNotification = useCallback(
        (message: string) => {
            notificationApi.success({
                description: message,
                duration: 4,
                message: "Cambio guardado",
                placement: "topRight",
            });
        },
        [notificationApi],
    );

    const showWarningNotification = useCallback(
        (message: string) => {
            notificationApi.warning({
                description: message,
                duration: 4,
                message: "Revisión requerida",
                placement: "topRight",
            });
        },
        [notificationApi],
    );

    const showErrorNotification = useCallback(
        (message: string) => {
            notificationApi.error({
                description: message,
                duration: 6,
                message: "No se pudo completar la acción",
                placement: "topRight",
            });
        },
        [notificationApi],
    );

    useEffect(() => {
        let cancelled = false;

        getIdentitySecurityCatalog()
            .then((catalog) => {
                if (cancelled) {
                    return;
                }

                const nextModules = sortModulesForDisplay(catalog.modules.length > 0 ? catalog.modules : INITIAL_MODULES);
                const nextRoles = catalog.roles.length > 0 ? catalog.roles.map((role) => ({ code: role.code, locked: role.locked, name: role.name, users: role.users })) : INITIAL_ROLES;
                const nextPermissionState = Object.fromEntries(nextRoles.map((role) => [role.code, groupPermissionCodesByModule(nextModules, catalog.rolePermissions[role.code] ?? [])]));

                setModules(nextModules);
                setRoles(nextRoles);
                setPermissionState(nextPermissionState);
                setSavedPermissionState(nextPermissionState);
                setSelectedRoleCode((current) => (nextRoles.some((role) => role.code === current) ? current : (nextRoles[0]?.code ?? "owner")));
                setSelectedModuleCode((current) => (nextModules.some((module) => module.code === current) ? current : (nextModules[0]?.code ?? "ventas")));
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    showErrorNotification(getErrorMessage(error));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [showErrorNotification]);

    const resetUserAccessState = () => {
        setUserRoleCodes(new Set());
        setSavedUserRoleCodes(new Set());
        setUserOrgUnitCodes(new Set());
        setSavedUserOrgUnitCodes(new Set());
        setUserPermissionOverrides({});
        setSavedUserPermissionOverrides({});
    };

    useEffect(() => {
        let cancelled = false;

        const timeout = window.setTimeout(() => {
            const search = userQuery.trim();

            getSystemUsers({ direction: "asc", limit: 100, sort: "name", ...(search ? { search } : {}) })
                .then((response) => {
                    if (!cancelled) {
                        setUsers(response.items);
                    }
                })
                .catch((error: unknown) => {
                    if (!cancelled) {
                        showErrorNotification(getErrorMessage(error));
                    }
                });
        }, 180);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [showErrorNotification, userQuery]);

    useEffect(() => {
        if (!selectedUserPublicId) {
            return;
        }

        let cancelled = false;

        getIdentityUserAccess(selectedUserPublicId)
            .then((access) => {
                if (cancelled) {
                    return;
                }

                const roleCodes = new Set(access.roles.map((role) => role.code));
                const orgUnitCodes = new Set(access.orgUnits.map((orgUnit) => orgUnit.code));
                const overrides = mapOverridesToState(access.permissionOverrides);
                setUserRoleCodes(roleCodes);
                setSavedUserRoleCodes(new Set(roleCodes));
                setUserOrgUnitCodes(orgUnitCodes);
                setSavedUserOrgUnitCodes(new Set(orgUnitCodes));
                setUserPermissionOverrides(overrides);
                setSavedUserPermissionOverrides({ ...overrides });
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    showErrorNotification(getErrorMessage(error));
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingUserAccess(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [selectedUserPublicId, showErrorNotification]);

    const normalizedQuery = query.trim().toLowerCase();
    const permissionViewSections = useMemo(() => buildPermissionViewSections(selectedModule, normalizedQuery), [normalizedQuery, selectedModule]);

    const togglePermission = (permissionCode: PermissionCode, moduleCode: string) => {
        if (isSystemRole) {
            return;
        }

        if (isUserMode) {
            const basePermissions = new Set(getUserBasePermissionCodes(permissionState, userRoleCodes, moduleCode));
            const currentlyEnabled = getEffectiveUserPermissionCodes(permissionState, userRoleCodes, userPermissionOverrides, moduleCode).includes(permissionCode);

            setUserPermissionOverrides((current) => {
                if (currentlyEnabled) {
                    if (basePermissions.has(permissionCode)) {
                        return withPermissionOverride(current, permissionCode, "deny");
                    }

                    return withoutPermissionOverride(current, permissionCode);
                }

                return basePermissions.has(permissionCode) ? withoutPermissionOverride(current, permissionCode) : withPermissionOverride(current, permissionCode, "allow");
            });
            return;
        }

        setPermissionState((current) => {
            const modulesByRole = current[selectedRoleCode] ?? {};
            const currentPermissions = modulesByRole[moduleCode] ?? [];
            const nextPermissions = currentPermissions.includes(permissionCode) ? currentPermissions.filter((code) => code !== permissionCode) : [...currentPermissions, permissionCode];

            return {
                ...current,
                [selectedRoleCode]: {
                    ...modulesByRole,
                    [moduleCode]: nextPermissions,
                },
            };
        });
    };

    const toggleModule = (moduleCode: string) => {
        if (isSystemRole) {
            return;
        }

        if (isUserMode) {
            const enabled = userOrgUnitCodes.has(moduleCode);
            const modulePermissionCodes = getModulePermissionCodes(modules, moduleCode);
            const basePermissions = new Set(getUserBasePermissionCodes(permissionState, userRoleCodes, moduleCode));

            setUserOrgUnitCodes((current) => {
                const next = new Set(current);

                if (enabled) {
                    next.delete(moduleCode);
                } else {
                    next.add(moduleCode);
                }

                return next;
            });
            setUserPermissionOverrides((current) => {
                let next = current;

                for (const permissionCode of modulePermissionCodes) {
                    if (enabled) {
                        next = basePermissions.has(permissionCode) ? withPermissionOverride(next, permissionCode, "deny") : withoutPermissionOverride(next, permissionCode);
                    } else if (basePermissions.has(permissionCode) && next[permissionCode] === "deny") {
                        next = withoutPermissionOverride(next, permissionCode);
                    }
                }

                return next;
            });
            setSelectedModuleCode(moduleCode);
            return;
        }

        const modulePermissionCodes = getModulePermissionCodes(modules, moduleCode);
        const enabled = (permissionState[selectedRoleCode]?.[moduleCode] ?? []).length > 0;

        setPermissionState((current) => ({
            ...current,
            [selectedRoleCode]: {
                ...(current[selectedRoleCode] ?? {}),
                [moduleCode]: enabled ? [] : modulePermissionCodes,
            },
        }));
        setSelectedModuleCode(moduleCode);
    };

    const toggleUserRole = (roleCode: string) => {
        setUserRoleCodes((current) => {
            const next = new Set(current);

            if (next.has(roleCode)) {
                next.delete(roleCode);
            } else {
                next.add(roleCode);
            }

            return next;
        });
    };

    const toggleView = (viewCode: string) => {
        setViewExpansion((current) => {
            const currentOpenViewCodes = current.scopeKey === viewScopeKey ? current.openViewCodes : EMPTY_OPEN_VIEW_CODES;
            const next = new Set(currentOpenViewCodes);

            if (next.has(viewCode)) {
                next.delete(viewCode);
            } else {
                next.add(viewCode);
            }

            return {
                openViewCodes: next,
                scopeKey: viewScopeKey,
            };
        });
    };

    const closeDialog = () => {
        if (!isSubmitting) {
            setIsRenameRoleDialogOpen(false);
            setIsSavePermissionsDialogOpen(false);
        }
    };

    const openRenameRoleDialog = () => {
        if (isUserMode) {
            showWarningNotification("Quita el empleado seleccionado para renombrar roles base.");
            return;
        }

        notificationApi.destroy();
        setRenameRoleForm({ name: selectedRole.name, reason: "" });
        setIsRenameRoleDialogOpen(true);
    };

    const openSavePermissionsDialog = () => {
        if (dirtyCount === 0) {
            showWarningNotification("No hay cambios de permisos para guardar.");
            return;
        }

        notificationApi.destroy();
        setSavePermissionsForm(EMPTY_SAVE_PERMISSIONS_FORM);
        setIsSavePermissionsDialogOpen(true);
    };

    const handleRenameRole = async () => {
        const name = renameRoleForm.name.trim();
        const reason = renameRoleForm.reason.trim();

        if (name.length < 2 || !hasValidAuditReason(reason)) {
            showWarningNotification("Completa el nuevo nombre y un motivo auditable de al menos dos palabras.");
            return;
        }

        setIsSubmitting(true);

        try {
            const updatedRole = await updateIdentityRole(selectedRoleCode, { name, reason });

            setRoles((current) => current.map((role) => (role.code === updatedRole.code ? { ...role, name: updatedRole.name } : role)));
            showSuccessNotification(`Rol "${updatedRole.name}" renombrado y auditado.`);
            setIsRenameRoleDialogOpen(false);
        } catch (error) {
            showErrorNotification(getErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSavePermissions = async () => {
        const reason = savePermissionsForm.reason.trim();

        if (!hasValidAuditReason(reason)) {
            showWarningNotification("Escribe un motivo auditable de al menos dos palabras para guardar los permisos.");
            return;
        }

        setIsSubmitting(true);

        try {
            if (isUserMode && selectedUser) {
                if (userRoleCodes.size === 0) {
                    showWarningNotification("Selecciona al menos un rol para el empleado.");
                    return;
                }

                const response = await replaceIdentityUserAccess(selectedUser.publicId, {
                    orgUnitCodes: [...userOrgUnitCodes].sort(),
                    permissionOverrides: mapOverrideStateToList(userPermissionOverrides),
                    reason,
                    roleCodes: [...userRoleCodes].sort(),
                });
                const nextRoleCodes = new Set(response.roles.map((role) => role.code));
                const nextOrgUnitCodes = new Set(response.orgUnits.map((orgUnit) => orgUnit.code));
                const nextOverrides = mapOverridesToState(response.permissionOverrides);
                setUserRoleCodes(nextRoleCodes);
                setSavedUserRoleCodes(new Set(nextRoleCodes));
                setUserOrgUnitCodes(nextOrgUnitCodes);
                setSavedUserOrgUnitCodes(new Set(nextOrgUnitCodes));
                setUserPermissionOverrides(nextOverrides);
                setSavedUserPermissionOverrides({ ...nextOverrides });
                showSuccessNotification(`Acceso de "${response.user.name}" guardado y auditado.`);
                setIsSavePermissionsDialogOpen(false);
                return;
            }

            const response = await replaceIdentityRolePermissions(selectedRoleCode, {
                permissionCodes: getRolePermissionCodesForModules(permissionState, selectedRoleCode, visibleModules),
                reason,
            });

            setSavedPermissionState(permissionState);
            showSuccessNotification(`Permisos de "${response.role.name}" guardados y auditados.`);
            setIsSavePermissionsDialogOpen(false);
        } catch (error) {
            showErrorNotification(getErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const getGrantedPermissionCountForView = (view: PermissionViewSection): number => {
        const viewPermissionCodes = isUserMode ? getEffectiveUserPermissionCodes(permissionState, userRoleCodes, userPermissionOverrides, view.moduleCode) : (permissionState[selectedRoleCode]?.[view.moduleCode] ?? []);

        return isSystemRole ? view.permissions.length : view.permissions.filter((permission) => viewPermissionCodes.includes(permission.code)).length;
    };

    const catalogPermissionTotals = permissionViewSections.catalogViews.reduce(
        (totals, view) => ({
            granted: totals.granted + getGrantedPermissionCountForView(view),
            total: totals.total + view.permissions.length,
        }),
        { granted: 0, total: 0 },
    );
    const isSharedCatalogsOpen = openViewCodes.has(SHARED_CATALOGS_GROUP_CODE);
    const hasPermissionViews = permissionViewSections.moduleViews.length > 0 || permissionViewSections.catalogViews.length > 0;

    return (
        <ConfigProvider locale={esES} theme={ADMINISTRATION_THEME}>
            <div className="roles-security-page">
                {notificationContextHolder}
                <section className="roles-security-header" aria-labelledby="roles-security-title">
                    <div>
                        <span className="roles-security-breadcrumb">Administración / Roles y seguridad</span>
                        <h1 id="roles-security-title">Roles y seguridad</h1>
                        <p>Configura qué puede hacer cada rol por módulo, vista y acción.</p>
                    </div>
                </section>

                <section className="roles-security-workbench" aria-label="Gestor de permisos por rol">
                    <aside className="roles-security-sidebar" aria-labelledby="roles-security-roles-title">
                        <div className="roles-security-panel__header">
                            <h2 id="roles-security-roles-title">Roles</h2>
                        </div>
                        <div className="roles-security-list">
                            {roles.map((role) => (
                                <button
                                    className={`roles-security-list-item${!isUserMode && role.code === selectedRoleCode ? " roles-security-list-item--active" : ""}${isUserMode && userRoleCodes.has(role.code) ? " roles-security-list-item--checked" : ""}`}
                                    key={role.code}
                                    type="button"
                                    disabled={isAccessEditorBusy}
                                    onClick={() => {
                                        if (isAccessEditorBusy) {
                                            return;
                                        }

                                        if (isUserMode) {
                                            toggleUserRole(role.code);
                                        } else {
                                            setSelectedRoleCode(role.code);
                                        }
                                    }}
                                >
                                    <span>
                                        <strong>{role.name}</strong>
                                        <small>{role.users} usuarios</small>
                                    </span>
                                    {isUserMode ? <input checked={userRoleCodes.has(role.code)} disabled={isAccessEditorBusy} readOnly type="checkbox" /> : null}
                                </button>
                            ))}
                        </div>
                    </aside>

                    <main className={`roles-security-editor${isAccessEditorBusy ? " roles-security-editor--busy" : ""}`}>
                        <section className="roles-security-toolbar" aria-labelledby="roles-security-editor-title">
                            <div>
                                <h2 id="roles-security-editor-title">{selectedUser?.name ?? selectedRole.name}</h2>
                                {selectedUser ? <p className="roles-security-toolbar__subtext">{selectedUser.email}</p> : null}
                            </div>
                            <div className="roles-security-toolbar__actions">
                                <Select<string>
                                    className="roles-security-user-picker"
                                    aria-label="Empleado"
                                    allowClear
                                    placeholder="Ver por empleado"
                                    showSearch={{ filterOption: false, onSearch: setUserQuery }}
                                    value={selectedUserPublicId || null}
                                    options={users.map((user) => ({ label: user.name, value: user.publicId }))}
                                    onChange={(value: string | undefined) => {
                                        const nextUserPublicId = value ?? "";
                                        notificationApi.destroy();
                                        setIsLoadingUserAccess(Boolean(nextUserPublicId));
                                        resetUserAccessState();
                                        setSelectedUserPublicId(nextUserPublicId);

                                        if (!nextUserPublicId) {
                                            setIsLoadingUserAccess(false);
                                        }
                                    }}
                                />
                                {isUserMode ? null : (
                                    <button className="roles-security-secondary-action" type="button" aria-label="Renombrar rol" onClick={openRenameRoleDialog}>
                                        <EditOutlined />
                                        Renombrar
                                    </button>
                                )}
                                <button className={`roles-security-primary-action${dirtyCount > 0 ? " is-dirty" : ""}`} disabled={isLoadingUserAccess || dirtyCount === 0 || (isSystemRole && dirtyCount === 0)} type="button" aria-label={`Guardar cambios ${String(dirtyCount)}`} onClick={openSavePermissionsDialog}>
                                    <SaveOutlined />
                                    {dirtyCount > 0 ? `Guardar · ${String(dirtyCount)}` : "Guardar"}
                                </button>
                            </div>
                        </section>

                        {isAccessEditorBusy ? (
                            <div className="roles-security-loading-state" role="status" aria-live="polite">
                                <span className="roles-security-loading-state__spinner" aria-hidden="true" />
                                <strong>Cargando acceso del empleado…</strong>
                            </div>
                        ) : null}

                        {isUserMode ? (
                            <section className="roles-security-effective-summary" aria-label="Permisos efectivos del empleado">
                                <div className="roles-security-effective-summary__header">
                                    <strong>Resumen operativo antes de guardar</strong>
                                    <span>Separa rol, menú visible y permisos reales para evitar confusiones.</span>
                                </div>
                                <div className="roles-security-effective-summary__grid">
                                    <article>
                                        <small>Roles asignados</small>
                                        <strong>{selectedUserRoleNames.length > 0 ? selectedUserRoleNames.join(", ") : "Sin roles"}</strong>
                                    </article>
                                    <article>
                                        <small>Módulos habilitados en menú</small>
                                        <strong>{visibleUserModuleNames.length > 0 ? visibleUserModuleNames.join(", ") : "Sin módulos visibles"}</strong>
                                    </article>
                                    <article>
                                        <small>Permisos efectivos por módulo</small>
                                        <div className="roles-security-effective-summary__chips">
                                            {userTopModuleAccessSummaries.map((summary) => (
                                                <span className={summary.effectiveGranted === 0 ? "is-empty" : ""} key={summary.module.code}>
                                                    {summary.module.name} {summary.effectiveGranted}/{summary.total}
                                                </span>
                                            ))}
                                        </div>
                                    </article>
                                    <article>
                                        <small>Excepciones directas</small>
                                        <strong>{Object.keys(userPermissionOverrides).length}</strong>
                                    </article>
                                </div>
                            </section>
                        ) : null}

                        <section className="roles-security-module-groups" aria-label="Módulos del sistema">
                            <div className="roles-security-module-groups__header">
                                <strong>Módulos</strong>
                                <label className="roles-security-filter roles-security-filter--compact">
                                    <SearchOutlined />
                                    <input
                                        aria-label="Buscar módulo o vista"
                                        placeholder="Buscar módulo o vista"
                                        value={moduleQuery}
                                        onChange={(event) => {
                                            setModuleQuery(event.target.value);
                                        }}
                                    />
                                </label>
                            </div>
                            {moduleDisplayGroups.length > 0 ? (
                                moduleDisplayGroups.map((group) => {
                                    const isGroupExpanded = activeExpandedModuleGroupKey === group.key;
                                    const groupPanelId = `roles-security-module-group-${group.key}`;

                                    return (
                                        <div className={`roles-security-module-group${isGroupExpanded ? " roles-security-module-group--expanded" : ""}`} key={group.key}>
                                            <button
                                                className="roles-security-module-group__trigger"
                                                type="button"
                                                aria-controls={groupPanelId}
                                                aria-expanded={isGroupExpanded}
                                                onClick={() => {
                                                    setExpandedModuleGroupKey(activeExpandedModuleGroupKey === group.key ? null : group.key);
                                                }}
                                            >
                                                <span>
                                                    <strong>{group.title}</strong>
                                                    <small>{group.modules.length} módulos</small>
                                                </span>
                                                <DownOutlined aria-hidden="true" />
                                            </button>
                                            {isGroupExpanded ? (
                                                <div id={groupPanelId} className="roles-security-module-grid">
                                                    {/* eslint-disable-next-line complexity -- Cada tarjeta calcula estado rol/empleado para evitar duplicar el markup. */}
                                                    {group.modules.map((module) => {
                                                        const granted = permissionState[selectedRoleCode]?.[module.code]?.length ?? 0;
                                                        const total = getModulePermissionCodes(modules, module.code).length;
                                                        const userModuleSummary = userModuleAccessSummaryByCode.get(module.code);
                                                        const enabled = isUserMode ? Boolean(userModuleSummary?.isVisible) : granted > 0;
                                                        const visibleGranted = isUserMode ? (userModuleSummary?.effectiveGranted ?? 0) : granted;
                                                        const accessLabel = isUserMode && userModuleSummary ? getUserModuleAccessLabel(userModuleSummary) : "Permisos del rol";

                                                        return (
                                                            <button
                                                                className={`roles-security-module-card${module.code === activeModuleCode ? " roles-security-module-card--active" : ""}${enabled ? "" : " roles-security-module-card--off"}`}
                                                                key={module.code}
                                                                type="button"
                                                                disabled={isAccessEditorBusy}
                                                                onClick={() => {
                                                                    setSelectedModuleCode(module.code);
                                                                }}
                                                            >
                                                                <span>
                                                                    <input
                                                                        checked={enabled}
                                                                        disabled={isSystemRole || isAccessEditorBusy}
                                                                        type="checkbox"
                                                                        onChange={(event) => {
                                                                            event.stopPropagation();
                                                                            toggleModule(module.code);
                                                                        }}
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                        }}
                                                                    />
                                                                    <span>
                                                                        <strong>{module.name}</strong>
                                                                        {isUserMode ? <em className={visibleGranted === 0 && enabled ? "is-warning" : ""}>{accessLabel}</em> : null}
                                                                    </span>
                                                                </span>
                                                                <small>
                                                                    {visibleGranted}/{total}
                                                                </small>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="roles-security-empty-state">
                                    <strong>Sin módulos coincidentes</strong>
                                </div>
                            )}
                        </section>

                        <section className="roles-security-permissions" aria-labelledby="roles-security-permissions-title">
                            <div className="roles-security-permissions__header">
                                <h2 id="roles-security-permissions-title">{selectedModule.name}</h2>
                                <div className="roles-security-permissions__actions">
                                    <label className="roles-security-filter">
                                        <SearchOutlined />
                                        <input
                                            aria-label="Buscar permiso"
                                            placeholder="Buscar permiso"
                                            value={query}
                                            onChange={(event) => {
                                                setQuery(event.target.value);
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="roles-security-view-list">
                                {hasPermissionViews ? (
                                    <>
                                        {permissionViewSections.moduleViews.map((view) => {
                                            const isViewOpen = openViewCodes.has(view.code);
                                            const viewPermissionCodes = isUserMode ? getEffectiveUserPermissionCodes(permissionState, userRoleCodes, userPermissionOverrides, view.moduleCode) : (permissionState[selectedRoleCode]?.[view.moduleCode] ?? []);
                                            const grantedInView = getGrantedPermissionCountForView(view);
                                            const permissionListId = `roles-security-view-${activeModuleCode}-${view.moduleCode}-${view.code}`;

                                            return (
                                                <section className="roles-security-view-group" key={view.code} aria-label={view.name}>
                                                    <button
                                                        className="roles-security-view-group__trigger"
                                                        type="button"
                                                        aria-controls={permissionListId}
                                                        aria-expanded={isViewOpen}
                                                        onClick={() => {
                                                            toggleView(view.code);
                                                        }}
                                                    >
                                                        <strong>{view.name}</strong>
                                                        <span className="roles-security-view-group__meta">
                                                            {grantedInView}/{view.permissions.length}
                                                            <DownOutlined aria-hidden="true" />
                                                        </span>
                                                    </button>
                                                    {isViewOpen ? (
                                                        <div id={permissionListId} className="roles-security-permission-list">
                                                            {view.permissions.map((permission) => {
                                                                const enabled = isSystemRole || viewPermissionCodes.includes(permission.code);

                                                                return (
                                                                    <label className="roles-security-permission-row" key={permission.code} title={permission.description}>
                                                                        <strong>
                                                                            {permission.name}
                                                                            {permission.sensitive ? <em>Sensible</em> : null}
                                                                        </strong>
                                                                        <input
                                                                            checked={enabled}
                                                                            disabled={isSystemRole || isAccessEditorBusy}
                                                                            type="checkbox"
                                                                            onChange={() => {
                                                                                togglePermission(permission.code, view.moduleCode);
                                                                            }}
                                                                        />
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : null}
                                                </section>
                                            );
                                        })}
                                        {permissionViewSections.catalogViews.length > 0 ? (
                                            <section className="roles-security-view-group roles-security-view-group--shared-catalogs" aria-label="Catálogos compartidos">
                                                <button
                                                    className="roles-security-view-group__trigger"
                                                    type="button"
                                                    aria-controls={`roles-security-view-${activeModuleCode}-shared-catalogs`}
                                                    aria-expanded={isSharedCatalogsOpen}
                                                    onClick={() => {
                                                        toggleView(SHARED_CATALOGS_GROUP_CODE);
                                                    }}
                                                >
                                                    <span>
                                                        <strong>Catálogos compartidos</strong>
                                                        <small>Vistas reutilizables disponibles para este módulo</small>
                                                    </span>
                                                    <span className="roles-security-view-group__meta">
                                                        {catalogPermissionTotals.granted}/{catalogPermissionTotals.total}
                                                        <DownOutlined aria-hidden="true" />
                                                    </span>
                                                </button>
                                                {isSharedCatalogsOpen ? (
                                                    <div id={`roles-security-view-${activeModuleCode}-shared-catalogs`} className="roles-security-shared-catalogs">
                                                        {permissionViewSections.catalogViews.map((view) => {
                                                            const isViewOpen = openViewCodes.has(view.code);
                                                            const viewPermissionCodes = isUserMode ? getEffectiveUserPermissionCodes(permissionState, userRoleCodes, userPermissionOverrides, view.moduleCode) : (permissionState[selectedRoleCode]?.[view.moduleCode] ?? []);
                                                            const grantedInView = getGrantedPermissionCountForView(view);
                                                            const permissionListId = `roles-security-view-${activeModuleCode}-${view.moduleCode}-${view.code}`;

                                                            return (
                                                                <section className="roles-security-view-group" key={view.code} aria-label={view.name}>
                                                                    <button
                                                                        className="roles-security-view-group__trigger"
                                                                        type="button"
                                                                        aria-controls={permissionListId}
                                                                        aria-expanded={isViewOpen}
                                                                        onClick={() => {
                                                                            toggleView(view.code);
                                                                        }}
                                                                    >
                                                                        <strong>{view.name}</strong>
                                                                        <span className="roles-security-view-group__meta">
                                                                            {grantedInView}/{view.permissions.length}
                                                                            <DownOutlined aria-hidden="true" />
                                                                        </span>
                                                                    </button>
                                                                    {isViewOpen ? (
                                                                        <div id={permissionListId} className="roles-security-permission-list">
                                                                            {view.permissions.map((permission) => {
                                                                                const enabled = isSystemRole || viewPermissionCodes.includes(permission.code);

                                                                                return (
                                                                                    <label className="roles-security-permission-row" key={permission.code} title={permission.description}>
                                                                                        <strong>
                                                                                            {permission.name}
                                                                                            {permission.sensitive ? <em>Sensible</em> : null}
                                                                                        </strong>
                                                                                        <input
                                                                                            checked={enabled}
                                                                                            disabled={isSystemRole || isAccessEditorBusy}
                                                                                            type="checkbox"
                                                                                            onChange={() => {
                                                                                                togglePermission(permission.code, view.moduleCode);
                                                                                            }}
                                                                                        />
                                                                                    </label>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : null}
                                                                </section>
                                                            );
                                                        })}
                                                    </div>
                                                ) : null}
                                            </section>
                                        ) : null}
                                    </>
                                ) : (
                                    <div className="roles-security-empty-state">
                                        <strong>Sin acciones configuradas</strong>
                                    </div>
                                )}
                            </div>
                        </section>
                    </main>
                </section>

                <RoleSecurityDialogs
                    changes={dirtyCount}
                    isRenameRoleDialogOpen={isRenameRoleDialogOpen}
                    isSavePermissionsDialogOpen={isSavePermissionsDialogOpen}
                    isSubmitting={isSubmitting}
                    renameRoleForm={renameRoleForm}
                    roleName={selectedUser?.name ?? selectedRole.name}
                    savePermissionsForm={savePermissionsForm}
                    saveSummary={saveSummary}
                    setRenameRoleForm={setRenameRoleForm}
                    setSavePermissionsForm={setSavePermissionsForm}
                    onClose={closeDialog}
                    onRenameRole={() => {
                        void handleRenameRole();
                    }}
                    onSavePermissions={() => {
                        void handleSavePermissions();
                    }}
                />
            </div>
        </ConfigProvider>
    );
}

/** Elige el diálogo abierto. Solo uno puede estar visible: renombrar o guardar permisos. */
function RoleSecurityDialogs({ changes, isRenameRoleDialogOpen, isSavePermissionsDialogOpen, isSubmitting, onClose, onRenameRole, onSavePermissions, renameRoleForm, roleName, savePermissionsForm, saveSummary, setRenameRoleForm, setSavePermissionsForm }: RoleSecurityDialogsProps) {
    return (
        <>
            {isRenameRoleDialogOpen ? <RenameRoleDialog form={renameRoleForm} isSubmitting={isSubmitting} setForm={setRenameRoleForm} onClose={onClose} onSubmit={onRenameRole} /> : null}
            {isSavePermissionsDialogOpen ? <SavePermissionsDialog changes={changes} form={savePermissionsForm} isSubmitting={isSubmitting} roleName={roleName} saveSummary={saveSummary} setForm={setSavePermissionsForm} onClose={onClose} onSubmit={onSavePermissions} /> : null}
        </>
    );
}

/** Campos del renombre. El código del rol no se edita. */
interface RenameRoleDialogProps {
    readonly form: RenameRoleFormState;
    readonly isSubmitting: boolean;
    readonly onClose: () => void;
    readonly onSubmit: () => void;
    readonly setForm: Dispatch<SetStateAction<RenameRoleFormState>>;
}

/** Pide el nombre nuevo y un motivo antes de llamar al API. */
function RenameRoleDialog({ form, isSubmitting, onClose, onSubmit, setForm }: RenameRoleDialogProps) {
    return (
        <div className="roles-security-modal-backdrop" role="presentation" onMouseDown={onClose}>
            <section
                className="roles-security-modal roles-security-modal--compact"
                aria-labelledby="roles-security-rename-dialog-title"
                aria-modal="true"
                role="dialog"
                onMouseDown={(event) => {
                    event.stopPropagation();
                }}
            >
                <header>
                    <div>
                        <h2 id="roles-security-rename-dialog-title">Renombrar rol</h2>
                        <p>El código estable no cambia; solo cambia el nombre visible.</p>
                    </div>
                    <button className="roles-security-icon-action" type="button" aria-label="Cerrar" onClick={onClose}>
                        <CloseOutlined />
                    </button>
                </header>
                <div className="roles-security-form-grid">
                    <label className="roles-security-form-grid__full">
                        Nombre visible *
                        <input
                            value={form.name}
                            onChange={(event) => {
                                setForm((current) => ({ ...current, name: event.target.value }));
                            }}
                        />
                    </label>
                    <label className="roles-security-form-grid__full">
                        Motivo de auditoría *
                        <textarea
                            placeholder="Ej. Ajuste aprobado por TI."
                            value={form.reason}
                            onChange={(event) => {
                                setForm((current) => ({ ...current, reason: event.target.value }));
                            }}
                        />
                    </label>
                </div>
                <footer>
                    <button className="roles-security-secondary-action" disabled={isSubmitting} type="button" onClick={onClose}>
                        Cancelar
                    </button>
                    <button className="roles-security-primary-action" disabled={isSubmitting} type="button" onClick={onSubmit}>
                        <SaveOutlined />
                        {isSubmitting ? "Guardando..." : "Guardar nombre"}
                    </button>
                </footer>
            </section>
        </div>
    );
}

/** Confirmación del guardado: resumen de cambios y motivo auditable. */
interface SavePermissionsDialogProps {
    readonly changes: number;
    readonly form: SavePermissionsFormState;
    readonly isSubmitting: boolean;
    readonly onClose: () => void;
    readonly onSubmit: () => void;
    readonly roleName: string;
    readonly saveSummary: readonly string[];
    readonly setForm: Dispatch<SetStateAction<SavePermissionsFormState>>;
}

/** Muestra qué va a quedar guardado y no envía hasta que el motivo sea válido. */
function SavePermissionsDialog({ changes, form, isSubmitting, onClose, onSubmit, roleName, saveSummary, setForm }: SavePermissionsDialogProps) {
    return (
        <div className="roles-security-modal-backdrop" role="presentation" onMouseDown={onClose}>
            <section
                className="roles-security-modal roles-security-modal--compact"
                aria-labelledby="roles-security-save-permissions-dialog-title"
                aria-modal="true"
                role="dialog"
                onMouseDown={(event) => {
                    event.stopPropagation();
                }}
            >
                <header>
                    <div>
                        <h2 id="roles-security-save-permissions-dialog-title">Guardar permisos</h2>
                        <p>
                            Se guardarán {changes} cambio(s) para el rol {roleName}.
                        </p>
                    </div>
                    <button className="roles-security-icon-action" type="button" aria-label="Cerrar" onClick={onClose}>
                        <CloseOutlined />
                    </button>
                </header>
                <div className="roles-security-form-grid">
                    <div className="roles-security-save-summary roles-security-form-grid__full">
                        <strong>Resumen efectivo</strong>
                        <ul>
                            {saveSummary.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                    <label className="roles-security-form-grid__full">
                        Motivo de auditoría *
                        <textarea
                            placeholder="Ej. Ajuste aprobado por jefatura de ventas."
                            value={form.reason}
                            onChange={(event) => {
                                setForm((current) => ({ ...current, reason: event.target.value }));
                            }}
                        />
                    </label>
                </div>
                <footer>
                    <button className="roles-security-secondary-action" disabled={isSubmitting} type="button" onClick={onClose}>
                        Cancelar
                    </button>
                    <button className="roles-security-primary-action is-dirty" disabled={isSubmitting} type="button" onClick={onSubmit}>
                        <SaveOutlined />
                        {isSubmitting ? "Guardando..." : "Guardar permisos"}
                    </button>
                </footer>
            </section>
        </div>
    );
}
