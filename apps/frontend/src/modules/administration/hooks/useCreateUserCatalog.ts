/**
 * Catálogo de roles y módulos para el alta de usuarios.
 *
 * Si el API no responde, no ofrece roles o módulos inventados.
 * El BFF vuelve a validar roles y áreas al guardar.
 */
import { useEffect, useState } from "react";

import { getIdentitySecurityCatalog } from "../../../services/auth/auth-service";
import type { IdentitySecurityCatalog } from "../../../services/auth/identity-contracts";
import { type CreateUserModuleOption, type CreateUserRoleOption, type CreateUserRolePermissions, NON_OPERATIVE_MODULE_CODES } from "../create-system-user.model";

interface CreateUserCatalogState {
    readonly moduleOptions: readonly CreateUserModuleOption[];
    readonly roleOptions: readonly CreateUserRoleOption[];
    readonly rolePermissions: CreateUserRolePermissions;
}

const EMPTY_CATALOG_STATE: CreateUserCatalogState = {
    moduleOptions: [],
    roleOptions: [],
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
        moduleOptions,
        roleOptions,
        rolePermissions: catalog.rolePermissions,
    };
};

/**
 * Catálogo para el alta de usuarios: roles, módulos operativos y permisos por rol.
 *
 * Un fallo deja opciones vacías y bloquea el alta hasta recuperar el catálogo.
 * El API valida de nuevo roles y módulos al crear.
 */
export const useCreateUserCatalog = (enabled = true): CreateUserCatalogState => {
    const [catalogState, setCatalogState] = useState<CreateUserCatalogState>(EMPTY_CATALOG_STATE);

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;

        getIdentitySecurityCatalog()
            .then((catalog) => {
                if (!cancelled) {
                    setCatalogState(mapCatalogToCreateUserState(catalog));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setCatalogState(EMPTY_CATALOG_STATE);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return catalogState;
};
