/**
 * Conexión aislada al CRM viejo.
 *
 * Queda apagada si no hay nombre de base. Cuando se abre, reutiliza las
 * credenciales `DB_*` del entorno, pero con otro pool y otra base. La cuenta
 * compartida no es de solo lectura a nivel de privilegio, así que cada
 * conexión de este pool se marca `READ ONLY` antes de usarse. Projects sincroniza
 * escrituras autorizadas mediante la transacción nativa, nunca mediante este pool.
 */
import type { ConfigService } from "@nestjs/config";
import { Kysely, MysqlDialect } from "kysely";
import { createPool, type Pool, type PoolConnection, type PoolOptions } from "mysql2";
import { z } from "zod";

import { APPROVED_DATABASE_NAME } from "../../config/product.constants.js";
import { buildMysqlPoolOptions } from "../../database/mysql-pool-options.js";

/** Tope bajo: el CRM viejo es una fuente temporal de lectura, no el motor principal. */
const LEGACY_CRM_CONNECTION_LIMIT = 5;
/** Se aplica al tomar la conexión. Una sesión que no pueda quedar en solo lectura se descarta. */
const LEGACY_READ_ONLY_SESSION_SQL = "SET SESSION TRANSACTION READ ONLY";

/** Una variable vacía significa "no configurado", no un nombre de base inválido. */
const emptyStringToUndefined = (value: unknown): unknown => (value === "" ? undefined : value);

/**
 * Solo valida el nombre de la base vieja.
 *
 * No entra al schema global: identidad puede arrancar sin esta variable.
 * El nombre no puede ser el del CRM nuevo, para no leer ni escribir `CRM_THINK_V2` por este pool.
 */
const legacyCrmEnvSchema = z
    .object({
        LEGACY_CRM_DB_NAME: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
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
    });

type LegacyCrmEnvConfig = z.infer<typeof legacyCrmEnvSchema>;

/**
 * Token de la conexión opcional.
 *
 * Es un `Symbol` para no chocar con el `DatabaseService` del CRM nuevo.
 */
export const LEGACY_CRM_DATABASE = Symbol("LEGACY_CRM_DATABASE");

/**
 * Lee `LEGACY_CRM_DB_NAME` sin mezclarla con la validación global de entorno.
 *
 * @param config - Configuración ya cargada por Nest
 * @throws {Error} Si el nombre está presente y apunta a la base del CRM nuevo
 */
const readLegacyCrmEnvConfig = (config: ConfigService): LegacyCrmEnvConfig => {
    const result = legacyCrmEnvSchema.safeParse({
        LEGACY_CRM_DB_NAME: config.get<string>("LEGACY_CRM_DB_NAME"),
    });

    if (!result.success) {
        throw new Error(`Configuracion legacy invalida: ${result.error.message}`);
    }

    return result.data;
};

/**
 * Arma el pool legacy.
 *
 * Host, usuario, clave y TLS salen de `DB_*`. Cambian la base y el límite de
 * conexiones. El modo solo lectura no va aquí: lo impone cada conexión al salir del pool.
 *
 * @param config - Configuración de entorno
 * @param database - Nombre ya validado de la base vieja
 */
export const buildLegacyPoolOptions = (config: ConfigService, database: string): PoolOptions => {
    const sslCaPath = config.get<string>("DB_SSL_CA");

    return buildMysqlPoolOptions({
        host: config.getOrThrow<string>("DB_HOST"),
        port: config.getOrThrow<number>("DB_PORT"),
        user: config.getOrThrow<string>("DB_USER"),
        password: config.getOrThrow<string>("DB_PASSWORD"),
        database,
        connectionLimit: LEGACY_CRM_CONNECTION_LIMIT,
        ssl: config.getOrThrow<boolean>("DB_SSL"),
        ...(sslCaPath ? { sslCaPath } : {}),
    });
};

/**
 * Marca cada conexión como transacción de solo lectura.
 *
 * Si el `SET SESSION` falla, la conexión se destruye. Dejarla en el pool
 * permitiría una consulta sobre una cuenta compartida que sí puede escribir.
 *
 * @param pool - Pool que todavía no ha entregado conexiones
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
 * Crea Kysely sin el esquema del CRM nuevo.
 *
 * Las columnas viejas no son el contrato canónico. El mapper de cada catálogo
 * es el límite: lo que sale de aquí todavía es `unknown`.
 */
const createLegacyKyselyDatabase = (poolOptions: PoolOptions): Kysely<unknown> => {
    const pool = createPool(poolOptions);
    registerLegacyReadOnlySession(pool);

    return new Kysely<unknown>({
        dialect: new MysqlDialect({ pool }),
    });
};

/**
 * Abre el pool solo cuando hay un nombre de base distinto al del CRM nuevo.
 *
 * @param config - Configuración de entorno
 * @returns Conexión de lectura, o `null` si el fallback no está configurado
 */
export const createLegacyCrmDatabase = (config: ConfigService): Kysely<unknown> | null => {
    const legacyConfig = readLegacyCrmEnvConfig(config);

    if (!legacyConfig.LEGACY_CRM_DB_NAME) {
        return null;
    }

    return createLegacyKyselyDatabase(buildLegacyPoolOptions(config, legacyConfig.LEGACY_CRM_DB_NAME));
};
