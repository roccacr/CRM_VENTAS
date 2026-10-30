import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { legacyNoteContextSourceMigration } from "../../migrations/schema-only/202610270041_legacy_note_context_source.js";

function fixture(existing?: { name: string; status: string }, schema = "CRM_THINK_V2") {
    const queries: CompiledQuery[] = [];
    let row = existing;
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                if (query.sql.startsWith("INSERT INTO int_external_system")) row = { name: "CRM Legacy", status: "active" };
                const rows = query.sql.startsWith("SELECT DATABASE()") ? [{ name: schema }] : query.sql.startsWith("SELECT name_external_system") && row ? [row] : [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}

describe("legacy note context source metadata", () => {
    it("registers only the approved source metadata and safely replays", async () => {
        const f = fixture();
        try {
            await legacyNoteContextSourceMigration.up(f.db);
            await legacyNoteContextSourceMigration.up(f.db);
            const writes = f.queries.filter((query) => /^(INSERT|UPDATE|DELETE|CREATE|ALTER)/.test(query.sql));
            expect(writes).toHaveLength(1);
            expect(writes[0]?.sql).toMatch(/^INSERT INTO int_external_system /);
            expect(writes[0]?.parameters).toEqual(["legacy_crm", "CRM Legacy", "active", "legacy_crm"]);
            expect(f.queries.map((query) => query.sql).join("\n")).not.toMatch(/crmdatabase-api|crm_sales_order|crm_note|CREATE|ALTER|DELETE/);
            expect(f.queries.some((query) => query.sql.startsWith("UPDATE "))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([
        { name: "CRM Legacy", status: "inactive" },
        { name: "Other", status: "active" },
    ])("refuses conflicting existing metadata %j", async (existing) => {
        const f = fixture(existing);
        try {
            await expect(legacyNoteContextSourceMigration.up(f.db)).rejects.toThrow("explicit reconciliation");
            expect(f.queries.some((query) => /^(INSERT|UPDATE|DELETE)/.test(query.sql))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("refuses another schema before metadata access", async () => {
        const f = fixture(undefined, "other");
        try {
            await expect(legacyNoteContextSourceMigration.up(f.db)).rejects.toThrow("CRM_THINK_V2");
            expect(f.queries).toHaveLength(1);
        } finally {
            await f.db.destroy();
        }
    });
});
