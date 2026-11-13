/** Alcance opcional que trae el catálogo del API. La asignación directa del rol no es el rol efectivo. */
export interface RoleModuleScope {
    readonly code: string;
    readonly moduleCodes?: readonly string[];
    readonly moduleScoped?: boolean;
    readonly permissionInheritance?: "assigned" | "selected_modules";
}

/** Security catalog aliases share one Administration ceiling. */
export const normalizeAccessModuleCode = (code: string): string => (["user", "role", "org"].includes(code) ? "administration" : code);
/** Administración y empresa no se conceden eligiendo módulos. */
export const isOperationalAccessModule = (code: string): boolean => ["ventas", "mercadeo", "formalizacion"].includes(normalizeAccessModuleCode(code));

/** Owner conserva el acceso completo. Cualquier otro rol asignado con `selected_modules` hace que los permisos sigan los módulos elegidos. */
export const hasSelectedModuleInheritance = (roleCodes: readonly string[], roles: readonly RoleModuleScope[]): boolean => !roleCodes.includes("owner") && roles.some((role) => roleCodes.includes(role.code) && role.permissionInheritance === "selected_modules");

/**
 * Módulos que se le pueden dar a una persona. Los elegidos se cruzan con el techo de los roles asignados.
 * Nulo conserva el comportamiento de Owner y del legado. Un conjunto presente y vacío significa que no hay acceso a módulos. */
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

/** El aporte de cada rol se recorta antes de unirlo. Otro rol no le presta su techo. */
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
