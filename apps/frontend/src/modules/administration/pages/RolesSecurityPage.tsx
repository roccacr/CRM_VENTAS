import "./RolesSecurityPage.css";

import CloseOutlined from "@ant-design/icons/CloseOutlined";
import DownOutlined from "@ant-design/icons/DownOutlined";
import EditOutlined from "@ant-design/icons/EditOutlined";
import SaveOutlined from "@ant-design/icons/SaveOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import { notification } from "antd";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getIdentitySecurityCatalog, getIdentityUserAccess, getSystemUsers, replaceIdentityRolePermissions, replaceIdentityUserAccess, updateIdentityRole } from "../../../services/auth/auth-service";
import type { IdentityUserPermissionOverride, SystemUserDirectoryItem } from "../../../services/auth/identity-contracts";

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
const AUDIT_REASON_MIN_WORDS = 2;
const OWNER_ROLE_CODE = "owner";
const ADMINISTRATION_MODULE_CODES = ["role", "user"] as const;
const MODULE_DISPLAY_ORDER = ["ventas", "mercadeo", "formalizacion", "contabilidad", "user", "role"] as const;

const isAdministrationModuleCode = (moduleCode: string): boolean => ADMINISTRATION_MODULE_CODES.includes(moduleCode as (typeof ADMINISTRATION_MODULE_CODES)[number]);

const sortModulesForDisplay = (items: readonly ModuleCatalogItem[]): readonly ModuleCatalogItem[] =>
    [...items]
        .filter((module) => module.code !== "org")
        .sort((first, second) => {
            const firstIndex = MODULE_DISPLAY_ORDER.indexOf(first.code as (typeof MODULE_DISPLAY_ORDER)[number]);
            const secondIndex = MODULE_DISPLAY_ORDER.indexOf(second.code as (typeof MODULE_DISPLAY_ORDER)[number]);

            return (firstIndex === -1 ? Number.MAX_SAFE_INTEGER : firstIndex) - (secondIndex === -1 ? Number.MAX_SAFE_INTEGER : secondIndex) || first.name.localeCompare(second.name);
        });

const hasValidAuditReason = (reason: string): boolean => reason.trim().split(/\s+/u).filter(Boolean).length >= AUDIT_REASON_MIN_WORDS;

const getModulePermissionCodes = (modules: readonly ModuleCatalogItem[], moduleCode: string): PermissionCode[] => {
    const module = modules.find((item) => item.code === moduleCode);

    return module ? module.views.flatMap((view) => view.permissions.map((permission) => permission.code)) : [];
};

const groupPermissionCodesByModule = (modules: readonly ModuleCatalogItem[], permissionCodes: readonly string[]): Record<string, readonly PermissionCode[]> => {
    const grantedCodes = new Set(permissionCodes);

    return Object.fromEntries(modules.map((module) => [module.code, getModulePermissionCodes(modules, module.code).filter((permissionCode) => grantedCodes.has(permissionCode))]));
};

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

const FALLBACK_ROLE = INITIAL_ROLES[0] as RoleCatalogItem;
const FALLBACK_MODULE = INITIAL_MODULES[0] as ModuleCatalogItem;

const getRole = (roles: readonly RoleCatalogItem[], code: string): RoleCatalogItem => roles.find((role) => role.code === code) ?? FALLBACK_ROLE;
const getModule = (modules: readonly ModuleCatalogItem[], code: string): ModuleCatalogItem => modules.find((module) => module.code === code) ?? FALLBACK_MODULE;

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : "No se pudo completar la acción.");

const arePermissionListsEqual = (first: readonly string[], second: readonly string[]): boolean => first.length === second.length && first.every((code) => second.includes(code));

const countRolePermissionChanges = (current: RolePermissionState, saved: RolePermissionState, roleCode: string): number => {
    const moduleCodes = new Set([...Object.keys(current[roleCode] ?? {}), ...Object.keys(saved[roleCode] ?? {})]);

    return [...moduleCodes].filter((moduleCode) => !arePermissionListsEqual(current[roleCode]?.[moduleCode] ?? [], saved[roleCode]?.[moduleCode] ?? [])).length;
};

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

const getUserBasePermissionCodes = (state: RolePermissionState, roleCodes: ReadonlySet<string>, moduleCode: string): readonly string[] => [...new Set([...roleCodes].flatMap((roleCode) => state[roleCode]?.[moduleCode] ?? []))];

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

const areStringSetsEqual = (first: ReadonlySet<string> | undefined, second: ReadonlySet<string> | undefined): boolean => {
    if (!first || !second) {
        return first === second;
    }

    return first.size === second.size && [...first].every((value) => second.has(value));
};

const areOverrideStatesEqual = (first: PermissionOverrideState, second: PermissionOverrideState): boolean => {
    const codes = new Set([...Object.keys(first), ...Object.keys(second)]);

    return [...codes].every((code) => first[code] === second[code]);
};

interface UserAccessComparisonInput {
    readonly currentOrgUnits: ReadonlySet<string>;
    readonly currentOverrides: PermissionOverrideState;
    readonly currentRoles: ReadonlySet<string>;
    readonly savedOrgUnits: ReadonlySet<string>;
    readonly savedOverrides: PermissionOverrideState;
    readonly savedRoles: ReadonlySet<string>;
}

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

const withoutPermissionOverride = (state: PermissionOverrideState, permissionCode: string): PermissionOverrideState => Object.fromEntries(Object.entries(state).filter(([code]) => code !== permissionCode));

const withPermissionOverride = (state: PermissionOverrideState, permissionCode: string, effect: "allow" | "deny"): PermissionOverrideState => ({
    ...state,
    [permissionCode]: effect,
});

const mapOverridesToState = (overrides: readonly IdentityUserPermissionOverride[]): PermissionOverrideState => Object.fromEntries(overrides.map((override) => [override.code, override.effect]));

const mapOverrideStateToList = (overrides: PermissionOverrideState): readonly IdentityUserPermissionOverride[] =>
    Object.entries(overrides)
        .map(([code, effect]) => ({ code, effect }))
        .sort((first, second) => first.code.localeCompare(second.code));

const buildUserSaveSummary = (input: { readonly modules: readonly ModuleCatalogItem[]; readonly roles: readonly RoleCatalogItem[]; readonly selectedUser: SystemUserDirectoryItem; readonly userOrgUnitCodes: ReadonlySet<string>; readonly userPermissionOverrides: PermissionOverrideState; readonly userRoleCodes: ReadonlySet<string> }): readonly string[] => {
    const selectedRoleNames = input.roles.filter((role) => input.userRoleCodes.has(role.code)).map((role) => role.name);
    const selectedModuleNames = input.modules.filter((module) => input.userOrgUnitCodes.has(module.code)).map((module) => module.name);

    return [`Empleado: ${input.selectedUser.name}`, `Roles: ${selectedRoleNames.length > 0 ? selectedRoleNames.join(", ") : "Sin roles"}`, `Modulos: ${selectedModuleNames.length > 0 ? selectedModuleNames.join(", ") : "Sin modulos"}`, `Excepciones directas: ${String(Object.keys(input.userPermissionOverrides).length)}`];
};

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

const getVisibleModulesForContext = (modules: readonly ModuleCatalogItem[], isOwnerContext: boolean): readonly ModuleCatalogItem[] => modules.filter((module) => isOwnerContext || !isAdministrationModuleCode(module.code));

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
    const operationalModules = useMemo(() => visibleModules.filter((module) => !isAdministrationModuleCode(module.code)), [visibleModules]);
    const administrationModules = useMemo(() => visibleModules.filter((module) => isAdministrationModuleCode(module.code)), [visibleModules]);
    const selectedModule = visibleModules.find((module) => module.code === selectedModuleCode) ?? visibleModules[0] ?? getModule(modules, selectedModuleCode);
    const activeModuleCode = selectedModule.code;
    const selectedRolePermissions = isUserMode ? getEffectiveUserPermissionCodes(permissionState, userRoleCodes, userPermissionOverrides, activeModuleCode) : (permissionState[selectedRoleCode]?.[activeModuleCode] ?? []);
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
    const filteredViews = useMemo(
        () =>
            selectedModule.views
                .map((view) => ({
                    ...view,
                    permissions: view.permissions.filter((permission) => {
                        const haystack = `${view.name} ${permission.name} ${permission.description}`.toLowerCase();

                        return normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
                    }),
                }))
                .filter((view) => view.permissions.length > 0),
        [normalizedQuery, selectedModule],
    );

    const togglePermission = (permissionCode: PermissionCode) => {
        if (isSystemRole) {
            return;
        }

        if (isUserMode) {
            const basePermissions = new Set(getUserBasePermissionCodes(permissionState, userRoleCodes, activeModuleCode));
            const currentlyEnabled = selectedRolePermissions.includes(permissionCode);

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
            const currentPermissions = modulesByRole[activeModuleCode] ?? [];
            const nextPermissions = currentPermissions.includes(permissionCode) ? currentPermissions.filter((code) => code !== permissionCode) : [...currentPermissions, permissionCode];

            return {
                ...current,
                [selectedRoleCode]: {
                    ...modulesByRole,
                    [activeModuleCode]: nextPermissions,
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

    return (
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
                    <div className="roles-security-role-search">
                        <SearchOutlined />
                        <span>Buscar rol</span>
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
                                {isUserMode ? <input checked={userRoleCodes.has(role.code)} disabled={isAccessEditorBusy} readOnly type="checkbox" /> : <EditOutlined aria-hidden="true" />}
                            </button>
                        ))}
                    </div>
                </aside>

                <main className={`roles-security-editor${isAccessEditorBusy ? " roles-security-editor--busy" : ""}`}>
                    <section className="roles-security-toolbar" aria-labelledby="roles-security-editor-title">
                        <div>
                            <span className="roles-security-toolbar__eyebrow">{isUserMode ? "Empleado seleccionado" : "Rol seleccionado"}</span>
                            <h2 id="roles-security-editor-title">{selectedUser?.name ?? selectedRole.name}</h2>
                            {selectedUser ? <p className="roles-security-toolbar__subtext">{selectedUser.email}</p> : null}
                        </div>
                        <div className="roles-security-toolbar__actions">
                            <label className="roles-security-user-picker">
                                <span>Empleado</span>
                                <input
                                    placeholder="Buscar empleado"
                                    value={userQuery}
                                    onChange={(event) => {
                                        setUserQuery(event.target.value);
                                    }}
                                />
                                <select
                                    value={selectedUserPublicId}
                                    onChange={(event) => {
                                        const nextUserPublicId = event.target.value;
                                        notificationApi.destroy();
                                        setIsLoadingUserAccess(Boolean(nextUserPublicId));
                                        resetUserAccessState();
                                        setSelectedUserPublicId(nextUserPublicId);

                                        if (!nextUserPublicId) {
                                            setIsLoadingUserAccess(false);
                                        }
                                    }}
                                >
                                    <option value="">Gestionar rol base</option>
                                    {users.map((user) => (
                                        <option key={user.publicId} value={user.publicId}>
                                            {user.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button className="roles-security-secondary-action" disabled={isUserMode} type="button" aria-label="Renombrar rol" onClick={openRenameRoleDialog}>
                                <EditOutlined />
                                Renombrar
                            </button>
                            <button className={`roles-security-primary-action${dirtyCount > 0 ? " is-dirty" : ""}`} disabled={isLoadingUserAccess || dirtyCount === 0 || (isSystemRole && dirtyCount === 0)} type="button" aria-label={`Guardar cambios ${String(dirtyCount)}`} onClick={openSavePermissionsDialog}>
                                <SaveOutlined />
                                Guardar cambios ({dirtyCount})
                            </button>
                        </div>
                    </section>

                    {isAccessEditorBusy ? (
                        <div className="roles-security-loading-state" role="status" aria-live="polite">
                            <span className="roles-security-loading-state__spinner" aria-hidden="true" />
                            <strong>Cargando acceso del empleado...</strong>
                            <small>Estamos trayendo roles, módulos y permisos directos desde el API.</small>
                        </div>
                    ) : null}

                    {isUserMode ? (
                        <section className="roles-security-effective-summary" aria-label="Permisos efectivos del empleado">
                            <strong>Permisos efectivos antes de guardar</strong>
                            <span>{saveSummary.join(" | ")}</span>
                        </section>
                    ) : null}

                    <section className="roles-security-module-groups" aria-label="Módulos del sistema">
                        {[
                            { modules: operationalModules, title: "Módulos operativos" },
                            { modules: administrationModules, title: "Administración del sistema" },
                        ]
                            .filter((group) => group.modules.length > 0)
                            .map((group) => (
                                <div className="roles-security-module-group" key={group.title}>
                                    <span className="roles-security-module-group__title">{group.title}</span>
                                    <div className="roles-security-module-grid">
                                        {/* eslint-disable-next-line complexity -- Cada tarjeta calcula estado rol/empleado para evitar duplicar el markup. */}
                                        {group.modules.map((module) => {
                                            const granted = permissionState[selectedRoleCode]?.[module.code]?.length ?? 0;
                                            const userGranted = getEffectiveUserPermissionCodes(permissionState, userRoleCodes, userPermissionOverrides, module.code).length;
                                            const total = getModulePermissionCodes(modules, module.code).length;
                                            const enabled = isUserMode ? userOrgUnitCodes.has(module.code) : granted > 0;
                                            const visibleGranted = isUserMode ? userGranted : granted;

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
                                                        <strong>{module.name}</strong>
                                                    </span>
                                                    <small>
                                                        {visibleGranted}/{total}
                                                    </small>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                    </section>

                    <section className="roles-security-permissions" aria-labelledby="roles-security-permissions-title">
                        <div className="roles-security-permissions__header">
                            <div>
                                <h2 id="roles-security-permissions-title">{selectedModule.name}</h2>
                                <p>Permisos agrupados por vista</p>
                            </div>
                            <div className="roles-security-permissions__actions">
                                <label className="roles-security-filter">
                                    <SearchOutlined />
                                    <input
                                        placeholder="Buscar vista o permiso"
                                        value={query}
                                        onChange={(event) => {
                                            setQuery(event.target.value);
                                        }}
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="roles-security-view-list">
                            {filteredViews.length > 0 ? (
                                filteredViews.map((view) => {
                                    const isViewOpen = openViewCodes.has(view.code);
                                    const grantedInView = isSystemRole ? view.permissions.length : view.permissions.filter((permission) => selectedRolePermissions.includes(permission.code)).length;
                                    const permissionListId = `roles-security-view-${activeModuleCode}-${view.code}`;

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
                                                <span>
                                                    <strong>{view.name}</strong>
                                                    <small>
                                                        {grantedInView}/{view.permissions.length} permitidos
                                                    </small>
                                                </span>
                                                <span className="roles-security-view-group__meta">
                                                    {view.permissions.length} acciones
                                                    <DownOutlined aria-hidden="true" />
                                                </span>
                                            </button>
                                            {isViewOpen ? (
                                                <div id={permissionListId} className="roles-security-permission-list">
                                                    {view.permissions.map((permission) => {
                                                        const enabled = isSystemRole || selectedRolePermissions.includes(permission.code);

                                                        return (
                                                            <label className="roles-security-permission-row" key={permission.code}>
                                                                <span>
                                                                    <strong>
                                                                        {permission.name}
                                                                        {permission.sensitive ? <em>Sensible</em> : null}
                                                                    </strong>
                                                                    <small>{permission.description}</small>
                                                                </span>
                                                                <input
                                                                    checked={enabled}
                                                                    disabled={isSystemRole || isAccessEditorBusy}
                                                                    type="checkbox"
                                                                    onChange={() => {
                                                                        togglePermission(permission.code);
                                                                    }}
                                                                />
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </section>
                                    );
                                })
                            ) : (
                                <div className="roles-security-empty-state">
                                    <strong>Sin acciones configuradas</strong>
                                    <span>Las vistas y acciones se agregan por migración del sistema.</span>
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
    );
}

function RoleSecurityDialogs({ changes, isRenameRoleDialogOpen, isSavePermissionsDialogOpen, isSubmitting, onClose, onRenameRole, onSavePermissions, renameRoleForm, roleName, savePermissionsForm, saveSummary, setRenameRoleForm, setSavePermissionsForm }: RoleSecurityDialogsProps) {
    return (
        <>
            {isRenameRoleDialogOpen ? <RenameRoleDialog form={renameRoleForm} isSubmitting={isSubmitting} setForm={setRenameRoleForm} onClose={onClose} onSubmit={onRenameRole} /> : null}
            {isSavePermissionsDialogOpen ? <SavePermissionsDialog changes={changes} form={savePermissionsForm} isSubmitting={isSubmitting} roleName={roleName} saveSummary={saveSummary} setForm={setSavePermissionsForm} onClose={onClose} onSubmit={onSavePermissions} /> : null}
        </>
    );
}

interface RenameRoleDialogProps {
    readonly form: RenameRoleFormState;
    readonly isSubmitting: boolean;
    readonly onClose: () => void;
    readonly onSubmit: () => void;
    readonly setForm: Dispatch<SetStateAction<RenameRoleFormState>>;
}

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
