import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { CookieRequest } from "./cookie-request.type.js";
import { isValidSignedCsrfToken } from "./csrf-token.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, SESSION_COOKIE_NAME } from "./http-security.constants.js";
import { assertLocalServiceToken, getServiceTokenEnvironment, hasLocalServiceToken } from "./local-service-token.guard.js";

/**
 * CSRF de las mutaciones del BFF.
 *
 * No autentica ni autoriza. Solo exige que quien cambia estado presente el
 * token que este servidor firmo, repetido en cookie y header, atado a la
 * sesion cuando ya existe. GET permanece legible para consultas como
 * `/identity/session`.
 *
 * Un handler con `LocalServiceToken` sustituye esta prueba por la credencial
 * de maquina. Marcar la ruta `public` no la exime: sin esa metadata exacta,
 * POST, PUT, PATCH y DELETE siguen entrando aqui.
 */

/** Unicos metodos que cambian estado en este contrato. HEAD y OPTIONS no mutan. */
const MUTABLE_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Mismo texto para firma mala, cookie ausente o header distinto. El cuerpo no dice cual de las tres fallo. */
const FORBIDDEN_CSRF_MESSAGE = "No se pudo completar la accion con los permisos actuales.";

const isMutableMethod = (method: string): boolean => MUTABLE_HTTP_METHODS.has(method.toUpperCase());

/**
 * Fastify entrega un header repetido como arreglo. Solo vale el primero.
 * Aceptar "alguno coincide" permitiria colar un segundo valor detras del token real.
 */
const readCsrfHeaderToken = (request: CookieRequest): string | undefined => {
    const header = request.headers[CSRF_HEADER_NAME_LOWERCASE];
    return Array.isArray(header) ? header[0] : header;
};

/**
 * Double-submit mas firma. Cookie y header tienen que ser el mismo string y,
 * ademas, la firma de ese string tiene que cerrar con el secreto y la sesion
 * actual. La igualdad de ambos lados sola no autoriza.
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

/** Guard global. La identidad y los permisos viven en su propio guard. */
@Injectable()
export class CsrfGuard implements CanActivate {
    /** El secreto sale de configuracion validada. El request no puede elegir la llave. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /**
     * La credencial de maquina se vuelve a comprobar aqui, no solo en su guard.
     * Si el registro global de CSRF cambiara de orden, la ruta de integracion
     * seguiria sin entrar con una cookie de navegador.
     */
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<CookieRequest>();

        if (hasLocalServiceToken(context.getHandler())) {
            assertLocalServiceToken(this.config, request, getServiceTokenEnvironment(context.getHandler()));
            return true;
        }

        if (!isMutableMethod(request.method)) {
            return true;
        }

        if (!hasValidCsrfProof(request, this.config.getOrThrow<string>("COOKIE_SECRET"))) {
            throw new ForbiddenException(FORBIDDEN_CSRF_MESSAGE);
        }

        return true;
    }
}
