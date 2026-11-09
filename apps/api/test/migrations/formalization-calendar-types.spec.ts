import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { formalizationCalendarTypesMigration as migration } from "../../migrations/schema-only/202611020061_formalization_calendar_types.js";
import { anyOf } from "../support/throws.js";
type TypeRow = { id: number; publicId: string; moduleId: number; code: string; label: string; color: string; formKey: string; status: string };
const modules = ["formalizacion", "mercadeo", "ventas", "contabilidad"].map((code, i) => ({ id: i + 1, code, status: "active", deleted: null }));
const existingGeneral: TypeRow = { id: 51, publicId: "general-id", moduleId: 1, code: "general", label: "Mi evento", color: "#496180", formKey: "formalizacion.custom.v3", status: "inactive" };
type Options = { database?: string; noLedger?: boolean; missingTable?: boolean; missingModule?: boolean; inactiveModule?: boolean; types?: TypeRow[]; noActor?: boolean; failAudit?: boolean };
function fixture(options: Options = {}) {
    const queries: CompiledQuery[] = [];
    const transactions: string[] = [];
    let types = structuredClone(options.types ?? [existingGeneral]);
    let snapshot: TypeRow[] = [];
    const tableRows = ["conf_schema_migration", "conf_calendar_event_type", "sec_org_unit", "sec_user", "sec_user_role", "sec_role", "audit_security_event"].map((name) => ({ name, engine: "InnoDB", kind: "BASE TABLE" }));
    const moduleRows = modules.map((m) => ({ ...m, status: options.inactiveModule && m.id === 2 ? "inactive" : m.status }));
    const driver = new DummyDriver();
    driver.beginTransaction = () => {
        snapshot = structuredClone(types);
        transactions.push("begin");
        return Promise.resolve();
    };
    driver.commitTransaction = () => {
        transactions.push("commit");
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        types = snapshot;
        transactions.push("rollback");
        return Promise.resolve();
    };
    function mutate(query: CompiledQuery): void {
        if (query.sql.startsWith("INSERT INTO conf_calendar_event_type")) {
            const [publicId, moduleId, code, label, color] = query.parameters;
            const formKey = "formalizacion.general.v1";
            types.push({ id: 100 + types.length, publicId: String(publicId), moduleId: Number(moduleId), code: String(code), label: String(label), color: String(color), formKey, status: "active" });
        }
        if (query.sql.startsWith("UPDATE conf_calendar_event_type")) {
            for (const row of types) if (row.moduleId === query.parameters[0] && row.code === "cita" && row.status === "active") row.status = "inactive";
        }
    }
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            if (options.failAudit && query.sql.startsWith("INSERT INTO audit_security_event")) return Promise.reject(new Error("Audit unavailable"));
            mutate(query);
            const responses: [string, () => object[]][] = [
                ["SELECT DATABASE()", () => [{ name: options.database ?? "CRM_THINK_V2" }]],
                ["information_schema.TABLES", () => (options.missingTable ? [] : tableRows)],
                ["FROM conf_schema_migration", () => (options.noLedger ? [] : [{ name: "202610280051_global_calendar" }])],
                ["FROM sec_org_unit", () => (options.missingModule ? [] : moduleRows.slice(0, 1))],
                ["FROM conf_calendar_event_type", () => types.filter((type) => type.moduleId === 1)],
                ["FROM sec_user u JOIN", () => (options.noActor ? [] : [{ id: 1, publicId: "owner-id", name: "Owner" }])],
            ];
            return Promise.resolve({ rows: structuredClone(responses.find(([fragment]) => query.sql.includes(fragment))?.[1]() ?? []) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, transactions, rows: () => structuredClone(types) };
}

describe("Formalización calendar types migration", () => {
    it("adds only two types, retires Cita only in Formalización and is idempotent", async () => {
        const cita = { ...existingGeneral, id: 52, code: "cita", status: "active" };
        const other = { ...cita, id: 53, moduleId: 2 };
        const f = fixture({ types: [existingGeneral, cita, other] });
        try {
            await migration.up(f.db);
            expect(f.rows().filter((r) => r.id === 51 || r.id === 53)).toEqual([existingGeneral, other]);
            expect(f.rows().find((r) => r.id === 52)?.status).toBe("inactive");
            expect(
                f
                    .rows()
                    .filter((r) => r.id >= 100)
                    .map((r) => [r.moduleId, r.code]),
            ).toEqual([
                [1, "formalizacion_bancaria"],
                [1, "adendum"],
            ]);
            const count = f.queries.filter((q) => !q.sql.startsWith("SELECT")).length;
            await migration.up(f.db);
            expect(f.queries.filter((q) => !q.sql.startsWith("SELECT"))).toHaveLength(count);
            expect(f.transactions).toEqual(["begin", "commit", "begin", "commit"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("rolls configuration back when audit fails", async () => {
        const f = fixture({ failAudit: true });
        try {
            await expect(migration.up(f.db)).rejects.toThrow("Audit unavailable");
            expect(f.rows()).toEqual([existingGeneral]);
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ database: "crmdatabase-api" }, { missingModule: true }, { noLedger: true }, { noActor: true }])("rejects unsafe prerequisites %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(migration.up(f.db)).rejects.toThrow(anyOf("Formalization calendar types require CRM_THINK_V2", "An active Formalización module is required", "Formalization calendar types require migration 054", "Active Owner audit attribution is required"));
            expect(f.rows()).toEqual([existingGeneral]);
        } finally {
            await f.db.destroy();
        }
    });
});
