import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { CookieRequest } from "./cookie-request.type.js";
import { isValidSignedCsrfToken } from "./csrf-token.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, SESSION_COOKIE_NAME } from "./http-security.constants.js";

// ============================================================================
// Guard CSRF para el patron BFF.
//
// SRP: el guard decide si deja pasar o bloquea. Las responsabilidades pequeñas
// quedan separadas: detectar metodos mutables, leer header/cookie y validar la
// firma CSRF ligada a la sesion.
// ============================================================================

/**
 * Solo metodos mutables requieren CSRF.
 *
 * `GET` debe permanecer legible para consultas como `/identity/session`, pero
 * cualquier mutacion debe probar que el request viene del navegador que recibio
 * la cookie CSRF emitida por el backend.
 */
const MUTABLE_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Mensaje neutro para no filtrar detalles internos de seguridad. */
const FORBIDDEN_CSRF_MESSAGE = "No se pudo completar la accion con los permisos actuales.";

/**
 * Indica si un metodo HTTP puede cambiar estado.
 */
const isMutableMethod = (method: string): boolean => MUTABLE_HTTP_METHODS.has(method.toUpperCase());

/**
 * Lee el token CSRF enviado por header.
 *
 * Fastify puede entregar headers repetidos como arreglo. El contrato BFF solo
 * acepta un valor efectivo; si viene arreglo, tomamos el primero de forma
 * deterministica.
 */
const readCsrfHeaderToken = (request: CookieRequest): string | undefined => {
    const header = request.headers[CSRF_HEADER_NAME_LOWERCASE];
    return Array.isArray(header) ? header[0] : header;
};

/**
 * Valida el par cookie/header del patron double-submit.
 */
const hasValidCsrfProof = (request: CookieRequest, cookieSecret: string): boolean => {
    const cookieToken = request.cookies[CSRF_COOKIE_NAME];
    const headerToken = readCsrfHeaderToken(request);
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];

    if (!cookieToken || !headerToken) {
        return false;
    }

    if (cookieToken !== headerToken) {
        return false;
    }

    return isValidSignedCsrfToken(cookieToken, cookieSecret, sessionToken);
};

/**
 * Guard global que protege mutaciones BFF contra CSRF.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
    /**
     * Inyecta configuracion para validar firmas CSRF con el secreto de cookies.
     */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /**
     * Aplica double-submit cookie para endpoints mutables.
     *
     * El guard no autentica usuarios; solo valida que un request que cambia
     * estado incluya el token emitido por el BFF en cookie y header. La firma
     * lo ata al secreto del servidor y, cuando existe sesion, al token de
     * sesion actual. La autenticacion y permisos viven en identidad.
     */
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<CookieRequest>();

        if (!isMutableMethod(request.method)) {
            return true;
        }

        if (!hasValidCsrfProof(request, this.config.getOrThrow<string>("COOKIE_SECRET"))) {
            throw new ForbiddenException(FORBIDDEN_CSRF_MESSAGE);
        }

        return true;
    }
}
