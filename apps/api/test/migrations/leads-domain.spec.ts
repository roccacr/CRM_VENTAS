import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { leadsDomainMigration, leadStatements, leadTimestampStatements } from "../../migrations/schema-only/202610230031_leads_domain.js";

/** Compile the migration without opening a connection or inserting shared fixtures. */
function fixture(databaseName = "CRM_THINK_V2", existing = false) {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const rows = query.sql.includes("DATABASE() AS name") ? [{ name: databaseName }] : query.sql.includes("information_schema.TABLES") && existing ? [{ table_name: "crm_lead" }] : [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}

describe("native lead schema", () => {
    it.each(["crmdatabase-api", "other"])("rejects destination %s before writes", async (name) => {
        const f = fixture(name);
        try {
            await expect(leadsDomainMigration.up(f.db)).rejects.toThrow();
            expect(f.queries).toHaveLength(1);
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects existing unledgered tables before any mutation", async () => {
        const f = fixture("CRM_THINK_V2", true);
        try {
            await expect(leadsDomainMigration.up(f.db)).rejects.toThrow("Existing lead tables");
            expect(f.queries.every((query) => query.sql.trim().startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("creates only native structures and the seven approved stages", async () => {
        const f = fixture();
        try {
            await leadsDomainMigration.up(f.db);
            const all = f.queries.map((query) => query.sql).join("\n");
            expect(all).not.toMatch(/crmdatabase-api|INSERT INTO crm_|INSERT INTO sec_|UPDATE sec_|DROP |ALTER /i);
            expect(all).toContain("FOREIGN KEY (owner_user_id_lead) REFERENCES sec_user(id_user)");
            expect(all).toContain("external_system_id_lead_external_reference,external_id_lead_external_reference");
            const stages = f.queries.filter((query) => query.sql.startsWith("INSERT INTO conf_lead_status"));
            expect(stages.map((query) => query.parameters[0])).toEqual(["interested", "opportunity", "pre_reservation", "reservation", "contract", "lost", "follow_up"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("documents every physical column and table", () => {
        for (const statement of leadStatements) {
            expect(statement).toMatch(/COMMENT='[^']+'/);
            const columns = statement.split("\n").filter((line) => /^ {2}[a-z][a-z0-9_]* (?:BIGINT|CHAR|VARCHAR|TEXT|ENUM|DATETIME|INT|TINYINT|SMALLINT)/.test(line));
            expect(columns.length).toBeGreaterThan(0);
            for (const column of columns) expect(column).toContain("COMMENT '");
        }
    });
    it("keeps every transition, enforces applicable reasons, and preserves unknown historical dates", () => {
        const ddl = leadStatements.join("\n");
        expect(ddl).toContain("UNIQUE KEY uq_lead_event_sequence (lead_id_lead_status_event,sequence_lead_status_event)");
        expect(ddl).toContain("UNIQUE KEY uq_lead_event_operation (lead_id_lead_status_event,operation_id_lead_status_event)");
        expect(ddl).toContain("REFERENCES conf_action_reason_status(status_code_action_reason_status,reason_code_action_reason_status)");
        expect(ddl).toContain("reason_code_lead_status_event IS NOT NULL");
        expect(ddl).toContain("occurred_at_lead_status_event DATETIME(3) NULL");
        expect(ddl).not.toContain("UNIQUE KEY uq_lead_loss");
    });
    it("updates modification times in UTC independently of session timezone", () => {
        expect(leadTimestampStatements.length).toBeGreaterThan(0);
        for (const statement of leadTimestampStatements) expect(statement).toMatch(/BEFORE UPDATE ON .*UTC_TIMESTAMP\(3\)/);
    });
});
