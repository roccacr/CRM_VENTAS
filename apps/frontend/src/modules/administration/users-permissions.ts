import type { IdentityProfile } from "../../services/auth/identity-contracts";
import type { SystemUserListItem, SystemUserStatusUpdateTarget } from "./system-users.model";

const PERMISSIONS = { list: "user.view_list", detail: "user.view_detail", create: "user.create", update: "user.update", activate: "user.activate", deactivate: "user.deactivate", assignPassword: "user.assign_password", assignRoles: "role.assign" } as const;
export type UsersPermissions = Readonly<Record<keyof typeof PERMISSIONS, boolean>>;
export const NO_USERS_PERMISSIONS: UsersPermissions = { list: false, detail: false, create: false, update: false, activate: false, deactivate: false, assignPassword: false, assignRoles: false };

/** Effective grants only: a deny always wins, including for an Owner. The API remains authoritative. */
export function getUsersPermissions(permissions: IdentityProfile["permissions"]): UsersPermissions {
    const allowed = new Set(permissions.filter(({ effect }) => effect === "allow").map(({ code }) => code));
    for (const { code, effect } of permissions) if (effect === "deny") allowed.delete(code);
    return { ...Object.fromEntries(Object.entries(PERMISSIONS).map(([key, code]) => [key, allowed.has(code)])), create: allowed.has("user.create") && allowed.has("role.assign") } as UsersPermissions;
}

/** Activate applies only to the active destination; block and inactivate both require deactivate. */
export const canChangeUserStatus = (permissions: UsersPermissions, user: SystemUserListItem, target: SystemUserStatusUpdateTarget): boolean => !user.isCurrentUser && (target === "active" ? permissions.activate : permissions.deactivate);
