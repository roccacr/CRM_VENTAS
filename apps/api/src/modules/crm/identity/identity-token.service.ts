import { createHmac, randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ulid } from "ulid";

// ============================================================================
// Servicio de tokens de identidad.
//
// Responsabilidad unica: generar tokens opacos y producir hashes persistibles.
// No consulta MySQL, no decide login y no conoce cookies HTTP. Esa separacion
// permite reutilizarlo para login local, Microsoft y refresh sin duplicar
// seguridad criptografica.
// ============================================================================

/** Bytes aleatorios para tokens BFF de sesion y refresh. */
const AUTH_TOKEN_BYTES = 32;

/**
 * Ventana absoluta aprobada para sesion BFF.
 *
 * La regla de negocio vigente exige que, despues de 8 horas, el usuario vuelva
 * a autenticarse. El refresh rota tokens dentro de esta ventana, pero no debe
 * convertir la sesion en indefinida.
 */
const AUTH_SESSION_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;

/** Vida maxima de tokens de activacion/reset local. */
const LOCAL_RESET_TTL_MS = 30 * 60 * 1000;

export interface IssuedIdentityTokens {
    refreshExpiresAt: Date;
    refreshFamilyId: string;
    refreshToken: string;
    refreshTokenHash: string;
    sessionExpiresAt: Date;
    sessionPublicId: string;
    sessionToken: string;
    sessionTokenHash: string;
}

export interface RotatedRefreshToken {
    refreshExpiresAt: Date;
    refreshToken: string;
    refreshTokenHash: string;
}

export interface IssuedSessionToken {
    sessionExpiresAt: Date;
    sessionToken: string;
    sessionTokenHash: string;
}

export interface IssuedLocalResetToken {
    resetToken: string;
    resetTokenExpiresAt: Date;
    resetTokenHash: string;
}

/**
 * Suma milisegundos a una fecha usando Date UTC interna de JavaScript.
 */
const addMilliseconds = (base: Date, milliseconds: number): Date => new Date(base.getTime() + milliseconds);

/**
 * Genera un token opaco base64url apto para cookie.
 */
const createOpaqueToken = (): string => randomBytes(AUTH_TOKEN_BYTES).toString("base64url");

/**
 * Genera tokens opacos e HMACs para sesiones BFF y refresh rotation.
 */
@Injectable()
export class IdentityTokenService {
    /**
     * Inyecta secretos validados por ConfigModule.
     */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /**
     * Emite los tokens iniciales de una sesion nueva.
     */
    issueInitialTokens(now = new Date()): IssuedIdentityTokens {
        const session = this.issueSessionToken(now);
        const refreshToken = createOpaqueToken();

        return {
            refreshExpiresAt: addMilliseconds(now, AUTH_SESSION_ABSOLUTE_TTL_MS),
            refreshFamilyId: ulid(),
            refreshToken,
            refreshTokenHash: this.hashToken(refreshToken),
            sessionExpiresAt: session.sessionExpiresAt,
            sessionPublicId: ulid(),
            sessionToken: session.sessionToken,
            sessionTokenHash: session.sessionTokenHash,
        };
    }

    /**
     * Emite un token de sesion nuevo sin cambiar el publicId de auditoria.
     */
    issueSessionToken(now = new Date()): IssuedSessionToken {
        const sessionToken = createOpaqueToken();

        return {
            sessionExpiresAt: addMilliseconds(now, AUTH_SESSION_ABSOLUTE_TTL_MS),
            sessionToken,
            sessionTokenHash: this.hashToken(sessionToken),
        };
    }

    /**
     * Emite un refresh token nuevo para la misma familia.
     */
    rotateRefreshToken(now = new Date()): RotatedRefreshToken {
        const refreshToken = createOpaqueToken();

        return {
            refreshExpiresAt: addMilliseconds(now, AUTH_SESSION_ABSOLUTE_TTL_MS),
            refreshToken,
            refreshTokenHash: this.hashToken(refreshToken),
        };
    }

    /**
     * Emite un token opaco para activacion/reset local.
     *
     * El token plano solo debe salir hacia el canal de entrega aprobado
     * (correo/servicio de invitacion futuro). En base se guarda su HMAC.
     */
    issueLocalResetToken(now = new Date()): IssuedLocalResetToken {
        const resetToken = createOpaqueToken();

        return {
            resetToken,
            resetTokenExpiresAt: addMilliseconds(now, LOCAL_RESET_TTL_MS),
            resetTokenHash: this.hashToken(resetToken),
        };
    }

    /**
     * Convierte un token opaco en HMAC persistible.
     *
     * La base nunca debe guardar tokens planos. HMAC permite comparar tokens sin
     * que un dump de DB baste para autenticar requests.
     */
    hashToken(token: string): string {
        return createHmac("sha256", this.config.getOrThrow<string>("AUTH_TOKEN_HASH_SECRET")).update(token).digest("hex");
    }
}
