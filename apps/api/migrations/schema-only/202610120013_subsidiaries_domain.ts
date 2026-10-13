import { type Kysely, sql } from "kysely";

/** The new schema must never silently discard data from the previous storage model. */
const assertEmptySharedSubsidiaries = async <DB>(db: Kysely<DB>): Promise<void> => {
    const identity = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
    if (identity.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Subsidiaries migration requires CRM_THINK_V2");
    const items = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_catalog_item WHERE catalog_code_catalog_item='subsidiaries'`.execute(db);
    const references = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_catalog_item_external_reference WHERE catalog_code_catalog_item_external_reference='subsidiaries'`.execute(db);
    if (Number(items.rows[0]?.total) !== 0 || Number(references.rows[0]?.total) !== 0) throw new Error("Shared subsidiary data must be explicitly migrated before this empty-schema cutover");
};

/** Empty-schema cutover: refuses to discard any existing shared subsidiary data. */
export const subsidiariesDomainMigration = {
    name: "202610120013_subsidiaries_domain",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        await assertEmptySharedSubsidiaries(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_subsidiary (
            id_subsidiary BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la subsidiaria para relaciones del CRM.',
            public_id_subsidiary CHAR(26) NOT NULL COMMENT 'ULID publico y estable de la subsidiaria.',
            native_code_subsidiary VARCHAR(140) NOT NULL COMMENT 'Codigo nativo unico de la subsidiaria.',
            id_old_produccion_subsidiary INT NULL COMMENT 'Vinculo opcional a la fila legacy para evitar duplicados.',
            name_subsidiary VARCHAR(250) NOT NULL COMMENT 'Nombre visible de la subsidiaria; compatible con legacy.',
            detail_subsidiary VARCHAR(500) NULL COMMENT 'Descripcion opcional de la subsidiaria.',
            status_subsidiary ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Estado operativo de la subsidiaria.',
            created_at_subsidiary DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha de creacion nativa.',
            created_by_user_id_subsidiary BIGINT UNSIGNED NULL COMMENT 'Usuario que creo la subsidiaria.',
            updated_at_subsidiary DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha del ultimo cambio.',
            updated_by_user_id_subsidiary BIGINT UNSIGNED NULL COMMENT 'Usuario responsable del ultimo cambio.',
            inactivated_at_subsidiary DATETIME(3) NULL COMMENT 'Fecha de inactivacion si corresponde.',
            inactivated_by_user_id_subsidiary BIGINT UNSIGNED NULL COMMENT 'Usuario que inactivo la subsidiaria.',
            deleted_at_subsidiary DATETIME(3) NULL COMMENT 'Reserva de compatibilidad; no existe operacion de borrado.',
            deleted_by_user_id_subsidiary BIGINT UNSIGNED NULL COMMENT 'Reserva de compatibilidad; no se permite borrar subsidiarias.',
            PRIMARY KEY (id_subsidiary),
            UNIQUE KEY uq_crm_subsidiary_public_id (public_id_subsidiary),
            UNIQUE KEY uq_crm_subsidiary_native (native_code_subsidiary),
            UNIQUE KEY uq_crm_subsidiary_legacy (id_old_produccion_subsidiary),
            KEY idx_crm_subsidiary_status (status_subsidiary,deleted_at_subsidiary),
            CONSTRAINT fk_crm_subsidiary_created_by FOREIGN KEY (created_by_user_id_subsidiary) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_subsidiary_updated_by FOREIGN KEY (updated_by_user_id_subsidiary) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_subsidiary_inactivated_by FOREIGN KEY (inactivated_by_user_id_subsidiary) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_subsidiary_deleted_by FOREIGN KEY (deleted_by_user_id_subsidiary) REFERENCES sec_user(id_user)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_subsidiary_external_reference (
            id_subsidiary_external_reference BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la referencia externa.',
            subsidiary_id_subsidiary_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Subsidiaria nativa propietaria de la referencia.',
            external_system_id_subsidiary_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Proveedor externo registrado.',
            external_id_subsidiary_external_reference VARCHAR(180) NOT NULL COMMENT 'Identificador de la subsidiaria en el proveedor.',
            status_subsidiary_external_reference ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Estado de la relacion externa.',
            metadata_subsidiary_external_reference JSON NULL COMMENT 'Metadatos opcionales de la relacion.',
            created_at_subsidiary_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha de creacion de la referencia.',
            updated_at_subsidiary_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha del ultimo cambio de referencia.',
            deleted_at_subsidiary_external_reference DATETIME(3) NULL COMMENT 'Fecha de archivo; conserva la titularidad del identificador.',
            PRIMARY KEY (id_subsidiary_external_reference),
            UNIQUE KEY uq_crm_subsidiary_external_reference (external_system_id_subsidiary_external_reference,external_id_subsidiary_external_reference),
            KEY idx_crm_subsidiary_external_reference_subsidiary (subsidiary_id_subsidiary_external_reference,deleted_at_subsidiary_external_reference),
            CONSTRAINT fk_crm_subsidiary_external_reference_subsidiary FOREIGN KEY (subsidiary_id_subsidiary_external_reference) REFERENCES crm_subsidiary(id_subsidiary),
            CONSTRAINT fk_crm_subsidiary_external_reference_system FOREIGN KEY (external_system_id_subsidiary_external_reference) REFERENCES int_external_system(id_external_system)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        // Shared tables remain only for the two domains not yet split into independent tables.
        for (const constraint of [
            { table: "crm_catalog_item", name: "chk_catalog_item_not_subsidiaries", column: "catalog_code_catalog_item" },
            { table: "crm_catalog_item_external_reference", name: "chk_catalog_reference_not_subsidiaries", column: "catalog_code_catalog_item_external_reference" },
        ]) {
            const existing = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=${constraint.table} AND CONSTRAINT_NAME=${constraint.name}`.execute(db);
            if (Number(existing.rows[0]?.total) === 0) await sql`ALTER TABLE ${sql.table(constraint.table)} ADD CONSTRAINT ${sql.id(constraint.name)} CHECK (${sql.ref(constraint.column)} <> 'subsidiaries')`.execute(db);
        }
    },
};
