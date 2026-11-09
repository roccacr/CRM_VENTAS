import type * as fsPromises from "node:fs/promises";
import { readFile } from "node:fs/promises";

import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import { loadRecordAuditStatements, recordAuditMigration } from "../../migrations/schema-only/202610220023_record_audit.js";
import { anyOf } from "../support/throws.js";

vi.mock("node:fs/promises", async (importOriginal) => {
    const original = await importOriginal<typeof fsPromises>();
    return { ...original, readFile: vi.fn(original.readFile) };
});

/** Reuses the schema suite's DummyDriver pattern; every query stays in memory. */
const createDatabase = (respond: (query: CompiledQuery) => unknown[]) => {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                return Promise.resolve({ rows: respond(query) as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
};

describe("record audit preflight without a database", () => {
    it.each([{ name: null }, { name: "unknown_schema" }, { name: "crm_think_v2" }, { name: "CRM_THINK_V2 " }, {}])("rejects an unapproved destination row %j before table inspection", async (row) => {
        const { db, queries } = createDatabase(() => [row]);
        try {
            await expect(recordAuditMigration.up(db)).rejects.toThrow("requires CRM_THINK_V2");
            expect(queries.map((query) => query.sql)).toEqual(["SELECT DATABASE() AS name"]);
        } finally {
            await db.destroy();
        }
    });

    it("rejects a missing destination row before table inspection", async () => {
        const { db, queries } = createDatabase(() => []);
        try {
            await expect(recordAuditMigration.up(db)).rejects.toThrow("requires CRM_THINK_V2");
            expect(queries.map((query) => query.sql)).toEqual(["SELECT DATABASE() AS name"]);
        } finally {
            await db.destroy();
        }
    });

    it.each(["destination", "table inventory"])("propagates a %s query failure without issuing DDL", async (stage) => {
        const failure = new Error(`Injected ${stage} failure`);
        const { db, queries } = createDatabase((query) => {
            if (stage === "destination" || query.sql.includes("information_schema.TABLES")) throw failure;
            return [{ name: "CRM_THINK_V2" }];
        });
        try {
            await expect(recordAuditMigration.up(db)).rejects.toBe(failure);
            expect(queries).toHaveLength(stage === "destination" ? 1 : 2);
            expect(queries.every((query) => /^SELECT\b/.test(query.sql))).toBe(true);
        } finally {
            await db.destroy();
        }
    });

    it.each([["audit_record_event"], ["audit_record", "audit_record_event"]])("rejects pre-existing targets %j using a schema-scoped parameterized inventory", async (...existingTables) => {
        const { db, queries } = createDatabase((query) => (query.sql.includes("DATABASE() AS name") ? [{ name: "CRM_THINK_V2" }] : existingTables.map((table_name) => ({ table_name }))));
        try {
            await expect(recordAuditMigration.up(db)).rejects.toThrow("Existing audit tables");
            expect(queries).toHaveLength(2);
            expect(queries[1]?.sql).toContain("TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?)");
            expect(queries[1]?.parameters).toEqual(["audit_record", "audit_record_event"]);
        } finally {
            await db.destroy();
        }
    });

    it.each([0, 1])("propagates failure of CREATE statement %i without retries or migration-owned ledger writes", async (failedIndex) => {
        const statements = await loadRecordAuditStatements();
        const failure = new Error("Injected DDL failure");
        const { db, queries } = createDatabase((query) => {
            if (query.sql === statements[failedIndex]) throw failure;
            return query.sql.includes("DATABASE() AS name") ? [{ name: "CRM_THINK_V2" }] : [];
        });
        try {
            await expect(recordAuditMigration.up(db)).rejects.toBe(failure);
            // This trace covers up() only, not runner ledger behavior or real MySQL rollback.
            expect(queries.map((query) => query.sql)).toEqual(["SELECT DATABASE() AS name", expect.stringContaining("information_schema.TABLES"), ...statements.slice(0, failedIndex + 1)]);
        } finally {
            await db.destroy();
        }
    });

    it("propagates an unreadable SQL artifact before DDL", async () => {
        const failure = new Error("Injected artifact read failure");
        vi.mocked(readFile).mockRejectedValueOnce(failure);
        const { db, queries } = createDatabase(() => [{ name: "CRM_THINK_V2" }]);
        try {
            await expect(recordAuditMigration.up(db)).rejects.toBe(failure);
            expect(queries.map((query) => query.sql)).toEqual(["SELECT DATABASE() AS name"]);
        } finally {
            await db.destroy();
        }
    });

    it.each([
        ["an extra DML statement", "CREATE TABLE IF NOT EXISTS audit_record (id INT); CREATE TABLE IF NOT EXISTS audit_record_event (id INT); DELETE FROM ordenventa;"],
        ["a business table target", "CREATE TABLE IF NOT EXISTS audit_record (id INT); CREATE TABLE IF NOT EXISTS ordenventa (id INT);"],
        ["duplicate targets", "CREATE TABLE IF NOT EXISTS audit_record (id INT); CREATE TABLE IF NOT EXISTS audit_record (id INT);"],
        ["reversed targets", "CREATE TABLE IF NOT EXISTS audit_record_event (id INT); CREATE TABLE IF NOT EXISTS audit_record (id INT);"],
        ["a qualified target", "CREATE TABLE IF NOT EXISTS audit_record (id INT); CREATE TABLE IF NOT EXISTS `crmdatabase-api`.`audit_record_event` (id INT);"],
    ])("rejects %s before inventory or DDL", async (_label, source) => {
        vi.mocked(readFile).mockResolvedValueOnce(source);
        const { db, queries } = createDatabase(() => [{ name: "CRM_THINK_V2" }]);
        try {
            await expect(recordAuditMigration.up(db)).rejects.toThrow(anyOf("La migracion de identidad debe poder extraer el nombre de tabla de cada sentenci", "Record audit requires exactly the two approved CREATE statements"));
            expect(queries.map((query) => query.sql)).toEqual(["SELECT DATABASE() AS name"]);
        } finally {
            await db.destroy();
        }
    });
});
