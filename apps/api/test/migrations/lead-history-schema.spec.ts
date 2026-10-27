import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { leadHistoryMigration, leadHistoryStatements } from "../../migrations/schema-only/202610230032_lead_history.js";
import { leadStageReasonsMigration } from "../../migrations/schema-only/202610230033_lead_stage_reasons.js";

function fixture(name = "CRM_THINK_V2", existing = false) {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const rows = query.sql.includes("DATABASE() AS name") ? [{ name }] : query.sql.includes("information_schema.TABLES") && existing ? [{ TABLE_NAME: "crm_lead_activity" }] : [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}

describe("history schema boundaries", () => {
    it("supports all non-lost transitions without assigning a generic loss reason", async () => {
        const f = fixture();
        try {
            await leadStageReasonsMigration.up(f.db);
            const mappings = f.queries.filter((query) => query.sql.startsWith("INSERT INTO conf_action_reason_status"));
            expect(mappings.map((query) => query.parameters[0])).toEqual(["interested", "opportunity", "pre_reservation", "reservation", "contract", "follow_up"]);
            expect(mappings.some((query) => query.parameters.includes("lost"))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects stage reason seeds against the old database", async () => {
        const f = fixture("crmdatabase-api");
        try {
            await expect(leadStageReasonsMigration.up(f.db)).rejects.toThrow();
            expect(f.queries).toHaveLength(1);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([
        ["crmdatabase-api", false],
        ["CRM_THINK_V2", true],
    ] as const)("rejects unsafe destination %s / existing=%s", async (name, existing) => {
        const f = fixture(name, existing);
        try {
            await expect(leadHistoryMigration.up(f.db)).rejects.toThrow();
            expect(f.queries.every((query) => query.sql.trim().startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("creates native structures only and documents every column", async () => {
        const f = fixture();
        try {
            await leadHistoryMigration.up(f.db);
            expect(f.queries.map((query) => query.sql).join("\n")).not.toMatch(/crmdatabase-api|INSERT INTO crm_lead\s|DROP TABLE|ALTER TABLE/);
            for (const statement of leadHistoryStatements) {
                expect(statement).toContain("COMMENT='");
                const columns = statement.split("\n").filter((line) => /^ {2}[a-z][a-z_]* (BIGINT|INT|CHAR|VARCHAR|ENUM|TEXT|DATETIME)/.test(line));
                expect(columns.length).toBeGreaterThan(0);
                expect(columns.every((column) => column.includes("COMMENT '"))).toBe(true);
            }
        } finally {
            await f.db.destroy();
        }
    });
    it("links evidence to the central audit and keeps original entry identity unique", () => {
        const ddl = leadHistoryStatements.join("\n");
        expect(ddl).toContain("UNIQUE KEY uq_history_source_entry (source_entry_id_lead_history_entry)");
        expect(ddl).toContain("REFERENCES audit_record_event(id_record_event)");
        expect(ddl).not.toContain("ON DELETE CASCADE");
    });
});
