import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";

import { generalManagerTemplateMigration } from "../../migrations/schema-only/202610230030_general_manager_template.js";

const modules = ["ventas", "mercadeo", "formalizacion", "contabilidad"].map((code, i) => ({ id: i + 10, code, status: "active", deleted: null }));
const permissions = modules.map((module, i) => ({ id: i + 20, code: `${module.code}.read`, module: module.code, status: "active" }));
const columns = [
    { table: "sec_role", name: "role_inheritance_mode_role", type: "enum('assigned','all_active_roles')", nullable: "NO", defaultValue: "assigned" },
    { table: "sec_role", name: "permission_inheritance_mode_role", type: "enum('assigned','selected_modules')", nullable: "NO", defaultValue: "assigned" },
    ...["role_id_role_module", "org_unit_id_role_module"].map((name) => ({ table: "sec_role_module", name, type: "bigint unsigned", nullable: "NO", defaultValue: null })),
    { table: "sec_role_module", name: "status_role_module", type: "varchar(30)", nullable: "NO", defaultValue: "active" },
    ...["created_at_role_module", "updated_at_role_module"].map((name) => ({ table: "sec_role_module", name, type: "datetime(3)", nullable: "NO", defaultValue: "utc_timestamp(3)" })),
];
type Options = { wrongDb?: boolean; unsafeEngine?: boolean; badSchema?: boolean; missing029?: boolean; noActor?: boolean; inactiveRole?: boolean; missingModule?: boolean; revokedMap?: boolean; revokedGrant?: boolean; adminGrant?: boolean; failAudit?: boolean; roleName?: string };
function fixture(options: Options = {}) {
    const queries: CompiledQuery[] = [];
    const state = { maps: [] as { moduleId: number; code: string; status: string }[], grants: [] as { permissionId: number; code: string; module: string; status: string; permissionStatus: string }[], audits: [] as object[], versions: 0 };
    if (options.revokedMap) state.maps.push({ moduleId: 10, code: "ventas", status: "inactive" });
    if (options.revokedGrant) state.grants.push({ permissionId: 20, code: "ventas.read", module: "ventas", status: "inactive", permissionStatus: "active" });
    if (options.adminGrant) state.grants.push({ permissionId: 99, code: "role.assign", module: "role", status: "active", permissionStatus: "active" });
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
        // Interprets compiled DML in memory; no pool, .env, fixture writes or DDL.
        // eslint-disable-next-line complexity, sonarjs/cognitive-complexity
        connection.executeQuery = (query) => {
            queries.push(query);
            const text = query.sql.trim();
            let rows: object[] = [];
            if (text.startsWith("SELECT DATABASE")) rows = [{ name: options.wrongDb ? "crmdatabase-api" : "CRM_THINK_V2" }];
            else if (text.includes("information_schema.TABLES")) rows = ["sec_role", "sec_role_module", "sec_org_unit", "sec_permission", "sec_role_permission", "sec_user", "sec_user_role", "sec_user_permission_override", "audit_security_event", "conf_schema_migration"].map((name) => ({ name, engine: options.unsafeEngine ? "MyISAM" : "InnoDB" }));
            else if (text.includes("information_schema.COLUMNS")) rows = options.badSchema ? columns.slice(1) : columns;
            else if (text.includes("FROM conf_schema_migration")) rows = options.missing029 ? [] : [{ id: 1 }];
            else if (text.startsWith("SELECT u.id_user")) rows = options.noActor ? [] : [{ id: 1, publicId: "owner", name: "Owner" }];
            else if (text.startsWith("SELECT id_role")) rows = [{ id: 7, code: "jefe_general", name: options.roleName ?? "Jefe General", status: options.inactiveRole ? "inactive" : "active", deleted: null, roleMode: "assigned", permissionMode: "selected_modules" }];
            else if (text.startsWith("SELECT id_org_unit")) rows = options.missingModule ? modules.slice(1) : modules;
            else if (text.startsWith("SELECT id_permission")) rows = permissions;
            else if (text.startsWith("SELECT rm.org_unit_id")) rows = state.maps;
            else if (text.startsWith("SELECT rp.permission_id")) rows = state.grants;
            else if (text.startsWith("SELECT id_security_event")) rows = state.audits.length ? [{ id: 1 }] : [];
            else if (text.startsWith("INSERT INTO sec_role_module")) {
                const module = modules.find((module) => module.id === Number(query.parameters[1]));
                if (module) state.maps.push({ moduleId: module.id, code: module.code, status: "active" });
            } else if (text.startsWith("INSERT INTO sec_role_permission")) {
                const permission = permissions.find((permission) => permission.id === Number(query.parameters[1]));
                if (permission) state.grants.push({ permissionId: permission.id, code: permission.code, module: permission.module, status: "active", permissionStatus: "active" });
            } else if (text.startsWith("UPDATE sec_user")) state.versions++;
            else if (text.startsWith("INSERT INTO audit_security_event")) {
                if (options.failAudit) throw new Error("Injected audit failure");
                state.audits.push(JSON.parse(String(query.parameters.at(-1))) as object);
            } else throw new Error("Unexpected SQL: " + text);
            return Promise.resolve({ rows: structuredClone(rows) as never[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, state, queries };
}
describe("General editable template migration without database", () => {
    it("persists four modules and current operational grants, audits and versions once", async () => {
        const f = fixture();
        try {
            await generalManagerTemplateMigration.up(f.db);
            expect(f.state.maps.map((row) => row.code)).toEqual(modules.map((module) => module.code));
            expect(f.state.grants.map((row) => row.code)).toEqual(permissions.map((permission) => permission.code));
            expect(f.state.audits[0]).toMatchObject({ migration: "202610230030_general_manager_template", changeSet: { before: { mappings: [], permissions: [] }, after: { mappings: f.state.maps, permissions: f.state.grants } } });
            await generalManagerTemplateMigration.up(f.db);
            expect(f.state.audits).toHaveLength(1);
            expect(f.state.versions).toBe(1);
            const text = f.queries.map((query) => query.sql).join("\n");
            expect(text).not.toMatch(/ALTER TABLE|CREATE TABLE|INSERT INTO sec_user_role|INSERT INTO sec_user_org_unit|UPDATE sec_role SET|DELETE FROM|crmdatabase-api/);
            expect(text).toContain("r.role_inheritance_mode_role='all_active_roles'");
        } finally {
            await f.db.destroy();
        }
    });
    it("does not reseed an Owner-edited template after its one-time audit", async () => {
        const f = fixture();
        try {
            await generalManagerTemplateMigration.up(f.db);
            f.state.maps = [];
            f.state.grants = [];
            await generalManagerTemplateMigration.up(f.db);
            expect(f.state.maps).toEqual([]);
            expect(f.state.grants).toEqual([]);
            expect(f.state.audits).toHaveLength(1);
            expect(f.state.versions).toBe(1);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([
        { options: { wrongDb: true }, error: "requires CRM_THINK_V2" },
        { options: { unsafeEngine: true }, error: "requires InnoDB" },
        { options: { badSchema: true }, error: "identity schema conflicts" },
        { options: { missing029: true }, error: "requires applied migration 029" },
        { options: { noActor: true }, error: "active capable Owner" },
        { options: { inactiveRole: true }, error: "compatible Jefe General" },
        { options: { missingModule: true }, error: "all four active operational modules" },
        { options: { revokedMap: true }, error: "module mapping was revoked" },
        { options: { revokedGrant: true }, error: "permission was revoked" },
        { options: { adminGrant: true }, error: "non-operational grant" },
    ])("refuses unsafe or revoked prerequisites $options", async ({ options, error }) => {
        const f = fixture(options);
        try {
            await expect(generalManagerTemplateMigration.up(f.db)).rejects.toThrow(error);
            expect(f.state.audits).toEqual([]);
            expect(f.state.versions).toBe(0);
        } finally {
            await f.db.destroy();
        }
    });
    it("rolls back maps, grants and versions if audit fails", async () => {
        const f = fixture({ failAudit: true });
        try {
            await expect(generalManagerTemplateMigration.up(f.db)).rejects.toThrow("Injected audit failure");
            expect(f.state).toEqual({ maps: [], grants: [], audits: [], versions: 0 });
        } finally {
            await f.db.destroy();
        }
    });
    it("preserves compatible existing rows and inserts only missing template entries", async () => {
        const f = fixture();
        f.state.maps.push({ moduleId: 10, code: "ventas", status: "active" });
        f.state.grants.push({ permissionId: 20, code: "ventas.read", module: "ventas", status: "active", permissionStatus: "active" });
        try {
            await generalManagerTemplateMigration.up(f.db);
            expect(f.state.maps).toHaveLength(4);
            expect(f.state.grants).toHaveLength(4);
            expect(f.queries.filter((query) => query.sql.trim().startsWith("INSERT INTO sec_role_module"))).toHaveLength(3);
            expect(f.queries.filter((query) => query.sql.trim().startsWith("INSERT INTO sec_role_permission"))).toHaveLength(3);
            const permissionQuery = f.queries.find((query) => query.sql.trim().startsWith("SELECT id_permission"));
            expect(permissionQuery?.sql).toContain("status_permission='active' AND module_code_permission IN");
            expect(permissionQuery?.parameters).toEqual(["ventas", "mercadeo", "formalizacion", "contabilidad"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("preserves subsequent Owner revocations on replay", async () => {
        const f = fixture();
        try {
            await generalManagerTemplateMigration.up(f.db);
            for (const row of f.state.maps) row.status = "inactive";
            for (const row of f.state.grants) row.status = "inactive";
            await generalManagerTemplateMigration.up(f.db);
            expect(f.state.maps.every((row) => row.status === "inactive")).toBe(true);
            expect(f.state.grants.every((row) => row.status === "inactive")).toBe(true);
            expect(f.state.versions).toBe(1);
        } finally {
            await f.db.destroy();
        }
    });
    it("accepts an Owner display-name edit on replay using stable role code", async () => {
        const options = { roleName: "Jefe General" };
        const f = fixture(options);
        try {
            await generalManagerTemplateMigration.up(f.db);
            options.roleName = "Direccion General";
            await generalManagerTemplateMigration.up(f.db);
            expect(f.state.audits).toHaveLength(1);
            expect(f.state.versions).toBe(1);
        } finally {
            await f.db.destroy();
        }
    });
});
