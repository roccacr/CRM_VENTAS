import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it } from "vitest";

import { calendarRelationsMigration } from "../../migrations/schema-only/202610290055_calendar_relations.js";

const mysqlCheck = "(regexp_like(`entity_type_calendar_event_link`,_utf8mb4'^[a-z][a-z0-9_]*$') and (((`source_calendar_event_link` = _utf8mb4'native') and regexp_like(`entity_public_id_calendar_event_link`,_utf8mb4'^[0-7][0-9A-HJKMNP-TV-Z]{25}$')) or ((`source_calendar_event_link` = _utf8mb4'legacy') and (`entity_type_calendar_event_link` in (_utf8mb4'lead',_utf8mb4'sales_order')) and regexp_like(`entity_public_id_calendar_event_link`,_utf8mb4'^[1-9][0-9]{0,19}$'))))";

function fixture(partial = false, drift = false, clause?: string) {
    const queries: string[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = () =>
        Promise.resolve({
            // A bounded metadata response map exercises migration preflight and recovery.
            // eslint-disable-next-line complexity
            executeQuery: <R>(q: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(q.sql);
                let rows: object[] = [];
                if (q.sql.includes("DATABASE() AS name")) rows = [{ name: "CRM_THINK_V2" }];
                if (q.sql.includes("FROM conf_schema_migration")) rows = [{ migration: "051" }];
                if (q.sql.includes("SELECT COLUMN_NAME FROM")) rows = partial ? [{ name: "source_calendar_event_link" }] : [];
                if (q.sql.includes("COLUMN_TYPE AS kind"))
                    rows = [
                        { name: "source_calendar_event_link", kind: "enum('native','legacy')", nullable: "NO", defaultValue: "native" },
                        { name: "entity_public_id_calendar_event_link", kind: "varchar(160)", nullable: "NO", collation: "ascii_bin" },
                    ];
                if (q.sql.includes("GROUP_CONCAT")) rows = [{ columns: drift ? "wrong" : "event_id_calendar_event_link,entity_type_calendar_event_link,source_calendar_event_link,entity_public_id_calendar_event_link", nonUnique: 0 }];
                if (q.sql.includes("CHECK_CLAUSE")) rows = [{ enforced: "YES", clause: clause ?? "entity_type_calendar_event_link REGEXP '^[a-z][a-z0-9_]*$' AND ((source_calendar_event_link='native' AND entity_public_id_calendar_event_link REGEXP '^[0-7][0-9A-HJKMNP-TV-Z]{25}$') OR (source_calendar_event_link='legacy' AND entity_type_calendar_event_link IN ('lead','sales_order') AND entity_public_id_calendar_event_link REGEXP '^[1-9][0-9]{0,19}$'))" }];
                return Promise.resolve({ rows: rows as R[] });
            },
            async *streamQuery() {
                yield await Promise.resolve({ rows: [] });
            },
        });
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}
it.each([false, true])("verifies source identity metadata for new or interrupted DDL (%s)", async (partial) => {
    const f = fixture(partial);
    try {
        await calendarRelationsMigration.up(f.db);
        expect(f.queries.filter((q) => q.startsWith("ALTER TABLE"))).toHaveLength(partial ? 0 : 1);
        expect(f.queries.some((q) => /^(INSERT|UPDATE|DELETE|DROP TABLE)/.test(q))).toBe(false);
    } finally {
        await f.db.destroy();
    }
});
it("rejects interrupted schema identity drift without changing data", async () => {
    const f = fixture(true, true);
    try {
        await expect(calendarRelationsMigration.up(f.db)).rejects.toThrow("unique identity drift");
    } finally {
        await f.db.destroy();
    }
});

it.each([mysqlCheck, mysqlCheck.replaceAll("'", "\\'"), mysqlCheck.replaceAll("'", "\\\\'")])("accepts the exact real MySQL check representation without DDL", async (clause) => {
    const f = fixture(true, false, clause);
    try {
        await calendarRelationsMigration.up(f.db);
        expect(f.queries.some((q) => q.startsWith("ALTER TABLE"))).toBe(false);
    } finally {
        await f.db.destroy();
    }
});
it.each([mysqlCheck.replace(" and ", " or "), mysqlCheck.replace("{25}", "{26}"), mysqlCheck.replace("'lead',_utf8mb4'sales_order'", "'note',_utf8mb4'sales_order'")])("rejects changed check semantics %s", async (clause) => {
    const f = fixture(true, false, clause);
    try {
        await expect(calendarRelationsMigration.up(f.db)).rejects.toThrow("check drift");
    } finally {
        await f.db.destroy();
    }
});
