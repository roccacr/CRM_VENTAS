import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { salesOrderStates } from "../../migrations/schema-only/202610200021_sales_orders.js";
import { salesOrderStageTrackingMigration } from "../../migrations/schema-only/202610260036_sales_order_stage_tracking.js";
import { buildSalesOrderStageDurationView, normalizeStageDurationView } from "../../migrations/schema-only/sales-order-stage-duration.sql.js";
import { planLegacyStageTracking, runLegacyStageTracking } from "../../scripts/migrate-legacy-sales-order-stage-tracking.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";
import { anyOf } from "../support/throws.js";

function fixture(drift = false, database = "CRM_THINK_V2", responses: [string, Record<string, unknown>[]][] = []) {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const inventory: [string, Record<string, unknown>[]][] = [
                    ...responses,
                    ["FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_sales_order_state_duration'", []],
                    ["DATABASE() AS name", [{ name: database }]],
                    ["information_schema.TABLES", (database === "crmdatabase-api" ? ["audit_sales_order_state_event"] : ["audit_sales_order_state_event", "sec_user", "conf_sales_order_state", "conf_sales_order_approval_type"]).map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" }))],
                    ["COLUMN_NAME='actor_reference_sales_order_state_event'", [{ column_type: "varchar(180)", is_nullable: "YES" }]],
                    ["information_schema.COLUMNS", drift ? [{ column_name: "responsible_user_id_sales_order_state_event", column_type: "int", is_nullable: "NO" }] : []],
                ];
                const rows = inventory.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}

describe("stage tracking migration slice", () => {
    it.each([false, true])("legacy runner holds a lock and only executes additions when apply=%s", async (apply) => {
        const f = fixture(false, "crmdatabase-api", [["GET_LOCK", [{ acquired: 1 }]]]);
        try {
            expect(await runLegacyStageTracking(f.db, apply)).toHaveLength(2);
            expect(f.queries.filter((q) => q.sql.startsWith("ALTER TABLE"))).toHaveLength(apply ? 1 : 0);
            expect(f.queries.filter((q) => q.sql.startsWith("CREATE SQL SECURITY INVOKER VIEW"))).toHaveLength(apply ? 1 : 0);
            expect(f.queries.at(-1)?.sql).toContain("RELEASE_LOCK");
        } finally {
            await f.db.destroy();
        }
    });
    it("legacy runner rejects native destination and releases its lock", async () => {
        const f = fixture(false, "CRM_THINK_V2", [["GET_LOCK", [{ acquired: 1 }]]]);
        try {
            await expect(runLegacyStageTracking(f.db, true)).rejects.toThrow("crmdatabase-api");
            expect(f.queries.every((q) => q.sql.startsWith("SELECT"))).toBe(true);
            expect(f.queries.at(-1)?.sql).toContain("RELEASE_LOCK");
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["SELECT code_sales_order_state", "SELECT code_sales_order_approval_type", "information_schema.VIEWS"])("rejects catalog/view drift before any write: %s", async (fragment) => {
        const responses: [string, Record<string, unknown>[]][] = [[fragment, [{ code: "changed", definition: "SELECT 1", security_type: "DEFINER", check_option: "NONE" }]]];
        if (fragment.includes("VIEWS")) responses.push(["FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_sales_order_state_duration'", [{ table_type: "VIEW" }]]);
        const f = fixture(false, "CRM_THINK_V2", responses);
        try {
            await expect(salesOrderStageTrackingMigration.up(f.db)).rejects.toThrow("Stage tracking schema drift; DBA reconciliation required");
            expect(f.queries.every((q) => q.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("is a no-op with compatible completed native schema, catalogs and view", async () => {
        const definition = buildSalesOrderStageDurationView("native");
        const f = fixture(false, "CRM_THINK_V2", [
            [
                "information_schema.COLUMNS",
                [
                    { column_name: "responsible_user_id_sales_order_state_event", column_type: "bigint unsigned", is_nullable: "YES", column_default: null, extra: "", column_comment: "Responsable CRM de esta visita; null cuando no existe evidencia" },
                    { column_name: "responsible_snapshot_sales_order_state_event", column_type: "json", is_nullable: "YES", column_default: null, extra: "", column_comment: "Nombre y roles del responsable en esta visita; sin secretos" },
                ],
            ],
            ["information_schema.KEY_COLUMN_USAGE", [{ constraint_name: "fk_so_state_responsible", column_name: "responsible_user_id_sales_order_state_event", ordinal_position: 1, referenced_table_schema: "CRM_THINK_V2", referenced_table_name: "sec_user", referenced_column_name: "id_user", delete_rule: "RESTRICT", update_rule: "RESTRICT" }]],
            ["SELECT code_sales_order_state", salesOrderStates.map(([code, name], display_order) => ({ code, name, display_order }))],
            [
                "SELECT code_sales_order_approval_type",
                [
                    { code: "sales_management", name: "Jefatura de ventas" },
                    { code: "developer", name: "Desarrolladora" },
                    { code: "formalization", name: "Formalizacion" },
                ],
            ],
            ["FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_sales_order_state_duration'", [{ table_type: "VIEW" }]],
            ["information_schema.VIEWS", [{ definition, security_type: "INVOKER", check_option: "NONE" }]],
        ]);
        try {
            await salesOrderStageTrackingMigration.up(f.db);
            expect(f.queries.every((q) => q.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["SET NULL", "CASCADE"])("rejects native FK deletion drift: %s", async (delete_rule) => {
        const f = fixture(false, "CRM_THINK_V2", [["information_schema.KEY_COLUMN_USAGE", [{ constraint_name: "fk_so_state_responsible", column_name: "responsible_user_id_sales_order_state_event", ordinal_position: 1, referenced_table_schema: "CRM_THINK_V2", referenced_table_name: "sec_user", referenced_column_name: "id_user", delete_rule, update_rule: "RESTRICT" }]]]);
        try {
            await expect(salesOrderStageTrackingMigration.up(f.db)).rejects.toThrow("Stage tracking schema drift; DBA reconciliation required");
            expect(f.queries.every((q) => q.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects an existing legacy responsible FK before DDL", async () => {
        const f = fixture(false, "crmdatabase-api", [["information_schema.KEY_COLUMN_USAGE", [{ column_name: "responsible_reference_sales_order_state_event" }]]]);
        try {
            await expect(planLegacyStageTracking(f.db)).rejects.toThrow("Stage tracking schema drift; DBA reconciliation required");
            expect(f.queries.every((q) => q.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("registers 036 and restores only the approved empty catalogs", async () => {
        expect(selectSchemaMigrations(salesOrderStageTrackingMigration.name)).toEqual([salesOrderStageTrackingMigration]);
        const f = fixture();
        try {
            await salesOrderStageTrackingMigration.up(f.db);
            const statements = f.queries.map((q) => q.sql);
            expect(statements.filter((q) => q.startsWith("INSERT INTO conf_sales_order_state"))).toHaveLength(9);
            expect(statements.filter((q) => q.startsWith("INSERT INTO conf_sales_order_approval_type"))).toHaveLength(3);
            expect(statements.find((q) => q.startsWith("ALTER TABLE"))).toContain("ON DELETE RESTRICT ON UPDATE RESTRICT");
            expect(statements.join("\n")).not.toMatch(/INSERT INTO (crm_|sec_)|^UPDATE |DELETE FROM|crmdatabase-api/m);
            expect(statements.some((q) => q.startsWith("CREATE OR REPLACE"))).toBe(false);
            expect(statements.some((q) => q.startsWith("CREATE SQL SECURITY INVOKER VIEW"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["native", "legacy"] as const)("accepts MySQL quoting/grouping but detects literal and source drift in %s view", (source) => {
        const definition = buildSalesOrderStageDurationView(source);
        const canonical = definition.replaceAll("v.order_id", "`v`.`order_id` AS `order_id`").replaceAll("= 'closed'", "= _utf8mb4'closed'").replace("CASE WHEN", "(CASE WHEN").replace(" END AS left_at", " END) AS left_at");
        expect(normalizeStageDurationView(canonical, source)).toEqual(normalizeStageDurationView(definition, source));
        expect(normalizeStageDurationView(definition.replaceAll("'closed'", "'bank_management'"), source)).not.toEqual(normalizeStageDurationView(definition, source));
        expect(normalizeStageDurationView(definition.replace("FROM audit_sales_order_state_event", "FROM other_schema.audit_sales_order_state_event"), source)).not.toEqual(normalizeStageDurationView(definition, source));
    });
    it.each([
        [true, "CRM_THINK_V2"],
        [false, "crmdatabase-api"],
    ] as const)("fails closed before writes for drift or destination", async (drift, database) => {
        const f = fixture(drift, database);
        try {
            await expect(salesOrderStageTrackingMigration.up(f.db)).rejects.toThrow(anyOf("Stage tracking schema drift; DBA reconciliation required", "Stage tracking requires CRM_THINK_V2"));
            expect(f.queries.every((q) => q.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("legacy plans only three additions and preserves actor reference", async () => {
        const f = fixture(false, "crmdatabase-api");
        try {
            const statements = await planLegacyStageTracking(f.db);
            expect(statements.join("\n")).toContain("responsible_reference_sales_order_state_event VARCHAR(180) NULL");
            expect(statements.join("\n")).not.toMatch(/FOREIGN KEY|INSERT|UPDATE|DELETE|sec_user/);
            expect(statements.join("\n")).not.toContain("ADD COLUMN actor_reference");
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["native", "legacy"] as const)("builds normalized per-visit read-only window SQL for %s", (source) => {
        const view = buildSalesOrderStageDurationView(source);
        for (const alias of ["order_id", "sequence", "state_code", "from_state_code", "entered_at", "recorded_at", "left_at", "duration_seconds", "is_current", "actor_reference", "responsible_reference", "actor_snapshot", "responsible_snapshot", "process_started_at", "process_finished_at", "total_duration_seconds"]) expect(view).toContain(alias);
        expect(view).toContain("LEAD(e.effective_at_sales_order_state_event)");
        expect(view).toContain("LEAD(e.sequence_sales_order_state_event)");
        expect(view).toContain("FIRST_VALUE(e.from_state_code_sales_order_state_event)");
        expect(view).toContain("v.next_sequence IS NOT NULL THEN v.next_entered_at");
        expect(view).toContain("CASE WHEN v.next_sequence IS NOT NULL THEN v.next_entered_at ELSE NULL END AS left_at");
        expect(view).toContain("v.entered_at > UTC_TIMESTAMP(3) THEN NULL");
        expect(view).toContain("v.entered_at <=");
        expect(view).toContain("v.process_started_at <=");
        expect(view).toContain("state_code = 'closed' THEN 0");
        expect(view).not.toMatch(/INSERT|UPDATE|DELETE|REPLACE/);
    });
});
