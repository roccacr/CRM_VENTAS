import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { configureHttpApp } from "../../src/bootstrap/configure-http-app.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { MicrosoftMsalCacheCryptoService } from "../../src/common/security/microsoft-msal-cache-crypto.service.js";
import { APP_LOG_REDACT_PATHS } from "../../src/config/app-logging.constants.js";
import { APPROVED_DATABASE_NAME } from "../../src/config/product.constants.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { LegacyCrmDatabaseService } from "../../src/integrations/legacy-crm/legacy-crm-database.service.js";
import { Microsoft365AuthService } from "../../src/integrations/microsoft365/microsoft365-auth.service.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityController } from "../../src/modules/crm/identity/identity.controller.js";
import { IdentityRepository } from "../../src/modules/crm/identity/identity.repository.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
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
import { EffectivePermissionService } from "../../src/modules/crm/permissions/effective-permission.service.js";

type ExplicitDependencyMetadata = {
    index: number;
    param: unknown;
};

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
        expectExplicitConstructorInjections(CsrfGuard, [0]);
        expectExplicitConstructorInjections(SecurityAuditService, [0]);
        expectExplicitConstructorInjections(IdentityController, [0, 1]);
        expectExplicitConstructorInjections(IdentityAccessManagementController, [0]);
        expectExplicitConstructorInjections(IdentityAccessManagementService, [0, 1]);
        expectExplicitConstructorInjections(IdentityAccessManagementRepository, [0, 1]);
        expectExplicitConstructorInjections(IdentityService, [0, 1, 2, 3]);
        expectExplicitConstructorInjections(IdentityAuditRecorder, [0, 1]);
        expectExplicitConstructorInjections(IdentityMicrosoftSessionService, [0, 1, 2]);
        expectExplicitConstructorInjections(IdentityRepository, [0, 1, 2, 3, 4]);
        expectExplicitConstructorInjections(IdentityProfileRepository, [0, 1]);
        expectExplicitConstructorInjections(IdentitySessionRepository, [0, 1]);
        expectExplicitConstructorInjections(IdentityLocalRepository, [0, 1]);
        expectExplicitConstructorInjections(IdentityMicrosoftRepository, [0, 1]);
        expectExplicitConstructorInjections(IdentityUserDirectoryRepository, [0, 1]);
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

    it("activa el servicio legacy solo cuando la base vieja esta configurada", async () => {
        configureTestEnvironment();
        configureLegacyTestEnvironment();

        const { AppModule } = await import("../../src/app.module.js");
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(DatabaseService)
            .useValue(databaseServiceStub)
            .compile();

        const legacyService = moduleRef.get(LegacyCrmDatabaseService);

        expect(legacyService.isConfigured()).toBe(true);

        await moduleRef.close();
    });
});
