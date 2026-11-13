import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { salesDefaultsRetireAccountingMigration } from "../../migrations/schema-only/202611130079_sales_defaults_retire_accounting.js";

/** Compila la migración con metadatos sintéticos; no abre conexiones MySQL. */
function database(schema = "CRM_THINK_V2") {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const rows = query.sql.includes("DATABASE() AS name") ? [{ name: schema }] : /^SELECT (?:id_org_unit|id_permission|u.id_user) AS id/u.test(query.sql) ? [{ id: 1 }] : [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (executor) => new MysqlIntrospector(executor), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}

describe("Sales defaults and retired Accounting configuration", () => {
    it("rejects any other database before writing", async () => {
        const { db, queries } = database("crmdatabase-api");
        try {
            await expect(salesDefaultsRetireAccountingMigration.up(db)).rejects.toThrow("CRM_THINK_V2");
            expect(queries.every((query) => query.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await db.destroy();
        }
    });
    it("retires only Accounting, adds default membership and preserves credentials, statuses and denies", async () => {
        const { db, queries } = database();
        try {
            await salesDefaultsRetireAccountingMigration.up(db);
            const statements = queries.map((query) => query.sql).join("\n");
            expect(statements).toContain("INSERT INTO sec_user_org_unit");
            expect(statements).toContain("NOT EXISTS");
            expect(statements).toContain("WHERE module_code_permission='contabilidad'");
            expect(statements).not.toMatch(/\b(?:DELETE|DROP|TRUNCATE)\b/u);
            expect(statements).not.toMatch(/(?:INSERT INTO|UPDATE) (?:crm_|sec_auth_|sec_user_permission_override)/u);
            expect(statements).not.toContain("SET status_user=");
            expect(statements).toContain("INSERT INTO audit_security_event");
        } finally {
            await db.destroy();
        }
    });
});
