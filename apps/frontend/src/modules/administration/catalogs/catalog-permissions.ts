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

/** Un Owner activo se salta solo la membresía del módulo. Cada acción sigue exigiendo su allow efectivo y un deny lo quita. En bancos, sin lectura no quedan las demás acciones. */
export function getCatalogPermissions(profile: IdentityProfile, catalog: AdministrationCatalogDefinition, context: CatalogContextModuleCode): CatalogPermissions {
    const owner = profile.roles.some(({ code, status }) => code === "owner" && status === "active");
    if (!owner && !profile.orgUnits.some(({ code, status }) => code === context && status === "active")) return NO_CATALOG_PERMISSIONS;
    const allowed = new Set(profile.permissions.filter(({ effect }) => effect === "allow").map(({ code }) => code));
    for (const { code } of profile.permissions.filter((permission) => permission.effect === "deny")) allowed.delete(code);
    if (catalog.code === "banks" && !allowed.has(`${context}.${catalog.moduleCode}.read`)) return NO_CATALOG_PERMISSIONS;
    return { read: allowed.has(`${context}.${catalog.moduleCode}.read`), create: allowed.has(`${context}.${catalog.moduleCode}.create`), update: allowed.has(`${context}.${catalog.moduleCode}.update`), inactivate: allowed.has(`${context}.${catalog.moduleCode}.inactivate`) };
}
