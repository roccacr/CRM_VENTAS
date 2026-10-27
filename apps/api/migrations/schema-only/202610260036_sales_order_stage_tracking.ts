import { type Kysely, sql } from "kysely";

import { salesOrderStates } from "./202610200021_sales_orders.js";
import { buildSalesOrderStageDurationView, normalizeStageDurationView } from "./sales-order-stage-duration.sql.js";

type Metadata = Record<string, unknown>;
const table = "audit_sales_order_state_event";
const responsibleComment = "Responsable CRM de esta visita; null cuando no existe evidencia";
const snapshotComment = "Nombre y roles del responsable en esta visita; sin secretos";

/** Reject incompatible objects before any DDL or catalog insertion. */
export function assertStageMetadata(rows: Metadata[], expected: Metadata[]): void {
    if (rows.length !== expected.length || !expected.every((definition) => rows.some((row) => Object.entries(definition).every(([key, value]) => row[key] === value)))) throw new Error("Stage tracking schema drift; DBA reconciliation required");
}

/** Missing fields may be added; existing data, defaults and comments are never rewritten. */
export async function planStageColumns(db: Kysely<unknown>, definitions: readonly { name: string; type: string; comment: string }[]): Promise<string[]> {
    const names = definitions.map((definition) => definition.name);
    const columns = await sql<Metadata>`SELECT COLUMN_NAME AS column_name, COLUMN_TYPE AS column_type, IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default, EXTRA AS extra, COLUMN_COMMENT AS column_comment FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND COLUMN_NAME IN (${sql.join(names)})`.execute(db);
    const additions: string[] = [];
    for (const definition of definitions) {
        const existing = columns.rows.filter((row) => row.column_name === definition.name);
        if (!existing.length) additions.push(`ADD COLUMN ${definition.name} ${definition.type.toUpperCase()} NULL COMMENT '${definition.comment}'`);
        else assertStageMetadata(existing, [{ column_name: definition.name, column_type: definition.type, is_nullable: "YES", column_default: null, extra: "", column_comment: definition.comment }]);
    }
    return additions;
}

/** Existing views require the exact saved MySQL definition; never use CREATE OR REPLACE. */
export async function planStageDurationView(db: Kysely<unknown>, source: "native" | "legacy"): Promise<string[]> {
    const existing = await sql<Metadata>`SELECT TABLE_TYPE AS table_type FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_sales_order_state_duration'`.execute(db);
    const definition = buildSalesOrderStageDurationView(source);
    if (!existing.rows.length) return [`CREATE SQL SECURITY INVOKER VIEW audit_sales_order_state_duration AS ${definition}`];
    assertStageMetadata(existing.rows, [{ table_type: "VIEW" }]);
    const views = await sql<Metadata>`SELECT VIEW_DEFINITION AS definition, SECURITY_TYPE AS security_type, CHECK_OPTION AS check_option FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_sales_order_state_duration'`.execute(db);
    assertStageMetadata(
        views.rows.map((row) => ({ ...row, definition: normalizeStageDurationView(String(row.definition), source) })),
        [{ definition: normalizeStageDurationView(definition, source), security_type: "INVOKER", check_option: "NONE" }],
    );
    return [];
}

/** A populated catalog must match 021 exactly; partial catalogs require reconciliation. */
async function planStageCatalogs(db: Kysely<unknown>) {
    const states = salesOrderStates.map(([code, name], index) => ({ code, name, display_order: index }));
    const approvals = [
        { code: "sales_management", name: "Jefatura de ventas" },
        { code: "developer", name: "Desarrolladora" },
        { code: "formalization", name: "Formalizacion" },
    ];
    const currentStates = await sql<Metadata>`SELECT code_sales_order_state AS code, name_sales_order_state AS name, display_order_sales_order_state AS display_order FROM conf_sales_order_state`.execute(db);
    const currentApprovals = await sql<Metadata>`SELECT code_sales_order_approval_type AS code, name_sales_order_approval_type AS name FROM conf_sales_order_approval_type`.execute(db);
    if (currentStates.rows.length) assertStageMetadata(currentStates.rows, states);
    if (currentApprovals.rows.length) assertStageMetadata(currentApprovals.rows, approvals);
    return { states: currentStates.rows.length ? [] : states, approvals: currentApprovals.rows.length ? [] : approvals };
}

/** Catalog restoration is atomic; DDL is deliberately outside this transaction. */
async function restoreStageCatalogs(db: Kysely<unknown>, plan: Awaited<ReturnType<typeof planStageCatalogs>>): Promise<void> {
    if (!plan.states.length && !plan.approvals.length) return;
    await db.transaction().execute(async (transaction) => {
        for (const state of plan.states) await sql`INSERT INTO conf_sales_order_state (code_sales_order_state,name_sales_order_state,display_order_sales_order_state) VALUES (${state.code},${state.name},${state.display_order})`.execute(transaction);
        for (const approval of plan.approvals) await sql`INSERT INTO conf_sales_order_approval_type (code_sales_order_approval_type,name_sales_order_approval_type) VALUES (${approval.code},${approval.name})`.execute(transaction);
    });
}

/** Native-only, additive tracking and approved reference catalogs; no business rows. */
export const salesOrderStageTrackingMigration = {
    name: "202610260036_sales_order_stage_tracking",
    async up(db: Kysely<unknown>): Promise<void> {
        if ((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name !== "CRM_THINK_V2") throw new Error("Stage tracking requires CRM_THINK_V2");
        const tables = await sql<Metadata>`SELECT TABLE_NAME AS table_name, TABLE_TYPE AS table_type, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('audit_sales_order_state_event', 'sec_user', 'conf_sales_order_state', 'conf_sales_order_approval_type')`.execute(db);
        assertStageMetadata(
            tables.rows,
            [table, "sec_user", "conf_sales_order_state", "conf_sales_order_approval_type"].map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" })),
        );
        const additions = await planStageColumns(db, [
            { name: "responsible_user_id_sales_order_state_event", type: "bigint unsigned", comment: responsibleComment },
            { name: "responsible_snapshot_sales_order_state_event", type: "json", comment: snapshotComment },
        ]);
        const keys =
            await sql<Metadata>`SELECT k.CONSTRAINT_NAME AS constraint_name, k.COLUMN_NAME AS column_name, k.ORDINAL_POSITION AS ordinal_position, k.REFERENCED_TABLE_SCHEMA AS referenced_table_schema, k.REFERENCED_TABLE_NAME AS referenced_table_name, k.REFERENCED_COLUMN_NAME AS referenced_column_name, r.DELETE_RULE AS delete_rule, r.UPDATE_RULE AS update_rule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME=${table} AND (k.CONSTRAINT_NAME='fk_so_state_responsible' OR k.CONSTRAINT_NAME IN (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table} AND COLUMN_NAME='responsible_user_id_sales_order_state_event' AND REFERENCED_TABLE_NAME IS NOT NULL))`.execute(
                db,
            );
        if (keys.rows.length) assertStageMetadata(keys.rows, [{ constraint_name: "fk_so_state_responsible", column_name: "responsible_user_id_sales_order_state_event", ordinal_position: 1, referenced_table_schema: "CRM_THINK_V2", referenced_table_name: "sec_user", referenced_column_name: "id_user", delete_rule: "RESTRICT", update_rule: "RESTRICT" }]);
        else additions.push("ADD CONSTRAINT fk_so_state_responsible FOREIGN KEY (responsible_user_id_sales_order_state_event) REFERENCES sec_user(id_user) ON DELETE RESTRICT ON UPDATE RESTRICT");
        const views = await planStageDurationView(db, "native");
        const catalogs = await planStageCatalogs(db);
        if (additions.length) await sql.raw(`ALTER TABLE ${table} ${additions.join(", ")}`).execute(db);
        // Restore only empty reference catalogs, never upsert or overwrite user data.
        await restoreStageCatalogs(db, catalogs);
        for (const view of views) await sql.raw(view).execute(db);
    },
};
