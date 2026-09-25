import { NotImplementedException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";

import { configureHttpApp } from "../../src/bootstrap/configure-http-app.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, IDENTITY_NO_STORE_CACHE_CONTROL, isValidCsrfTokenFormat, REFRESH_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { IdentityController } from "../../src/modules/crm/identity/identity.controller.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { IDENTITY_REFRESH_PATH } from "../../src/modules/crm/identity/identity-route.constants.js";
import { findSetCookieHeader, hasCookieAttribute, readCookieAttribute, readCookieValue } from "../support/set-cookie.js";

const TEST_HTTP_CONFIG = {
    AUDIT_HASH_SECRET: "audit-hash-secret-for-tests-32-chars",
    COOKIE_SECRET: "test-cookie-secret-for-crm-think-v2",
    FRONTEND_ORIGIN: "http://localhost:5173",
    LOCAL_LOGIN_RATE_LIMIT_CACHE: 50,
    LOCAL_LOGIN_RATE_LIMIT_EMAIL_MAX: 1,
    LOCAL_LOGIN_RATE_LIMIT_IP_MAX: 1,
    LOCAL_LOGIN_RATE_LIMIT_WINDOW_MS: 60_000,
    LOCAL_RESET_RATE_LIMIT_CACHE: 50,
    LOCAL_RESET_RATE_LIMIT_EMAIL_MAX: 1,
    LOCAL_RESET_RATE_LIMIT_IP_MAX: 1,
    LOCAL_RESET_RATE_LIMIT_WINDOW_MS: 60_000,
    OPENAPI_ENABLED: false,
} as const;

type IdentityServiceMock = Pick<IdentityService, "getSession" | "getCurrentUser" | "logout" | "requestLocalReset"> & {
    localLogin: MockedFunction<IdentityService["localLogin"]>;
};

const CSRF_TEST_TOKEN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12";
const INVALID_CSRF_TEST_TOKEN = "csrf-test-token";

/**
 * Construye requests mutables con CSRF valido para mantener los tests enfocados
 * en el comportamiento HTTP revisado, no en repetir headers de seguridad.
 */
const createMutableHeaders = (): Record<string, string> => ({
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TEST_TOKEN}`,
    [CSRF_HEADER_NAME_LOWERCASE]: CSRF_TEST_TOKEN,
});

/**
 * Doble minimo de ConfigService para pruebas del bootstrap HTTP.
 *
 * El contrato del controlador depende de cookies, CORS, Helmet, validacion y
 * CSRF. No necesita el AppModule ni DatabaseModule reales; por eso este test
 * se mantiene enfocado y evita conexiones externas.
 *
 * Aunque el archivo vive como spec de identidad, usa `app.inject` contra una
 * aplicacion Nest/Fastify real para cubrir la frontera HTTP del slice de
 * identidad: rutas, headers, cookies, guards y respuestas.
 */
const createTestConfigService = (): Pick<ConfigService, "get"> => ({
    get: (key: string) => TEST_HTTP_CONFIG[key as keyof typeof TEST_HTTP_CONFIG],
});

/**
 * Doble de IdentityService usado por el test de contrato HTTP.
 *
 * Cada metodo se reinicia antes de cada asercion para que el caso controle
 * exactamente el comportamiento que esta revisando.
 */
const createIdentityServiceMock = (): IdentityServiceMock => ({
    getSession: vi.fn(),
    getCurrentUser: vi.fn(),
    localLogin: vi.fn(),
    logout: vi.fn(),
    requestLocalReset: vi.fn(),
});

describe("IdentityController", () => {
    let app: NestFastifyApplication;
    let identity: IdentityServiceMock;

    beforeAll(async () => {
        process.env.NODE_ENV = "test";
        identity = createIdentityServiceMock();

        const moduleRef = await Test.createTestingModule({
            controllers: [IdentityController],
            providers: [
                {
                    provide: ConfigService,
                    useValue: createTestConfigService(),
                },
                {
                    provide: IdentityService,
                    useValue: identity,
                },
                {
                    provide: APP_GUARD,
                    useClass: CsrfGuard,
                },
            ],
        }).compile();

        app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        await configureHttpApp(app);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(identity.getSession).mockResolvedValue({
            authenticated: false,
            session: null,
            user: null,
        });
        vi.mocked(identity.getCurrentUser).mockRejectedValue(new UnauthorizedException("No autenticado."));
        identity.localLogin.mockImplementation(() => {
            throw new NotImplementedException("Login local deshabilitado en pruebas.");
        });
        vi.mocked(identity.logout).mockResolvedValue({ success: true });
        vi.mocked(identity.requestLocalReset).mockResolvedValue({ accepted: true });
    });

    it("retorna sesion anonima sin exponer tokens", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/identity/session",
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
        expect(JSON.parse(response.payload)).toEqual({
            authenticated: false,
            session: null,
            user: null,
        });
        expect(findSetCookieHeader(response.headers["set-cookie"], CSRF_COOKIE_NAME).startsWith(`${CSRF_COOKIE_NAME}=`)).toBe(true);
        expect(response.payload).not.toContain("token");
    });

    it("retorna usuario actual con Cache-Control no-store", async () => {
        vi.mocked(identity.getCurrentUser).mockResolvedValue({
            auth: {
                availableProviders: ["microsoft"],
                localStatus: "inactive",
                primaryProvider: "microsoft",
            },
            orgUnits: [],
            permissions: [],
            roles: [],
            session: {
                expiresAt: "2026-09-25T22:00:00.000Z",
                permissionVersion: 1,
                publicId: "01KCRMSESSION0000000000001",
                status: "active",
            },
            user: {
                displayName: "Usuario CRM",
                email: "usuario@roccacr.com",
                permissionVersion: 1,
                publicId: "01KCRMUSER000000000000001",
                status: "active",
            },
        });

        const response = await app.inject({
            method: "GET",
            url: "/identity/me",
            headers: {
                cookie: `${SESSION_COOKIE_NAME}=01KCRMSESSION0000000000001`,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
    });

    it("emite una cookie CSRF valida que funciona en un POST real", async () => {
        const sessionResponse = await app.inject({
            method: "GET",
            url: "/identity/session",
        });
        const csrfCookie = findSetCookieHeader(sessionResponse.headers["set-cookie"], CSRF_COOKIE_NAME);
        const csrfToken = readCookieValue(csrfCookie);

        expect(isValidCsrfTokenFormat(csrfToken)).toBe(true);
        expect(readCookieAttribute(csrfCookie, "Path")).toBe("/");
        expect(hasCookieAttribute(csrfCookie, "Secure")).toBe(true);
        expect(readCookieAttribute(csrfCookie, "SameSite")).toBe("Strict");
        expect(hasCookieAttribute(csrfCookie, "HttpOnly")).toBe(false);

        const logoutResponse = await app.inject({
            method: "POST",
            url: "/identity/logout",
            headers: {
                cookie: `${CSRF_COOKIE_NAME}=${csrfToken}`,
                [CSRF_HEADER_NAME_LOWERCASE]: csrfToken,
            },
        });

        expect(logoutResponse.statusCode).toBe(200);
    });

    it("no reemplaza la cookie CSRF si el navegador ya trae una con formato valido", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/identity/session",
            headers: {
                cookie: `${CSRF_COOKIE_NAME}=${CSRF_TEST_TOKEN}`,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["set-cookie"]).toBeUndefined();
    });

    it("reemite cookie CSRF si el navegador trae un valor con formato invalido", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/identity/session",
            headers: {
                cookie: `${CSRF_COOKIE_NAME}=csrf-existente`,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(findSetCookieHeader(response.headers["set-cookie"], CSRF_COOKIE_NAME).startsWith(`${CSRF_COOKIE_NAME}=`)).toBe(true);
    });

    it("bloquea requests mutables de identidad sin prueba CSRF", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/identity/logout",
        });

        expect(response.statusCode).toBe(403);
        expect(response.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
    });

    it("bloquea requests mutables aunque cookie y header CSRF invalidos coincidan", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/identity/logout",
            headers: {
                cookie: `${CSRF_COOKIE_NAME}=${INVALID_CSRF_TEST_TOKEN}`,
                [CSRF_HEADER_NAME_LOWERCASE]: INVALID_CSRF_TEST_TOKEN,
            },
        });

        expect(response.statusCode).toBe(403);
    });

    it("permite logout con prueba CSRF double-submit y limpia cookies de sesion", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/identity/logout",
            headers: createMutableHeaders(),
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual({ success: true });
        const sessionCookie = findSetCookieHeader(response.headers["set-cookie"], SESSION_COOKIE_NAME);
        const refreshCookie = findSetCookieHeader(response.headers["set-cookie"], REFRESH_COOKIE_NAME);
        const csrfCookie = findSetCookieHeader(response.headers["set-cookie"], CSRF_COOKIE_NAME);

        expect(sessionCookie).toContain(`${SESSION_COOKIE_NAME}=;`);
        expect(readCookieAttribute(sessionCookie, "Path")).toBe("/");
        expect(refreshCookie).toContain(`${REFRESH_COOKIE_NAME}=;`);
        expect(readCookieAttribute(refreshCookie, "Path")).toBe(IDENTITY_REFRESH_PATH);
        expect(csrfCookie).toContain(`${CSRF_COOKIE_NAME}=;`);
        expect(readCookieAttribute(csrfCookie, "Path")).toBe("/");
    });

    it("rechaza consulta de usuario actual cuando no existe sesion backend", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/identity/me",
        });

        expect(response.statusCode).toBe(401);
        expect(response.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
    });

    it("limita reset local y no ejecuta auditoria de servicio cuando se excede", async () => {
        const request = {
            method: "POST",
            url: "/identity/local/request-reset",
            headers: createMutableHeaders(),
            payload: {
                email: "usuario@roccacr.com",
            },
        } as const;

        const firstResponse = await app.inject(request);
        const secondResponse = await app.inject(request);

        expect(firstResponse.statusCode).toBe(202);
        expect(firstResponse.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
        expect(secondResponse.statusCode).toBe(202);
        expect(secondResponse.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
        expect(JSON.parse(secondResponse.payload)).toEqual({ accepted: true });
        expect(identity.requestLocalReset).toHaveBeenCalledTimes(1);
    });

    it("limita reset local por IP aunque cambie el correo", async () => {
        const firstResponse = await app.inject({
            method: "POST",
            url: "/identity/local/request-reset",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.10",
            payload: {
                email: "usuario-uno@roccacr.com",
            },
        });
        const secondResponse = await app.inject({
            method: "POST",
            url: "/identity/local/request-reset",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.10",
            payload: {
                email: "usuario-dos@roccacr.com",
            },
        });

        expect(firstResponse.statusCode).toBe(202);
        expect(secondResponse.statusCode).toBe(202);
        expect(JSON.parse(secondResponse.payload)).toEqual({ accepted: true });
        expect(identity.requestLocalReset).toHaveBeenCalledTimes(1);
    });

    it("limita reset local por correo aunque cambie la IP", async () => {
        const firstResponse = await app.inject({
            method: "POST",
            url: "/identity/local/request-reset",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.11",
            payload: {
                email: "misma-cuenta@roccacr.com",
            },
        });
        const secondResponse = await app.inject({
            method: "POST",
            url: "/identity/local/request-reset",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.12",
            payload: {
                email: "misma-cuenta@roccacr.com",
            },
        });

        expect(firstResponse.statusCode).toBe(202);
        expect(secondResponse.statusCode).toBe(202);
        expect(JSON.parse(secondResponse.payload)).toEqual({ accepted: true });
        expect(identity.requestLocalReset).toHaveBeenCalledTimes(1);
    });

    it("limita reset local aunque la ruta venga codificada", async () => {
        const firstResponse = await app.inject({
            method: "POST",
            url: "/identity/local/request-reset",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.13",
            payload: {
                email: "ruta-codificada@roccacr.com",
            },
        });
        const secondResponse = await app.inject({
            method: "POST",
            url: "/identity/local/%72equest-reset",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.13",
            payload: {
                email: "ruta-codificada@roccacr.com",
            },
        });

        expect(firstResponse.statusCode).toBe(202);
        expect(secondResponse.statusCode).toBe(202);
        expect(JSON.parse(secondResponse.payload)).toEqual({ accepted: true });
        expect(identity.requestLocalReset).toHaveBeenCalledTimes(1);
    });

    it("limita login local por IP aunque cambie el correo", async () => {
        const firstResponse = await app.inject({
            method: "POST",
            url: "/identity/local/login",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.20",
            payload: {
                email: "login-uno@roccacr.com",
                password: "Password temporal 1",
            },
        });
        const secondResponse = await app.inject({
            method: "POST",
            url: "/identity/local/login",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.20",
            payload: {
                email: "login-dos@roccacr.com",
                password: "Password temporal 2",
            },
        });

        expect(firstResponse.statusCode).toBe(501);
        expect(secondResponse.statusCode).toBe(429);
        expect(secondResponse.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
        expect(identity.localLogin).toHaveBeenCalledTimes(1);
    });

    it("limita login local por correo aunque cambie la IP", async () => {
        const firstResponse = await app.inject({
            method: "POST",
            url: "/identity/local/login",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.21",
            payload: {
                email: "login-misma-cuenta@roccacr.com",
                password: "Password temporal 1",
            },
        });
        const secondResponse = await app.inject({
            method: "POST",
            url: "/identity/local/login",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.22",
            payload: {
                email: "login-misma-cuenta@roccacr.com",
                password: "Password temporal 2",
            },
        });

        expect(firstResponse.statusCode).toBe(501);
        expect(secondResponse.statusCode).toBe(429);
        expect(identity.localLogin).toHaveBeenCalledTimes(1);
    });

    it("marca no-store aunque la ruta de identidad no exista", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/identity/ruta-inexistente",
        });

        expect(response.statusCode).toBe(404);
        expect(response.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
    });

    it("marca no-store cuando el prefijo identity llega codificado", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/%69dentity/session",
        });

        expect(response.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
    });
});
