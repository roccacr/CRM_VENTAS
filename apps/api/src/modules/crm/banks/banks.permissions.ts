import type { CatalogPermissionAction } from "../catalogs/catalogs.constants.js";
import { isCatalogContextModuleCode } from "../catalogs/catalogs.constants.js";
import type { IdentityProfile } from "../identity/identity.types.js";
/** El permiso efectivo puede venir del rol o de la persona; lectura, acción y módulo siguen siendo obligatorios. Deny prevalece. */
export function canUseBanks(profile: IdentityProfile, moduleCode: unknown, action: CatalogPermissionAction): boolean {
    if (!isCatalogContextModuleCode(typeof moduleCode === "string" ? moduleCode : "") || profile.user.status !== "active") return false;
    if (!profile.roles.some((role) => role.code === "owner" && role.status === "active") && !profile.orgUnits.some((unit) => unit.code === moduleCode && unit.status === "active")) return false;
    return ["read", action].every((required) => {
        const code = `${String(moduleCode)}.catalog_bank.${required}`;
        return profile.permissions.some((p) => p.code === code && p.effect === "allow") && !profile.permissions.some((p) => p.code === code && p.effect === "deny");
    });
}
