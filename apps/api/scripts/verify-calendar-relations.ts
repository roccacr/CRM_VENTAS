import "dotenv/config";

import { createConnection } from "mysql2/promise";

import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";

/** Read-only deployment evidence: no fixtures, business writes, credentials or row contents. */
const connection = await createConnection(buildMysqlPoolOptions({ host: process.env.DB_HOST ?? "", port: Number(process.env.DB_PORT ?? 3306), user: process.env.DB_USER ?? "", password: process.env.DB_PASSWORD ?? "", database: process.env.DB_NAME ?? "", connectionLimit: 1, ssl: process.env.DB_SSL === "true", ...(process.env.DB_SSL_CA ? { sslCaPath: process.env.DB_SSL_CA } : {}) }));
try {
    if (process.env.DB_NAME !== "CRM_THINK_V2") throw new Error("Calendar verification requires CRM_THINK_V2");
    const [checks] = await connection.execute("SELECT CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND CONSTRAINT_NAME=?", ["CRM_THINK_V2", "ck_calendar_link_identity"]);
    const [counts] = await connection.query("SELECT (SELECT COUNT(*) FROM CRM_THINK_V2.crm_calendar_event) AS events,(SELECT COUNT(*) FROM CRM_THINK_V2.crm_calendar_event_link) AS links,(SELECT COUNT(*) FROM CRM_THINK_V2.crm_calendar_participant) AS participants");
    const [ledger] = await connection.execute("SELECT migration_name_schema_migration FROM CRM_THINK_V2.conf_schema_migration WHERE migration_name_schema_migration=?", ["202610290055_calendar_relations"]);
    console.log(JSON.stringify({ checks, counts, ledger }));
} finally {
    await connection.end();
}
