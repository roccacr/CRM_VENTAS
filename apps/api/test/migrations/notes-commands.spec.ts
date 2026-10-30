import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { loadNotesCommandsStatements, notesCommandsMigration } from "../../migrations/schema-only/202610270040_notes_commands.js";

const dependencies = ["crm_note", "crm_note_reply", "crm_note_participant", "crm_note_mention", "crm_note_link", "crm_note_placement", "int_note_external_reference", "sec_user", "sec_permission"];
function fixture(options: { name?: string; missing?: boolean; partial?: boolean; column?: boolean; count?: number; conflict?: boolean; missingLedger?: boolean }) {
    const queries: CompiledQuery[] = [];
    const routes = [
        { match: "FROM conf_schema_migration", rows: options.missingLedger ? [] : [{ name: "202610270039_notes_domain" }] },
        { match: "DATABASE() AS name", rows: [{ name: options.name ?? "CRM_THINK_V2" }] },
        { match: "information_schema.COLUMNS", rows: options.column ? [{ column_name: "origin_module_code_note" }] : [] },
        { match: "TABLE_TYPE", rows: options.missing ? [] : dependencies.map((table_name) => ({ table_name })) },
        { match: "information_schema.TABLES", rows: options.partial ? [{ table_name: "int_note_command" }] : [] },
        { match: "COUNT(*)", rows: [{ count: options.count ?? 0 }] },
        { match: "FROM sec_permission", rows: options.conflict ? [{ code: "ventas.notes.read", module: "ventas", action: "read", description: "otra", status: "inactive" }] : [] },
    ];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const rows = routes.find((route) => query.sql.includes(route.match))?.rows ?? [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}
describe("notes commands stage two migration", () => {
    it.each([{ name: "legacy" }, { missing: true }, { partial: true }, { column: true }, { count: 1 }, { conflict: true }])("rejects unsafe preflight %j before DDL", async (options) => {
        const f = fixture(options);
        try {
            await expect(notesCommandsMigration.up(f.db)).rejects.toThrow();
            expect(f.queries.every((query) => query.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects an unregistered partial foundation before DDL", async () => {
        const f = fixture({ missingLedger: true });
        try {
            await expect(notesCommandsMigration.up(f.db)).rejects.toThrow("registered foundation 039");
            expect(f.queries.every((q) => q.sql.trim().startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("creates durable receipts, outbox and 25 permissions without grants or legacy access", async () => {
        const f = fixture({});
        try {
            await notesCommandsMigration.up(f.db);
            const inserts = f.queries.filter((query) => query.sql.startsWith("INSERT INTO sec_permission"));
            expect(inserts).toHaveLength(25);
            const modules = ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"];
            const actions = ["read", "create", "edit_own", "resolve_own", "archive_own"];
            expect(inserts.map((query) => query.parameters[0])).toEqual(modules.flatMap((module) => actions.map((action) => `${module}.notes.${action}`)));
            for (const query of inserts) {
                expect(query.parameters[0]).toBe(`${String(query.parameters[1])}.notes.${String(query.parameters[2])}`);
                expect(query.parameters[3]).toMatch(/notas.*requiere autoria y acceso vigente/);
                expect(query.parameters[4]).toBe("active");
            }
            const ddl = f.queries.map((query) => query.sql).join("\n");
            expect(ddl.match(/CREATE TABLE /g)).toHaveLength(2);
            expect(ddl).not.toMatch(/CREATE TRIGGER|sec_role_permission|sec_user_permission|crmdatabase-api|crm_stick_notes|ON DUPLICATE|UPDATE sec_permission/i);
        } finally {
            await f.db.destroy();
        }
    });
    it("fixes module, uniqueness, minimal payloads and documented UTC columns", async () => {
        const statements = await loadNotesCommandsStatements();
        expect(statements).toHaveLength(3);
        const ddl = statements.join("\n");
        for (const key of ["origin_module_code_note", "uq_note_command_actor_operation", "uq_event_outbox_aggregate_destination", "ix_event_outbox_pending", "'pending','processing','delivered','failed'", "'ventas','mercadeo','formalizacion','contabilidad','administration'", "REFERENCES sec_user(id_user)"]) expect(ddl).toContain(key);
        expect(ddl).not.toMatch(/content_note_command|pending_note_command|IF NOT EXISTS|CREATE TRIGGER/);
        for (const line of ddl.split("\n").filter((entry) => /^ {2}(?:ADD COLUMN )?[a-z][a-z0-9_]* (?:BIGINT|CHAR|VARCHAR|JSON|DATETIME|INT)/.test(entry))) expect(line).toContain("COMMENT '");
        expect(ddl.match(/UTC_TIMESTAMP\(3\)/g)).toHaveLength(4);
    });
});
