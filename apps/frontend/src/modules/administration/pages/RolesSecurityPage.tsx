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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getIdentityProfile, getIdentitySecurityCatalog, getIdentityUserAccess, getSystemUsers, replaceIdentityRolePermissions, replaceIdentityUserAccess, updateIdentityRole } from "../../../services/auth/auth-service";
import type { IdentityProfile, IdentitySecurityCatalog, IdentityUserPermissionOverride, SystemUserDirectoryItem } from "../../../services/auth/identity-contracts";
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

const formatCount = (count: number, singular: string, plural: string): string => `${String(count)} ${count === 1 ? singular : plural}`;

/** Texto del fallo. Un valor que no sea `Error` no muestra el objeto crudo. */
const getErrorMessage = (error: unknown): string => {
    if (error instanceof TypeError && ["Failed to fetch", "NetworkError when attempting to fetch resource.", "Load failed"].includes(error.message)) return "No pudimos conectar con el servidor. Si estabas guardando, el resultado no está confirmado; verifica los permisos antes de volver a intentar.";
    return error instanceof Error ? error.message : "No se pudo completar la acción.";
};

/** Only the effective API grant authorizes editing; an explicit deny always wins. */
const hasEffectivePermission = (profile: IdentityProfile, code: string): boolean => profile.permissions.some((permission) => permission.code === code && permission.effect === "allow") && !profile.permissions.some((permission) => permission.code === code && permission.effect === "deny");

const getRole = (roles: readonly RoleCatalogItem[], code: string): RoleCatalogItem => {
    const role = roles.find((item) => item.code === code) ?? roles[0];
    if (!role) throw new Error("No hay roles disponibles.");
    return role;
};

type RolesLoadState = { status: "loading" } | { status: "error"; message: string } | { status: "empty" } | { status: "ready"; catalog: IdentitySecurityCatalog; canListUsers: boolean };

/** Fail closed before mounting the editor and after any failed permission revalidation. */
export function RolesSecurityPage() {
    const [state, setState] = useState<RolesLoadState>({ status: "loading" });
    const mounted = useRef(false);
    const authorizationRequest = useRef(0);
    const [isRevalidating, setIsRevalidating] = useState(false);
    useEffect(() => {
        let live = true;
        const isCurrent = () => live;
        mounted.current = true;
        async function load() {
            try {
                const profile = await getIdentityProfile();
                if (!isCurrent()) return;
                if (!hasEffectivePermission(profile, "role.assign")) {
                    setState({ status: "error", message: "Permiso insuficiente para administrar roles." });
                    return;
                }
                const catalog = await getIdentitySecurityCatalog();
                if (!isCurrent()) return;
                setState(catalog.roles.length > 0 && catalog.modules.length > 0 ? { status: "ready", catalog, canListUsers: hasEffectivePermission(profile, "user.view_list") } : { status: "empty" });
            } catch (error) {
                if (isCurrent()) setState({ status: "error", message: getErrorMessage(error) });
            }
        }
        void load();
        return () => {
            live = false;
            mounted.current = false;
        };
    }, []);
    const revalidate = useCallback(async (requireUserList = false): Promise<boolean> => {
        const request = ++authorizationRequest.current;
        const isCurrent = () => mounted.current && request === authorizationRequest.current;
        setIsRevalidating(true);
        try {
            const profile = await getIdentityProfile();
            if (!isCurrent()) return false;
            if (!hasEffectivePermission(profile, "role.assign")) throw new Error("Permiso insuficiente para administrar roles.");
            const canListUsers = hasEffectivePermission(profile, "user.view_list");
            setState((current) => (current.status === "ready" ? { ...current, canListUsers } : current));
            return !requireUserList || canListUsers;
        } catch (error) {
            if (isCurrent()) setState({ status: "error", message: getErrorMessage(error) });
        } finally {
            if (isCurrent()) setIsRevalidating(false);
        }
        return false;
    }, []);
    useEffect(() => {
        if (state.status !== "ready") return;
        const onFocus = () => {
            void revalidate();
        };
        window.addEventListener("focus", onFocus);
        return () => {
            window.removeEventListener("focus", onFocus);
        };
    }, [revalidate, state.status]);
    if (state.status === "ready") return <RolesSecurityEditor key={String(state.canListUsers)} catalog={state.catalog} canListUsers={state.canListUsers} isRevalidating={isRevalidating} revalidate={revalidate} />;
    return (
        <div className="roles-security-page">
            <h1>Roles y seguridad</h1>
            {state.status === "loading" ? <p role="status">Cargando roles y permisos...</p> : <p role="alert">{state.status === "error" ? state.message : "Sin catálogo de roles y permisos disponible."}</p>}
        </div>
    );
}

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
function RolesSecurityEditor({ catalog, canListUsers, isRevalidating, revalidate }: { readonly catalog: IdentitySecurityCatalog; readonly canListUsers: boolean; readonly isRevalidating: boolean; readonly revalidate: (requireUserList?: boolean) => Promise<boolean> }) {
    const [roles, setRoles] = useState<readonly RoleCatalogItem[]>(() => catalog.roles.map((role) => ({ code: role.code, locked: role.locked, name: role.name, users: role.users })));
    const modules = useMemo(() => sortModulesForDisplay(catalog.modules), [catalog]);
    const initialPermissions = useMemo(() => Object.fromEntries(catalog.roles.map((role) => [role.code, groupPermissionCodesByModule(modules, catalog.rolePermissions[role.code] ?? [])])), [catalog, modules]);
    const [mode, setMode] = useState<AccessMode>("role");
    const [selectedRoleCode, setSelectedRoleCode] = useState(() => getRole(roles, "ventas").code);
    const [selectedModuleKey, setSelectedModuleKey] = useState("");
    const [selectedSectionKey, setSelectedSectionKey] = useState("");
    const [selectedViewKey, setSelectedViewKey] = useState("");
    const [permissionState, setPermissionState] = useState<RolePermissionState>(initialPermissions);
    const [savedPermissionState, setSavedPermissionState] = useState<RolePermissionState>(initialPermissions);
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
    const [loadedUserPublicId, setLoadedUserPublicId] = useState("");
    const [userAccessError, setUserAccessError] = useState("");
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
    const isAccessEditorBusy = isLoadingUserAccess || isSubmitting || isRevalidating || Boolean(selectedUserPublicId && loadedUserPublicId !== selectedUserPublicId);
    const isRoleEditBlocked = isAccessEditorBusy || isSystemRole;
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

    const resetUserAccessState = () => {
        setUserRoleCodes(new Set());
        setSavedUserRoleCodes(new Set());
        setUserOrgUnitCodes(new Set());
        setSavedUserOrgUnitCodes(new Set());
        setUserPermissionOverrides({});
        setSavedUserPermissionOverrides({});
    };

    useEffect(() => {
        if (mode !== "user" || !canListUsers) return;
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
    }, [canListUsers, mode, showErrorNotification, userQuery]);

    useEffect(() => {
        if (!selectedUserPublicId || !canListUsers) {
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
                setLoadedUserPublicId(selectedUserPublicId);
                setUserAccessError("");
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setUserAccessError(getErrorMessage(error));
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
    }, [canListUsers, selectedUserPublicId]);

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
        if (isRoleEditBlocked) {
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
        if (isAccessEditorBusy) return;
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
        setLoadedUserPublicId("");
        setUserAccessError("");
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
        if (isRoleEditBlocked) return;
        if (isUserMode) {
            showWarningNotification("Quita el empleado seleccionado para renombrar roles base.");
            return;
        }

        notificationApi.destroy();
        setRenameRoleForm({ name: selectedRole.name, reason: "" });
        setIsRenameRoleDialogOpen(true);
    };

    const openSavePermissionsDialog = () => {
        if (isRoleEditBlocked) return;
        if (dirtyCount === 0) {
            showWarningNotification("No hay cambios de permisos para guardar.");
            return;
        }

        notificationApi.destroy();
        setSavePermissionsForm(EMPTY_SAVE_PERMISSIONS_FORM);
        setIsSavePermissionsDialogOpen(true);
    };

    const handleRenameRole = async () => {
        if (isRoleEditBlocked || isUserMode) return;
        const name = renameRoleForm.name.trim();
        const reason = renameRoleForm.reason.trim();

        if (name.length < 2 || !hasValidAuditReason(reason)) {
            showWarningNotification("Completa el nuevo nombre y un motivo auditable de al menos dos palabras.");
            return;
        }

        setIsSubmitting(true);

        try {
            if (!(await revalidate())) return;
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
        if (isRoleEditBlocked) return;
        const reason = savePermissionsForm.reason.trim();

        if (!hasValidAuditReason(reason)) {
            showWarningNotification("Escribe un motivo auditable de al menos dos palabras para guardar los permisos.");
            return;
        }

        setIsSubmitting(true);

        try {
            if (!(await revalidate(isUserMode))) return;
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
                            <span className="roles-security-total">{formatCount(roles.length, "rol", "roles")}</span>
                        </div>
                        <p>Configura qué puede hacer cada rol por módulo, vista y acción.</p>
                    </div>
                </section>

                <section className="roles-security-context" aria-label="Contexto de permisos">
                    <div className="roles-security-context__row">
                        <div className="roles-security-context__selectors">
                            <Segmented<AccessMode> disabled={isSubmitting || isRevalidating} className="roles-security-mode" aria-label="Modo de revisión" options={canListUsers ? [...ACCESS_MODE_OPTIONS] : [ACCESS_MODE_OPTIONS[0]]} value={mode} onChange={changeMode} />
                            {mode === "role" ? (
                                <Select<string>
                                    className="roles-security-context__select"
                                    aria-label="Rol"
                                    disabled={isAccessEditorBusy}
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
                                    disabled={isSubmitting || isRevalidating}
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
                                <button className="roles-security-secondary-action" disabled={isAccessEditorBusy || isSystemRole} type="button" aria-label="Renombrar rol" onClick={openRenameRoleDialog}>
                                    <EditOutlined />
                                    Renombrar
                                </button>
                            )}
                            <button className={`roles-security-primary-action${dirtyCount > 0 ? " is-dirty" : ""}`} disabled={isAccessEditorBusy || isSystemRole || dirtyCount === 0} type="button" aria-label={`Guardar cambios ${String(dirtyCount)}`} onClick={openSavePermissionsDialog}>
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
                                        if (isAccessEditorBusy) return;
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
                    {userAccessError ? <p role="alert">{userAccessError}</p> : null}
                    {isLoadingUserAccess ? (
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
                    {!isAwaitingEmployee && !userAccessError && activeModule && activeSection && activeView ? (
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
