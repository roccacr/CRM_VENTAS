import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { formalizationManualAddendumMigration as migration } from "../../migrations/schema-only/202611030066_formalization_manual_addendum.js";
import { parseLegacyAddendumNoteArgs, runLegacyAddendumNote } from "../../scripts/migrate-legacy-addendum-note.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";
import { anyOf } from "../support/throws.js";

const definitions = [
    { code: "formalizacion.orders.addendum.mark_pending", module: "formalizacion", action: "mark_pending", description: "Marcar adéndum pendiente", status: "active" },
    { code: "formalizacion.orders.addendum.read", module: "formalizacion", action: "read", description: "Ver adéndum en la orden", status: "active" },
    { code: "formalizacion.home.addendum.read", module: "formalizacion", action: "read", description: "Ver banner de adéndum", status: "active" },
];
const roleCodes = ["owner", "formalizacion", "jefe_formalizaciones", "jefe_general"];
type Options = { source?: "native" | "legacy"; database?: string; base?: boolean; note?: object; permissions?: typeof definitions; roles?: object[]; grants?: { role: number; code: string; status: string }[]; failAudit?: boolean };
function fixture(options: Options = {}) {
    const source = options.source ?? "native";
    const queries: CompiledQuery[] = [];
    const transactions: string[] = [];
    let note = options.note;
    const permissions = [...(options.permissions ?? [])];
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
        // Metadatos y persistencia del fixture; no implementa la política bajo prueba.
        // eslint-disable-next-line complexity, sonarjs/cognitive-complexity
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            if (query.sql.startsWith("ALTER TABLE")) note = { type: "text", nullable: "YES", defaultValue: null, extra: "" };
            if (query.sql.startsWith("INSERT INTO sec_permission")) permissions.push(definitions.find((definition) => definition.code === query.parameters[0]) as (typeof definitions)[number]);
            if (query.sql.startsWith("INSERT INTO sec_role_permission")) grants.push({ role: Number(query.parameters[0]), code: String(query.parameters[1]), status: "active" });
            if (query.sql.startsWith("INSERT INTO audit_security_event") && options.failAudit) return Promise.reject(new Error("audit unavailable"));
            const names = source === "native" ? ["addendum_status_sales_order", "addendum_version_sales_order", "addendum_changed_at_sales_order"] : ["estado_adendum_ov", "version_adendum_ov", "fecha_adendum_ov"];
            const base = options.base === false ? [] : names.map((name, index) => ({ name, type: ["enum('pending','completed','cancelled')", "int unsigned", "datetime(3)"][index], nullable: index === 1 ? "NO" : "YES", defaultValue: index === 1 ? "0" : null, extra: "" }));
            const table = source === "native" ? "crm_sales_order" : "ordenventa";
            const rows: [string, object[]][] = [
                ["SELECT DATABASE()", [{ name: options.database ?? (source === "native" ? "CRM_THINK_V2" : "crmdatabase-api") }]],
                ["SELECT @@SESSION.lock_wait_timeout", [{ timeout: 50 }]],
                ["GET_LOCK", [{ acquired: 1 }]],
                ["information_schema.COLUMNS", query.sql.includes("COLUMN_NAME IN") ? base : note ? [note] : []],
                ["information_schema.TABLES", (query.sql.includes("TABLE_NAME IN") ? ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"] : [table]).map((name) => ({ name, table_name: name, engine: "InnoDB", kind: "BASE TABLE", table_type: "BASE TABLE" }))],
                ["FROM sec_role WHERE", options.roles ?? roleCodes.map((code, index) => ({ id: index + 1, code, status: "active", deleted: null }))],
                ["FROM sec_user u JOIN", [{ id: 1, publicId: "owner", name: "Owner" }]],
                ["FROM sec_role_permission", [...grants]],
                ["FROM sec_permission", [...permissions]],
            ];
            return Promise.resolve({ rows: (rows.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? []) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, transactions, grants };
}
const writes = (queries: CompiledQuery[]) => queries.filter((query) => !/^(SELECT|SET SESSION)/.test(query.sql));

describe("066 nota de adéndum y permisos independientes", () => {
    it("crea solo una nota TEXT NULL y tres permisos; marcar pendiente por defecto solo Jefe", async () => {
        const f = fixture();
        try {
            expect(selectSchemaMigrations(migration.name)).toEqual([migration]);
            await migration.up(f.db);
            expect(f.queries.filter((query) => query.sql.startsWith("ALTER TABLE"))[0]?.sql).toBe("ALTER TABLE `crm_sales_order` ADD COLUMN `addendum_note_sales_order` TEXT NULL DEFAULT NULL, ALGORITHM=INSTANT");
            expect(f.queries.filter((query) => query.sql.startsWith("INSERT INTO sec_permission"))).toHaveLength(3);
            expect(f.grants.filter((grant) => grant.code === definitions[0]?.code).map((grant) => grant.role)).toEqual([3]);
            expect(f.grants.filter((grant) => grant.code === definitions[1]?.code).map((grant) => grant.role)).toEqual([1, 2, 3, 4]);
            expect(f.grants.filter((grant) => grant.code === definitions[2]?.code).map((grant) => grant.role)).toEqual([1, 2, 3, 4]);
            expect(f.queries.filter((query) => query.sql.startsWith("INSERT INTO audit_security_event"))).toHaveLength(1);
            expect(f.queries.some((query) => query.sql.startsWith("UPDATE sec_user"))).toBe(true);
            const size = writes(f.queries).length;
            await migration.up(f.db);
            expect(writes(f.queries)).toHaveLength(size);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ database: "crmdatabase-api" }, { base: false }, { roles: [] }, { note: { type: "varchar(100)", nullable: "YES", defaultValue: null, extra: "" } }, { note: { type: "text", nullable: "NO", defaultValue: null, extra: "" } }, ...Object.keys(definitions[0] ?? {}).map((key) => ({ permissions: [{ ...definitions[0], [key]: "drift" }] as typeof definitions }))] satisfies Options[])("preflight rechaza diferencias antes de DDL: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(migration.up(f.db)).rejects.toThrow(anyOf("Addendum destination mismatch", "Addendum note requires the three approved base columns", "Manual addendum requires four active roles", "Addendum note column drift", "Manual addendum permission drift"));
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("revierte permisos/versiones ante fallo de auditoría y permite reconciliar DDL confirmado", async () => {
        const f = fixture({ failAudit: true });
        try {
            await expect(migration.up(f.db)).rejects.toThrow("audit unavailable");
            expect(f.transactions.at(-1)).toBe("rollback");
            expect(f.queries.at(-1)?.parameters).toEqual([50]);
        } finally {
            await f.db.destroy();
        }
    });
    it("no reactiva grants revocados ni altera overrides al reintentar una configuración existente", async () => {
        const grants = definitions.flatMap((definition, index) => roleCodes.flatMap((_role, roleIndex) => (index === 0 && roleIndex !== 2 ? [] : [{ role: roleIndex + 1, code: definition.code, status: "inactive" }])));
        const f = fixture({ permissions: definitions, grants, note: { type: "text", nullable: "YES", defaultValue: null, extra: "" } });
        try {
            await migration.up(f.db);
            expect(writes(f.queries)).toEqual([]);
            expect(f.queries.map((query) => query.sql).join(" ")).not.toMatch(/sec_user_permission_override|DELETE|crmdatabase-api/);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([false, true])("CLI legacy solo crea nota, apply=%s", async (apply) => {
        const f = fixture({ source: "legacy" });
        try {
            expect(parseLegacyAddendumNoteArgs([apply ? "--apply=crmdatabase-api" : "--plan"])).toBe(apply);
            expect(await runLegacyAddendumNote(f.db, apply)).toEqual(["ALTER TABLE `ordenventa` ADD COLUMN `nota_adendum_ov` TEXT NULL DEFAULT NULL, ALGORITHM=INSTANT"]);
            expect(writes(f.queries)).toHaveLength(apply ? 1 : 0);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([[], ["--apply"], ["--apply=CRM_THINK_V2"], ["--plan", "--apply=crmdatabase-api"]].map((args) => ({ args })))("CLI rechaza opciones no autorizadas %j", ({ args }) => {
        expect(() => parseLegacyAddendumNoteArgs(args)).toThrow("Use exactly --plan or --apply=crmdatabase-api");
    });
});
