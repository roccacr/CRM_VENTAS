import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { formalizationRolePermissions, formalizationRoleWorkflowsMigration as migration } from "../../migrations/schema-only/202610280049_formalization_role_workflows.js";
import { schemaMigrations, selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";

type Grant = { role: number; code: string; status: string };
type Options = { database?: string; missingTable?: boolean; missingRole?: boolean; missingPermission?: boolean; inactivePermission?: boolean; actorMissing?: boolean; failAudit?: boolean; grants?: Grant[] };
function fixture(options: Options = {}) {
    const queries: CompiledQuery[] = [];
    const transactions: string[] = [];
    let grants = [...(options.grants ?? [])];
    let snapshot: Grant[] = [];
    const roles = [
        { id: 85, code: "formalizacion", status: "active", deleted: null },
        { id: 239, code: "jefe_formalizaciones", status: "active", deleted: null },
    ];
    const codes = [...new Set(Object.values(formalizationRolePermissions).flat())];
    const permissions = codes.map((code, index) => ({ id: index + 1, code, module: "formalizacion", status: options.inactivePermission && index === 0 ? "inactive" : "active" }));
    const tableRows = options.missingTable ? [] : ["sec_role", "sec_permission", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"].map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" }));
    const roleRows = options.missingRole ? [] : roles;
    const permissionRows = options.missingPermission ? permissions.slice(1) : permissions;
    const actorRows = options.actorMissing ? [] : [{ id: 1, publicId: "owner-id", name: "Owner" }];
    const driver = new DummyDriver();
    driver.beginTransaction = () => {
        snapshot = [...grants];
        transactions.push("begin");
        return Promise.resolve();
    };
    driver.commitTransaction = () => {
        transactions.push("commit");
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        grants = snapshot;
        transactions.push("rollback");
        return Promise.resolve();
    };
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            if (query.sql.startsWith("INSERT INTO audit_security_event") && options.failAudit) return Promise.reject(new Error("Audit unavailable"));
            if (query.sql.startsWith("INSERT INTO sec_role_permission")) grants.push({ role: Number(query.parameters[0]), code: String(query.parameters[1]), status: "active" });
            const inventory: [string, object[]][] = [
                ["SELECT DATABASE()", [{ name: options.database ?? "CRM_THINK_V2" }]],
                ["information_schema.TABLES", tableRows],
                ["FROM sec_role WHERE", roleRows],
                ["FROM sec_permission WHERE", permissionRows],
                ["FROM sec_role_permission", grants],
                ["FROM sec_user u JOIN", actorRows],
            ];
            return Promise.resolve({ rows: (inventory.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? []) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, transactions, grants: () => grants };
}
const writes = (queries: CompiledQuery[]) => queries.filter((query) => /^(INSERT|UPDATE|DELETE)/.test(query.sql));

describe("Formalization role workflow baseline", () => {
    it("registers only049 after048 and separates management from supervision", () => {
        expect(selectSchemaMigrations(migration.name)).toEqual([migration]);
        const index = schemaMigrations.findIndex((entry) => entry.name === migration.name);
        expect(schemaMigrations[index - 1]?.name).toBe("202610280048_formalization_order_read_permission");
        expect(formalizationRolePermissions.formalizacion).not.toContain("formalizacion.orders.approve");
        expect(formalizationRolePermissions.formalizacion).not.toContain("formalizacion.home.read");
        expect(formalizationRolePermissions.formalizacion).not.toContain("formalizacion.orders.stage.skip");
        expect(formalizationRolePermissions.jefe_formalizaciones).toEqual(expect.arrayContaining([...formalizationRolePermissions.formalizacion, "formalizacion.orders.approve", "formalizacion.orders.stage.skip"]));
        expect(formalizationRolePermissions.jefe_formalizaciones).not.toContain("formalizacion.orders.stage.pending_approval");
    });
    it("provisions missing workflow grants atomically and is idempotent", async () => {
        const f = fixture();
        try {
            await migration.up(f.db);
            const expected = Object.values(formalizationRolePermissions).flat().length;
            expect(f.grants()).toHaveLength(expected);
            expect(writes(f.queries)).toHaveLength(expected + 2);
            expect(f.queries.map((q) => q.sql).join("\n")).not.toMatch(/crmdatabase-api|INSERT INTO sec_permission|UPDATE sec_role_permission|sec_user_permission_override|DELETE /);
            expect(f.queries.find((q) => q.sql.startsWith("UPDATE sec_user"))?.sql).toContain("status_user='active'");
            const audit = f.queries.find((q) => q.sql.startsWith("INSERT INTO audit_security_event"));
            expect(JSON.parse(audit?.parameters.at(-1) as string)).toMatchObject({ migration: migration.name, moduleCode: "administration" });
            await migration.up(f.db);
            expect(writes(f.queries)).toHaveLength(expected + 2);
            expect(f.transactions).toEqual(["begin", "commit", "begin", "commit"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("preserves independently inactive grants and never rewrites individual overrides", async () => {
        const existing: Grant = { role: 239, code: "formalizacion.orders.read", status: "inactive" };
        const f = fixture({ grants: [existing] });
        try {
            await migration.up(f.db);
            expect(f.grants().filter((grant) => grant.role === 239 && grant.code === existing.code)).toEqual([existing]);
            expect(f.queries.some((q) => q.sql.includes("sec_user_permission_override"))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ database: "crmdatabase-api" }, { missingTable: true }, { missingRole: true }, { missingPermission: true }, { inactivePermission: true }, { actorMissing: true }])("fails closed before mutations on invalid native configuration %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(migration.up(f.db)).rejects.toThrow();
            expect(writes(f.queries)).toEqual([]);
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("rolls back role provisioning when audit fails", async () => {
        const f = fixture({ failAudit: true });
        try {
            await expect(migration.up(f.db)).rejects.toThrow("Audit unavailable");
            expect(f.grants()).toEqual([]);
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
});
