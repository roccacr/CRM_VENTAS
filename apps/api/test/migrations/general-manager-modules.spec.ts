import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";

import { generalManagerModulesMigration } from "../../migrations/schema-only/202610230029_general_manager_modules.js";

const column = { name: "permission_inheritance_mode_role", type: "enum('assigned','selected_modules')", nullable: "NO", defaultValue: "assigned", extra: "", comment: "Politica de permisos", collation: "utf8mb4_unicode_ci" };
const mappingColumns = [
    { name: "role_id_role_module", type: "bigint unsigned", nullable: "NO", defaultValue: null, extra: "", comment: "Rol" },
    { name: "org_unit_id_role_module", type: "bigint unsigned", nullable: "NO", defaultValue: null, extra: "", comment: "Modulo" },
    { name: "status_role_module", type: "varchar(30)", nullable: "NO", defaultValue: "active", extra: "", comment: "Estado" },
    { name: "created_at_role_module", type: "datetime(3)", nullable: "NO", defaultValue: "utc_timestamp(3)", extra: "DEFAULT_GENERATED", comment: "Creacion UTC" },
    { name: "updated_at_role_module", type: "datetime(3)", nullable: "NO", defaultValue: "utc_timestamp(3)", extra: "DEFAULT_GENERATED", comment: "Actualizacion UTC" },
].map((column) => ({ ...column, collation: column.type === "varchar(30)" ? "utf8mb4_unicode_ci" : null }));
type Options = { wrongDb?: boolean; unsafeEngine?: boolean; badColumn?: boolean; badMap?: boolean; badIndex?: boolean; badFk?: boolean; noActor?: boolean; revokedMap?: boolean; inactiveManager?: boolean; failAudit?: boolean; missingModule?: boolean; adoptedSchema?: boolean; badTimestamp?: boolean; allModules?: boolean };
function fixture(options: Options = {}) {
    const queries: CompiledQuery[] = [];
    const roles = [
        { id: 1, code: "owner", name: "Owner", status: "active", deleted: null, roleMode: "all_active_roles", permissionMode: "assigned" },
        { id: 2, code: "formalizacion", name: "Formalizacion", status: "active", deleted: null, roleMode: "assigned", permissionMode: "assigned" },
        { id: 3, code: "jefe_formalizaciones", name: "Jefe de Formalizaciones", status: "active", deleted: null, roleMode: "assigned", permissionMode: "assigned" },
        { id: 4, code: "subjefe_area", name: "Subjefe", status: "active", deleted: null, roleMode: "assigned", permissionMode: "assigned" },
    ];
    const state = { column: false, table: false, roles, maps: [] as { roleId: number; moduleId: number; status: string }[], audits: [] as object[], versions: 0 };
    if (options.adoptedSchema || options.badTimestamp) {
        state.column = true;
        state.table = true;
    }
    if (options.allModules) for (const [i, code] of ["ventas", "mercadeo", "contabilidad", "jefe_mercadeo"].entries()) state.roles.push({ id: i + 6, code, name: code, status: "active", deleted: null, roleMode: "assigned", permissionMode: "assigned" });
    if (options.revokedMap) state.maps.push({ roleId: 2, moduleId: 10, status: "inactive" });
    if (options.inactiveManager) state.roles.push({ id: 5, code: "jefe_general", name: "Jefe General", status: "inactive", deleted: null, roleMode: "assigned", permissionMode: "assigned" });
    let snapshot = structuredClone(state);
    let inTransaction = false;
    const driver = new DummyDriver();
    driver.beginTransaction = () => {
        inTransaction = true;
        snapshot = structuredClone(state);
        return Promise.resolve();
    };
    driver.commitTransaction = () => {
        inTransaction = false;
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        Object.assign(state, snapshot);
        inTransaction = false;
        return Promise.resolve();
    };
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        // This interpreter models inert DDL separately from transactional policy/audit writes.
        // eslint-disable-next-line complexity, sonarjs/cognitive-complexity
        connection.executeQuery = (query) => {
            queries.push(query);
            const text = query.sql.trim();
            let rows: object[] = [];
            if (text.startsWith("SELECT DATABASE")) rows = [{ name: options.wrongDb ? "crmdatabase-api" : "CRM_THINK_V2" }];
            else if (text.includes("information_schema.SCHEMATA")) rows = [{ collation: "utf8mb4_unicode_ci" }];
            else if (text.includes("information_schema.TABLES")) rows = ["sec_role", "sec_org_unit", "sec_permission", "sec_role_permission", "sec_user", "sec_user_role", "sec_user_permission_override", "audit_security_event", ...(state.table || options.badMap || options.badIndex || options.badFk ? ["sec_role_module"] : [])].map((name) => ({ name, engine: options.unsafeEngine ? "MyISAM" : "InnoDB", collation: "utf8mb4_unicode_ci" }));
            else if (text.includes("information_schema.COLUMNS")) rows = query.parameters.includes("sec_role") ? (options.badColumn ? [{ ...column, nullable: "YES" }] : state.column ? [column] : []) : options.badMap ? mappingColumns.slice(1) : options.badTimestamp ? mappingColumns.map((column) => (column.name === "updated_at_role_module" ? { ...column, defaultValue: "current_timestamp(3)" } : column)) : mappingColumns;
            else if (text.includes("information_schema.STATISTICS"))
                rows = [{ name: "PRIMARY", nonUnique: 0, position: 1, column: "role_id_role_module" }, { name: "PRIMARY", nonUnique: 0, position: 2, column: "org_unit_id_role_module" }, ...["org_unit_id_role_module", "status_role_module", "role_id_role_module"].map((column, i) => ({ name: "ix_sec_role_module_org_status", nonUnique: 1, position: i + 1, column: options.badIndex ? "wrong" : column }))].map((index) => ({ ...index, prefix: null, type: "BTREE", visible: "YES" }));
            else if (text.includes("information_schema.KEY_COLUMN_USAGE"))
                rows = [
                    ["role_id_role_module", "sec_role", "id_role"],
                    ["org_unit_id_role_module", "sec_org_unit", "id_org_unit"],
                ].map(([column, table, target]) => ({ column, table, target, schema: "CRM_THINK_V2", updateRule: "RESTRICT", deleteRule: options.badFk ? "CASCADE" : "RESTRICT" }));
            else if (text.startsWith("ALTER TABLE")) {
                expect(inTransaction).toBe(false);
                state.column = true;
            } else if (text.startsWith("CREATE TABLE")) {
                expect(inTransaction).toBe(false);
                state.table = true;
            } else if (text.startsWith("SELECT u.id_user AS id")) rows = options.noActor ? [] : [{ id: 20, publicId: "owner-public", name: "Owner" }];
            else if (text.startsWith("SELECT id_role AS id")) rows = state.roles;
            else if (text.startsWith("SELECT id_org_unit AS id")) rows = options.missingModule ? [] : options.allModules ? ["formalizacion", "ventas", "mercadeo", "contabilidad", "administration"].map((code, i) => ({ id: i + 10, code, status: "active", deleted: null })) : [{ id: 10, code: "formalizacion", status: "active", deleted: null }];
            else if (text.startsWith("SELECT role_id_role_module")) rows = state.maps;
            else if (text.startsWith("SELECT id_security_event")) rows = state.audits.length ? [{ id: 1 }] : [];
            else if (text.startsWith("INSERT INTO sec_role (")) state.roles.push({ id: 5, code: "jefe_general", name: "Jefe General", status: "active", deleted: null, roleMode: "assigned", permissionMode: "assigned" });
            else if (text.startsWith("UPDATE sec_role SET permission")) {
                const role = state.roles.find((role) => role.id === Number(query.parameters[0]));
                if (role) role.permissionMode = "selected_modules";
            } else if (text.startsWith("INSERT INTO sec_role_module")) state.maps.push({ roleId: Number(query.parameters[0]), moduleId: Number(query.parameters[1]), status: "active" });
            else if (text.startsWith("UPDATE sec_user")) state.versions++;
            else if (text.startsWith("INSERT INTO audit_security_event")) {
                if (options.failAudit) throw new Error("Injected audit failure");
                state.audits.push(JSON.parse(String(query.parameters.at(-1))) as object);
            } else if (!text.startsWith("SET SESSION")) throw new Error("Unexpected SQL " + text);
            return Promise.resolve({ rows: structuredClone(rows) as never[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, state, queries };
}
describe("general manager module migration without a database", () => {
    it("seeds only known present modules, creates the manager without assignments/grants, and audits full before/after once", async () => {
        const f = fixture();
        try {
            await generalManagerModulesMigration.up(f.db);
            expect(f.state.maps).toEqual([
                { roleId: 2, moduleId: 10, status: "active" },
                { roleId: 3, moduleId: 10, status: "active" },
            ]);
            expect(f.state.roles.find((role) => role.code === "jefe_general")).toMatchObject({ roleMode: "assigned", permissionMode: "selected_modules" });
            expect(f.state.audits).toHaveLength(1);
            expect(f.state.audits[0]).toMatchObject({ migration: "202610230029_general_manager_modules", changeSet: { before: { mappings: [] }, after: { mappings: f.state.maps } } });
            await generalManagerModulesMigration.up(f.db);
            expect(f.state.audits).toHaveLength(1);
            expect(f.state.versions).toBe(1);
            const sql = f.queries.map((query) => query.sql).join("\n");
            expect(sql).not.toMatch(/INSERT INTO sec_user_role|INSERT INTO sec_role_permission|UPDATE sec_user_permission_override|crmdatabase-api/);
            expect(sql).toContain("role_inheritance_mode_role='all_active_roles'");
            expect(sql).toContain("o.effect_user_permission_override='deny'");
            expect(sql).toContain("p.code_permission='role.assign'");
        } finally {
            await f.db.destroy();
        }
    });
    it.each([
        { options: { wrongDb: true }, error: "require CRM_THINK_V2" },
        { options: { unsafeEngine: true }, error: "require InnoDB" },
        { options: { badColumn: true }, error: "column conflicts" },
        { options: { badMap: true }, error: "columns conflict" },
        { options: { badIndex: true }, error: "indexes conflict" },
        { options: { badFk: true }, error: "foreign keys conflict" },
        { options: { badTimestamp: true }, error: "columns conflict" },
        { options: { noActor: true }, error: "active capable Owner" },
        { options: { revokedMap: true }, error: "mapping was revoked" },
        { options: { inactiveManager: true }, error: "Jefe General conflicts" },
    ])("refuses unsafe/conflicting state $options", async ({ options, error }) => {
        const f = fixture(options);
        try {
            await expect(generalManagerModulesMigration.up(f.db)).rejects.toThrow(error);
            expect(f.state.audits).toHaveLength(0);
            expect(f.state.versions).toBe(0);
        } finally {
            await f.db.destroy();
        }
    });
    it("rolls back all policy/mapping/version changes on audit failure, retaining inert DDL", async () => {
        const f = fixture({ failAudit: true });
        try {
            await expect(generalManagerModulesMigration.up(f.db)).rejects.toThrow("Injected audit failure");
            expect(f.state).toMatchObject({ column: true, table: true, maps: [], audits: [], versions: 0 });
            expect(f.state.roles.some((role) => role.code === "jefe_general")).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("does not invent missing operational modules", async () => {
        const f = fixture({ missingModule: true });
        try {
            await generalManagerModulesMigration.up(f.db);
            expect(f.state.maps).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("reuses a compatible active manager without altering existing role inheritance", async () => {
        const f = fixture();
        f.state.roles.push({ id: 5, code: "jefe_general", name: "Jefe General", status: "active", deleted: null, roleMode: "assigned", permissionMode: "assigned" });
        try {
            await generalManagerModulesMigration.up(f.db);
            expect(f.queries.some((query) => query.sql.trim().startsWith("INSERT INTO sec_role ("))).toBe(false);
            expect(f.state.roles.filter((role) => role.code === "jefe_general")).toHaveLength(1);
            expect(f.state.roles.find((role) => role.code === "owner")?.roleMode).toBe("all_active_roles");
        } finally {
            await f.db.destroy();
        }
    });
    it("adopts a compatible existing schema without issuing any DDL", async () => {
        const f = fixture({ adoptedSchema: true });
        try {
            await generalManagerModulesMigration.up(f.db);
            expect(f.queries.some((query) => /^(ALTER|CREATE) TABLE/.test(query.sql.trim()))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("maps all four present operational modules and only the two explicit chiefs", async () => {
        const f = fixture({ allModules: true });
        try {
            await generalManagerModulesMigration.up(f.db);
            expect(f.state.maps.filter((mapping) => mapping.roleId === 5)).toEqual([]);
            expect(f.state.maps).toContainEqual({ roleId: 9, moduleId: 12, status: "active" });
            expect(f.state.maps.some((mapping) => mapping.moduleId === 14 || mapping.roleId === 4)).toBe(false);
            expect(f.state.maps).toHaveLength(6);
        } finally {
            await f.db.destroy();
        }
    });
    it("refuses to restore a mapping removed after an audited application", async () => {
        const f = fixture();
        try {
            await generalManagerModulesMigration.up(f.db);
            f.state.maps = f.state.maps.filter((mapping) => mapping.roleId !== 2);
            await expect(generalManagerModulesMigration.up(f.db)).rejects.toThrow("Previously audited module policy changed");
            expect(f.state.audits).toHaveLength(1);
            expect(f.state.versions).toBe(1);
        } finally {
            await f.db.destroy();
        }
    });
    it("refuses an unexpected static manager ceiling instead of broadening or deleting it", async () => {
        const f = fixture();
        f.state.roles.push({ id: 5, code: "jefe_general", name: "Jefe General", status: "active", deleted: null, roleMode: "assigned", permissionMode: "assigned" });
        f.state.maps.push({ roleId: 5, moduleId: 10, status: "active" });
        try {
            await expect(generalManagerModulesMigration.up(f.db)).rejects.toThrow("mapping was revoked or conflicts");
            expect(f.state.maps).toEqual([{ roleId: 5, moduleId: 10, status: "active" }]);
            expect(f.state.audits).toHaveLength(0);
        } finally {
            await f.db.destroy();
        }
    });
});
