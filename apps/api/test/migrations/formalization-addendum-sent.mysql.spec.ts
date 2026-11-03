import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { describe, expect, it } from "vitest";

import { formalizationAddendumSentMigration, planAddendumSent } from "../../migrations/schema-only/202611030072_formalization_addendum_sent.js";
import { runLegacyAddendumSent } from "../../scripts/migrate-legacy-addendum-sent.js";
const enabled = process.env.RUN_ADDENDUM_SENT_MYSQL_QA === "3311";
const connect = (database: string) => new Kysely<unknown>({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3311, user: "root", password: "", database, connectionLimit: 1 }) }) });
// Coordinator owns original065 fixtures. This suite cannot use an .env or remote host.
describe.skipIf(!enabled)("072 fixed loopback3311 SQL compatibility", () => {
    it("preserves original column metadata and records on both sources, with safe retries", async () => {
        for (const source of ["native", "legacy"] as const) {
            const db = connect(source === "native" ? "CRM_THINK_V2" : "crmdatabase-api");
            const table = { native: "crm_sales_order", legacy: "ordenventa" }[source];
            const column = { native: "addendum_status_sales_order", legacy: "estado_adendum_ov" }[source];
            try {
                const readMetadata = async () => (await sql<Record<string, unknown>>`SELECT COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,CHARACTER_SET_NAME,COLLATION_NAME,COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table} AND COLUMN_NAME=${column}`.execute(db)).rows[0];
                const before = await readMetadata();
                const countBefore = (await sql.raw<{ count: number }>(`SELECT COUNT(*) AS count FROM \`${table}\``).execute(db)).rows[0]?.count;
                await (source === "native" ? formalizationAddendumSentMigration.up(db) : runLegacyAddendumSent(db, true));
                expect(await readMetadata()).toEqual({ ...before, COLUMN_TYPE: "enum('pending','completed','cancelled','sent')" });
                expect((await sql.raw<{ count: number }>(`SELECT COUNT(*) AS count FROM \`${table}\``).execute(db)).rows[0]?.count).toBe(countBefore);
                await (source === "native" ? formalizationAddendumSentMigration.up(db) : runLegacyAddendumSent(db, true));
                expect(await planAddendumSent(db, source)).toEqual([]);
                // Evaluate every literal ordinal without inserting business records.
                expect((await sql.raw<{ value: string; ordinal: number }>(`SELECT \`${column}\` AS value,\`${column}\`+0 AS ordinal FROM \`${table}\` WHERE \`${column}\` IS NOT NULL`).execute(db)).rows.every((row) => ["pending", "completed", "cancelled", "sent"][row.ordinal - 1] === row.value)).toBe(true);
            } finally {
                await db.destroy();
            }
        }
    });
});
