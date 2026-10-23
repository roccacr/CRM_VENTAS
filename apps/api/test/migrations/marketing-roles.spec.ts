import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";

import { marketingRolesMigration } from "../../migrations/schema-only/202610230028_marketing_roles.js";

const catalogs = ["project", "campaign", "class", "broker", "file", "subsidiary", "location"].map((name) => `mercadeo.catalog_${name}.read`);
const sections = ["home", "leads", "appointments", "calendar"].map((name) => `mercadeo.${name}.read`);
type Role = { id: number; code: string; name: string; description: string; status: string; deleted: null; mode: string };
type Permission = { id: number; code: string; module: string; action: string; status: string };

function fixture(options: { destination?: string; inactiveRole?: boolean; inactivePermission?: boolean; revokedGrant?: boolean; inactiveModule?: boolean; noActor?: boolean; failAudit?: boolean; unsafeEngine?: boolean } = {}) {
    const queries: CompiledQuery[] = [];
    const state = { roles: [] as Role[], permissions: catalogs.map((code, index): Permission => ({ id: index + 1, code, module: "mercadeo", action: "read", status: options.inactivePermission ? "inactive" : "active" })), grants: [] as { roleId: number; code: string; status: string }[], audits: 0, versions: 0 };
    if (options.inactiveRole) state.roles.push({ id: 1, code: "mercadeo", name: "Mercadeo", description: "Existing", status: "inactive", deleted: null, mode: "assigned" });
    if (options.revokedGrant) {
        state.roles.push({ id: 1, code: "mercadeo", name: "Mercadeo", description: "Existing", status: "active", deleted: null, mode: "assigned" });
        state.grants.push({ roleId: 1, code: "mercadeo.catalog_project.read", status: "inactive" });
    }
    let snapshot = structuredClone(state);
    const driver = new DummyDriver();
    driver.beginTransaction = () => {
        snapshot = structuredClone(state);
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        Object.assign(state, snapshot);
        return Promise.resolve();
    };
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        // Interpret actual compiled SQL to exercise atomicity and idempotency without shared-DB fixtures.
        // eslint-disable-next-line complexity, sonarjs/cognitive-complexity
        connection.executeQuery = (query) => {
            queries.push(query);
            const statement = query.sql.trim();
            let rows: object[] = [];
            if (statement.startsWith("SELECT DATABASE")) rows = [{ name: options.destination ?? "CRM_THINK_V2" }];
            else if (statement.includes("information_schema.TABLES")) rows = ["sec_role", "sec_permission", "sec_role_permission", "sec_org_unit", "sec_user", "sec_user_role", "sec_user_permission_override", "audit_security_event"].map((name) => ({ name, engine: options.unsafeEngine ? "MyISAM" : "InnoDB" }));
            else if (statement.startsWith("SELECT id_org_unit")) rows = options.inactiveModule ? [] : [{ id: 50 }];
            else if (statement.startsWith("SELECT u.id_user")) rows = options.noActor ? [] : [{ id: 100, publicId: "owner-public", name: "Owner" }];
            else if (statement.startsWith("SELECT id_role")) rows = state.roles.filter((role) => role.code === query.parameters[0]);
            else if (statement.startsWith("INSERT INTO sec_role (")) state.roles.push({ id: state.roles.length + 1, code: String(query.parameters[0]), name: String(query.parameters[1]), description: String(query.parameters[2]), status: "active", deleted: null, mode: "assigned" });
            else if (statement.startsWith("SELECT id_permission")) rows = state.permissions.filter((permission) => permission.code === query.parameters[0]);
            else if (statement.startsWith("INSERT INTO sec_permission")) state.permissions.push({ id: state.permissions.length + 1, code: String(query.parameters[0]), module: "mercadeo", action: "read", status: "active" });
            else if (statement.startsWith("SELECT p.code_permission")) rows = state.grants.filter((grant) => grant.roleId === query.parameters[0]);
            else if (statement.startsWith("INSERT INTO sec_role_permission")) state.grants.push({ roleId: Number(query.parameters[0]), code: String(query.parameters[1]), status: "active" });
            else if (statement.startsWith("UPDATE sec_user")) state.versions++;
            else if (statement.startsWith("INSERT INTO audit_security_event")) {
                if (options.failAudit) return Promise.reject(new Error("Injected audit failure"));
                state.audits++;
            } else return Promise.reject(new Error(`Unexpected SQL: ${statement}`));
            return Promise.resolve({ rows: rows as never[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, state, queries };
}

describe("Marketing roles migration without shared MySQL fixtures", () => {
    it("creates two ordinary roles with only eleven read grants each and is idempotent", async () => {
        const f = fixture();
        try {
            await marketingRolesMigration.up(f.db);
            expect(f.state.roles.map(({ code, name, mode }) => ({ code, name, mode }))).toEqual([
                { code: "mercadeo", name: "Mercadeo", mode: "assigned" },
                { code: "jefe_mercadeo", name: "Jefe de Mercadeo", mode: "assigned" },
            ]);
            for (const role of f.state.roles)
                expect(
                    f.state.grants
                        .filter((grant) => grant.roleId === role.id)
                        .map((grant) => grant.code)
                        .sort(),
                ).toEqual([...catalogs, ...sections].sort());
            expect(f.state.audits).toBe(2);
            expect(f.state.versions).toBe(1);
            await marketingRolesMigration.up(f.db);
            expect(f.state.grants).toHaveLength(22);
            expect(f.state.audits).toBe(2);
            expect(f.state.versions).toBe(1);
            const statements = f.queries.map((query) => query.sql).join("\n");
            expect(statements).not.toMatch(/INSERT INTO sec_user_role|INSERT INTO sec_user_org_unit|UPDATE sec_user_permission_override|DELETE|ALTER TABLE|crmdatabase-api/);
            expect(statements).toContain("role_inheritance_mode_role='all_active_roles'");
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ destination: "other" }, { inactiveRole: true }, { inactivePermission: true }, { revokedGrant: true }, { inactiveModule: true }, { noActor: true }, { unsafeEngine: true }, { failAudit: true }])("rejects and rolls back unsafe state: %j", async (options) => {
        const f = fixture(options);
        const initial = structuredClone(f.state);
        try {
            await expect(marketingRolesMigration.up(f.db)).rejects.toThrow();
            expect(f.state).toEqual(initial);
        } finally {
            await f.db.destroy();
        }
    });
});
