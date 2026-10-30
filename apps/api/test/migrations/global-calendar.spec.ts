import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { globalCalendarMigration, planGlobalCalendarSchema } from "../../migrations/schema-only/202610280051_global_calendar.js";
import { legacyCalendarContextDdl, planLegacyCalendarContext, runLegacyCalendarContext } from "../../scripts/migrate-legacy-calendar-context.js";

type Row = Record<string, unknown>;
const modules = ["formalizacion", "mercadeo", "ventas", "contabilidad"].map((code, i) => ({ id: i + 1, code, status: "active", deleted: null }));
const tables = ["crm_calendar_event", "conf_calendar_event_type", "sec_org_unit", "sec_role", "sec_role_module", "sec_permission", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"];
const roles = [...modules.map((m) => ({ id: m.id, code: m.code, status: "active", deleted: null })), { id: 10, code: "jefe_general", status: "active", deleted: null }, { id: 11, code: "owner", status: "active", deleted: null }];
const ceilings = [...modules.map((m) => ({ role: m.id, module: m.id, status: "active" })), ...modules.map((m) => ({ role: 10, module: m.id, status: "active" }))];
const moduleIndex = ["origin_module_id_calendar_event", "deleted_at_calendar_event", "starts_at_calendar_event", "id_calendar_event"].map((column_name, i) => ({ index_name: "ix_calendar_event_module_time", non_unique: 1, seq_in_index: i + 1, column_name, sub_part: null }));
const nativeColumns: Row[] = [
    { table_name: "crm_calendar_event", column_name: "details_calendar_event", column_type: "json", is_nullable: "YES", column_default: null, extra: "", column_comment: "Detalles opcionales por modulo; referencias libres sin FK ni inferencia de identidad" },
    { table_name: "crm_calendar_event", column_name: "legacy_calendar_id_calendar_event", column_type: "int", is_nullable: "YES", column_default: null, extra: "", column_comment: "Alias legacy opcional y unico reservado para conciliacion futura; sin copiar eventos" },
    { table_name: "conf_calendar_event_type", column_name: "form_key_calendar_event_type", column_type: "varchar(100)", is_nullable: "NO", column_default: null, extra: "", column_comment: "Clave persistida del formulario por tipo; modulo.general.v1 para la configuracion inicial" },
];
function doubleDatabase(respond: (query: CompiledQuery) => Row[], transactions: string[] = [], failAudit = false) {
    const queries: CompiledQuery[] = [];
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
            if (failAudit && query.sql.startsWith("INSERT INTO audit_security_event")) return Promise.reject(new Error("Audit unavailable"));
            return Promise.resolve({ rows: structuredClone(respond(query)) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, transactions };
}
function nativeFixture(options: { database?: string; badTable?: boolean; badIndex?: boolean; columns?: Row[]; badPermission?: boolean; revoked?: boolean; inactiveModule?: boolean; missingActor?: boolean; failAudit?: boolean; ceilingRevoked?: boolean; typeRows?: Row[]; inactiveRole?: boolean } = {}) {
    const permissions: Row[] = [{ code: "mercadeo.calendar.read", module: "mercadeo", action: "read", status: options.badPermission ? "inactive" : "active", description: "Existing description" }];
    const types: Row[] = structuredClone(options.typeRows ?? []);
    const grants: Row[] = options.revoked ? [{ role: 1, code: "formalizacion.calendar.create", status: "inactive" }] : [];
    const moduleRows = modules.map((m) => ({ ...m, status: options.inactiveModule && m.id === 4 ? "inactive" : m.status }));
    const mappings = ceilings.map((m) => ({ ...m, status: options.ceilingRevoked && m.role === 1 ? "inactive" : m.status }));
    let columnRows = options.columns ?? [];
    let aliasIndex = columnRows.some((c) => c.column_name === "legacy_calendar_id_calendar_event");
    function applySchemaMutation(q: CompiledQuery): void {
        if (q.sql.includes("ADD COLUMN")) {
            const name = q.sql.match(/ADD COLUMN (\w+)/)?.[1];
            const definition = nativeColumns.find((c) => c.column_name === name);
            if (definition) columnRows = [...columnRows, { ...definition, is_nullable: "YES" }];
        }
        if (q.sql.includes("ADD UNIQUE KEY")) aliasIndex = true;
        if (q.sql.includes("MODIFY COLUMN form_key")) columnRows = columnRows.map((c) => (c.column_name === "form_key_calendar_event_type" ? { ...c, is_nullable: "NO" } : c));
        if (q.sql.startsWith("UPDATE conf_calendar_event_type")) {
            const type = types.find((t) => t.id === q.parameters[1]);
            if (type) type.formKey = q.parameters[0];
        }
    }
    return doubleDatabase(
        (q) => {
            if (q.sql.startsWith("INSERT INTO sec_permission")) permissions.push({ code: q.parameters[0], module: q.parameters[1], action: q.parameters[2], status: "active" });
            if (q.sql.startsWith("INSERT INTO sec_role_permission")) grants.push({ role: q.parameters[0], code: q.parameters[1], status: "active" });
            if (q.sql.startsWith("INSERT INTO conf_calendar_event_type")) types.push({ id: types.length + 1, module: q.parameters[1], code: "general", formKey: q.parameters[3], status: "active" });
            applySchemaMutation(q);
            const inventory: [string, () => Row[]][] = [
                ["SELECT DATABASE()", () => [{ name: options.database ?? "CRM_THINK_V2" }]],
                ["information_schema.TABLES", () => (options.badTable ? [] : tables.map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" })))],
                ["information_schema.COLUMNS", () => columnRows],
                ["information_schema.STATISTICS", () => [...(options.badIndex ? [] : moduleIndex), ...(aliasIndex ? [{ index_name: "uq_calendar_event_legacy", non_unique: 0, seq_in_index: 1, column_name: "legacy_calendar_id_calendar_event", sub_part: null }] : [])]],
                ["FROM sec_org_unit", () => moduleRows],
                ["FROM sec_role_module", () => mappings],
                ["FROM sec_role WHERE", () => roles.map((r) => ({ ...r, status: options.inactiveRole && r.id === 1 ? "inactive" : r.status }))],
                ["FROM sec_permission WHERE", () => permissions],
                ["FROM conf_calendar_event_type", () => types],
                ["FROM sec_role_permission", () => grants],
                ["FROM sec_user u JOIN", () => (options.missingActor ? [] : [{ id: 1, publicId: "owner-id", name: "Owner" }])],
            ];
            return inventory.find(([fragment]) => q.sql.includes(fragment))?.[1]() ?? [];
        },
        [],
        options.failAudit,
    );
}
const writes = (queries: CompiledQuery[]) => queries.filter((q) => /^(?:INSERT|UPDATE|ALTER|CREATE|DELETE|DROP)/.test(q.sql));

describe("global calendar native 051", () => {
    it("plans additive nullable details/unique alias and a required form key without executing DDL", async () => {
        const f = nativeFixture();
        try {
            const plan = await planGlobalCalendarSchema(f.db);
            expect(plan.join("\n")).toContain("details_calendar_event JSON NULL");
            expect(plan.join("\n")).toContain("legacy_calendar_id_calendar_event INT NULL");
            expect(plan.join("\n")).toContain("uq_calendar_event_legacy");
            expect(plan.join("\n")).toContain("form_key_calendar_event_type VARCHAR(100)");
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("preserves existing marketing read, seeds four real types, grants only active ceilings, audits and reruns without writes", async () => {
        const f = nativeFixture({ revoked: true, ceilingRevoked: true });
        try {
            expect(globalCalendarMigration.name).toBe("202610280051_global_calendar");
            await globalCalendarMigration.up(f.db);
            const first = writes(f.queries);
            expect(first.filter((q) => q.sql.startsWith("INSERT INTO sec_permission"))).toHaveLength(11);
            const seeds = first.filter((q) => q.sql.startsWith("INSERT INTO conf_calendar_event_type"));
            expect(seeds).toHaveLength(4);
            expect(seeds.map((q) => q.parameters[4])).toEqual(["#496180", "#7c4a9e", "#147849", "#a86308"]);
            expect(seeds.map((q) => q.parameters[3])).toEqual(modules.map((m) => `${m.code}.general.v1`));
            const assigned = first.filter((q) => q.sql.startsWith("INSERT INTO sec_role_permission"));
            expect(assigned).toHaveLength(21);
            expect(assigned.some((q) => q.parameters[0] === 1 || q.parameters[0] === 11)).toBe(false);
            expect(first.filter((q) => q.sql.startsWith("INSERT INTO audit_security_event"))).toHaveLength(1);
            expect(first.some((q) => q.sql.startsWith("UPDATE sec_user"))).toBe(true);
            expect(first.map((q) => q.sql).join("\n")).not.toMatch(/UPDATE sec_permission|UPDATE sec_role_permission|sec_user_permission_override|INSERT INTO crm_calendar_event |UPDATE crm_calendar_event |DELETE |DROP |crmdatabase-api/);
            const before = first.length;
            await globalCalendarMigration.up(f.db);
            expect(writes(f.queries)).toHaveLength(before);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ database: "crmdatabase-api" }, { badTable: true }, { badIndex: true }, { columns: [{ ...nativeColumns[0], column_type: "text" }] }])("rejects unsafe native schema before mutations %j", async (options) => {
        const f = nativeFixture(options);
        try {
            await expect(globalCalendarMigration.up(f.db)).rejects.toThrow();
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("backfills existing custom types with their module general form without renaming, recoloring or reviving them", async () => {
        const f = nativeFixture({ typeRows: [{ id: 91, module: 1, moduleCode: "formalizacion", code: "custom", formKey: null, status: "inactive" }] });
        try {
            await globalCalendarMigration.up(f.db);
            const updates = f.queries.filter((q) => q.sql.startsWith("UPDATE conf_calendar_event_type"));
            expect(updates).toHaveLength(1);
            expect(updates[0]?.parameters).toEqual(["formalizacion.general.v1", 91]);
            expect(updates[0]?.sql).not.toMatch(/SET .*name_calendar|SET .*color_calendar|SET .*status_calendar/);
            expect(f.queries.some((q) => q.sql.includes("form_key_calendar_event_type VARCHAR(100) NOT NULL"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("preserves inactive business roles and existing custom form keys", async () => {
        const f = nativeFixture({ inactiveRole: true, typeRows: [{ id: 91, module: 1, moduleCode: "formalizacion", code: "custom", formKey: "formalizacion.custom.v2", status: "active" }] });
        try {
            await globalCalendarMigration.up(f.db);
            expect(f.queries.some((q) => q.sql.startsWith("UPDATE conf_calendar_event_type"))).toBe(false);
            expect(f.queries.filter((q) => q.sql.startsWith("INSERT INTO sec_role_permission")).some((q) => q.parameters[0] === 1)).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("does not grant or seed inactive modules", async () => {
        const f = nativeFixture({ inactiveModule: true });
        try {
            await globalCalendarMigration.up(f.db);
            expect(f.queries.filter((q) => q.sql.startsWith("INSERT INTO conf_calendar_event_type"))).toHaveLength(3);
            expect(f.queries.filter((q) => q.sql.startsWith("INSERT INTO sec_role_permission")).some((q) => String(q.parameters[1]).startsWith("contabilidad."))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ badPermission: true }, { missingActor: true }, { failAudit: true }])("rolls back configuration/permission transaction on failure %j", async (options) => {
        const f = nativeFixture(options);
        try {
            await expect(globalCalendarMigration.up(f.db)).rejects.toThrow();
            expect(f.transactions).toContain("rollback");
            expect(f.transactions).not.toContain("commit");
        } finally {
            await f.db.destroy();
        }
    });
});

function parseLegacyDefault(suffix: string): string | null {
    const found = /DEFAULT (.+)$/.exec(suffix)?.[1];
    return found?.replace(/^'|'$/g, "") ?? null;
}
function legacyColumnMetadata(): Row[] {
    return legacyCalendarContextDdl.split("\n").flatMap((line) => {
        const match = /^ {4}(\w+) (INT|CHAR\(26\)|VARCHAR\(\d+\)|DATETIME\(3\)|JSON|TINYINT UNSIGNED) (.*) COMMENT '([^']+)'/.exec(line);
        if (!match) return [];
        const column_name = match[1] as string;
        const type = match[2] as string;
        const suffix = match[3] as string;
        const column_comment = match[4] as string;
        const column_default = parseLegacyDefault(suffix);
        const collation_name = /CHARACTER SET ascii/.test(suffix) ? "ascii_bin" : /^(?:CHAR|VARCHAR)/.test(type) ? "utf8mb4_unicode_ci" : null;
        return [{ column_name, column_type: type.toLowerCase(), is_nullable: suffix.includes("NOT NULL") ? "NO" : "YES", column_default, extra: "", column_comment, collation_name }];
    });
}
function legacyFixture(options: { database?: string; badParent?: boolean; lock?: number; existingDrift?: boolean; createFails?: boolean; existing?: boolean; columnDrift?: boolean; keyDrift?: boolean; indexDrift?: boolean; checkDrift?: boolean; triggerDrift?: boolean; missingTrigger?: boolean; statusClause?: string } = {}) {
    let exists = options.existing ?? false;
    let hasTrigger = exists && !options.missingTrigger;
    let triggerBody = "BEGIN IF BINARY NEW.module_code <> BINARY OLD.module_code OR NEW.calendar_id <> OLD.calendar_id OR BINARY NEW.public_id <> BINARY OLD.public_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Calendar context origin is immutable'; END IF; SET NEW.updated_at = UTC_TIMESTAMP(3); END";
    return doubleDatabase((q) => {
        if (q.sql.startsWith("CREATE TABLE")) {
            if (options.createFails) throw new Error("DDL unavailable");
            exists = true;
        }
        if (q.sql.startsWith("CREATE TRIGGER")) {
            hasTrigger = true;
            triggerBody = q.sql.split("FOR EACH ROW ")[1] as string;
        }
        const responses: [string, () => Row[]][] = [
            ["SELECT DATABASE()", () => [{ name: options.database ?? "crmdatabase-api" }]],
            ["GET_LOCK", () => [{ acquired: options.lock ?? 1 }]],
            ["information_schema.TABLES", () => [{ table_name: "calendars", table_type: "BASE TABLE", engine: "InnoDB" }, ...(exists || options.existingDrift ? [{ table_name: "crm_calendar_event_context", table_type: options.existingDrift ? "VIEW" : "BASE TABLE", engine: "InnoDB", collation: "utf8mb4_unicode_ci" }] : [])]],
            ["TABLE_NAME='calendars' AND COLUMN_NAME", () => [{ column_name: "id_calendar", column_type: options.badParent ? "bigint unsigned" : "int", is_nullable: "NO" }]],
            ["TABLE_NAME='calendars' AND INDEX_NAME", () => [{ index_name: "PRIMARY", column_name: "id_calendar", non_unique: 0, seq_in_index: 1, sub_part: null }]],
            ["information_schema.COLUMNS", () => legacyColumnMetadata().map((c) => (options.columnDrift && c.column_name === "status" ? { ...c, is_nullable: "YES" } : c))],
            [
                "information_schema.STATISTICS",
                () => {
                    const indexes: [string, number, string[]][] = [
                        ["PRIMARY", 0, ["calendar_id"]],
                        ["uq_calendar_context_public", 0, ["public_id"]],
                        ["ix_calendar_context_module_time", 1, ["module_code", "starts_at", "calendar_id"]],
                        ["ix_calendar_context_owner_time", 1, ["owner_user_public_id", "starts_at", "calendar_id"]],
                    ];
                    return options.indexDrift ? [] : indexes.flatMap(([index_name, non_unique, fields]) => fields.map((column_name, i) => ({ index_name, non_unique, seq_in_index: i + 1, column_name, sub_part: null })));
                },
            ],
            ["information_schema.KEY_COLUMN_USAGE", () => [{ column_name: "calendar_id", referenced_schema: options.keyDrift ? "CRM_THINK_V2" : "crmdatabase-api", referenced_table: "calendars", referenced_column: "id_calendar", position: 1, delete_rule: "RESTRICT", update_rule: "RESTRICT" }]],
            [
                "information_schema.TABLE_CONSTRAINTS",
                () =>
                    options.checkDrift
                        ? []
                        : [
                              ["ck_calendar_context_interval", "ends_at > starts_at"],
                              ["ck_calendar_context_flags", "version > 0 AND all_day IN (0,1)"],
                              ["ck_calendar_context_status", options.statusClause ?? "status IN ('scheduled','completed','cancelled')"],
                          ].map(([name, clause]) => ({ name, clause, enforced: "YES" })),
            ],
            ["information_schema.TRIGGERS", () => (hasTrigger ? [{ name: "trg_calendar_event_context_updated_utc", timing: "BEFORE", event: "UPDATE", orientation: "ROW", body: options.triggerDrift ? "SET NEW.updated_at=NOW()" : triggerBody }] : [])],
        ];
        return responses.find(([fragment]) => q.sql.includes(fragment))?.[1]() ?? [];
    });
}
describe("legacy calendar context additive runner", () => {
    it("plans only a new classified-context table and immutable-origin UTC trigger without data writes", async () => {
        const f = legacyFixture();
        try {
            const plan = await planLegacyCalendarContext(f.db);
            expect(plan).toHaveLength(2);
            const ddl = plan.join("\n");
            expect(ddl).toContain("CREATE TABLE crm_calendar_event_context");
            expect(ddl).toContain("REFERENCES calendars(id_calendar) ON DELETE RESTRICT ON UPDATE RESTRICT");
            for (const column of ["calendar_id", "public_id", "module_code", "event_type_code", "starts_at", "ends_at", "timezone", "version", "owner_user_public_id", "details", "created_at", "updated_at", "all_day", "status"]) expect(ddl).toMatch(new RegExp(`\\b${column}\\b`));
            expect(ddl).toContain("SIGNAL SQLSTATE");
            expect(ddl).toContain("UTC_TIMESTAMP(3)");
            expect(ddl).not.toMatch(/CRM_THINK_V2|INSERT |UPDATE calendars|DROP |ALTER TABLE calendars/);
            expect(writes(f.queries)).toEqual([]);
            expect(legacyCalendarContextDdl).toBe(plan[0]);
        } finally {
            await f.db.destroy();
        }
    });
    it("applies only CREATE DDL, verifies it, and a second apply is a no-op", async () => {
        const f = legacyFixture();
        try {
            expect(await runLegacyCalendarContext(f.db, true)).toHaveLength(2);
            expect(await runLegacyCalendarContext(f.db, true)).toEqual([]);
            expect(writes(f.queries).map((q) => q.sql.split(" ").slice(0, 2).join(" "))).toEqual(["CREATE TABLE", "CREATE TRIGGER"]);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ columnDrift: true }, { keyDrift: true }, { indexDrift: true }, { checkDrift: true }, { triggerDrift: true }])("rejects an existing table with drift without repairing it %j", async (drift) => {
        const f = legacyFixture({ existing: true, ...drift });
        try {
            await expect(runLegacyCalendarContext(f.db, true)).rejects.toThrow();
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("accepts the live backslash-quoted CHECK_CLAUSE and plans only the missing trigger", async () => {
        const statusClause = "(`status` in (_utf8mb4\\'scheduled\\',_utf8mb4\\'completed\\',_utf8mb4\\'cancelled\\'))";
        const f = legacyFixture({ existing: true, missingTrigger: true, statusClause });
        try {
            const plan = await planLegacyCalendarContext(f.db);
            expect(plan).toHaveLength(1);
            expect(plan[0]).toContain("CREATE TRIGGER");
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("still rejects changed status values in backslash-quoted metadata", async () => {
        const statusClause = "(`status` in (_utf8mb4\\'scheduled\\',_utf8mb4\\'completed\\',_utf8mb4\\'archived\\'))";
        const f = legacyFixture({ existing: true, missingTrigger: true, statusClause });
        try {
            await expect(planLegacyCalendarContext(f.db)).rejects.toThrow("check constraint drift");
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("recovers a table created before a failed trigger without replacing or altering the table", async () => {
        const f = legacyFixture({ existing: true, missingTrigger: true });
        try {
            expect(await runLegacyCalendarContext(f.db, true)).toHaveLength(1);
            expect(writes(f.queries)[0]?.sql).toContain("CREATE TRIGGER");
            expect(await planLegacyCalendarContext(f.db)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("--plan obtains/releases a lock without executing planned SQL", async () => {
        const f = legacyFixture();
        try {
            expect(await runLegacyCalendarContext(f.db, false)).toHaveLength(2);
            expect(writes(f.queries)).toEqual([]);
            expect(f.queries.at(-1)?.sql).toContain("RELEASE_LOCK");
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ database: "CRM_THINK_V2" }, { badParent: true }, { existingDrift: true }])("fails closed on legacy drift %j", async (options) => {
        const f = legacyFixture(options);
        try {
            await expect(runLegacyCalendarContext(f.db, true)).rejects.toThrow();
            expect(writes(f.queries)).toEqual([]);
            expect(f.queries.at(-1)?.sql).toContain("RELEASE_LOCK");
        } finally {
            await f.db.destroy();
        }
    });
    it("releases lock when DDL fails", async () => {
        const f = legacyFixture({ createFails: true });
        try {
            await expect(runLegacyCalendarContext(f.db, true)).rejects.toThrow("DDL unavailable");
            expect(f.queries.at(-1)?.sql).toContain("RELEASE_LOCK");
        } finally {
            await f.db.destroy();
        }
    });
    it("refuses an unavailable lock without DDL", async () => {
        const f = legacyFixture({ lock: 0 });
        try {
            await expect(runLegacyCalendarContext(f.db, true)).rejects.toThrow("lock");
            expect(writes(f.queries)).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
});
