import { pathToFileURL } from "node:url";

import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";

import { planBankingInProgressStage, planPurchaseFundsColumn } from "../migrations/schema-only/202611020062_formalization_purchase_funds.js";
import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";
import { readSchemaMigrationEnv } from "./run-schema-migrations.js";

/** Esquema legacy autorizado explícitamente; no cambia valores ni el runner exclusivo de la BD nueva. */
export async function runLegacyPurchaseFunds(db: Kysely<unknown>, apply: boolean): Promise<string[]> {
    const lock = (await sql<{ acquired: number }>`SELECT GET_LOCK('legacy_purchase_funds',10) AS acquired`.execute(db)).rows[0];
    if (lock?.acquired !== 1) throw new Error("Legacy purchase funds lock unavailable");
    try {
        const statements = await planPurchaseFundsColumn(db, "legacy");
        const stageStatements = await planBankingInProgressStage(db, "legacy");
        if (apply) for (const statement of statements) await sql.raw(statement).execute(db);
        if (apply)
            await db.transaction().execute(async (tx) => {
                for (const statement of stageStatements) await sql.raw(statement).execute(tx);
            });
        return [...statements, ...stageStatements];
    } finally {
        await sql`SELECT RELEASE_LOCK('legacy_purchase_funds')`.execute(db);
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
        console.log(JSON.stringify({ database: "crmdatabase-api", applied: args[0] === "--apply=crmdatabase-api", statements: await runLegacyPurchaseFunds(db, args[0] === "--apply=crmdatabase-api") }));
    } finally {
        await db.destroy();
    }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
    void runFromCli().catch(() => {
        console.error("Legacy purchase funds migration failed; inspect schema metadata before retrying.");
        process.exitCode = 1;
    });
