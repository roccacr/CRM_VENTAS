import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import { calendarEventTypesMigration as migration } from "../../migrations/schema-only/202610290054_calendar_event_types.js";

vi.mock("../../src/modules/crm/calendar/calendar-event-types.catalog.js", () => ({
    CALENDAR_EVENT_TYPES: [
        { codigo: "reunion", tipo: "Reunión", color: "#4F46E5", modulos: ["formalizacion", "mercadeo"] },
        { codigo: "tarea", tipo: "Tarea", color: "#475569", modulos: ["formalizacion", "ventas", "contabilidad"] },
        { codigo: "general", tipo: "Do not replace general", color: "#FFFFFF", modulos: ["formalizacion"] },
    ],
}));

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
            const [publicId, moduleId, code, label, color, formKey] = query.parameters;
            types.push({ id: 100 + types.length, publicId: String(publicId), moduleId: Number(moduleId), code: String(code), label: String(label), color: String(color), formKey: String(formKey), status: "active" });
        }
        if (query.sql.startsWith("UPDATE conf_calendar_event_type")) {
            const [label, color, formKey, id] = query.parameters;
            const row = types.find((t) => t.id === id);
            if (row) Object.assign(row, { label, color, formKey });
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
                ["FROM sec_org_unit", () => (options.missingModule ? moduleRows.slice(1) : moduleRows)],
                ["FROM conf_calendar_event_type", () => types],
                ["FROM sec_user u JOIN", () => (options.noActor ? [] : [{ id: 1, publicId: "owner-id", name: "Owner" }])],
            ];
            return Promise.resolve({ rows: structuredClone(responses.find(([fragment]) => query.sql.includes(fragment))?.[1]() ?? []) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, transactions, rows: () => structuredClone(types) };
}
const writes = (queries: CompiledQuery[]) => queries.filter((q) => !q.sql.startsWith("SELECT"));

describe("calendar event types migration 054", () => {
    it("imports only allowed module/type pairs, preserves general and repeats with no DML or actor lookup", async () => {
        const f = fixture();
        try {
            expect(migration.name).toBe("202610290054_calendar_event_types");
            await migration.up(f.db);
            const inserted = f.queries.filter((q) => q.sql.startsWith("INSERT INTO conf_calendar_event_type"));
            expect(inserted.map((q) => q.parameters.slice(1, 3))).toEqual([
                [1, "reunion"],
                [1, "tarea"],
                [2, "reunion"],
                [3, "tarea"],
                [4, "tarea"],
            ]);
            expect(f.rows().find((r) => r.id === 51)).toEqual(existingGeneral);
            expect(
                f
                    .rows()
                    .filter((r) => r.code !== "general")
                    .every((r) => r.formKey === `${modules.find((m) => m.id === r.moduleId)?.code ?? "missing"}.general.v1`),
            ).toBe(true);
            const audit = f.queries.filter((q) => q.sql.startsWith("INSERT INTO audit_security_event"));
            expect(audit).toHaveLength(1);
            expect(audit[0]?.sql).toContain("calendar_event_types_synced");
            const metadata = JSON.parse(audit[0]?.parameters.at(-1) as string) as { migration: string; changeSet: { before: { eventTypes: (TypeRow | null)[] }; after: { eventTypes: TypeRow[] } } };
            expect(metadata.migration).toBe(migration.name);
            expect(metadata.changeSet.before.eventTypes).toEqual([null, null, null, null, null]);
            expect(metadata.changeSet.after.eventTypes).toHaveLength(5);
            expect(metadata.changeSet.after.eventTypes.find((r) => r.moduleId === 1 && r.code === "reunion")?.label).toBe("Reunión");
            expect(metadata.changeSet.after.eventTypes.every((r) => Number.isInteger(r.id))).toBe(true);
            const count = writes(f.queries).length;
            const actorLookups = f.queries.filter((q) => q.sql.includes("FROM sec_user u JOIN")).length;
            await migration.up(f.db);
            expect(writes(f.queries)).toHaveLength(count);
            expect(f.queries.filter((q) => q.sql.includes("FROM sec_user u JOIN"))).toHaveLength(actorLookups);
            expect(f.queries.map((q) => q.sql).join("\n")).not.toMatch(/DELETE |ALTER |DROP |sec_permission|sec_role_permission|permission_version_user|INSERT INTO crm_calendar_event |UPDATE crm_calendar_event |crmdatabase-api/);
            expect(f.transactions).toEqual(["begin", "commit", "begin", "commit"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("updates only changed label/color/form key, preserving both identities and inactive state", async () => {
        const before: TypeRow = { id: 81, publicId: "same-id", moduleId: 1, code: "reunion", label: "Old label", color: "#000000", formKey: "old.form.v1", status: "inactive" };
        const f = fixture({ types: [existingGeneral, before] });
        try {
            await migration.up(f.db);
            expect(f.rows().find((r) => r.id === 81)).toEqual({ ...before, label: "Reunión", color: "#4F46E5", formKey: "formalizacion.general.v1" });
            const updates = f.queries.filter((q) => q.sql.startsWith("UPDATE conf_calendar_event_type"));
            expect(updates).toHaveLength(1);
            expect(updates[0]?.sql).not.toMatch(/SET .*status_calendar|SET .*public_id|SET .*module_id/);
            const metadata = JSON.parse(f.queries.find((q) => q.sql.startsWith("INSERT INTO audit_security_event"))?.parameters.at(-1) as string) as { migration: string; changeSet: { before: { eventTypes: (TypeRow | null)[] }; after: { eventTypes: TypeRow[] } } };
            expect(metadata.changeSet.before.eventTypes).toContainEqual(before);
            expect(metadata.changeSet.after.eventTypes).toContainEqual({ ...before, label: "Reunión", color: "#4F46E5", formKey: "formalizacion.general.v1" });
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ label: "Different" }, { color: "#000000" }, { formKey: "other.form.v1" }])("syncs a difference in only one field without touching unrelated types: %j", async (drift) => {
        const target: TypeRow = { id: 81, publicId: "stable-id", moduleId: 1, code: "reunion", label: "Reunión", color: "#4F46E5", formKey: "formalizacion.general.v1", status: "active" };
        const unrelated: TypeRow = { ...target, id: 82, publicId: "historical-id", code: "historical", status: "inactive" };
        const f = fixture({ types: [existingGeneral, { ...target, ...drift }, unrelated] });
        try {
            await migration.up(f.db);
            expect(f.rows()).toContainEqual(target);
            expect(f.rows()).toContainEqual(unrelated);
            expect(f.queries.filter((q) => q.sql.startsWith("UPDATE conf_calendar_event_type"))).toHaveLength(1);
        } finally {
            await f.db.destroy();
        }
    });
    it("fails closed on duplicate existing identities before any catalog write", async () => {
        const duplicate: TypeRow = { ...existingGeneral, code: "reunion" };
        const f = fixture({ types: [duplicate, { ...duplicate, id: 90, publicId: "duplicate" }] });
        try {
            await expect(migration.up(f.db)).rejects.toThrow("identity conflict");
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("skips existing inactive modules without treating them as missing", async () => {
        const f = fixture({ inactiveModule: true });
        try {
            await migration.up(f.db);
            expect(f.rows().some((r) => r.moduleId === 2)).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ database: "crmdatabase-api" }, { database: "crm_think_v2" }, { noLedger: true }, { missingTable: true }, { missingModule: true }, { noActor: true }])("fails closed before any DML: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(migration.up(f.db)).rejects.toThrow();
            expect(writes(f.queries)).toEqual([]);
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("does not require an Owner when already unchanged", async () => {
        const seeded = fixture();
        try {
            await migration.up(seeded.db);
            const inactive = seeded.rows().map((r) => ({ ...r, status: "inactive" }));
            const f = fixture({ types: inactive, noActor: true });
            try {
                await migration.up(f.db);
                expect(writes(f.queries)).toEqual([]);
                expect(f.rows()).toEqual(inactive);
            } finally {
                await f.db.destroy();
            }
        } finally {
            await seeded.db.destroy();
        }
    });
    it("rolls back all configuration writes when auditing fails", async () => {
        const f = fixture({ failAudit: true });
        try {
            await expect(migration.up(f.db)).rejects.toThrow("Audit unavailable");
            expect(f.rows()).toEqual([existingGeneral]);
            expect(f.transactions).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
});
