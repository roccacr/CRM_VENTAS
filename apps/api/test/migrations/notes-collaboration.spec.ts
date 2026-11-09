import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { notesCollaborationMigration } from "../../migrations/schema-only/202610270044_notes_collaboration.js";
import { anyOf } from "../support/throws.js";
function fixture(options: { destination?: string; ledger?: boolean; partial?: boolean; missing?: boolean; conflict?: boolean } = {}) {
    const queries: CompiledQuery[] = [];
    const routes = [
        { match: "DATABASE() AS name", rows: [{ name: options.destination ?? "CRM_THINK_V2" }] },
        { match: "FROM conf_schema_migration", rows: options.ledger === false ? [] : [{ name: "202610270040_notes_commands" }] },
        { match: "UNION ALL", rows: options.partial ? [{ name: "sec_notification" }] : [] },
        { match: "TABLE_TYPE", rows: options.missing ? [] : ["crm_note", "int_event_outbox", "sec_user", "sec_permission"].map((name) => ({ name })) },
        { match: "FROM sec_permission", rows: options.conflict ? [{ code: "ventas.notes.reply", module: "ventas", action: "reply", description: "wrong", status: "inactive" }] : [] },
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
describe("schema044 collaboration migration", () => {
    it.each([{ destination: "legacy" }, { ledger: false }, { partial: true }, { missing: true }, { conflict: true }])("fails closed before DDL for %j", async (options) => {
        const f = fixture(options);
        await expect(notesCollaborationMigration.up(f.db)).rejects.toThrow(anyOf("Collaboration requires CRM_THINK_V2", "Collaboration requires registered foundation 040", "Partial collaboration schema requires explicit recovery", "Missing collaboration dependencies", "Conflicting notes collaboration permissions"));
        expect(f.queries.every((q) => q.sql.startsWith("SELECT"))).toBe(true);
        await f.db.destroy();
    });
    it("adds only schema and twenty permission definitions without grants or content", async () => {
        const f = fixture();
        await notesCollaborationMigration.up(f.db);
        expect(f.queries.filter((q) => q.sql.startsWith("INSERT INTO sec_permission"))).toHaveLength(20);
        const sql = f.queries.map((q) => q.sql).join(" ");
        expect(sql).not.toMatch(/INSERT INTO crm_note|sec_role_permission|sec_user_permission|legacy|CREATE TRIGGER/);
        expect(sql).toContain("collaboration_version_note");
        await f.db.destroy();
    });
});
