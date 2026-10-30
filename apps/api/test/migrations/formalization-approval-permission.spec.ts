import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { formalizationApprovalPermissionMigration as migration } from "../../migrations/schema-only/202610280045_formalization_approval_permission.js";
import { schemaMigrations, selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import type { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";

const code = "formalizacion.orders.approve";
const description = "Permite marcar únicamente la aprobación de Formalización después de la confirmación de NetSuite; no modifica las demás aprobaciones ni omite otras validaciones.";
const definition = { code, module: "formalizacion", action: "approve", description, status: "active" };
const tableNames = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"];

type Options = { database?: string; tables?: object[]; permissions?: Record<string, unknown>[]; roles?: object[]; actors?: object[]; grants?: { code: string; status: string }[]; failAudit?: boolean };
function fixture(options: Options = {}) {
    const queries: CompiledQuery[] = [];
    const transactions: string[] = [];
    let permissions = options.permissions ?? [];
    const grants = [...(options.grants ?? [])];
    const database = options.database ?? "CRM_THINK_V2";
    const tables = options.tables ?? tableNames.map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" }));
    const roles = options.roles ?? [{ id: 19, status: "active", deleted: null }];
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
            if (query.sql.startsWith("INSERT INTO sec_role_permission")) grants.push({ code, status: "active" });
            const inventory: [string, object[]][] = [
                ["SELECT DATABASE()", [{ name: database }]],
                ["information_schema.TABLES", tables],
                ["FROM sec_role WHERE", roles],
                ["FROM sec_user u JOIN", actors],
                ["FROM sec_role_permission", [...grants]],
                ["FROM sec_permission", permissions],
                ["from `sec_permission`", [{ actionCode: "approve", code, description, moduleCode: "formalizacion" }]],
            ];
            return Promise.resolve({ rows: (inventory.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? []) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, transactions };
}
const writes = (queries: CompiledQuery[]) => queries.filter((query) => !query.sql.startsWith("SELECT"));

describe("formalization approval permission migration", () => {
    it("appends 045 after notes044 and supports exact selection", () => {
        expect(selectSchemaMigrations(migration.name)).toEqual([migration]);
        const index = schemaMigrations.findIndex((entry) => entry.name === migration.name);
        expect(schemaMigrations.slice(index - 1, index + 1).map((entry) => entry.name)).toEqual(["202610270044_notes_collaboration", "202610280045_formalization_approval_permission"]);
    });
    it("creates only the independent permission and supervisor grant, versions active members, audits atomically and reruns without writes", async () => {
        const f = fixture({
            grants: [
                { code: "formalizacion.home.read", status: "active" },
                { code: "formalizacion.orders.stage.skip", status: "inactive" },
            ],
        });
        try {
            await migration.up(f.db);
            const changed = writes(f.queries) as [CompiledQuery, CompiledQuery, CompiledQuery, CompiledQuery];
            expect(changed).toHaveLength(4);
            expect(changed[0].parameters).toEqual([code, "formalizacion", "approve", description, "active"]);
            expect(changed[1].sql).toContain("INSERT INTO sec_role_permission");
            expect(changed[1].parameters).toEqual([19, code]);
            expect(changed[2].sql).toContain("permission_version_user=permission_version_user+1");
            expect(changed[2].sql).toContain("ur.status_user_role='active'");
            expect(changed[2].sql).toContain("ur.revoked_at_user_role IS NULL");
            expect(changed[2].parameters).toEqual([19]);
            expect(changed[3].sql).toContain("INSERT INTO audit_security_event");
            const metadata: unknown = JSON.parse(changed[3].parameters.at(-1) as string);
            expect(metadata).toMatchObject({ migration: migration.name, roleCode: "jefe_formalizaciones", actor: { publicId: "owner-id" }, changeSet: { before: { permissionCodes: ["formalizacion.home.read"] }, after: { permissionCodes: ["formalizacion.home.read", code].sort() } } });
            expect(f.transactions).toEqual(["begin", "commit"]);
            const sqlText = f.queries.map((query) => query.sql).join("\n");
            expect(sqlText).not.toMatch(/sec_user_permission_override|INSERT INTO sec_role |UPDATE sec_role|DELETE |crm_sales|crmdatabase-api/);
            expect(f.queries.find((q) => q.sql.includes("FROM sec_role WHERE"))?.parameters).toEqual(["jefe_formalizaciones"]);
            expect(f.queries.filter((q) => q.sql.startsWith("SELECT") && /FROM sec_role WHERE|FROM sec_permission WHERE|FROM sec_role_permission/.test(q.sql)).every((q) => q.sql.includes("FOR UPDATE"))).toBe(true);
            await migration.up(f.db);
            expect(writes(f.queries)).toHaveLength(4);
        } finally {
            await f.db.destroy();
        }
    });
    it("preserves an existing active supervisor grant without audit or version churn", async () => {
        const f = fixture({ permissions: [definition], grants: [{ code, status: "active" }], actors: [] });
        try {
            await migration.up(f.db);
            expect(writes(f.queries)).toEqual([]);
            expect(f.transactions).toEqual(["begin", "commit"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("grants an exact existing permission without rewriting it", async () => {
        const f = fixture({ permissions: [definition] });
        try {
            await migration.up(f.db);
            expect(writes(f.queries)).toHaveLength(3);
            expect(f.queries.some((q) => q.sql.startsWith("INSERT INTO sec_permission"))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([
        { database: "crmdatabase-api" },
        { tables: [] },
        ...tableNames.map((name) => ({ tables: tableNames.map((table_name) => ({ table_name, table_type: table_name === name ? "VIEW" : "BASE TABLE", engine: "InnoDB" })) })),
        { tables: tableNames.map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "MyISAM" })) },
        { roles: [] },
        { roles: [{ id: 19, status: "inactive", deleted: null }] },
        { roles: [{ id: 19, status: "active", deleted: new Date() }] },
        { actors: [] },
        ...Object.keys(definition).map((key) => ({ permissions: [{ ...definition, [key]: "drift" }] })),
        { permissions: [definition, definition] },
        { grants: [{ code, status: "inactive" }] },
        {
            grants: [
                { code, status: "active" },
                { code, status: "inactive" },
            ],
        },
    ] satisfies Options[])("rejects unsafe configuration before writes: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(migration.up(f.db)).rejects.toThrow();
            expect(writes(f.queries)).toEqual([]);
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("rolls back grant and version writes when audit fails", async () => {
        const f = fixture({ failAudit: true });
        try {
            await expect(migration.up(f.db)).rejects.toThrow("audit unavailable");
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("exposes the sensitive label in Formalizacion / sales_order using the existing resolver", async () => {
        const f = fixture();
        const repository = new IdentityAccessManagementRepository({ db: f.db } as unknown as DatabaseService, {} as SecurityAuditService, {} as IdentitySessionRepository);
        try {
            const catalog = await repository.readSecurityCatalog();
            expect(catalog.modules.find((module) => module.code === "formalizacion")?.views.find((view) => view.code === "sales_order")?.permissions).toContainEqual({ code, description, name: "Aprobar Formalización", sensitive: true });
        } finally {
            await f.db.destroy();
        }
    });
});
