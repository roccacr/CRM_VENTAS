import type { CreateSystemUserAccessMethod, CreateSystemUserPayload } from "../../services/auth/identity-contracts";

export const OWNER_ROLE_CODE = "owner";
/** Unidad raíz que el API espera cuando el alcance es global (Owner). */
export const GLOBAL_ORG_UNIT_CODE = "empresa";
/** Módulos de administración y estructura que no son áreas operativas asignables. */
export const NON_OPERATIVE_MODULE_CODES: ReadonlySet<string> = new Set(["role", "user", "org", GLOBAL_ORG_UNIT_CODE]);
export const DEFAULT_ACCESS_METHODS: readonly CreateSystemUserAccessMethod[] = ["microsoft", "local"];

export const ACCESS_METHOD_OPTIONS: readonly { readonly label: string; readonly value: CreateSystemUserAccessMethod }[] = [
    { label: "Microsoft 365", value: "microsoft" },
    { label: "Contraseña local", value: "local" },
];

export interface CreateUserRoleOption {
    readonly code: string;
    readonly locked: boolean;
    readonly name: string;
    readonly users: number;
}

export interface CreateUserPermissionOption {
    readonly code: string;
    readonly name: string;
    readonly sensitive: boolean;
}

export interface CreateUserModuleViewOption {
    readonly code: string;
    readonly name: string;
    readonly permissions: readonly CreateUserPermissionOption[];
}

export interface CreateUserModuleOption {
    readonly code: string;
    readonly name: string;
    readonly views: readonly CreateUserModuleViewOption[];
}

export type CreateUserRolePermissions = Readonly<Record<string, readonly string[]>>;

export interface CreateUserFormValues {
    readonly accessMethods: readonly CreateSystemUserAccessMethod[];
    readonly displayName: string;
    readonly email: string;
    readonly netsuiteId?: string;
    readonly odooId?: string;
    readonly reason: string;
    readonly roleCodes: readonly string[];
}

export const FALLBACK_CREATE_ROLE_OPTIONS: readonly CreateUserRoleOption[] = [
    { code: OWNER_ROLE_CODE, locked: true, name: "Owner", users: 0 },
    { code: "jefe_general", locked: false, name: "Jefatura general", users: 0 },
    { code: "subjefe_area", locked: false, name: "Subjefe", users: 0 },
    { code: "ventas", locked: false, name: "Ventas", users: 0 },
    { code: "mercadeo", locked: false, name: "Mercadeo", users: 0 },
    { code: "formalizacion", locked: false, name: "Formalización", users: 0 },
    { code: "contabilidad", locked: false, name: "Contabilidad", users: 0 },
];

export const FALLBACK_CREATE_MODULE_OPTIONS: readonly CreateUserModuleOption[] = [
    { code: "ventas", name: "Ventas", views: [] },
    { code: "mercadeo", name: "Mercadeo", views: [] },
    { code: "formalizacion", name: "Formalización", views: [] },
    { code: "contabilidad", name: "Contabilidad", views: [] },
];

export const createInitialUserFormValues = (): CreateUserFormValues => ({
    accessMethods: [...DEFAULT_ACCESS_METHODS],
    displayName: "",
    email: "",
    reason: "",
    roleCodes: [],
});

export const hasOwnerRole = (roleCodes: readonly string[] | undefined): boolean => roleCodes?.includes(OWNER_ROLE_CODE) ?? false;

export const normalizeEmail = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Une los permisos que el API define para cada rol elegido. Es una vista previa, no el permiso efectivo final. */
const collectRolePermissionCodes = (roleCodes: readonly string[], rolePermissions: CreateUserRolePermissions): ReadonlySet<string> => new Set(roleCodes.flatMap((roleCode) => rolePermissions[roleCode] ?? []));

/**
 * Módulos operativos donde los roles elegidos tienen al menos una acción.
 *
 * El alta no pide módulos: el usuario queda asignado a estas áreas. Owner no
 * lleva módulos porque su alcance es la empresa completa.
 */
export const getRoleModules = (roleCodes: readonly string[], rolePermissions: CreateUserRolePermissions, modules: readonly CreateUserModuleOption[]): readonly CreateUserModuleOption[] => {
    if (hasOwnerRole(roleCodes)) {
        return [];
    }

    const rolePermissionCodes = collectRolePermissionCodes(roleCodes, rolePermissions);

    return modules.filter((module) => module.views.some((view) => view.permissions.some((permission) => rolePermissionCodes.has(permission.code))));
};

const getPayloadOrgUnitCodes = (roleCodes: readonly string[], roleModules: readonly CreateUserModuleOption[]): readonly string[] => (hasOwnerRole(roleCodes) ? [GLOBAL_ORG_UNIT_CODE] : roleModules.map((module) => module.code));

export const buildCreateUserPayload = (values: CreateUserFormValues, roleModules: readonly CreateUserModuleOption[]): CreateSystemUserPayload => {
    const externalReferences = [
        { externalUserId: values.netsuiteId?.trim() ?? "", systemCode: "netsuite" as const },
        { externalUserId: values.odooId?.trim() ?? "", systemCode: "odoo" as const },
    ].filter((reference) => reference.externalUserId.length > 0);

    return {
        accessMethods: values.accessMethods,
        displayName: values.displayName.trim(),
        email: normalizeEmail(values.email),
        externalReferences,
        initialStatus: "pending",
        orgUnitCodes: getPayloadOrgUnitCodes(values.roleCodes, roleModules),
        reason: values.reason.trim(),
        roleCode: values.roleCodes[0] ?? "",
        roleCodes: values.roleCodes,
    };
};
