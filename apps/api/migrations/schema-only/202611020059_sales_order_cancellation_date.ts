import { type Kysely, sql } from "kysely";

/** Fecha de marcado de caida; calendario Costa Rica, independiente de etapa y del lead. No toca legacy. */
export const salesOrderCancellationDateMigration = {
    name: "202611020059_sales_order_cancellation_date",
    async up(db: Kysely<unknown>): Promise<void> {
        const name = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name;
        if (name !== "CRM_THINK_V2") throw new Error("Cancellation date requires CRM_THINK_V2");
        const column = (await sql<{ type: string; nullable: string; defaultValue: string | null }>`SELECT DATA_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_sales_order' AND COLUMN_NAME='cancellation_marked_on_sales_order'`.execute(db)).rows[0];
        if (column) {
            if (column.type !== "date" || column.nullable !== "YES" || column.defaultValue !== null) throw new Error("Cancellation date schema drift");
            return;
        }
        await sql`ALTER TABLE crm_sales_order ADD COLUMN cancellation_marked_on_sales_order DATE NULL DEFAULT NULL COMMENT 'Fecha calendario Costa Rica del marcado de venta caida; no cambia la etapa ni el lead', ALGORITHM=INSTANT`.execute(db);
    },
};
