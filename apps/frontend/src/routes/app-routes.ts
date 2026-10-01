import type { ComponentType } from "react";

import { AdministrationHomePage } from "../modules/administration/pages/AdministrationHomePage";
import { RolesSecurityPage } from "../modules/administration/pages/RolesSecurityPage";
import { SecurityAuditPage } from "../modules/administration/pages/SecurityAuditPage";
import { SystemUsersPage } from "../modules/administration/pages/SystemUsersPage";
import type { IdentityUser } from "../services/auth/identity-contracts";

/**
 * Mapa de rutas del CRM.
 *
 * Una sola tabla define, por ruta privada, el perfil operativo que exige, el
 * ítem de menú que se marca activo y la página que se pinta. Así una ruta
 * nueva no puede quedar registrada en un lugar y olvidada en otro.
 */

export const AUTH_LOGIN_PATH = "/auth/login";
const ADMINISTRATION_HOME_PATH = "/home/administration";
export const DEFAULT_HOME_PATH = ADMINISTRATION_HOME_PATH;

export interface AppRoute {
    /** Ítem de `GlobalHomeShell` que se marca activo. */
    readonly menuItemCode: string;
    /** Perfil operativo que debe ser visible con los permisos efectivos para abrir la ruta. */
    readonly workspaceCode: string;
    /** Título de la sección; se usa como placeholder mientras la ruta no tenga `Page` propia. */
    readonly title: string;
    readonly Page?: ComponentType<{ readonly currentUser: IdentityUser }>;
}

const APP_ROUTES: ReadonlyMap<string, AppRoute> = new Map<string, AppRoute>([
    ["/home/sales", { menuItemCode: "sales-home", title: "Ventas", workspaceCode: "sales" }],
    ["/home/marketing", { menuItemCode: "marketing-home", title: "Mercadeo", workspaceCode: "marketing" }],
    ["/home/formalization", { menuItemCode: "formalization-home", title: "Formalización", workspaceCode: "formalization" }],
    ["/home/accounting", { menuItemCode: "accounting-home", title: "Contabilidad", workspaceCode: "accounting" }],
    [ADMINISTRATION_HOME_PATH, { menuItemCode: "admin-home", Page: AdministrationHomePage, title: "Administración", workspaceCode: "administration" }],
    ["/home/administration/users", { menuItemCode: "users", Page: SystemUsersPage, title: "Usuarios", workspaceCode: "administration" }],
    ["/home/administration/roles-security", { menuItemCode: "roles-permissions", Page: RolesSecurityPage, title: "Roles y seguridad", workspaceCode: "administration" }],
    ["/home/administration/catalogs", { menuItemCode: "catalogs", title: "Catálogos", workspaceCode: "administration" }],
    ["/home/administration/integrations", { menuItemCode: "integrations", title: "Integraciones", workspaceCode: "administration" }],
    ["/home/administration/audit-logs", { menuItemCode: "audit-log", Page: SecurityAuditPage, title: "Auditoría", workspaceCode: "administration" }],
]);

/** Ruta inicial de cada perfil operativo al cambiar de espacio de trabajo. */
const WORKSPACE_HOME_PATH_BY_CODE: Readonly<Record<string, string>> = {
    accounting: "/home/accounting",
    administration: ADMINISTRATION_HOME_PATH,
    formalization: "/home/formalization",
    marketing: "/home/marketing",
    sales: "/home/sales",
};

/** Ruta privada registrada; undefined para login y para rutas desconocidas. */
export const getAppRoute = (path: string): AppRoute | undefined => APP_ROUTES.get(path);

/** Login y rutas privadas registradas. Cualquier otra URL se trata como "no encontrada". */
export const isKnownPath = (path: string): boolean => path === AUTH_LOGIN_PATH || APP_ROUTES.has(path);

/** Inicio de un perfil operativo. Un código sin ruta propia (como "all") cae en el inicio por defecto. */
export const getWorkspaceHomePath = (workspaceCode: string): string => WORKSPACE_HOME_PATH_BY_CODE[workspaceCode] ?? DEFAULT_HOME_PATH;

/**
 * Corrige la URL sin apilar historial.
 *
 * `replaceState` evita que Atrás vuelva a una ruta que el control de acceso ya rechazó.
 * También limpia query y hash, por ejemplo el `?microsoftStatus=` del callback.
 */
export const replaceBrowserPath = (path: string): void => {
    if (window.location.pathname !== path || window.location.search || window.location.hash) {
        window.history.replaceState(null, "", path);
    }
};
