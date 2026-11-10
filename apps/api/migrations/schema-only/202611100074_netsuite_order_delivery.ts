import { type Kysely, sql } from "kysely";

export const netsuiteOrderDeliveryMigration = {
    name: "202611100074_netsuite_order_delivery",
    async up(db: Kysely<unknown>): Promise<void> {
        // Una sola fuente CRM para ambas bases sin alterar el esquema legado.
        await sql`CREATE TABLE IF NOT EXISTS int_netsuite_order_delivery (
            destination ENUM('native','legacy') NOT NULL,
            order_id BIGINT UNSIGNED NOT NULL,
            delivered_on DATE NULL,
            PRIMARY KEY (destination,order_id)
        ) ENGINE=InnoDB`.execute(db);
    },
};
