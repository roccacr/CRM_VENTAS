import { type Kysely, sql } from "kysely";

/** The new schema must never silently discard data from the previous storage model. */
const assertEmptySharedCampaigns = async <DB>(db: Kysely<DB>): Promise<void> => {
    const identity = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
    if (identity.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Campaigns migration requires CRM_THINK_V2");
    const items = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_catalog_item WHERE catalog_code_catalog_item='campaigns'`.execute(db);
    const references = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_catalog_item_external_reference WHERE catalog_code_catalog_item_external_reference='campaigns'`.execute(db);
    if (Number(items.rows[0]?.total) !== 0 || Number(references.rows[0]?.total) !== 0) throw new Error("Shared campaign data must be explicitly migrated before this empty-schema cutover");
};

/** Empty-schema cutover: refuses to discard any existing shared campaign data. */
export const campaignsDomainMigration = {
    name: "202610120010_campaigns_domain",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        await assertEmptySharedCampaigns(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_campaign (
            id_campaign BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la campana para relaciones del CRM.',
            public_id_campaign CHAR(26) NOT NULL COMMENT 'ULID publico y estable de la campana.',
            native_code_campaign VARCHAR(140) NOT NULL COMMENT 'Codigo nativo unico de la campana.',
            id_old_produccion_campaign INT NULL COMMENT 'Vinculo opcional a la fila legacy para evitar duplicados.',
            name_campaign VARCHAR(180) NOT NULL COMMENT 'Nombre visible de la campana.',
            detail_campaign VARCHAR(500) NULL COMMENT 'Descripcion opcional de la campana.',
            status_campaign ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Estado operativo de la campana.',
            created_at_campaign DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha de creacion nativa.',
            created_by_user_id_campaign BIGINT UNSIGNED NULL COMMENT 'Usuario que creo la campana.',
            updated_at_campaign DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha del ultimo cambio.',
            updated_by_user_id_campaign BIGINT UNSIGNED NULL COMMENT 'Usuario responsable del ultimo cambio.',
            inactivated_at_campaign DATETIME(3) NULL COMMENT 'Fecha de inactivacion si corresponde.',
            inactivated_by_user_id_campaign BIGINT UNSIGNED NULL COMMENT 'Usuario que inactivo la campana.',
            deleted_at_campaign DATETIME(3) NULL COMMENT 'Reserva de compatibilidad; no existe operacion de borrado.',
            deleted_by_user_id_campaign BIGINT UNSIGNED NULL COMMENT 'Reserva de compatibilidad; no se permite borrar campanas.',
            PRIMARY KEY (id_campaign),
            UNIQUE KEY uq_crm_campaign_public_id (public_id_campaign),
            UNIQUE KEY uq_crm_campaign_native (native_code_campaign),
            UNIQUE KEY uq_crm_campaign_legacy (id_old_produccion_campaign),
            KEY idx_crm_campaign_status (status_campaign,deleted_at_campaign),
            CONSTRAINT fk_crm_campaign_created_by FOREIGN KEY (created_by_user_id_campaign) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_campaign_updated_by FOREIGN KEY (updated_by_user_id_campaign) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_campaign_inactivated_by FOREIGN KEY (inactivated_by_user_id_campaign) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_campaign_deleted_by FOREIGN KEY (deleted_by_user_id_campaign) REFERENCES sec_user(id_user)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_campaign_external_reference (
            id_campaign_external_reference BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la referencia externa.',
            campaign_id_campaign_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Campana nativa propietaria de la referencia.',
            external_system_id_campaign_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Proveedor externo registrado.',
            external_id_campaign_external_reference VARCHAR(180) NOT NULL COMMENT 'Identificador de la campana en el proveedor.',
            status_campaign_external_reference ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Estado de la relacion externa.',
            metadata_campaign_external_reference JSON NULL COMMENT 'Metadatos opcionales de la relacion.',
            created_at_campaign_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha de creacion de la referencia.',
            updated_at_campaign_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha del ultimo cambio de referencia.',
            deleted_at_campaign_external_reference DATETIME(3) NULL COMMENT 'Fecha de archivo; conserva la titularidad del identificador.',
            PRIMARY KEY (id_campaign_external_reference),
            UNIQUE KEY uq_crm_campaign_external_reference (external_system_id_campaign_external_reference,external_id_campaign_external_reference),
            KEY idx_crm_campaign_external_reference_campaign (campaign_id_campaign_external_reference,deleted_at_campaign_external_reference),
            CONSTRAINT fk_crm_campaign_external_reference_campaign FOREIGN KEY (campaign_id_campaign_external_reference) REFERENCES crm_campaign(id_campaign),
            CONSTRAINT fk_crm_campaign_external_reference_system FOREIGN KEY (external_system_id_campaign_external_reference) REFERENCES int_external_system(id_external_system)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        // Shared tables remain only for the five domains not yet split into independent tables.
        for (const constraint of [
            { table: "crm_catalog_item", name: "chk_catalog_item_not_campaigns", column: "catalog_code_catalog_item" },
            { table: "crm_catalog_item_external_reference", name: "chk_catalog_reference_not_campaigns", column: "catalog_code_catalog_item_external_reference" },
        ]) {
            const existing = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=${constraint.table} AND CONSTRAINT_NAME=${constraint.name}`.execute(db);
            if (Number(existing.rows[0]?.total) === 0) await sql`ALTER TABLE ${sql.table(constraint.table)} ADD CONSTRAINT ${sql.id(constraint.name)} CHECK (${sql.ref(constraint.column)} <> 'campaigns')`.execute(db);
        }
    },
};
