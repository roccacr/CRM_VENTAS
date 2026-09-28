import rateLimit from "@fastify/rate-limit";
import type { ConfigService } from "@nestjs/config";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { FastifyReply, FastifyRequest } from "fastify";

import { REFRESH_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { createAuditIdentifierHmac } from "../audit/audit-hash.js";
import { IDENTITY_LOCAL_COMPLETE_RESET_PATH, IDENTITY_LOCAL_LOGIN_PATH, IDENTITY_LOCAL_REQUEST_RESET_PATH, IDENTITY_REFRESH_PATH } from "./identity-route.constants.js";

// ============================================================================
// Rate limit para endpoints publicos sensibles de identidad.
//
// Regla de seguridad S1A:
// - el limite por IP frena inundacion desde un mismo origen;
// - el limite por HMAC de correo frena ataques distribuidos contra una cuenta;
// - se bloquea si cualquiera de los dos contadores se excede.
//
// No se guarda correo crudo en memoria. La llave de cuenta usa el mismo HMAC
// dedicado de auditoria aprobado para identificadores sensibles.
// ============================================================================

interface IdentityRateLimitConfig {
    completeResetCache: number;
    completeResetIpMax: number;
    completeResetTokenMax: number;
    completeResetWindowMs: number;
    loginCache: number;
    loginEmailMax: number;
    loginIpMax: number;
    loginWindowMs: number;
    refreshCache: number;
    refreshIpMax: number;
    refreshTokenMax: number;
    refreshWindowMs: number;
    resetCache: number;
    resetEmailMax: number;
    resetIpMax: number;
    resetWindowMs: number;
}

type IdentityRateLimitResult = { isAllowed: true } | { isAllowed: false; isExceeded: boolean };

interface IdentityLimiterPair {
    byActor: IdentityRateLimiter;
    byIp: IdentityRateLimiter;
}

interface IdentityLimiterPairOptions {
    auditHashSecret: string;
    actorKeyFactory: (request: FastifyRequest, auditHashSecret: string, prefix: string) => string;
    actorMax: number;
    ipMax: number;
    prefix: string;
    timeWindow: number;
}

type IdentityRateLimiter = (request: FastifyRequest) => Promise<IdentityRateLimitResult>;

interface IdentityRateLimitedRoute {
    limiters: IdentityLimiterPair;
    path: string;
    sendLimitResponse: (reply: FastifyReply) => FastifyReply;
}

const RATE_LIMIT_EMAIL_FALLBACK = "missing-email";
const RATE_LIMIT_REFRESH_FALLBACK = "missing-refresh-token";
const RATE_LIMIT_RESET_TOKEN_FALLBACK = "missing-reset-token";

/**
 * Lee un entero positivo desde `ConfigService`.
 *
 * Aunque Zod valida la config al arranque, este helper conserva fail-fast cerca
 * del concern que consume el valor. Si un test inyecta un ConfigService parcial
 * o mal armado, el rate limit no debe quedar abierto por accidente.
 */
const readPositiveNumberConfig = (config: ConfigService, key: string): number => {
    const value = config.get<number>(key);

    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
        throw new Error(`${key} debe ser un entero positivo.`);
    }

    return value;
};

/**
 * Lee limites aprobados para endpoints publicos de identidad.
 */
const readIdentityRateLimitConfig = (config: ConfigService): IdentityRateLimitConfig => ({
    completeResetCache: readPositiveNumberConfig(config, "LOCAL_COMPLETE_RESET_RATE_LIMIT_CACHE"),
    completeResetIpMax: readPositiveNumberConfig(config, "LOCAL_COMPLETE_RESET_RATE_LIMIT_IP_MAX"),
    completeResetTokenMax: readPositiveNumberConfig(config, "LOCAL_COMPLETE_RESET_RATE_LIMIT_TOKEN_MAX"),
    completeResetWindowMs: readPositiveNumberConfig(config, "LOCAL_COMPLETE_RESET_RATE_LIMIT_WINDOW_MS"),
    loginCache: readPositiveNumberConfig(config, "LOCAL_LOGIN_RATE_LIMIT_CACHE"),
    loginEmailMax: readPositiveNumberConfig(config, "LOCAL_LOGIN_RATE_LIMIT_EMAIL_MAX"),
    loginIpMax: readPositiveNumberConfig(config, "LOCAL_LOGIN_RATE_LIMIT_IP_MAX"),
    loginWindowMs: readPositiveNumberConfig(config, "LOCAL_LOGIN_RATE_LIMIT_WINDOW_MS"),
    refreshCache: readPositiveNumberConfig(config, "REFRESH_RATE_LIMIT_CACHE"),
    refreshIpMax: readPositiveNumberConfig(config, "REFRESH_RATE_LIMIT_IP_MAX"),
    refreshTokenMax: readPositiveNumberConfig(config, "REFRESH_RATE_LIMIT_TOKEN_MAX"),
    refreshWindowMs: readPositiveNumberConfig(config, "REFRESH_RATE_LIMIT_WINDOW_MS"),
    resetCache: readPositiveNumberConfig(config, "LOCAL_RESET_RATE_LIMIT_CACHE"),
    resetEmailMax: readPositiveNumberConfig(config, "LOCAL_RESET_RATE_LIMIT_EMAIL_MAX"),
    resetIpMax: readPositiveNumberConfig(config, "LOCAL_RESET_RATE_LIMIT_IP_MAX"),
    resetWindowMs: readPositiveNumberConfig(config, "LOCAL_RESET_RATE_LIMIT_WINDOW_MS"),
});

/**
 * Usa la ruta resuelta por Fastify, no la URL cruda enviada por el cliente.
 *
 * Esto evita que una URL equivalente con caracteres `%XX` llegue al controller
 * pero no coincida con el hook de rate limit. Si Fastify no resolvio ruta, se
 * conserva un fallback solo para no fallar antes de que el router responda.
 */
const getResolvedRequestPath = (request: FastifyRequest): string => request.routeOptions.url ?? request.url.split("?")[0] ?? request.url;

/**
 * Lee el correo del body ya parseado por Fastify sin confiar en que sea valido.
 */
const readEmailFromBody = (body: unknown): string => {
    if (!body || typeof body !== "object" || !("email" in body)) {
        return RATE_LIMIT_EMAIL_FALLBACK;
    }

    const email = (body as { email?: unknown }).email;
    return typeof email === "string" && email.trim() ? email : RATE_LIMIT_EMAIL_FALLBACK;
};

/**
 * Construye una llave de rate limit por IP efectiva.
 */
const createIpRateLimitKey = (request: FastifyRequest, prefix: string): string => `${prefix}:ip:${request.ip}`;

/**
 * Construye una llave de rate limit por correo sin guardar PII cruda.
 */
const createEmailRateLimitKey = (request: FastifyRequest, auditHashSecret: string, prefix: string): string => {
    const emailHmac = createAuditIdentifierHmac(readEmailFromBody(request.body), auditHashSecret);
    return `${prefix}:email:${emailHmac}`;
};

/**
 * Construye una llave por refresh token sin guardar el token crudo.
 */
const createRefreshTokenRateLimitKey = (request: FastifyRequest, auditHashSecret: string, prefix: string): string => {
    const cookies = (request as { cookies?: Record<string, string | undefined> }).cookies;
    const refreshToken = cookies?.[REFRESH_COOKIE_NAME] ?? RATE_LIMIT_REFRESH_FALLBACK;
    const refreshHmac = createAuditIdentifierHmac(refreshToken, auditHashSecret);
    return `${prefix}:refresh:${refreshHmac}`;
};

/**
 * Construye una llave por token de reset sin guardar el token crudo.
 */
const createResetTokenRateLimitKey = (request: FastifyRequest, auditHashSecret: string, prefix: string): string => {
    const body = request.body;
    const resetToken = body && typeof body === "object" && "resetToken" in body && typeof (body as { resetToken?: unknown }).resetToken === "string" ? (body as { resetToken: string }).resetToken : RATE_LIMIT_RESET_TOKEN_FALLBACK;
    const resetTokenHmac = createAuditIdentifierHmac(resetToken, auditHashSecret);
    return `${prefix}:reset-token:${resetTokenHmac}`;
};

/**
 * `@fastify/rate-limit` marca `isAllowed` para allowlists internas. El bloqueo
 * real de seguridad ocurre solo cuando la llave excedio la cuota.
 */
const hasExceededLimit = (result: IdentityRateLimitResult): boolean => !result.isAllowed && result.isExceeded;

/**
 * Ejecuta los dos contadores independientes del endpoint.
 */
const hasExceededLimiterPair = async (request: FastifyRequest, limiters: IdentityLimiterPair): Promise<boolean> => {
    const ipLimit = await limiters.byIp(request);
    const actorLimit = await limiters.byActor(request);

    return hasExceededLimit(ipLimit) || hasExceededLimit(actorLimit);
};

/**
 * Responde de forma neutral cuando reset local excede limite.
 */
const sendNeutralResetLimitResponse = (reply: FastifyReply): FastifyReply => reply.code(202).send({ accepted: true });

/**
 * Responde 429 para login local sin revelar si la cuenta existe.
 */
const sendIdentityAttemptLimitResponse = (reply: FastifyReply): FastifyReply =>
    reply.code(429).send({
        error: "Too Many Requests",
        message: "Demasiados intentos. Intente mas tarde.",
        statusCode: 429,
    });

/**
 * Responde 429 para refresh sin filtrar si el token existia o era valido.
 */
const sendRefreshLimitResponse = (reply: FastifyReply): FastifyReply =>
    reply.code(429).send({
        error: "Too Many Requests",
        message: "Demasiadas renovaciones de sesion. Intente mas tarde.",
        statusCode: 429,
    });

/**
 * Crea la pareja de limitadores IP/correo para un endpoint de identidad.
 */
const createIdentityLimiterPair = (app: NestFastifyApplication, options: IdentityLimiterPairOptions): IdentityLimiterPair => {
    const { actorKeyFactory, actorMax, auditHashSecret, ipMax, prefix, timeWindow } = options;
    const fastify = app.getHttpAdapter().getInstance();

    return {
        byActor: fastify.createRateLimit({
            keyGenerator: (request) => actorKeyFactory(request, auditHashSecret, prefix),
            max: actorMax,
            timeWindow,
        }),
        byIp: fastify.createRateLimit({
            keyGenerator: (request) => createIpRateLimitKey(request, prefix),
            max: ipMax,
            timeWindow,
        }),
    };
};

/**
 * Aplica rate limit solo a endpoints publicos sensibles de identidad.
 *
 * La tienda local del plugin es acotada por cache. En P0 es por proceso y se
 * reinicia al arrancar; esa deuda queda documentada como condicion previa al
 * login real.
 */
export const registerIdentityRateLimit = async (app: NestFastifyApplication, config: ConfigService, auditHashSecret: string): Promise<void> => {
    const rateLimitConfig = readIdentityRateLimitConfig(config);
    const fastify = app.getHttpAdapter().getInstance();

    await app.register(rateLimit, {
        cache: Math.max(rateLimitConfig.loginCache, rateLimitConfig.resetCache, rateLimitConfig.refreshCache, rateLimitConfig.completeResetCache),
        global: false,
        hook: "preHandler",
    });

    const resetLimiters = createIdentityLimiterPair(app, {
        auditHashSecret,
        actorKeyFactory: createEmailRateLimitKey,
        actorMax: rateLimitConfig.resetEmailMax,
        ipMax: rateLimitConfig.resetIpMax,
        prefix: "identity-reset",
        timeWindow: rateLimitConfig.resetWindowMs,
    });
    const loginLimiters = createIdentityLimiterPair(app, {
        auditHashSecret,
        actorKeyFactory: createEmailRateLimitKey,
        actorMax: rateLimitConfig.loginEmailMax,
        ipMax: rateLimitConfig.loginIpMax,
        prefix: "identity-login",
        timeWindow: rateLimitConfig.loginWindowMs,
    });
    const refreshLimiters = createIdentityLimiterPair(app, {
        auditHashSecret,
        actorKeyFactory: createRefreshTokenRateLimitKey,
        actorMax: rateLimitConfig.refreshTokenMax,
        ipMax: rateLimitConfig.refreshIpMax,
        prefix: "identity-refresh",
        timeWindow: rateLimitConfig.refreshWindowMs,
    });
    const completeResetLimiters = createIdentityLimiterPair(app, {
        auditHashSecret,
        actorKeyFactory: createResetTokenRateLimitKey,
        actorMax: rateLimitConfig.completeResetTokenMax,
        ipMax: rateLimitConfig.completeResetIpMax,
        prefix: "identity-complete-reset",
        timeWindow: rateLimitConfig.completeResetWindowMs,
    });
    const rateLimitedRoutes: IdentityRateLimitedRoute[] = [
        {
            path: IDENTITY_LOCAL_REQUEST_RESET_PATH,
            limiters: resetLimiters,
            sendLimitResponse: sendNeutralResetLimitResponse,
        },
        {
            path: IDENTITY_LOCAL_LOGIN_PATH,
            limiters: loginLimiters,
            sendLimitResponse: sendIdentityAttemptLimitResponse,
        },
        {
            path: IDENTITY_REFRESH_PATH,
            limiters: refreshLimiters,
            sendLimitResponse: sendRefreshLimitResponse,
        },
        {
            path: IDENTITY_LOCAL_COMPLETE_RESET_PATH,
            limiters: completeResetLimiters,
            sendLimitResponse: sendIdentityAttemptLimitResponse,
        },
    ];

    fastify.addHook("preHandler", async (request, reply) => {
        if (request.method !== "POST") {
            return;
        }

        const path = getResolvedRequestPath(request);

        for (const route of rateLimitedRoutes) {
            if (path === route.path && (await hasExceededLimiterPair(request, route.limiters))) {
                return route.sendLimitResponse(reply);
            }
        }
    });
};
