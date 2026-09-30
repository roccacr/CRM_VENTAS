import { Inject, Injectable } from "@nestjs/common";

import type { EncryptedMicrosoftCache } from "../../../common/security/microsoft-msal-cache-crypto.service.js";
import type { IdentityActiveSession, IdentityProfile } from "./identity.types.js";
import { IdentityLocalRepository } from "./identity-local.repository.js";
import { IdentityMicrosoftRepository } from "./identity-microsoft.repository.js";
import { IdentityProfileRepository } from "./identity-profile.repository.js";
import { IdentitySessionRepository } from "./identity-session.repository.js";

export type LocalLoginIdentity = {
    authIdentityId: number;
    failedLoginCount: number;
    lockedUntil: Date | null;
    passwordHash: string;
    permissionVersion: number;
    userId: number;
};

export type FailedLocalLoginRecord = {
    failedLoginCount: number;
    lockedUntil: Date | null;
};

export type ResettableLocalIdentity = {
    authIdentityId: number;
    userId: number;
};

export type MicrosoftLoginIdentity = {
    authIdentityId: number;
    permissionVersion: number;
    userId: number;
};

export type MicrosoftIdentityResolution = { identity: MicrosoftLoginIdentity; status: "ready" } | { status: "not_found" | "user_not_active" };

export interface ProfileImageRecord {
    bytes: Buffer;
    mimeType: string;
}

export interface CreateIdentitySessionInput {
    authIdentityId: number;
    ipAddress?: string | undefined;
    permissionVersion: number;
    providerCode: string;
    refreshExpiresAt: Date;
    refreshFamilyId: string;
    refreshTokenHash: string;
    sessionExpiresAt: Date;
    sessionPublicId: string;
    sessionTokenHash: string;
    userAgent?: string | undefined;
    userId: number;
}

export interface RotateRefreshSessionInput {
    refreshTokenHash: string;
    nextRefreshExpiresAt: Date;
    nextRefreshTokenHash: string;
    nextSessionExpiresAt: Date;
    nextSessionTokenHash: string;
}

export type RotateRefreshSessionResult =
    | {
          authIdentityId: number;
          providerCode: string;
          refreshExpiresAt: Date;
          status: "rotated";
          sessionExpiresAt: Date;
          sessionPublicId: string;
          userId: number;
      }
    | {
          status: "expired" | "invalid" | "not_found" | "permission_stale" | "reused";
          sessionPublicId?: string;
          userId?: number;
      };

export interface RefreshProviderValidation {
    authIdentityId: number;
    providerCode: string;
    sessionPublicId: string;
    userId: number;
}

export interface CreateLocalPasswordResetTokenInput {
    authIdentityId: number;
    expiresAt: Date;
    ipAddress?: string | undefined;
    tokenHash: string;
    userAgent?: string | undefined;
}

export interface CompleteLocalPasswordResetInput {
    ipAddress?: string | undefined;
    passwordHash: string;
    tokenHash: string;
    userAgent?: string | undefined;
}

export type CompleteLocalPasswordResetResult = { status: "completed"; userId: number } | { status: "expired" | "invalid" | "not_found" };

export type RevokeOwnSessionResult = { status: "revoked" | "not_found" | "not_authenticated" };

export interface MicrosoftAccountCache {
    authIdentityId: number;
    cache: EncryptedMicrosoftCache;
    homeAccountId: string;
}

export interface MicrosoftSessionAccountCache extends MicrosoftAccountCache {
    sourceSubject: string;
    userId: number;
}

export interface MicrosoftIdentityInput {
    cache: EncryptedMicrosoftCache;
    displayName: string;
    email: string;
    graphSyncedAt: Date | null;
    homeAccountId: string;
    oid: string;
    profileImage: {
        bytes: Buffer;
        mimeType: string;
        publicUrl: string;
        sourceSubject: string;
    } | null;
    subject: string;
    tenantId: string;
}

/**
 * Fachada estable de persistencia de identidad.
 *
 * Mantiene el contrato que consume `IdentityService`, pero delega SQL concreto
 * a repositorios internos por responsabilidad: perfil/permisos, sesiones,
 * credenciales locales y Microsoft 365.
 */
@Injectable()
export class IdentityRepository {
    /**
     * Inyecta repositorios internos por responsabilidad.
     */
    constructor(
        @Inject(IdentityProfileRepository) private readonly profiles: IdentityProfileRepository,
        @Inject(IdentitySessionRepository) private readonly sessions: IdentitySessionRepository,
        @Inject(IdentityLocalRepository) private readonly local: IdentityLocalRepository,
        @Inject(IdentityMicrosoftRepository) private readonly microsoft: IdentityMicrosoftRepository,
    ) {}

    /**
     * Carga identidad desde hash de token opaco de sesion.
     */
    async findBySessionTokenHash(sessionTokenHash: string): Promise<IdentityProfile | null> {
        return this.profiles.findBySessionTokenHash(sessionTokenHash);
    }

    /**
     * Busca una identidad local activa por correo normalizado para login.
     */
    async findActiveLocalIdentity(normalizedEmail: string): Promise<LocalLoginIdentity | null> {
        return this.local.findActiveLocalIdentity(normalizedEmail);
    }

    /**
     * Busca una identidad local activa o pendiente para emitir reset neutral.
     */
    async findResettableLocalIdentity(normalizedEmail: string): Promise<ResettableLocalIdentity | null> {
        return this.local.findResettableLocalIdentity(normalizedEmail);
    }

    /**
     * Busca una identidad Microsoft pre-provisionada.
     */
    async findActiveMicrosoftIdentity(input: { normalizedEmail: string; subject: string }): Promise<MicrosoftLoginIdentity | null> {
        return this.microsoft.findActiveMicrosoftIdentity(input);
    }

    /**
     * Busca o crea la identidad Microsoft para un usuario CRM activo por correo.
     */
    async findOrCreateActiveMicrosoftIdentityForVerifiedEmail(input: { email: string; normalizedEmail: string; subject: string }): Promise<MicrosoftIdentityResolution> {
        return this.microsoft.findOrCreateActiveMicrosoftIdentityForVerifiedEmail(input);
    }

    /**
     * Persiste metadata Microsoft y cache MSAL cifrada.
     */
    async saveMicrosoftAccount(input: MicrosoftIdentityInput & MicrosoftLoginIdentity): Promise<void> {
        await this.microsoft.saveMicrosoftAccount(input);
    }

    /**
     * Lee cache MSAL cifrada para una identidad Microsoft.
     */
    async findMicrosoftAccountCache(authIdentityId: number): Promise<MicrosoftAccountCache | null> {
        return this.microsoft.findMicrosoftAccountCache(authIdentityId);
    }

    /**
     * Lee cache MSAL Microsoft desde una sesion CRM activa.
     */
    async findMicrosoftAccountCacheBySessionTokenHash(sessionTokenHash: string): Promise<MicrosoftSessionAccountCache | null> {
        return this.microsoft.findMicrosoftAccountCacheBySessionTokenHash(sessionTokenHash);
    }

    /**
     * Lee la foto cacheada asociada a una sesion activa.
     */
    async findProfileImageBySessionTokenHash(sessionTokenHash: string): Promise<ProfileImageRecord | null> {
        return this.microsoft.findProfileImageBySessionTokenHash(sessionTokenHash);
    }

    /**
     * Actualiza la foto cacheada del usuario desde Microsoft Graph.
     */
    async updateUserProfileImage(input: { profileImage: NonNullable<MicrosoftIdentityInput["profileImage"]>; userId: number }): Promise<void> {
        await this.microsoft.updateUserProfileImage(input);
    }

    /**
     * Actualiza cache MSAL luego de una renovacion silenciosa exitosa.
     */
    async updateMicrosoftCache(authIdentityId: number, cache: EncryptedMicrosoftCache): Promise<void> {
        await this.microsoft.updateMicrosoftCache(authIdentityId, cache);
    }

    /**
     * Marca Microsoft como requiere login y revoca las sesiones CRM de esa identidad.
     */
    async markMicrosoftInteractionRequiredAndRevokeSessions(authIdentityId: number, userId: number): Promise<void> {
        await this.microsoft.markMicrosoftInteractionRequiredAndRevokeSessions(authIdentityId, userId);
    }

    /**
     * Incrementa contador persistente de intentos fallidos de forma atomica.
     */
    async recordFailedLocalLogin(authIdentityId: number, lockoutMaxFailures: number, lockUntil: Date): Promise<FailedLocalLoginRecord> {
        return this.local.recordFailedLocalLogin(authIdentityId, lockoutMaxFailures, lockUntil);
    }

    /**
     * Limpia lockout y contador de intentos despues de autenticacion correcta.
     */
    async recordSuccessfulLocalLogin(authIdentityId: number, userId: number): Promise<void> {
        await this.local.recordSuccessfulLocalLogin(authIdentityId, userId);
    }

    /**
     * Crea sesion backend y refresh token inicial en una sola transaccion.
     */
    async createSession(input: CreateIdentitySessionInput): Promise<void> {
        await this.sessions.createSession(input);
    }

    /**
     * Emite un token opaco de activacion/reset guardando solo su HMAC.
     */
    async createLocalPasswordResetToken(input: CreateLocalPasswordResetTokenInput): Promise<void> {
        await this.local.createLocalPasswordResetToken(input);
    }

    /**
     * Verifica si un token de reset puede consumirse antes de gastar Argon2id.
     */
    async hasUsableLocalPasswordResetToken(tokenHash: string): Promise<boolean> {
        return this.local.hasUsableLocalPasswordResetToken(tokenHash);
    }

    /**
     * Consume un token de activacion/reset y actualiza la clave local con Argon2id.
     */
    async completeLocalPasswordReset(input: CompleteLocalPasswordResetInput): Promise<CompleteLocalPasswordResetResult> {
        return this.local.completeLocalPasswordReset(input);
    }

    /**
     * Rota refresh token y token de sesion en una transaccion.
     */
    async rotateRefreshSession(input: RotateRefreshSessionInput): Promise<RotateRefreshSessionResult> {
        return this.sessions.rotateRefreshSession(input);
    }

    /**
     * Lee una sesion de refresh vigente sin consumirla para validar al proveedor externo.
     */
    async findRefreshSessionForProviderValidation(refreshTokenHash: string): Promise<RefreshProviderValidation | null> {
        return this.sessions.findRefreshSessionForProviderValidation(refreshTokenHash);
    }

    /**
     * Lista sesiones activas del usuario autenticado.
     */
    async listActiveSessions(currentSessionTokenHash: string): Promise<IdentityActiveSession[] | null> {
        return this.sessions.listActiveSessions(currentSessionTokenHash);
    }

    /**
     * Revoca una sesion activa propia por publicId.
     */
    async revokeOwnSessionByPublicId(currentSessionTokenHash: string, targetSessionPublicId: string, ipAddress?: string, userAgent?: string): Promise<RevokeOwnSessionResult> {
        return this.sessions.revokeOwnSessionByPublicId(currentSessionTokenHash, targetSessionPublicId, ipAddress, userAgent);
    }

    /**
     * Revoca una sesion por hash del token opaco.
     */
    async revokeSessionByTokenHash(sessionTokenHash: string, ipAddress?: string, userAgent?: string): Promise<void> {
        await this.sessions.revokeSessionByTokenHash(sessionTokenHash, ipAddress, userAgent);
    }
}
