import { pathToFileURL } from "node:url";

import { Kysely, MysqlDialect } from "kysely";
import { createPool } from "mysql2";

import { runLeadQualification } from "../migrations/schema-only/202611030073_lead_qualification.js";
import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";
import { readSchemaMigrationEnv } from "./run-schema-migrations.js";

/** Legacy schema changes always require the exact explicit apply argument. */
export function parseLegacyLeadQualificationArgs(args: readonly string[]): boolean {
    if (args.length !== 1 || !["--plan", "--apply=crmdatabase-api"].includes(args[0] ?? "")) throw new Error("Use exactly --plan or --apply=crmdatabase-api");
    return args[0] === "--apply=crmdatabase-api";
}
async function runFromCli(): Promise<void> {
    const apply = parseLegacyLeadQualificationArgs(process.argv.slice(2));
    await import("dotenv/config");
    const env = readSchemaMigrationEnv();
    const db = new Kysely<unknown>({ dialect: new MysqlDialect({ pool: createPool(buildMysqlPoolOptions({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: "crmdatabase-api", connectionLimit: 1, ssl: env.DB_SSL, ...(env.DB_SSL_CA ? { sslCaPath: env.DB_SSL_CA } : {}) })) }) });
    try {
        console.log(JSON.stringify({ database: "crmdatabase-api", applied: apply, statements: await runLeadQualification(db, "legacy", apply) }));
    } finally {
        await db.destroy();
    }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
    void runFromCli().catch(() => {
        console.error("Legacy lead qualification migration failed; inspect schema metadata before retrying.");
        process.exitCode = 1;
    });
