import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it } from "vitest";

import { orderDocumentsPermissionsMigration as migration } from "../../migrations/schema-only/202611030070_order_documents_permissions.js";
function fixture(missingRole = false) {
    const queries: CompiledQuery[] = [];
    const permissions = new Map<string, object>();
    const grants: { role: number; code: string; status: string }[] = [];
    const roles = ["owner", "formalizacion", "jefe_formalizaciones", "jefe_general"].map((code, id) => ({ code, id: id + 1, status: "active", deleted: null }));
    if (missingRole) roles.pop();
    const tables = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"].map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" }));
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            const p = query.parameters;
            if (query.sql.startsWith("INSERT INTO sec_permission")) permissions.set(String(p[0]), { code: p[0], module: p[1], action: p[2], description: p[3], status: p[4] });
            if (query.sql.startsWith("INSERT INTO sec_role_permission")) grants.push({ role: Number(p[0]), code: String(p[1]), status: "active" });
            const permission = permissions.get(String(p[0]));
            const inventory: [string, object[]][] = [
                ["SELECT DATABASE()", [{ name: "CRM_THINK_V2" }]],
                ["information_schema.TABLES", tables],
                ["FROM sec_role WHERE", roles],
                ["FROM sec_user u JOIN", [{ id: 1, publicId: "owner", name: "Owner" }]],
                ["FROM sec_role_permission", grants.filter((g) => g.code === p[0])],
                ["FROM sec_permission", permission ? [permission] : []],
            ];
            return Promise.resolve({ rows: (inventory.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? []) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, grants, permissions };
}
it("crea lectura/escritura para cuatro roles, audita y es idempotente", async () => {
    const f = fixture();
    try {
        await migration.up(f.db);
        expect(f.permissions.size).toBe(2);
        expect(f.grants).toHaveLength(8);
        const writes = f.queries.filter((query) => query.sql.startsWith("INSERT") || query.sql.startsWith("UPDATE")).length;
        await migration.up(f.db);
        expect(f.queries.filter((query) => query.sql.startsWith("INSERT") || query.sql.startsWith("UPDATE"))).toHaveLength(writes);
        expect(f.queries.filter((query) => query.sql.startsWith("INSERT INTO audit_security_event"))).toHaveLength(2);
        expect(f.queries.map((query) => query.sql).join(" ")).not.toMatch(/DELETE|crmdatabase-api|sec_user_permission_override/u);
    } finally {
        await f.db.destroy();
    }
});
it("no concede nada si falta un rol requerido", async () => {
    const f = fixture(true);
    try {
        await expect(migration.up(f.db)).rejects.toThrow("Order documents permission requires all authorized active roles");
        expect(f.permissions.size).toBe(0);
    } finally {
        await f.db.destroy();
    }
});
