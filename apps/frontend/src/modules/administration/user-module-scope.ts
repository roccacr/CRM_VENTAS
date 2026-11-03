/** Optional API catalog scope; direct role assignments remain distinct from effective roles. */
export interface RoleModuleScope {
    readonly code: string;
    readonly moduleCodes?: readonly string[];
    readonly moduleScoped?: boolean;
    readonly permissionInheritance?: "assigned" | "selected_modules";
}

/** Security catalog aliases share one Administration ceiling. */
export const normalizeAccessModuleCode = (code: string): string => (["user", "role", "org"].includes(code) ? "administration" : code);
/** Administration and company modules are never granted through module selection. */
export const isOperationalAccessModule = (code: string): boolean => ["ventas", "mercadeo", "formalizacion", "contabilidad"].includes(normalizeAccessModuleCode(code));

/** Owner always keeps full access; any other assigned role flagged `selected_modules` makes permissions follow the chosen modules. */
export const hasSelectedModuleInheritance = (roleCodes: readonly string[], roles: readonly RoleModuleScope[]): boolean => !roleCodes.includes("owner") && roles.some((role) => roleCodes.includes(role.code) && role.permissionInheritance === "selected_modules");

/**
 * Modules a user may be given. Selected modules are intersected with the ceiling of the assigned roles.
 * Null preserves legacy/Owner behavior; a present empty set means no module access. */
export function getUserModuleScope(roleCodes: readonly string[], roles: readonly RoleModuleScope[], selectedModules: readonly string[]): ReadonlySet<string> | null {
    if (roleCodes.includes("owner")) return null;
    const assigned = roles.filter((role) => roleCodes.includes(role.code));
    const selected = selectedModules.map(normalizeAccessModuleCode);
    if (hasSelectedModuleInheritance(roleCodes, roles)) {
        const enabled = new Set(
            assigned
                .filter((role) => role.permissionInheritance === "selected_modules")
                .flatMap((role) => role.moduleCodes ?? [])
                .map(normalizeAccessModuleCode),
        );
        return new Set(selected.filter((code) => isOperationalAccessModule(code) && enabled.has(code)));
    }
    const mapped = assigned.filter((role) => role.moduleScoped ?? role.moduleCodes !== undefined);
    if (mapped.length === 0) return null;
    const ceiling = new Set(mapped.flatMap((role) => role.moduleCodes ?? []).map(normalizeAccessModuleCode));
    return new Set(selected.filter((code) => ceiling.has(code)));
}

/** Restrict each role's contribution before union, so another role cannot lend it a ceiling. */
function canRoleGrantScopedModule(roleCode: string, roles: readonly RoleModuleScope[], moduleCode: string, selectedModules: readonly string[] = [moduleCode]): boolean {
    const scope = getUserModuleScope([roleCode], roles, selectedModules);
    if (scope === null) return true;
    const role = roles.find((item) => item.code === roleCode);
    if (role?.permissionInheritance === "selected_modules") return scope.has(normalizeAccessModuleCode(moduleCode));
    const selected = new Set(selectedModules.map(normalizeAccessModuleCode));
    return scope.has(normalizeAccessModuleCode(moduleCode)) && (role?.moduleCodes ?? []).every((code) => selected.has(normalizeAccessModuleCode(code)));
}

/** El permiso global no exige membresía Lead; sí conserva la efectividad del rol que lo concede. */
export function canRoleGrantModule(roleCode: string, roles: readonly RoleModuleScope[], moduleCode: string, selectedModules: readonly string[] = [moduleCode]): boolean {
    if (moduleCode !== "lead") return canRoleGrantScopedModule(roleCode, roles, moduleCode, selectedModules);
    const role = roles.find((entry) => entry.code === roleCode);
    const scope = getUserModuleScope([roleCode], roles, selectedModules);
    if (scope === null || role?.permissionInheritance === "selected_modules") return true;
    const selected = new Set(selectedModules.map(normalizeAccessModuleCode));
    return (role?.moduleCodes ?? []).every((code) => selected.has(normalizeAccessModuleCode(code)));
}
