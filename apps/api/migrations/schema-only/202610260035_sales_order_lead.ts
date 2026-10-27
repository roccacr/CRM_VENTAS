import { type Kysely, sql } from "kysely";

import { APPROVED_DATABASE_NAME } from "../../src/config/product.constants.js";

const columnComment = "Lead nativo relacionado con la orden; nullable hasta contar con evidencia explicita";

/** Reject drift before any DDL; never repair an incompatible existing object implicitly. */
function assertMetadata(rows: Record<string, unknown>[], expected: Record<string, unknown>[], message: string): void {
    if (rows.length !== expected.length || !expected.every((definition) => rows.some((row) => Object.entries(definition).every(([key, value]) => row[key] === value)))) throw new Error(message);
}

/** Reuse compatible objects; return only the static addition for a missing object. */
function missingAddition(rows: Record<string, unknown>[], expected: Record<string, unknown>, addition: string, message: string): string[] {
    if (!rows.length) return [addition];
    assertMetadata(rows, [expected], message);
    return [];
}

/** Optional native relationship only; existing orders remain unlinked without explicit evidence. */
export const salesOrderLeadMigration = {
    name: "202610260035_sales_order_lead",
    async up(db: Kysely<unknown>): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (destination.rows[0]?.name !== APPROVED_DATABASE_NAME) throw new Error("Sales order lead migration requires CRM_THINK_V2");
        const tables = await sql<Record<string, unknown>>`SELECT TABLE_NAME AS table_name, TABLE_TYPE AS table_type, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('crm_sales_order', 'crm_lead')`.execute(db);
        assertMetadata(
            tables.rows,
            ["crm_sales_order", "crm_lead"].map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" })),
            "Incompatible sales order/lead tables; DBA reconciliation required",
        );
        const columns = await sql<Record<string, unknown>>`SELECT COLUMN_TYPE AS column_type, IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default, EXTRA AS extra, COLUMN_COMMENT AS column_comment FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'crm_sales_order' AND COLUMN_NAME = 'lead_id_sales_order'`.execute(db);
        const indexes = await sql<Record<string, unknown>>`SELECT INDEX_NAME AS index_name, COLUMN_NAME AS column_name, SEQ_IN_INDEX AS seq_in_index, NON_UNIQUE AS non_unique, SUB_PART AS sub_part, INDEX_TYPE AS index_type, IS_VISIBLE AS is_visible FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'crm_sales_order' AND (INDEX_NAME = 'ix_crm_sales_order_lead' OR COLUMN_NAME = 'lead_id_sales_order')`.execute(db);
        // Include every component of any touching FK so composite or differently named links fail closed.
        const keys = await sql<
            Record<string, unknown>
        >`SELECT k.CONSTRAINT_NAME AS constraint_name, k.COLUMN_NAME AS column_name, k.ORDINAL_POSITION AS ordinal_position, k.REFERENCED_TABLE_SCHEMA AS referenced_table_schema, k.REFERENCED_TABLE_NAME AS referenced_table_name, k.REFERENCED_COLUMN_NAME AS referenced_column_name, r.DELETE_RULE AS delete_rule, r.UPDATE_RULE AS update_rule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.TABLE_NAME = k.TABLE_NAME AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'crm_sales_order' AND (k.CONSTRAINT_NAME = 'fk_crm_sales_order_lead' OR k.CONSTRAINT_NAME IN (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'crm_sales_order' AND COLUMN_NAME = 'lead_id_sales_order' AND REFERENCED_TABLE_NAME IS NOT NULL))`.execute(
            db,
        );
        if (!columns.rows.length && (indexes.rows.length || keys.rows.length)) throw new Error("Missing sales order lead column; DBA reconciliation required");

        // One additive ALTER avoids separate column/index/FK commits. Compatible partial state can resume.
        const additions = [
            ...missingAddition(columns.rows, { column_type: "bigint unsigned", is_nullable: "YES", column_default: null, extra: "", column_comment: columnComment }, `ADD COLUMN lead_id_sales_order BIGINT UNSIGNED NULL COMMENT '${columnComment}'`, "Incompatible sales order lead column; DBA reconciliation required"),
            ...missingAddition(indexes.rows, { index_name: "ix_crm_sales_order_lead", column_name: "lead_id_sales_order", seq_in_index: 1, non_unique: 1, sub_part: null, index_type: "BTREE", is_visible: "YES" }, "ADD INDEX ix_crm_sales_order_lead (lead_id_sales_order)", "Incompatible sales order lead index; DBA reconciliation required"),
            ...missingAddition(
                keys.rows,
                { constraint_name: "fk_crm_sales_order_lead", column_name: "lead_id_sales_order", ordinal_position: 1, referenced_table_schema: APPROVED_DATABASE_NAME, referenced_table_name: "crm_lead", referenced_column_name: "id_lead", delete_rule: "RESTRICT", update_rule: "RESTRICT" },
                "ADD CONSTRAINT fk_crm_sales_order_lead FOREIGN KEY (lead_id_sales_order) REFERENCES crm_lead(id_lead) ON DELETE RESTRICT ON UPDATE RESTRICT",
                "Incompatible sales order lead foreign key; DBA reconciliation required",
            ),
        ];
        if (additions.length) await sql.raw(`ALTER TABLE crm_sales_order ${additions.join(", ")}`).execute(db);
    },
};
