import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { readTargetTableNames } from "../../migrations/schema-only/202609250001_identity_schema.js";
import { legacyStateStatements, salesOrdersMigration, salesOrderStatements } from "../../migrations/schema-only/202610200021_sales_orders.js";

/** Captures SQL using the real compiler and an in-memory driver; no database connection. */
const createDatabase = (databaseName = "CRM_THINK_V2", existingTables: string[] = []) => {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const rows = query.sql.includes("DATABASE() AS name") ? [{ name: databaseName }] : query.sql.includes("information_schema.TABLES") ? existingTables.map((table_name) => ({ table_name })) : [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
};

describe("sales order schema boundaries", () => {
    it.each(readTargetTableNames([...salesOrderStatements]))("rejects existing unledgered target %s before any mutation", async (table) => {
        const { db, queries } = createDatabase("CRM_THINK_V2", [table]);
        try {
            await expect(salesOrdersMigration.up(db)).rejects.toThrow("Existing sales order tables");
            expect(queries.some((query) => /CREATE TABLE|INSERT INTO/i.test(query.sql))).toBe(false);
        } finally {
            await db.destroy();
        }
    });

    it("checks every native target before creating a clean schema", async () => {
        const { db, queries } = createDatabase();
        try {
            await salesOrdersMigration.up(db);
            expect(queries[1]?.sql).toContain("information_schema.TABLES");
            expect(queries[1]?.parameters).toEqual(readTargetTableNames([...salesOrderStatements]));
            expect(queries.filter((query) => /^CREATE TABLE/i.test(query.sql)).map((query) => query.sql)).toEqual([...salesOrderStatements]);
            expect(queries.filter((query) => /^INSERT INTO/i.test(query.sql))).toHaveLength(12);
        } finally {
            await db.destroy();
        }
    });

    it("rejects other schemas before querying targets or mutating", async () => {
        const { db, queries } = createDatabase("other_schema");
        try {
            await expect(salesOrdersMigration.up(db)).rejects.toThrow("CRM_THINK_V2");
            expect(queries).toHaveLength(1);
        } finally {
            await db.destroy();
        }
    });
    it("creates only additive legacy tables without touching ordenventa", () => {
        expect(legacyStateStatements).toHaveLength(2);
        for (const statement of legacyStateStatements) expect(statement).toMatch(/^CREATE TABLE IF NOT EXISTS /);
        expect(legacyStateStatements.join("\n")).not.toMatch(/ALTER TABLE|DROP TABLE|TRIGGER|INSERT INTO ordenventa/i);
    });
    it("separates provider references, approvals and append-only state history", () => {
        const schema = salesOrderStatements.join("\n");
        for (const table of ["crm_sales_order", "crm_sales_order_external_reference", "conf_sales_order_state", "conf_sales_order_approval_type", "crm_sales_order_approval", "audit_sales_order_state_event", "audit_sales_order_approval_event", "int_sales_order_source_snapshot"]) expect(schema).toContain(table);
        expect(schema).not.toMatch(/netsuite|odoo/i);
        expect(schema).toContain("UNIQUE KEY uq_so_state_sequence");
        expect(schema).toContain("UNIQUE KEY uq_so_state_operation");
        expect(schema).toContain("effective_at_sales_order_state_event");
    });
});
