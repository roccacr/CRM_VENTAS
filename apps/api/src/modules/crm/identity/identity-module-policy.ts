import { CATALOG_CONTEXT_MODULES } from "../catalogs/catalogs.constants.js";
import type { IdentityRole } from "./identity.types.js";

/** Modules a user can be scoped to; administration is excluded because it is never granted by module selection. */
export const OPERATIONAL_MODULE_CODES = CATALOG_CONTEXT_MODULES.filter((code) => code !== "administration");
/** `selected_modules` intersects the editable role template with the employee's selected modules. */
export type PermissionInheritance = "assigned" | "selected_modules";
/** A directly assigned role plus how its permissions are inherited. */
export type AssignedModuleRole = IdentityRole & { permissionInheritance?: PermissionInheritance };
/** Role-to-module relation row, including the lifecycle state of the relation and of the module. */
export type RoleModuleMapping = AssignedModuleRole & { moduleCode: string; mappingStatus: string; moduleStatus: string; moduleDeleted: Date | string | null };
/** Effective result: usable roles and the module ceiling (`null` means unrestricted by modules). */
export type ModuleRoleAccess = { roles: IdentityRole[]; moduleCodes: string[] | null; permissionInheritance: PermissionInheritance; roleModuleCodes?: ReadonlyMap<string, readonly string[]> };

/** Administration uses legacy permission namespaces, not separate employee modules. */
export const normalizePermissionModule = (moduleCode: string): string => (["user", "role", "org"].includes(moduleCode) ? "administration" : moduleCode);

/** Expands "administration" to the legacy permission namespaces (user, role, org) that back it. */
export const permissionModuleCodes = (modules: readonly string[]): string[] => [...new Set(modules.flatMap((code) => (code === "administration" ? [code, "user", "role", "org"] : [code])))];

/** Projects only the fields safe to expose to the caller. */
const publicRole = ({ code, name, status }: IdentityRole): IdentityRole => ({ code, name, status });
/** A mapping counts only while the relation and its module are active and not soft-deleted. */
const activeMapping = (mapping: RoleModuleMapping): boolean => mapping.mappingStatus === "active" && mapping.moduleStatus === "active" && mapping.moduleDeleted === null;

/**
 * Adds roles implied by the selected modules. The owner role is never inherited, and a role bound
 * to several modules is usable only when all are selected. General retains its direct role;
 * its editable module template is a ceiling, not a requirement to select every module. */
function inheritModuleRoles(direct: readonly AssignedModuleRole[], mappings: readonly RoleModuleMapping[], allowed: readonly string[], general: boolean): IdentityRole[] {
    const roleMappings = new Map<string, RoleModuleMapping[]>();
    for (const mapping of mappings) roleMappings.set(mapping.code, [...(roleMappings.get(mapping.code) ?? []), mapping]);
    /** A mapped role is eligible only if every active module it maps to is selected and available. */
    const eligible = (code: string): boolean => {
        const entries = (roleMappings.get(code) ?? []).filter((entry) => entry.mappingStatus === "active");
        return entries.length > 0 && entries.every((entry) => activeMapping(entry) && allowed.includes(entry.moduleCode));
    };
    const roles = direct.filter((role) => role.permissionInheritance === "selected_modules" || !roleMappings.has(role.code) || eligible(role.code));
    const candidates = mappings.filter((entry) => general || entry.code === entry.moduleCode);
    for (const candidate of candidates) {
        if (candidate.code === "owner" || !eligible(candidate.code) || roles.some((role) => role.code === candidate.code)) continue;
        roles.push(candidate);
    }
    return roles.map(publicRole);
}

/** A persisted relation is a ceiling even when revoked; clearing it must not reopen global access. */
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
