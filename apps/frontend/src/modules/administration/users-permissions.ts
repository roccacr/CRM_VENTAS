import type { IdentityProfile } from "../../services/auth/identity-contracts";
import type { SystemUserListItem, SystemUserStatusUpdateTarget } from "./system-users.model";

const PERMISSIONS = { list: "user.view_list", detail: "user.view_detail", create: "user.create", update: "user.update", activate: "user.activate", deactivate: "user.deactivate", assignPassword: "user.assign_password", assignRoles: "role.assign" } as const;
export type UsersPermissions = Readonly<Record<keyof typeof PERMISSIONS, boolean>>;
export const NO_USERS_PERMISSIONS: UsersPermissions = { list: false, detail: false, create: false, update: false, activate: false, deactivate: false, assignPassword: false, assignRoles: false };

/** Solo cuentan los permisos efectivos. Un deny gana, también si quien lo tiene es Owner. El API sigue siendo la autoridad. Crear exige además asignar roles. */
export function getUsersPermissions(permissions: IdentityProfile["permissions"]): UsersPermissions {
    const allowed = new Set(permissions.filter(({ effect }) => effect === "allow").map(({ code }) => code));
    for (const { code, effect } of permissions) if (effect === "deny") allowed.delete(code);
    return { ...Object.fromEntries(Object.entries(PERMISSIONS).map(([key, code]) => [key, allowed.has(code)])), create: allowed.has("user.create") && allowed.has("role.assign") } as UsersPermissions;
}

/** Activar solo vale para el destino activo. Bloquear e inactivar exigen desactivar. La persona en sesión no se cambia a sí misma. */
export const canChangeUserStatus = (permissions: UsersPermissions, user: SystemUserListItem, target: SystemUserStatusUpdateTarget): boolean => !user.isCurrentUser && (target === "active" ? permissions.activate : permissions.deactivate);
