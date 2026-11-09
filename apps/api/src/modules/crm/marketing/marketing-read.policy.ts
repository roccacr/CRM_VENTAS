import type { IdentityAuthorizationProfile } from "../identity/identity.types.js";

/** Amplía la población de lectura de Mercadeo; nunca concede edición ni acceso a otro módulo. */
export function hasGlobalMarketingRead(profile: Pick<IdentityAuthorizationProfile, "permissions">): boolean {
    const grants = profile.permissions.filter((permission) => permission.code === "mercadeo.reports.read_all");
    return grants.some((permission) => permission.effect === "allow") && !grants.some((permission) => permission.effect === "deny");
}
