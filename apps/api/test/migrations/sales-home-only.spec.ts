import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { salesHomeOnlyMigration } from "../../migrations/schema-only/202611130078_sales_home_only.js";

/** Compiles the real migration with synthetic metadata. Never connects to MySQL. */
function database(schema = "CRM_THINK_V2", disabled = false) {
    const queries: CompiledQuery[] = [];
    const permissionStatus = disabled ? "inactive" : "active";
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                let rows: unknown[] = [];
                if (query.sql.includes("DATABASE() AS name")) rows = [{ name: schema }];
                else if (query.sql.includes("information_schema.TABLES")) rows = query.parameters.map((name) => ({ name, engine: "InnoDB" }));
                else if (query.sql.startsWith("SELECT id_org_unit")) rows = [{ id: 7, status: "active", deleted: null }];
                else if (query.sql.startsWith("SELECT u.id_user AS id")) rows = [{ id: 1 }];
                else if (query.sql.startsWith("SELECT id_role AS id")) rows = ["owner", "jefe_general", "jefe_ventas", "ventas"].map((code, i) => ({ id: i + 1, code, status: "active", deleted: null }));
                else if (query.sql.startsWith("SELECT id_permission AS id")) rows = [{ id: 10, module: "ventas", status: permissionStatus, action: "read" }];
                else if (query.sql.startsWith("SELECT status_role_module")) rows = [{ status: "active" }];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (executor) => new MysqlIntrospector(executor), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}

describe("Sales Home versioned configuration", () => {
    it("rejects another schema before any write", async () => {
        const { db, queries } = database("crmdatabase-api");
        try {
            await expect(salesHomeOnlyMigration.up(db)).rejects.toThrow("CRM_THINK_V2");
            expect(queries.every((query) => query.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await db.destroy();
        }
    });
    it("preserves a disabled home permission instead of silently reactivating it", async () => {
        const { db, queries } = database("CRM_THINK_V2", true);
        try {
            await expect(salesHomeOnlyMigration.up(db)).rejects.toThrow("conflicts");
            expect(queries.some((query) => query.sql.startsWith("UPDATE sec_permission"))).toBe(false);
        } finally {
            await db.destroy();
        }
    });
    it("only changes native security configuration and records reversible before metadata", async () => {
        const { db, queries } = database();
        try {
            await salesHomeOnlyMigration.up(db);
            const statements = queries.map((query) => query.sql).join("\n");
            expect(statements).not.toMatch(/\b(?:DELETE|DROP|TRUNCATE)\b/i);
            expect(statements).not.toMatch(/(?:INSERT INTO|UPDATE) (?:crm_|sec_user_role\b|sec_user_org_unit\b|sec_user_permission_override\b)/);
            expect(statements).not.toContain("code_permission NOT LIKE 'ventas.notes.%'");
            expect(statements).toContain("code_permission<>");
            expect(statements).toContain("role_id_role_permission NOT IN");
            const audit = queries.find((query) => query.sql.startsWith("INSERT INTO audit_security_event"));
            const metadata = JSON.parse(String(audit?.parameters.at(-1))) as { before: { permissions: unknown[]; mappings: unknown[] }; assignsUsers: boolean };
            expect(metadata.before).toEqual({ permissions: [], mappings: [] });
            expect(metadata.assignsUsers).toBe(false);
        } finally {
            await db.destroy();
        }
    });
});
