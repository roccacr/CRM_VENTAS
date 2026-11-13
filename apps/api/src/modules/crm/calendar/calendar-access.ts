import type { IdentityProfile } from "../identity/identity.types.js";
import { hasGlobalMarketingRead } from "../marketing/marketing-read.policy.js";
import { CALENDAR_MODULES, type CalendarModuleCode } from "./calendar.contract.js";

export type CalendarAction = "read" | "create" | "update" | "assign_lead";
/** Ventas conserva sus datos históricos, pero ya no expone una sección de calendario. */
const hasCalendarMembership = (profile: IdentityProfile, moduleCode: CalendarModuleCode): boolean => moduleCode !== "ventas" && profile.orgUnits.some((unit) => unit.code === moduleCode && unit.status === "active");

/**
 * Hace falta la unidad del módulo, un allow con alcance conocido y ningún deny.
 * Escribir también exige poder leer. Un alcance de persona deja el calendario en lo propio.
 * La lectura global de Mercadeo o el rol de Formalización amplían la población solo al leer; no autorizan otro módulo ni eventos ajenos para escribir.
 */
export function calendarAccess(profile: IdentityProfile, moduleCode: CalendarModuleCode, action: CalendarAction): { allowed: boolean; ownOnly: boolean } {
    const membership = hasCalendarMembership(profile, moduleCode);
    const code = `${moduleCode}.calendar.${action}`;
    const grants = profile.permissions.filter((permission) => permission.code === code && permission.effect === "allow");
    const denied = profile.permissions.some((permission) => permission.code === code && permission.effect === "deny");
    const knownScopes = ["self", "assigned", "own_area", "own_area_and_children", "all_areas"];
    const allowed = membership && !denied && grants.some((grant) => knownScopes.includes(grant.scope ?? ""));
    const read = action === "read" ? { allowed: true, ownOnly: false } : calendarAccess(profile, moduleCode, "read");
    // La consulta global de Mercadeo no concede escritura sobre eventos ajenos ni acceso a otros módulos.
    const globalMarketingRead = [action === "read", moduleCode === "mercadeo", hasGlobalMarketingRead(profile)].every(Boolean);
    // La cartera de Formalización se consulta por equipo: el rol amplía población, nunca sustituye permiso ni membresía.
    const globalFormalizationRead = [action === "read", moduleCode === "formalizacion", profile.roles.some((role) => role.status === "active" && ["formalizacion", "jefe_formalizaciones"].includes(role.code))].every(Boolean);
    // Escribir no puede ver más de lo que la lectura ya dejó. Si la lectura es propia, la escritura también.
    return { allowed: allowed && read.allowed, ownOnly: read.ownOnly || (!globalMarketingRead && !globalFormalizationRead && !grants.some((grant) => ["own_area", "own_area_and_children", "all_areas"].includes(grant.scope ?? ""))) };
}
/** El guard solo abre la puerta si algún módulo permite la acción. El servicio vuelve a mirar el módulo y el recurso pedidos. */
export function calendarRouteAccess(profile: IdentityProfile, action: CalendarAction): boolean {
    return CALENDAR_MODULES.some((moduleCode) => calendarAccess(profile, moduleCode, action).allowed);
}
