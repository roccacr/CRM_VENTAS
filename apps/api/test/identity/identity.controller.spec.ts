import { NotImplementedException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";

import { configureHttpApp } from "../../src/bootstrap/configure-http-app.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, IDENTITY_NO_STORE_CACHE_CONTROL, isValidCsrfTokenFormat, MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME, REFRESH_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { IdentityController } from "../../src/modules/crm/identity/identity.controller.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { IDENTITY_REFRESH_PATH } from "../../src/modules/crm/identity/identity-route.constants.js";
import { findSetCookieHeader, hasCookieAttribute, readCookieAttribute, readCookieValue } from "../support/set-cookie.js";

const TEST_HTTP_CONFIG = {
    AUDIT_HASH_SECRET: "audit-hash-secret-for-tests-32-chars",
    AUTH_TOKEN_HASH_SECRET: "auth-token-hash-secret-for-tests-32",
    COOKIE_SECRET: "test-cookie-secret-for-crm-think-v2",
    FRONTEND_ALLOWED_ORIGINS: "http://192.168.100.8:5173",
    FRONTEND_ORIGIN: "http://localhost:5173",
    LOCAL_LOGIN_RATE_LIMIT_CACHE: 50,
    LOCAL_LOGIN_RATE_LIMIT_EMAIL_MAX: 1,
    LOCAL_LOGIN_RATE_LIMIT_IP_MAX: 1,
    LOCAL_LOGIN_RATE_LIMIT_WINDOW_MS: 60_000,
    MICROSOFT_START_RATE_LIMIT_CACHE: 50,
    MICROSOFT_START_RATE_LIMIT_IP_MAX: 1,
    MICROSOFT_START_RATE_LIMIT_WINDOW_MS: 60_000,
    LOCAL_RESET_RATE_LIMIT_CACHE: 50,
    LOCAL_RESET_RATE_LIMIT_EMAIL_MAX: 1,
    LOCAL_RESET_RATE_LIMIT_IP_MAX: 1,
    LOCAL_RESET_RATE_LIMIT_WINDOW_MS: 60_000,
    LOCAL_COMPLETE_RESET_RATE_LIMIT_CACHE: 50,
    LOCAL_COMPLETE_RESET_RATE_LIMIT_IP_MAX: 1,
    LOCAL_COMPLETE_RESET_RATE_LIMIT_TOKEN_MAX: 1,
    LOCAL_COMPLETE_RESET_RATE_LIMIT_WINDOW_MS: 60_000,
    REFRESH_RATE_LIMIT_CACHE: 50,
    REFRESH_RATE_LIMIT_IP_MAX: 1,
    REFRESH_RATE_LIMIT_TOKEN_MAX: 1,
    REFRESH_RATE_LIMIT_WINDOW_MS: 60_000,
    OPENAPI_ENABLED: false,
} as const;

type IdentityServiceMock = Pick<IdentityService, "getSession" | "getCurrentUser" | "logout" | "requestLocalReset"> & {
    completeLocalReset: MockedFunction<IdentityService["completeLocalReset"]>;
    completeMicrosoftCallback: MockedFunction<IdentityService["completeMicrosoftCallback"]>;
    createSystemUser: MockedFunction<IdentityService["createSystemUser"]>;
    getCurrentUserProfileImage: MockedFunction<IdentityService["getCurrentUserProfileImage"]>;
    getSystemUserDetail: MockedFunction<IdentityService["getSystemUserDetail"]>;
    listActiveSessions: MockedFunction<IdentityService["listActiveSessions"]>;
    listSystemUsers: MockedFunction<IdentityService["listSystemUsers"]>;
    refresh: MockedFunction<IdentityService["refresh"]>;
    localLogin: MockedFunction<IdentityService["localLogin"]>;
    revokeOwnSession: MockedFunction<IdentityService["revokeOwnSession"]>;
    startMicrosoftLogin: MockedFunction<IdentityService["startMicrosoftLogin"]>;
};

const CSRF_TEST_TOKEN = createSignedCsrfToken(TEST_HTTP_CONFIG.COOKIE_SECRET);
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
const createTestConfigService = (): Pick<ConfigService, "get" | "getOrThrow"> => ({
    get: (key: string) => TEST_HTTP_CONFIG[key as keyof typeof TEST_HTTP_CONFIG],
    getOrThrow: (key: string) => TEST_HTTP_CONFIG[key as keyof typeof TEST_HTTP_CONFIG],
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
    createSystemUser: vi.fn(),
    getCurrentUserProfileImage: vi.fn(),
    getSystemUserDetail: vi.fn(),
    refresh: vi.fn(),
    localLogin: vi.fn(),
    completeLocalReset: vi.fn(),
    completeMicrosoftCallback: vi.fn(),
    listActiveSessions: vi.fn(),
    listSystemUsers: vi.fn(),
    logout: vi.fn(),
    requestLocalReset: vi.fn(),
    revokeOwnSession: vi.fn(),
    startMicrosoftLogin: vi.fn(),
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
        identity.getCurrentUserProfileImage.mockRejectedValue(new UnauthorizedException("No autenticado."));
        identity.localLogin.mockImplementation(() => {
            throw new NotImplementedException("Login local deshabilitado en pruebas.");
        });
        identity.refresh.mockImplementation(() => {
            throw new NotImplementedException("Refresh deshabilitado en pruebas.");
        });
        identity.completeLocalReset.mockImplementation(() => {
            throw new NotImplementedException("Reset local deshabilitado en pruebas.");
        });
        identity.startMicrosoftLogin.mockResolvedValue({
            authorizationUrl: "https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize",
            challengeCookie: "challenge.cookie",
            challengeExpiresAt: new Date(Date.now() + 60_000),
        });
        identity.completeMicrosoftCallback.mockImplementation(() => {
            throw new NotImplementedException("Microsoft deshabilitado en pruebas.");
        });
        identity.listActiveSessions.mockRejectedValue(new UnauthorizedException("No autenticado."));
        identity.listSystemUsers.mockResolvedValue({
            items: [],
            page: {
                limit: 25,
                nextCursor: null,
                total: 0,
            },
            summary: {
                active: 0,
                all: 0,
                blocked: 0,
                inactive: 0,
                pending: 0,
            },
        });
        identity.createSystemUser.mockResolvedValue({
            email: "nuevo@roccacr.com",
            invitedBy: "Usuario CRM",
            isCurrentUser: false,
            lastActivityAt: null,
            mfaStatus: "not_configured",
            name: "Nuevo Usuario",
            orgUnit: {
                code: "ventas",
                name: "Ventas",
                publicId: "ORG-VENTAS",
            },
            profileImageUrl: null,
            provider: "local",
            publicId: "01KCRMNEWUSER000000000001",
            roleChangedAt: "2026-09-30T16:00:00.000Z",
            roles: [{ code: "ventas", name: "Ventas" }],
            status: "active",
        });
        identity.getSystemUserDetail.mockRejectedValue(new UnauthorizedException("No autenticado."));
        identity.revokeOwnSession.mockResolvedValue({ success: true });
        vi.mocked(identity.logout).mockResolvedValue({ success: true });
        vi.mocked(identity.requestLocalReset).mockResolvedValue({ accepted: true });
    });

    it("permite CORS con credenciales desde un origin adicional exacto", async () => {
        const response = await app.inject({
            headers: {
                "access-control-request-method": "GET",
                origin: "http://192.168.100.8:5173",
            },
            method: "OPTIONS",
            url: "/identity/session",
        });

        expect(response.headers["access-control-allow-origin"]).toBe("http://192.168.100.8:5173");
        expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("retorna sesion anonima sin exponer tokens", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/identity/session",
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
        const csrfToken = /"csrfToken":"([^"]+)"/u.exec(response.payload)?.[1] ?? "";

        expect(response.payload).toContain('"authenticated":false');
        expect(response.payload).toContain('"session":null');
        expect(response.payload).toContain('"user":null');
        expect(isValidCsrfTokenFormat(csrfToken)).toBe(true);
        expect(findSetCookieHeader(response.headers["set-cookie"], CSRF_COOKIE_NAME).startsWith(`${CSRF_COOKIE_NAME}=`)).toBe(true);
        expect(response.payload).not.toContain("session-token");
        expect(response.payload).not.toContain("refresh-token");
    });

    it("retorna usuario actual con Cache-Control no-store", async () => {
        vi.mocked(identity.getCurrentUser).mockResolvedValue({
            auth: {
                availableProviders: ["microsoft"],
                currentProvider: "microsoft",
                localStatus: "inactive",
                microsoft: {
                    homeAccountId: "home.tenant",
                    interactionRequired: false,
                    lastSyncedAt: "2026-09-25T20:00:00.000Z",
                    tenantId: "tenant",
                },
                primaryProvider: "microsoft",
            },
            orgUnits: [],
            permissions: [],
            roles: [],
            session: {
                expiresAt: "2026-09-25T22:00:00.000Z",
                expiresInSeconds: 28800,
                permissionVersion: 1,
                publicId: "01KCRMSESSION0000000000001",
                status: "active",
            },
            user: {
                displayName: "Usuario CRM",
                email: "usuario@roccacr.com",
                profileImageUrl: "/identity/me/photo",
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

    it("lista usuarios del sistema con filtros paginados sin exponer tokens", async () => {
        identity.listSystemUsers.mockResolvedValue({
            items: [
                {
                    email: "usuario@roccacr.com",
                    invitedBy: null,
                    isCurrentUser: true,
                    lastActivityAt: "2026-09-30T15:18:00.000Z",
                    mfaStatus: "enabled",
                    name: "Usuario CRM",
                    orgUnit: {
                        code: "sistemas",
                        name: "Sistemas",
                        publicId: "01KCRM00000000000000000006",
                    },
                    profileImageUrl: null,
                    provider: "mixed",
                    publicId: "01KCRMUSER000000000000001",
                    roleChangedAt: "2026-09-30T14:54:00.000Z",
                    roles: [{ code: "owner", name: "Owner" }],
                    status: "active",
                },
            ],
            page: {
                limit: 25,
                nextCursor: null,
                total: 1,
            },
            summary: {
                active: 1,
                all: 1,
                blocked: 0,
                inactive: 0,
                pending: 0,
            },
        });

        const response = await app.inject({
            method: "GET",
            url: "/identity/users?status=active&limit=25&sort=name&direction=asc",
            headers: {
                cookie: `${SESSION_COOKIE_NAME}=session-token`,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
        expect(response.payload).toContain('"items"');
        expect(response.payload).not.toContain("session-token");
        expect(identity.listSystemUsers).toHaveBeenCalledWith(
            "session-token",
            expect.objectContaining({
                direction: "asc",
                limit: 25,
                sort: "name",
                status: "active",
            }),
        );
    });

    it("crea usuarios del sistema con CSRF y delega contexto HTTP", async () => {
        const sessionCsrfToken = createSignedCsrfToken(TEST_HTTP_CONFIG.COOKIE_SECRET, "session-token");
        const response = await app.inject({
            method: "POST",
            url: "/identity/users",
            headers: {
                [CSRF_HEADER_NAME_LOWERCASE]: sessionCsrfToken,
                cookie: `${CSRF_COOKIE_NAME}=${sessionCsrfToken}; ${SESSION_COOKIE_NAME}=session-token`,
                "user-agent": "vitest-agent",
            },
            remoteAddress: "10.0.0.44",
            payload: {
                accessMethods: ["microsoft", "local"],
                displayName: "Nuevo Usuario",
                email: "nuevo@roccacr.com",
                externalReferences: [{ externalUserId: "653999", systemCode: "netsuite" }],
                initialStatus: "active",
                orgUnitCode: "ventas",
                reason: "Alta solicitada por TI",
                roleCode: "ventas",
                roleCodes: ["ventas", "mercadeo"],
            },
        });

        expect(response.statusCode).toBe(201);
        expect(response.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
        expect(response.payload).toContain("01KCRMNEWUSER000000000001");
        expect(response.payload).not.toContain("session-token");
        expect(identity.createSystemUser).toHaveBeenCalledWith(
            "session-token",
            expect.objectContaining({
                accessMethods: ["microsoft", "local"],
                email: "nuevo@roccacr.com",
                roleCode: "ventas",
                roleCodes: ["ventas", "mercadeo"],
            }),
            "10.0.0.44",
            "vitest-agent",
        );
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
        expect(hasCookieAttribute(csrfCookie, "HttpOnly")).toBe(true);
        expect((JSON.parse(sessionResponse.payload) as { csrfToken: string }).csrfToken).toBe(csrfToken);

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
        expect((JSON.parse(response.payload) as { csrfToken: string }).csrfToken).toBe(CSRF_TEST_TOKEN);
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
        const csrfCookie = findSetCookieHeader(response.headers["set-cookie"], CSRF_COOKIE_NAME);
        const csrfToken = readCookieValue(csrfCookie);

        expect(csrfCookie.startsWith(`${CSRF_COOKIE_NAME}=`)).toBe(true);
        expect((JSON.parse(response.payload) as { csrfToken: string }).csrfToken).toBe(csrfToken);
    });

    it("devuelve CSRF nuevo en el cuerpo despues de login local exitoso", async () => {
        identity.localLogin.mockResolvedValue({
            refreshToken: "refresh-token-local",
            refreshTokenExpiresAt: new Date(Date.now() + 60_000),
            response: {
                authenticated: true,
                session: {
                    expiresAt: "2026-09-25T22:00:00.000Z",
                    expiresInSeconds: 28800,
                    permissionVersion: 1,
                    publicId: "session-public-id",
                    status: "active",
                },
                user: {
                    displayName: "Usuario CRM",
                    email: "usuario@roccacr.com",
                    permissionVersion: 1,
                    profileImageUrl: null,
                    publicId: "user-public-id",
                    status: "active",
                },
            },
            sessionToken: "session-token-local",
            sessionTokenExpiresAt: new Date(Date.now() + 60_000),
        });

        const response = await app.inject({
            method: "POST",
            url: "/identity/local/login",
            headers: createMutableHeaders(),
            payload: {
                email: "usuario@roccacr.com",
                password: "Password temporal 1",
            },
        });

        const csrfCookie = findSetCookieHeader(response.headers["set-cookie"], CSRF_COOKIE_NAME);
        const csrfToken = readCookieValue(csrfCookie);

        expect(response.statusCode).toBe(200);
        expect(hasCookieAttribute(csrfCookie, "HttpOnly")).toBe(true);
        expect((JSON.parse(response.payload) as { csrfToken: string }).csrfToken).toBe(csrfToken);
    });

    it("devuelve CSRF nuevo en el cuerpo despues de refresh exitoso", async () => {
        identity.refresh.mockResolvedValue({
            refreshToken: "refresh-token-renovado",
            refreshTokenExpiresAt: new Date(Date.now() + 60_000),
            response: {
                authenticated: true,
                session: {
                    expiresAt: "2026-09-25T22:00:00.000Z",
                    expiresInSeconds: 28800,
                    permissionVersion: 1,
                    publicId: "session-public-id",
                    status: "active",
                },
                user: {
                    displayName: "Usuario CRM",
                    email: "usuario@roccacr.com",
                    permissionVersion: 1,
                    profileImageUrl: null,
                    publicId: "user-public-id",
                    status: "active",
                },
            },
            sessionToken: "session-token-renovado",
            sessionTokenExpiresAt: new Date(Date.now() + 60_000),
        });

        const response = await app.inject({
            method: "POST",
            url: "/identity/refresh",
            headers: {
                ...createMutableHeaders(),
                cookie: `${CSRF_COOKIE_NAME}=${CSRF_TEST_TOKEN}; ${REFRESH_COOKIE_NAME}=refresh-token-vigente`,
            },
        });

        const csrfCookie = findSetCookieHeader(response.headers["set-cookie"], CSRF_COOKIE_NAME);
        const csrfToken = readCookieValue(csrfCookie);

        expect(response.statusCode).toBe(200);
        expect(hasCookieAttribute(csrfCookie, "HttpOnly")).toBe(true);
        expect((JSON.parse(response.payload) as { csrfToken: string }).csrfToken).toBe(csrfToken);
    });

    it("bloquea requests mutables de identidad sin prueba CSRF", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/identity/logout",
        });

        expect(response.statusCode).toBe(403);
        expect(response.headers["cache-control"]).toBe(IDENTITY_NO_STORE_CACHE_CONTROL);
    });

    it("inicia Microsoft guardando challenge HttpOnly sin exponerlo en el cuerpo", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/identity/microsoft/start",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.50",
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual({ authorizationUrl: "https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize" });
        expect(response.payload).not.toContain("challenge.cookie");
        const challengeCookie = findSetCookieHeader(response.headers["set-cookie"], MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME);

        expect(readCookieAttribute(challengeCookie, "Path")).toBe("/identity/microsoft/callback");
        expect(readCookieAttribute(challengeCookie, "SameSite")).toBe("Lax");
        expect(hasCookieAttribute(challengeCookie, "HttpOnly")).toBe(true);
        expect(hasCookieAttribute(challengeCookie, "Secure")).toBe(true);
    });

    it("limita el inicio Microsoft por IP", async () => {
        const firstResponse = await app.inject({
            method: "POST",
            url: "/identity/microsoft/start",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.51",
        });
        const secondResponse = await app.inject({
            method: "POST",
            url: "/identity/microsoft/start",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.51",
        });

        expect(firstResponse.statusCode).toBe(200);
        expect(secondResponse.statusCode).toBe(429);
        expect(identity.startMicrosoftLogin).toHaveBeenCalledTimes(1);
    });

    it("completa callback Microsoft con parametros extras de Entra ID y redirige sin exponer tokens", async () => {
        identity.completeMicrosoftCallback.mockResolvedValue({
            refreshToken: "refresh-token",
            refreshTokenExpiresAt: new Date(Date.now() + 60_000),
            response: {
                authenticated: true,
                session: {
                    expiresAt: "2026-09-25T22:00:00.000Z",
                    expiresInSeconds: 28800,
                    permissionVersion: 1,
                    publicId: "session-public-id",
                    status: "active",
                },
                user: {
                    displayName: "Usuario CRM",
                    email: "usuario@roccacr.com",
                    permissionVersion: 1,
                    profileImageUrl: "/identity/me/photo",
                    publicId: "user-public-id",
                    status: "active",
                },
            },
            sessionToken: "session-token",
            sessionTokenExpiresAt: new Date(Date.now() + 60_000),
        });

        const response = await app.inject({
            method: "GET",
            url: "/identity/microsoft/callback?code=codigo&state=estado&session_state=sesion-entra&client_info=cliente",
            headers: {
                cookie: `${MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME}=challenge.cookie`,
            },
        });

        expect(response.statusCode).toBe(303);
        expect(response.headers.location).toBe(`${TEST_HTTP_CONFIG.FRONTEND_ORIGIN}/auth/login`);
        expect(response.payload).not.toContain("session-token");
        expect(response.payload).not.toContain("refresh-token");
        expect(findSetCookieHeader(response.headers["set-cookie"], SESSION_COOKIE_NAME)).toContain(`${SESSION_COOKIE_NAME}=`);
        expect(identity.completeMicrosoftCallback).toHaveBeenCalledWith(
            expect.objectContaining({
                challengeCookie: "challenge.cookie",
                code: "codigo",
                state: "estado",
            }),
        );
    });

    it("redirige al frontend con fallo controlado si Microsoft callback no puede crear sesion", async () => {
        identity.completeMicrosoftCallback.mockRejectedValue(new Error("MSAL callback failed"));

        const response = await app.inject({
            method: "GET",
            url: "/identity/microsoft/callback?code=codigo&state=estado",
            headers: {
                cookie: `${MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME}=challenge.cookie`,
            },
        });

        expect(response.statusCode).toBe(303);
        expect(response.headers.location).toBe(`${TEST_HTTP_CONFIG.FRONTEND_ORIGIN}/auth/login?microsoftStatus=failed`);
        expect(response.payload).not.toContain("MSAL callback failed");
        expect(response.payload).not.toContain("codigo");
        expect(response.payload).not.toContain("challenge.cookie");
        expect(readCookieAttribute(findSetCookieHeader(response.headers["set-cookie"], MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME), "Path")).toBe("/identity/microsoft/callback");
    });

    it("redirige con fallo controlado si Microsoft devuelve error sin code ni state", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/identity/microsoft/callback?error=access_denied&error_description=El%20usuario%20cancelo",
            headers: {
                cookie: `${MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME}=challenge.cookie`,
            },
        });

        expect(response.statusCode).toBe(303);
        expect(response.headers.location).toBe(`${TEST_HTTP_CONFIG.FRONTEND_ORIGIN}/auth/login?microsoftStatus=failed`);
        expect(identity.completeMicrosoftCallback).not.toHaveBeenCalled();
        expect(response.payload).not.toContain("access_denied");
        expect(response.payload).not.toContain("challenge.cookie");
    });

    it("redirige con estado no asignado cuando Microsoft autentica pero CRM no tiene identidad vinculada", async () => {
        identity.completeMicrosoftCallback.mockRejectedValue(new UnauthorizedException("Cuenta Microsoft no asignada al CRM."));

        const response = await app.inject({
            method: "GET",
            url: "/identity/microsoft/callback?code=codigo&state=estado",
            headers: {
                cookie: `${MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME}=challenge.cookie`,
            },
        });

        expect(response.statusCode).toBe(303);
        expect(response.headers.location).toBe(`${TEST_HTTP_CONFIG.FRONTEND_ORIGIN}/auth/login?microsoftStatus=unassigned`);
        expect(response.payload).not.toContain("Cuenta Microsoft no asignada");
        expect(response.payload).not.toContain("codigo");
        expect(response.payload).not.toContain("challenge.cookie");
    });

    it("redirige con estado no autorizado cuando el usuario CRM esta inactivo o bloqueado", async () => {
        identity.completeMicrosoftCallback.mockRejectedValue(new UnauthorizedException("Usuario CRM no autorizado para iniciar sesión."));

        const response = await app.inject({
            method: "GET",
            url: "/identity/microsoft/callback?code=codigo&state=estado",
            headers: {
                cookie: `${MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME}=challenge.cookie`,
            },
        });

        expect(response.statusCode).toBe(303);
        expect(response.headers.location).toBe(`${TEST_HTTP_CONFIG.FRONTEND_ORIGIN}/auth/login?microsoftStatus=unauthorized`);
        expect(response.payload).not.toContain("Usuario CRM no autorizado");
        expect(response.payload).not.toContain("codigo");
        expect(response.payload).not.toContain("challenge.cookie");
    });

    it("sirve la foto cacheada del usuario autenticado sin exponer Microsoft Graph", async () => {
        identity.getCurrentUserProfileImage.mockResolvedValue({
            bytes: Buffer.from("foto-cacheada"),
            mimeType: "image/jpeg",
        });

        const response = await app.inject({
            method: "GET",
            url: "/identity/me/photo",
            headers: {
                cookie: `${SESSION_COOKIE_NAME}=session-token`,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toContain("image/jpeg");
        expect(response.payload).toBe("foto-cacheada");
        expect(response.headers["cache-control"]).toContain("no-store");
        expect(response.headers["cross-origin-resource-policy"]).toBe("same-site");
        expect(identity.getCurrentUserProfileImage).toHaveBeenCalledWith("session-token", { refresh: false });
    });

    it("solicita refrescar la foto cuando el cliente detecta imagen invalida", async () => {
        identity.getCurrentUserProfileImage.mockResolvedValue({
            bytes: Buffer.from("foto-refrescada"),
            mimeType: "image/png",
        });

        const response = await app.inject({
            method: "GET",
            url: "/identity/me/photo?refresh=1",
            headers: {
                cookie: `${SESSION_COOKIE_NAME}=session-token`,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toContain("image/png");
        expect(response.payload).toBe("foto-refrescada");
        expect(identity.getCurrentUserProfileImage).toHaveBeenCalledWith("session-token", { refresh: true });
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

    it("limita login local por correo normalizado aunque cambie mayusculas e IP", async () => {
        const firstResponse = await app.inject({
            method: "POST",
            url: "/identity/local/login",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.23",
            payload: {
                email: "Login-Mayusculas@RoccaCR.com",
                password: "Password temporal 1",
            },
        });
        const secondResponse = await app.inject({
            method: "POST",
            url: "/identity/local/login",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.24",
            payload: {
                email: " login-mayusculas@roccacr.com ",
                password: "Password temporal 2",
            },
        });

        expect(firstResponse.statusCode).toBe(501);
        expect(secondResponse.statusCode).toBe(429);
        expect(identity.localLogin).toHaveBeenCalledTimes(1);
    });

    it("limita refresh por token aunque cambie la IP", async () => {
        const headers = {
            ...createMutableHeaders(),
            cookie: `${CSRF_COOKIE_NAME}=${CSRF_TEST_TOKEN}; ${REFRESH_COOKIE_NAME}=refresh-token-compartido`,
        };
        const firstResponse = await app.inject({
            method: "POST",
            url: "/identity/refresh",
            headers,
            remoteAddress: "10.0.0.31",
        });
        const secondResponse = await app.inject({
            method: "POST",
            url: "/identity/refresh",
            headers,
            remoteAddress: "10.0.0.32",
        });

        expect(firstResponse.statusCode).toBe(501);
        expect(secondResponse.statusCode).toBe(429);
        expect(identity.refresh).toHaveBeenCalledTimes(1);
    });

    it("limita completar reset por token aunque cambie la IP", async () => {
        const payload = {
            resetToken: "reset-token-opaco-para-prueba-segura",
            newPassword: "Password temporal 1",
        };
        const firstResponse = await app.inject({
            method: "POST",
            url: "/identity/local/complete-reset",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.41",
            payload,
        });
        const secondResponse = await app.inject({
            method: "POST",
            url: "/identity/local/complete-reset",
            headers: createMutableHeaders(),
            remoteAddress: "10.0.0.42",
            payload,
        });

        expect(firstResponse.statusCode).toBe(501);
        expect(secondResponse.statusCode).toBe(429);
        expect(identity.completeLocalReset).toHaveBeenCalledTimes(1);
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
