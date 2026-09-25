import type { PermissionScope } from "./permission.types.js";

const SCOPE_PRIORITY: Record<string, number> = {
    self: 10,
    assigned: 20,
    own_area: 30,
    own_area_and_children: 40,
    all_areas: 50,
};

const DEFAULT_SCOPE_PRIORITY = SCOPE_PRIORITY.self ?? 10;

/**
 * Resuelve el alcance organizacional activo mas amplio de un usuario.
 *
 * Una persona puede pertenecer a mas de un area o ruta de rol. El backend no
 * puede tomar la primera fila que devuelva MySQL porque el orden volveria
 * inestables los permisos. Esta prioridad deterministica deja explicita la
 * jerarquia.
 */
export const resolveHighestPermissionScope = (scopes: string[]): PermissionScope => {
    let selectedScope: PermissionScope = "self";
    let selectedPriority = DEFAULT_SCOPE_PRIORITY;

    for (const scope of scopes) {
        const priority = SCOPE_PRIORITY[scope] ?? DEFAULT_SCOPE_PRIORITY;

        if (priority > selectedPriority) {
            selectedScope = scope;
            selectedPriority = priority;
        }
    }

    return selectedScope;
};
