import { pathToFileURL } from "node:url";

import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";

import { assertStageMetadata, planStageColumns, planStageDurationView } from "../migrations/schema-only/202610260036_sales_order_stage_tracking.js";
import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";
import { readSchemaMigrationEnv } from "./run-schema-migrations.js";

/** Separate legacy-only preflight: no catalog writes, business rows or native FK. */
export async function planLegacyStageTracking(db: Kysely<unknown>): Promise<string[]> {
    if ((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name !== "crmdatabase-api") throw new Error("Legacy tracking requires exactly crmdatabase-api");
    const tables = await sql<Record<string, unknown>>`SELECT TABLE_NAME AS table_name, TABLE_TYPE AS table_type, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_sales_order_state_event'`.execute(db);
    assertStageMetadata(tables.rows, [{ table_name: "audit_sales_order_state_event", table_type: "BASE TABLE", engine: "InnoDB" }]);
    const actor = await sql<Record<string, unknown>>`SELECT COLUMN_TYPE AS column_type, IS_NULLABLE AS is_nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_sales_order_state_event' AND COLUMN_NAME='actor_reference_sales_order_state_event'`.execute(db);
    assertStageMetadata(actor.rows, [{ column_type: "varchar(180)", is_nullable: "YES" }]);
    const foreignKeys = await sql<Record<string, unknown>>`SELECT COLUMN_NAME AS column_name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_sales_order_state_event' AND COLUMN_NAME IN ('actor_snapshot_sales_order_state_event','responsible_reference_sales_order_state_event','responsible_snapshot_sales_order_state_event') AND REFERENCED_TABLE_NAME IS NOT NULL`.execute(db);
    assertStageMetadata(foreignKeys.rows, []);
    const additions = await planStageColumns(db, [
        { name: "actor_snapshot_sales_order_state_event", type: "json", comment: "Nombre y roles del actor en esta visita; sin secretos" },
        { name: "responsible_reference_sales_order_state_event", type: "varchar(180)", comment: "Referencia con sistema del responsable de esta visita; sin FK nativa" },
        { name: "responsible_snapshot_sales_order_state_event", type: "json", comment: "Nombre y roles del responsable en esta visita; sin secretos" },
    ]);
    const views = await planStageDurationView(db, "legacy");
    return [...(additions.length ? [`ALTER TABLE \`crmdatabase-api\`.audit_sales_order_state_event ${additions.join(", ")}`] : []), ...views];
}

/** Dry-run by default; caller must explicitly confirm the fixed legacy destination. */
export async function runLegacyStageTracking(db: Kysely<unknown>, apply: boolean): Promise<string[]> {
    const lock = await sql<{ acquired: number }>`SELECT GET_LOCK('legacy_sales_order_stage_tracking', 30) AS acquired`.execute(db);
    if (lock.rows[0]?.acquired !== 1) throw new Error("Legacy stage tracking lock unavailable");
    try {
        const statements = await planLegacyStageTracking(db);
        if (apply) for (const statement of statements) await sql.raw(statement).execute(db);
        return statements;
    } finally {
        await sql`SELECT RELEASE_LOCK('legacy_sales_order_stage_tracking')`.execute(db);
    }
}

async function runFromCli(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length !== 1 || !["--plan", "--apply=crmdatabase-api"].includes(args[0] ?? "")) throw new Error("Use exactly --plan or --apply=crmdatabase-api");
    await import("dotenv/config");
    // Reuse TLS/host validation without weakening the native runner's destination guard.
    const env = readSchemaMigrationEnv();
    const db = new Kysely<unknown>({ dialect: new MysqlDialect({ pool: createPool(buildMysqlPoolOptions({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: "crmdatabase-api", connectionLimit: 1, ssl: env.DB_SSL, ...(env.DB_SSL_CA ? { sslCaPath: env.DB_SSL_CA } : {}) })) }) });
    try {
        console.log((await runLegacyStageTracking(db, args[0] === "--apply=crmdatabase-api")).join(";\n"));
    } finally {
        await db.destroy();
    }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
    void runFromCli().catch(() => {
        console.error("Legacy stage tracking failed; inspect schema drift and configuration before retrying");
        process.exitCode = 1;
    });
