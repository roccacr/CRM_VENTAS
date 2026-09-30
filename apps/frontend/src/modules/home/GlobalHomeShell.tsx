import "./GlobalHomeShell.css";

import ApiOutlined from "@ant-design/icons/ApiOutlined";
import AppstoreOutlined from "@ant-design/icons/AppstoreOutlined";
import AuditOutlined from "@ant-design/icons/AuditOutlined";
import BankOutlined from "@ant-design/icons/BankOutlined";
import BarChartOutlined from "@ant-design/icons/BarChartOutlined";
import BellOutlined from "@ant-design/icons/BellOutlined";
import BuildOutlined from "@ant-design/icons/BuildOutlined";
import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import ClockCircleOutlined from "@ant-design/icons/ClockCircleOutlined";
import CloseOutlined from "@ant-design/icons/CloseOutlined";
import ControlOutlined from "@ant-design/icons/ControlOutlined";
import CreditCardOutlined from "@ant-design/icons/CreditCardOutlined";
import DatabaseOutlined from "@ant-design/icons/DatabaseOutlined";
import DollarOutlined from "@ant-design/icons/DollarOutlined";
import DownOutlined from "@ant-design/icons/DownOutlined";
import FileDoneOutlined from "@ant-design/icons/FileDoneOutlined";
import FileSearchOutlined from "@ant-design/icons/FileSearchOutlined";
import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import FolderOpenOutlined from "@ant-design/icons/FolderOpenOutlined";
import HomeOutlined from "@ant-design/icons/HomeOutlined";
import LineChartOutlined from "@ant-design/icons/LineChartOutlined";
import LockOutlined from "@ant-design/icons/LockOutlined";
import LogoutOutlined from "@ant-design/icons/LogoutOutlined";
import MenuOutlined from "@ant-design/icons/MenuOutlined";
import MoreOutlined from "@ant-design/icons/MoreOutlined";
import PercentageOutlined from "@ant-design/icons/PercentageOutlined";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import RiseOutlined from "@ant-design/icons/RiseOutlined";
import ScheduleOutlined from "@ant-design/icons/ScheduleOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import ShoppingCartOutlined from "@ant-design/icons/ShoppingCartOutlined";
import TeamOutlined from "@ant-design/icons/TeamOutlined";
import UnorderedListOutlined from "@ant-design/icons/UnorderedListOutlined";
import UserOutlined from "@ant-design/icons/UserOutlined";
import WarningOutlined from "@ant-design/icons/WarningOutlined";
import type { FocusEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { buildApiUrl } from "../../config/frontend-env";

/** Ruta pública del logo. El shell no la resuelve por entorno. */
const ROCCA_LOGO_SRC = "/Logo/logo2.jpg";

/**
 * Tope del menú de CRM Tink antes de medir el ancho.
 *
 * Ese perfil tiene más ítems que la barra. Aunque sobre espacio, no muestra
 * más de siete; el resto entra en "Más".
 */
const CRM_PRIMARY_MENU_LIMIT = 7;

/**
 * Anchos heurísticos del menú de escritorio, en píxeles.
 *
 * Evitan medir cada ítem en el DOM en cada render. El mínimo de uno deja
 * siempre un acceso visible antes del desborde.
 */
const DEFAULT_MENU_ITEM_WIDTH = 112;
const MENU_OVERFLOW_ITEM_WIDTH = 96;
const MINIMUM_VISIBLE_MENU_ITEMS = 1;

/**
 * Tolerancia, en milisegundos, al cruzar del ítem al panel.
 *
 * El hueco entre el botón y el dropdown cerraría el menú si el cierre fuera
 * inmediato. El puente visual y este retardo cubren ese recorrido.
 */
const MENU_CLOSE_DELAY_MS = 450;

const PROFILE_PHOTO_REFRESH_QUERY = "refresh";
const PROFILE_PHOTO_REFRESH_VALUE = "1";

/**
 * Opción de un menú desplegable.
 *
 * `requiredPermission` solo decide si la opción se pinta. No autoriza la ruta.
 */
export interface GlobalMenuOption {
    readonly code: string;
    readonly label: string;
    readonly description?: string;
    readonly isActive?: boolean;
    readonly requiredPermission: string;
    readonly icon: ReactNode;
}

/**
 * Ítem de la barra de un perfil.
 *
 * `hideChevron` permite un padre con hijos sin flecha. Hoy ningún ítem lo
 * activa; el dropdown sigue existiendo si hay `children`.
 */
export interface GlobalMenuItem {
    readonly code: string;
    readonly label: string;
    readonly icon: ReactNode;
    readonly isActive?: boolean;
    readonly requiredPermission?: string;
    readonly hideChevron?: boolean;
    readonly children?: readonly GlobalMenuOption[];
}

/**
 * Perfil operativo que el usuario puede alternar en el selector.
 *
 * "Todos" no es un módulo de negocio: agrupa los perfiles que sobrevivieron
 * al filtro de permisos.
 */
export interface WorkspaceProfile {
    readonly code: string;
    readonly label: string;
    readonly description: string;
    readonly icon: ReactNode;
    readonly menuItems: readonly GlobalMenuItem[];
}

/**
 * Permiso efectivo en el formato que debe devolver `/identity/me`.
 *
 * `deny` gana sobre `allow` del mismo código, sin importar el orden de la lista.
 */
export interface EffectiveNavigationPermission {
    readonly code: string;
    readonly effect: "allow" | "deny";
}

/**
 * Contratos internos de la vista.
 *
 * Describen props, filas y paneles. No salen del módulo y no autorizan acciones.
 */
interface HeaderAction {
    readonly label: string;
    readonly icon: ReactNode;
    readonly badge?: string;
}

export interface GlobalHomeCurrentUser {
    readonly displayName: string;
    readonly email: string;
    readonly profileImageUrl: string | null;
}

interface GlobalMenuNodeProps {
    readonly item: GlobalMenuItem;
    readonly isOpen: boolean;
    readonly onBlur: (event: FocusEvent<HTMLDivElement>) => void;
    readonly onClose: () => void;
    readonly onOpenChange: (code: string | null) => void;
}

interface GlobalMenuDropdownProps {
    readonly id: string;
    readonly isOpen: boolean;
    readonly label: string;
    readonly onPointerEnter: () => void;
    readonly onPointerLeave: () => void;
    readonly options: readonly GlobalMenuOption[];
}

interface GlobalMenuChevronProps {
    readonly isVisible: boolean;
}

interface WorkspaceSelectorProps {
    readonly activeWorkspace: WorkspaceProfile;
    readonly assignedWorkspaces: readonly WorkspaceProfile[];
    readonly isOpen: boolean;
    readonly onOpenChange: (isOpen: boolean) => void;
    readonly onSelect: (code: string) => void;
}

interface MobileAppBarProps {
    readonly onMenuOpen: () => void;
    readonly user: GlobalHomeCurrentUser | undefined;
}

interface MobileNavigationDrawerProps {
    readonly activeWorkspace: WorkspaceProfile;
    readonly assignedWorkspaces: readonly WorkspaceProfile[];
    readonly isOpen: boolean;
    readonly openWorkspaceCode: string;
    readonly onClose: () => void;
    readonly onLogout: (() => void) | undefined;
    readonly onSelect: (code: string) => void;
    readonly onWorkspaceToggle: (code: string) => void;
    readonly user: GlobalHomeCurrentUser | undefined;
}

interface DashboardMetric {
    readonly label: string;
    readonly value: string;
    readonly trend: string;
    readonly tone: "positive" | "negative" | "neutral";
    readonly helper: string;
    readonly icon: ReactNode;
}

interface PipelineStage {
    readonly label: string;
    readonly value: number;
    readonly conversion: string;
}

interface DashboardTableRow {
    readonly primary: string;
    readonly secondary: string;
    readonly amount: string;
    readonly status: string;
    readonly statusTone: "info" | "success" | "warning" | "danger" | "neutral";
    readonly owner: string;
}

interface DashboardTable {
    readonly title: string;
    readonly description: string;
    readonly headers: readonly [string, string, string, string, string];
    readonly rows: readonly DashboardTableRow[];
    readonly footerAction: string;
}

interface AgendaTask {
    readonly time: string;
    readonly title: string;
    readonly priority: "Alta" | "Media" | "Normal";
}

interface ProjectMotion {
    readonly name: string;
    readonly detail: string;
    readonly progress: string;
}

interface DashboardFilter {
    readonly label: string;
    readonly icon?: ReactNode;
}

/**
 * Lienzo visual de un perfil.
 *
 * Con `isPlaceholder` el shell pinta solo el título. El resto de campos queda
 * listo para cuando el dashboard deje de ser demostración.
 */
interface DashboardContent {
    readonly isPlaceholder?: boolean;
    readonly eyebrow: string;
    readonly title: string;
    readonly subtitle: string;
    readonly filters: readonly DashboardFilter[];
    readonly primaryAction: string;
    readonly metrics: readonly DashboardMetric[];
    readonly pipelineTitle: string;
    readonly pipelineDescription: string;
    readonly pipelineUpdated: string;
    readonly pipelineScaleLabel: string;
    readonly pipelineStages: readonly PipelineStage[];
    readonly table: DashboardTable;
    readonly tasksTitle: string;
    readonly tasksDescription: string;
    readonly tasks: readonly AgendaTask[];
    readonly motionTitle: string;
    readonly motionDescription: string;
    readonly motionLabel: string;
    readonly motion: readonly ProjectMotion[];
}

interface DashboardCanvasProps {
    readonly content: DashboardContent;
    /** Payload crudo de sesión para inspección visual. El shell no lo interpreta. */
    readonly sessionDebugPayload?: unknown;
}

/**
 * Entrada del shell.
 *
 * Sin permisos usa el set demo, que hoy permite todo el catálogo. El volcado
 * de sesión es opcional y solo lo muestra el resumen global en placeholder.
 */
export interface GlobalHomeShellProps {
    readonly currentUser?: GlobalHomeCurrentUser;
    readonly effectivePermissions?: readonly EffectiveNavigationPermission[];
    readonly initialWorkspaceCode?: string;
    readonly onLogout?: () => void;
    readonly onWorkspaceChange?: (code: string) => void;
    readonly sessionDebugPayload?: unknown;
}

/**
 * Catálogo visual de perfiles y menús.
 *
 * El primer elemento es "Todos". Su menú estático no es el que se pinta: el
 * visible se reconstruye desde los perfiles filtrados. Estos códigos sí entran
 * al set demo de permisos y deben coincidir con `/identity/me`.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Contrato de navegacion probado sin cambiar el comportamiento visual del shell.
export const ASSIGNED_WORKSPACES: readonly [WorkspaceProfile, ...WorkspaceProfile[]] = [
    {
        code: "all",
        label: "Todos",
        description: "Vista visual completa para TI y jefatura global.",
        icon: <HomeOutlined />,
        menuItems: [
            { code: "all-dashboard", label: "Resumen Global", icon: <HomeOutlined />, isActive: true, requiredPermission: "global.dashboard.read" },
            {
                code: "all-crm",
                label: "CRM Tink",
                icon: <TeamOutlined />,
                requiredPermission: "crm.dashboard.read",
                children: [
                    { code: "all-crm-leads", label: "Leads", description: "Prospectos y seguimiento comercial.", icon: <TeamOutlined />, requiredPermission: "crm.leads.read" },
                    { code: "all-crm-outlook-calendar", label: "Calendario Outlook", description: "Agenda corporativa y citas comerciales.", icon: <ScheduleOutlined />, requiredPermission: "crm.outlook_calendar.read" },
                    { code: "all-crm-customer-files", label: "Expedientes", description: "Documentos y trazabilidad del cliente.", icon: <FolderOpenOutlined />, requiredPermission: "crm.customer_files.read" },
                    { code: "all-crm-event-list", label: "Lista de Eventos", description: "Eventos comerciales y actividades de captación.", icon: <UnorderedListOutlined />, requiredPermission: "crm.events.read" },
                    { code: "all-crm-commission-report", label: "Reporte de Comisiones", description: "Comisiones, cortes y revisión comercial.", icon: <PercentageOutlined />, requiredPermission: "crm.commissions.read" },
                    { code: "all-crm-opportunities", label: "Oportunidades", description: "Pipeline y negociación activa.", icon: <RiseOutlined />, requiredPermission: "crm.opportunities.read" },
                    { code: "all-crm-sales-orders", label: "Órdenes de Venta", description: "Órdenes comerciales y aprobaciones.", icon: <ShoppingCartOutlined />, requiredPermission: "crm.sales_orders.read" },
                    { code: "all-crm-tickets", label: "Tickets", description: "Solicitudes y casos de soporte operativo.", icon: <CheckCircleOutlined />, requiredPermission: "crm.tickets.read" },
                ],
            },
            {
                code: "all-finance",
                label: "Finanzas",
                icon: <DollarOutlined />,
                requiredPermission: "finance.dashboard.read",
                children: [
                    { code: "all-finance-collections", label: "Cobros Pendientes", description: "Seguimiento de cartera y promesas de pago.", icon: <DollarOutlined />, requiredPermission: "finance.collections.read" },
                    { code: "all-finance-account-status", label: "Estados de Cuenta", description: "Saldos y movimientos por cliente.", icon: <FileTextOutlined />, requiredPermission: "finance.account_status.read" },
                    { code: "all-finance-invoices", label: "Facturación", description: "Documentos fiscales y cargos emitidos.", icon: <FileDoneOutlined />, requiredPermission: "finance.invoices.read" },
                    { code: "all-finance-portfolio", label: "Cartera Vencida", description: "Riesgos de mora y gestión prioritaria.", icon: <BarChartOutlined />, requiredPermission: "finance.portfolio.read" },
                    { code: "all-finance-reconciliation", label: "Conciliación Bancaria", description: "Cruce de bancos contra registros CRM.", icon: <BankOutlined />, requiredPermission: "finance.reconciliation.read" },
                ],
            },
            {
                code: "all-marketing",
                label: "Mercadeo",
                icon: <CalendarOutlined />,
                requiredPermission: "marketing.dashboard.read",
                children: [
                    { code: "all-marketing-campaigns", label: "Campañas", description: "Planificación y ejecución de campañas.", icon: <CalendarOutlined />, requiredPermission: "marketing.campaigns.read" },
                    { code: "all-marketing-sources", label: "Orígenes de Leads", description: "Canales, fuentes y calidad de captación.", icon: <ControlOutlined />, requiredPermission: "marketing.sources.read" },
                    { code: "all-marketing-incoming-leads", label: "Leads Entrantes", description: "Entradas nuevas por canal comercial.", icon: <TeamOutlined />, requiredPermission: "marketing.incoming_leads.read" },
                    { code: "all-marketing-content", label: "Piezas y Materiales", description: "Recursos de campaña y materiales vigentes.", icon: <FileTextOutlined />, requiredPermission: "marketing.content.read" },
                    { code: "all-marketing-metrics", label: "Métricas de Captación", description: "Rendimiento de campañas y conversión.", icon: <BarChartOutlined />, requiredPermission: "marketing.metrics.read" },
                ],
            },
            {
                code: "all-formalization",
                label: "Formalización",
                icon: <FileDoneOutlined />,
                requiredPermission: "formalization.dashboard.read",
                children: [
                    { code: "all-formalization-contract-review", label: "Revisión de Contratos", description: "Contratos en control legal y operativo.", icon: <FileTextOutlined />, requiredPermission: "formalization.contracts.read" },
                    { code: "all-formalization-bank-approval", label: "Aprobaciones Banco", description: "Trámites bancarios y aprobaciones pendientes.", icon: <BankOutlined />, requiredPermission: "formalization.bank.read" },
                    { code: "all-formalization-signatures", label: "Firmas Pendientes", description: "Documentos listos para firma y cierre.", icon: <FileDoneOutlined />, requiredPermission: "formalization.signatures.read" },
                    { code: "all-formalization-handover", label: "Entrega y Traspaso", description: "Entregas, traspasos y cierres operativos.", icon: <CheckCircleOutlined />, requiredPermission: "formalization.handover.read" },
                ],
            },
            {
                code: "all-administration",
                label: "Administración",
                icon: <BuildOutlined />,
                requiredPermission: "admin.dashboard.read",
                children: [
                    { code: "all-admin-users", label: "Usuarios y Cuentas", description: "Gestión de cuentas, correos y estados.", icon: <UserOutlined />, requiredPermission: "settings.users.read" },
                    { code: "all-admin-roles", label: "Roles y Seguridad", description: "Matriz de permisos y restricciones.", icon: <LockOutlined />, requiredPermission: "settings.permissions.read" },
                    { code: "all-admin-catalogs", label: "Catálogos del CRM", description: "Listas, fases, estados y parámetros.", icon: <DatabaseOutlined />, requiredPermission: "settings.catalogs.read" },
                    { code: "all-admin-integrations", label: "Integraciones API", description: "Conexiones con canales y servicios externos.", icon: <ApiOutlined />, requiredPermission: "settings.integrations.read" },
                    { code: "all-admin-audit-log", label: "Auditoría y Logs", description: "Actividad del sistema y cambios relevantes.", icon: <AuditOutlined />, requiredPermission: "settings.audit.read" },
                ],
            },
        ],
    },
    {
        code: "crm-tink",
        label: "CRM Tink",
        description: "Perfil comercial principal.",
        icon: <TeamOutlined />,
        menuItems: [
            { code: "dashboard", label: "Resumen Comercial", icon: <HomeOutlined />, isActive: true, requiredPermission: "crm.dashboard.read" },
            { code: "leads", label: "Leads", icon: <TeamOutlined />, requiredPermission: "crm.leads.read" },
            { code: "outlook-calendar", label: "Calendario Outlook", icon: <ScheduleOutlined />, requiredPermission: "crm.outlook_calendar.read" },
            { code: "customer-files", label: "Expedientes", icon: <FolderOpenOutlined />, requiredPermission: "crm.customer_files.read" },
            { code: "event-list", label: "Lista de Eventos", icon: <UnorderedListOutlined />, requiredPermission: "crm.events.read" },
            { code: "commission-report", label: "Reporte de Comisiones", icon: <PercentageOutlined />, requiredPermission: "crm.commissions.read" },
            { code: "opportunities", label: "Oportunidades", icon: <RiseOutlined />, requiredPermission: "crm.opportunities.read" },
            { code: "sales-orders", label: "Órdenes de Venta", icon: <ShoppingCartOutlined />, requiredPermission: "crm.sales_orders.read" },
            { code: "tickets", label: "Tickets", icon: <CheckCircleOutlined />, requiredPermission: "crm.tickets.read" },
        ],
    },
    {
        code: "finance",
        label: "Finanzas",
        description: "Cobros, cartera y conciliaciones.",
        icon: <DollarOutlined />,
        menuItems: [
            { code: "finance-home", label: "Resumen Financiero", icon: <HomeOutlined />, isActive: true, requiredPermission: "finance.dashboard.read" },
            { code: "collections", label: "Cobros Pendientes", icon: <DollarOutlined />, requiredPermission: "finance.collections.read" },
            { code: "account-status", label: "Estados de Cuenta", icon: <FileTextOutlined />, requiredPermission: "finance.account_status.read" },
            { code: "invoices", label: "Facturación", icon: <FileDoneOutlined />, requiredPermission: "finance.invoices.read" },
            { code: "portfolio", label: "Cartera Vencida", icon: <BarChartOutlined />, requiredPermission: "finance.portfolio.read" },
            { code: "reconciliation", label: "Conciliación Bancaria", icon: <BankOutlined />, requiredPermission: "finance.reconciliation.read" },
        ],
    },
    {
        code: "marketing",
        label: "Mercadeo",
        description: "Campañas, canales y captación.",
        icon: <CalendarOutlined />,
        menuItems: [
            { code: "marketing-home", label: "Resumen Mercadeo", icon: <HomeOutlined />, isActive: true, requiredPermission: "marketing.dashboard.read" },
            { code: "campaigns", label: "Campañas", icon: <CalendarOutlined />, requiredPermission: "marketing.campaigns.read" },
            { code: "sources", label: "Orígenes de Leads", icon: <ControlOutlined />, requiredPermission: "marketing.sources.read" },
            { code: "incoming-leads", label: "Leads Entrantes", icon: <TeamOutlined />, requiredPermission: "marketing.incoming_leads.read" },
            { code: "content", label: "Piezas y Materiales", icon: <FileTextOutlined />, requiredPermission: "marketing.content.read" },
            { code: "metrics", label: "Métricas de Captación", icon: <BarChartOutlined />, requiredPermission: "marketing.metrics.read" },
        ],
    },
    {
        code: "formalization",
        label: "Formalización",
        description: "Contratos, aprobaciones y cierre.",
        icon: <FileDoneOutlined />,
        menuItems: [
            { code: "formalization-home", label: "Resumen Formalización", icon: <HomeOutlined />, isActive: true, requiredPermission: "formalization.dashboard.read" },
            { code: "contract-review", label: "Revisión de Contratos", icon: <FileTextOutlined />, requiredPermission: "formalization.contracts.read" },
            { code: "bank-approval", label: "Aprobaciones Banco", icon: <BankOutlined />, requiredPermission: "formalization.bank.read" },
            { code: "signatures", label: "Firmas Pendientes", icon: <FileDoneOutlined />, requiredPermission: "formalization.signatures.read" },
            { code: "handover", label: "Entrega y Traspaso", icon: <CheckCircleOutlined />, requiredPermission: "formalization.handover.read" },
        ],
    },
    {
        code: "administration",
        label: "Administración",
        description: "Usuarios, seguridad e integraciones.",
        icon: <BuildOutlined />,
        menuItems: [
            { code: "admin-home", label: "Resumen Administración", icon: <HomeOutlined />, isActive: true, requiredPermission: "admin.dashboard.read" },
            { code: "users", label: "Usuarios y Cuentas", icon: <UserOutlined />, requiredPermission: "settings.users.read" },
            { code: "roles-permissions", label: "Roles y Seguridad", icon: <LockOutlined />, requiredPermission: "settings.permissions.read" },
            { code: "catalogs", label: "Catálogos del CRM", icon: <DatabaseOutlined />, requiredPermission: "settings.catalogs.read" },
            { code: "integrations", label: "Integraciones API", icon: <ApiOutlined />, requiredPermission: "settings.integrations.read" },
            { code: "audit-log", label: "Auditoría y Logs", icon: <AuditOutlined />, requiredPermission: "settings.audit.read" },
        ],
    },
];

/** Reúne el permiso del ítem y el de cada hijo. Un código vacío no entra al set. */
const collectMenuPermissions = (items: readonly GlobalMenuItem[]): readonly string[] => items.flatMap((item) => [item.requiredPermission, ...(item.children?.map((child) => child.requiredPermission) ?? [])]).filter((permissionCode): permissionCode is string => Boolean(permissionCode));

/** Une los códigos de todos los perfiles y elimina repetidos entre "Todos" y cada módulo. */
const collectWorkspacePermissions = (workspaces: readonly WorkspaceProfile[]): readonly string[] => Array.from(new Set(workspaces.flatMap((workspace) => collectMenuPermissions(workspace.menuItems))));

/**
 * Permisos demo hasta conectar `/identity/me`.
 *
 * Hoy todos son `allow`, así que el shell muestra el catálogo completo. El
 * filtro real ya entiende `deny`.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Permisos demo exportados para validar el filtro de UX hasta conectar /identity/me.
export const DEMO_EFFECTIVE_NAVIGATION_PERMISSIONS: readonly EffectiveNavigationPermission[] = collectWorkspacePermissions(ASSIGNED_WORKSPACES).map((code) => ({
    code,
    effect: "allow",
}));

/**
 * Resuelve la lista efectiva a un set de códigos visibles.
 *
 * Un `deny` borra un `allow` previo y bloquea un `allow` posterior del mismo
 * código. La UX no promedia permisos de rol y directos: la denegación gana.
 */
const getAllowedPermissionCodes = (permissions: readonly EffectiveNavigationPermission[]): ReadonlySet<string> => {
    const allowedPermissions = new Set<string>();
    const deniedPermissions = new Set<string>();

    for (const permission of permissions) {
        if (permission.effect === "deny") {
            deniedPermissions.add(permission.code);
            allowedPermissions.delete(permission.code);

            continue;
        }

        if (!deniedPermissions.has(permission.code)) {
            allowedPermissions.add(permission.code);
        }
    }

    return allowedPermissions;
};

/** Un código ausente no es visible. El padre sin permiso se trata aparte, en el filtro del ítem. */
const isPermissionAllowed = (permissionCode: string | undefined, allowedPermissions: ReadonlySet<string>): boolean => Boolean(permissionCode && allowedPermissions.has(permissionCode));

/**
 * Conserva un ítem actual después de filtrar.
 *
 * Si algún ítem o hijo ya trae `isActive`, no se mueve. Si el filtro se llevó
 * el activo, el primero que quedó recibe el estado para no dejar la barra sin página actual.
 */
const markFirstVisibleItemAsActive = (items: readonly GlobalMenuItem[]): readonly GlobalMenuItem[] => {
    if (items.some((item) => Boolean(item.isActive || item.children?.some((child) => child.isActive))) || items.length === 0) {
        return items;
    }

    const firstItem = items[0];

    if (!firstItem) {
        return items;
    }

    return [{ ...firstItem, isActive: true }, ...items.slice(1)];
};

/**
 * Oculta un ítem cuando ni él ni sus hijos están permitidos.
 *
 * Un padre sin permiso propio sigue visible si queda al menos un hijo. Un
 * padre sin `requiredPermission` se muestra y sus hijos se filtran uno a uno.
 */
const filterMenuItemByPermissions = (item: GlobalMenuItem, allowedPermissions: ReadonlySet<string>): GlobalMenuItem | null => {
    const visibleChildren = item.children?.filter((child) => isPermissionAllowed(child.requiredPermission, allowedPermissions)) ?? [];
    const hasVisibleChildren = visibleChildren.length > 0;
    const canReadItem = item.requiredPermission ? isPermissionAllowed(item.requiredPermission, allowedPermissions) : true;

    if (!canReadItem && !hasVisibleChildren) {
        return null;
    }

    if (!item.children) {
        return item;
    }

    return {
        ...item,
        children: visibleChildren,
    };
};

/**
 * Quita el perfil completo cuando ningún ítem sobrevive.
 *
 * El menú resultante vuelve a marcar un activo para no perder `aria-current`.
 */
const filterWorkspaceByPermissions = (workspace: WorkspaceProfile, allowedPermissions: ReadonlySet<string>): WorkspaceProfile | null => {
    const visibleMenuItems = workspace.menuItems.flatMap((item) => {
        const visibleItem = filterMenuItemByPermissions(item, allowedPermissions);

        return visibleItem ? [visibleItem] : [];
    });

    if (visibleMenuItems.length === 0) {
        return null;
    }

    return {
        ...workspace,
        menuItems: markFirstVisibleItemAsActive(visibleMenuItems),
    };
};

/**
 * Reconstruye "Todos" desde los perfiles ya filtrados.
 *
 * Solo conserva el resumen global del catálogo estático, y solo si su permiso
 * pasó. Cada módulo aporta sus ítems con permiso; uno sin código no entra como hijo.
 */
const buildAllWorkspace = (allWorkspace: WorkspaceProfile, moduleWorkspaces: readonly WorkspaceProfile[], allowedPermissions: ReadonlySet<string>): WorkspaceProfile | null => {
    const globalSummaryItem = allWorkspace.menuItems[0];
    const visibleGlobalItems: readonly GlobalMenuItem[] = globalSummaryItem && isPermissionAllowed(globalSummaryItem.requiredPermission, allowedPermissions) ? [globalSummaryItem] : [];
    const moduleMenuItems = moduleWorkspaces.map((workspace): GlobalMenuItem => {
        const primaryMenuItem = workspace.menuItems[0];
        const visibleChildren = workspace.menuItems.flatMap(({ code, label, icon, isActive, requiredPermission }): readonly GlobalMenuOption[] => (requiredPermission ? [{ code, label, icon, ...(isActive === undefined ? {} : { isActive }), requiredPermission }] : []));

        return {
            code: `all-${workspace.code}`,
            label: workspace.label,
            icon: workspace.icon,
            ...(primaryMenuItem?.requiredPermission ? { requiredPermission: primaryMenuItem.requiredPermission } : {}),
            children: visibleChildren,
        };
    });
    const menuItems = markFirstVisibleItemAsActive([...visibleGlobalItems, ...moduleMenuItems]);

    if (menuItems.length === 0) {
        return null;
    }

    return {
        ...allWorkspace,
        menuItems,
    };
};

/**
 * Devuelve los perfiles que la UX puede mostrar.
 *
 * "Todos" va primero cuando queda algo que agrupar. Si el filtro vacía todos
 * los módulos, la lista sale vacía: no se rellena con el catálogo sin filtrar.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Funcion pura cubierta por pruebas para el contrato de permisos efectivos.
export const getVisibleNavigationWorkspaces = (permissions: readonly EffectiveNavigationPermission[], workspaces: readonly [WorkspaceProfile, ...WorkspaceProfile[]] = ASSIGNED_WORKSPACES): readonly WorkspaceProfile[] => {
    const allowedPermissions = getAllowedPermissionCodes(permissions);
    const [allWorkspace, ...moduleWorkspaces] = workspaces;
    const visibleModuleWorkspaces = moduleWorkspaces.flatMap((workspace) => {
        const visibleWorkspace = filterWorkspaceByPermissions(workspace, allowedPermissions);

        return visibleWorkspace ? [visibleWorkspace] : [];
    });
    const visibleAllWorkspace = buildAllWorkspace(allWorkspace, visibleModuleWorkspaces, allowedPermissions);

    return visibleAllWorkspace ? [visibleAllWorkspace, ...visibleModuleWorkspaces] : visibleModuleWorkspaces;
};

/** Acciones de cabecera todavía visuales. El badge no es un conteo del API. */
const HEADER_ACTIONS: readonly HeaderAction[] = [
    { label: "Notificaciones", icon: <BellOutlined />, badge: "5" },
    { label: "Aplicaciones", icon: <AppstoreOutlined /> },
];

/**
 * Dashboard de demostración de CRM Tink.
 *
 * Los montos, fechas y nombres son fijos. No vienen del API y no deben leerse
 * como indicadores reales.
 */
const CRM_DASHBOARD_CONTENT: DashboardContent = {
    isPlaceholder: true,
    eyebrow: "Inicio / CRM Tink / Resumen",
    title: "Resumen Comercial",
    subtitle: "Indicadores de captación, negociación y cierre de CRM Tink.",
    filters: [{ label: "Todos los proyectos" }, { label: "Este mes · Sep 2026", icon: <CalendarOutlined /> }],
    primaryAction: "Nuevo Lead",
    metrics: [
        { label: "Ventas del mes", value: "$1,420,000", trend: "+12.5%", tone: "positive", helper: "vs. mes anterior", icon: <DollarOutlined /> },
        { label: "Leads activos", value: "184", trend: "+4.2%", tone: "positive", helper: "en seguimiento", icon: <TeamOutlined /> },
        { label: "Formalizaciones", value: "12", trend: "-1.8%", tone: "negative", helper: "este periodo", icon: <FileDoneOutlined /> },
        { label: "Cobros pendientes", value: "$285,000", trend: "8", tone: "neutral", helper: "facturas por vencer", icon: <ClockCircleOutlined /> },
        { label: "Citas agendadas", value: "28", trend: "+6", tone: "positive", helper: "para esta semana", icon: <ScheduleOutlined /> },
        { label: "Conversión a cierre", value: "17.8%", trend: "+2.1%", tone: "positive", helper: "pipeline activo", icon: <RiseOutlined /> },
    ],
    pipelineTitle: "Embudo comercial",
    pipelineDescription: "Distribución visual de oportunidades por etapa.",
    pipelineUpdated: "Actualizado hoy",
    pipelineScaleLabel: "Barras proporcionales al volumen; porcentaje vs. etapa anterior.",
    pipelineStages: [
        { label: "Prospectos", value: 45, conversion: "100%" },
        { label: "Visita a proyecto", value: 28, conversion: "62%" },
        { label: "Cotización enviada", value: 18, conversion: "64%" },
        { label: "Reservado", value: 12, conversion: "67%" },
        { label: "Cierre / filtro", value: 8, conversion: "67%" },
    ],
    table: {
        title: "Negociaciones recientes",
        description: "Actividad comercial prioritaria para seguimiento.",
        headers: ["Cliente", "Proyecto", "Monto", "Estado", "Asignado a"],
        footerAction: "Ver todas las negociaciones",
        rows: [
            { primary: "Mariana Córdoba", secondary: "Terraviva", amount: "$245,000", status: "En negociación", statusTone: "info", owner: "Ventas Norte" },
            { primary: "Grupo Altair", secondary: "City Place", amount: "$410,000", status: "Apartado", statusTone: "success", owner: "Equipo Corporativo" },
            { primary: "Roberto Zúñiga", secondary: "Natura", amount: "$188,000", status: "Pendiente firma", statusTone: "warning", owner: "Formalización" },
            { primary: "Inversiones Loma", secondary: "Terraviva", amount: "$315,000", status: "En negociación", statusTone: "info", owner: "Ventas Sur" },
        ],
    },
    tasksTitle: "Tareas del día",
    tasksDescription: "Seguimientos próximos.",
    tasks: [
        { time: "10:30", title: "Llamada de seguimiento - Terraviva", priority: "Alta" },
        { time: "13:00", title: "Revisar cotización corporativa", priority: "Media" },
        { time: "15:30", title: "Confirmar visita a proyecto", priority: "Normal" },
    ],
    motionTitle: "Mayor movimiento",
    motionDescription: "Proyectos con actividad destacada.",
    motionLabel: "de captación",
    motion: [
        { name: "Terraviva", detail: "Mayor captación semanal", progress: "78%" },
        { name: "City Place", detail: "Reservas activas", progress: "64%" },
        { name: "Natura", detail: "Seguimiento comercial", progress: "51%" },
    ],
};

/**
 * Lienzo por código de perfil.
 *
 * Todos los cortes actuales llevan `isPlaceholder`, así que el canvas rico no
 * se pinta. Formalización reutiliza las cifras de CRM hasta tener las suyas.
 * Administración deja filtros y acción vacíos a propósito en este corte.
 */
const DASHBOARD_CONTENT_BY_WORKSPACE: Record<string, DashboardContent> = {
    all: {
        isPlaceholder: true,
        eyebrow: "Inicio / Todos / Resumen",
        title: "Resumen Global",
        subtitle: "Vista ejecutiva visual de los perfiles asignados y sus frentes operativos.",
        filters: [{ label: "Este mes · Sep 2026", icon: <CalendarOutlined /> }],
        primaryAction: "Nueva gestión",
        metrics: [
            { label: "Ingresos proyectados", value: "$1,920,000", trend: "+9.8%", tone: "positive", helper: "visión consolidada", icon: <DollarOutlined /> },
            { label: "Leads activos", value: "248", trend: "+6.1%", tone: "positive", helper: "entre perfiles", icon: <TeamOutlined /> },
            { label: "Procesos críticos", value: "17", trend: "-3.2%", tone: "positive", helper: "menos pendientes críticos", icon: <WarningOutlined /> },
            { label: "Tareas pendientes", value: "34", trend: "Hoy", tone: "neutral", helper: "agenda operativa", icon: <ClockCircleOutlined /> },
            { label: "Cartera por vencer", value: "$96,500", trend: "-5.1%", tone: "positive", helper: "riesgo controlado", icon: <CreditCardOutlined /> },
            { label: "Campañas activas", value: "9", trend: "+2", tone: "positive", helper: "captación vigente", icon: <LineChartOutlined /> },
        ],
        pipelineTitle: "Flujo operativo global",
        pipelineDescription: "Lectura visual de actividad por frente de trabajo.",
        pipelineUpdated: "Vista consolidada",
        pipelineScaleLabel: "Barras proporcionales al frente con mayor actividad.",
        pipelineStages: [
            { label: "CRM Tink", value: 184, conversion: "100%" },
            { label: "Finanzas", value: 72, conversion: "39%" },
            { label: "Mercadeo", value: 56, conversion: "30%" },
            { label: "Formalización", value: 24, conversion: "13%" },
            { label: "Administración", value: 11, conversion: "6%" },
        ],
        table: {
            title: "Movimientos recientes",
            description: "Actividad prioritaria agrupada para revisión ejecutiva.",
            headers: ["Frente", "Referencia", "Monto", "Estado", "Responsable"],
            footerAction: "Ver todo el movimiento",
            rows: [
                { primary: "CRM Tink", secondary: "Terraviva", amount: "$245,000", status: "En negociación", statusTone: "info", owner: "Ventas Norte" },
                { primary: "Finanzas", secondary: "Cuenta corporativa", amount: "$82,400", status: "Por cobrar", statusTone: "warning", owner: "Cobros" },
                { primary: "Mercadeo", secondary: "Meta Ads", amount: "$14,200", status: "Activa", statusTone: "success", owner: "Mercadeo" },
                { primary: "Formalización", secondary: "Contrato Natura", amount: "$188,000", status: "Pendiente firma", statusTone: "warning", owner: "Legal" },
            ],
        },
        tasksTitle: "Agenda prioritaria",
        tasksDescription: "Actividades cruzadas del día.",
        tasks: [
            { time: "09:30", title: "Revisión semanal de pipeline", priority: "Alta" },
            { time: "11:00", title: "Validar cartera por vencer", priority: "Media" },
            { time: "15:00", title: "Alinear campañas activas", priority: "Normal" },
        ],
        motionTitle: "Frentes destacados",
        motionDescription: "Actividad relativa por perfil.",
        motionLabel: "de actividad",
        motion: [
            { name: "CRM Tink", detail: "Mayor operación diaria", progress: "82%" },
            { name: "Finanzas", detail: "Gestión de cartera", progress: "68%" },
            { name: "Mercadeo", detail: "Captación activa", progress: "57%" },
        ],
    },
    "crm-tink": CRM_DASHBOARD_CONTENT,
    finance: {
        isPlaceholder: true,
        eyebrow: "Inicio / Finanzas / Resumen",
        title: "Resumen Financiero",
        subtitle: "Cobranza, facturación, cartera y conciliación bancaria.",
        filters: [{ label: "Todas las cuentas" }, { label: "Este mes · Sep 2026", icon: <CalendarOutlined /> }],
        primaryAction: "Registrar cobro",
        metrics: [
            { label: "Recaudado del mes", value: "$680,000", trend: "+8.4%", tone: "positive", helper: "vs. mes anterior", icon: <DollarOutlined /> },
            { label: "Facturación pendiente", value: "$214,000", trend: "12", tone: "neutral", helper: "documentos abiertos", icon: <FileTextOutlined /> },
            { label: "Cartera vencida", value: "$96,500", trend: "-5.1%", tone: "positive", helper: "menos mora", icon: <ClockCircleOutlined /> },
            { label: "Conciliados", value: "84%", trend: "+3.6%", tone: "positive", helper: "movimientos validados", icon: <BankOutlined /> },
            { label: "Promesas de pago", value: "18", trend: "+4", tone: "positive", helper: "en seguimiento", icon: <CheckCircleOutlined /> },
            { label: "Por conciliar", value: "$42,800", trend: "6", tone: "neutral", helper: "movimientos abiertos", icon: <FileSearchOutlined /> },
        ],
        pipelineTitle: "Flujo de caja",
        pipelineDescription: "Distribución visual de cobros por etapa.",
        pipelineUpdated: "Corte preliminar",
        pipelineScaleLabel: "Barras proporcionales al mayor volumen; porcentaje vs. etapa anterior.",
        pipelineStages: [
            { label: "Facturado", value: 86, conversion: "100%" },
            { label: "Por vencer", value: 42, conversion: "49%" },
            { label: "En gestión", value: 28, conversion: "67%" },
            { label: "Pagado", value: 31, conversion: "74%" },
            { label: "Conciliado", value: 26, conversion: "84%" },
        ],
        table: {
            title: "Cuentas por cobrar próximas",
            description: "Compromisos financieros que requieren seguimiento.",
            headers: ["Cliente", "Cuenta", "Monto", "Estado", "Responsable"],
            footerAction: "Ver todas las cuentas",
            rows: [
                { primary: "Mariana Córdoba", secondary: "Cuota Terraviva", amount: "$18,200", status: "Por vencer", statusTone: "warning", owner: "Cobros" },
                { primary: "Grupo Altair", secondary: "Factura CP-2041", amount: "$74,000", status: "En gestión", statusTone: "info", owner: "Finanzas" },
                { primary: "Inversiones Loma", secondary: "Reserva comercial", amount: "$31,500", status: "Pagado", statusTone: "success", owner: "Tesorería" },
                { primary: "Natura Holdings", secondary: "Saldo contrato", amount: "$22,800", status: "Vencido", statusTone: "danger", owner: "Cobros" },
            ],
        },
        tasksTitle: "Gestiones financieras",
        tasksDescription: "Pagos y conciliaciones del día.",
        tasks: [
            { time: "09:00", title: "Conciliar depósito Terraviva", priority: "Alta" },
            { time: "12:30", title: "Enviar estado de cuenta Altair", priority: "Media" },
            { time: "16:00", title: "Validar facturas por vencer", priority: "Normal" },
        ],
        motionTitle: "Cartera por proyecto",
        motionDescription: "Avance relativo de cobro.",
        motionLabel: "cobrado",
        motion: [
            { name: "Terraviva", detail: "Cobro mensual", progress: "76%" },
            { name: "City Place", detail: "Facturación activa", progress: "61%" },
            { name: "Natura", detail: "Conciliación", progress: "54%" },
        ],
    },
    marketing: {
        isPlaceholder: true,
        eyebrow: "Inicio / Mercadeo / Resumen",
        title: "Resumen Mercadeo",
        subtitle: "Captación, campañas, canales y conversión de leads.",
        filters: [{ label: "Todos los canales" }, { label: "Este mes · Sep 2026", icon: <CalendarOutlined /> }],
        primaryAction: "Nueva campaña",
        metrics: [
            { label: "Leads entrantes", value: "312", trend: "+18.2%", tone: "positive", helper: "vs. mes anterior", icon: <TeamOutlined /> },
            { label: "Costo por lead", value: "$42", trend: "-7.5%", tone: "positive", helper: "mejor eficiencia", icon: <CreditCardOutlined /> },
            { label: "ROI campañas", value: "3.8x", trend: "+0.4x", tone: "positive", helper: "retorno estimado", icon: <LineChartOutlined /> },
            { label: "MQL convertidos", value: "86", trend: "+9.1%", tone: "positive", helper: "a ventas", icon: <RiseOutlined /> },
            { label: "Campañas activas", value: "9", trend: "+2", tone: "positive", helper: "en pauta", icon: <CalendarOutlined /> },
            { label: "Tasa MQL", value: "27.5%", trend: "+1.8%", tone: "positive", helper: "calidad de lead", icon: <PercentageOutlined /> },
        ],
        pipelineTitle: "Rendimiento por canal",
        pipelineDescription: "Distribución visual de captación por origen.",
        pipelineUpdated: "Campañas activas",
        pipelineScaleLabel: "Barras proporcionales al canal con mayor captación.",
        pipelineStages: [
            { label: "Meta Ads", value: 138, conversion: "44%" },
            { label: "Google Ads", value: 74, conversion: "24%" },
            { label: "Referidos", value: 42, conversion: "13%" },
            { label: "Portales", value: 36, conversion: "12%" },
            { label: "Eventos", value: 22, conversion: "7%" },
        ],
        table: {
            title: "Campañas activas",
            description: "Iniciativas de captación con movimiento reciente.",
            headers: ["Campaña", "Canal", "Inversión", "Estado", "Responsable"],
            footerAction: "Ver todas las campañas",
            rows: [
                { primary: "Lanzamiento Terraviva", secondary: "Meta Ads", amount: "$8,400", status: "Activa", statusTone: "success", owner: "Mercadeo" },
                { primary: "Búsqueda City Place", secondary: "Google Ads", amount: "$5,800", status: "Optimizar", statusTone: "warning", owner: "Performance" },
                { primary: "Open House Natura", secondary: "Eventos", amount: "$3,200", status: "Programada", statusTone: "info", owner: "Eventos" },
                { primary: "Remarketing ROCCA", secondary: "Meta Ads", amount: "$2,600", status: "Pausada", statusTone: "neutral", owner: "Mercadeo" },
            ],
        },
        tasksTitle: "Agenda de mercadeo",
        tasksDescription: "Acciones de captación próximas.",
        tasks: [
            { time: "08:45", title: "Revisar CPL de Meta Ads", priority: "Alta" },
            { time: "11:30", title: "Aprobar piezas de Terraviva", priority: "Media" },
            { time: "14:30", title: "Preparar reporte de canales", priority: "Normal" },
        ],
        motionTitle: "Canales destacados",
        motionDescription: "Participación de captación.",
        motionLabel: "de leads",
        motion: [
            { name: "Meta Ads", detail: "Mayor volumen", progress: "44%" },
            { name: "Google Ads", detail: "Mejor intención", progress: "24%" },
            { name: "Referidos", detail: "Alta calidad", progress: "13%" },
        ],
    },
    formalization: {
        ...CRM_DASHBOARD_CONTENT,
        eyebrow: "Inicio / Formalización / Resumen",
        title: "Resumen Formalización",
        subtitle: "Contratos, aprobaciones, firmas y entrega operativa.",
        primaryAction: "Nuevo expediente",
    },
    administration: {
        ...CRM_DASHBOARD_CONTENT,
        isPlaceholder: true,
        eyebrow: "Inicio / Administración / Resumen",
        title: "Resumen Administración",
        subtitle: "",
        filters: [],
        primaryAction: "",
    },
};

/** Lista estable para ítems sin hijos. Evita crear un arreglo nuevo en cada render del nodo. */
const EMPTY_MENU_OPTIONS: readonly GlobalMenuOption[] = [];

/**
 * Busca el perfil activo dentro de la lista recibida.
 *
 * Si el código no está y la lista tiene elementos, devuelve el primero. Solo
 * devuelve undefined cuando la lista está vacía.
 */
const getWorkspaceProfile = (code: string, assignedWorkspaces: readonly WorkspaceProfile[]): WorkspaceProfile | undefined => assignedWorkspaces.find((workspace) => workspace.code === code) ?? assignedWorkspaces[0];

/**
 * Atajo visible del buscador.
 *
 * En servidor no hay `navigator`, así que el texto por defecto es Ctrl K. En
 * el cliente, Mac muestra ⌘K.
 */
const getCommandShortcutLabel = (): string => {
    if (typeof navigator === "undefined") {
        return "Ctrl K";
    }

    return /Macintosh|Mac OS X|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "⌘K" : "Ctrl K";
};

/**
 * Estima el ancho de un ítem sin leer el DOM.
 *
 * Suma una base, un factor por carácter y la flecha si hay hijos. Es una
 * aproximación para decidir el desborde, no una medida real.
 */
const getEstimatedMenuItemWidth = ({ label, children }: GlobalMenuItem): number => {
    const chevronWidth = children && children.length > 0 ? 18 : 0;
    return DEFAULT_MENU_ITEM_WIDTH + label.length * 7 + chevronWidth;
};

/** El ítem cuenta como página actual si él o alguno de sus hijos ya viene activo. */
const hasActiveMenuItem = ({ isActive, children }: GlobalMenuItem): boolean => Boolean(isActive || children?.some((child) => child.isActive));

/**
 * Permiso sintético del agrupador "Más".
 *
 * El desborde no existe en el catálogo. CRM y Todos usan un código fijo; el
 * resto sigue `{perfil}.more.read` para no quedar fuera del contrato de UX.
 */
const getOverflowPermission = (workspaceCode: string): string => {
    if (workspaceCode === "crm-tink") {
        return "crm.more.read";
    }

    if (workspaceCode === "all") {
        return "global.more.read";
    }

    return `${workspaceCode}.more.read`;
};

/**
 * Convierte un ítem que no cupo en la barra en opción del menú "Más".
 *
 * Si no trae permiso, usa `navigation.read` para no publicar una opción sin
 * código. Si tenía hijos, la descripción avisa que dentro hay más opciones.
 */
const toOverflowOption = ({ code, label, icon, requiredPermission, children }: GlobalMenuItem): GlobalMenuOption => {
    const option: GlobalMenuOption = {
        code,
        label,
        icon,
        requiredPermission: requiredPermission ?? "navigation.read",
    };

    if (children && children.length > 0) {
        return {
            ...option,
            description: `Opciones de ${label} disponibles según permisos.`,
        };
    }

    return option;
};

/**
 * Calcula cuántos ítems caben antes de "Más".
 *
 * Sin ancho medido respeta el tope del perfil. Con ancho, resta de uno en uno
 * hasta que la estimación más el botón "Más" entra en la pista, sin bajar de un ítem.
 */
const getVisibleMenuItemCount = (items: readonly GlobalMenuItem[], availableWidth: number | null, defaultVisibleCount: number): number => {
    const maxVisibleCount = Math.min(defaultVisibleCount, items.length);

    if (availableWidth === null || availableWidth <= 0 || maxVisibleCount >= items.length) {
        return maxVisibleCount;
    }

    let visibleCount = maxVisibleCount;

    while (visibleCount > MINIMUM_VISIBLE_MENU_ITEMS) {
        const visibleWidth = items.slice(0, visibleCount).reduce((total, item) => total + getEstimatedMenuItemWidth(item), 0);
        const totalWidth = visibleWidth + MENU_OVERFLOW_ITEM_WIDTH;

        if (totalWidth <= availableWidth) {
            return visibleCount;
        }

        visibleCount -= 1;
    }

    return visibleCount;
};

/**
 * Parte el menú entre la barra y el agrupador "Más".
 *
 * CRM Tink arranca con tope de siete. Los demás perfiles muestran todo hasta
 * que el ancho obligue a desbordar. "Más" hereda el activo si la página actual quedó fuera.
 */
const getResponsiveMenuItems = (workspace: WorkspaceProfile, availableWidth: number | null): readonly GlobalMenuItem[] => {
    const defaultVisibleCount = workspace.code === "crm-tink" ? CRM_PRIMARY_MENU_LIMIT : workspace.menuItems.length;
    const visibleCount = getVisibleMenuItemCount(workspace.menuItems, availableWidth, defaultVisibleCount);

    if (visibleCount >= workspace.menuItems.length) {
        return workspace.menuItems;
    }

    const visibleItems = workspace.menuItems.slice(0, visibleCount);
    const overflowItems = workspace.menuItems.slice(visibleCount);
    const overflowMenu: GlobalMenuItem = {
        code: `${workspace.code}-more`,
        label: "Más",
        icon: <MoreOutlined />,
        isActive: overflowItems.some(hasActiveMenuItem),
        requiredPermission: getOverflowPermission(workspace.code),
        children: overflowItems.map(toOverflowOption),
    };

    return [...visibleItems, overflowMenu];
};

/** Junta las clases del ítem. El abierto y el activo conviven cuando el menú desplegado es la página actual. */
const getMenuItemClassName = (isActive: boolean | undefined, isOpen: boolean): string => {
    const classNames = ["global-home-menu__item"];

    if (isActive) {
        classNames.push("global-home-menu__item--active");
    }

    if (isOpen) {
        classNames.push("global-home-menu__item--open");
    }

    return classNames.join(" ");
};

/**
 * Atributos ARIA que solo aplican si hay menú hijo.
 *
 * Un ítem hoja no debe anunciar `aria-expanded` ni `aria-controls`: no controla
 * ningún panel. `aria-current` solo va en la página activa.
 */
const getOptionalAriaCurrent = (isActive: boolean | undefined): "page" | undefined => (isActive ? "page" : undefined);

const getOptionalAriaControls = (condition: boolean, value: string): string | undefined => (condition ? value : undefined);

const getOptionalAriaExpanded = (condition: boolean, isOpen: boolean): boolean | undefined => (condition ? isOpen : undefined);

/**
 * Ancho de la barra respecto de la etapa más grande.
 *
 * La etapa máxima ocupa el 100 %. El piso de 1 evita dividir entre cero si
 * todas las etapas vienen en 0.
 */
const getPipelineStageWidth = (stages: readonly PipelineStage[], value: number): string => {
    const maxValue = Math.max(...stages.map((stage) => stage.value), 1);
    return `${String(Math.round((value / maxValue) * 100))}%`;
};

/** Botón de cabecera sin acción. El badge, si existe, es un número fijo de demostración. */
const renderHeaderAction = ({ label, icon, badge }: HeaderAction) => (
    <button key={label} className="global-home-header__icon-button" type="button" aria-label={label}>
        {icon}
        {badge ? <span className="global-home-header__badge">{badge}</span> : null}
    </button>
);

const getUserDisplayName = (user?: GlobalHomeCurrentUser): string => user?.displayName.trim() || user?.email.trim() || "Usuario actual";

const getUserSecondaryLabel = (user?: GlobalHomeCurrentUser): string => user?.email.trim() || "Cuenta corporativa";

const getUserAvatarKey = (user?: GlobalHomeCurrentUser): string => user?.profileImageUrl ?? "profile-fallback";

const getUserInitials = (user?: GlobalHomeCurrentUser): string => {
    const source = getUserDisplayName(user);
    const words = source
        .replace(/@.*/u, "")
        .split(/\s+/u)
        .map((word) => word.trim())
        .filter(Boolean);

    if (words.length === 0) {
        return "U";
    }

    return words
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("");
};

const buildProfilePhotoUrl = (profileImageUrl: string, refreshNonce: number | null): string => {
    const photoUrl = new URL(profileImageUrl.startsWith("http") ? profileImageUrl : buildApiUrl(profileImageUrl));

    if (refreshNonce !== null) {
        photoUrl.searchParams.set(PROFILE_PHOTO_REFRESH_QUERY, PROFILE_PHOTO_REFRESH_VALUE);
        photoUrl.searchParams.set("v", String(refreshNonce));
    }

    return photoUrl.toString();
};

function UserAvatarContent({ user }: { readonly user: GlobalHomeCurrentUser | undefined }) {
    const [refreshNonce, setRefreshNonce] = useState<number | null>(null);
    const [isImageUnavailable, setIsImageUnavailable] = useState(false);
    const profileImageUrl = user?.profileImageUrl;
    const imageSrc = profileImageUrl && !isImageUnavailable ? buildProfilePhotoUrl(profileImageUrl, refreshNonce) : null;

    if (!imageSrc) {
        return (
            <>
                <span className="global-home-user-avatar__initials">{getUserInitials(user)}</span>
                <span className="global-home-user-avatar__presence" aria-hidden="true" />
            </>
        );
    }

    return (
        <>
            <img
                className="global-home-user-avatar__image"
                src={imageSrc}
                alt=""
                onError={() => {
                    if (refreshNonce === null) {
                        setRefreshNonce(Date.now());
                        return;
                    }

                    setIsImageUnavailable(true);
                }}
            />
            <span className="global-home-user-avatar__presence" aria-hidden="true" />
        </>
    );
}

/**
 * Barra móvil. En escritorio el CSS la oculta.
 *
 * Es la única entrada al cajón de navegación. El badge 5 repite el de la
 * cabecera y tampoco viene del API.
 */
function MobileAppBar({ onMenuOpen, user }: MobileAppBarProps) {
    return (
        <div className="global-home-mobile-bar" role="banner" aria-label="Barra móvil global CRM TINK">
            <button className="global-home-mobile-bar__icon-button" type="button" aria-label="Abrir menú de navegación" onClick={onMenuOpen}>
                <MenuOutlined aria-hidden="true" />
            </button>
            <img className="global-home-mobile-bar__logo" src={ROCCA_LOGO_SRC} width="1121" height="405" alt="ROCCA Development Group" />

            <div className="global-home-mobile-bar__actions" aria-label="Acciones rápidas móviles">
                <button className="global-home-mobile-bar__icon-button" type="button" aria-label="Notificaciones">
                    <BellOutlined aria-hidden="true" />
                    <span className="global-home-header__badge">5</span>
                </button>
                <div className="global-home-mobile-bar__avatar" role="img" aria-label={`Perfil actual: ${getUserDisplayName(user)}`}>
                    <UserAvatarContent key={getUserAvatarKey(user)} user={user} />
                </div>
            </div>
        </div>
    );
}

/**
 * Opción del cajón móvil.
 *
 * Con el acordeón cerrado el botón queda fuera del tabulado. `data-permission`
 * marca la compuerta de UX; no autoriza el clic.
 */
const renderDrawerChildItem = (item: GlobalMenuItem | GlobalMenuOption, activeCode: string, isFocusable = true) => {
    const isActive = item.code === activeCode;

    return (
        <button key={item.code} className={`global-home-mobile-drawer__child${isActive ? " global-home-mobile-drawer__child--active" : ""}`} type="button" tabIndex={isFocusable ? undefined : -1} data-permission={item.requiredPermission} aria-current={isActive ? "page" : undefined}>
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
        </button>
    );
};

/**
 * Cajón de navegación móvil.
 *
 * Cerrado no se monta, para que el diálogo no quede en el árbol accesible.
 * Abrir un perfil que no es el activo también lo selecciona. Cerrarlo solo
 * colapsa el acordeón y deja el perfil actual.
 */
function MobileNavigationDrawer({ activeWorkspace, assignedWorkspaces, isOpen, openWorkspaceCode, onClose, onLogout, onSelect, onWorkspaceToggle, user }: MobileNavigationDrawerProps) {
    const activeMenuCode = activeWorkspace.menuItems.find((item) => item.isActive)?.code ?? "";
    const [globalWorkspace, ...moduleWorkspaces] = assignedWorkspaces;

    if (!isOpen || !globalWorkspace) {
        return null;
    }

    const globalSummaryItem = globalWorkspace.menuItems[0];
    const isGlobalSummaryActive = activeWorkspace.code === globalWorkspace.code;

    return (
        <div className="global-home-mobile-drawer-shell">
            <button className="global-home-mobile-drawer__backdrop" type="button" aria-label="Cerrar menú de navegación" onClick={onClose} />
            <aside className="global-home-mobile-drawer" role="dialog" aria-modal="true" aria-label="Menú móvil de navegación">
                <div className="global-home-mobile-drawer__account">
                    <div className="global-home-mobile-drawer__avatar" aria-hidden="true">
                        <UserAvatarContent key={getUserAvatarKey(user)} user={user} />
                    </div>
                    <div>
                        <strong>{getUserDisplayName(user)}</strong>
                        <span>{getUserSecondaryLabel(user)}</span>
                    </div>
                    <button className="global-home-mobile-drawer__close" type="button" aria-label="Cerrar menú" onClick={onClose}>
                        <CloseOutlined aria-hidden="true" />
                    </button>
                </div>

                <div className="global-home-mobile-drawer__search">
                    <SearchOutlined aria-hidden="true" />
                    <input type="search" aria-label="Buscar en menú móvil" placeholder="Buscar en el sistema..." />
                </div>

                <div className="global-home-mobile-drawer__section">
                    <span className="global-home-mobile-drawer__eyebrow">Menú principal</span>
                    <div className="global-home-mobile-drawer__modules">
                        <span className="global-home-mobile-drawer__category">Vista Global</span>
                        {globalSummaryItem ? (
                            <button
                                className={`global-home-mobile-drawer__module-link${isGlobalSummaryActive ? " global-home-mobile-drawer__module-link--active" : ""}`}
                                type="button"
                                data-permission={globalSummaryItem.requiredPermission}
                                aria-current={isGlobalSummaryActive ? "page" : undefined}
                                onClick={() => {
                                    onWorkspaceToggle(globalWorkspace.code);
                                    onSelect(globalWorkspace.code);
                                }}
                            >
                                <span aria-hidden="true">{globalSummaryItem.icon}</span>
                                <span>{globalSummaryItem.label}</span>
                            </button>
                        ) : null}

                        <span className="global-home-mobile-drawer__category">Perfiles Asignados</span>
                        {moduleWorkspaces.map((workspace) => {
                            const isActiveWorkspace = workspace.code === activeWorkspace.code;
                            const isExpanded = workspace.code === openWorkspaceCode;
                            const drawerPanelId = `global-home-mobile-drawer-${workspace.code}`;

                            return (
                                <section key={workspace.code} className="global-home-mobile-drawer__module">
                                    <button
                                        className={`global-home-mobile-drawer__module-trigger${isActiveWorkspace ? " global-home-mobile-drawer__module-trigger--active" : ""}${isExpanded ? " global-home-mobile-drawer__module-trigger--expanded" : ""}`}
                                        type="button"
                                        aria-controls={drawerPanelId}
                                        aria-expanded={isExpanded}
                                        onClick={() => {
                                            if (isExpanded) {
                                                onWorkspaceToggle("");

                                                return;
                                            }

                                            onWorkspaceToggle(workspace.code);

                                            if (!isActiveWorkspace) {
                                                onSelect(workspace.code);
                                            }
                                        }}
                                    >
                                        <span className="global-home-mobile-drawer__module-label">
                                            <span aria-hidden="true">{workspace.icon}</span>
                                            <span>{workspace.label}</span>
                                        </span>
                                        <DownOutlined aria-hidden="true" />
                                    </button>

                                    <div id={drawerPanelId} className={`global-home-mobile-drawer__children${isExpanded ? " global-home-mobile-drawer__children--open" : ""}`} role="group" aria-label={`Opciones de ${workspace.label}`} aria-hidden={!isExpanded}>
                                        <div className="global-home-mobile-drawer__children-inner">{workspace.menuItems.map((item) => renderDrawerChildItem(item, activeMenuCode, isExpanded))}</div>
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                </div>

                <div className="global-home-mobile-drawer__section global-home-mobile-drawer__section--secondary">
                    <span className="global-home-mobile-drawer__eyebrow">Accesos rápidos</span>
                    <button type="button">
                        <ControlOutlined aria-hidden="true" />
                        Ajustes del Sistema
                    </button>
                    <button type="button">
                        <WarningOutlined aria-hidden="true" />
                        Ayuda y Soporte
                    </button>
                    <button type="button" onClick={onLogout}>
                        <LockOutlined aria-hidden="true" />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>
        </div>
    );
}

/**
 * Cierra sobre el perfil activo para que `map` reciba un render ya ligado.
 *
 * `aria-pressed` marca el perfil elegido. Elegir uno no navega: solo cambia el contexto visual.
 */
const renderWorkspaceOption = (activeCode: string, onSelect: (code: string) => void) => {
    const renderOption = ({ code, label, description }: WorkspaceProfile) => (
        <button
            key={code}
            className={`global-home-workspace-menu__item${code === activeCode ? " global-home-workspace-menu__item--active" : ""}`}
            type="button"
            onClick={() => {
                onSelect(code);
            }}
            aria-pressed={code === activeCode}
        >
            <span className="global-home-workspace-menu__label">{label}</span>
            <span className="global-home-workspace-menu__description">{description}</span>
        </button>
    );

    return renderOption;
};

/** Opción de dropdown. El permiso va en `data-permission` para la UX, no como control de acceso. */
const renderMenuOption = ({ code, label, description, requiredPermission, icon }: GlobalMenuOption) => (
    <button key={code} className="global-home-menu__dropdown-item" type="button" data-permission={requiredPermission}>
        <span className="global-home-menu__dropdown-icon" aria-hidden="true">
            {icon}
        </span>
        <span className="global-home-menu__dropdown-copy">
            <span className="global-home-menu__dropdown-label">{label}</span>
            {description ? <span className="global-home-menu__dropdown-description">{description}</span> : null}
        </span>
    </button>
);

/** Tarjeta de indicador. `tone` solo cambia el color de la tendencia. */
const renderDashboardMetric = ({ label, value, trend, tone, helper, icon }: DashboardMetric) => (
    <article key={label} className="global-home-kpi">
        <div className="global-home-kpi__topline">
            <span>{label}</span>
            <span className="global-home-kpi__icon" aria-hidden="true">
                {icon}
            </span>
        </div>
        <strong>{value}</strong>
        <div className="global-home-kpi__footer">
            <span className={`global-home-kpi__trend global-home-kpi__trend--${tone}`}>{trend}</span>
            <span>{helper}</span>
        </div>
    </article>
);

/** Filtro visual. Todavía no cambia el conjunto de datos del dashboard. */
const renderDashboardFilter = ({ label, icon }: DashboardFilter) => (
    <button key={label} type="button">
        {icon}
        {label}
        <DownOutlined aria-hidden="true" />
    </button>
);

/**
 * Cierra sobre la lista de etapas para que cada barra use el mismo máximo.
 */
const renderPipelineStage = (stages: readonly PipelineStage[]) => {
    const renderStage = ({ label, value, conversion }: PipelineStage) => (
        <li key={label} className="global-home-pipeline__stage">
            <div className="global-home-pipeline__meta">
                <span>{label}</span>
                <strong>
                    {value}
                    <span>{conversion}</span>
                </strong>
            </div>
            <div className="global-home-pipeline__track" aria-label={`${label}: ${String(value)}, ${conversion}`}>
                <span style={{ width: getPipelineStageWidth(stages, value) }} />
            </div>
        </li>
    );

    return renderStage;
};

/** Fila de la tabla demo. La clave junta las dos primeras columnas porque el nombre puede repetirse. */
const renderTableRow = ({ primary, secondary, amount, status, statusTone, owner }: DashboardTableRow) => (
    <tr key={`${primary}-${secondary}`}>
        <td>{primary}</td>
        <td>{secondary}</td>
        <td>{amount}</td>
        <td>
            <span className={`global-home-table__status global-home-table__status--${statusTone}`}>{status}</span>
        </td>
        <td>{owner}</td>
    </tr>
);

/**
 * Tarea de la agenda demo.
 *
 * La clase de prioridad pasa a minúsculas porque el CSS usa `alta`, `media` y `normal`.
 */
const renderAgendaTask = ({ time, title, priority }: AgendaTask) => (
    <li key={`${time}-${title}`} className="global-home-task">
        <span className="global-home-task__check" aria-hidden="true" />
        <div>
            <strong>{title}</strong>
            <span className="global-home-task__meta">
                <span>{time}</span>
                <span aria-hidden="true">·</span>
                <span className={`global-home-task__priority global-home-task__priority--${priority.toLowerCase()}`}>{priority}</span>
            </span>
        </div>
    </li>
);

/**
 * Cierra sobre la unidad del porcentaje.
 *
 * El lector anuncia "78% de captación" y no un número suelto.
 */
const renderProjectMotion = (motionLabel: string) => {
    const renderMotion = ({ name, detail, progress }: ProjectMotion) => (
        <li key={name} className="global-home-project">
            <div className="global-home-project__meta">
                <strong>{name}</strong>
                <span>{detail}</span>
            </div>
            <div className="global-home-project__progress" aria-label={`${progress} ${motionLabel}`}>
                <span>{progress}</span>
                <div aria-hidden="true">
                    <span style={{ width: progress }} />
                </div>
            </div>
        </li>
    );

    return renderMotion;
};

/** Flecha del ítem con hijos. En una hoja no se monta, para no dejar un icono suelto. */
function GlobalMenuChevron({ isVisible }: GlobalMenuChevronProps) {
    if (!isVisible) {
        return null;
    }

    return <DownOutlined className="global-home-menu__chevron" aria-hidden="true" />;
}

/**
 * Panel del ítem. Cerrado no se monta, así el `role="menu"` no queda expuesto.
 */
function GlobalMenuDropdown({ id, isOpen, label, onPointerEnter, onPointerLeave, options }: GlobalMenuDropdownProps) {
    if (!isOpen) {
        return null;
    }

    return (
        <div id={id} className="global-home-menu__dropdown" role="menu" aria-label={`Opciones de ${label}`} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
            {options.map(renderMenuOption)}
        </div>
    );
}

/**
 * Enfoca la primera opción después del commit.
 *
 * El panel se monta en el mismo render que lo abre. El frame siguiente espera
 * a que el botón ya exista.
 */
const focusFirstDropdownButton = (selector: string): void => {
    window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(selector)?.focus();
    });
};

/**
 * Ítem de la barra de escritorio, con o sin panel.
 *
 * El puntero abre el panel y espera `MENU_CLOSE_DELAY_MS` antes de cerrarlo,
 * para cruzar el hueco. El puente invisible cancela ese cierre si el puntero
 * ya va hacia el panel. Flecha abajo mueve el foco a la primera opción.
 */
function GlobalMenuNode({ item, isOpen, onBlur, onClose, onOpenChange }: GlobalMenuNodeProps) {
    const { code, label, icon, isActive, requiredPermission, hideChevron, children } = item;
    const options = children ?? EMPTY_MENU_OPTIONS;
    const hasChildren = options.length > 0;
    const dropdownId = `global-home-menu-options-${code}`;
    const closeTimerRef = useRef<number | null>(null);

    /** Cancela el cierre diferido. Sin esto, entrar de nuevo al ítem igual lo cerraría. */
    const clearPendingClose = () => {
        if (closeTimerRef.current === null) {
            return;
        }

        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
    };

    /** Al desmontar, no debe quedar un timeout apuntando a un nodo que ya no existe. */
    useEffect(
        () => () => {
            clearPendingClose();
        },
        [],
    );

    const closeImmediately = () => {
        clearPendingClose();
        onClose();
    };

    /** Espera el retardo para que el puntero pueda cruzar hasta el panel. */
    const closeWithPointerTolerance = () => {
        clearPendingClose();
        closeTimerRef.current = window.setTimeout(() => {
            closeTimerRef.current = null;
            onClose();
        }, MENU_CLOSE_DELAY_MS);
    };

    const handlePointerEnter = () => {
        clearPendingClose();

        if (hasChildren) {
            onOpenChange(code);
        }
    };

    /** Una hoja se cierra al salir. Un padre espera, porque el panel está separado del botón. */
    const handlePointerLeave = () => {
        if (hasChildren) {
            closeWithPointerTolerance();
            return;
        }

        closeImmediately();
    };

    const handleClick = () => {
        clearPendingClose();
        onOpenChange(hasChildren ? code : null);
    };

    /** Flecha abajo abre y mueve el foco. Escape cierra sin dejar el timeout pendiente. */
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!hasChildren) {
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            onOpenChange(code);
            focusFirstDropdownButton(`#${dropdownId} .global-home-menu__dropdown-item`);
        }

        if (event.key === "Escape") {
            event.preventDefault();
            closeImmediately();
        }
    };

    /**
     * El cierre por foco lo decide el shell.
     *
     * Aquí solo se cancela el timeout: si el foco pasó a una opción del mismo
     * grupo, el shell no debe cerrar el panel.
     */
    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        clearPendingClose();
        onBlur(event);
    };

    return (
        <div className="global-home-menu__group" onBlur={handleBlur} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
            <button className={getMenuItemClassName(isActive, hasChildren && isOpen)} type="button" aria-current={getOptionalAriaCurrent(isActive)} aria-controls={getOptionalAriaControls(hasChildren, dropdownId)} aria-expanded={getOptionalAriaExpanded(hasChildren, isOpen)} data-permission={requiredPermission} onClick={handleClick} onKeyDown={handleKeyDown}>
                <span className="global-home-menu__icon" aria-hidden="true">
                    {icon}
                </span>
                <span className="global-home-menu__label">{label}</span>
                <GlobalMenuChevron isVisible={hasChildren && !hideChevron} />
            </button>

            {hasChildren && isOpen ? <span className="global-home-menu__dropdown-bridge" aria-hidden="true" onPointerEnter={clearPendingClose} /> : null}
            <GlobalMenuDropdown id={dropdownId} isOpen={hasChildren && isOpen} label={label} onPointerEnter={clearPendingClose} onPointerLeave={closeWithPointerTolerance} options={options} />
        </div>
    );
}

/**
 * Selector de perfil.
 *
 * Los listeners del documento solo viven mientras está abierto, para no
 * capturar Escape del resto del shell. Enter y Espacio se atienden en
 * keydown; `preventDefault` evita que el click sintético vuelva a alternar.
 * Flecha abajo abre y enfoca la primera opción.
 */
function WorkspaceSelector({ activeWorkspace, assignedWorkspaces, isOpen, onOpenChange, onSelect }: WorkspaceSelectorProps) {
    const selectorMenuId = "global-home-workspace-selector";
    const selectorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const closeOnOutsidePointerDown = (event: PointerEvent) => {
            if (selectorRef.current?.contains(event.target as Node)) {
                return;
            }

            onOpenChange(false);
        };

        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Escape") {
                onOpenChange(false);
            }
        };

        document.addEventListener("pointerdown", closeOnOutsidePointerDown);
        document.addEventListener("keydown", closeOnEscape);

        return () => {
            document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [isOpen, onOpenChange]);

    const handleToggle = () => {
        onOpenChange(!isOpen);
    };

    const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        handleToggle();
    };

    /** Enter y Espacio alternan. Flecha abajo solo abre, para no cerrar en el mismo gesto. */
    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleToggle();
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            onOpenChange(true);
            focusFirstDropdownButton(`#${selectorMenuId} .global-home-workspace-menu__item`);
        }
    };

    const handleSelect = (code: string) => {
        onSelect(code);
        onOpenChange(false);
    };

    return (
        <div ref={selectorRef} className="global-home-workspace-selector">
            <button className={`global-home-header__selector${isOpen ? " global-home-header__selector--open" : ""}`} type="button" aria-label={activeWorkspace.label} aria-controls={selectorMenuId} aria-expanded={isOpen} onClick={handleClick} onKeyDown={handleKeyDown}>
                <span className="global-home-header__selector-copy">
                    <span className="global-home-header__selector-eyebrow">Módulo</span>
                    <span>{activeWorkspace.label}</span>
                </span>
                <DownOutlined aria-hidden="true" />
            </button>

            {isOpen ? (
                <div id={selectorMenuId} className="global-home-workspace-menu" aria-label="Perfiles asignados">
                    <span className="global-home-workspace-menu__eyebrow">Perfiles asignados</span>
                    {assignedWorkspaces.map(renderWorkspaceOption(activeWorkspace.code, handleSelect))}
                </div>
            ) : null}
        </div>
    );
}

/**
 * Lienzo del perfil activo.
 *
 * Con `isPlaceholder` solo muestra el título. El volcado de sesión aparece
 * únicamente en Resumen Global y solo en ese corte: es inspección del payload
 * recibido, no un indicador del dashboard.
 */
function DashboardCanvas({ content, sessionDebugPayload }: DashboardCanvasProps) {
    if (content.isPlaceholder) {
        return (
            <div className="global-home-dashboard">
                <section className="global-home-page-header" aria-labelledby="global-home-page-title">
                    <div>
                        <h1 id="global-home-page-title">{content.title}</h1>
                        {content.title === "Resumen Global" && sessionDebugPayload !== undefined ? (
                            <pre className="global-home-session-debug" aria-label="Datos de sesion recibidos desde el API">
                                {JSON.stringify(sessionDebugPayload, null, 2)}
                            </pre>
                        ) : null}
                    </div>
                </section>
            </div>
        );
    }

    const hasActions = content.filters.length > 0 || content.primaryAction.length > 0;

    return (
        <div className="global-home-dashboard">
            <section className="global-home-page-header" aria-labelledby="global-home-page-title">
                <div>
                    <p className="global-home-page-header__eyebrow">{content.eyebrow}</p>
                    <h1 id="global-home-page-title">{content.title}</h1>
                    {content.subtitle.length > 0 ? <p>{content.subtitle}</p> : null}
                </div>

                {hasActions ? (
                    <div className="global-home-page-header__actions" aria-label="Filtros visuales del dashboard">
                        {content.filters.map(renderDashboardFilter)}
                        {content.primaryAction.length > 0 ? (
                            <button className="global-home-page-header__primary" type="button">
                                <PlusOutlined aria-hidden="true" />
                                {content.primaryAction}
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </section>

            <section className="global-home-kpis" aria-label="Indicadores principales">
                {content.metrics.map(renderDashboardMetric)}
            </section>

            <section className="global-home-workspace" aria-label="Resumen operativo visual">
                <div className="global-home-workspace__main">
                    <section className="global-home-panel" aria-labelledby="global-home-pipeline-title">
                        <div className="global-home-panel__header">
                            <div>
                                <h2 id="global-home-pipeline-title">{content.pipelineTitle}</h2>
                                <p>{content.pipelineDescription}</p>
                            </div>
                            <span>{content.pipelineUpdated}</span>
                        </div>
                        <p className="global-home-pipeline__scale">{content.pipelineScaleLabel}</p>
                        <ol className="global-home-pipeline">{content.pipelineStages.map(renderPipelineStage(content.pipelineStages))}</ol>
                    </section>

                    <section className="global-home-panel" aria-labelledby="global-home-deals-title">
                        <div className="global-home-panel__header">
                            <div>
                                <h2 id="global-home-deals-title">{content.table.title}</h2>
                                <p>{content.table.description}</p>
                            </div>
                        </div>
                        <div className="global-home-table-wrap">
                            <table className="global-home-table">
                                <thead>
                                    <tr>
                                        {content.table.headers.map((header) => (
                                            <th key={header}>{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>{content.table.rows.map(renderTableRow)}</tbody>
                            </table>
                        </div>
                        <button className="global-home-table__footer-action" type="button">
                            {content.table.footerAction}
                            <span aria-hidden="true">→</span>
                        </button>
                    </section>
                </div>

                <aside className="global-home-workspace__side" aria-label="Productividad personal visual">
                    <section className="global-home-panel" aria-labelledby="global-home-tasks-title">
                        <div className="global-home-panel__header">
                            <div>
                                <h2 id="global-home-tasks-title">{content.tasksTitle}</h2>
                                <p>{content.tasksDescription}</p>
                            </div>
                        </div>
                        <ul className="global-home-task-list">{content.tasks.map(renderAgendaTask)}</ul>
                    </section>

                    <section className="global-home-panel" aria-labelledby="global-home-projects-title">
                        <div className="global-home-panel__header">
                            <div>
                                <h2 id="global-home-projects-title">{content.motionTitle}</h2>
                                <p>{content.motionDescription}</p>
                            </div>
                        </div>
                        <ul className="global-home-project-list">{content.motion.map(renderProjectMotion(content.motionLabel))}</ul>
                    </section>
                </aside>
            </section>
        </div>
    );
}

const getInitialWorkspaceProfile = (assignedWorkspaces: readonly WorkspaceProfile[], fallbackWorkspace: WorkspaceProfile, initialWorkspaceCode?: string): WorkspaceProfile => {
    const requestedCode = initialWorkspaceCode ?? fallbackWorkspace.code;

    return getWorkspaceProfile(requestedCode, assignedWorkspaces) ?? fallbackWorkspace;
};

/**
 * Shell global del CRM.
 *
 * Filtra el menú con los permisos efectivos recibidos. Sin esa lista usa el
 * set demo, que hoy permite todo el catálogo. Ocultar un ítem es UX: el API
 * sigue autorizando cada ruta. Si el filtro no deja perfiles, la cabecera usa
 * el primero del catálogo para no quedar vacía; eso no concede esos permisos.
 */
export function GlobalHomeShell({ currentUser, effectivePermissions = DEMO_EFFECTIVE_NAVIGATION_PERMISSIONS, initialWorkspaceCode, onLogout, onWorkspaceChange, sessionDebugPayload }: GlobalHomeShellProps) {
    const assignedWorkspaces = getVisibleNavigationWorkspaces(effectivePermissions);
    const fallbackWorkspace = assignedWorkspaces[0] ?? ASSIGNED_WORKSPACES[0];
    const initialWorkspace = getInitialWorkspaceProfile(assignedWorkspaces, fallbackWorkspace, initialWorkspaceCode);
    const [openMenuCode, setOpenMenuCode] = useState<string | null>(null);
    const [isWorkspaceSelectorOpen, setIsWorkspaceSelectorOpen] = useState(false);
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
    const [activeWorkspaceCode, setActiveWorkspaceCode] = useState(initialWorkspace.code);
    const [openMobileWorkspaceCode, setOpenMobileWorkspaceCode] = useState(activeWorkspaceCode);
    const [menuTrackWidth, setMenuTrackWidth] = useState<number | null>(null);
    const menuTrackRef = useRef<HTMLDivElement>(null);
    const activeWorkspace = getWorkspaceProfile(activeWorkspaceCode, assignedWorkspaces) ?? fallbackWorkspace;
    const safeOpenMobileWorkspaceCode = getWorkspaceProfile(openMobileWorkspaceCode, assignedWorkspaces)?.code ?? activeWorkspace.code;
    const dashboardContent = DASHBOARD_CONTENT_BY_WORKSPACE[activeWorkspace.code] ?? CRM_DASHBOARD_CONTENT;
    const menuItems = getResponsiveMenuItems(activeWorkspace, menuTrackWidth);

    /**
     * Mide la pista del menú, no la ventana.
     *
     * Las herramientas de la cabecera cambian el ancho disponible. Si no hay
     * `ResizeObserver`, el respaldo es el resize de la ventana.
     */
    useEffect(() => {
        const element = menuTrackRef.current;

        if (!element) {
            return undefined;
        }

        const updateMenuTrackWidth = () => {
            setMenuTrackWidth(element.getBoundingClientRect().width);
        };

        updateMenuTrackWidth();

        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", updateMenuTrackWidth);

            return () => {
                window.removeEventListener("resize", updateMenuTrackWidth);
            };
        }

        const resizeObserver = new ResizeObserver(updateMenuTrackWidth);
        resizeObserver.observe(element);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    /**
     * Cierra el menú solo cuando el foco salió del grupo.
     *
     * Si `relatedTarget` sigue dentro, el foco pasó a una opción del dropdown.
     */
    const closeMenuOnBlur = (event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpenMenuCode(null);
        }
    };

    /**
     * Unifica escritorio y móvil al cambiar de perfil.
     *
     * El acordeón móvil abre el mismo código y el menú de escritorio se cierra
     * para no dejar abierto un panel del perfil anterior.
     */
    const selectWorkspace = (code: string) => {
        setActiveWorkspaceCode(code);
        setOpenMobileWorkspaceCode(code);
        setOpenMenuCode(null);
        onWorkspaceChange?.(code);
    };

    return (
        <div className="global-home-shell">
            <MobileAppBar
                user={currentUser}
                onMenuOpen={() => {
                    setIsMobileDrawerOpen(true);
                }}
            />
            <MobileNavigationDrawer
                activeWorkspace={activeWorkspace}
                assignedWorkspaces={assignedWorkspaces}
                isOpen={isMobileDrawerOpen}
                openWorkspaceCode={safeOpenMobileWorkspaceCode}
                onClose={() => {
                    setIsMobileDrawerOpen(false);
                }}
                onLogout={onLogout}
                onSelect={selectWorkspace}
                onWorkspaceToggle={setOpenMobileWorkspaceCode}
                user={currentUser}
            />

            <header className="global-home-header" role="banner" aria-label="Barra superior global CRM TINK">
                <div className="global-home-header__inner">
                    <div className="global-home-header__brand">
                        <img className="global-home-header__logo" src={ROCCA_LOGO_SRC} width="1121" height="405" alt="ROCCA Development Group" />
                    </div>

                    <div className="global-home-header__workspace" aria-label="Herramientas globales visuales">
                        <WorkspaceSelector activeWorkspace={activeWorkspace} assignedWorkspaces={assignedWorkspaces} isOpen={isWorkspaceSelectorOpen} onOpenChange={setIsWorkspaceSelectorOpen} onSelect={selectWorkspace} />
                        <button className="global-home-header__command" type="button" aria-label="Abrir busqueda global">
                            <SearchOutlined aria-hidden="true" />
                            <span className="global-home-header__command-copy">Buscar en {activeWorkspace.label}: clientes, contratos o proyectos</span>
                            <kbd>{getCommandShortcutLabel()}</kbd>
                        </button>
                    </div>

                    <div className="global-home-header__actions" aria-label="Acciones globales visuales">
                        {HEADER_ACTIONS.map(renderHeaderAction)}
                        <button className="global-home-header__avatar" type="button" aria-label={`Perfil actual: ${getUserDisplayName(currentUser)}`} title={getUserDisplayName(currentUser)}>
                            <UserAvatarContent key={getUserAvatarKey(currentUser)} user={currentUser} />
                            <DownOutlined aria-hidden="true" />
                        </button>
                        {onLogout ? (
                            <button className="global-home-header__logout-button" type="button" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={onLogout}>
                                <LogoutOutlined aria-hidden="true" />
                            </button>
                        ) : null}
                    </div>
                </div>
            </header>

            <nav className="global-home-menu" aria-label="Menu global visual">
                <div ref={menuTrackRef} className="global-home-menu__track">
                    {menuItems.map((item) => (
                        <GlobalMenuNode
                            key={item.code}
                            item={item}
                            isOpen={openMenuCode === item.code}
                            onBlur={closeMenuOnBlur}
                            onClose={() => {
                                setOpenMenuCode(null);
                            }}
                            onOpenChange={setOpenMenuCode}
                        />
                    ))}
                </div>
            </nav>

            <main className="global-home-stage" aria-label="Area global visual">
                <img className="global-home-stage__watermark" src={ROCCA_LOGO_SRC} width="1121" height="405" alt="" aria-hidden="true" />
                <DashboardCanvas content={dashboardContent} sessionDebugPayload={sessionDebugPayload} />
            </main>
        </div>
    );
}
