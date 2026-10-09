/**
 * Reglas del formulario de alta y edición de usuarios.
 *
 * Traduce roles y módulos del catálogo de seguridad al cuerpo que espera el
 * API. La vista previa de permisos no es la autorización final: el BFF vuelve
 * a validar roles, áreas y motivo al guardar.
 */
import type { CreateSystemUserAccessMethod, CreateSystemUserPayload, UpdateSystemUserPayload } from "../../services/auth/identity-contracts";
import type { SystemUserListItem } from "./system-users.model";

/** Código estable del rol con alcance de toda la empresa. */
export const OWNER_ROLE_CODE = "owner";
/** Unidad raíz que el API espera cuando el alcance es global (Owner). */
export const GLOBAL_ORG_UNIT_CODE = "empresa";
/** Módulos de administración y estructura que no son áreas operativas asignables. */
export const NON_OPERATIVE_MODULE_CODES: ReadonlySet<string> = new Set(["role", "user", "org", GLOBAL_ORG_UNIT_CODE]);
/** Métodos que el alta ofrece marcados hasta que el usuario quite uno. */
export const DEFAULT_ACCESS_METHODS: readonly CreateSystemUserAccessMethod[] = ["microsoft", "local"];

/** Etiquetas del formulario. El valor que viaja al API es `microsoft` o `local`. */
export const ACCESS_METHOD_OPTIONS: readonly { readonly label: string; readonly value: CreateSystemUserAccessMethod }[] = [
    { label: "Microsoft 365", value: "microsoft" },
    { label: "Contraseña local", value: "local" },
];

/** Rol seleccionable en el alta, con el conteo de usuarios que ya lo tienen. */
export interface CreateUserRoleOption {
    readonly code: string;
    readonly locked: boolean;
    readonly name: string;
    readonly users: number;
}

/** Acción de una vista. `sensitive` solo advierte en la UI; no bloquea el envío. */
export interface CreateUserPermissionOption {
    readonly code: string;
    readonly name: string;
    readonly sensitive: boolean;
}

/** Vista de un módulo y las acciones que agrupa. */
export interface CreateUserModuleViewOption {
    readonly code: string;
    readonly name: string;
    readonly permissions: readonly CreateUserPermissionOption[];
}

/** Módulo operativo que puede convertirse en área asignada. */
export interface CreateUserModuleOption {
    readonly code: string;
    readonly name: string;
    readonly views: readonly CreateUserModuleViewOption[];
}

/** Permisos que el catálogo asocia a cada código de rol. Es vista previa, no el efecto final. */
export type CreateUserRolePermissions = Readonly<Record<string, readonly string[]>>;

/** Valores del formulario. El motivo se pide de nuevo en cada guardado. */
export interface CreateUserFormValues {
    readonly accessMethods: readonly CreateSystemUserAccessMethod[];
    readonly displayName: string;
    readonly email: string;
    readonly netsuiteId?: string;
    readonly odooId?: string;
    readonly reason: string;
    readonly roleCodes: readonly string[];
}

/**
 * Roles mínimos si el catálogo del API no llega.
 *
 * Permiten abrir el formulario. El API sigue siendo quien acepta o rechaza el código.
 */
export const FALLBACK_CREATE_ROLE_OPTIONS: readonly CreateUserRoleOption[] = [
    { code: OWNER_ROLE_CODE, locked: true, name: "Owner", users: 0 },
    { code: "jefe_general", locked: false, name: "Jefatura general", users: 0 },
    { code: "subjefe_area", locked: false, name: "Subjefe", users: 0 },
    { code: "ventas", locked: false, name: "Ventas", users: 0 },
    { code: "mercadeo", locked: false, name: "Mercadeo", users: 0 },
    { code: "formalizacion", locked: false, name: "Formalización", users: 0 },
    { code: "contabilidad", locked: false, name: "Contabilidad", users: 0 },
];

/** Áreas operativas de respaldo. No incluyen módulos de administración ni de estructura. */
export const FALLBACK_CREATE_MODULE_OPTIONS: readonly CreateUserModuleOption[] = [
    { code: "ventas", name: "Ventas", views: [] },
    { code: "mercadeo", name: "Mercadeo", views: [] },
    { code: "formalizacion", name: "Formalización", views: [] },
    { code: "contabilidad", name: "Contabilidad", views: [] },
];

/** Formulario de alta vacío, con Microsoft y contraseña local marcados. */
export const createInitialUserFormValues = (): CreateUserFormValues => ({
    accessMethods: [...DEFAULT_ACCESS_METHODS],
    displayName: "",
    email: "",
    reason: "",
    roleCodes: [],
});

/** Traduce el proveedor ya guardado a los métodos que el formulario puede marcar. */
const getAccessMethodsFromProvider = (provider: SystemUserListItem["provider"]): readonly CreateSystemUserAccessMethod[] => {
    if (provider === "mixed") {
        return [...DEFAULT_ACCESS_METHODS];
    }

    return [provider];
};

/** Id externo ya vinculado, para precargar NetSuite u Odoo sin inventar uno. */
const findExternalReferenceId = (user: SystemUserListItem, systemCode: "netsuite" | "odoo"): string | undefined => user.externalReferences.find((reference) => reference.systemCode === systemCode)?.externalUserId;

/**
 * Precarga la edición.
 *
 * El motivo queda vacío: reutilizar el de un cambio anterior auditaría mal el siguiente.
 *
 * @param user - Fila del directorio que se va a editar
 */
export const createEditUserFormValues = (user: SystemUserListItem): CreateUserFormValues => {
    const netsuiteId = findExternalReferenceId(user, "netsuite");
    const odooId = findExternalReferenceId(user, "odoo");

    return {
        accessMethods: getAccessMethodsFromProvider(user.provider),
        displayName: user.name,
        email: user.email,
        ...(netsuiteId ? { netsuiteId } : {}),
        ...(odooId ? { odooId } : {}),
        reason: "",
        roleCodes: user.roleCodes,
    };
};

/** Owner cambia el alcance: no se asignan módulos operativos, sino la unidad raíz. */
export const hasOwnerRole = (roleCodes: readonly string[] | undefined): boolean => roleCodes?.includes(OWNER_ROLE_CODE) ?? false;

/** Recorta el correo. Un valor que no sea texto se trata como vacío para no enviar `undefined`. */
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

/** Owner viaja con la unidad raíz. El resto viaja con los módulos donde sus roles tienen acciones. */
const getPayloadOrgUnitCodes = (roleCodes: readonly string[], roleModules: readonly CreateUserModuleOption[]): readonly string[] => (hasOwnerRole(roleCodes) ? [GLOBAL_ORG_UNIT_CODE] : roleModules.map((module) => module.code));

/**
 * Arma el alta.
 *
 * El estado inicial es `pending` porque la invitación todavía no fue aceptada.
 * `roleCode` repite el primero para el contrato que aún exige un rol principal.
 *
 * @param values - Formulario ya validado en pantalla
 * @param roleModules - Módulos derivados de los roles elegidos
 */
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

/**
 * Arma la edición a partir del mismo cuerpo del alta, sin el estado inicial.
 *
 * Cambiar el estado operativo es otra llamada: no se mezcla con el perfil.
 */
export const buildUpdateUserPayload = (values: CreateUserFormValues, roleModules: readonly CreateUserModuleOption[]): UpdateSystemUserPayload => {
    const { initialStatus: _initialStatus, ...payload } = buildCreateUserPayload(values, roleModules);
    return payload;
};
