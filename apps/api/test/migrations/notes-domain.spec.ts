import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { loadNotesStatements, notesDomainMigration } from "../../migrations/schema-only/202610270039_notes_domain.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";

function fixture(name = "CRM_THINK_V2", existing = false, parents = true) {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const rows = query.sql.includes("DATABASE() AS name") ? [{ name }] : query.sql.includes("information_schema.COLUMNS") ? (parents ? ["sec_user", "int_external_system", "crm_contact", "crm_lead", "crm_sales_order", "crm_calendar_event"].map((table_name) => ({ table_name })) : []) : query.sql.includes("information_schema.TABLES") && existing ? [{ table_name: "crm_note" }] : [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}

describe("notes foundation, stage one only", () => {
    it("rejects missing native parent keys before creating tables", async () => {
        const f = fixture("CRM_THINK_V2", false, false);
        try {
            await expect(notesDomainMigration.up(f.db)).rejects.toThrow("native InnoDB parent keys");
            expect(f.queries.every((q) => q.sql.trim().startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["crmdatabase-api", "other"])("rejects %s before DDL", async (name) => {
        const f = fixture(name);
        try {
            await expect(notesDomainMigration.up(f.db)).rejects.toThrow("CRM_THINK_V2");
            expect(f.queries).toHaveLength(1);
        } finally {
            await f.db.destroy();
        }
    });
    it("refuses existing tables instead of adopting partial DDL", async () => {
        const f = fixture("CRM_THINK_V2", true);
        try {
            await expect(notesDomainMigration.up(f.db)).rejects.toThrow("Existing notes tables");
            expect(f.queries.every((q) => q.sql.trim().startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("is selected independently and creates seven empty tables without grants or imports", async () => {
        expect(selectSchemaMigrations(notesDomainMigration.name)).toEqual([notesDomainMigration]);
        const f = fixture();
        try {
            await notesDomainMigration.up(f.db);
            const ddl = f.queries.map((q) => q.sql).join("\n");
            expect(ddl.match(/CREATE TABLE /g)).toHaveLength(7);
            expect(ddl).not.toMatch(/^\s*(?:INSERT|DELETE|DROP|ALTER)\s|crmdatabase-api|UPDATE sec_/im);
        } finally {
            await f.db.destroy();
        }
    });
    it("documents every column, including generated uniqueness keys, and uses UTC", async () => {
        for (const ddl of await loadNotesStatements()) {
            expect(ddl).toMatch(/COMMENT='[^']+'/);
            for (const line of ddl.split("\n").filter((entry) => /^ {2}[a-z][a-z0-9_]* (?:BIGINT|CHAR|VARCHAR|TEXT|JSON|DATETIME|INT|DECIMAL|TINYINT)/.test(entry))) expect(line).toContain("COMMENT '");
            expect(ddl).toContain("UTC_TIMESTAMP(3)");
        }
    });
    it("constrains recorded author actions, reply references in one note and mentions separate from access", async () => {
        const ddl = (await loadNotesStatements()).join("\n");
        expect(ddl).toContain("REFERENCES sec_user(id_user)");
        expect(ddl).toContain("REFERENCES crm_note_reply(id_note_reply,note_id_note_reply)");
        expect(ddl).toContain("uq_note_participant_user");
        expect(ddl).toContain("uq_note_mention_message");
        expect(ddl).toContain("ck_note_author_actions");
        expect(ddl).not.toContain("CREATE TRIGGER");
    });
    it("supports Home without a fake entity and real native FKs with source-qualified external links", async () => {
        const ddl = (await loadNotesStatements()).join("\n");
        for (const target of ["crm_contact(id_contact)", "crm_lead(id_lead)", "crm_sales_order(id_sales_order)", "crm_calendar_event(id_calendar_event)", "int_external_system(id_external_system)"]) expect(ddl).toContain(`REFERENCES ${target}`);
        expect(ddl).toContain("ck_note_link_target");
        expect(ddl).not.toMatch(/netsuite|odoo|crm_stick_notes/i);
    });
    it("separates per-user placement from content and reserves references without delivery runtime", async () => {
        const ddl = (await loadNotesStatements()).join("\n");
        for (const key of ["uq_note_placement_user_context", "anchor_mode_note_placement", "layout_version_note_placement", "uq_note_external_identity", "synced_version_note_external_reference", "archived_at_note"]) expect(ddl).toContain(key);
        expect(ddl).not.toMatch(/CREATE TABLE.*(?:notification|outbox)/i);
    });
});
