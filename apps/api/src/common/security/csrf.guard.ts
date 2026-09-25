import { timingSafeEqual } from "node:crypto";

import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

import type { CookieRequest } from "./cookie-request.type.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, isValidCsrfTokenFormat } from "./http-security.constants.js";

// ============================================================================
// Guard CSRF para el patron BFF.
//
// SRP: el guard decide si deja pasar o bloquea. Las responsabilidades pequeñas
// quedan separadas: detectar metodos mutables, leer header/cookie y comparar
// tokens sin filtrar timing.
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
 * Compara tokens CSRF sin filtrar diferencias de timing.
 *
 * Primero se valida longitud porque `timingSafeEqual` lanza error si los
 * buffers tienen tamano distinto. Esa validacion no cambia el resultado de
 * seguridad: tokens de diferente longitud nunca son validos.
 */
const tokensMatch = (cookieToken: string, headerToken: string): boolean => {
    const cookieBuffer = Buffer.from(cookieToken);
    const headerBuffer = Buffer.from(headerToken);

    if (cookieBuffer.length !== headerBuffer.length) {
        return false;
    }

    return timingSafeEqual(cookieBuffer, headerBuffer);
};

/**
 * Valida el par cookie/header del patron double-submit.
 */
const hasValidCsrfProof = (request: CookieRequest): boolean => {
    const cookieToken = request.cookies[CSRF_COOKIE_NAME];
    const headerToken = readCsrfHeaderToken(request);

    if (!cookieToken || !headerToken) {
        return false;
    }

    if (!isValidCsrfTokenFormat(cookieToken) || !isValidCsrfTokenFormat(headerToken)) {
        return false;
    }

    return tokensMatch(cookieToken, headerToken);
};

/**
 * Guard global que protege mutaciones BFF contra CSRF.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
    /**
     * Aplica double-submit cookie para endpoints mutables.
     *
     * El guard no autentica usuarios; solo valida que un request que cambia
     * estado incluya el mismo token en cookie y header. La autenticacion y los
     * permisos efectivos viven en guards/servicios de identidad.
     */
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<CookieRequest>();

        if (!isMutableMethod(request.method)) {
            return true;
        }

        if (!hasValidCsrfProof(request)) {
            throw new ForbiddenException(FORBIDDEN_CSRF_MESSAGE);
        }

        return true;
    }
}
