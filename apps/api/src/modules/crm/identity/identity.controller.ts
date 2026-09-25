import { randomBytes } from "node:crypto";

import { Body, Controller, Get, Headers, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { CSRF_COOKIE_NAME, CSRF_TOKEN_BYTES, isValidCsrfTokenFormat, REFRESH_COOKIE_NAME, ROOT_COOKIE_PATH, SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { CompleteLocalResetDto, LocalLoginDto, RequestLocalResetDto } from "./dto/local-auth.dto.js";
import { IdentityService } from "./identity.service.js";
import { IDENTITY_CONTROLLER_PATH, IDENTITY_LOCAL_COMPLETE_RESET_ROUTE, IDENTITY_LOCAL_LOGIN_ROUTE, IDENTITY_LOCAL_REQUEST_RESET_ROUTE, IDENTITY_LOGOUT_ROUTE, IDENTITY_ME_ROUTE, IDENTITY_MICROSOFT_CALLBACK_ROUTE, IDENTITY_MICROSOFT_START_ROUTE, IDENTITY_REFRESH_PATH, IDENTITY_REFRESH_ROUTE, IDENTITY_SESSION_ROUTE } from "./identity-route.constants.js";

/**
 * Indica si el navegador ya tiene cookie CSRF con el formato que emite el BFF.
 *
 * La condicion de CSRF firmado y atado a sesion queda pendiente antes de login
 * real. Mientras tanto, este guardrail evita conservar valores invalidos o
 * plantados con forma distinta al token propio del BFF.
 */
const hasValidCsrfCookieFormat = (request: CookieRequest): boolean => {
    const csrfCookie = request.cookies[CSRF_COOKIE_NAME];
    return typeof csrfCookie === "string" && isValidCsrfTokenFormat(csrfCookie);
};

/**
 * Frontera HTTP del runtime de identidad aprobado para P0-S1A.
 *
 * Responsabilidades intencionalmente limitadas:
 * - leer cookies/headers desde requests Fastify;
 * - delegar decisiones de identidad a `IdentityService`;
 * - escribir o limpiar cookies BFF cuando el contrato HTTP lo requiere.
 *
 * No debe calcular permisos, consultar MySQL, llamar Microsoft ni crear reglas
 * de negocio. Esos concerns viven en services, repositories y futuros adapters.
 */
@ApiTags("identity")
@Controller(IDENTITY_CONTROLLER_PATH)
export class IdentityController {
    /**
     * Inyecta el servicio que ejecuta los casos de uso de identidad.
     */
    constructor(@Inject(IdentityService) private readonly identity: IdentityService) {}

    /**
     * Retorna el sobre de sesion anonima/autenticada que usa el frontend.
     *
     * Aqui se emite cookie CSRF porque el frontend necesita un primer endpoint
     * seguro de lectura antes de hacer requests mutables. La cookie no es
     * HttpOnly por diseno: el navegador debe repetir el valor en el header CSRF.
     */
    @Get(IDENTITY_SESSION_ROUTE)
    @ApiOperation({ summary: "Consultar si existe una sesion backend valida." })
    @ApiOkResponse({ description: "Estado de sesion bajo patron BFF." })
    async session(@Req() request: CookieRequest, @Res({ passthrough: true }) reply: FastifyReply) {
        if (!hasValidCsrfCookieFormat(request)) {
            this.setCsrfCookie(reply);
        }

        return this.identity.getSession(request.cookies[SESSION_COOKIE_NAME]);
    }

    /**
     * Retorna el perfil de identidad actual y permisos efectivos.
     *
     * La autorizacion no queda congelada en login. El servicio recarga la sesion
     * activa y el grafo usuario/rol para que permisos removidos dejen de
     * autorizar el siguiente request protegido.
     */
    @Get(IDENTITY_ME_ROUTE)
    @ApiOperation({ summary: "Consultar usuario actual, roles, areas y permisos efectivos." })
    async me(@Req() request: CookieRequest) {
        return this.identity.getCurrentUser(request.cookies[SESSION_COOKIE_NAME]);
    }

    /**
     * Revoca la sesion backend y limpia cookies del navegador.
     *
     * El repository registra auditoria dentro de la transaccion de revocacion.
     * El controller solo pasa contexto propio de HTTP: IP y user-agent.
     */
    @Post(IDENTITY_LOGOUT_ROUTE)
    @HttpCode(200)
    @ApiOperation({ summary: "Cerrar sesion backend y limpiar cookies BFF." })
    async logout(@Req() request: CookieRequest, @Res({ passthrough: true }) reply: FastifyReply, @Headers("user-agent") userAgent?: string) {
        const result = await this.identity.logout(request.cookies[SESSION_COOKIE_NAME], request.ip, userAgent);
        this.clearSessionCookies(reply);
        return result;
    }

    /**
     * Placeholder para rotacion de refresh-token.
     *
     * La ruta existe en el contrato, pero la implementacion segura debe hashear,
     * rotar e invalidar familias de refresh-token antes de habilitarse.
     */
    @Post(IDENTITY_REFRESH_ROUTE)
    @HttpCode(200)
    @ApiOperation({ summary: "Refrescar sesion BFF si existe refresh token valido." })
    refresh() {
        return this.identity.refresh();
    }

    /**
     * Inicia login Microsoft cuando la configuracion OIDC este aprobada.
     *
     * P0-S1A permite el contrato de ruta, no una implementacion Microsoft falsa.
     */
    @Post(IDENTITY_MICROSOFT_START_ROUTE)
    @HttpCode(200)
    @ApiOperation({ summary: "Iniciar login Microsoft con PKCE/state cuando este configurado." })
    startMicrosoftLogin() {
        return this.identity.startMicrosoftLogin();
    }

    /**
     * Completa login Microsoft cuando PKCE/state este implementado.
     */
    @Get(IDENTITY_MICROSOFT_CALLBACK_ROUTE)
    @ApiOperation({ summary: "Recibir callback Microsoft y crear sesion backend." })
    completeMicrosoftCallback() {
        return this.identity.completeMicrosoftCallback();
    }

    /**
     * Alternativa de login local, intencionalmente deshabilitada hasta que
     * invitacion/reset exista con hashing de password y rate limiting.
     */
    @Post(IDENTITY_LOCAL_LOGIN_ROUTE)
    @HttpCode(200)
    @ApiOperation({ summary: "Login local alternativo controlado." })
    @ApiBody({ type: LocalLoginDto })
    localLogin(@Body() _body: LocalLoginDto) {
        return this.identity.localLogin();
    }

    /**
     * Acepta solicitudes de reset sin filtrar si el correo existe.
     */
    @Post(IDENTITY_LOCAL_REQUEST_RESET_ROUTE)
    @HttpCode(202)
    @ApiOperation({ summary: "Solicitar activacion o reset seguro de clave local." })
    @ApiBody({ type: RequestLocalResetDto })
    requestLocalReset(@Body() body: RequestLocalResetDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.identity.requestLocalReset(body, request.ip, userAgent);
    }

    /**
     * Placeholder para completar activacion/reset de password local.
     */
    @Post(IDENTITY_LOCAL_COMPLETE_RESET_ROUTE)
    @HttpCode(200)
    @ApiOperation({ summary: "Completar activacion o reset seguro de clave local." })
    @ApiBody({ type: CompleteLocalResetDto })
    completeLocalReset(@Body() _body: CompleteLocalResetDto) {
        return this.identity.completeLocalReset();
    }

    /**
     * Emite la cookie CSRF double-submit usada por endpoints mutables.
     */
    private setCsrfCookie(reply: FastifyReply): void {
        reply.setCookie(CSRF_COOKIE_NAME, randomBytes(CSRF_TOKEN_BYTES).toString("base64url"), {
            path: ROOT_COOKIE_PATH,
            sameSite: "strict",
            secure: true,
            httpOnly: false,
        });
    }

    /**
     * Limpia cookies de sesion usando los mismos paths con que se crean.
     */
    private clearSessionCookies(reply: FastifyReply): void {
        reply.clearCookie(SESSION_COOKIE_NAME, {
            path: ROOT_COOKIE_PATH,
        });
        reply.clearCookie(REFRESH_COOKIE_NAME, {
            path: IDENTITY_REFRESH_PATH,
        });
        reply.clearCookie(CSRF_COOKIE_NAME, {
            path: ROOT_COOKIE_PATH,
        });
    }
}
