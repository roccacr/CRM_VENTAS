/**
 * Consola de roles, módulos y permisos.
 *
 * Permite revisar un rol o un empleado y proponer cambios. Guardar exige un
 * motivo auditable. Los permisos efectivos los calcula el API; lo que se ve
 * aquí es el catálogo persistido más las excepciones que el usuario está editando.
 * La navegación es focalizada: contexto (rol o empleado) → módulo → sección.
 */
import "./RolesSecurityPage.css";

import CloseOutlined from "@ant-design/icons/CloseOutlined";
import EditOutlined from "@ant-design/icons/EditOutlined";
import SafetyCertificateOutlined from "@ant-design/icons/SafetyCertificateOutlined";
import SaveOutlined from "@ant-design/icons/SaveOutlined";
import { notification } from "antd";
import ConfigProvider from "antd/es/config-provider";
import esES from "antd/es/locale/es_ES";
import Segmented from "antd/es/segmented";
import Select from "antd/es/select";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getIdentitySecurityCatalog, getIdentityUserAccess, getSystemUsers, replaceIdentityRolePermissions, replaceIdentityUserAccess, updateIdentityRole } from "../../../services/auth/auth-service";
import type { IdentityUserPermissionOverride, SystemUserDirectoryItem } from "../../../services/auth/identity-contracts";
import { PROJECTS_THEME } from "../catalogs/projects-theme";
import { type PermissionCoverage, RolePermissionSection, RolesSecurityNavigator } from "./RolePermissionSection";
import { applyUserViewPermissions, buildDisplayModules, findByKeyOrFirst, getUserPermissionOrigin, isCatalogModuleCode, type ModuleCatalogItem, type PermissionDisplayModule, type PermissionOverrideState, type PermissionSection, type PermissionSectionView, replaceViewPermissionCodes } from "./roles-security-sections";

interface RoleCatalogItem {
    readonly code: string;
    readonly locked: boolean;
    readonly name: string;
    readonly users: number;
}

type PermissionCode = string;
type RolePermissionState = Record<string, Record<string, readonly PermissionCode[]>>;
type AccessMode = "role" | "user";

interface RenameRoleFormState {
    readonly name: string;
    readonly reason: string;
}

interface SavePermissionsFormState {
    readonly reason: string;
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

const ACCESS_MODE_OPTIONS = [
    { label: "Por rol", value: "role" },
    { label: "Por empleado", value: "user" },
] as const satisfies readonly { readonly label: string; readonly value: AccessMode }[];

/** El motivo de un cambio de rol exige al menos dos palabras para que la auditoría diga algo. */
const AUDIT_REASON_MIN_WORDS = 2;
/** Rol con alcance de empresa. Sus módulos de administración no se ofrecen al resto. */
const OWNER_ROLE_CODE = "owner";
const ADMINISTRATION_MODULE_CODES = ["administration", "role", "user"] as const;
const MODULE_DISPLAY_ORDER = ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration", "user", "role"] as const;

/** Módulos de estructura. Fuera del contexto Owner no se muestran como áreas asignables. */
const isAdministrationModuleCode = (moduleCode: string): boolean => ADMINISTRATION_MODULE_CODES.includes(moduleCode as (typeof ADMINISTRATION_MODULE_CODES)[number]);

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

/** Rol de respaldo para no dejar la consola sin selección si el código ya no existe. */
const FALLBACK_ROLE = INITIAL_ROLES[0] as RoleCatalogItem;

const getRole = (roles: readonly RoleCatalogItem[], code: string): RoleCatalogItem => roles.find((role) => role.code === code) ?? FALLBACK_ROLE;

const formatCount = (count: number, singular: string, plural: string): string => `${String(count)} ${count === 1 ? singular : plural}`;

/** Texto del fallo. Un valor que no sea `Error` no muestra el objeto crudo. */
const getErrorMessage = (error: unknown): string => {
    if (error instanceof TypeError && ["Failed to fetch", "NetworkError when attempting to fetch resource.", "Load failed"].includes(error.message)) return "No pudimos conectar con el servidor. Si estabas guardando, el resultado no está confirmado; verifica los permisos antes de volver a intentar.";
    return error instanceof Error ? error.message : "No se pudo completar la acción.";
};

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

/** Nombre del empleado con sus roles, para distinguir homónimos en el selector. */
const formatUserOption = (user: SystemUserDirectoryItem): string => `${user.name} (${user.roles.length > 0 ? user.roles.map((role) => role.name).join(", ") : "Sin rol"})`;

/**
 * Módulo de menú al que pertenece la sección. Dentro de Administración cada
 * sección es un módulo propio del API (Usuarios, Roles y seguridad).
 */
const getMenuModuleName = (modules: readonly ModuleCatalogItem[], displayModule: PermissionDisplayModule, section: PermissionSection): string => {
    if (displayModule.key === section.moduleCode) {
        return displayModule.name;
    }

    return modules.find((module) => module.code === section.moduleCode)?.name ?? section.name;
};

/** Suma de permisos concedidos y totales de un grupo de vistas. */
const sumCoverage = (views: readonly PermissionSectionView[], getGrantedCodes: (view: PermissionSectionView) => ReadonlySet<string>): PermissionCoverage =>
    views.reduce<PermissionCoverage>(
        (coverage, view) => {
            const granted = getGrantedCodes(view);

            return { granted: coverage.granted + view.permissions.filter((permission) => granted.has(permission.code)).length, total: coverage.total + view.permissions.length };
        },
        { granted: 0, total: 0 },
    );

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
 * Consola visual para gestionar permisos desde el rol o el empleado hacia módulo, sección y acción.
 */
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Pantalla operativa con modo rol y modo empleado; separar ahora seria un refactor mayor.
export function RolesSecurityPage() {
    const [roles, setRoles] = useState<readonly RoleCatalogItem[]>(INITIAL_ROLES);
    const [isCatalogLoaded, setIsCatalogLoaded] = useState(false);
    const [modules, setModules] = useState<readonly ModuleCatalogItem[]>(INITIAL_MODULES);
    const [mode, setMode] = useState<AccessMode>("role");
    const [selectedRoleCode, setSelectedRoleCode] = useState("ventas");
    const [selectedModuleKey, setSelectedModuleKey] = useState("");
    const [selectedSectionKey, setSelectedSectionKey] = useState("");
    const [selectedViewKey, setSelectedViewKey] = useState("");
    const [permissionState, setPermissionState] = useState<RolePermissionState>(DEFAULT_ROLE_PERMISSIONS);
    const [savedPermissionState, setSavedPermissionState] = useState<RolePermissionState>(DEFAULT_ROLE_PERMISSIONS);
    const [isRenameRoleDialogOpen, setIsRenameRoleDialogOpen] = useState(false);
    const [isSavePermissionsDialogOpen, setIsSavePermissionsDialogOpen] = useState(false);
    const [renameRoleForm, setRenameRoleForm] = useState<RenameRoleFormState>(EMPTY_RENAME_ROLE_FORM);
    const [savePermissionsForm, setSavePermissionsForm] = useState<SavePermissionsFormState>(EMPTY_SAVE_PERMISSIONS_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notificationApi, notificationContextHolder] = notification.useNotification();
    const [users, setUsers] = useState<readonly SystemUserDirectoryItem[]>([]);
    const [userQuery, setUserQuery] = useState("");
    // Se guarda el empleado elegido, no solo su id: la búsqueda puede sacarlo de la lista visible.
    const [selectedUser, setSelectedUser] = useState<SystemUserDirectoryItem | null>(null);
    const [isLoadingUserAccess, setIsLoadingUserAccess] = useState(false);
    const [userRoleCodes, setUserRoleCodes] = useState<ReadonlySet<string>>(new Set());
    const [savedUserRoleCodes, setSavedUserRoleCodes] = useState<ReadonlySet<string>>(new Set());
    const [userOrgUnitCodes, setUserOrgUnitCodes] = useState<ReadonlySet<string>>(new Set());
    const [savedUserOrgUnitCodes, setSavedUserOrgUnitCodes] = useState<ReadonlySet<string>>(new Set());
    const [userPermissionOverrides, setUserPermissionOverrides] = useState<PermissionOverrideState>({});
    const [savedUserPermissionOverrides, setSavedUserPermissionOverrides] = useState<PermissionOverrideState>({});

    const selectedUserPublicId = selectedUser?.publicId ?? "";
    const selectedRole = getRole(roles, selectedRoleCode);
    const isUserMode = Boolean(selectedUser);
    const isOwnerContext = isUserMode ? userRoleCodes.has(OWNER_ROLE_CODE) : selectedRoleCode === OWNER_ROLE_CODE;
    const visibleModules = useMemo(() => getVisibleModulesForContext(modules, isOwnerContext), [isOwnerContext, modules]);
    const displayModules = useMemo(() => buildDisplayModules(visibleModules), [visibleModules]);
    const activeModule = findByKeyOrFirst(displayModules, selectedModuleKey);
    const activeSection = activeModule ? findByKeyOrFirst(activeModule.sections, selectedSectionKey) : undefined;
    const activeView = activeSection ? findByKeyOrFirst(activeSection.views, selectedViewKey) : undefined;
    const isSystemRole = !isUserMode && selectedRole.locked;
    const hasProtectedRole = mode === "user" ? isUserMode && roles.some((role) => role.locked && userRoleCodes.has(role.code)) : selectedRole.locked;
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
    const dirtyCount = mode === "user" ? userDirtyCount : roleDirtyCount;
    const visibleUserModuleCount = visibleModules.filter((module) => userOrgUnitCodes.has(module.code)).length;
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
                title: "Cambio guardado",
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
                title: "Revisión requerida",
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
                title: "No se pudo completar la acción",
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
                setIsCatalogLoaded(true);
                setPermissionState(nextPermissionState);
                setSavedPermissionState(nextPermissionState);
                setSelectedRoleCode((current) => (nextRoles.some((role) => role.code === current) ? current : (nextRoles[0]?.code ?? "owner")));
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

    /** Permisos concedidos en el módulo de la vista. Un rol protegido se muestra con todo concedido. */
    const getGrantedCodes = (view: PermissionSectionView): ReadonlySet<string> => {
        if (isSystemRole) {
            return new Set(view.permissions.map((permission) => permission.code));
        }

        return new Set(isUserMode ? getEffectiveUserPermissionCodes(permissionState, userRoleCodes, userPermissionOverrides, view.moduleCode) : (permissionState[selectedRoleCode]?.[view.moduleCode] ?? []));
    };

    const getUserBaseCodes = (moduleCode: string): ReadonlySet<string> => new Set(getUserBasePermissionCodes(permissionState, userRoleCodes, moduleCode));

    /** Fija qué acciones de la vista quedan activas: matriz del rol o excepciones del empleado. */
    const setViewPermissions = (view: PermissionSectionView, enabledCodes: ReadonlySet<string>) => {
        if (isSystemRole || isAccessEditorBusy) {
            return;
        }

        if (isUserMode) {
            const baseCodes = getUserBaseCodes(view.moduleCode);
            setUserPermissionOverrides((current) => applyUserViewPermissions(current, view, enabledCodes, baseCodes));
            return;
        }

        setPermissionState((current) => {
            const modulesByRole = current[selectedRoleCode] ?? {};

            return {
                ...current,
                [selectedRoleCode]: {
                    ...modulesByRole,
                    [view.moduleCode]: replaceViewPermissionCodes(modulesByRole[view.moduleCode] ?? [], view, enabledCodes),
                },
            };
        });
    };

    /** Visibilidad del módulo en el menú del empleado. Ocultarlo niega lo que sus roles concedían. */
    const toggleUserModuleVisibility = (moduleCode: string) => {
        const enabled = userOrgUnitCodes.has(moduleCode);
        const modulePermissionCodes = getModulePermissionCodes(modules, moduleCode);
        const basePermissions = getUserBaseCodes(moduleCode);

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
    };

    const selectUser = (user: SystemUserDirectoryItem | null) => {
        notificationApi.destroy();
        setIsLoadingUserAccess(Boolean(user));
        resetUserAccessState();
        setSelectedUser(user);
    };

    const changeMode = (nextMode: AccessMode) => {
        setMode(nextMode);

        if (nextMode === "role") {
            selectUser(null);
        }
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

    const getSectionCoverage = (section: PermissionSection): PermissionCoverage => sumCoverage(section.views, getGrantedCodes);
    const getModuleCoverage = (module: PermissionDisplayModule): PermissionCoverage =>
        sumCoverage(
            module.sections.flatMap((section) => section.views),
            getGrantedCodes,
        );
    const sectionModuleName = activeModule && activeSection ? getMenuModuleName(modules, activeModule, activeSection) : "";
    const isAwaitingEmployee = mode === "user" && !selectedUser;

    return (
        <ConfigProvider locale={esES} theme={PROJECTS_THEME}>
            <div className="roles-security-page">
                {notificationContextHolder}
                <section className="roles-security-header" aria-labelledby="roles-security-title">
                    <div>
                        <nav className="roles-security-breadcrumb" aria-label="Ruta">
                            <span>Administración</span>
                            <span aria-hidden="true">/</span>
                            <span>Roles y seguridad</span>
                        </nav>
                        <div className="roles-security-title-row">
                            <h1 id="roles-security-title">Roles y seguridad</h1>
                            {/* Hasta que responde el API los roles son el respaldo local; contarlos mentiría. */}
                            {isCatalogLoaded ? <span className="roles-security-total">{formatCount(roles.length, "rol", "roles")}</span> : null}
                        </div>
                        <p>Configura qué puede hacer cada rol por módulo, vista y acción.</p>
                    </div>
                </section>

                <section className="roles-security-context" aria-label="Contexto de permisos">
                    <div className="roles-security-context__row">
                        <div className="roles-security-context__selectors">
                            <Segmented<AccessMode> className="roles-security-mode" aria-label="Modo de revisión" options={[...ACCESS_MODE_OPTIONS]} value={mode} onChange={changeMode} />
                            {mode === "role" ? (
                                <Select<string>
                                    className="roles-security-context__select"
                                    aria-label="Rol"
                                    value={selectedRoleCode}
                                    options={roles.map((role) => ({ label: `${role.name} (${formatCount(role.users, "usuario", "usuarios")})`, value: role.code }))}
                                    onChange={(value) => {
                                        notificationApi.destroy();
                                        setSelectedRoleCode(value);
                                    }}
                                />
                            ) : (
                                <Select<string>
                                    className="roles-security-context__select roles-security-user-picker"
                                    aria-label="Empleado"
                                    allowClear
                                    placeholder="Buscar empleado"
                                    showSearch={{ filterOption: false, onSearch: setUserQuery }}
                                    value={selectedUserPublicId || null}
                                    options={(selectedUser && !users.some((user) => user.publicId === selectedUser.publicId) ? [selectedUser, ...users] : users).map((user) => ({ label: formatUserOption(user), value: user.publicId }))}
                                    onChange={(value: string | undefined) => {
                                        selectUser(users.find((user) => user.publicId === value) ?? null);
                                    }}
                                />
                            )}
                        </div>
                        <div className="roles-security-toolbar__actions">
                            {mode === "user" ? null : (
                                <button className="roles-security-secondary-action" type="button" aria-label="Renombrar rol" onClick={openRenameRoleDialog}>
                                    <EditOutlined />
                                    Renombrar
                                </button>
                            )}
                            <button className={`roles-security-primary-action${dirtyCount > 0 ? " is-dirty" : ""}`} disabled={isLoadingUserAccess || dirtyCount === 0} type="button" aria-label={`Guardar cambios ${String(dirtyCount)}`} onClick={openSavePermissionsDialog}>
                                <SaveOutlined />
                                {dirtyCount > 0 ? `Guardar cambios · ${String(dirtyCount)}` : "Guardar cambios"}
                            </button>
                        </div>
                    </div>
                    {hasProtectedRole ? (
                        <p className="roles-security-protected" role="note">
                            <SafetyCertificateOutlined aria-hidden="true" />
                            <strong>Rol protegido</strong>
                            <span>Control máximo del CRM. Uso limitado a muy pocas personas.</span>
                        </p>
                    ) : null}
                    {selectedUser ? (
                        <div className="roles-security-employee">
                            <div className="roles-security-field">
                                <span className="roles-security-field__label">Roles asignados</span>
                                <Select<string[]>
                                    mode="multiple"
                                    aria-label="Roles asignados"
                                    disabled={isAccessEditorBusy}
                                    placeholder="Sin roles"
                                    value={[...userRoleCodes]}
                                    options={roles.map((role) => ({ label: role.name, value: role.code }))}
                                    onChange={(codes) => {
                                        setUserRoleCodes(new Set(codes));
                                    }}
                                />
                            </div>
                            <dl className="roles-security-employee__facts" aria-label="Permisos efectivos del empleado">
                                <div>
                                    <dt>Correo</dt>
                                    <dd>{selectedUser.email}</dd>
                                </div>
                                <div>
                                    <dt>Visible en el menú</dt>
                                    <dd>
                                        {visibleUserModuleCount} de {visibleModules.length} módulos
                                    </dd>
                                </div>
                                <div>
                                    <dt>Excepciones directas</dt>
                                    <dd>{Object.keys(userPermissionOverrides).length}</dd>
                                </div>
                            </dl>
                        </div>
                    ) : null}
                </section>

                <main className={`roles-security-editor${isAccessEditorBusy ? " roles-security-editor--busy" : ""}`} aria-label="Permisos por sección">
                    {isAccessEditorBusy ? (
                        <div className="roles-security-loading-state" role="status" aria-live="polite">
                            <span className="roles-security-loading-state__spinner" aria-hidden="true" />
                            <strong>Cargando acceso del empleado…</strong>
                        </div>
                    ) : null}
                    {isAwaitingEmployee ? (
                        <div className="roles-security-empty-state">
                            <strong>Selecciona un empleado</strong>
                            <span>Busca a la persona para revisar sus roles, el menú visible y sus excepciones directas.</span>
                        </div>
                    ) : null}
                    {!isAwaitingEmployee && activeModule && activeSection && activeView ? (
                        <>
                            <RolesSecurityNavigator
                                activeModule={activeModule}
                                activeSection={activeSection}
                                disabled={isAccessEditorBusy}
                                getModuleCoverage={getModuleCoverage}
                                getSectionCoverage={getSectionCoverage}
                                modules={displayModules}
                                onModuleChange={(key) => {
                                    setSelectedModuleKey(key);
                                    setSelectedSectionKey("");
                                    setSelectedViewKey("");
                                }}
                                onSectionChange={(key) => {
                                    setSelectedSectionKey(key);
                                    setSelectedViewKey("");
                                }}
                            />
                            <RolePermissionSection
                                activeView={activeView}
                                getGrantedCodes={getGrantedCodes}
                                getOrigin={isUserMode ? (code) => getUserPermissionOrigin(code, userPermissionOverrides, getUserBaseCodes(activeView.moduleCode)) : undefined}
                                isBusy={isAccessEditorBusy}
                                isLocked={isSystemRole}
                                menuVisibility={
                                    isUserMode
                                        ? {
                                              checked: userOrgUnitCodes.has(activeSection.moduleCode),
                                              moduleName: sectionModuleName,
                                              onToggle: () => {
                                                  toggleUserModuleVisibility(activeSection.moduleCode);
                                              },
                                          }
                                        : undefined
                                }
                                moduleName={activeModule.name}
                                section={activeSection}
                                onSelectView={setSelectedViewKey}
                                onSetViewPermissions={setViewPermissions}
                            />
                        </>
                    ) : null}
                    {!isAwaitingEmployee && !activeSection ? (
                        <div className="roles-security-empty-state">
                            <strong>Sin secciones disponibles</strong>
                            <span>El catálogo de permisos no expone módulos para este contexto.</span>
                        </div>
                    ) : null}
                </main>

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
