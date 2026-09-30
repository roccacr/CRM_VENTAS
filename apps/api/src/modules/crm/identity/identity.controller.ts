import { Body, Controller, Get, Headers, HttpCode, Inject, Logger, NotFoundException, Param, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { createSignedCsrfToken, isValidSignedCsrfToken } from "../../../common/security/csrf-token.js";
import { CSRF_COOKIE_NAME, MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME, REFRESH_COOKIE_NAME, ROOT_COOKIE_PATH, SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { CompleteLocalResetDto, LocalLoginDto, RequestLocalResetDto } from "./dto/local-auth.dto.js";
import { MicrosoftCallbackDto } from "./dto/microsoft-auth.dto.js";
import { type AuthenticatedSessionResult, IdentityService, MICROSOFT_ACCOUNT_NOT_ASSIGNED_MESSAGE, MICROSOFT_ACCOUNT_NOT_AUTHORIZED_MESSAGE } from "./identity.service.js";
import { IDENTITY_CONTROLLER_PATH, IDENTITY_LOCAL_COMPLETE_RESET_ROUTE, IDENTITY_LOCAL_LOGIN_ROUTE, IDENTITY_LOCAL_REQUEST_RESET_ROUTE, IDENTITY_LOGOUT_ROUTE, IDENTITY_ME_PHOTO_ROUTE, IDENTITY_ME_ROUTE, IDENTITY_MICROSOFT_CALLBACK_ROUTE, IDENTITY_MICROSOFT_START_ROUTE, IDENTITY_REFRESH_PATH, IDENTITY_REFRESH_ROUTE, IDENTITY_REVOKE_SESSION_ROUTE, IDENTITY_SESSION_ROUTE, IDENTITY_SESSIONS_ROUTE } from "./identity-route.constants.js";

/**
 * Indica si el navegador ya tiene cookie CSRF con el formato que emite el BFF.
 *
 * La firma evita conservar valores invalidos o plantados por cliente. Cuando
 * existe sesion, el token tambien queda ligado al token opaco de sesion.
 */
const hasValidCsrfCookie = (request: CookieRequest, cookieSecret: string): boolean => {
    const csrfCookie = request.cookies[CSRF_COOKIE_NAME];
    return typeof csrfCookie === "string" && isValidSignedCsrfToken(csrfCookie, cookieSecret, request.cookies[SESSION_COOKIE_NAME]);
};

const MICROSOFT_CALLBACK_STATUS_FAILED = "failed";
const MICROSOFT_CALLBACK_STATUS_UNASSIGNED = "unassigned";
const MICROSOFT_CALLBACK_STATUS_UNAUTHORIZED = "unauthorized";

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
    private readonly logger = new Logger(IdentityController.name);

    /**
     * Inyecta el servicio que ejecuta los casos de uso de identidad.
     */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(ConfigService) private readonly config: ConfigService,
    ) {}

    /**
     * Retorna el sobre de sesion anonima/autenticada que usa el frontend.
     *
     * Aqui se emite cookie CSRF porque el frontend necesita un primer endpoint
     * seguro de lectura antes de hacer requests mutables. La cookie es HttpOnly;
     * el valor que el cliente repite por header viaja en el JSON de respuesta.
     */
    @Get(IDENTITY_SESSION_ROUTE)
    @ApiOperation({ summary: "Consultar si existe una sesion backend valida." })
    @ApiOkResponse({ description: "Estado de sesion bajo patron BFF." })
    async session(@Req() request: CookieRequest, @Res({ passthrough: true }) reply: FastifyReply) {
        const sessionToken = request.cookies[SESSION_COOKIE_NAME];
        const existingCsrfToken = request.cookies[CSRF_COOKIE_NAME];
        const csrfToken = hasValidCsrfCookie(request, this.config.getOrThrow<string>("COOKIE_SECRET")) && existingCsrfToken ? existingCsrfToken : this.setCsrfCookie(reply, sessionToken);

        return this.withCsrfToken(await this.identity.getSession(sessionToken), csrfToken);
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
     * Sirve la foto cacheada internamente para no exponer URLs ni tokens Graph.
     */
    @Get(IDENTITY_ME_PHOTO_ROUTE)
    @ApiOperation({ summary: "Servir foto cacheada del usuario autenticado." })
    async profilePhoto(@Query("refresh") refresh: string | undefined, @Req() request: CookieRequest, @Res({ passthrough: true }) reply: FastifyReply) {
        const image = await this.identity.getCurrentUserProfileImage(request.cookies[SESSION_COOKIE_NAME], { refresh: refresh === "1" || refresh === "true" });

        if (!image) {
            throw new NotFoundException("Foto de perfil no disponible.");
        }

        reply.header("cache-control", "no-store");
        reply.header("cross-origin-resource-policy", "same-site");
        reply.type(image.mimeType);
        return image.bytes;
    }

    /**
     * Lista sesiones activas del usuario actual para gestion de dispositivos.
     */
    @Get(IDENTITY_SESSIONS_ROUTE)
    @ApiOperation({ summary: "Listar sesiones activas del usuario actual." })
    async sessions(@Req() request: CookieRequest) {
        return this.identity.listActiveSessions(request.cookies[SESSION_COOKIE_NAME]);
    }

    /**
     * Revoca una sesion activa propia sin permitir cerrar sesiones de otros usuarios.
     */
    @Post(IDENTITY_REVOKE_SESSION_ROUTE)
    @HttpCode(200)
    @ApiOperation({ summary: "Revocar una sesion activa propia." })
    async revokeSession(@Param("sessionPublicId") sessionPublicId: string, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.identity.revokeOwnSession(sessionPublicId, request.cookies[SESSION_COOKIE_NAME], request.ip, userAgent);
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
     * Rota refresh token opaco y renueva la sesion BFF.
     *
     * El service hashea el refresh recibido, consume el token anterior de forma
     * atomica y emite cookies nuevas. Ante reuso, revoca sesiones segun la regla
     * de seguridad vigente.
     */
    @Post(IDENTITY_REFRESH_ROUTE)
    @HttpCode(200)
    @ApiOperation({ summary: "Refrescar sesion BFF si existe refresh token valido." })
    async refresh(@Req() request: CookieRequest, @Res({ passthrough: true }) reply: FastifyReply, @Headers("user-agent") userAgent?: string) {
        const result = await this.identity.refresh(request.cookies[REFRESH_COOKIE_NAME], request.ip, userAgent);
        const csrfToken = this.setAuthenticatedCookies(reply, result);
        return this.withCsrfToken(result.response, csrfToken);
    }

    /**
     * Inicia login Microsoft cuando la configuracion OIDC este aprobada.
     *
     * P0-S1A permite el contrato de ruta, no una implementacion Microsoft falsa.
     */
    @Post(IDENTITY_MICROSOFT_START_ROUTE)
    @HttpCode(200)
    @ApiOperation({ summary: "Iniciar login Microsoft con PKCE/state cuando este configurado." })
    async startMicrosoftLogin(@Res({ passthrough: true }) reply: FastifyReply) {
        const result = await this.identity.startMicrosoftLogin();
        reply.setCookie(MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME, result.challengeCookie, {
            expires: result.challengeExpiresAt,
            httpOnly: true,
            path: `/${IDENTITY_CONTROLLER_PATH}/${IDENTITY_MICROSOFT_CALLBACK_ROUTE}`,
            sameSite: "lax",
            secure: true,
        });

        return { authorizationUrl: result.authorizationUrl };
    }

    /**
     * Completa login Microsoft y vuelve al frontend sin exponer tokens.
     */
    @Get(IDENTITY_MICROSOFT_CALLBACK_ROUTE)
    @ApiOperation({ summary: "Recibir callback Microsoft y crear sesion backend." })
    async completeMicrosoftCallback(@Query() query: MicrosoftCallbackDto, @Req() request: CookieRequest, @Res({ passthrough: true }) reply: FastifyReply, @Headers("user-agent") userAgent?: string) {
        const challengeCookie = request.cookies[MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME];
        this.prepareMicrosoftCallbackRedirect(reply);

        if (query.error || !query.code || !query.state) {
            this.logger.warn(`Microsoft callback rechazado: ${this.getMicrosoftCallbackQueryFailureLogReason(query)}`);
            this.clearMicrosoftChallengeCookie(reply);
            reply.redirect(this.getMicrosoftCallbackFailureUrl(new Error("Microsoft callback incompleto.")), 303);
            return;
        }

        try {
            const result = await this.identity.completeMicrosoftCallback({
                ...(challengeCookie ? { challengeCookie } : {}),
                code: query.code,
                ipAddress: request.ip,
                state: query.state,
                ...(userAgent ? { userAgent } : {}),
            });
            this.setAuthenticatedCookies(reply, result);
            this.clearMicrosoftChallengeCookie(reply);

            reply.redirect(this.getMicrosoftCallbackSuccessUrl(), 303);
        } catch (error) {
            this.logger.warn(`Microsoft callback rechazado: ${this.getMicrosoftCallbackFailureLogReason(error)}`);
            this.clearMicrosoftChallengeCookie(reply);
            reply.redirect(this.getMicrosoftCallbackFailureUrl(error), 303);
        }
    }

    /**
     * Alternativa de login local con Argon2id, lockout y rate limit.
     */
    @Post(IDENTITY_LOCAL_LOGIN_ROUTE)
    @HttpCode(200)
    @ApiOperation({ summary: "Login local alternativo controlado." })
    @ApiBody({ type: LocalLoginDto })
    async localLogin(@Body() body: LocalLoginDto, @Req() request: CookieRequest, @Res({ passthrough: true }) reply: FastifyReply, @Headers("user-agent") userAgent?: string) {
        const result = await this.identity.localLogin(body, request.ip, userAgent);
        const csrfToken = this.setAuthenticatedCookies(reply, result);
        return this.withCsrfToken(result.response, csrfToken);
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
     * Completa activacion/reset local con token opaco y nueva clave Argon2id.
     */
    @Post(IDENTITY_LOCAL_COMPLETE_RESET_ROUTE)
    @HttpCode(200)
    @ApiOperation({ summary: "Completar activacion o reset seguro de clave local." })
    @ApiBody({ type: CompleteLocalResetDto })
    completeLocalReset(@Body() body: CompleteLocalResetDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.identity.completeLocalReset(body, request.ip, userAgent);
    }

    /**
     * Emite la cookie CSRF double-submit usada por endpoints mutables.
     */
    private setCsrfCookie(reply: FastifyReply, sessionToken?: string): string {
        const csrfToken = createSignedCsrfToken(this.config.getOrThrow<string>("COOKIE_SECRET"), sessionToken);

        reply.setCookie(CSRF_COOKIE_NAME, csrfToken, {
            path: ROOT_COOKIE_PATH,
            sameSite: "strict",
            secure: true,
            httpOnly: true,
        });

        return csrfToken;
    }

    private withCsrfToken<TResponse extends object>(response: TResponse, csrfToken: string): TResponse & { readonly csrfToken: string } {
        return {
            ...response,
            csrfToken,
        };
    }

    /**
     * Escribe cookies opacas despues de login o refresh exitoso.
     */
    private setAuthenticatedCookies(reply: FastifyReply, result: AuthenticatedSessionResult): string {
        reply.setCookie(SESSION_COOKIE_NAME, result.sessionToken, {
            expires: result.sessionTokenExpiresAt,
            httpOnly: true,
            path: ROOT_COOKIE_PATH,
            sameSite: "strict",
            secure: true,
        });
        reply.setCookie(REFRESH_COOKIE_NAME, result.refreshToken, {
            expires: result.refreshTokenExpiresAt,
            httpOnly: true,
            path: IDENTITY_REFRESH_PATH,
            sameSite: "strict",
            secure: true,
        });
        return this.setCsrfCookie(reply, result.sessionToken);
    }

    private prepareMicrosoftCallbackRedirect(reply: FastifyReply): void {
        reply.header("Cross-Origin-Opener-Policy", "unsafe-none");
    }

    /**
     * Devuelve el popup al frontend sin filtrar codigo, state ni detalles MSAL.
     */
    private getMicrosoftCallbackSuccessUrl(): string {
        return new URL("/auth/login", this.config.getOrThrow<string>("FRONTEND_ORIGIN")).toString();
    }

    private getMicrosoftCallbackFailureUrl(error: unknown): string {
        const failureUrl = new URL("/auth/login", this.config.getOrThrow<string>("FRONTEND_ORIGIN"));
        failureUrl.searchParams.set("microsoftStatus", this.getMicrosoftCallbackFailureStatus(error));
        return failureUrl.toString();
    }

    private getMicrosoftCallbackFailureStatus(error: unknown): string {
        if (error instanceof UnauthorizedException && error.message === MICROSOFT_ACCOUNT_NOT_ASSIGNED_MESSAGE) {
            return MICROSOFT_CALLBACK_STATUS_UNASSIGNED;
        }

        if (error instanceof UnauthorizedException && error.message === MICROSOFT_ACCOUNT_NOT_AUTHORIZED_MESSAGE) {
            return MICROSOFT_CALLBACK_STATUS_UNAUTHORIZED;
        }

        return MICROSOFT_CALLBACK_STATUS_FAILED;
    }

    private getMicrosoftCallbackFailureLogReason(error: unknown): string {
        if (!(error instanceof Error)) {
            return "error_desconocido";
        }

        return error.message.replaceAll(/[\r\n]/gu, " ").slice(0, 180) || error.name;
    }

    private getMicrosoftCallbackQueryFailureLogReason(query: MicrosoftCallbackDto): string {
        if (query.error) {
            return `entra_error:${query.error}`.replaceAll(/[\r\n]/gu, " ").slice(0, 180);
        }

        return "callback_sin_code_o_state";
    }

    /**
     * Limpia el challenge temporal de Microsoft en exito y error.
     */
    private clearMicrosoftChallengeCookie(reply: FastifyReply): void {
        reply.clearCookie(MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME, {
            path: `/${IDENTITY_CONTROLLER_PATH}/${IDENTITY_MICROSOFT_CALLBACK_ROUTE}`,
            sameSite: "lax",
            secure: true,
            httpOnly: true,
        });
    }

    /**
     * Limpia cookies de sesion usando los mismos paths con que se crean.
     */
    private clearSessionCookies(reply: FastifyReply): void {
        reply.clearCookie(SESSION_COOKIE_NAME, {
            path: ROOT_COOKIE_PATH,
            sameSite: "strict",
            secure: true,
            httpOnly: true,
        });
        reply.clearCookie(REFRESH_COOKIE_NAME, {
            path: IDENTITY_REFRESH_PATH,
            sameSite: "strict",
            secure: true,
            httpOnly: true,
        });
        reply.clearCookie(CSRF_COOKIE_NAME, {
            path: ROOT_COOKIE_PATH,
            sameSite: "strict",
            secure: true,
            httpOnly: true,
        });
    }
}
