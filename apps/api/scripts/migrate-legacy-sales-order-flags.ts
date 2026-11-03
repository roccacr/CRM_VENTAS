import { pathToFileURL } from "node:url";

import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";

import { applySalesOrderFlags, planSalesOrderFlags } from "../migrations/schema-only/202610300057_sales_order_operational_flags.js";
import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";
import { readSchemaMigrationEnv } from "./run-schema-migrations.js";

/** Explicit legacy schema-only addition; no business updates, backfill, triggers or grants. */
export async function runLegacySalesOrderFlags(db: Kysely<unknown>, apply: boolean): Promise<string[]> {
    const lock = await sql<{ acquired: number }>`SELECT GET_LOCK('legacy_sales_order_operational_flags', 10) AS acquired`.execute(db);
    if (lock.rows[0]?.acquired !== 1) throw new Error("Legacy sales order flags lock unavailable");
    try {
        return apply ? await applySalesOrderFlags(db, "legacy") : await planSalesOrderFlags(db, "legacy");
    } finally {
        await sql`SELECT RELEASE_LOCK('legacy_sales_order_operational_flags')`.execute(db);
    }
}

async function runFromCli(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length !== 1 || !["--plan", "--apply=crmdatabase-api"].includes(args[0] ?? "")) throw new Error("Use exactly --plan or --apply=crmdatabase-api");
    await import("dotenv/config");
    const env = readSchemaMigrationEnv();
    const db = new Kysely<unknown>({ dialect: new MysqlDialect({ pool: createPool(buildMysqlPoolOptions({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: "crmdatabase-api", connectionLimit: 1, ssl: env.DB_SSL, ...(env.DB_SSL_CA ? { sslCaPath: env.DB_SSL_CA } : {}) })) }) });
    try {
        await sql`SET SESSION lock_wait_timeout=10`.execute(db);
        console.log(JSON.stringify({ migration: "202610300057_sales_order_operational_flags", database: "crmdatabase-api", applied: args[0] === "--apply=crmdatabase-api", statements: await runLegacySalesOrderFlags(db, args[0] === "--apply=crmdatabase-api") }, null, 2));
    } finally {
        await db.destroy();
    }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
    void runFromCli().catch(() => {
        console.error("Legacy flags migration failed; inspect schema metadata before retrying. Existing business values were not updated.");
        process.exitCode = 1;
    });
