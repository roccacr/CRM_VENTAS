import type { IdentityProfile } from "../../../services/auth/identity-contracts";
import type { CatalogContextModuleCode } from "../../../services/catalogs/catalog-service";
import type { AdministrationCatalogDefinition } from "./catalog-definitions";

export interface CatalogPermissions {
    readonly read: boolean;
    readonly create: boolean;
    readonly update: boolean;
    readonly inactivate: boolean;
}
export const NO_CATALOG_PERMISSIONS: CatalogPermissions = { read: false, create: false, update: false, inactivate: false };

/** Owner bypasses only module membership; every action still requires its exact effective grant. */
export function getCatalogPermissions(profile: IdentityProfile, catalog: AdministrationCatalogDefinition, context: CatalogContextModuleCode): CatalogPermissions {
    const owner = profile.roles.some(({ code, status }) => code === "owner" && status === "active");
    if (!owner && !profile.orgUnits.some(({ code, status }) => code === context && status === "active")) return NO_CATALOG_PERMISSIONS;
    const allowed = new Set(profile.permissions.filter(({ effect }) => effect === "allow").map(({ code }) => code));
    for (const { code, effect } of profile.permissions) if (effect === "deny") allowed.delete(code);
    return { read: allowed.has(`${context}.${catalog.moduleCode}.read`), create: allowed.has(`${context}.${catalog.moduleCode}.create`), update: allowed.has(`${context}.${catalog.moduleCode}.update`), inactivate: allowed.has(`${context}.${catalog.moduleCode}.inactivate`) };
}
