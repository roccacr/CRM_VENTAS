import type { IdentityProfile } from "../identity/identity.types.js";
import { CALENDAR_MODULES, type CalendarModuleCode } from "./calendar.contract.js";

export type CalendarAction = "read" | "create" | "update" | "assign_lead";
/** Effective module membership plus exact allow/no-deny; Owner is resolved by the existing profile policy. */
export function calendarAccess(profile: IdentityProfile, moduleCode: CalendarModuleCode, action: CalendarAction): { allowed: boolean; ownOnly: boolean } {
    const membership = profile.orgUnits.some((unit) => unit.code === moduleCode && unit.status === "active");
    const code = `${moduleCode}.calendar.${action}`;
    const grants = profile.permissions.filter((permission) => permission.code === code && permission.effect === "allow");
    const denied = profile.permissions.some((permission) => permission.code === code && permission.effect === "deny");
    const knownScopes = ["self", "assigned", "own_area", "own_area_and_children", "all_areas"];
    const allowed = membership && !denied && grants.some((grant) => knownScopes.includes(grant.scope ?? ""));
    const read = action === "read" ? { allowed: true, ownOnly: false } : calendarAccess(profile, moduleCode, "read");
    // Writing cannot expose an event outside the effective read scope.
    return { allowed: allowed && read.allowed, ownOnly: read.ownOnly || !grants.some((grant) => ["own_area", "own_area_and_children", "all_areas"].includes(grant.scope ?? "")) };
}
/** The global guard grants only entry; the service validates every requested module and resource. */
export function calendarRouteAccess(profile: IdentityProfile, action: CalendarAction): boolean {
    return CALENDAR_MODULES.some((moduleCode) => calendarAccess(profile, moduleCode, action).allowed);
}
