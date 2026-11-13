import type { CatalogPermissionAction } from "../catalogs/catalogs.constants.js";
import { isCatalogContextModuleCode } from "../catalogs/catalogs.constants.js";
import type { IdentityProfile } from "../identity/identity.types.js";
/**
 * Leer y la acción pedida tienen que estar permitidos en `catalog_bank`, y un deny gana.
 * Ser owner no salta esos códigos. Un usuario inactivo falla antes.
 * Si no es owner, la unidad organizativa activa tiene que ser el módulo del contexto.
 */
export function canUseBanks(profile: IdentityProfile, moduleCode: unknown, action: CatalogPermissionAction): boolean {
    if (moduleCode === "ventas") return false;
    if (!isCatalogContextModuleCode(typeof moduleCode === "string" ? moduleCode : "") || profile.user.status !== "active") return false;
    if (!profile.roles.some((role) => role.code === "owner" && role.status === "active") && !profile.orgUnits.some((unit) => unit.code === moduleCode && unit.status === "active")) return false;
    return ["read", action].every((required) => {
        const code = `${String(moduleCode)}.catalog_bank.${required}`;
        return profile.permissions.some((p) => p.code === code && p.effect === "allow") && !profile.permissions.some((p) => p.code === code && p.effect === "deny");
    });
}
