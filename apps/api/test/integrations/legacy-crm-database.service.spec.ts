import { EventEmitter } from "node:events";

import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { Pool, PoolConnection } from "mysql2";
import { afterEach, describe, expect, it } from "vitest";

import { validateEnv } from "../../src/config/env.validation.js";
import { APPROVED_DATABASE_NAME } from "../../src/config/product.constants.js";
import { createLegacyCrmDatabase, registerLegacyReadOnlySession } from "../../src/integrations/legacy-crm/legacy-crm.config.js";
import { LegacyCrmDatabaseService } from "../../src/integrations/legacy-crm/legacy-crm-database.service.js";

type TestConfig = Record<string, boolean | number | string>;

const TEST_CONFIG: TestConfig = {
    DB_HOST: "127.0.0.1",
    DB_PORT: 3306,
    DB_USER: "test",
    DB_PASSWORD: "test",
    DB_SSL: false,
    LEGACY_CRM_DB_NAME: "crmdatabase-api",
    LEGACY_CRM_DB_USER: "legacy_reader",
    LEGACY_CRM_DB_PASSWORD: "legacy-password",
};

const PROCESS_ENV_KEYS = ["NODE_ENV", "API_BIND_HOST", "PORT", "FRONTEND_ORIGIN", "COOKIE_SECRET", "AUDIT_HASH_SECRET", "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_SSL", "OPENAPI_ENABLED", "LEGACY_CRM_DB_NAME", "LEGACY_CRM_DB_USER", "LEGACY_CRM_DB_PASSWORD"] as const;

type ProcessEnvSnapshot = Record<(typeof PROCESS_ENV_KEYS)[number], string | undefined>;

/**
 * Guarda y restaura solo las claves que el ConfigModule real necesita.
 */
const readProcessEnvSnapshot = (): ProcessEnvSnapshot => Object.fromEntries(PROCESS_ENV_KEYS.map((key) => [key, process.env[key]])) as ProcessEnvSnapshot;

const restoreProcessEnvSnapshot = (snapshot: ProcessEnvSnapshot): void => {
    for (const key of PROCESS_ENV_KEYS) {
        const value = snapshot[key];

        if (value === undefined) {
            Reflect.deleteProperty(process.env, key);
        } else {
            process.env[key] = value;
        }
    }
};

/**
 * Setea el entorno minimo para probar ConfigModule real sin leer `.env`.
 */
const configureProcessEnvForLegacy = (): void => {
    process.env.NODE_ENV = "test";
    process.env.API_BIND_HOST = "127.0.0.1";
    process.env.PORT = "3001";
    process.env.FRONTEND_ORIGIN = "http://localhost:5173";
    process.env.COOKIE_SECRET = "test-cookie-secret-for-crm-think-v2";
    process.env.AUDIT_HASH_SECRET = "audit-hash-secret-for-tests-32-chars";
    process.env.DB_HOST = "127.0.0.1";
    process.env.DB_PORT = "3306";
    process.env.DB_USER = "test";
    process.env.DB_PASSWORD = "test";
    process.env.DB_NAME = APPROVED_DATABASE_NAME;
    process.env.DB_SSL = "false";
    process.env.OPENAPI_ENABLED = "false";
    process.env.LEGACY_CRM_DB_NAME = "crmdatabase-api";
    process.env.LEGACY_CRM_DB_USER = "legacy_reader";
    process.env.LEGACY_CRM_DB_PASSWORD = "legacy-password";
};

/**
 * ConfigService real con valores en memoria.
 *
 * No se levanta Nest ni se abre conexion real. mysql2 crea el pool, pero no
 * hace handshake hasta que exista una query.
 */
const createConfigService = (overrides: Partial<TestConfig> = {}): ConfigService => new ConfigService({ ...TEST_CONFIG, ...overrides });

/**
 * Pool minimo para verificar el hook de conexion sin abrir MySQL.
 */
const createPoolEmitter = (): EventEmitter & Pick<Pool, "on"> => new EventEmitter() as EventEmitter & Pick<Pool, "on">;

describe("LegacyCrmDatabaseService", () => {
    let service: LegacyCrmDatabaseService | null = null;

    afterEach(async () => {
        if (service) {
            await service.onModuleDestroy();
            service = null;
        }
    });

    it("crea un pool aislado usando solo el nombre de base legacy", async () => {
        service = new LegacyCrmDatabaseService(createLegacyCrmDatabase(createConfigService()));

        expect(service.isConfigured()).toBe(true);
        expect(service.db).toBeDefined();
        await service.onModuleDestroy();
        service = null;
    });

    it("queda apagado sin abrir pool cuando no existe LEGACY_CRM_DB_NAME", () => {
        service = new LegacyCrmDatabaseService(createLegacyCrmDatabase(createConfigService({ LEGACY_CRM_DB_NAME: "" })));

        expect(service.isConfigured()).toBe(false);
        expect(() => service?.db).toThrow("CRM viejo");
    });

    it("falla si la base legacy intenta usar CRM_THINK_V2", () => {
        expect(() => createLegacyCrmDatabase(createConfigService({ LEGACY_CRM_DB_NAME: APPROVED_DATABASE_NAME }))).toThrow(APPROVED_DATABASE_NAME);
    });

    it("falla si legacy esta activo sin usuario separado", () => {
        expect(() => createLegacyCrmDatabase(createConfigService({ LEGACY_CRM_DB_USER: "" }))).toThrow("LEGACY_CRM_DB_USER");
    });

    it("falla si el usuario legacy intenta reutilizar el usuario principal", () => {
        expect(() => createLegacyCrmDatabase(createConfigService({ LEGACY_CRM_DB_USER: TEST_CONFIG.DB_USER }))).toThrow("LEGACY_CRM_DB_USER");
    });

    it("lee variables legacy desde ConfigModule real aunque el schema global no las declare", async () => {
        const snapshot = readProcessEnvSnapshot();
        configureProcessEnvForLegacy();

        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    ignoreEnvFile: true,
                    validate: validateEnv,
                }),
            ],
        }).compile();

        try {
            const config = moduleRef.get(ConfigService);
            service = new LegacyCrmDatabaseService(createLegacyCrmDatabase(config));

            expect(service.isConfigured()).toBe(true);
        } finally {
            await moduleRef.close();
            restoreProcessEnvSnapshot(snapshot);
        }
    });

    it("marca las conexiones legacy como transacciones de solo lectura", () => {
        const pool = createPoolEmitter();
        let receivedSql = "";
        const connection = {
            query: (sql: string, callback: (error: Error | null) => void) => {
                receivedSql = sql;
                callback(null);
            },
            destroy: () => undefined,
        } as PoolConnection;

        registerLegacyReadOnlySession(pool);
        pool.emit("connection", connection);

        expect(receivedSql).toBe("SET SESSION TRANSACTION READ ONLY");
    });
});
