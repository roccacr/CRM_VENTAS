import { type Kysely, sql } from "kysely";

/** The new schema must never silently discard data from the previous storage model. */
const assertEmptySharedLocations = async <DB>(db: Kysely<DB>): Promise<void> => {
    const identity = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
    if (identity.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Locations migration requires CRM_THINK_V2");
    const items = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_catalog_item WHERE catalog_code_catalog_item='locations'`.execute(db);
    const references = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_catalog_item_external_reference WHERE catalog_code_catalog_item_external_reference='locations'`.execute(db);
    if (Number(items.rows[0]?.total) !== 0 || Number(references.rows[0]?.total) !== 0) throw new Error("Shared location data must be explicitly migrated before this empty-schema cutover");
};

/** Empty-schema cutover: refuses to discard any existing shared location data. */
export const locationsDomainMigration = {
    name: "202610120012_locations_domain",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        await assertEmptySharedLocations(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_location (
            id_location BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la ubicación para relaciones del CRM.',
            public_id_location CHAR(26) NOT NULL COMMENT 'ULID publico y estable de la ubicación.',
            native_code_location VARCHAR(140) NOT NULL COMMENT 'Codigo nativo unico de la ubicación.',
            id_old_produccion_location INT NULL COMMENT 'Vinculo opcional a la fila legacy para evitar duplicados.',
            name_location VARCHAR(100) NOT NULL COMMENT 'Nombre visible de la ubicación; compatible con legacy.',
            detail_location VARCHAR(500) NULL COMMENT 'Descripcion opcional de la ubicación.',
            status_location ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Estado operativo de la ubicación.',
            created_at_location DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha de creacion nativa.',
            created_by_user_id_location BIGINT UNSIGNED NULL COMMENT 'Usuario que creo la ubicación.',
            updated_at_location DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha del ultimo cambio.',
            updated_by_user_id_location BIGINT UNSIGNED NULL COMMENT 'Usuario responsable del ultimo cambio.',
            inactivated_at_location DATETIME(3) NULL COMMENT 'Fecha de inactivacion si corresponde.',
            inactivated_by_user_id_location BIGINT UNSIGNED NULL COMMENT 'Usuario que inactivo la ubicación.',
            deleted_at_location DATETIME(3) NULL COMMENT 'Reserva de compatibilidad; no existe operacion de borrado.',
            deleted_by_user_id_location BIGINT UNSIGNED NULL COMMENT 'Reserva de compatibilidad; no se permite borrar ubicaciones.',
            PRIMARY KEY (id_location),
            UNIQUE KEY uq_crm_location_public_id (public_id_location),
            UNIQUE KEY uq_crm_location_native (native_code_location),
            UNIQUE KEY uq_crm_location_legacy (id_old_produccion_location),
            KEY idx_crm_location_status (status_location,deleted_at_location),
            CONSTRAINT fk_crm_location_created_by FOREIGN KEY (created_by_user_id_location) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_location_updated_by FOREIGN KEY (updated_by_user_id_location) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_location_inactivated_by FOREIGN KEY (inactivated_by_user_id_location) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_location_deleted_by FOREIGN KEY (deleted_by_user_id_location) REFERENCES sec_user(id_user)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_location_external_reference (
            id_location_external_reference BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la referencia externa.',
            location_id_location_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Ubicación nativa propietaria de la referencia.',
            external_system_id_location_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Proveedor externo registrado.',
            external_id_location_external_reference VARCHAR(180) NOT NULL COMMENT 'Identificador de la ubicación en el proveedor.',
            status_location_external_reference ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Estado de la relacion externa.',
            metadata_location_external_reference JSON NULL COMMENT 'Metadatos opcionales de la relacion.',
            created_at_location_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha de creacion de la referencia.',
            updated_at_location_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha del ultimo cambio de referencia.',
            deleted_at_location_external_reference DATETIME(3) NULL COMMENT 'Fecha de archivo; conserva la titularidad del identificador.',
            PRIMARY KEY (id_location_external_reference),
            UNIQUE KEY uq_crm_location_external_reference (external_system_id_location_external_reference,external_id_location_external_reference),
            KEY idx_crm_location_external_reference_location (location_id_location_external_reference,deleted_at_location_external_reference),
            CONSTRAINT fk_crm_location_external_reference_location FOREIGN KEY (location_id_location_external_reference) REFERENCES crm_location(id_location),
            CONSTRAINT fk_crm_location_external_reference_system FOREIGN KEY (external_system_id_location_external_reference) REFERENCES int_external_system(id_external_system)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        // Shared tables remain only for the three domains not yet split into independent tables.
        for (const constraint of [
            { table: "crm_catalog_item", name: "chk_catalog_item_not_locations", column: "catalog_code_catalog_item" },
            { table: "crm_catalog_item_external_reference", name: "chk_catalog_reference_not_locations", column: "catalog_code_catalog_item_external_reference" },
        ]) {
            const existing = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=${constraint.table} AND CONSTRAINT_NAME=${constraint.name}`.execute(db);
            if (Number(existing.rows[0]?.total) === 0) await sql`ALTER TABLE ${sql.table(constraint.table)} ADD CONSTRAINT ${sql.id(constraint.name)} CHECK (${sql.ref(constraint.column)} <> 'locations')`.execute(db);
        }
    },
};
