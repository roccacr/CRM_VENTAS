import type { ConfigService } from "@nestjs/config";
import { Kysely, MysqlDialect } from "kysely";
import { createPool, type Pool, type PoolConnection, type PoolOptions } from "mysql2";
import { z } from "zod";

import { APPROVED_DATABASE_NAME } from "../../config/product.constants.js";
import { buildMysqlPoolOptions } from "../../database/mysql-pool-options.js";

// ============================================================================
// Configuracion aislada del CRM viejo.
//
// La conexion legacy queda apagada por defecto. Cuando se configure, usa un
// usuario MySQL separado y solo lectura para que el runtime del CRM nuevo no
// herede permisos sobre `crmdatabase-api`.
// ============================================================================

/** Limite reducido: legacy es fuente temporal de lectura, no motor principal. */
const LEGACY_CRM_CONNECTION_LIMIT = 5;
const LEGACY_READ_ONLY_SESSION_SQL = "SET SESSION TRANSACTION READ ONLY";

const emptyStringToUndefined = (value: unknown): unknown => (value === "" ? undefined : value);

const legacyCrmEnvSchema = z
    .object({
        DB_USER: z.string().min(1),
        LEGACY_CRM_DB_NAME: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
        LEGACY_CRM_DB_USER: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
        LEGACY_CRM_DB_PASSWORD: z.preprocess(emptyStringToUndefined, z.string().optional()),
    })
    .superRefine((config, context) => {
        if (!config.LEGACY_CRM_DB_NAME) {
            return;
        }

        if (config.LEGACY_CRM_DB_NAME === APPROVED_DATABASE_NAME) {
            context.addIssue({
                code: "custom",
                message: `LEGACY_CRM_DB_NAME no puede ser "${APPROVED_DATABASE_NAME}"; esa base pertenece al CRM nuevo.`,
                path: ["LEGACY_CRM_DB_NAME"],
            });
        }

        if (!config.LEGACY_CRM_DB_USER) {
            context.addIssue({
                code: "custom",
                message: "LEGACY_CRM_DB_USER es obligatorio cuando LEGACY_CRM_DB_NAME esta configurado.",
                path: ["LEGACY_CRM_DB_USER"],
            });
        }

        if (config.LEGACY_CRM_DB_USER === config.DB_USER) {
            context.addIssue({
                code: "custom",
                message: "LEGACY_CRM_DB_USER debe ser distinto de DB_USER para mantener privilegio minimo.",
                path: ["LEGACY_CRM_DB_USER"],
            });
        }
    });

type LegacyCrmEnvConfig = z.infer<typeof legacyCrmEnvSchema>;

/**
 * Token interno para inyectar la conexion opcional al CRM viejo.
 */
export const LEGACY_CRM_DATABASE = Symbol("LEGACY_CRM_DATABASE");

/**
 * Lee y valida las variables legacy sin contaminar el schema global.
 */
const readLegacyCrmEnvConfig = (config: ConfigService): LegacyCrmEnvConfig => {
    const result = legacyCrmEnvSchema.safeParse({
        DB_USER: config.get<string>("DB_USER"),
        LEGACY_CRM_DB_NAME: config.get<string>("LEGACY_CRM_DB_NAME"),
        LEGACY_CRM_DB_USER: config.get<string>("LEGACY_CRM_DB_USER"),
        LEGACY_CRM_DB_PASSWORD: config.get<string>("LEGACY_CRM_DB_PASSWORD"),
    });

    if (!result.success) {
        throw new Error(`Configuracion legacy invalida: ${result.error.message}`);
    }

    return result.data;
};

/**
 * Construye las opciones mysql2 para legacy con credenciales separadas.
 *
 * Host, puerto y TLS pueden ser los mismos del servidor MySQL compartido; el
 * usuario debe venir de LEGACY_CRM_DB_USER para conservar privilegio minimo.
 */
const buildLegacyPoolOptions = (config: ConfigService, legacyConfig: LegacyCrmEnvConfig): PoolOptions => {
    const sslCaPath = config.get<string>("DB_SSL_CA");

    return buildMysqlPoolOptions({
        host: config.getOrThrow<string>("DB_HOST"),
        port: config.getOrThrow<number>("DB_PORT"),
        user: legacyConfig.LEGACY_CRM_DB_USER ?? "",
        password: legacyConfig.LEGACY_CRM_DB_PASSWORD ?? "",
        database: legacyConfig.LEGACY_CRM_DB_NAME ?? "",
        connectionLimit: LEGACY_CRM_CONNECTION_LIMIT,
        ssl: config.getOrThrow<boolean>("DB_SSL"),
        ...(sslCaPath ? { sslCaPath } : {}),
    });
};

/**
 * Marca cada conexion legacy como transaccion de solo lectura.
 *
 * El permiso MySQL sigue siendo la barrera principal. Este guardrail evita que
 * una futura consulta accidental de escritura prospere dentro de una
 * transaccion legacy.
 */
export const registerLegacyReadOnlySession = (pool: Pick<Pool, "on">): void => {
    pool.on("connection", (connection: PoolConnection) => {
        connection.query(LEGACY_READ_ONLY_SESSION_SQL, (error) => {
            if (error) {
                connection.destroy();
            }
        });
    });
};

/**
 * Crea Kysely sin tipos de dominio nuevo.
 */
const createLegacyKyselyDatabase = (poolOptions: PoolOptions): Kysely<unknown> => {
    const pool = createPool(poolOptions);
    registerLegacyReadOnlySession(pool);

    return new Kysely<unknown>({
        dialect: new MysqlDialect({ pool }),
    });
};

/**
 * Abre la conexion legacy solo cuando `LEGACY_CRM_DB_NAME` esta configurado.
 */
export const createLegacyCrmDatabase = (config: ConfigService): Kysely<unknown> | null => {
    const legacyConfig = readLegacyCrmEnvConfig(config);

    if (!legacyConfig.LEGACY_CRM_DB_NAME) {
        return null;
    }

    return createLegacyKyselyDatabase(buildLegacyPoolOptions(config, legacyConfig));
};
