/**
 * Registro único de rutas privadas del CRM.
 *
 * Cada ruta declara perfil, ítem de menú y página. Login queda fuera de este
 * mapa porque es pública. Una URL que no está aquí se trata como no encontrada.
 */
import { type ComponentProps, type ComponentType, createElement } from "react";

import type { BanksPage as BanksPageComponent } from "../modules/administration/banks/BanksPage";
import type { BrokersPage as BrokersPageComponent } from "../modules/administration/brokers/BrokersPage";
import type { CampaignsPage as CampaignsPageComponent } from "../modules/administration/campaigns/CampaignsPage";
import { ADMINISTRATION_CATALOGS } from "../modules/administration/catalogs/catalog-definitions";
import type { CatalogItemsPage as CatalogItemsPageComponent } from "../modules/administration/catalogs/CatalogItemsPage";
import type { ClassesPage as ClassesPageComponent } from "../modules/administration/classes/ClassesPage";
import type { LocationsPage as LocationsPageComponent } from "../modules/administration/locations/LocationsPage";
import type { AdministrationHomePage as AdministrationHomePageComponent } from "../modules/administration/pages/AdministrationHomePage";
import type { SecurityAuditPage as SecurityAuditPageComponent } from "../modules/administration/pages/SecurityAuditPage";
import type { SubsidiariesPage as SubsidiariesPageComponent } from "../modules/administration/subsidiaries/SubsidiariesPage";
import type { UnitFilesPage as UnitFilesPageComponent } from "../modules/administration/unit-files/UnitFilesPage";
import type { FormalizationHomePage as FormalizationHomePageComponent } from "../modules/home/FormalizationHomePage";
import type { MarketingHomePage as MarketingHomePageComponent } from "../modules/home/MarketingHomePage";
import type { IdentityProfile, IdentityUser } from "../services/auth/identity-contracts";
import type { CatalogCode } from "../services/catalogs/catalog-service";
import { createLazyRoute } from "./LazyRoute";

const LeadProfilePage = createLazyRoute<object>(() => import("../modules/leads/LeadProfilePage").then((module) => ({ default: module.LeadProfilePage })));

const BanksPage = createLazyRoute<ComponentProps<typeof BanksPageComponent>>(() => import("../modules/administration/banks/BanksPage").then((module) => ({ default: module.BanksPage })));
const BrokersPage = createLazyRoute<ComponentProps<typeof BrokersPageComponent>>(() => import("../modules/administration/brokers/BrokersPage").then((module) => ({ default: module.BrokersPage })));
const CampaignsPage = createLazyRoute<ComponentProps<typeof CampaignsPageComponent>>(() => import("../modules/administration/campaigns/CampaignsPage").then((module) => ({ default: module.CampaignsPage })));
const CatalogItemsPage = createLazyRoute<ComponentProps<typeof CatalogItemsPageComponent>>(() => import("../modules/administration/catalogs/CatalogItemsPage").then((module) => ({ default: module.CatalogItemsPage })));
const ClassesPage = createLazyRoute<ComponentProps<typeof ClassesPageComponent>>(() => import("../modules/administration/classes/ClassesPage").then((module) => ({ default: module.ClassesPage })));
const LocationsPage = createLazyRoute<ComponentProps<typeof LocationsPageComponent>>(() => import("../modules/administration/locations/LocationsPage").then((module) => ({ default: module.LocationsPage })));
const AdministrationHomePage = createLazyRoute<ComponentProps<typeof AdministrationHomePageComponent>>(() => import("../modules/administration/pages/AdministrationHomePage").then((module) => ({ default: module.AdministrationHomePage })));
const RolesSecurityPage = createLazyRoute<object>(() => import("../modules/administration/pages/RolesSecurityPage").then((module) => ({ default: module.RolesSecurityPage })));
const SecurityAuditPage = createLazyRoute<ComponentProps<typeof SecurityAuditPageComponent>>(() => import("../modules/administration/pages/SecurityAuditPage").then((module) => ({ default: module.SecurityAuditPage })));
const SystemUsersPage = createLazyRoute<object>(() => import("../modules/administration/pages/SystemUsersPage").then((module) => ({ default: module.SystemUsersPage })));
const SubsidiariesPage = createLazyRoute<ComponentProps<typeof SubsidiariesPageComponent>>(() => import("../modules/administration/subsidiaries/SubsidiariesPage").then((module) => ({ default: module.SubsidiariesPage })));
const UnitFilesPage = createLazyRoute<ComponentProps<typeof UnitFilesPageComponent>>(() => import("../modules/administration/unit-files/UnitFilesPage").then((module) => ({ default: module.UnitFilesPage })));
type CalendarRouteProps = { readonly effectivePermissions?: IdentityProfile["permissions"]; readonly onNavigate?: (path: string) => void };
const FormalizationCalendarPage = createLazyRoute<CalendarRouteProps>(() => import("../modules/home/FormalizationCalendarPage").then((module) => ({ default: module.FormalizationCalendarPage })));
const MarketingCalendarPage = createLazyRoute<CalendarRouteProps>(() => import("../modules/calendar/SharedCalendarPage").then((module) => ({ default: module.MarketingCalendarPage })));
const SalesCalendarPage = createLazyRoute<CalendarRouteProps>(() => import("../modules/calendar/SharedCalendarPage").then((module) => ({ default: module.SalesCalendarPage })));
const AccountingCalendarPage = createLazyRoute<CalendarRouteProps>(() => import("../modules/calendar/SharedCalendarPage").then((module) => ({ default: module.AccountingCalendarPage })));
const FormalizationHomePage = createLazyRoute<ComponentProps<typeof FormalizationHomePageComponent>>(() => import("../modules/home/FormalizationHomePage").then((module) => ({ default: module.FormalizationHomePage })));
const MarketingLeadCapturePage = createLazyRoute<{ readonly currentUser: IdentityUser }>(() => import("../modules/marketing/MarketingLeadCapturePage").then((module) => ({ default: module.MarketingLeadCapturePage })));
const MarketingHomePage = createLazyRoute<ComponentProps<typeof MarketingHomePageComponent>>(() => import("../modules/home/MarketingHomePage").then((module) => ({ default: module.MarketingHomePage })));

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
    readonly permissionCode?: string;
    /** Perfil operativo que debe ser visible con los permisos efectivos para abrir la ruta. */
    readonly workspaceCode: string;
    /** Título de la sección; se usa como placeholder mientras la ruta no tenga `Page` propia. */
    readonly title: string;
    readonly Page?: ComponentType<{ readonly currentUser: IdentityUser; readonly roles?: IdentityProfile["roles"]; readonly effectivePermissions?: IdentityProfile["permissions"]; readonly onNavigate?: (path: string) => void }>;
}

const CATALOG_CONTEXT_ROUTES = [
    { contextLabel: "Ventas", moduleCode: "ventas", pathPrefix: "/home/sales/catalogs", workspaceCode: "sales" },
    { contextLabel: "Mercadeo", moduleCode: "mercadeo", pathPrefix: "/home/marketing/catalogs", workspaceCode: "marketing" },
    { contextLabel: "Formalización", moduleCode: "formalizacion", pathPrefix: "/home/formalization/catalogs", workspaceCode: "formalization" },
    { contextLabel: "Contabilidad", moduleCode: "contabilidad", pathPrefix: "/home/accounting/catalogs", workspaceCode: "accounting" },
] as const;

const CATALOG_PAGES: Partial<Record<CatalogCode, typeof BrokersPage>> = {
    banks: BanksPage,
    brokers: BrokersPage,
    campaigns: CampaignsPage,
    classes: ClassesPage,
    files: UnitFilesPage,
    locations: LocationsPage,
    subsidiaries: SubsidiariesPage,
};

const OPERATIONAL_CATALOG_ROUTES = CATALOG_CONTEXT_ROUTES.flatMap((context) =>
    ADMINISTRATION_CATALOGS.map(
        (catalog) =>
            [
                `${context.pathPrefix}/${catalog.code}`,
                {
                    menuItemCode: `${context.workspaceCode}-${catalog.menuItemCode}`,
                    Page: () => createElement(CATALOG_PAGES[catalog.code] ?? CatalogItemsPage, { catalog, contextLabel: context.contextLabel, contextModuleCode: context.moduleCode }),
                    title: catalog.label,
                    workspaceCode: context.workspaceCode,
                },
            ] as const,
    ),
);

const APP_ROUTES: ReadonlyMap<string, AppRoute> = new Map<string, AppRoute>([
    ["/home/formalization/perfil", { menuItemCode: "lead-profile", permissionCode: "lead.profile.read", Page: LeadProfilePage, title: "Perfil del cliente", workspaceCode: "formalization" }],
    ["/perfil", { menuItemCode: "lead-profile", permissionCode: "lead.profile.read", Page: LeadProfilePage, title: "Perfil del cliente", workspaceCode: "formalization" }],
    ["/home/sales", { menuItemCode: "sales-home", title: "Ventas", workspaceCode: "sales" }],
    ["/home/marketing", { menuItemCode: "marketing-home", Page: MarketingHomePage, title: "Mercadeo", workspaceCode: "marketing" }],
    ["/home/marketing/leads", { menuItemCode: "marketing-leads", Page: MarketingLeadCapturePage, title: "Captación de leads", workspaceCode: "marketing" }],
    ["/home/formalization", { menuItemCode: "formalization-home", Page: FormalizationHomePage, title: "Formalización", workspaceCode: "formalization" }],
    ["/home/formalization/calendar", { menuItemCode: "formalization-calendar", Page: FormalizationCalendarPage, title: "Calendario", workspaceCode: "formalization" }],
    ["/home/marketing/calendar", { menuItemCode: "marketing-calendar", Page: MarketingCalendarPage, title: "Calendario", workspaceCode: "marketing" }],
    ["/home/sales/calendar", { menuItemCode: "sales-calendar", Page: SalesCalendarPage, title: "Calendario", workspaceCode: "sales" }],
    ["/home/accounting/calendar", { menuItemCode: "accounting-calendar", Page: AccountingCalendarPage, title: "Calendario", workspaceCode: "accounting" }],
    ["/home/formalization/orders", { menuItemCode: "formalization-management", Page: (props) => createElement(FormalizationHomePage, { ...props, initialView: "orders" }), title: "Gestión de formalizaciones", workspaceCode: "formalization" }],
    ["/home/formalization/files", { menuItemCode: "formalization-files", title: "Expedientes", workspaceCode: "formalization" }],
    ["/home/formalization/contracts", { menuItemCode: "formalization-contracts", title: "Contratos", workspaceCode: "formalization" }],
    ["/home/accounting", { menuItemCode: "accounting-home", title: "Contabilidad", workspaceCode: "accounting" }],
    [ADMINISTRATION_HOME_PATH, { menuItemCode: "admin-home", Page: AdministrationHomePage, title: "Administración", workspaceCode: "administration" }],
    ["/home/administration/users", { menuItemCode: "users", Page: SystemUsersPage, title: "Usuarios", workspaceCode: "administration" }],
    ["/home/administration/roles-security", { menuItemCode: "roles-permissions", Page: RolesSecurityPage, title: "Roles y seguridad", workspaceCode: "administration" }],
    ["/home/administration/catalogs", { menuItemCode: "catalogs", title: "Catálogos", workspaceCode: "administration" }],
    ...ADMINISTRATION_CATALOGS.map((catalog) => [catalog.path, { menuItemCode: catalog.menuItemCode, Page: () => createElement(CATALOG_PAGES[catalog.code] ?? CatalogItemsPage, { catalog }), title: catalog.label, workspaceCode: "administration" }] as const),
    ...OPERATIONAL_CATALOG_ROUTES,
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

/** Una consulta o un hash se aceptan solo en los calendarios y en el perfil del lead. El permiso sigue usando el ítem de menú registrado. */
export const getAppRoute = (path: string): AppRoute | undefined => {
    const exact = APP_ROUTES.get(path);
    if (exact) return exact;
    const calendar = APP_ROUTES.get(path.split(/[?#]/u)[0] ?? "");
    return calendar?.menuItemCode.endsWith("-calendar") || calendar?.permissionCode === "lead.profile.read" ? calendar : undefined;
};

/** Login y rutas privadas registradas. Cualquier otra URL se trata como "no encontrada". */
export const isKnownPath = (path: string): boolean => path === AUTH_LOGIN_PATH || getAppRoute(path) !== undefined;

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

/** La navegación de la persona compara la URL completa. Elegir Inicio limpia la consulta y el hash del registro, y no duplica una URL idéntica. */
export const pushBrowserPath = (path: string): void => {
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== path) {
        window.history.pushState(null, "", path);
    }
};
