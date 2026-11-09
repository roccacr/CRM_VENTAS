import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { formalizationBannerPermissions as definitions, formalizationBannerPermissionsMigration as migration } from "../../migrations/schema-only/202610280047_formalization_banner_permissions.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import type { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";
import { anyOf } from "../support/throws.js";

const old = { id: 1, code: "formalizacion.home.stages.read", status: "active" };
const tables = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "sec_user_permission_override", "audit_security_event"];
function fixture(options: { database?: string; unsafeTable?: string; engine?: string; missingTable?: boolean; failCopy?: boolean; drift?: boolean; inactive?: boolean; failAudit?: boolean; actorMissing?: boolean; existing?: boolean; revokedOverride?: boolean } = {}) {
    const queries: CompiledQuery[] = [];
    const transactions: string[] = [];
    let permissions: object[] = [old, ...([options.existing, options.drift, options.inactive].some(Boolean) ? definitions.map((p, i) => ({ ...p, id: i + 2, status: options.inactive ? "inactive" : p.status, module: options.drift ? "other" : p.module })) : [])];
    const grants = [{ id: 11, role: 19, permission: 1, status: "active", created: "2020-01-01" }, { id: 12, role: 19, permission: 1, status: "inactive", created: "2019-01-01" }, ...(options.existing ? [{ id: 13, role: 19, permission: 2, status: "inactive", created: "2021-01-01" }] : [])];
    const overrides = ["allow", "deny"].map((effect, i) => ({ id: i + 1, user: 7, permission: 1, effect, reason: effect, status: "active", starts: `202${String(i)}-01-01`, ends: `203${String(i)}-01-01`, creator: 1, created: "2020-01-01", revoker: null as number | null, revoked: null as string | null }));
    if (options.existing) overrides.push({ id: 9, user: 7, permission: 2, effect: "deny", reason: "existing", status: "active", starts: "2020-01-01", ends: "2030-01-01", creator: 1, created: "2020-01-01", revoker: null, revoked: null });
    if (options.revokedOverride) overrides.push({ id: 20, user: 7, permission: 1, effect: "deny", reason: "revoked", status: "inactive", starts: "2018-01-01", ends: "2019-01-01", creator: 2, created: "2018-01-01", revoker: 3, revoked: "2019-01-01" });
    const tableRows = tables.filter((name) => !options.missingTable || name !== "audit_security_event").map((table_name) => ({ table_name, table_type: table_name === options.unsafeTable ? "VIEW" : "BASE TABLE", engine: options.engine ?? "InnoDB" }));
    const failOn = options.failCopy ? "INSERT INTO sec_role_permission" : "INSERT INTO audit_security_event";
    const shouldFail = [options.failCopy, options.failAudit].some(Boolean);
    const actors = options.actorMissing ? [] : [{ id: 1, publicId: "owner", name: "Owner" }];
    let beforePermissions: object[] = [];
    const driver = new DummyDriver();
    driver.beginTransaction = () => {
        beforePermissions = permissions.map((p) => ({ ...p }));
        transactions.push("begin");
        return Promise.resolve();
    };
    driver.commitTransaction = () => {
        transactions.push("commit");
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        permissions = beforePermissions;
        transactions.push("rollback");
        return Promise.resolve();
    };
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            if (query.sql.startsWith(failOn) && shouldFail) return Promise.reject(new Error("audit unavailable"));
            if (query.sql.startsWith("INSERT INTO sec_permission")) {
                const [code, module, action, description, status] = query.parameters;
                permissions.push({ id: permissions.length + 1, code, module, action, description, status });
            }
            if (query.sql.startsWith("UPDATE sec_permission")) permissions = permissions.map((p) => ((p as typeof old).id === 1 ? { ...p, status: "inactive" } : p));
            const inventory: [string, object[]][] = [
                ["SELECT DATABASE()", [{ name: options.database ?? "CRM_THINK_V2" }]],
                ["information_schema.TABLES", tableRows],
                ["FROM sec_permission", permissions],
                ["from `sec_permission`", definitions.map((p) => ({ code: p.code, actionCode: p.action, moduleCode: p.module, description: p.description }))],
                ["FROM sec_role_permission", grants],
                ["FROM sec_user_permission_override", overrides],
                ["FROM sec_user u JOIN", actors],
            ];
            return Promise.resolve({ rows: (inventory.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? []) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (db) => new MysqlIntrospector(db), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, transactions, permissions: () => permissions };
}
const writes = (f: ReturnType<typeof fixture>) => f.queries.filter((q) => !q.sql.startsWith("SELECT"));
describe("formalization banner permissions migration", () => {
    it("registers exact migration047", () => {
        expect(selectSchemaMigrations(migration.name)).toEqual([migration]);
        expect(definitions).toHaveLength(6);
    });
    it("clones active/inactive history, both temporal override effects and metadata; retires umbrella atomically and reruns without writes", async () => {
        const f = fixture();
        try {
            await migration.up(f.db);
            const changed = writes(f);
            expect(changed.filter((q) => q.sql.startsWith("INSERT INTO sec_permission"))).toHaveLength(6);
            const roles = changed.filter((q) => q.sql.startsWith("INSERT INTO sec_role_permission"));
            expect(roles).toHaveLength(12);
            expect(roles[1]?.parameters).toContain("inactive");
            const overrides = changed.filter((q) => q.sql.startsWith("INSERT INTO sec_user_permission_override"));
            expect(overrides).toHaveLength(12);
            expect(overrides[0]?.parameters).toEqual([7, 2, "allow", "allow", "active", "2020-01-01", "2030-01-01", 1, "2020-01-01", null, null]);
            expect(overrides[1]?.parameters).toContain("deny");
            expect(changed.some((q) => q.sql.startsWith("UPDATE sec_permission"))).toBe(true);
            expect(changed.some((q) => q.sql.includes("status_user='active'"))).toBe(true);
            expect(f.transactions).toEqual(["begin", "commit"]);
            const count = changed.length;
            await migration.up(f.db);
            expect(writes(f)).toHaveLength(count);
        } finally {
            await f.db.destroy();
        }
    });
    it("copies revoked override history without losing attribution or temporal bounds", async () => {
        const f = fixture({ revokedOverride: true });
        try {
            await migration.up(f.db);
            const copies = writes(f).filter((q) => q.sql.startsWith("INSERT INTO sec_user_permission_override") && q.parameters.includes("revoked"));
            expect(copies).toHaveLength(6);
            expect(copies[0]?.parameters).toEqual([7, 2, "deny", "revoked", "inactive", "2018-01-01", "2019-01-01", 2, "2018-01-01", 3, "2019-01-01"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("exposes all six independent labels in the existing home permission catalog", async () => {
        const f = fixture();
        try {
            const repository = new IdentityAccessManagementRepository({ db: f.db } as unknown as DatabaseService, {} as SecurityAuditService, {} as IdentitySessionRepository);
            const catalog = await repository.readSecurityCatalog();
            const permissions = catalog.modules.find((m) => m.code === "formalizacion")?.views.find((v) => v.code === "home")?.permissions;
            for (const definition of definitions) expect(permissions).toContainEqual({ code: definition.code, description: definition.description, name: definition.description, sensitive: false });
        } finally {
            await f.db.destroy();
        }
    });
    it("preserves entire preexisting per-banner grant and override configuration, including revoked/deny rows", async () => {
        const f = fixture({ existing: true });
        try {
            await migration.up(f.db);
            const changed = writes(f);
            expect(changed.filter((q) => q.sql.startsWith("INSERT INTO sec_role_permission"))).toHaveLength(10);
            expect(changed.filter((q) => q.sql.startsWith("INSERT INTO sec_user_permission_override"))).toHaveLength(10);
            expect(changed.filter((q) => q.sql.startsWith("INSERT INTO sec_role_permission") || q.sql.startsWith("INSERT INTO sec_user_permission_override")).every((q) => q.parameters[1] !== 2)).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ database: "legacy" }, { engine: "MyISAM" }, { missingTable: true }, ...tables.map((unsafeTable) => ({ unsafeTable })), { drift: true }, { inactive: true }, { actorMissing: true }])("fails closed before writes: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(migration.up(f.db)).rejects.toThrow(anyOf("Formalization banner permissions require CRM_THINK_V2", "Formalization banner permissions require native InnoDB security tables", "Conflicting banner permission definition; reconciliation required", "Formalization banner permissions require Owner migration attribution"));
            expect(writes(f)).toEqual([]);
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ failAudit: true }, { failCopy: true }])("rolls back provisioning when a security write fails: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(migration.up(f.db)).rejects.toThrow("audit unavailable");
            expect(f.permissions()).toEqual([old]);
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
});
