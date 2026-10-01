import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import ClockCircleOutlined from "@ant-design/icons/ClockCircleOutlined";
import EditOutlined from "@ant-design/icons/EditOutlined";
import LockOutlined from "@ant-design/icons/LockOutlined";
import PoweroffOutlined from "@ant-design/icons/PoweroffOutlined";
import SendOutlined from "@ant-design/icons/SendOutlined";
import StopOutlined from "@ant-design/icons/StopOutlined";
import UnlockOutlined from "@ant-design/icons/UnlockOutlined";
import { createElement, type ReactNode } from "react";

import { buildApiUrl } from "../../config/frontend-env";
import type { SystemUserDirectoryItem, SystemUsersSummary } from "../../services/auth/identity-contracts";

export type SystemUserStatus = "active" | "blocked" | "inactive" | "pending";
export type SystemUserMfaStatus = "enabled" | "not_configured" | "pending";
export type SystemUserProvider = "local" | "microsoft" | "mixed";
export type SystemUserFilter = "all" | SystemUserStatus;
export type SystemUserDensity = "comfortable" | "compact";
export type SystemUserSortKey = "lastActivity" | "name" | "status";
export type SystemUserSortDirection = "asc" | "desc";
export type SystemUsersLoadState = "error" | "loading" | "ready";

/**
 * Fila ya preparada para la tabla.
 *
 * Las fechas salen como texto de Costa Rica. El directorio no vuelve a
 * interpretar el ISO en cada celda.
 */
export interface SystemUserListItem {
    readonly email: string;
    readonly invitedBy: string | null;
    readonly isCurrentUser?: boolean;
    readonly lastActivityIso: string | null;
    readonly lastActivityLabel: string;
    readonly mfaStatus: SystemUserMfaStatus;
    readonly name: string;
    readonly orgUnit: string;
    readonly profileImageUrl: string | null;
    readonly provider: SystemUserProvider;
    readonly publicId: string;
    readonly roleChangedAtLabel: string;
    readonly roles: readonly string[];
    readonly status: SystemUserStatus;
}

export const STATUS_LABELS: Record<SystemUserStatus, string> = {
    active: "Activo",
    blocked: "Bloqueado",
    inactive: "Inactivo",
    pending: "Pendiente",
};

export const STATUS_ICONS: Record<SystemUserStatus, ReactNode> = {
    active: createElement(CheckCircleOutlined),
    blocked: createElement(LockOutlined),
    inactive: createElement(StopOutlined),
    pending: createElement(ClockCircleOutlined),
};

/** Color semántico de AntD por estado. Lo usan la tabla, el detalle y el alta. */
export const STATUS_BADGE_STATUS: Record<SystemUserStatus, "default" | "error" | "success" | "warning"> = {
    active: "success",
    blocked: "error",
    inactive: "default",
    pending: "warning",
};

export const MFA_TAG_COLORS: Record<SystemUserMfaStatus, "default" | "success" | "warning"> = {
    enabled: "success",
    not_configured: "default",
    pending: "warning",
};

/** Texto de ayuda. El color del badge no basta para explicar el estado. */
export const STATUS_HELP_TEXT = "Activo: puede ingresar. Pendiente: invitación enviada, aún no aceptada. Inactivo: cuenta desactivada. Bloqueado: acceso suspendido por seguridad.";

export const MFA_LABELS: Record<SystemUserMfaStatus, string> = {
    enabled: "Habilitado",
    not_configured: "No configurado",
    pending: "Pendiente",
};

export const PROVIDER_LABELS: Record<SystemUserProvider, string> = {
    local: "Local",
    microsoft: "Microsoft",
    mixed: "Microsoft + Local",
};

export const FILTERS: readonly { readonly key: SystemUserFilter; readonly label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Activos" },
    { key: "pending", label: "Pendientes" },
    { key: "inactive", label: "Inactivos" },
    { key: "blocked", label: "Bloqueados" },
];

/** Coincide con el tope por defecto del BFF. La página no pide el directorio completo. */
export const SYSTEM_USERS_PAGE_SIZE = 25;
const AVATAR_TONE_COUNT = 8;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export const EMPTY_SUMMARY: SystemUsersSummary = {
    active: 0,
    all: 0,
    blocked: 0,
    inactive: 0,
    pending: 0,
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
});

/** Dos letras como máximo. Un nombre vacío no deja el avatar en blanco. */
export const getInitials = (name: string): string =>
    name
        .split(/\s+/u)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("") || "U";

/**
 * Tono estable del avatar.
 *
 * Usa publicId y correo, no el índice de la fila: al reordenar, la persona
 * conserva el mismo color.
 */
export const getAvatarTone = (user: SystemUserListItem): number => Array.from(`${user.publicId}:${user.email}`).reduce((hash, character) => hash + character.charCodeAt(0), 0) % AVATAR_TONE_COUNT;

export const normalizeSearchText = (value: string): string => value.trim().toLowerCase();

export const getFilterCount = (summary: SystemUsersSummary, filter: SystemUserFilter): number => (filter === "all" ? summary.all : summary[filter]);

/** Un valor desconocido en la URL vuelve a "Todos" en vez de pedir un estado inexistente al API. */
export const parseSystemUserFilter = (value: string | null): SystemUserFilter => FILTERS.find((filter) => filter.key === value)?.key ?? "all";

/** Cuenta filtros reales. "Todos" y una búsqueda vacía no suman. */
export const getActiveToolbarFilterCount = (activeFilter: SystemUserFilter, searchQuery: string): number => Number(activeFilter !== "all") + Number(Boolean(normalizeSearchText(searchQuery)));

export const getDensityLabel = (density: SystemUserDensity): string => (density === "comfortable" ? "Cómoda" : "Compacta");

export const getNextDensity = (density: SystemUserDensity): SystemUserDensity => (density === "comfortable" ? "compact" : "comfortable");

export const getExportUsersLabel = (userCount: number): string => `Exportar ${String(userCount)} usuarios visibles`;

/** Rango visible del pie de tabla. El total viene del API, no de la página cargada. */
export const getUsersRangeLabel = (loadState: SystemUsersLoadState, visibleCount: number, total: number): string => {
    if (loadState === "loading" && visibleCount === 0) {
        return "Cargando usuarios...";
    }

    return `Mostrando ${String(visibleCount)} de ${String(total)} usuarios`;
};

/** El botón dice cuántos llegarán en la siguiente página, no un genérico "ver más". */
export const getLoadMoreLabel = (visibleCount: number, total: number): string => `Cargar ${String(Math.min(SYSTEM_USERS_PAGE_SIZE, Math.max(total - visibleCount, 0)))} más`;

/**
 * Acción principal de la fila según el estado.
 *
 * Activo edita. Los demás estados ofrecen la recuperación que corresponde;
 * el botón todavía no llama al API.
 */
export const getPrimaryActionLabel = (user: SystemUserListItem): string => {
    if (user.status === "pending") {
        return "Reenviar";
    }

    if (user.status === "inactive") {
        return "Reactivar";
    }

    if (user.status === "blocked") {
        return "Desbloquear";
    }

    return "Editar";
};

export const getDrawerPrimaryActionLabel = (user: SystemUserListItem): string => {
    if (user.status === "active") {
        return "Editar usuario";
    }

    if (user.status === "pending") {
        return "Reenviar invitación";
    }

    if (user.status === "inactive") {
        return "Reactivar usuario";
    }

    return "Desbloquear usuario";
};

/** Solo activo y bloqueado tienen una acción de riesgo. El resto no se ofrece. */
export const getDrawerRiskActionLabel = (user: SystemUserListItem): string => {
    if (user.status === "active") {
        return "Bloquear usuario";
    }

    if (user.status === "blocked") {
        return "Desbloquear usuario";
    }

    return "Acción no disponible";
};

export const getPrimaryActionIcon = (user: SystemUserListItem): ReactNode => {
    if (user.status === "pending") {
        return createElement(SendOutlined);
    }

    if (user.status === "inactive") {
        return createElement(PoweroffOutlined);
    }

    if (user.status === "blocked") {
        return createElement(UnlockOutlined);
    }

    return createElement(EditOutlined);
};

export const getUserAtOffset = (users: readonly SystemUserListItem[], currentIndex: number, offset: -1 | 1): SystemUserListItem | null => {
    if (currentIndex < 0) {
        return null;
    }

    return users[currentIndex + offset] ?? null;
};

const formatDateTimeLabel = (value: string | null, fallback: string): string => (value ? dateTimeFormatter.format(new Date(value)).replace(".", "") : fallback);

/**
 * Texto de actividad cuando no hay fecha.
 *
 * Activo sin login y pendiente no dicen lo mismo: uno ya puede entrar y el
 * otro todavía no aceptó la invitación.
 */
const formatLastActivityLabel = (value: string | null, status: SystemUserStatus): string => {
    if (value) {
        return formatDateTimeLabel(value, "Sin actividad registrada");
    }

    if (status === "active") {
        return "Sin inicio registrado";
    }

    if (status === "pending") {
        return "Invitación pendiente";
    }

    return "Sin actividad registrada";
};

const relativeTimeFormatter = new Intl.RelativeTimeFormat("es-CR", { numeric: "auto" });

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Actividad relativa ("Hace 3 días").
 *
 * Se calcula al pintar porque depende de la hora actual; la fecha exacta queda
 * en `lastActivityLabel` para el tooltip.
 */
export const getRelativeActivityLabel = (iso: string, now: number = Date.now()): string => {
    const elapsedMs = new Date(iso).getTime() - now;
    const absoluteMs = Math.abs(elapsedMs);

    if (absoluteMs < MS_PER_HOUR) {
        return capitalize(relativeTimeFormatter.format(Math.round(elapsedMs / MS_PER_MINUTE), "minute"));
    }

    if (absoluteMs < MS_PER_DAY) {
        return capitalize(relativeTimeFormatter.format(Math.round(elapsedMs / MS_PER_HOUR), "hour"));
    }

    return capitalize(relativeTimeFormatter.format(Math.round(elapsedMs / MS_PER_DAY), "day"));
};

/**
 * Resuelve la foto contra el BFF cuando no es una URL absoluta.
 *
 * El API guarda una ruta propia para no exponer un enlace de Microsoft Graph.
 */
export const buildSystemUserPhotoUrl = (profileImageUrl: string): string => new URL(profileImageUrl.startsWith("http") ? profileImageUrl : buildApiUrl(profileImageUrl)).toString();

/** Copia el publicId. Si el navegador niega el portapapeles, no se muestra un error técnico. */
export const copyTextToClipboard = (value: string): void => {
    void navigator.clipboard.writeText(value).catch(() => undefined);
};

/**
 * Adapta el contrato del API a la fila visible.
 *
 * Conserva nombres de rol, no códigos. Un usuario sin área no queda con un
 * campo vacío.
 */
export const mapApiUserToListItem = (user: SystemUserDirectoryItem): SystemUserListItem => ({
    email: user.email,
    invitedBy: user.invitedBy,
    isCurrentUser: user.isCurrentUser,
    lastActivityIso: user.lastActivityAt,
    lastActivityLabel: formatLastActivityLabel(user.lastActivityAt, user.status),
    mfaStatus: user.mfaStatus,
    name: user.name,
    orgUnit: user.orgUnit?.name ?? "Sin área",
    profileImageUrl: user.profileImageUrl,
    provider: user.provider,
    publicId: user.publicId,
    roleChangedAtLabel: formatDateTimeLabel(user.roleChangedAt, "Sin cambios"),
    roles: user.roles.map((role) => role.name),
    status: user.status,
});
