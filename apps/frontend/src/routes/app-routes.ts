/**
 * Registro único de rutas privadas del CRM.
 *
 * Cada ruta declara perfil, ítem de menú y página. Login queda fuera de este
 * mapa porque es pública. Una URL que no está aquí se trata como no encontrada.
 */
import { type ComponentProps, type ComponentType, createElement } from "react";

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
import type { FormalizationSummaryPage as FormalizationSummaryPageComponent } from "../modules/home/FormalizationSummaryPage";
import type { MarketingHomePage as MarketingHomePageComponent } from "../modules/home/MarketingHomePage";
import type { IdentityProfile, IdentityUser } from "../services/auth/identity-contracts";
import type { CatalogCode } from "../services/catalogs/catalog-service";
import { createLazyRoute } from "./LazyRoute";

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
const FormalizationCalendarPage = createLazyRoute<object>(() => import("../modules/home/FormalizationCalendarPage").then((module) => ({ default: module.FormalizationCalendarPage })));
const FormalizationHomePage = createLazyRoute<ComponentProps<typeof FormalizationHomePageComponent>>(() => import("../modules/home/FormalizationHomePage").then((module) => ({ default: module.FormalizationHomePage })));
const FormalizationSummaryPage = createLazyRoute<ComponentProps<typeof FormalizationSummaryPageComponent>>(() => import("../modules/home/FormalizationSummaryPage").then((module) => ({ default: module.FormalizationSummaryPage })));
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
    ["/home/sales", { menuItemCode: "sales-home", title: "Ventas", workspaceCode: "sales" }],
    ["/home/marketing", { menuItemCode: "marketing-home", Page: MarketingHomePage, title: "Mercadeo", workspaceCode: "marketing" }],
    ["/home/marketing/leads", { menuItemCode: "marketing-leads", Page: MarketingLeadCapturePage, title: "Captación de leads", workspaceCode: "marketing" }],
    ["/home/formalization", { menuItemCode: "formalization-home", Page: FormalizationHomePage, title: "Formalización", workspaceCode: "formalization" }],
    ["/home/formalization/calendar", { menuItemCode: "formalization-calendar", Page: FormalizationCalendarPage, title: "Calendario", workspaceCode: "formalization" }],
    ["/home/formalization/orders", { menuItemCode: "formalization-management", Page: (props) => createElement(FormalizationHomePage, { ...props, initialView: "orders" }), title: "Gestión de formalizaciones", workspaceCode: "formalization" }],
    ["/home/formalization/summary", { menuItemCode: "formalization-summary", Page: FormalizationSummaryPage, title: "Resumen", workspaceCode: "formalization" }],
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

/** User navigation adds an entry; selecting the current path never duplicates it. */
export const pushBrowserPath = (path: string): void => {
    if (window.location.pathname !== path) {
        window.history.pushState(null, "", path);
    }
};
