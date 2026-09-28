import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AUDIT_HASH_KEY_VERSION, createAuditIdentifierHmac } from "../audit/audit-hash.js";
import { LOCAL_IDENTITY_LOCKED_EVENT, LOCAL_LOGIN_FAILED_EVENT, LOCAL_LOGIN_SUCCEEDED_EVENT, LOCAL_RESET_REQUESTED_EVENT, MICROSOFT_INTERACTION_REQUIRED_EVENT, MICROSOFT_LOGIN_SUCCEEDED_EVENT, REFRESH_REUSE_DETECTED_EVENT, REFRESH_ROTATED_EVENT } from "../audit/security-audit.events.js";
import { SecurityAuditService } from "../audit/security-audit.service.js";

/**
 * Registra auditoria de identidad sin filtrar PII ni secretos al log.
 *
 * Mantener el HMAC de identificadores aca evita que cada caso de uso vuelva a
 * leer secretos o reconstruya metadata de auditoria de forma distinta.
 */
@Injectable()
export class IdentityAuditRecorder {
    /**
     * Inyecta auditoria y configuracion validada para HMAC.
     */
    constructor(
        @Inject(SecurityAuditService) private readonly audit: SecurityAuditService,
        @Inject(ConfigService) private readonly config: ConfigService,
    ) {}

    /**
     * Audita fallo de login sin guardar correo crudo.
     */
    async recordLocalLoginFailure(normalizedEmail: string, ipAddress?: string, userAgent?: string): Promise<void> {
        await this.audit.record({
            eventType: LOCAL_LOGIN_FAILED_EVENT.eventType,
            summary: LOCAL_LOGIN_FAILED_EVENT.summary,
            actorUserId: null,
            targetUserId: null,
            reason: LOCAL_LOGIN_FAILED_EVENT.reason,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            metadata: {
                emailHmac: this.hashIdentifier(normalizedEmail),
                hmacKeyVersion: AUDIT_HASH_KEY_VERSION,
            },
        });
    }

    /**
     * Audita bloqueo temporal por fuerza bruta local.
     */
    async recordLocalIdentityLocked(input: { failedLoginCount: number; ipAddress: string | undefined; lockedUntil: Date; normalizedEmail: string; userAgent: string | undefined; userId: number }): Promise<void> {
        await this.audit.record({
            eventType: LOCAL_IDENTITY_LOCKED_EVENT.eventType,
            summary: LOCAL_IDENTITY_LOCKED_EVENT.summary,
            actorUserId: null,
            targetUserId: input.userId,
            reason: LOCAL_IDENTITY_LOCKED_EVENT.reason,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
            metadata: {
                emailHmac: this.hashIdentifier(input.normalizedEmail),
                failedLoginCount: input.failedLoginCount,
                hmacKeyVersion: AUDIT_HASH_KEY_VERSION,
                lockedUntil: input.lockedUntil.toISOString(),
            },
        });
    }

    /**
     * Audita login local correcto.
     */
    async recordLocalLoginSucceeded(userId: number, ipAddress?: string, userAgent?: string): Promise<void> {
        await this.audit.record({
            eventType: LOCAL_LOGIN_SUCCEEDED_EVENT.eventType,
            summary: LOCAL_LOGIN_SUCCEEDED_EVENT.summary,
            actorUserId: userId,
            targetUserId: userId,
            reason: LOCAL_LOGIN_SUCCEEDED_EVENT.reason,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            metadata: {
                provider: "local",
            },
        });
    }

    /**
     * Audita login Microsoft correcto sin guardar claims crudos ni tokens.
     */
    async recordMicrosoftLoginSucceeded(userId: number, ipAddress?: string, userAgent?: string): Promise<void> {
        await this.audit.record({
            eventType: MICROSOFT_LOGIN_SUCCEEDED_EVENT.eventType,
            summary: MICROSOFT_LOGIN_SUCCEEDED_EVENT.summary,
            actorUserId: userId,
            targetUserId: userId,
            reason: MICROSOFT_LOGIN_SUCCEEDED_EVENT.reason,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            metadata: {
                provider: "microsoft",
            },
        });
    }

    /**
     * Audita que Microsoft pidio interaccion y el CRM revoco su sesion.
     */
    async recordMicrosoftInteractionRequired(userId: number, ipAddress?: string, userAgent?: string): Promise<void> {
        await this.audit.record({
            eventType: MICROSOFT_INTERACTION_REQUIRED_EVENT.eventType,
            summary: MICROSOFT_INTERACTION_REQUIRED_EVENT.summary,
            actorUserId: userId,
            targetUserId: userId,
            reason: MICROSOFT_INTERACTION_REQUIRED_EVENT.reason,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            metadata: {
                provider: "microsoft",
            },
        });
    }

    /**
     * Audita solicitud neutral de reset con HMAC del correo.
     */
    async recordLocalResetRequested(normalizedEmail: string, ipAddress?: string, userAgent?: string): Promise<void> {
        await this.audit.record({
            eventType: LOCAL_RESET_REQUESTED_EVENT.eventType,
            summary: LOCAL_RESET_REQUESTED_EVENT.summary,
            actorUserId: null,
            targetUserId: null,
            reason: LOCAL_RESET_REQUESTED_EVENT.reason,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            metadata: {
                emailHmac: this.hashIdentifier(normalizedEmail),
                hmacKeyVersion: AUDIT_HASH_KEY_VERSION,
            },
        });
    }

    /**
     * Audita refresh rotado sin exponer tokens.
     */
    async recordRefreshRotated(userId: number, sessionPublicId: string, ipAddress?: string, userAgent?: string): Promise<void> {
        await this.audit.record({
            eventType: REFRESH_ROTATED_EVENT.eventType,
            summary: REFRESH_ROTATED_EVENT.summary,
            actorUserId: userId,
            targetUserId: userId,
            reason: REFRESH_ROTATED_EVENT.reason,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            metadata: {
                sessionPublicId,
            },
        });
    }

    /**
     * Audita reuso de refresh sin exponer tokens.
     */
    async recordRefreshReuse(userId: number | undefined, sessionPublicId: string | undefined, ipAddress?: string, userAgent?: string): Promise<void> {
        await this.audit.record({
            eventType: REFRESH_REUSE_DETECTED_EVENT.eventType,
            summary: REFRESH_REUSE_DETECTED_EVENT.summary,
            actorUserId: userId ?? null,
            targetUserId: userId ?? null,
            reason: REFRESH_REUSE_DETECTED_EVENT.reason,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            metadata: {
                sessionPublicId: sessionPublicId ?? null,
            },
        });
    }

    /**
     * HMAC irreversible para correlacionar eventos sin guardar correo plano.
     */
    private hashIdentifier(value: string): string {
        return createAuditIdentifierHmac(value, this.config.getOrThrow<string>("AUDIT_HASH_SECRET"));
    }
}
