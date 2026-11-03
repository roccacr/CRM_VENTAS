import { Controller, Get, RequestMethod, type Type } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA, SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js";
import { ConfigService } from "@nestjs/config";
import { MetadataScanner, ModulesContainer } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { configureHttpApp } from "../../src/bootstrap/configure-http-app.js";
import { AuthGuard } from "../../src/common/security/auth.guard.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import { SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { MicrosoftMsalCacheCryptoService } from "../../src/common/security/microsoft-msal-cache-crypto.service.js";
import { ROUTE_SECURITY_METADATA } from "../../src/common/security/route-security.decorator.js";
import { APP_LOG_REDACT_PATHS } from "../../src/config/app-logging.constants.js";
import { APPROVED_DATABASE_NAME } from "../../src/config/product.constants.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { LegacyCrmDatabaseService } from "../../src/integrations/legacy-crm/legacy-crm-database.service.js";
import { Microsoft365AuthService } from "../../src/integrations/microsoft365/microsoft365-auth.service.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityController } from "../../src/modules/crm/identity/identity.controller.js";
import { IdentityRepository } from "../../src/modules/crm/identity/identity.repository.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { IdentityAccessManagementController } from "../../src/modules/crm/identity/identity-access-management.controller.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import { IdentityAccessManagementService } from "../../src/modules/crm/identity/identity-access-management.service.js";
import { IdentityAuditRecorder } from "../../src/modules/crm/identity/identity-audit-recorder.service.js";
import { IdentityLocalRepository } from "../../src/modules/crm/identity/identity-local.repository.js";
import { IdentityMicrosoftRepository } from "../../src/modules/crm/identity/identity-microsoft.repository.js";
import { IdentityMicrosoftSessionService } from "../../src/modules/crm/identity/identity-microsoft-session.service.js";
import { IdentityProfileRepository } from "../../src/modules/crm/identity/identity-profile.repository.js";
import { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";
import { IdentityTokenService } from "../../src/modules/crm/identity/identity-token.service.js";
import { IdentityUserDirectoryRepository } from "../../src/modules/crm/identity/identity-user-directory.repository.js";
import { NotesRepository } from "../../src/modules/crm/notes/notes.repository.js";
import { NotesService } from "../../src/modules/crm/notes/notes.service.js";
import { EffectivePermissionService } from "../../src/modules/crm/permissions/effective-permission.service.js";
import { ProjectsController } from "../../src/modules/crm/projects/projects.controller.js";
import { ProjectsRepository } from "../../src/modules/crm/projects/projects.repository.js";
import { ProjectsService } from "../../src/modules/crm/projects/projects.service.js";

type ExplicitDependencyMetadata = {
    index: number;
    param: unknown;
};

// Read the compiled Nest module graph, not a maintained list of controller imports.
// Method-only classification prevents new handlers inheriting an accidental public default.
const registeredRoutes = (controllers: Type<object>[]) =>
    controllers.flatMap((controller) => {
        const prototype = controller.prototype as object;
        const prefixes = Reflect.getMetadata(PATH_METADATA, controller) as string | string[];
        return new MetadataScanner().getAllMethodNames(prototype).flatMap((name) => {
            const handler = Reflect.get(prototype, name) as object;
            const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
            if (method === undefined) return [];
            const paths = Reflect.getMetadata(PATH_METADATA, handler) as string | string[];
            const classification = Reflect.getOwnMetadata(ROUTE_SECURITY_METADATA, handler) as unknown;
            return [prefixes].flat().flatMap((prefix) =>
                [paths].flat().map((path) => ({
                    route: `${RequestMethod[method]} /${[prefix, path]
                        .flatMap((part) => part.split("/"))
                        .filter(Boolean)
                        .join("/")}`,
                    classification,
                })),
            );
        });
    });

const requireClassifiedRoutes = (routes: ReturnType<typeof registeredRoutes>): void => {
    const missing = routes.filter(({ classification }) => !["public", "authenticated", "permission"].includes(String(classification)));
    if (missing.length) throw new Error(`Unclassified routes: ${missing.map(({ route }) => route).join(", ")}`);
};

@Controller(["synthetic", "alias"])
class UnclassifiedController {
    @Get(["missing", "second"])
    missing() {
        return null;
    }
}

const readExplicitInjectionIndexes = (target: object): number[] => {
    const metadata = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target) as ExplicitDependencyMetadata[] | undefined;
    return (metadata ?? []).map((entry) => entry.index).sort((left, right) => left - right);
};

const expectExplicitConstructorInjections = (target: object, expectedIndexes: number[]): void => {
    expect(readExplicitInjectionIndexes(target)).toEqual(expectedIndexes);
};

type NoSessionSelectQuery = {
    executeTakeFirst: () => Promise<undefined>;
    innerJoin: () => NoSessionSelectQuery;
    leftJoin: () => NoSessionSelectQuery;
    select: () => NoSessionSelectQuery;
    where: () => NoSessionSelectQuery;
};

/**
 * Doble minimo de Kysely para recorrer controller -> service -> repository.
 *
 * Devuelve "sin sesion" de forma controlada. Si una dependencia real de Nest
 * queda sin inyectar, esta prueba falla con 500 antes de llegar a este doble.
 */
const createNoSessionDatabaseDouble = (): Pick<DatabaseService["db"], "selectFrom"> => {
    const query: NoSessionSelectQuery = {
        executeTakeFirst: () => Promise.resolve(undefined),
        innerJoin: () => query,
        leftJoin: () => query,
        select: () => query,
        where: () => query,
    };

    return {
        selectFrom: () => query,
    } as unknown as Pick<DatabaseService["db"], "selectFrom">;
};

/**
 * Doble minimo del servicio de base de datos para compilar el AppModule real.
 *
 * Este test no valida MySQL; valida que el wiring real de Nest mantenga vivos
 * controller, service, repository, guards y bootstrap HTTP sin abrir un pool.
 */
const databaseServiceStub: Pick<DatabaseService, "db" | "onModuleDestroy"> = {
    db: createNoSessionDatabaseDouble() as DatabaseService["db"],
    onModuleDestroy: vi.fn(),
};

/**
 * Configura variables requeridas por `ConfigModule.forRoot`.
 *
 * Sin estos valores el runtime debe fallar rapido. En pruebas los seteamos con
 * datos falsos controlados para probar el wiring, no para conectarnos a MySQL.
 */
const clearLegacyTestEnvironment = (): void => {
    delete process.env.LEGACY_CRM_DB_NAME;
    delete process.env.LEGACY_CRM_DB_USER;
    delete process.env.LEGACY_CRM_DB_PASSWORD;
};

const configureTestEnvironment = (): void => {
    process.env.NODE_ENV = "test";
    process.env.API_BIND_HOST = "127.0.0.1";
    process.env.PORT = "3001";
    process.env.FRONTEND_ORIGIN = "http://localhost:5173";
    process.env.COOKIE_SECRET = "test-cookie-secret-for-crm-think-v2";
    process.env.AUDIT_HASH_SECRET = "audit-hash-secret-for-tests-32-chars";
    process.env.AUTH_TOKEN_HASH_SECRET = "auth-token-hash-secret-for-tests-32";
    process.env.DB_HOST = "127.0.0.1";
    process.env.DB_PORT = "3306";
    process.env.DB_USER = "test";
    process.env.DB_PASSWORD = "test";
    process.env.DB_NAME = APPROVED_DATABASE_NAME;
    process.env.DB_SSL = "false";
    process.env.OPENAPI_ENABLED = "false";
    clearLegacyTestEnvironment();
};

const configureLegacyTestEnvironment = (): void => {
    process.env.LEGACY_CRM_DB_NAME = "crmdatabase-api";
    process.env.LEGACY_CRM_DB_USER = "legacy_reader";
    process.env.LEGACY_CRM_DB_PASSWORD = "legacy-password";
};

describe("Cableado de seguridad del AppModule", () => {
    let app: NestFastifyApplication | undefined;

    /**
     * Devuelve la app inicializada o falla con un error claro de setup.
     */
    const getApp = (): NestFastifyApplication => {
        if (!app) {
            throw new Error("La aplicacion de prueba no fue inicializada.");
        }

        return app;
    };

    beforeAll(async () => {
        configureTestEnvironment();

        const { AppModule } = await import("../../src/app.module.js");
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(DatabaseService)
            .useValue(databaseServiceStub)
            .compile();

        app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        await configureHttpApp(app);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    it("bloquea mutaciones sin CSRF usando el AppModule real", async () => {
        const response = await getApp().inject({
            method: "POST",
            url: "/identity/logout",
        });

        expect(response.statusCode).toBe(403);
    });

    it("arranca identidad sin configurar la conexion legacy", () => {
        expect(getApp()).toBeDefined();
    });

    it("rejects synthetic unclassified routes with every controller/method path", () => {
        const routes = registeredRoutes([UnclassifiedController]);
        expect(routes.map(({ route }) => route)).toEqual(["GET /synthetic/missing", "GET /synthetic/second", "GET /alias/missing", "GET /alias/second"]);
        expect(() => {
            requireClassifiedRoutes(routes);
        }).toThrow("Unclassified routes: GET /synthetic/missing");
    });

    it("requires explicit security classification on every actually registered Nest handler", () => {
        const controllers = [...getApp().get(ModulesContainer).values()].flatMap((module) =>
            [...module.controllers.values()].map(({ metatype }) => {
                if (!metatype) throw new Error("Registered controller has no metatype");
                return metatype as Type<object>;
            }),
        );
        const routes = registeredRoutes(controllers);
        expect(routes.length).toBeGreaterThan(50);
        requireClassifiedRoutes(routes);
        expect(routes).toContainEqual({ route: "GET /identity/me", classification: "authenticated" });
        expect(routes).toContainEqual({ route: "GET /catalogs/projects/items", classification: "permission" });
        expect(routes).toContainEqual({ route: "GET /formalization/approvals/summary", classification: "permission" });
        expect(routes).toContainEqual({ route: "GET /audit", classification: "permission" });
        expect(routes).toContainEqual({ route: "GET /unit-files", classification: "permission" });
        expect(
            routes
                .filter(({ classification }) => classification === "public")
                .map(({ route }) => route)
                .sort(),
        ).toEqual(["POST /integrations/netsuite/local/order-events", "POST /integrations/netsuite/production/order-events", "GET /health/live", "GET /health/ready", "GET /identity/microsoft/callback", "GET /identity/session", "POST /identity/local/complete-reset", "POST /identity/local/login", "POST /identity/local/request-reset", "POST /identity/logout", "POST /identity/microsoft/start", "POST /identity/refresh"].sort());
    });

    it("authenticates before reaching the dedicated Projects controller", async () => {
        const service = getApp().get(ProjectsService);
        const handler = vi.spyOn(service, "listCatalogItems");
        try {
            const response = await getApp().inject({ method: "GET", url: "/catalogs/projects/items?moduleCode=administration" });
            expect(response.statusCode).toBe(401);
            expect(handler).not.toHaveBeenCalled();
        } finally {
            handler.mockRestore();
        }
    });

    it.each(["/notes?moduleCode=mercadeo", "/notes/01K00000000000000000000000?moduleCode=mercadeo", "/notes/01K00000000000000000000000/history?moduleCode=mercadeo"])("authenticates Notes before resource queries: %s", async (url) => {
        const find = vi.spyOn(getApp().get(NotesRepository), "find");
        try {
            expect((await getApp().inject({ method: "GET", url })).statusCode).toBe(401);
            expect(find).not.toHaveBeenCalled();
        } finally {
            find.mockRestore();
        }
    });

    it("enforces Notes permission and CSRF before mutation and rejects caller-supplied authors", async () => {
        const profile: IdentityProfile = {
            auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
            orgUnits: [],
            roles: [],
            permissions: ["read", "create"].map((action) => ({ code: `mercadeo.notes.${action}`, effect: "allow", scope: "assigned", source: "role" })),
            session: { expiresAt: new Date(Date.now() + 60000).toISOString(), expiresInSeconds: 60, permissionVersion: 1, publicId: "notes-session", status: "active" },
            user: { displayName: "Actor", email: "actor@example.test", permissionVersion: 1, profileImageUrl: null, publicId: "notes-actor", status: "active" },
        };
        const profileRead = vi.spyOn(getApp().get(IdentityRepository), "findBySessionTokenHash").mockResolvedValue(profile);
        const create = vi.spyOn(getApp().get(NotesRepository), "create").mockResolvedValue({ noteId: "01K00000000000000000000000", version: 1, replayed: false });
        const service = vi.spyOn(getApp().get(NotesService), "create");
        const session = "notes-request-token";
        const csrf = createSignedCsrfToken("test-cookie-secret-for-crm-think-v2", session);
        const payload = { moduleCode: "mercadeo", operationId: "notes_operation_0001", text: "Prueba solo con dobles", context: { kind: "personal" } };
        try {
            expect((await getApp().inject({ method: "POST", url: "/notes", headers: { cookie: `crm_session=${session}` }, payload })).statusCode).toBe(403);
            expect(service).not.toHaveBeenCalled();
            const headers = { cookie: `crm_session=${session}; crm_csrf=${csrf}`, "x-crm-csrf-token": csrf, origin: "http://localhost:5173" };
            expect((await getApp().inject({ method: "POST", url: "/notes", headers, payload: { ...payload, authorUserId: "someone-else" } })).statusCode).toBe(400);
            expect(create).not.toHaveBeenCalled();
            expect((await getApp().inject({ method: "POST", url: "/notes", headers, payload })).statusCode).toBe(201);
            expect(create).toHaveBeenCalledOnce();
            profileRead.mockResolvedValue({ ...profile, permissions: [...profile.permissions, { code: "mercadeo.notes.create", effect: "deny", scope: null, source: "override" }] });
            expect((await getApp().inject({ method: "POST", url: "/notes", headers, payload })).statusCode).toBe(403);
            expect(create).toHaveBeenCalledOnce();
        } finally {
            profileRead.mockRestore();
            create.mockRestore();
            service.mockRestore();
        }
    });

    it("starts request-local reuse before global guards in the real AppModule", async () => {
        const profile: IdentityProfile = {
            auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
            orgUnits: [],
            permissions: [],
            roles: [],
            session: { expiresAt: new Date(Date.now() + 60_000).toISOString(), expiresInSeconds: 60, permissionVersion: 1, publicId: "request-session", status: "active" },
            user: { displayName: "Actor", email: "actor@example.test", permissionVersion: 1, profileImageUrl: null, publicId: "request-actor", status: "active" },
        };
        const read = vi.spyOn(getApp().get(IdentityRepository), "findBySessionTokenHash").mockResolvedValue(profile);
        try {
            const options = { method: "GET" as const, url: "/identity/me", headers: { cookie: `${SESSION_COOKIE_NAME}=request-token` } };
            expect((await getApp().inject(options)).statusCode).toBe(200);
            expect(read).toHaveBeenCalledOnce();
            read.mockResolvedValueOnce(null);
            expect((await getApp().inject(options)).statusCode).toBe(401);
            expect(read).toHaveBeenCalledTimes(2);
        } finally {
            read.mockRestore();
        }
    });

    it("keeps public health GET and HEAD outside authentication and read quotas", async () => {
        const current = vi.spyOn(getApp().get(IdentityService), "getCurrentUser");
        try {
            expect((await getApp().inject({ method: "GET", url: "/health/live" })).statusCode).toBe(200);
            expect((await getApp().inject({ method: "HEAD", url: "/health/live" })).statusCode).toBe(200);
            expect(current).not.toHaveBeenCalled();
        } finally {
            current.mockRestore();
        }
    });

    it("recorre controller, servicio y repository reales antes de responder sesion no autorizada", async () => {
        const response = await getApp().inject({
            headers: {
                cookie: `${SESSION_COOKIE_NAME}=sesion-inexistente`,
            },
            method: "GET",
            url: "/identity/me",
        });

        expect(response.statusCode).toBe(401);
    });

    it("declara @Inject explicito en cada provider con dependencias de constructor", () => {
        expectExplicitConstructorInjections(DatabaseService, [0]);
        expectExplicitConstructorInjections(ProjectsController, [0]);
        expectExplicitConstructorInjections(ProjectsService, [0, 1, 2]);
        expectExplicitConstructorInjections(ProjectsRepository, [0, 1, 2]);
        expectExplicitConstructorInjections(CsrfGuard, [0]);
        expectExplicitConstructorInjections(AuthGuard, [0, 1, 2]);
        expectExplicitConstructorInjections(SecurityAuditService, [0, 1]);
        expectExplicitConstructorInjections(IdentityController, [0, 1]);
        expectExplicitConstructorInjections(IdentityAccessManagementController, [0]);
        expectExplicitConstructorInjections(IdentityAccessManagementService, [0, 1]);
        expectExplicitConstructorInjections(IdentityAccessManagementRepository, [0, 1, 2]);
        expectExplicitConstructorInjections(IdentityService, [0, 1, 2, 3, 4]);
        expectExplicitConstructorInjections(IdentityAuditRecorder, [0, 1]);
        expectExplicitConstructorInjections(IdentityMicrosoftSessionService, [0, 1, 2]);
        expectExplicitConstructorInjections(IdentityRepository, [0, 1, 2, 3, 4]);
        expectExplicitConstructorInjections(IdentityProfileRepository, [0, 1]);
        expectExplicitConstructorInjections(IdentitySessionRepository, [0, 1]);
        expectExplicitConstructorInjections(IdentityLocalRepository, [0, 1]);
        expectExplicitConstructorInjections(IdentityMicrosoftRepository, [0, 1]);
        expectExplicitConstructorInjections(IdentityUserDirectoryRepository, [0, 1, 2]);
        expectExplicitConstructorInjections(IdentityTokenService, [0]);
        expectExplicitConstructorInjections(LegacyCrmDatabaseService, [0]);
        expectExplicitConstructorInjections(Microsoft365AuthService, [0]);
        expectExplicitConstructorInjections(MicrosoftMsalCacheCryptoService, [0]);
        expectExplicitConstructorInjections(EffectivePermissionService, []);
    });

    it("redacta el header CSRF canonico antes de escribir logs", () => {
        expect(APP_LOG_REDACT_PATHS).toContain("req.headers.x-crm-csrf-token");
        expect(APP_LOG_REDACT_PATHS).not.toContain("req.headers.x-csrf-token");
    });

    it.each([false, true])("gates the configured legacy pool with ENABLE_LEGACY_FALLBACK=%s", async (enabled) => {
        configureTestEnvironment();
        configureLegacyTestEnvironment();
        process.env.ENABLE_LEGACY_FALLBACK = String(enabled);

        const { AppModule } = await import("../../src/app.module.js");
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        })
            // AppModule metadata is cached after beforeAll; give each case its own validated flag.
            .overrideProvider(ConfigService)
            .useValue(new ConfigService({ ...process.env, DB_PORT: 3306, DB_SSL: false, ENABLE_LEGACY_FALLBACK: enabled }))
            .overrideProvider(DatabaseService)
            .useValue(databaseServiceStub)
            .compile();

        const legacyService = moduleRef.get(LegacyCrmDatabaseService);

        expect(legacyService.isConfigured()).toBe(enabled);

        await moduleRef.close();
        delete process.env.ENABLE_LEGACY_FALLBACK;
    });
});
