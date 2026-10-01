import type { EffectivePermission } from "../permissions/permission.types.js";

/**
 * Forma de usuario expuesta al frontend.
 *
 * IDs internos MySQL e IDs de proveedores quedan intencionalmente ausentes. La
 * UI debe usar solo `publicId` y campos canonicos CRM.
 */
export interface IdentityUser {
    publicId: string;
    displayName: string;
    email: string;
    profileImageUrl: string | null;
    status: string;
    permissionVersion: number;
}

/**
 * Metadata de sesion backend expuesta bajo el patron BFF.
 *
 * Este objeto nunca contiene access tokens, refresh tokens, tokens Microsoft ni
 * secretos crudos de sesion.
 */
export interface IdentitySession {
    publicId: string;
    status: string;
    expiresAt: string;
    expiresInSeconds: number;
    permissionVersion: number;
}

/**
 * Estado seguro de la vinculacion Microsoft.
 */
export interface IdentityMicrosoftStatus {
    homeAccountId: string | null;
    interactionRequired: boolean;
    lastSyncedAt: string | null;
    tenantId: string | null;
}

/**
 * Sesion activa visible para gestion remota de dispositivos.
 *
 * No expone token opaco ni hashes. Solo muestra metadata segura para que el
 * usuario reconozca sesiones y pueda revocarlas.
 */
export interface IdentityActiveSession {
    publicId: string;
    createdAt: string;
    expiresAt: string;
    ipAddress: string | null;
    isCurrent: boolean;
    userAgent: string | null;
}

/**
 * Rol activo asignado al usuario canonico CRM.
 */
export interface IdentityRole {
    code: string;
    name: string;
    status: string;
}

/**
 * Membresia organizacional activa usada para scope ABAC.
 */
export interface IdentityOrgUnit {
    publicId: string;
    code: string;
    name: string;
    membership: string;
    scope: string;
    status: string;
}

/**
 * Proveedores de autenticacion disponibles para este usuario canonico CRM.
 */
export interface IdentityAuthSummary {
    primaryProvider: "microsoft";
    availableProviders: string[];
    currentProvider: string;
    localStatus: string;
    microsoft: IdentityMicrosoftStatus | null;
}

/**
 * Perfil completo de identidad retornado por `/identity/me`.
 */
export interface IdentityProfile {
    user: IdentityUser;
    session: IdentitySession;
    auth: IdentityAuthSummary;
    roles: IdentityRole[];
    orgUnits: IdentityOrgUnit[];
    permissions: EffectivePermission[];
}

/**
 * Consulta de sesion retornada por `/identity/session`.
 */
export interface SessionResponse {
    authenticated: boolean;
    session: IdentitySession | null;
    user: IdentityUser | null;
}

/**
 * Respuesta del endpoint de sesiones activas.
 */
export interface ActiveSessionsResponse {
    sessions: IdentityActiveSession[];
}

export type SystemUserStatus = "active" | "blocked" | "inactive" | "pending";
export type SystemUserProvider = "local" | "microsoft" | "mixed";
export type SystemUserMfaStatus = "enabled" | "not_configured" | "pending";

export interface SystemUserDirectoryRole {
    code: string;
    name: string;
}

export interface SystemUserDirectoryOrgUnit {
    code: string;
    name: string;
    publicId: string;
}

/**
 * Fila del directorio administrativo.
 *
 * El estado es el que ya resolvió el API. `isCurrentUser` marca la sesión
 * abierta para que la UI no ofrezca bloquear esa cuenta.
 */
export interface SystemUserDirectoryItem {
    email: string;
    invitedBy: string | null;
    isCurrentUser: boolean;
    lastActivityAt: string | null;
    mfaStatus: SystemUserMfaStatus;
    name: string;
    orgUnit: SystemUserDirectoryOrgUnit | null;
    profileImageUrl: string | null;
    provider: SystemUserProvider;
    publicId: string;
    roleChangedAt: string | null;
    roles: SystemUserDirectoryRole[];
    status: SystemUserStatus;
}

/**
 * Conteos del directorio completo, no de la página visible.
 *
 * Los KPI no deben cambiar solo porque el cursor avanzó.
 */
export interface SystemUsersSummary {
    active: number;
    all: number;
    blocked: number;
    inactive: number;
    pending: number;
}

/**
 * Cursor opaco de la página siguiente.
 *
 * No es un offset. Si el orden cambia, el cursor anterior deja de ser válido.
 */
export interface SystemUsersPageInfo {
    limit: number;
    nextCursor: string | null;
    total: number;
}

export interface SystemUsersListResponse {
    items: SystemUserDirectoryItem[];
    page: SystemUsersPageInfo;
    summary: SystemUsersSummary;
}
