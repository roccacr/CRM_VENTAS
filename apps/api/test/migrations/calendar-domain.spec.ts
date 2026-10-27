import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { calendarDomainMigration, calendarTimestampStatements, loadCalendarStatements } from "../../migrations/schema-only/202610230034_calendar_domain.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";

function fixture(name = "CRM_THINK_V2", existing = false) {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const rows = query.sql.includes("DATABASE() AS name") ? [{ name }] : query.sql.includes("information_schema.TABLES") && existing ? [{ table_name: "crm_calendar_event" }] : [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}

describe("native calendar schema only", () => {
    it.each(["crmdatabase-api", "other"])("rejects destination %s before mutation", async (name) => {
        const f = fixture(name);
        try {
            await expect(calendarDomainMigration.up(f.db)).rejects.toThrow("CRM_THINK_V2");
            expect(f.queries).toHaveLength(1);
        } finally {
            await f.db.destroy();
        }
    });
    it("refuses partially existing tables without silently adopting them", async () => {
        const f = fixture("CRM_THINK_V2", true);
        try {
            await expect(calendarDomainMigration.up(f.db)).rejects.toThrow("Existing calendar tables");
            expect(f.queries.every((q) => q.sql.trim().startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("is individually selectable and creates eight empty tables without imports or grants", async () => {
        expect(selectSchemaMigrations(calendarDomainMigration.name)).toEqual([calendarDomainMigration]);
        const f = fixture();
        try {
            await calendarDomainMigration.up(f.db);
            const statements = f.queries.map((q) => q.sql).join("\n");
            expect(statements).not.toMatch(/crmdatabase-api|INSERT |UPDATE sec_|DROP |ALTER /i);
            expect(statements.match(/CREATE TABLE /g)).toHaveLength(8);
        } finally {
            await f.db.destroy();
        }
    });
    it("documents every column and table, with UTC timestamps and public identities", async () => {
        for (const statement of await loadCalendarStatements()) {
            expect(statement).toMatch(/COMMENT='[^']+'/);
            const columns = statement.split("\n").filter((line) => /^ {2}[a-z][a-z0-9_]* (?:BIGINT|BINARY|CHAR|VARCHAR|TEXT|DATETIME|INT|TINYINT|SMALLINT)/.test(line));
            expect(columns.length).toBeGreaterThan(0);
            for (const column of columns) expect(column).toContain("COMMENT '");
        }
    });
    it("enforces native ownership, module-compatible types and chronological intervals", async () => {
        const ddl = (await loadCalendarStatements()).join("\n");
        expect(ddl).toContain("REFERENCES sec_user(id_user)");
        expect(ddl).toContain("REFERENCES sec_org_unit(id_org_unit)");
        expect(ddl).toContain("REFERENCES conf_calendar_event_type(id_calendar_event_type,module_id_calendar_event_type)");
        expect(ddl).toContain("ends_at_calendar_event > starts_at_calendar_event");
        expect(ddl).not.toMatch(/netsuite|odoo|outlook|FOREIGN KEY.*entity_public_id/i);
        expect(calendarTimestampStatements.join("\n")).toContain("SIGNAL SQLSTATE '45000'");
    });
    it("separates invitation response, external sync and per-user bell reading", async () => {
        const ddl = (await loadCalendarStatements()).join("\n");
        for (const field of ["response_calendar_participant", "responded_at_calendar_participant", "read_at_calendar_notification", "dismissed_at_calendar_notification", "visible_at_calendar_notification", "external_event_id_calendar_event_sync", "connection_id_calendar_event_sync", "entity_public_id_calendar_event_link"]) expect(ddl).toContain(field);
        expect(ddl).toContain("UNIQUE KEY uq_calendar_notification_dedupe");
        expect(ddl).toContain("UNIQUE KEY uq_calendar_participant_user");
    });
});
