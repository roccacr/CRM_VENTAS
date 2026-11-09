import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";

import { ownerRoleInheritanceMigration } from "../../migrations/schema-only/202610230027_owner_role_inheritance.js";
import { anyOf } from "../support/throws.js";

function fixture(options: { destination?: string; incompatibleColumn?: boolean; failAudit?: boolean; inactiveGrant?: boolean; unsafeEngine?: boolean; noActor?: boolean } = {}) {
    const queries: CompiledQuery[] = [];
    const state = { column: false, inherited: false, permission: false, grants: [] as number[], audits: 0, versions: 0 };
    let snapshot = structuredClone(state);
    const driver = new DummyDriver();
    driver.beginTransaction = () => {
        snapshot = structuredClone(state);
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        const column = state.column;
        Object.assign(state, snapshot, { column });
        return Promise.resolve();
    };
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        // Explicit SQL interpreter keeps the independent DDL/DML rollback model visible.
        // eslint-disable-next-line complexity, sonarjs/cognitive-complexity
        connection.executeQuery = (query) => {
            queries.push(query);
            const statement = query.sql.trim();
            let rows: object[] = [];
            if (statement.startsWith("SELECT DATABASE")) rows = [{ name: options.destination ?? "CRM_THINK_V2" }];
            else if (statement.includes("information_schema.TABLES")) rows = ["sec_role", "sec_permission", "sec_role_permission", "sec_user", "sec_user_role", "sec_user_permission_override", "audit_security_event"].map((name) => ({ name, engine: options.unsafeEngine ? "MyISAM" : "InnoDB" }));
            else if (statement.includes("information_schema.COLUMNS")) rows = options.incompatibleColumn ? [{ type: "varchar(30)", nullable: "YES", defaultValue: null }] : state.column ? [{ type: "enum('assigned','all_active_roles')", nullable: "NO", defaultValue: "assigned" }] : [];
            else if (statement.startsWith("ALTER TABLE sec_role")) state.column = true;
            else if (statement.startsWith("SELECT id_role AS id"))
                rows = [
                    { id: 1, code: "owner", mode: state.inherited ? "all_active_roles" : "assigned", status: "active", deleted: null },
                    { id: 2, code: "formalizacion", mode: "assigned", status: "active", deleted: null },
                ];
            else if (statement.startsWith("SELECT module_code_permission")) rows = state.permission ? [{ module: "formalizacion", action: "read", status: "active" }] : [];
            else if (statement.startsWith("SELECT rp.role_id_role_permission")) rows = options.inactiveGrant ? [{ roleId: 2, status: "inactive" }] : state.grants.map((roleId) => ({ roleId, status: "active" }));
            else if (statement.startsWith("SELECT u.id_user AS id")) rows = options.noActor ? [] : [{ id: 10, publicId: "owner-public", name: "Owner" }];
            else if (statement.startsWith("INSERT INTO sec_permission")) state.permission = true;
            else if (statement.startsWith("INSERT INTO sec_role_permission")) state.grants.push(Number(query.parameters[0]));
            else if (statement.startsWith("UPDATE sec_role SET")) state.inherited = true;
            else if (statement.startsWith("UPDATE sec_user")) state.versions++;
            else if (statement.startsWith("INSERT INTO audit_security_event")) {
                if (options.failAudit) return Promise.reject(new Error("Injected audit failure"));
                state.audits++;
            }
            return Promise.resolve({ rows: rows as never[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, state, queries };
}

describe("Owner inheritance migration, without MySQL fixtures", () => {
    it("persists role policy and stage grants, preserves overrides and direct user roles, and is idempotent", async () => {
        const f = fixture();
        try {
            await ownerRoleInheritanceMigration.up(f.db);
            expect(f.state).toEqual({ column: true, inherited: true, permission: true, grants: [1, 2], audits: 1, versions: 1 });
            await ownerRoleInheritanceMigration.up(f.db);
            expect(f.state.audits).toBe(1);
            expect(f.state.versions).toBe(1);
            expect(f.state.grants).toEqual([1, 2]);
            expect(f.queries.map((query) => query.sql).join("\n")).not.toMatch(/INSERT INTO sec_user_role|UPDATE sec_user_role|DELETE|UPDATE sec_user_permission_override|crmdatabase-api/);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ destination: "crmdatabase-api" }, { incompatibleColumn: true }, { inactiveGrant: true }, { unsafeEngine: true }, { noActor: true }])("rejects unsafe configuration: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(ownerRoleInheritanceMigration.up(f.db)).rejects.toThrow(anyOf("Owner inheritance requires CRM_THINK_V2", "Owner inheritance column conflicts with existing schema", "Stage read grant was revoked; refusing silent reactivation", "Owner inheritance requires all identity/audit tables to be InnoDB", "Owner inheritance requires an active Owner without a role.assign deny; recovery "));
            expect(f.state.inherited).toBe(false);
            expect(f.state.audits).toBe(0);
        } finally {
            await f.db.destroy();
        }
    });
    it("rolls back policy, grants and versions if audit fails, retaining only the inert additive column", async () => {
        const f = fixture({ failAudit: true });
        try {
            await expect(ownerRoleInheritanceMigration.up(f.db)).rejects.toThrow("Injected audit failure");
            expect(f.state).toEqual({ column: true, inherited: false, permission: false, grants: [], audits: 0, versions: 0 });
        } finally {
            await f.db.destroy();
        }
    });
});
