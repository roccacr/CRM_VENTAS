import { type Kysely, sql } from "kysely";

/** The new schema must never silently discard data from the previous storage model. */
const assertEmptySharedClasses = async <DB>(db: Kysely<DB>): Promise<void> => {
    const identity = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
    if (identity.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Classes migration requires CRM_THINK_V2");
    const items = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_catalog_item WHERE catalog_code_catalog_item='classes'`.execute(db);
    const references = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_catalog_item_external_reference WHERE catalog_code_catalog_item_external_reference='classes'`.execute(db);
    if (Number(items.rows[0]?.total) !== 0 || Number(references.rows[0]?.total) !== 0) throw new Error("Shared class data must be explicitly migrated before this empty-schema cutover");
};

/** Empty-schema cutover: refuses to discard any existing shared class data. */
export const classesDomainMigration = {
    name: "202610120011_classes_domain",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        await assertEmptySharedClasses(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_class (
            id_class BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la clase para relaciones del CRM.',
            public_id_class CHAR(26) NOT NULL COMMENT 'ULID publico y estable de la clase.',
            native_code_class VARCHAR(140) NOT NULL COMMENT 'Codigo nativo unico de la clase.',
            id_old_produccion_class INT NULL COMMENT 'Vinculo opcional a la fila legacy para evitar duplicados.',
            name_class VARCHAR(100) NOT NULL COMMENT 'Nombre visible de la clase; compatible con legacy.',
            detail_class VARCHAR(500) NULL COMMENT 'Descripcion opcional de la clase.',
            status_class ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Estado operativo de la clase.',
            created_at_class DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha de creacion nativa.',
            created_by_user_id_class BIGINT UNSIGNED NULL COMMENT 'Usuario que creo la clase.',
            updated_at_class DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha del ultimo cambio.',
            updated_by_user_id_class BIGINT UNSIGNED NULL COMMENT 'Usuario responsable del ultimo cambio.',
            inactivated_at_class DATETIME(3) NULL COMMENT 'Fecha de inactivacion si corresponde.',
            inactivated_by_user_id_class BIGINT UNSIGNED NULL COMMENT 'Usuario que inactivo la clase.',
            deleted_at_class DATETIME(3) NULL COMMENT 'Reserva de compatibilidad; no existe operacion de borrado.',
            deleted_by_user_id_class BIGINT UNSIGNED NULL COMMENT 'Reserva de compatibilidad; no se permite borrar clases.',
            PRIMARY KEY (id_class),
            UNIQUE KEY uq_crm_class_public_id (public_id_class),
            UNIQUE KEY uq_crm_class_native (native_code_class),
            UNIQUE KEY uq_crm_class_legacy (id_old_produccion_class),
            KEY idx_crm_class_status (status_class,deleted_at_class),
            CONSTRAINT fk_crm_class_created_by FOREIGN KEY (created_by_user_id_class) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_class_updated_by FOREIGN KEY (updated_by_user_id_class) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_class_inactivated_by FOREIGN KEY (inactivated_by_user_id_class) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_class_deleted_by FOREIGN KEY (deleted_by_user_id_class) REFERENCES sec_user(id_user)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_class_external_reference (
            id_class_external_reference BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la referencia externa.',
            class_id_class_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Clase nativa propietaria de la referencia.',
            external_system_id_class_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Proveedor externo registrado.',
            external_id_class_external_reference VARCHAR(180) NOT NULL COMMENT 'Identificador de la clase en el proveedor.',
            status_class_external_reference ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Estado de la relacion externa.',
            metadata_class_external_reference JSON NULL COMMENT 'Metadatos opcionales de la relacion.',
            created_at_class_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha de creacion de la referencia.',
            updated_at_class_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha del ultimo cambio de referencia.',
            deleted_at_class_external_reference DATETIME(3) NULL COMMENT 'Fecha de archivo; conserva la titularidad del identificador.',
            PRIMARY KEY (id_class_external_reference),
            UNIQUE KEY uq_crm_class_external_reference (external_system_id_class_external_reference,external_id_class_external_reference),
            KEY idx_crm_class_external_reference_class (class_id_class_external_reference,deleted_at_class_external_reference),
            CONSTRAINT fk_crm_class_external_reference_class FOREIGN KEY (class_id_class_external_reference) REFERENCES crm_class(id_class),
            CONSTRAINT fk_crm_class_external_reference_system FOREIGN KEY (external_system_id_class_external_reference) REFERENCES int_external_system(id_external_system)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        // Shared tables remain only for the four domains not yet split into independent tables.
        for (const constraint of [
            { table: "crm_catalog_item", name: "chk_catalog_item_not_classes", column: "catalog_code_catalog_item" },
            { table: "crm_catalog_item_external_reference", name: "chk_catalog_reference_not_classes", column: "catalog_code_catalog_item_external_reference" },
        ]) {
            const existing = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=${constraint.table} AND CONSTRAINT_NAME=${constraint.name}`.execute(db);
            if (Number(existing.rows[0]?.total) === 0) await sql`ALTER TABLE ${sql.table(constraint.table)} ADD CONSTRAINT ${sql.id(constraint.name)} CHECK (${sql.ref(constraint.column)} <> 'classes')`.execute(db);
        }
    },
};
