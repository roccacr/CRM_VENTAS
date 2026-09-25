import { pathToFileURL } from "node:url";

import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { z } from "zod";

import { identitySchemaMigration } from "../migrations/schema-only/202609250001_identity_schema.js";
import { addDatabaseTlsIssues, booleanEnvSchema, tcpPortSchema } from "../src/config/database-env.schema.js";
import { APPROVED_DATABASE_NAME } from "../src/config/product.constants.js";
import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";

const MYSQL_CONNECTION_LIMIT = 1;
const SCHEMA_MIGRATION_LOCK_NAME = "crm_think_v2_schema_migration";
const SCHEMA_MIGRATION_LOCK_TIMEOUT_SECONDS = 30;

type Migration = {
    name: string;
    up: (db: Kysely<unknown>) => Promise<void>;
};

const migrations: Migration[] = [identitySchemaMigration];
const isExecutedDirectly = (): boolean => (process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false);

/**
 * Carga `.env` solo para ejecucion CLI.
 *
 * Importar este archivo desde pruebas debe ser libre de efectos secundarios y
 * no debe cargar secretos reales en `process.env`.
 */
const runFromCli = async (): Promise<void> => {
    await import("dotenv/config");
    await run();
};

/**
 * Contrato estricto del runner schema-only.
 *
 * Es intencionalmente mas pequeno que el contrato completo del runtime: solo
 * valida variables `DB_*` y el doble candado de migracion. No debe depender de
 * CORS, cookies ni Microsoft para validar estructura.
 */
const schemaMigrationEnvSchema = z
    .object({
        DB_HOST: z.string().min(1),
        DB_PORT: tcpPortSchema.default(3306),
        DB_USER: z.string().min(1),
        DB_PASSWORD: z.string().default(""),
        DB_NAME: z.literal(APPROVED_DATABASE_NAME),
        DB_SSL: booleanEnvSchema("false"),
        DB_SSL_CA: z.string().min(1).optional(),
        MIGRATION_CONFIRM_SCHEMA_ONLY: z.literal(APPROVED_DATABASE_NAME),
    })
    .superRefine((config, context) => {
        addDatabaseTlsIssues(config, context);
    });

type SchemaMigrationEnv = z.infer<typeof schemaMigrationEnvSchema>;

/**
 * Valida variables del runner antes de abrir cualquier conexion.
 */
export const readSchemaMigrationEnv = (source: NodeJS.ProcessEnv = process.env): SchemaMigrationEnv => {
    const result = schemaMigrationEnvSchema.safeParse(source);

    if (!result.success) {
        throw new Error(`Configuracion de migracion invalida: ${result.error.message}`);
    }

    return result.data;
};

/**
 * Crea la conexion Kysely usada solo por migraciones schema-only.
 *
 * El doble candado es intencional. Un `.env` copiado debe nombrar
 * CRM_THINK_V2 dos veces antes de que este script toque una base de datos.
 */
const createDatabase = (): Kysely<unknown> => {
    const env = readSchemaMigrationEnv();
    const poolOptions = buildMysqlPoolOptions({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        connectionLimit: MYSQL_CONNECTION_LIMIT,
        ssl: env.DB_SSL,
        ...(env.DB_SSL_CA ? { sslCaPath: env.DB_SSL_CA } : {}),
    });

    const pool = createPool(poolOptions);

    return new Kysely<unknown>({
        dialect: new MysqlDialect({ pool }),
    });
};

/**
 * Asegura que exista el registro local de migraciones.
 *
 * Este registro pertenece a la herramienta de validacion, no a tablas de
 * negocio.
 */
const ensureMigrationTable = async (db: Kysely<unknown>): Promise<void> => {
    await sql`
    CREATE TABLE IF NOT EXISTS conf_schema_migration (
      id_schema_migration BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la migracion de esquema aplicada.',
      migration_name_schema_migration VARCHAR(180) NOT NULL COMMENT 'Nombre unico y estable de la migracion schema-only.',
      applied_at_schema_migration DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora en que se registro la migracion como aplicada.',
      PRIMARY KEY (id_schema_migration),
      UNIQUE KEY uq_conf_schema_migration_name (migration_name_schema_migration)
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
      COMMENT='Registro controlado de migraciones schema-only aplicadas al CRM.'
  `.execute(db);
};

/**
 * Serializa ejecuciones de validacion de esquema con un lock nombrado MySQL.
 */
const acquireLock = async (db: Kysely<unknown>): Promise<void> => {
    const result = await sql<{ lock_acquired: number | null }>`
    SELECT GET_LOCK(${SCHEMA_MIGRATION_LOCK_NAME}, ${SCHEMA_MIGRATION_LOCK_TIMEOUT_SECONDS}) AS lock_acquired
  `.execute(db);

    if (result.rows[0]?.lock_acquired !== 1) {
        throw new Error("No se pudo obtener el lock de migracion de esquema.");
    }
};

/**
 * Libera el lock asesor. Los callers ignoran fallos durante shutdown porque
 * cerrar la conexion tambien libera locks MySQL.
 */
const releaseLock = async (db: Kysely<unknown>): Promise<void> => {
    await sql`SELECT RELEASE_LOCK(${SCHEMA_MIGRATION_LOCK_NAME})`.execute(db);
};

/**
 * Revisa si una migracion schema-only ya fue registrada.
 */
const hasMigration = async (db: Kysely<unknown>, migrationName: string): Promise<boolean> => {
    const result = await sql<{ found_migration: number }>`
    SELECT COUNT(*) AS found_migration
    FROM conf_schema_migration
    WHERE migration_name_schema_migration = ${migrationName}
  `.execute(db);

    return (result.rows[0]?.found_migration ?? 0) > 0;
};

/**
 * Registra una migracion schema-only aplicada correctamente.
 */
const recordMigration = async (db: Kysely<unknown>, migrationName: string): Promise<void> => {
    await sql`
    INSERT INTO conf_schema_migration (migration_name_schema_migration)
    VALUES (${migrationName})
  `.execute(db);
};

/**
 * Ejecuta migraciones schema-only aprobadas.
 *
 * Este script debe seguir siendo explicito y manual. El arranque NestJS nunca
 * debe ejecutar migraciones automaticamente.
 */
const run = async (): Promise<void> => {
    const db = createDatabase();

    try {
        await acquireLock(db);
        await ensureMigrationTable(db);

        for (const migration of migrations) {
            if (await hasMigration(db, migration.name)) {
                console.log(`Migracion omitida porque ya esta aplicada: ${migration.name}`);
                continue;
            }

            console.log(`Aplicando migracion schema-only: ${migration.name}`);
            await migration.up(db);
            await recordMigration(db, migration.name);
            console.log(`Migracion schema-only aplicada: ${migration.name}`);
        }
    } finally {
        await releaseLock(db).catch(() => undefined);
        await db.destroy();
    }
};

if (isExecutedDirectly()) {
    void runFromCli().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Fallo la migracion de esquema: ${message}`);
        process.exit(1);
    });
}
