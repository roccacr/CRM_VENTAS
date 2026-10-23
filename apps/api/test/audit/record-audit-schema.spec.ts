import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { readTargetTableNames } from "../../migrations/schema-only/202609250001_identity_schema.js";
import { loadRecordAuditStatements, recordAuditMigration } from "../../migrations/schema-only/202610220023_record_audit.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";

/** Compiles real MySQL queries without connecting to any database. */
const createDatabase = (databaseName = "CRM_THINK_V2", existingTables: string[] = []) => {
    const queries: string[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query.sql);
                const rows = query.sql.includes("DATABASE() AS name") ? [{ name: databaseName }] : query.sql.includes("information_schema.TABLES") ? existingTables.map((table_name) => ({ table_name })) : [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
};

describe("central record audit schema", () => {
    it("selects only the additive audit migration", () => {
        expect(selectSchemaMigrations(recordAuditMigration.name)).toEqual([recordAuditMigration]);
    });

    it("creates only audit identity and event tables, never business records", async () => {
        const statements = await loadRecordAuditStatements();
        expect(readTargetTableNames(statements)).toEqual(["audit_record", "audit_record_event"]);
        expect(statements.every((statement) => /^CREATE TABLE IF NOT EXISTS /i.test(statement))).toBe(true);
        expect(statements.join("\n")).not.toMatch(/REFERENCES\s+(ordenventa|crm_sales_order|sec_user)\b/i);
    });

    it("preserves identity, before and after snapshots, actor, time and retry identity", async () => {
        const sql = (await loadRecordAuditStatements()).join("\n");
        for (const field of ["source_schema_record", "entity_type_record", "source_id_record", "before_record_event", "after_record_event", "actor_snapshot_record_event", "occurred_at_record_event", "recorded_at_record_event", "reason_record_event", "operation_id_record_event", "correlation_id_record_event", "snapshot_version_record_event", "snapshot_scope_record_event", "changes_record_event"]) expect(sql).toContain(field);
        expect(sql).toContain("UNIQUE KEY uq_audit_record_identity");
        expect(sql).toContain("UNIQUE KEY uq_audit_record_event_sequence");
        expect(sql).toContain("UNIQUE KEY uq_audit_record_event_operation");
        expect(sql).toContain("UTC_TIMESTAMP(3)");
    });

    it("requires a reason and a same-record historical target for restoration", async () => {
        const sql = (await loadRecordAuditStatements()).join("\n");
        expect(sql).toContain("FOREIGN KEY (record_id_record_event, restored_sequence_record_event)");
        expect(sql).toContain("restored_sequence_record_event < sequence_record_event");
        expect(sql).toContain("CHAR_LENGTH(TRIM(reason_record_event)) > 0");
        expect(sql).toContain("ck_audit_record_event_snapshots");
        expect(sql).toContain("ck_audit_record_event_restore");
    });

    it("documents every physical column and uses InnoDB", async () => {
        for (const statement of await loadRecordAuditStatements()) {
            const columns = statement.split("\n").filter((line) => /^\s+[a-z_]+ (?:CHAR|VARCHAR|INT|JSON|DATETIME)/.test(line));
            expect(columns.length).toBeGreaterThan(5);
            expect(columns.every((line) => line.includes("COMMENT '"))).toBe(true);
            expect(statement).toContain("ENGINE=InnoDB");
        }
    });

    it("refuses the production schema before any DDL", async () => {
        const { db, queries } = createDatabase("crmdatabase-api");
        try {
            await expect(recordAuditMigration.up(db)).rejects.toThrow("CRM_THINK_V2");
            expect(queries.some((query) => /CREATE TABLE/i.test(query))).toBe(false);
        } finally {
            await db.destroy();
        }
    });

    it("refuses existing unledgered tables instead of hiding schema drift", async () => {
        const { db, queries } = createDatabase("CRM_THINK_V2", ["audit_record"]);
        try {
            await expect(recordAuditMigration.up(db)).rejects.toThrow("Existing audit tables");
            expect(queries.some((query) => /CREATE TABLE/i.test(query))).toBe(false);
        } finally {
            await db.destroy();
        }
    });

    it("executes the two reviewed statements after the native-only preflight", async () => {
        const { db, queries } = createDatabase();
        try {
            await recordAuditMigration.up(db);
            expect(queries.filter((query) => /^CREATE TABLE/i.test(query))).toEqual(await loadRecordAuditStatements());
        } finally {
            await db.destroy();
        }
    });
});
