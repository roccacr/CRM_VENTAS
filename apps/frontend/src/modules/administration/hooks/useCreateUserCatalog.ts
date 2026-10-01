import { useEffect, useState } from "react";

import { getIdentitySecurityCatalog } from "../../../services/auth/auth-service";
import type { IdentitySecurityCatalog } from "../../../services/auth/identity-contracts";
import { type CreateUserModuleOption, type CreateUserRoleOption, type CreateUserRolePermissions, FALLBACK_CREATE_MODULE_OPTIONS, FALLBACK_CREATE_ROLE_OPTIONS, NON_OPERATIVE_MODULE_CODES } from "../create-system-user.model";

interface CreateUserCatalogState {
    readonly moduleOptions: readonly CreateUserModuleOption[];
    readonly roleOptions: readonly CreateUserRoleOption[];
    readonly rolePermissions: CreateUserRolePermissions;
}

const FALLBACK_CATALOG_STATE: CreateUserCatalogState = {
    moduleOptions: FALLBACK_CREATE_MODULE_OPTIONS,
    roleOptions: FALLBACK_CREATE_ROLE_OPTIONS,
    rolePermissions: {},
};

const mapCatalogToCreateUserState = (catalog: IdentitySecurityCatalog): CreateUserCatalogState => {
    const roleOptions = catalog.roles.map((role) => ({ code: role.code, locked: role.locked, name: role.name, users: role.users }));
    const moduleOptions = catalog.modules
        .filter((module) => !NON_OPERATIVE_MODULE_CODES.has(module.code))
        .map((module) => ({
            code: module.code,
            name: module.name,
            views: module.views.map((view) => ({
                code: view.code,
                name: view.name,
                permissions: view.permissions.map((permission) => ({ code: permission.code, name: permission.name, sensitive: permission.sensitive })),
            })),
        }));

    return {
        moduleOptions: moduleOptions.length > 0 ? moduleOptions : FALLBACK_CREATE_MODULE_OPTIONS,
        roleOptions: roleOptions.length > 0 ? roleOptions : FALLBACK_CREATE_ROLE_OPTIONS,
        rolePermissions: catalog.rolePermissions,
    };
};

/**
 * Catálogo para el alta de usuarios: roles, módulos operativos y permisos por rol.
 *
 * Si el API falla se usa un catálogo mínimo sin permisos, para que el alta siga
 * disponible; el API valida de nuevo roles y módulos al crear.
 */
export const useCreateUserCatalog = (): CreateUserCatalogState => {
    const [catalogState, setCatalogState] = useState<CreateUserCatalogState>(FALLBACK_CATALOG_STATE);

    useEffect(() => {
        let cancelled = false;

        getIdentitySecurityCatalog()
            .then((catalog) => {
                if (!cancelled) {
                    setCatalogState(mapCatalogToCreateUserState(catalog));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setCatalogState(FALLBACK_CATALOG_STATE);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return catalogState;
};
