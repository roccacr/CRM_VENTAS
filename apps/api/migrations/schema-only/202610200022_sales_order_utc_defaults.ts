import { type Kysely, sql } from "kysely";

/** Existing installations were created on a UTC-6 server. Only new-table defaults change. */
export const salesOrderUtcDefaultsMigration = {
    name: "202610200022_sales_order_utc_defaults",
    async up(db: Kysely<unknown>): Promise<void> {
        const result = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (result.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Sales order UTC defaults require CRM_THINK_V2");
        for (const statement of [
            "ALTER TABLE crm_sales_order MODIFY COLUMN created_at_sales_order DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Instante de creacion del registro en CRM nuevo; UTC'",
            "ALTER TABLE crm_sales_order MODIFY COLUMN updated_at_sales_order DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Ultima modificacion local auditada; UTC'",
            "ALTER TABLE crm_sales_order_external_reference MODIFY COLUMN created_at_sales_order_external_reference DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha de registro del enlace; UTC'",
            "ALTER TABLE crm_sales_order_external_reference MODIFY COLUMN updated_at_sales_order_external_reference DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Ultima conciliacion del enlace; UTC'",
            "ALTER TABLE crm_sales_order_approval MODIFY COLUMN updated_at_sales_order_approval DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Registro de ultima observacion o cambio; no fecha historica inferida'",
            "ALTER TABLE audit_sales_order_state_event MODIFY COLUMN recorded_at_sales_order_state_event DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Cuando CRM registro la evidencia; UTC'",
            "ALTER TABLE audit_sales_order_approval_event MODIFY COLUMN recorded_at_sales_order_approval_event DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Cuando se registro el evento; UTC'",
            "ALTER TABLE int_sales_order_source_snapshot MODIFY COLUMN observed_at_sales_order_source_snapshot DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha de lectura; no fecha efectiva del pasado'",
            "ALTER TABLE audit_sales_order_change MODIFY COLUMN recorded_at_sales_order_change DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha de registro de la auditoria; UTC'",
        ])
            await sql.raw(statement).execute(db);
    },
};
