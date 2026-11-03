import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import { leadProfilePermissionMigration as migration } from "../../migrations/schema-only/202611020060_lead_profile_permission.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";

const code = "lead.profile.read";
const description = "Ver perfil completo del lead";
const definition = { code, module: "lead", action: "read", description, status: "active" };
const tableNames = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"];

type Options = { database?: string; tables?: object[]; permissions?: Record<string, unknown>[]; roles?: object[]; actors?: object[]; grants?: { role: number; code: string; status: string }[]; failAudit?: boolean };
function fixture(options: Options = {}) {
    const queries: CompiledQuery[] = [];
    const transactions: string[] = [];
    let permissions = options.permissions ?? [];
    const grants = [...(options.grants ?? [])];
    const database = options.database ?? "CRM_THINK_V2";
    const tables = options.tables ?? tableNames.map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" }));
    const roles = options.roles ?? ["owner", "formalizacion", "jefe_formalizaciones", "jefe_general"].map((code, index) => ({ id: 19 + index, code, status: "active", deleted: null }));
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
                ["from `sec_permission`", [{ actionCode: "read", code, description, moduleCode: "lead" }]],
            ];
            return Promise.resolve({ rows: (inventory.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? []) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, transactions };
}
const writes = (queries: CompiledQuery[]) => queries.filter((query) => !query.sql.startsWith("SELECT"));

describe("permiso global del perfil completo", () => {
    it("impide delegar el permiso global cuando el actor tiene un deny", async () => {
        const f = fixture();
        const repository = new IdentityAccessManagementRepository({ db: f.db } as never, {} as never, {} as never);
        vi.spyOn(repository, "readRolePermissions").mockResolvedValue({ permissionCodes: [code], role: { code: "formalizacion", moduleScoped: true, permissionInheritance: "assigned", moduleCodes: ["formalizacion"] } } as never);
        const profile = { roles: [{ code: "formalizacion", status: "active" }], orgUnits: [{ code: "formalizacion", status: "active" }], permissions: [{ code, effect: "deny" }] };
        try {
            await expect(repository.assertDelegableAccess(profile as never, ["formalizacion"], ["formalizacion"], [], f.db as never)).rejects.toMatchObject({ status: 403 });
        } finally {
            await f.db.destroy();
        }
    });
    it("registra únicamente 060 al seleccionarla", () => {
        expect(selectSchemaMigrations(migration.name)).toEqual([migration]);
    });
    it("asigna solo Formalización, audita e invalida versiones; repetir no escribe", async () => {
        const f = fixture();
        try {
            await migration.up(f.db);
            expect(writes(f.queries)).toHaveLength(7);
            expect(writes(f.queries)[0]?.parameters).toEqual([code, "lead", "read", description, "active"]);
            expect(f.queries.filter((query) => query.sql.startsWith("INSERT INTO sec_role_permission")).map((query) => query.parameters[0])).toEqual([19, 20, 21, 22]);
            await migration.up(f.db);
            expect(writes(f.queries)).toHaveLength(7);
            expect(f.queries.map((query) => query.sql).join(" ")).not.toMatch(/crmdatabase-api|sec_user_permission_override|DELETE/);
        } finally {
            await f.db.destroy();
        }
    });
    it("preserva una asignación inactiva sin reactivarla", async () => {
        const f = fixture({ permissions: [definition], grants: [19, 20, 21, 22].map((role) => ({ role, code, status: "inactive" })) });
        try {
            await migration.up(f.db);
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("revierte cuando no puede registrar auditoría", async () => {
        const f = fixture({ failAudit: true });
        try {
            await expect(migration.up(f.db)).rejects.toThrow("audit unavailable");
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
});
