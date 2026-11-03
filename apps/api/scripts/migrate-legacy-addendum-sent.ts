import { pathToFileURL } from "node:url";

import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";

import { runAddendumSent } from "../migrations/schema-only/202611030072_formalization_addendum_sent.js";
import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";
import { readSchemaMigrationEnv } from "./run-schema-migrations.js";

/** Ninguna variante de --apply se acepta fuera del esquema legacy aprobado explícitamente. */
export function parseLegacyAddendumSentArgs(args: readonly string[]): boolean {
    if (args.length !== 1 || !["--plan", "--apply=crmdatabase-api"].includes(args[0] ?? "")) throw new Error("Use exactly --plan or --apply=crmdatabase-api");
    return args[0] === "--apply=crmdatabase-api";
}

/** Una conexión mantiene el lock; el ALTER amplía solo el estado sin cambiar datos comerciales. */
export async function runLegacyAddendumSent(db: Kysely<unknown>, apply: boolean): Promise<string[]> {
    return db.connection().execute(async (connection) => {
        const lock = (await sql<{ acquired: number }>`SELECT GET_LOCK('legacy_order_addendum_sent',10) AS acquired`.execute(connection)).rows[0];
        if (lock?.acquired !== 1) throw new Error("Legacy addendum lock unavailable");
        try {
            const statements = await runAddendumSent(connection, "legacy", apply);
            // MySQL confirma DDL implícitamente; nunca se presenta este cambio como reversible por ROLLBACK.

            return statements;
        } finally {
            await sql`SELECT RELEASE_LOCK('legacy_order_addendum_sent')`.execute(connection);
        }
    });
}

async function runFromCli(): Promise<void> {
    const apply = parseLegacyAddendumSentArgs(process.argv.slice(2));
    await import("dotenv/config");
    const env = readSchemaMigrationEnv();
    const db = new Kysely<unknown>({ dialect: new MysqlDialect({ pool: createPool(buildMysqlPoolOptions({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: "crmdatabase-api", connectionLimit: 1, ssl: env.DB_SSL, ...(env.DB_SSL_CA ? { sslCaPath: env.DB_SSL_CA } : {}) })) }) });
    try {
        await sql`SET SESSION lock_wait_timeout=10`.execute(db);
        console.log(JSON.stringify({ database: "crmdatabase-api", applied: apply, statements: await runLegacyAddendumSent(db, apply) }));
    } finally {
        await db.destroy();
    }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
    void runFromCli().catch(() => {
        console.error("Legacy addendum migration failed; inspect schema metadata before retrying.");
        process.exitCode = 1;
    });
