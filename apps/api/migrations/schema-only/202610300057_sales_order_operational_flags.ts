import { type Kysely, sql } from "kysely";

/** Independent ERP facts; none of these flags moves the CRM workflow by itself. */
export const salesOrderFlagColumns = [
    { native: "unit_delivered_sales_order", legacy: "unidad_entregada_ov", label: "Unidad entregada" },
    { native: "unit_transferred_sales_order", legacy: "unidad_traspasada_ov", label: "Unidad traspasada" },
    { native: "keys_delivered_sales_order", legacy: "entrega_llaves_ov", label: "Entrega de llaves" },
    { native: "trust_down_payment_validated_sales_order", legacy: "validacion_fideicomiso_prima_ov", label: "Validacion fideicomiso/prima" },
    { native: "commission_approved_sales_order", legacy: "comision_aprobada_ov", label: "Comision aprobada" },
    { native: "broker_commission_calculated_sales_order", legacy: "calculo_comision_corredor_ov", label: "Calculo comision corredor" },
    { native: "installments_fully_paid_sales_order", legacy: "cuotas_pagadas_completo_ov", label: "Cuotas pagadas por completo; independiente de pagadas_ov" },
] as const;

type Source = "native" | "legacy";
type FlagColumn = { name: string; type: string; nullable: string; defaultValue: string | null };
const targets = {
    native: { database: "CRM_THINK_V2", table: "crm_sales_order", type: "enum('yes','no','unknown')", nullable: "NO", defaultValue: "unknown", ddl: "ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown'" },
    legacy: { database: "crmdatabase-api", table: "ordenventa", type: "tinyint unsigned", nullable: "YES", defaultValue: null, ddl: "TINYINT UNSIGNED NULL DEFAULT NULL" },
} as const;

/** An additive migration must never repair or reinterpret an existing incompatible column. */
function assertCompatibleFlag(column: FlagColumn | undefined, target: (typeof targets)[Source]): void {
    if (!column) return;
    if (column.type !== target.type || column.nullable !== target.nullable || column.defaultValue !== target.defaultValue) throw new Error(`Sales order flag column drift: ${column.name}`);
}

/** Only the named business table in the approved schema can receive these columns. */
async function assertSalesOrderTarget(db: Kysely<unknown>, target: (typeof targets)[Source]): Promise<void> {
    if ((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name !== target.database) throw new Error("Sales order flags destination mismatch");
    const table = (await sql<{ engine: string; kind: string }>`SELECT ENGINE AS engine,TABLE_TYPE AS kind FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${target.table}`.execute(db)).rows;
    if (table.length !== 1 || table[0]?.engine !== "InnoDB" || table[0].kind !== "BASE TABLE") throw new Error("Sales order flags require the existing InnoDB table");
}

/** Read-only preflight: reject wrong destinations or incompatible partial DDL before adding anything. */
export async function planSalesOrderFlags(db: Kysely<unknown>, source: Source): Promise<string[]> {
    const target = targets[source];
    await assertSalesOrderTarget(db, target);
    const columns = (await sql<FlagColumn>`SELECT COLUMN_NAME AS name,COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${target.table}`.execute(db)).rows;
    const additions: string[] = [];
    for (const flag of salesOrderFlagColumns) {
        const column = columns.find((candidate) => candidate.name === flag[source]);
        assertCompatibleFlag(column, target);
        // Unknown preserves historical uncertainty; never backfill false or reinterpret pagadas_ov.
        if (!column) additions.push(`ADD COLUMN \`${flag[source]}\` ${target.ddl} COMMENT '${flag.label}'`);
    }
    // Fail rather than silently rebuild the production table if instant ADD is unavailable.
    return additions.length ? [`ALTER TABLE \`${target.table}\` ${additions.join(", ")}, ALGORITHM=INSTANT`] : [];
}

/** MySQL DDL auto-commits. Re-entry validates partial progress and adds only missing columns. */
export async function applySalesOrderFlags(db: Kysely<unknown>, source: Source): Promise<string[]> {
    const plan = await planSalesOrderFlags(db, source);
    for (const statement of plan) await sql.raw(statement).execute(db);
    if ((await planSalesOrderFlags(db, source)).length !== 0) throw new Error("Sales order flags verification incomplete");
    return plan;
}

/** Native runner never touches legacy; that destination uses the separate explicit CLI. */
export const salesOrderOperationalFlagsMigration = {
    name: "202610300057_sales_order_operational_flags",
    async up(db: Kysely<unknown>): Promise<void> {
        await applySalesOrderFlags(db, "native");
    },
};
