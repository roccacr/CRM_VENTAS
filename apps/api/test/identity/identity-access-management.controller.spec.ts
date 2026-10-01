import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";

import { configureHttpApp } from "../../src/bootstrap/configure-http-app.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { IdentityAccessManagementController } from "../../src/modules/crm/identity/identity-access-management.controller.js";
import { IdentityAccessManagementService } from "../../src/modules/crm/identity/identity-access-management.service.js";

const TEST_HTTP_CONFIG = {
    AUDIT_HASH_SECRET: "audit-hash-secret-for-tests-32-chars",
    AUTH_TOKEN_HASH_SECRET: "auth-token-hash-secret-for-tests-32",
    COOKIE_SECRET: "test-cookie-secret-for-crm-think-v2",
    FRONTEND_ALLOWED_ORIGINS: "",
    FRONTEND_ORIGIN: "http://localhost:5173",
    LOCAL_COMPLETE_RESET_RATE_LIMIT_CACHE: 50,
    LOCAL_COMPLETE_RESET_RATE_LIMIT_IP_MAX: 1,
    LOCAL_COMPLETE_RESET_RATE_LIMIT_TOKEN_MAX: 1,
    LOCAL_COMPLETE_RESET_RATE_LIMIT_WINDOW_MS: 60_000,
    LOCAL_LOGIN_RATE_LIMIT_CACHE: 50,
    LOCAL_LOGIN_RATE_LIMIT_EMAIL_MAX: 1,
    LOCAL_LOGIN_RATE_LIMIT_IP_MAX: 1,
    LOCAL_LOGIN_RATE_LIMIT_WINDOW_MS: 60_000,
    LOCAL_RESET_RATE_LIMIT_CACHE: 50,
    LOCAL_RESET_RATE_LIMIT_EMAIL_MAX: 1,
    LOCAL_RESET_RATE_LIMIT_IP_MAX: 1,
    LOCAL_RESET_RATE_LIMIT_WINDOW_MS: 60_000,
    MICROSOFT_START_RATE_LIMIT_CACHE: 50,
    MICROSOFT_START_RATE_LIMIT_IP_MAX: 1,
    MICROSOFT_START_RATE_LIMIT_WINDOW_MS: 60_000,
    OPENAPI_ENABLED: false,
    REFRESH_RATE_LIMIT_CACHE: 50,
    REFRESH_RATE_LIMIT_IP_MAX: 1,
    REFRESH_RATE_LIMIT_TOKEN_MAX: 1,
    REFRESH_RATE_LIMIT_WINDOW_MS: 60_000,
} as const;

type IdentityAccessManagementServiceMock = {
    deleteRole: MockedFunction<IdentityAccessManagementService["deleteRole"]>;
    replaceRolePermissions: MockedFunction<IdentityAccessManagementService["replaceRolePermissions"]>;
    readSecurityCatalog: MockedFunction<IdentityAccessManagementService["readSecurityCatalog"]>;
    readUserAccess: MockedFunction<IdentityAccessManagementService["readUserAccess"]>;
    replaceUserAccess: MockedFunction<IdentityAccessManagementService["replaceUserAccess"]>;
    updateRole: MockedFunction<IdentityAccessManagementService["updateRole"]>;
};

const createTestConfigService = (): Pick<ConfigService, "get" | "getOrThrow"> => ({
    get: (key: string) => TEST_HTTP_CONFIG[key as keyof typeof TEST_HTTP_CONFIG],
    getOrThrow: (key: string) => TEST_HTTP_CONFIG[key as keyof typeof TEST_HTTP_CONFIG],
});

const createMutableHeaders = (): Record<string, string> => {
    const csrfToken = createSignedCsrfToken(TEST_HTTP_CONFIG.COOKIE_SECRET, "session-token");

    return {
        [CSRF_HEADER_NAME_LOWERCASE]: csrfToken,
        cookie: `${CSRF_COOKIE_NAME}=${csrfToken}; ${SESSION_COOKIE_NAME}=session-token`,
    };
};

describe("IdentityAccessManagementController", () => {
    let app: NestFastifyApplication;
    let service: IdentityAccessManagementServiceMock;

    beforeAll(async () => {
        process.env.NODE_ENV = "test";
        service = {
            deleteRole: vi.fn(),
            replaceRolePermissions: vi.fn(),
            readSecurityCatalog: vi.fn(),
            readUserAccess: vi.fn(),
            replaceUserAccess: vi.fn(),
            updateRole: vi.fn(),
        };

        const moduleRef = await Test.createTestingModule({
            controllers: [IdentityAccessManagementController],
            providers: [
                {
                    provide: ConfigService,
                    useValue: createTestConfigService(),
                },
                {
                    provide: IdentityAccessManagementService,
                    useValue: service,
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
        service.deleteRole.mockResolvedValue({
            deleted: true,
            role: {
                code: "auditor",
                description: null,
                name: "Auditor",
                status: "inactive",
            },
        });
        service.updateRole.mockResolvedValue({
            code: "ventas",
            description: null,
            name: "Ventas senior",
            status: "active",
        });
        service.replaceRolePermissions.mockResolvedValue({
            permissionCodes: ["lead.read", "lead.create"],
            role: {
                code: "ventas",
                description: null,
                name: "Ventas",
                status: "active",
            },
        });
        service.readSecurityCatalog.mockResolvedValue({
            auditEvents: [
                {
                    actorName: "Admin Seguridad",
                    createdAt: "2026-10-01T12:00:00.000Z",
                    eventType: "role_permissions_replaced",
                    moduleCodes: ["ventas"],
                    publicId: "01SECURITYAUDITEVENT000001",
                    reason: "Ajuste aprobado por jefatura",
                    roleCode: "ventas",
                    summary: "Permisos activos del rol reemplazados.",
                    targetName: null,
                },
            ],
            modules: [
                {
                    code: "ventas",
                    name: "Ventas",
                    views: [
                        {
                            code: "lead",
                            name: "Leads",
                            permissions: [
                                {
                                    code: "lead.read",
                                    description: "Permite leer la tabla de prospectos.",
                                    name: "Ver lista de leads",
                                    sensitive: false,
                                },
                            ],
                        },
                    ],
                },
            ],
            rolePermissions: {
                ventas: ["lead.read"],
            },
            roles: [
                {
                    code: "ventas",
                    description: null,
                    locked: false,
                    name: "Ventas",
                    status: "active",
                    users: 31,
                },
            ],
        });
        service.readUserAccess.mockResolvedValue({
            orgUnits: [{ code: "ventas", name: "Ventas", publicId: "org-public-id" }],
            permissionOverrides: [{ code: "lead.create", effect: "deny" }],
            roles: [{ code: "ventas", name: "Ventas", status: "active" }],
            user: {
                email: "ventas@roccacr.com",
                name: "Usuario Ventas",
                publicId: "target-user-public-id",
                status: "active",
            },
        });
        service.replaceUserAccess.mockResolvedValue({
            orgUnits: [{ code: "ventas", name: "Ventas", publicId: "org-public-id" }],
            permissionOverrides: [{ code: "lead.create", effect: "deny" }],
            roles: [{ code: "ventas", name: "Ventas", status: "active" }],
            user: {
                email: "ventas@roccacr.com",
                name: "Usuario Ventas",
                publicId: "target-user-public-id",
                status: "active",
            },
        });
    });

    it("permite preflight CORS para guardar permisos de rol con PUT", async () => {
        const response = await app.inject({
            headers: {
                "access-control-request-method": "PUT",
                origin: TEST_HTTP_CONFIG.FRONTEND_ORIGIN,
            },
            method: "OPTIONS",
            url: "/identity/roles/ventas/permissions",
        });

        expect(response.statusCode).toBe(204);
        expect(response.headers["access-control-allow-origin"]).toBe(TEST_HTTP_CONFIG.FRONTEND_ORIGIN);
        expect(response.headers["access-control-allow-credentials"]).toBe("true");
        expect(String(response.headers["access-control-allow-methods"])).toContain("PUT");
    });

    it("elimina roles por codigo estable", async () => {
        const response = await app.inject({
            headers: createMutableHeaders(),
            method: "DELETE",
            remoteAddress: "10.0.0.56",
            url: "/identity/roles/auditor",
        });

        expect(response.statusCode).toBe(200);
        expect(response.payload).toContain('"deleted":true');
        expect(service.deleteRole).toHaveBeenCalledWith("session-token", "auditor", "10.0.0.56", "lightMyRequest");
    });

    it("lee catalogo de seguridad antes de rutas parametrizadas de rol", async () => {
        const response = await app.inject({
            headers: createMutableHeaders(),
            method: "GET",
            url: "/identity/roles/security-catalog",
        });

        expect(response.statusCode).toBe(200);
        expect(response.payload).toContain('"rolePermissions":{"ventas":["lead.read"]}');
        expect(service.readSecurityCatalog).toHaveBeenCalledWith("session-token");
        expect(service.updateRole).not.toHaveBeenCalled();
    });

    it("renombra roles por codigo estable", async () => {
        const response = await app.inject({
            headers: createMutableHeaders(),
            method: "PATCH",
            payload: {
                name: "Ventas senior",
                reason: "Cambio autorizado por TI",
            },
            remoteAddress: "10.0.0.57",
            url: "/identity/roles/ventas",
        });

        expect(response.statusCode).toBe(200);
        expect(response.payload).toContain('"name":"Ventas senior"');
        expect(service.updateRole).toHaveBeenCalledOnce();
        expect(service.updateRole.mock.calls[0]?.[0]).toBe("session-token");
        expect(service.updateRole.mock.calls[0]?.[1]).toMatchObject({
            ipAddress: "10.0.0.57",
            payload: {
                name: "Ventas senior",
            },
            roleCode: "ventas",
            userAgent: "lightMyRequest",
        });
    });

    it("guarda permisos activos de un rol", async () => {
        const response = await app.inject({
            headers: createMutableHeaders(),
            method: "PUT",
            payload: {
                permissionCodes: ["lead.read", "lead.create"],
                reason: "Ajuste aprobado por jefatura",
            },
            url: "/identity/roles/ventas/permissions",
        });

        expect(response.statusCode).toBe(200);
        expect(response.payload).toContain('"permissionCodes":["lead.read","lead.create"]');
        expect(service.replaceRolePermissions).toHaveBeenCalledOnce();
        expect(service.replaceRolePermissions.mock.calls[0]?.[0]).toBe("session-token");
        expect(service.replaceRolePermissions.mock.calls[0]?.[1]).toMatchObject({
            ipAddress: "127.0.0.1",
            payload: {
                permissionCodes: ["lead.read", "lead.create"],
            },
            roleCode: "ventas",
            userAgent: "lightMyRequest",
        });
    });

    it("rechaza motivos auditables de una sola palabra aunque superen el minimo anterior", async () => {
        const response = await app.inject({
            headers: createMutableHeaders(),
            method: "PUT",
            payload: {
                permissionCodes: ["lead.read", "lead.create"],
                reason: "prueba",
            },
            url: "/identity/roles/ventas/permissions",
        });

        expect(response.statusCode).toBe(400);
        expect(service.replaceRolePermissions).not.toHaveBeenCalled();
    });

    it("lee acceso administrativo de un usuario", async () => {
        const response = await app.inject({
            headers: createMutableHeaders(),
            method: "GET",
            url: "/identity/users/target-user-public-id/access",
        });

        expect(response.statusCode).toBe(200);
        expect(response.payload).toContain('"publicId":"target-user-public-id"');
        expect(service.readUserAccess).toHaveBeenCalledWith("session-token", "target-user-public-id");
    });

    it("guarda acceso administrativo de un usuario", async () => {
        const response = await app.inject({
            headers: createMutableHeaders(),
            method: "PUT",
            payload: {
                orgUnitCodes: ["ventas"],
                permissionOverrides: [{ code: "lead.create", effect: "deny" }],
                reason: "Ajuste aprobado por jefatura",
                roleCodes: ["ventas"],
            },
            remoteAddress: "10.0.0.58",
            url: "/identity/users/target-user-public-id/access",
        });

        expect(response.statusCode).toBe(200);
        expect(response.payload).toContain('"permissionOverrides":[{"code":"lead.create","effect":"deny"}]');
        expect(service.replaceUserAccess).toHaveBeenCalledOnce();
        expect(service.replaceUserAccess.mock.calls[0]?.[0]).toBe("session-token");
        expect(service.replaceUserAccess.mock.calls[0]?.[1]).toMatchObject({
            ipAddress: "10.0.0.58",
            payload: {
                roleCodes: ["ventas"],
            },
            userAgent: "lightMyRequest",
            userPublicId: "target-user-public-id",
        });
    });
});
