import { type Kysely, sql } from "kysely";

/** The new schema must never silently discard data from the previous storage model. */
const assertEmptySharedBrokers = async <DB>(db: Kysely<DB>): Promise<void> => {
    const identity = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
    if (identity.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Brokers migration requires CRM_THINK_V2");
    const items = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_catalog_item WHERE catalog_code_catalog_item='brokers'`.execute(db);
    const references = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_catalog_item_external_reference WHERE catalog_code_catalog_item_external_reference='brokers'`.execute(db);
    if (Number(items.rows[0]?.total) !== 0 || Number(references.rows[0]?.total) !== 0) throw new Error("Shared broker data must be explicitly migrated before this empty-schema cutover");
};

/** Empty-schema cutover: refuses to discard any existing shared broker data. */
export const brokersDomainMigration = {
    name: "202610120014_brokers_domain",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        await assertEmptySharedBrokers(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_broker (
            id_broker BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno del corredor para relaciones del CRM.',
            public_id_broker CHAR(26) NOT NULL COMMENT 'ULID publico y estable del corredor.',
            native_code_broker VARCHAR(140) NOT NULL COMMENT 'Codigo nativo unico del corredor.',
            id_old_produccion_broker INT NULL COMMENT 'Vinculo opcional a la fila legacy para evitar duplicados.',
            name_broker VARCHAR(250) NOT NULL COMMENT 'Nombre visible del corredor; compatible con legacy.',
            detail_broker VARCHAR(500) NULL COMMENT 'Descripcion opcional del corredor.',
            status_broker ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Estado operativo del corredor.',
            created_at_broker DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha de creacion nativa.',
            created_by_user_id_broker BIGINT UNSIGNED NULL COMMENT 'Usuario que creo el corredor.',
            updated_at_broker DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha del ultimo cambio.',
            updated_by_user_id_broker BIGINT UNSIGNED NULL COMMENT 'Usuario responsable del ultimo cambio.',
            inactivated_at_broker DATETIME(3) NULL COMMENT 'Fecha de inactivacion si corresponde.',
            inactivated_by_user_id_broker BIGINT UNSIGNED NULL COMMENT 'Usuario que inactivo el corredor.',
            deleted_at_broker DATETIME(3) NULL COMMENT 'Reserva de compatibilidad; no existe operacion de borrado.',
            deleted_by_user_id_broker BIGINT UNSIGNED NULL COMMENT 'Reserva de compatibilidad; no se permite borrar corredores.',
            PRIMARY KEY (id_broker),
            UNIQUE KEY uq_crm_broker_public_id (public_id_broker),
            UNIQUE KEY uq_crm_broker_native (native_code_broker),
            UNIQUE KEY uq_crm_broker_legacy (id_old_produccion_broker),
            KEY idx_crm_broker_status (status_broker,deleted_at_broker),
            CONSTRAINT fk_crm_broker_created_by FOREIGN KEY (created_by_user_id_broker) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_broker_updated_by FOREIGN KEY (updated_by_user_id_broker) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_broker_inactivated_by FOREIGN KEY (inactivated_by_user_id_broker) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_broker_deleted_by FOREIGN KEY (deleted_by_user_id_broker) REFERENCES sec_user(id_user)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_broker_external_reference (
            id_broker_external_reference BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la referencia externa.',
            broker_id_broker_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Corredor nativo propietario de la referencia.',
            external_system_id_broker_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Proveedor externo registrado.',
            external_id_broker_external_reference VARCHAR(180) NOT NULL COMMENT 'Identificador del corredor en el proveedor.',
            status_broker_external_reference ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Estado de la relacion externa.',
            metadata_broker_external_reference JSON NULL COMMENT 'Metadatos opcionales de la relacion.',
            created_at_broker_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha de creacion de la referencia.',
            updated_at_broker_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha del ultimo cambio de referencia.',
            deleted_at_broker_external_reference DATETIME(3) NULL COMMENT 'Fecha de archivo; conserva la titularidad del identificador.',
            PRIMARY KEY (id_broker_external_reference),
            UNIQUE KEY uq_crm_broker_external_reference (external_system_id_broker_external_reference,external_id_broker_external_reference),
            KEY idx_crm_broker_external_reference_broker (broker_id_broker_external_reference,deleted_at_broker_external_reference),
            CONSTRAINT fk_crm_broker_external_reference_broker FOREIGN KEY (broker_id_broker_external_reference) REFERENCES crm_broker(id_broker),
            CONSTRAINT fk_crm_broker_external_reference_system FOREIGN KEY (external_system_id_broker_external_reference) REFERENCES int_external_system(id_external_system)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        // Shared tables remain only for the domain not yet split into independent tables.
        for (const constraint of [
            { table: "crm_catalog_item", name: "chk_catalog_item_not_brokers", column: "catalog_code_catalog_item" },
            { table: "crm_catalog_item_external_reference", name: "chk_catalog_reference_not_brokers", column: "catalog_code_catalog_item_external_reference" },
        ]) {
            const existing = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=${constraint.table} AND CONSTRAINT_NAME=${constraint.name}`.execute(db);
            if (Number(existing.rows[0]?.total) === 0) await sql`ALTER TABLE ${sql.table(constraint.table)} ADD CONSTRAINT ${sql.id(constraint.name)} CHECK (${sql.ref(constraint.column)} <> 'brokers')`.execute(db);
        }
    },
};
