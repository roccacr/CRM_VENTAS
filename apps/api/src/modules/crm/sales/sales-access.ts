import type { IdentityProfile } from "../identity/identity.types.js";

export const SALES_HOME_PERMISSION = "ventas.home.read";
export const SALES_ROLE_CODES = ["owner", "jefe_general", "jefe_ventas", "ventas"] as const;

/** Rol permitido, membresía efectiva y permiso vivo; ni Owner evita una denegación. */
export function canEnterSales(profile: Pick<IdentityProfile, "roles" | "orgUnits" | "permissions">): boolean {
    return profile.roles.some((role) => role.status === "active" && SALES_ROLE_CODES.some((code) => code === role.code)) && profile.orgUnits.some((unit) => unit.code === "ventas" && unit.status === "active") && profile.permissions.some((permission) => permission.code === SALES_HOME_PERMISSION && permission.effect === "allow") && !profile.permissions.some((permission) => permission.code === SALES_HOME_PERMISSION && permission.effect === "deny");
}

/** Ventas empieza desde cero: únicamente Ver Inicio, sin permisos de funciones futuras. */
export function isCurrentSalesPermission(code: string, moduleCode?: string): boolean {
    if (moduleCode !== "ventas" && !code.startsWith("ventas.")) return true;
    return code === SALES_HOME_PERMISSION;
}

/** Los cuatro roles parten con Ventas; no concede el permiso ni omite denegaciones. */
export function withDefaultSalesModule(roleCodes: readonly string[], moduleCodes: readonly string[]): string[] {
    return [...new Set([...moduleCodes, ...(roleCodes.some((role) => SALES_ROLE_CODES.some((code) => code === role.trim().toLowerCase())) ? ["ventas"] : [])])];
}
