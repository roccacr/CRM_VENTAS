import { type Kysely, sql } from "kysely";

/** Sin backfill: desconocido no equivale a F. La extracción posterior solo actualizará este indicador. */
export const salesOrderReservationAppliedMigration = {
    name: "202611120075_sales_order_reservation_applied",
    async up(db: Kysely<unknown>): Promise<void> {
        await sql`ALTER TABLE crm_sales_order ADD COLUMN reservation_applied_sales_order ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown'`.execute(db);
        await sql`ALTER TABLE int_netsuite_order_cursor ADD COLUMN reservation_modified_ms BIGINT NULL, ADD COLUMN reservation_completed_ms BIGINT NULL`.execute(db);
    },
    async down(db: Kysely<unknown>): Promise<void> {
        await sql`ALTER TABLE int_netsuite_order_cursor DROP COLUMN reservation_modified_ms, DROP COLUMN reservation_completed_ms`.execute(db);
        await sql`ALTER TABLE crm_sales_order DROP COLUMN reservation_applied_sales_order`.execute(db);
    },
};

/** Histórico075: esta columna quedó obsoleta al confirmar negocio `custbody209 → reserva_ov`.
 * Se conserva el DDL aplicado y su rollback, pero ningún lector/escritor runtime debe utilizarla.
 * El runner nativo nunca modifica el esquema viejo implícitamente.
 */
export const legacyReservationAppliedUp = sql`ALTER TABLE \`crmdatabase-api\`.ordenventa ADD COLUMN reserva_aplicada_ov TINYINT UNSIGNED NULL DEFAULT NULL`;
export const legacyReservationAppliedDown = sql`ALTER TABLE \`crmdatabase-api\`.ordenventa DROP COLUMN reserva_aplicada_ov`;
