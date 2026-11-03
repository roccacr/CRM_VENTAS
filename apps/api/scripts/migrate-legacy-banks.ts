import { pathToFileURL } from "node:url";

import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";

import { planBankTables } from "../migrations/schema-only/banks-schema.js";
import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";
import { readSchemaMigrationEnv } from "./run-schema-migrations.js";

/** Sin destino exacto explicito no conecta ni modifica tablas. */
export function parseLegacyBanksArgs(args: readonly string[]): boolean {
    if (args.length !== 1 || !["--plan", "--apply=crmdatabase-api"].includes(args[0] ?? "")) throw new Error("Use exactly --plan or --apply=crmdatabase-api");
    return args[0] === "--apply=crmdatabase-api";
}

/** CLI aislado del runner nativo; plan solo inspecciona, apply crea unicamente tablas ausentes compatibles. */
export async function runLegacyBanks(db: Kysely<unknown>, apply: boolean): Promise<string[]> {
    return db.connection().execute(async (connection) => {
        const lock = (await sql<{ acquired: number }>`SELECT GET_LOCK('legacy_banks_schema_068',10) AS acquired`.execute(connection)).rows[0];
        if (lock?.acquired !== 1) throw new Error("Legacy banks migration lock unavailable");
        try {
            await sql`SET SESSION lock_wait_timeout=10`.execute(connection);
            const statements = await planBankTables(connection, "crmdatabase-api");
            if (apply) {
                await sql`SET SESSION time_zone='+00:00'`.execute(connection);
                for (const statement of statements) await sql.raw(statement).execute(connection);
            }
            return statements;
        } finally {
            await sql`SELECT RELEASE_LOCK('legacy_banks_schema_068')`.execute(connection);
        }
    });
}

async function runFromCli(): Promise<void> {
    const apply = parseLegacyBanksArgs(process.argv.slice(2));
    await import("dotenv/config");
    const env = readSchemaMigrationEnv();
    const db = new Kysely<unknown>({ dialect: new MysqlDialect({ pool: createPool(buildMysqlPoolOptions({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: "crmdatabase-api", connectionLimit: 1, ssl: env.DB_SSL, ...(env.DB_SSL_CA ? { sslCaPath: env.DB_SSL_CA } : {}) })) }) });
    try {
        console.log(JSON.stringify({ database: "crmdatabase-api", applied: apply, statements: await runLegacyBanks(db, apply) }));
    } finally {
        await db.destroy();
    }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
    void runFromCli().catch(() => {
        console.error("Legacy banks migration failed; inspect schema metadata before retrying.");
        process.exitCode = 1;
    });
