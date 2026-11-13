import { CATALOG_CONTEXT_MODULES } from "../catalogs/catalogs.constants.js";
import type { IdentityRole } from "./identity.types.js";

/** Módulos a los que se puede acotar a una persona. Administración no entra: no se concede eligiendo módulos. */
export const OPERATIONAL_MODULE_CODES = CATALOG_CONTEXT_MODULES.filter((code) => code !== "administration");
/** `selected_modules` intersects the editable role template with the employee's selected modules. */
export type PermissionInheritance = "assigned" | "selected_modules";
/** Rol asignado directo y cómo hereda permisos. */
export type AssignedModuleRole = IdentityRole & { permissionInheritance?: PermissionInheritance };
/** Relación rol-módulo, con el estado de la relación y el del módulo. */
export type RoleModuleMapping = AssignedModuleRole & { moduleCode: string; mappingStatus: string; moduleStatus: string; moduleDeleted: Date | string | null };
/** Roles usables y el techo de módulos. `null` significa que los módulos no acotan. */
export type ModuleRoleAccess = { roles: IdentityRole[]; moduleCodes: string[] | null; permissionInheritance: PermissionInheritance; roleModuleCodes?: ReadonlyMap<string, readonly string[]> };

/** Administración usa los espacios viejos `user`, `role` y `org`. No son módulos de empleado. */
export const normalizePermissionModule = (moduleCode: string): string => (["user", "role", "org"].includes(moduleCode) ? "administration" : moduleCode);

/** Expande administración a `user`, `role` y `org`, que son los que de verdad respaldan ese permiso. */
export const permissionModuleCodes = (modules: readonly string[]): string[] => [...new Set(modules.flatMap((code) => (code === "administration" ? [code, "user", "role", "org"] : [code])))];

/** Solo salen código, nombre y estado. La herencia y el mapeo no se cuelan al llamador. */
const publicRole = ({ code, name, status }: IdentityRole): IdentityRole => ({ code, name, status });
/** El mapeo cuenta solo si la relación y el módulo están activos y el módulo no está borrado. */
const activeMapping = (mapping: RoleModuleMapping): boolean => mapping.mappingStatus === "active" && mapping.moduleStatus === "active" && mapping.moduleDeleted === null;

/** Una membresía residual de otro jefe no equivale a asignarle un rol de Ventas. */
function denySalesInheritance(candidate: RoleModuleMapping, general: boolean, direct: readonly AssignedModuleRole[]): boolean {
    return candidate.moduleCode === "ventas" && !general && !direct.some((role) => ["ventas", "jefe_ventas"].includes(role.code));
}

/**
 * Adds roles implied by the selected modules. The owner role is never inherited, and a role bound
 * to several modules is usable only when all are selected. General retains its direct role;
 * its editable module template is a ceiling, not a requirement to select every module. */
function inheritModuleRoles(direct: readonly AssignedModuleRole[], mappings: readonly RoleModuleMapping[], allowed: readonly string[], general: boolean): IdentityRole[] {
    const roleMappings = new Map<string, RoleModuleMapping[]>();
    for (const mapping of mappings) roleMappings.set(mapping.code, [...(roleMappings.get(mapping.code) ?? []), mapping]);
    /** Un rol mapeado entra solo si cada módulo activo al que apunta está elegido y disponible. */
    const eligible = (code: string): boolean => {
        const entries = (roleMappings.get(code) ?? []).filter((entry) => entry.mappingStatus === "active");
        return entries.length > 0 && entries.every((entry) => activeMapping(entry) && allowed.includes(entry.moduleCode));
    };
    const roles = direct.filter((role) => role.permissionInheritance === "selected_modules" || !roleMappings.has(role.code) || eligible(role.code));
    const candidates = mappings.filter((entry) => general || entry.code === entry.moduleCode);
    for (const candidate of candidates.filter((entry) => !denySalesInheritance(entry, general, direct))) {
        if (candidate.code === "owner" || !eligible(candidate.code) || roles.some((role) => role.code === candidate.code)) continue;
        roles.push(candidate);
    }
    return roles.map(publicRole);
}

/** Una relación guardada sigue siendo techo aunque se revoque. Vaciar la selección no reabre el acceso global. */
export function resolveModuleRoleAccess(assigned: readonly AssignedModuleRole[], mappings: readonly RoleModuleMapping[], selectedModules: readonly string[]): ModuleRoleAccess {
    const direct = assigned.filter((role) => role.status === "active");
    const general = direct.some((role) => role.permissionInheritance === "selected_modules");
    const directCodes = new Set(direct.map((role) => role.code));
    const ownMappings = mappings.filter((mapping) => directCodes.has(mapping.code));
    if (!general && ownMappings.length === 0) return { roles: direct.map(publicRole), moduleCodes: null, permissionInheritance: "assigned" };

    const generalCodes = new Set(direct.filter((role) => role.permissionInheritance === "selected_modules").map((role) => role.code));
    const generalModules = new Set(ownMappings.filter((mapping) => generalCodes.has(mapping.code) && activeMapping(mapping)).map((mapping) => mapping.moduleCode));
    const allowed = general
        ? [...new Set(selectedModules.filter((code) => generalModules.has(code) && OPERATIONAL_MODULE_CODES.some((operational) => operational === code)))]
        : [
              ...new Set(
                  ownMappings
                      .filter(activeMapping)
                      .map((mapping) => mapping.moduleCode)
                      .filter((code) => selectedModules.includes(code)),
              ),
          ];
    const roleModuleCodes = new Map<string, string[]>();
    for (const mapping of mappings) {
        const codes = roleModuleCodes.get(mapping.code) ?? [];
        if (activeMapping(mapping)) codes.push(mapping.moduleCode);
        roleModuleCodes.set(mapping.code, codes);
    }
    return { roles: inheritModuleRoles(direct, mappings, allowed, general), moduleCodes: allowed, permissionInheritance: general ? "selected_modules" : "assigned", roleModuleCodes };
}
