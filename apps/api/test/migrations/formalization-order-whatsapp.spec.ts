import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { formalizationOrderWhatsappMigration as migration } from "../../migrations/schema-only/202611030064_formalization_order_whatsapp.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import { anyOf } from "../support/throws.js";

const code = "formalizacion.orders.whatsapp";
const description = "Ir a WhatsApp";
const definition = { code, module: "formalizacion", action: "whatsapp", description, status: "active" };
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
                ["from `sec_permission`", [{ actionCode: "whatsapp", code, description, moduleCode: "formalizacion" }]],
            ];
            return Promise.resolve({ rows: (inventory.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? []) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, transactions };
}
const writes = (queries: CompiledQuery[]) => queries.filter((query) => !query.sql.startsWith("SELECT"));

describe("permiso de WhatsApp en órdenes de Formalización", () => {
    it("agrupa el permiso en Formalización / Órdenes de venta con su etiqueta de negocio", async () => {
        const f = fixture();
        try {
            const repository = new IdentityAccessManagementRepository({ db: f.db } as never, {} as never, {} as never);
            const catalog = await repository.readSecurityCatalog();
            expect(catalog.modules.find((module) => module.code === "formalizacion")?.views.find((view) => view.code === "sales_order")?.permissions).toContainEqual({ code, description, name: description, sensitive: false });
        } finally {
            await f.db.destroy();
        }
    });
    it.each([
        { database: "legacy" },
        { tables: [] },
        { tables: tableNames.map((table_name) => ({ table_name, table_type: "VIEW", engine: "InnoDB" })) },
        { tables: tableNames.map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "MyISAM" })) },
        { roles: [] },
        { roles: ["owner", "formalizacion", "jefe_formalizaciones", "jefe_general"].map((code, index) => ({ id: index, code, status: "inactive", deleted: null })) },
        { actors: [] },
        ...Object.keys(definition).map((key) => ({ permissions: [{ ...definition, [key]: "drift" }] })),
        { permissions: [definition, definition] },
    ] satisfies Options[])("rechaza configuración incompatible antes de escribir: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(migration.up(f.db)).rejects.toThrow(anyOf("Formalization order WhatsApp permission requires CRM_THINK_V2", "Formalization order WhatsApp permission requires native InnoDB security tables", "Formalization order WhatsApp permission requires all authorized active roles", "Formalization order WhatsApp permission requires Owner migration attribution", "Formalization order WhatsApp permission conflicts with existing configuration; r"));
            expect(writes(f.queries)).toEqual([]);
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("registra únicamente 064 al seleccionarla", () => {
        expect(selectSchemaMigrations(migration.name)).toEqual([migration]);
    });
    it("asigna los cuatro roles autorizados, audita e invalida versiones; repetir no escribe", async () => {
        const f = fixture();
        try {
            await migration.up(f.db);
            expect(writes(f.queries)).toHaveLength(7);
            expect(writes(f.queries)[0]?.parameters).toEqual([code, "formalizacion", "whatsapp", description, "active"]);
            expect(f.queries.filter((query) => query.sql.startsWith("INSERT INTO sec_role_permission")).map((query) => query.parameters[0])).toEqual([19, 20, 21, 22]);
            expect(f.queries.find((query) => query.sql.startsWith("UPDATE sec_user"))?.parameters).toEqual([19, 20, 21, 22]);
            const audit = f.queries.find((query) => query.sql.startsWith("INSERT INTO audit_security_event"));
            expect(JSON.parse(String(audit?.parameters.at(-1)))).toMatchObject({ migration: migration.name, actor: { publicId: "owner-id" }, changeSet: { recordId: code, before: { roleCodes: [] }, after: { roleCodes: ["owner", "formalizacion", "jefe_formalizaciones", "jefe_general"] } } });
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
