import "./GlobalHomeShell.css";

import AccountBookOutlined from "@ant-design/icons/AccountBookOutlined";
import AppstoreOutlined from "@ant-design/icons/AppstoreOutlined";
import AuditOutlined from "@ant-design/icons/AuditOutlined";
import BellOutlined from "@ant-design/icons/BellOutlined";
import CalculatorOutlined from "@ant-design/icons/CalculatorOutlined";
import CheckOutlined from "@ant-design/icons/CheckOutlined";
import CloseOutlined from "@ant-design/icons/CloseOutlined";
import DashboardOutlined from "@ant-design/icons/DashboardOutlined";
import DownOutlined from "@ant-design/icons/DownOutlined";
import FileDoneOutlined from "@ant-design/icons/FileDoneOutlined";
import FileProtectOutlined from "@ant-design/icons/FileProtectOutlined";
import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import FlagOutlined from "@ant-design/icons/FlagOutlined";
import FolderOpenOutlined from "@ant-design/icons/FolderOpenOutlined";
import FunnelPlotOutlined from "@ant-design/icons/FunnelPlotOutlined";
import LogoutOutlined from "@ant-design/icons/LogoutOutlined";
import MenuOutlined from "@ant-design/icons/MenuOutlined";
import MoreOutlined from "@ant-design/icons/MoreOutlined";
import NotificationOutlined from "@ant-design/icons/NotificationOutlined";
import QuestionCircleOutlined from "@ant-design/icons/QuestionCircleOutlined";
import RiseOutlined from "@ant-design/icons/RiseOutlined";
import SafetyOutlined from "@ant-design/icons/SafetyOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import SettingOutlined from "@ant-design/icons/SettingOutlined";
import TeamOutlined from "@ant-design/icons/TeamOutlined";
import UserAddOutlined from "@ant-design/icons/UserAddOutlined";
import WalletOutlined from "@ant-design/icons/WalletOutlined";
import Tooltip from "antd/es/tooltip";
import type { FocusEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { buildApiUrl } from "../../config/frontend-env";

/** Ruta pública del logo. El shell no la resuelve por entorno. */
const ROCCA_LOGO_SRC = "/Logo/logo2.jpg";

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
const ADMINISTRATION_USERS_PATH = "/home/administration/users";
const ADMINISTRATION_ROLES_SECURITY_PATH = "/home/administration/roles-security";
const ADMINISTRATION_AUDIT_LOGS_PATH = "/home/administration/audit-logs";
const ADMINISTRATION_NAVIGATION_PERMISSION = "user.view_list";
const ADMINISTRATION_SECURITY_PERMISSION = "role.assign";
const SALES_HOME_PATH = "/home/sales";
const MARKETING_HOME_PATH = "/home/marketing";
const FORMALIZATION_HOME_PATH = "/home/formalization";
const ACCOUNTING_HOME_PATH = "/home/accounting";

/**
 * Perfil "Todos": cambia el alcance del menú, no la página visible.
 * El router lo usa para no navegar al elegirlo.
 */

export const ALL_WORKSPACE_CODE = "all";

/**
 * Opción de un menú desplegable.
 *
 * `requiredPermission` solo decide si la opción se pinta. No autoriza la ruta.
 */
export interface GlobalMenuOption {
    readonly code: string;
    readonly label: string;
    readonly isActive?: boolean;
    readonly requiredPermission: string;
    readonly icon: ReactNode;
    readonly routePath?: string;
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
    readonly routePath?: string;
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
    readonly hint: string;
    readonly icon: ReactNode;
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
    readonly onClose: (code: string) => void;
    readonly onOpenChange: (code: string | null) => void;
    readonly onSelectRoute: (routePath: string) => void;
}

interface GlobalMenuDropdownProps {
    readonly id: string;
    readonly isOpen: boolean;
    readonly label: string;
    readonly onPointerEnter: () => void;
    readonly onPointerLeave: () => void;
    readonly onSelectRoute: (routePath: string) => void;
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
    readonly activeMenuItemCode?: string | undefined;
    readonly activeWorkspace: WorkspaceProfile;
    readonly assignedWorkspaces: readonly WorkspaceProfile[];
    readonly isOpen: boolean;
    readonly openWorkspaceCode: string;
    readonly onClose: () => void;
    readonly onLogout: (() => void) | undefined;
    readonly onMenuItemSelect: (routePath: string) => void;
    readonly onSelect: (code: string) => void;
    readonly onWorkspaceToggle: (code: string) => void;
    readonly user: GlobalHomeCurrentUser | undefined;
}

/**
 * Entrada del shell.
 *
 * Sin permisos usa el set demo, que hoy permite todo el catálogo. El contenido
 * privado viene desde páginas de módulo para no mezclar vistas dentro del shell.
 */
export interface GlobalHomeShellProps {
    readonly activeMenuItemCode?: string | undefined;
    readonly children: ReactNode;
    readonly currentUser?: GlobalHomeCurrentUser;
    readonly effectivePermissions?: readonly EffectiveNavigationPermission[];
    readonly initialWorkspaceCode?: string;
    readonly onMenuItemSelect?: (routePath: string) => void;
    readonly onLogout?: () => void;
    readonly onWorkspaceChange?: (code: string) => void;
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
        code: ALL_WORKSPACE_CODE,
        label: "Todos",
        icon: <AppstoreOutlined />,
        menuItems: [],
    },
    {
        code: "administration",
        label: "Administración",
        icon: <SettingOutlined />,
        menuItems: [
            { code: "users", label: "Usuarios", icon: <TeamOutlined />, requiredPermission: ADMINISTRATION_NAVIGATION_PERMISSION, routePath: ADMINISTRATION_USERS_PATH },
            { code: "roles-permissions", label: "Roles y seguridad", icon: <SafetyOutlined />, requiredPermission: ADMINISTRATION_SECURITY_PERMISSION, routePath: ADMINISTRATION_ROLES_SECURITY_PATH },
            { code: "audit-log", label: "Auditoría", icon: <AuditOutlined />, requiredPermission: ADMINISTRATION_SECURITY_PERMISSION, routePath: ADMINISTRATION_AUDIT_LOGS_PATH },
        ],
    },
    {
        code: "sales",
        label: "Ventas",
        icon: <RiseOutlined />,
        menuItems: [
            { code: "sales-home", label: "Resumen", icon: <DashboardOutlined />, requiredPermission: "lead.read", routePath: SALES_HOME_PATH },
            { code: "sales-leads", label: "Leads", icon: <UserAddOutlined />, requiredPermission: "lead.read", routePath: SALES_HOME_PATH },
            { code: "sales-opportunities", label: "Oportunidades", icon: <FunnelPlotOutlined />, requiredPermission: "opportunity.read", routePath: SALES_HOME_PATH },
            { code: "sales-estimates", label: "Estimaciones", icon: <CalculatorOutlined />, requiredPermission: "estimate.read", routePath: SALES_HOME_PATH },
        ],
    },
    {
        code: "marketing",
        label: "Mercadeo",
        icon: <NotificationOutlined />,
        menuItems: [
            { code: "marketing-home", label: "Resumen", icon: <DashboardOutlined />, requiredPermission: "campaign.read", routePath: MARKETING_HOME_PATH },
            { code: "marketing-campaigns", label: "Campañas", icon: <FlagOutlined />, requiredPermission: "campaign.read", routePath: MARKETING_HOME_PATH },
        ],
    },
    {
        code: "formalization",
        label: "Formalización",
        icon: <FileProtectOutlined />,
        menuItems: [
            { code: "formalization-home", label: "Resumen", icon: <DashboardOutlined />, requiredPermission: "file.read", routePath: FORMALIZATION_HOME_PATH },
            { code: "formalization-files", label: "Expedientes", icon: <FolderOpenOutlined />, requiredPermission: "file.read", routePath: FORMALIZATION_HOME_PATH },
            { code: "formalization-contracts", label: "Contratos", icon: <FileDoneOutlined />, requiredPermission: "contract.review", routePath: FORMALIZATION_HOME_PATH },
        ],
    },
    {
        code: "accounting",
        label: "Contabilidad",
        icon: <AccountBookOutlined />,
        menuItems: [
            { code: "accounting-home", label: "Resumen", icon: <DashboardOutlined />, requiredPermission: "wallet.read", routePath: ACCOUNTING_HOME_PATH },
            { code: "accounting-wallet", label: "Cartera", icon: <WalletOutlined />, requiredPermission: "wallet.read", routePath: ACCOUNTING_HOME_PATH },
            { code: "accounting-invoices", label: "Facturas", icon: <FileTextOutlined />, requiredPermission: "invoice.read", routePath: ACCOUNTING_HOME_PATH },
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
        menuItems: visibleMenuItems,
    };
};

/**
 * Reconstruye "Todos" desde los perfiles ya filtrados.
 *
 * Cada módulo aporta sus ítems con permiso; uno sin código no entra como hijo.
 */
const buildAllWorkspace = (allWorkspace: WorkspaceProfile, moduleWorkspaces: readonly WorkspaceProfile[], allowedPermissions: ReadonlySet<string>): WorkspaceProfile | null => {
    const globalSummaryItem = allWorkspace.menuItems[0];
    const visibleGlobalItems: readonly GlobalMenuItem[] = globalSummaryItem && isPermissionAllowed(globalSummaryItem.requiredPermission, allowedPermissions) ? [globalSummaryItem] : [];
    const moduleMenuItems = moduleWorkspaces.map((workspace): GlobalMenuItem => {
        const primaryMenuItem = workspace.menuItems[0];
        const visibleChildren = workspace.menuItems.flatMap(({ code, label, icon, isActive, requiredPermission, routePath }): readonly GlobalMenuOption[] => (requiredPermission ? [{ code, label, icon, ...(isActive === undefined ? {} : { isActive }), ...(routePath === undefined ? {} : { routePath }), requiredPermission }] : []));

        return {
            code: `all-${workspace.code}`,
            label: workspace.label,
            icon: workspace.icon,
            ...(primaryMenuItem?.requiredPermission ? { requiredPermission: primaryMenuItem.requiredPermission } : {}),
            children: visibleChildren,
        };
    });
    const menuItems = [...visibleGlobalItems, ...moduleMenuItems];

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
 * "Todos" va primero solo cuando hay más de un módulo que agrupar. Si el filtro
 * vacía todos los módulos, la lista sale vacía: no se rellena con el catálogo sin filtrar.
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

    return visibleAllWorkspace && visibleModuleWorkspaces.length > 1 ? [visibleAllWorkspace, ...visibleModuleWorkspaces] : visibleModuleWorkspaces;
};

/**
 * Acciones de cabecera todavía visuales.
 *
 * Sin conteos inventados: un número en la campana solo debe aparecer cuando
 * venga del API. El cambio de módulo vive en el selector, no aquí.
 */
const HEADER_ACTIONS: readonly HeaderAction[] = [{ label: "Notificaciones", hint: "Notificaciones", icon: <BellOutlined /> }];

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

    if (workspaceCode === ALL_WORKSPACE_CODE) {
        return "global.more.read";
    }

    return `${workspaceCode}.more.read`;
};

/**
 * Convierte un ítem que no cupo en la barra en opción del menú "Más".
 *
 * Si no trae permiso, usa `navigation.read` para no publicar una opción sin
 * código.
 */
const toOverflowOption = ({ code, label, icon, requiredPermission, routePath }: GlobalMenuItem): GlobalMenuOption => ({
    code,
    label,
    icon,
    ...(routePath === undefined ? {} : { routePath }),
    requiredPermission: requiredPermission ?? "navigation.read",
});

const setActiveMenuItem = (workspace: WorkspaceProfile, activeMenuItemCode: string | undefined): WorkspaceProfile => ({
    ...workspace,
    menuItems: workspace.menuItems.map((item) => ({
        ...item,
        isActive: activeMenuItemCode === item.code,
        ...(item.children
            ? {
                  children: item.children.map((child) => ({
                      ...child,
                      isActive: activeMenuItemCode === child.code,
                  })),
              }
            : {}),
    })),
});

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
 * Los perfiles muestran todo hasta que el ancho obligue a desbordar.
 * "Más" hereda el activo si la página actual quedó fuera.
 */
const getResponsiveMenuItems = (workspace: WorkspaceProfile, availableWidth: number | null): readonly GlobalMenuItem[] => {
    const defaultVisibleCount = workspace.menuItems.length;
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

/** Botón de cabecera sin acción todavía; el tooltip lo dice para no dejar al usuario adivinando. */
const renderHeaderAction = ({ label, hint, icon }: HeaderAction) => (
    <Tooltip key={label} title={hint} placement="bottom">
        <button className="global-home-header__icon-button" type="button" aria-label={label}>
            {icon}
        </button>
    </Tooltip>
);

const getUserDisplayName = (user?: GlobalHomeCurrentUser): string => user?.displayName.trim() || user?.email.trim() || "Usuario actual";

const getUserShortDisplayName = (user?: GlobalHomeCurrentUser): string => {
    const displayName = getUserDisplayName(user);
    const words = displayName.split(/\s+/u).filter(Boolean);

    if (words.length <= 2) {
        return displayName;
    }

    const firstName = words[0] ?? displayName;
    const firstLastName = words[2] ?? words[1] ?? "";

    return `${firstName} ${firstLastName}`.trim();
};

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

function UserTooltipContent({ user }: { readonly user: GlobalHomeCurrentUser | undefined }) {
    return (
        <span className="global-home-user-tooltip">
            <strong>{getUserDisplayName(user)}</strong>
            <span>{getUserSecondaryLabel(user)}</span>
        </span>
    );
}

function UserAvatarContent({ user }: { readonly user: GlobalHomeCurrentUser | undefined }) {
    const [refreshNonce, setRefreshNonce] = useState<number | null>(null);
    const [isImageUnavailable, setIsImageUnavailable] = useState(false);
    const profileImageUrl = user?.profileImageUrl;
    const imageSrc = profileImageUrl && !isImageUnavailable ? buildProfilePhotoUrl(profileImageUrl, refreshNonce) : null;

    if (!imageSrc) {
        return <span className="global-home-user-avatar__initials">{getUserInitials(user)}</span>;
    }

    return (
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
    );
}

/**
 * Barra móvil. En escritorio el CSS la oculta.
 *
 * Es la única entrada al cajón de navegación.
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
const renderDrawerChildItem = (item: GlobalMenuItem | GlobalMenuOption, activeCode: string | undefined, isFocusable: boolean, onMenuItemSelect: (routePath: string) => void) => {
    const isActive = item.code === activeCode;

    return (
        <button
            key={item.code}
            className={`global-home-mobile-drawer__child${isActive ? " global-home-mobile-drawer__child--active" : ""}`}
            type="button"
            tabIndex={isFocusable ? undefined : -1}
            data-permission={item.requiredPermission}
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
                if (item.routePath) {
                    onMenuItemSelect(item.routePath);
                }
            }}
        >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
        </button>
    );
};

function MobileGlobalSummaryLink({ activeWorkspace, globalWorkspace, onSelect, onWorkspaceToggle }: { readonly activeWorkspace: WorkspaceProfile; readonly globalWorkspace: WorkspaceProfile | undefined; readonly onSelect: (code: string) => void; readonly onWorkspaceToggle: (code: string) => void }) {
    const globalSummaryItem = globalWorkspace?.menuItems[0];

    if (!globalWorkspace || !globalSummaryItem) {
        return null;
    }

    const isGlobalSummaryActive = activeWorkspace.code === globalWorkspace.code;

    return (
        <>
            <span className="global-home-mobile-drawer__category">Vista global</span>
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
        </>
    );
}

function MobileWorkspaceSection({ activeMenuItemCode, activeWorkspace, onMenuItemSelect, onSelect, onWorkspaceToggle, openWorkspaceCode, workspace }: { readonly activeMenuItemCode: string | undefined; readonly activeWorkspace: WorkspaceProfile; readonly onMenuItemSelect: (routePath: string) => void; readonly onSelect: (code: string) => void; readonly onWorkspaceToggle: (code: string) => void; readonly openWorkspaceCode: string; readonly workspace: WorkspaceProfile }) {
    const isActiveWorkspace = workspace.code === activeWorkspace.code;
    const isExpanded = workspace.code === openWorkspaceCode;
    const drawerPanelId = `global-home-mobile-drawer-${workspace.code}`;

    const handleToggle = () => {
        if (isExpanded) {
            onWorkspaceToggle("");
            return;
        }

        onWorkspaceToggle(workspace.code);

        if (!isActiveWorkspace) {
            onSelect(workspace.code);
        }
    };

    return (
        <section className="global-home-mobile-drawer__module">
            <button className={`global-home-mobile-drawer__module-trigger${isActiveWorkspace ? " global-home-mobile-drawer__module-trigger--active" : ""}${isExpanded ? " global-home-mobile-drawer__module-trigger--expanded" : ""}`} type="button" aria-controls={drawerPanelId} aria-expanded={isExpanded} onClick={handleToggle}>
                <span className="global-home-mobile-drawer__module-label">
                    <span aria-hidden="true">{workspace.icon}</span>
                    <span>{workspace.label}</span>
                </span>
                <DownOutlined aria-hidden="true" />
            </button>

            <div id={drawerPanelId} className={`global-home-mobile-drawer__children${isExpanded ? " global-home-mobile-drawer__children--open" : ""}`} role="group" aria-label={`Opciones de ${workspace.label}`} aria-hidden={!isExpanded}>
                <div className="global-home-mobile-drawer__children-inner">{workspace.menuItems.map((item) => renderDrawerChildItem(item, activeMenuItemCode, isExpanded, onMenuItemSelect))}</div>
            </div>
        </section>
    );
}

/**
 * Cajón de navegación móvil.
 *
 * Cerrado no se monta, para que el diálogo no quede en el árbol accesible.
 * Abrir un perfil que no es el activo también lo selecciona. Cerrarlo solo
 * colapsa el acordeón y deja el perfil actual.
 */
function MobileNavigationDrawer({ activeMenuItemCode, activeWorkspace, assignedWorkspaces, isOpen, openWorkspaceCode, onClose, onLogout, onMenuItemSelect, onSelect, onWorkspaceToggle, user }: MobileNavigationDrawerProps) {
    const firstWorkspace = assignedWorkspaces[0];
    const globalWorkspace = firstWorkspace?.code === ALL_WORKSPACE_CODE ? firstWorkspace : undefined;
    const moduleWorkspaces = globalWorkspace ? assignedWorkspaces.slice(1) : assignedWorkspaces;

    if (!isOpen) {
        return null;
    }

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
                    <input type="search" aria-label="Buscar en menú móvil" placeholder="Buscar" />
                </div>

                <div className="global-home-mobile-drawer__section">
                    <span className="global-home-mobile-drawer__eyebrow">Menú principal</span>
                    <div className="global-home-mobile-drawer__modules">
                        <MobileGlobalSummaryLink activeWorkspace={activeWorkspace} globalWorkspace={globalWorkspace} onSelect={onSelect} onWorkspaceToggle={onWorkspaceToggle} />

                        <span className="global-home-mobile-drawer__category">Módulos asignados</span>
                        {moduleWorkspaces.map((workspace) => (
                            <MobileWorkspaceSection key={workspace.code} activeMenuItemCode={activeMenuItemCode} activeWorkspace={activeWorkspace} onMenuItemSelect={onMenuItemSelect} onSelect={onSelect} onWorkspaceToggle={onWorkspaceToggle} openWorkspaceCode={openWorkspaceCode} workspace={workspace} />
                        ))}
                    </div>
                </div>

                <div className="global-home-mobile-drawer__section global-home-mobile-drawer__section--secondary">
                    <span className="global-home-mobile-drawer__eyebrow">Accesos rápidos</span>
                    <button type="button">
                        <SettingOutlined aria-hidden="true" />
                        Ajustes
                    </button>
                    <button type="button">
                        <QuestionCircleOutlined aria-hidden="true" />
                        Ayuda
                    </button>
                    <button type="button" onClick={onLogout}>
                        <LogoutOutlined aria-hidden="true" />
                        Cerrar sesión
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
    const renderOption = ({ code, label, icon }: WorkspaceProfile) => (
        <button
            key={code}
            className={`global-home-workspace-menu__item${code === activeCode ? " global-home-workspace-menu__item--active" : ""}`}
            type="button"
            onClick={() => {
                onSelect(code);
            }}
            aria-pressed={code === activeCode}
        >
            <span className="global-home-workspace-menu__icon" aria-hidden="true">
                {icon}
            </span>
            <span className="global-home-workspace-menu__label">{label}</span>
            {code === activeCode ? <CheckOutlined className="global-home-workspace-menu__check" aria-hidden="true" /> : null}
        </button>
    );

    return renderOption;
};

/** Opción de dropdown. El permiso va en `data-permission` para la UX, no como control de acceso. */
const renderMenuOption = ({ code, label, isActive, requiredPermission, routePath, icon }: GlobalMenuOption, onSelectRoute: (routePath: string) => void) => (
    <button
        key={code}
        className={`global-home-menu__dropdown-item${isActive ? " global-home-menu__dropdown-item--active" : ""}`}
        type="button"
        aria-current={getOptionalAriaCurrent(isActive)}
        data-permission={requiredPermission}
        onClick={() => {
            if (routePath) {
                onSelectRoute(routePath);
            }
        }}
    >
        <span className="global-home-menu__dropdown-icon" aria-hidden="true">
            {icon}
        </span>
        <span className="global-home-menu__dropdown-label">{label}</span>
    </button>
);

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
function GlobalMenuDropdown({ id, isOpen, label, onPointerEnter, onPointerLeave, onSelectRoute, options }: GlobalMenuDropdownProps) {
    if (!isOpen) {
        return null;
    }

    return (
        <div id={id} className="global-home-menu__dropdown" role="menu" aria-label={`Opciones de ${label}`} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
            {options.map((option) => renderMenuOption(option, onSelectRoute))}
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
function GlobalMenuNode({ item, isOpen, onBlur, onClose, onOpenChange, onSelectRoute }: GlobalMenuNodeProps) {
    const { code, label, icon, requiredPermission, routePath, hideChevron, children } = item;
    const isActive = hasActiveMenuItem(item);
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
        onClose(code);
    };

    /** Espera el retardo para que el puntero pueda cruzar hasta el panel. */
    const closeWithPointerTolerance = () => {
        clearPendingClose();
        closeTimerRef.current = window.setTimeout(() => {
            closeTimerRef.current = null;
            onClose(code);
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

        if (!hasChildren && routePath) {
            onSelectRoute(routePath);
            onOpenChange(null);
            return;
        }

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
            <button className={getMenuItemClassName(isActive, hasChildren && isOpen)} type="button" aria-current={getOptionalAriaCurrent(item.isActive)} aria-controls={getOptionalAriaControls(hasChildren, dropdownId)} aria-expanded={getOptionalAriaExpanded(hasChildren, isOpen)} data-permission={requiredPermission} onClick={handleClick} onKeyDown={handleKeyDown}>
                <span className="global-home-menu__icon" aria-hidden="true">
                    {icon}
                </span>
                <span className="global-home-menu__label">{label}</span>
                <GlobalMenuChevron isVisible={hasChildren && !hideChevron} />
            </button>

            {hasChildren && isOpen ? <span className="global-home-menu__dropdown-bridge" aria-hidden="true" onPointerEnter={clearPendingClose} /> : null}
            <GlobalMenuDropdown id={dropdownId} isOpen={hasChildren && isOpen} label={label} onPointerEnter={clearPendingClose} onPointerLeave={closeWithPointerTolerance} onSelectRoute={onSelectRoute} options={options} />
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
                <span className="global-home-header__selector-icon" aria-hidden="true">
                    {activeWorkspace.icon}
                </span>
                <span className="global-home-header__selector-copy">{activeWorkspace.label}</span>
                <DownOutlined className="global-home-header__selector-chevron" aria-hidden="true" />
            </button>

            {isOpen ? (
                <div id={selectorMenuId} className="global-home-workspace-menu" aria-label="Módulos asignados">
                    {assignedWorkspaces.map(renderWorkspaceOption(activeWorkspace.code, handleSelect))}
                </div>
            ) : null}
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
export function GlobalHomeShell({ activeMenuItemCode, children, currentUser, effectivePermissions = DEMO_EFFECTIVE_NAVIGATION_PERMISSIONS, initialWorkspaceCode, onLogout, onMenuItemSelect, onWorkspaceChange }: GlobalHomeShellProps) {
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
    const activeWorkspaceWithCurrentRoute = setActiveMenuItem(activeWorkspace, activeMenuItemCode);
    const safeOpenMobileWorkspaceCode = getWorkspaceProfile(openMobileWorkspaceCode, assignedWorkspaces)?.code ?? activeWorkspace.code;
    const menuItems = getResponsiveMenuItems(activeWorkspaceWithCurrentRoute, menuTrackWidth);
    const isSingleMenuItemMode = menuItems.length === 1;
    const selectMenuItemRoute = (routePath: string) => {
        setOpenMenuCode(null);
        setIsMobileDrawerOpen(false);
        onMenuItemSelect?.(routePath);
    };

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
                activeMenuItemCode={activeMenuItemCode}
                activeWorkspace={activeWorkspaceWithCurrentRoute}
                assignedWorkspaces={assignedWorkspaces}
                isOpen={isMobileDrawerOpen}
                openWorkspaceCode={safeOpenMobileWorkspaceCode}
                onClose={() => {
                    setIsMobileDrawerOpen(false);
                }}
                onLogout={onLogout}
                onMenuItemSelect={selectMenuItemRoute}
                onSelect={selectWorkspace}
                onWorkspaceToggle={setOpenMobileWorkspaceCode}
                user={currentUser}
            />

            <header className="global-home-header" role="banner" aria-label="Barra superior global CRM TINK">
                <div className="global-home-header__inner">
                    <div className="global-home-header__brand">
                        <img className="global-home-header__logo" src={ROCCA_LOGO_SRC} width="1121" height="405" alt="ROCCA Development Group" />
                    </div>

                    <div className="global-home-header__workspace" role="group" aria-label="Módulo y búsqueda">
                        <WorkspaceSelector activeWorkspace={activeWorkspace} assignedWorkspaces={assignedWorkspaces} isOpen={isWorkspaceSelectorOpen} onOpenChange={setIsWorkspaceSelectorOpen} onSelect={selectWorkspace} />
                        <button className="global-home-header__command" type="button" aria-label="Abrir búsqueda global">
                            <SearchOutlined aria-hidden="true" />
                            <span className="global-home-header__command-copy">Buscar</span>
                            <kbd>{getCommandShortcutLabel()}</kbd>
                        </button>
                    </div>

                    <div className="global-home-header__actions" role="group" aria-label="Cuenta y notificaciones">
                        {HEADER_ACTIONS.map(renderHeaderAction)}
                        <Tooltip title={<UserTooltipContent user={currentUser} />} placement="bottomRight">
                            <button className="global-home-header__avatar" type="button" aria-label={`Perfil actual: ${getUserDisplayName(currentUser)}`}>
                                <UserAvatarContent key={getUserAvatarKey(currentUser)} user={currentUser} />
                                <span className="global-home-header__avatar-name">{getUserShortDisplayName(currentUser)}</span>
                            </button>
                        </Tooltip>
                        {onLogout ? (
                            <Tooltip title="Cerrar sesión" placement="bottomRight">
                                <button className="global-home-header__logout-button" type="button" aria-label="Cerrar sesión" onClick={onLogout}>
                                    <LogoutOutlined aria-hidden="true" />
                                </button>
                            </Tooltip>
                        ) : null}
                    </div>
                </div>
            </header>

            <nav className={`global-home-menu${isSingleMenuItemMode ? " global-home-menu--single" : ""}`} aria-label="Navegación principal">
                <div ref={menuTrackRef} className="global-home-menu__track">
                    {menuItems.map((item) => (
                        <GlobalMenuNode
                            key={item.code}
                            item={item}
                            isOpen={openMenuCode === item.code}
                            onBlur={closeMenuOnBlur}
                            onClose={(codeToClose) => {
                                setOpenMenuCode((currentCode) => (currentCode === codeToClose ? null : currentCode));
                            }}
                            onOpenChange={setOpenMenuCode}
                            onSelectRoute={selectMenuItemRoute}
                        />
                    ))}
                </div>
            </nav>

            <main className="global-home-stage" aria-label="Contenido principal">
                <img className="global-home-stage__watermark" src={ROCCA_LOGO_SRC} width="1121" height="405" alt="" aria-hidden="true" />
                {children}
            </main>
        </div>
    );
}
