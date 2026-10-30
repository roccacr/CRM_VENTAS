import type { IdentityAuthorizationProfile } from "../identity/identity.types.js";

/** Broadens only the seller population of Marketing reports, never editing or module access. */
export function hasGlobalMarketingRead(profile: Pick<IdentityAuthorizationProfile, "permissions">): boolean {
    const grants = profile.permissions.filter((permission) => permission.code === "mercadeo.reports.read_all");
    return grants.some((permission) => permission.effect === "allow") && !grants.some((permission) => permission.effect === "deny");
}
