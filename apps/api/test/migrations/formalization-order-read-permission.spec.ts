import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { formalizationOrderReadPermissionMigration as migration } from "../../migrations/schema-only/202610280048_formalization_order_read_permission.js";
import { schemaMigrations, selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import type { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";

const code = "formalizacion.orders.read";
const description = "Ver orden de venta";
const definition = { code, module: "formalizacion", action: "read", description, status: "active" };
const tableNames = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"];

type Options = { database?: string; tables?: object[]; permissions?: Record<string, unknown>[]; roles?: object[]; actors?: object[]; grants?: { role: number; code: string; status: string }[]; failAudit?: boolean };
function fixture(options: Options = {}) {
    const queries: CompiledQuery[] = [];
    const transactions: string[] = [];
    let permissions = options.permissions ?? [];
    const grants = [...(options.grants ?? [])];
    const database = options.database ?? "CRM_THINK_V2";
    const tables = options.tables ?? tableNames.map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" }));
    const roles = options.roles ?? [
        { id: 19, code: "formalizacion", status: "active", deleted: null },
        { id: 1, code: "owner", status: "active", deleted: null },
    ];
    const actors = options.actors ?? [{ id: 1, publicId: "owner-id", name: "Owner" }];
    const driver = new DummyDriver();
    driver.beginTransaction = () => {
        transactions.push("begin");
        return Promise.resolve();
    };
    driver.commitTransaction = () => {
        transactions.push("commit");
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        transactions.push("rollback");
        return Promise.resolve();
    };
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            if (query.sql.startsWith("INSERT INTO audit_security_event") && options.failAudit) return Promise.reject(new Error("audit unavailable"));
            if (query.sql.startsWith("INSERT INTO sec_permission")) permissions = [definition];
            if (query.sql.startsWith("INSERT INTO sec_role_permission")) grants.push({ role: query.parameters[0] as number, code, status: "active" });
            const inventory: [string, object[]][] = [
                ["SELECT DATABASE()", [{ name: database }]],
                ["information_schema.TABLES", tables],
                ["FROM sec_role WHERE", roles],
                ["FROM sec_user u JOIN", actors],
                ["FROM sec_role_permission", [...grants]],
                ["FROM sec_permission", permissions],
                ["from `sec_permission`", [{ actionCode: "read", code, description, moduleCode: "formalizacion" }]],
            ];
            return Promise.resolve({ rows: (inventory.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? []) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, transactions };
}
const writes = (queries: CompiledQuery[]) => queries.filter((query) => !query.sql.startsWith("SELECT"));

describe("formalization order read permission migration", () => {
    it("registers exact selection after047", () => {
        expect(selectSchemaMigrations(migration.name)).toEqual([migration]);
        const index = schemaMigrations.findIndex((entry) => entry.name === migration.name);
        expect(schemaMigrations[index - 1]?.name).toBe("202610280047_formalization_banner_permissions");
    });
    it("provisions independent role grants and audits once, without banner or override history writes", async () => {
        const f = fixture();
        try {
            await migration.up(f.db);
            expect(writes(f.queries)).toHaveLength(5);
            expect(writes(f.queries)[0]?.parameters).toEqual([code, "formalizacion", "read", description, "active"]);
            expect(f.queries.filter((q) => q.sql.startsWith("INSERT INTO sec_role_permission"))).toHaveLength(2);
            expect(f.queries.find((q) => q.sql.startsWith("UPDATE sec_user"))?.sql).toContain("ur.revoked_at_user_role IS NULL");
            expect(f.queries.map((q) => q.sql).join("\n")).not.toMatch(/INSERT INTO sec_user_permission_override|UPDATE sec_user_permission_override|DELETE |crm_sales|crmdatabase-api/);
            await migration.up(f.db);
            expect(writes(f.queries)).toHaveLength(5);
            expect(f.transactions).toEqual(["begin", "commit", "begin", "commit"]);
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["active", "inactive"])("preserves existing %s independent grants without writes", async (status) => {
        const f = fixture({
            permissions: [definition],
            grants: [
                { role: 19, code, status },
                { role: 1, code, status },
            ],
        });
        try {
            await migration.up(f.db);
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("only adds the missing base role while preserving inactive independent access", async () => {
        const f = fixture({
            permissions: [definition],
            grants: [
                { role: 19, code, status: "inactive" },
                { role: 77, code, status: "active" },
            ],
        });
        try {
            await migration.up(f.db);
            const inserts = f.queries.filter((q) => q.sql.startsWith("INSERT INTO sec_role_permission"));
            expect(inserts).toHaveLength(1);
            expect(inserts[0]?.parameters).toEqual([1, code]);
            expect(f.queries.find((q) => q.sql.startsWith("UPDATE sec_user"))?.parameters).toEqual([1]);
            const audit = f.queries.find((q) => q.sql.startsWith("INSERT INTO audit_security_event"));
            expect(JSON.parse(audit?.parameters.at(-1) as string)).toMatchObject({ migration: migration.name, actor: { publicId: "owner-id" }, changeSet: { recordId: code, before: { roleCodes: [] }, after: { roleCodes: ["owner"] } } });
        } finally {
            await f.db.destroy();
        }
    });
    it.each([
        { database: "legacy" },
        { tables: [] },
        ...tableNames.map((name) => ({ tables: tableNames.map((table_name) => ({ table_name, table_type: table_name === name ? "VIEW" : "BASE TABLE", engine: "InnoDB" })) })),
        { tables: tableNames.map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "MyISAM" })) },
        { roles: [] },
        {
            roles: [
                { id: 19, code: "formalizacion", status: "inactive", deleted: null },
                { id: 1, code: "owner", status: "active", deleted: null },
            ],
        },
        {
            roles: [
                { id: 19, code: "formalizacion", status: "active", deleted: new Date() },
                { id: 1, code: "owner", status: "active", deleted: null },
            ],
        },
        { actors: [] },
        ...Object.keys(definition).map((key) => ({ permissions: [{ ...definition, [key]: "drift" }] })),
        { permissions: [definition, definition] },
    ] satisfies Options[])("fails closed before writes: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(migration.up(f.db)).rejects.toThrow();
            expect(writes(f.queries)).toEqual([]);
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("rolls back when audit fails", async () => {
        const f = fixture({ failAudit: true });
        try {
            await expect(migration.up(f.db)).rejects.toThrow("audit unavailable");
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("labels sales_order catalog read", async () => {
        const f = fixture();
        const repository = new IdentityAccessManagementRepository({ db: f.db } as unknown as DatabaseService, {} as SecurityAuditService, {} as IdentitySessionRepository);
        try {
            const catalog = await repository.readSecurityCatalog();
            expect(catalog.modules.find((m) => m.code === "formalizacion")?.views.find((v) => v.code === "sales_order")?.permissions).toContainEqual({ code, description, name: "Ver orden de venta", sensitive: false });
        } finally {
            await f.db.destroy();
        }
    });
});
