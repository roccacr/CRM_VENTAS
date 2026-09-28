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
