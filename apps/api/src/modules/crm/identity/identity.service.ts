import { Inject, Injectable, NotImplementedException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AUDIT_HASH_KEY_VERSION, createAuditIdentifierHmac } from "../audit/audit-hash.js";
import { LOCAL_RESET_REQUESTED_EVENT } from "../audit/security-audit.events.js";
import { SecurityAuditService } from "../audit/security-audit.service.js";
import type { RequestLocalResetDto } from "./dto/local-auth.dto.js";
import { IdentityRepository } from "./identity.repository.js";
import type { IdentityProfile, SessionResponse } from "./identity.types.js";

const ANONYMOUS_SESSION_RESPONSE: SessionResponse = {
    authenticated: false,
    session: null,
    user: null,
};

/**
 * Servicio de aplicacion para el corte aprobado de identidad.
 *
 * Este servicio contiene los casos de uso de identidad y mantiene controllers
 * delgados. No conoce detalles SQL ni implementa adapters de proveedor
 * directamente. Asi el runtime P0-S1A queda alineado con futuras
 * implementaciones Microsoft/local sin filtrar infraestructura hacia arriba.
 */
@Injectable()
export class IdentityService {
    /**
     * Inyecta las dependencias del caso de uso.
     *
     * El repository lee/escribe identidad, el audit service registra eventos
     * tecnicos y ConfigService entrega secretos aprobados para HMAC. Mantener
     * esas responsabilidades separadas evita que el servicio conozca detalles
     * SQL o de bootstrap HTTP.
     */
    constructor(
        @Inject(IdentityRepository) private readonly repository: IdentityRepository,
        @Inject(SecurityAuditService) private readonly audit: SecurityAuditService,
        @Inject(ConfigService) private readonly config: ConfigService,
    ) {}

    /**
     * Lee el sobre publico de sesion sin lanzar error para visitantes anonimos.
     *
     * El frontend usa este endpoint para decidir si muestra estado de sesion.
     * Retornar una forma anonima neutral evita exponer detalles internos de
     * busqueda.
     */
    async getSession(sessionPublicId?: string): Promise<SessionResponse> {
        if (!sessionPublicId) {
            return ANONYMOUS_SESSION_RESPONSE;
        }

        const profile = await this.repository.findBySessionPublicId(sessionPublicId);

        if (!profile) {
            return ANONYMOUS_SESSION_RESPONSE;
        }

        return {
            authenticated: true,
            session: profile.session,
            user: profile.user,
        };
    }

    /**
     * Retorna el perfil completo de identidad para requests autenticados.
     *
     * El repository recarga roles activos, areas, overrides directos y permisos
     * efectivos. Eso conserva la regla: permisos removidos deben dejar de
     * funcionar en el siguiente request protegido, sin esperar que expire un
     * token de login largo.
     */
    async getCurrentUser(sessionPublicId?: string): Promise<IdentityProfile> {
        if (!sessionPublicId) {
            throw new UnauthorizedException("No autenticado.");
        }

        const profile = await this.repository.findBySessionPublicId(sessionPublicId);

        if (!profile) {
            throw new UnauthorizedException("No autenticado.");
        }

        return profile;
    }

    /**
     * Revoca la sesion activa cuando existe.
     *
     * Logout es idempotente a proposito. Llamarlo sin sesion conocida igual
     * retorna success para que el frontend limpie estado local de forma segura.
     */
    async logout(sessionPublicId: string | undefined, ipAddress?: string, userAgent?: string): Promise<{ success: true }> {
        if (sessionPublicId) {
            await this.repository.revokeSessionByPublicId(sessionPublicId, ipAddress, userAgent);
        }

        return { success: true };
    }

    /**
     * Deshabilitado hasta implementar rotacion y deteccion de reuso de refresh-token.
     */
    refresh(): never {
        throw new NotImplementedException("Refresh-token requiere rotacion segura antes de habilitarse.");
    }

    /**
     * Deshabilitado hasta tener configuracion Microsoft OIDC con PKCE/state real.
     */
    startMicrosoftLogin(): never {
        throw new NotImplementedException("Microsoft OIDC queda preparado, pero requiere configuracion real antes de iniciar login.");
    }

    /**
     * Deshabilitado hasta que callback Microsoft pueda crear sesiones opacas.
     */
    completeMicrosoftCallback(): never {
        throw new NotImplementedException("Microsoft OIDC queda preparado, pero requiere configuracion real antes de completar callback.");
    }

    /**
     * Deshabilitado hasta que credenciales locales usen activacion por invitacion/reset.
     */
    localLogin(): never {
        throw new NotImplementedException("Login local queda preparado, pero se activa solo por invitacion/reset seguro.");
    }

    /**
     * Respuesta neutral de reset. No debe revelar si el correo existe.
     */
    async requestLocalReset(payload: RequestLocalResetDto, ipAddress?: string, userAgent?: string): Promise<{ accepted: true }> {
        const auditHashSecret = this.config.getOrThrow<string>("AUDIT_HASH_SECRET");

        await this.audit.record({
            eventType: LOCAL_RESET_REQUESTED_EVENT.eventType,
            summary: LOCAL_RESET_REQUESTED_EVENT.summary,
            actorUserId: null,
            targetUserId: null,
            reason: LOCAL_RESET_REQUESTED_EVENT.reason,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            metadata: {
                emailHmac: createAuditIdentifierHmac(payload.email, auditHashSecret),
                hmacKeyVersion: AUDIT_HASH_KEY_VERSION,
            },
        });

        return { accepted: true };
    }

    /**
     * Deshabilitado hasta emitir, hashear, expirar y auditar tokens de reset.
     */
    completeLocalReset(): never {
        throw new NotImplementedException("Reset local requiere flujo seguro con token emitido por el backend.");
    }
}
