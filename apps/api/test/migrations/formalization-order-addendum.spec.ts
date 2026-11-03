import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { formalizationOrderAddendumMigration as migration, planAddendumColumns } from "../../migrations/schema-only/202611030065_formalization_order_addendum.js";
import { parseLegacyAddendumArgs, runLegacyAddendum } from "../../scripts/migrate-legacy-addendum.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";

const code = "formalizacion.orders.addendum.update";
const definition = { code, module: "formalizacion", action: "update", description: "Gestionar estado de adéndum", status: "active" };
const roles = ["owner", "formalizacion", "jefe_formalizaciones", "jefe_general"].map((code, index) => ({ id: 19 + index, code, status: "active", deleted: null }));
const securityTables = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"];
const columns = (source: "native" | "legacy") => [
    { name: source === "native" ? "addendum_status_sales_order" : "estado_adendum_ov", type: "enum('pending','completed','cancelled')", nullable: "YES", defaultValue: null, extra: "" },
    { name: source === "native" ? "addendum_version_sales_order" : "version_adendum_ov", type: "int unsigned", nullable: "NO", defaultValue: "0", extra: "" },
    { name: source === "native" ? "addendum_changed_at_sales_order" : "fecha_adendum_ov", type: "datetime(3)", nullable: "YES", defaultValue: null, extra: "" },
];
type Options = { source?: "native" | "legacy"; database?: string; columns?: Record<string, unknown>[]; roles?: object[]; permissions?: object[]; grants?: { role: number; status: string }[]; actors?: object[]; engine?: string; kind?: string; failAudit?: boolean; failDdl?: boolean; lock?: number };
function fixture(options: Options = {}) {
    const source = options.source ?? "native";
    const queries: CompiledQuery[] = [];
    const transactions: string[] = [];
    let existingColumns = options.columns ?? [];
    let permissions = options.permissions ?? [];
    const grants = [...(options.grants ?? [])];
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
        // El fixture emula metadatos y DDL/DML; sus ramas no son lógica del producto.
        // eslint-disable-next-line complexity
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            if (query.sql.startsWith("ALTER TABLE") && options.failDdl) return Promise.reject(new Error("metadata lock timeout"));
            if (query.sql.startsWith("ALTER TABLE")) existingColumns = columns(source);
            if (query.sql.startsWith("INSERT INTO sec_permission")) permissions = [definition];
            if (query.sql.startsWith("INSERT INTO sec_role_permission")) grants.push({ role: query.parameters[0] as number, status: "active" });
            if (query.sql.startsWith("INSERT INTO audit_security_event") && options.failAudit) return Promise.reject(new Error("audit unavailable"));
            const inventory: [string, object[]][] = [
                ["GET_LOCK", [{ acquired: options.lock ?? 1 }]],
                ["SELECT @@SESSION.lock_wait_timeout", [{ timeout: 50 }]],
                ["SELECT DATABASE()", [{ name: options.database ?? (source === "native" ? "CRM_THINK_V2" : "crmdatabase-api") }]],
                ["information_schema.COLUMNS", existingColumns],
                ["information_schema.TABLES", (query.sql.includes("TABLE_NAME IN") ? securityTables : [source === "native" ? "crm_sales_order" : "ordenventa"]).map((name) => ({ name, table_name: name, kind: options.kind ?? "BASE TABLE", table_type: options.kind ?? "BASE TABLE", engine: options.engine ?? "InnoDB" }))],
                ["FROM sec_role WHERE", options.roles ?? roles],
                ["FROM sec_user u JOIN", options.actors ?? [{ id: 1, publicId: "owner", name: "Owner" }]],
                ["FROM sec_role_permission", [...grants]],
                ["FROM sec_permission", permissions],
            ];
            return Promise.resolve({ rows: (inventory.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? []) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, transactions };
}
const writes = (queries: CompiledQuery[]) => queries.filter((query) => !/^(SELECT|SET SESSION)/.test(query.sql));

describe("marcador único de adéndum y permiso", () => {
    it("registra únicamente 065 y crea tres columnas sin backfill más el permiso para cuatro roles", async () => {
        const f = fixture();
        try {
            expect(selectSchemaMigrations(migration.name)).toEqual([migration]);
            await migration.up(f.db);
            const ddl = f.queries.filter((query) => query.sql.startsWith("ALTER TABLE"));
            expect(ddl).toHaveLength(1);
            expect(ddl[0]?.sql).toContain("ALGORITHM=INSTANT");
            for (const column of columns("native")) expect(ddl[0]?.sql).toContain(column.name);
            expect(f.queries.filter((query) => query.sql.startsWith("SET SESSION")).map((query) => [query.sql, query.parameters])).toEqual([
                ["SET SESSION lock_wait_timeout=10", []],
                ["SET SESSION lock_wait_timeout=?", [50]],
            ]);
            expect(f.queries.filter((query) => query.sql.startsWith("INSERT INTO sec_role_permission")).map((query) => query.parameters[0])).toEqual([19, 20, 21, 22]);
            expect(f.queries.find((query) => query.sql.startsWith("UPDATE sec_user"))?.parameters).toEqual([19, 20, 21, 22]);
            expect(JSON.parse(String(f.queries.find((query) => query.sql.startsWith("INSERT INTO audit_security_event"))?.parameters.at(-1)))).toMatchObject({ migration: migration.name, changeSet: { recordId: code, after: { roleCodes: roles.map((role) => role.code) } } });
            const count = writes(f.queries).length;
            await migration.up(f.db);
            expect(writes(f.queries)).toHaveLength(count);
            expect(f.queries.map((query) => query.sql).join(" ")).not.toMatch(/crmdatabase-api|sec_user_permission_override|UPDATE crm_sales_order/);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ database: "crmdatabase-api" }, { engine: "MyISAM" }, { kind: "VIEW" }, { roles: [] }, { actors: [] }, ...Object.keys(definition).map((key) => ({ permissions: [{ ...definition, [key]: "drift" }] })), ...columns("native").map((column) => ({ columns: [{ ...column, type: "varchar(32)" }] })), { columns: [{ ...columns("native")[2], extra: "on update CURRENT_TIMESTAMP(3)" }] }] satisfies Options[])("preflight completo rechaza drift antes del primer DDL: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(migration.up(f.db)).rejects.toThrow();
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("conserva columnas compatibles y revocaciones existentes sin reactivarlas", async () => {
        const f = fixture({ columns: columns("native"), permissions: [definition], grants: roles.map((role) => ({ role: role.id, status: "inactive" })) });
        try {
            await migration.up(f.db);
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("si falla auditoría revierte DML y conserva el DDL ya confirmado para reintento", async () => {
        const f = fixture({ failAudit: true });
        try {
            await expect(migration.up(f.db)).rejects.toThrow("audit unavailable");
            expect(f.transactions.at(-1)).toBe("rollback");
            expect(f.queries.filter((query) => query.sql.startsWith("ALTER TABLE"))).toHaveLength(1);
            expect(f.queries.at(-1)?.parameters).toEqual([50]);
        } finally {
            await f.db.destroy();
        }
    });
    it("conserva columnas parciales compatibles y agrega únicamente las ausentes", async () => {
        const f = fixture({ columns: columns("native").filter((column) => column.name === "addendum_version_sales_order") });
        try {
            const plan = await planAddendumColumns(f.db, "native");
            expect(plan[0]).not.toContain("addendum_version_sales_order");
            expect(plan[0]).toContain("addendum_status_sales_order");
            expect(plan[0]).toContain("addendum_changed_at_sales_order");
        } finally {
            await f.db.destroy();
        }
    });
    it("restaura timeout y no empieza permisos cuando el DDL no obtiene el metadata lock", async () => {
        const f = fixture({ failDdl: true });
        try {
            await expect(migration.up(f.db)).rejects.toThrow("metadata lock timeout");
            expect(f.queries.at(-1)?.parameters).toEqual([50]);
            expect(f.queries.some((query) => query.sql.startsWith("INSERT"))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
});

describe("CLI legacy explícito y acotado a tres columnas", () => {
    it.each([[], ["--apply"], ["--apply=CRM_THINK_V2"], ["--plan", "--apply=crmdatabase-api"]].map((args) => ({ args })))("rechaza argumentos no exactos: %j", ({ args }) => {
        expect(() => parseLegacyAddendumArgs(args)).toThrow();
    });
    it.each([false, true])("solo aplica con opción explícita; apply=%s", async (apply) => {
        const f = fixture({ source: "legacy" });
        try {
            expect(parseLegacyAddendumArgs([apply ? "--apply=crmdatabase-api" : "--plan"])).toBe(apply);
            const plan = await runLegacyAddendum(f.db, apply);
            expect(plan).toHaveLength(1);
            expect(writes(f.queries)).toHaveLength(apply ? 1 : 0);
            for (const column of columns("legacy")) expect(plan[0]).toContain(column.name);
            expect(plan.join(" ")).not.toMatch(/UPDATE|INSERT|DROP|crm_sales_order/);
            if (apply) expect(await runLegacyAddendum(f.db, true)).toEqual([]);
            expect(f.queries.some((query) => query.sql.includes("RELEASE_LOCK"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ database: "CRM_THINK_V2" }, { engine: "MyISAM" }, { kind: "VIEW" }, { lock: 0 }, ...columns("legacy").map((column) => ({ columns: [{ ...column, nullable: column.nullable === "YES" ? "NO" : "YES" }] }))] satisfies Options[])("rechaza destino/columnas incompatibles sin DDL: %j", async (options) => {
        const f = fixture({ source: "legacy", ...options });
        try {
            await expect(runLegacyAddendum(f.db, true)).rejects.toThrow();
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("no altera columnas ya compatibles ni las trata como un nuevo adéndum", async () => {
        const f = fixture({ source: "legacy", columns: columns("legacy") });
        try {
            expect(await planAddendumColumns(f.db, "legacy")).toEqual([]);
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
});
