import { type Kysely, sql } from "kysely";

/** The new schema must never silently discard data from the previous storage model. */
const assertEmptySharedProjects = async <DB>(db: Kysely<DB>): Promise<void> => {
    const identity = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
    if (identity.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Projects migration requires CRM_THINK_V2");
    const items = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_catalog_item WHERE catalog_code_catalog_item='projects'`.execute(db);
    const references = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM crm_catalog_item_external_reference WHERE catalog_code_catalog_item_external_reference='projects'`.execute(db);
    if (Number(items.rows[0]?.total) !== 0 || Number(references.rows[0]?.total) !== 0) throw new Error("Shared project data must be explicitly migrated before this empty-schema cutover");
};

/** Empty-schema cutover: refuses to discard any existing shared project data. */
export const projectsDomainMigration = {
    name: "202610090009_projects_domain",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        await assertEmptySharedProjects(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_project (
            id_project BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            public_id_project CHAR(26) NOT NULL,
            native_code_project VARCHAR(140) NOT NULL,
            id_old_produccion_project INT NULL,
            name_project VARCHAR(180) NOT NULL,
            detail_project VARCHAR(500) NULL,
            status_project ENUM('active','inactive') NOT NULL DEFAULT 'active',
            created_at_project DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            created_by_user_id_project BIGINT UNSIGNED NULL,
            updated_at_project DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
            updated_by_user_id_project BIGINT UNSIGNED NULL,
            inactivated_at_project DATETIME(3) NULL,
            inactivated_by_user_id_project BIGINT UNSIGNED NULL,
            deleted_at_project DATETIME(3) NULL,
            deleted_by_user_id_project BIGINT UNSIGNED NULL,
            PRIMARY KEY (id_project),
            UNIQUE KEY uq_crm_project_public_id (public_id_project),
            UNIQUE KEY uq_crm_project_native (native_code_project),
            UNIQUE KEY uq_crm_project_legacy (id_old_produccion_project),
            KEY idx_crm_project_status (status_project,deleted_at_project),
            CONSTRAINT fk_crm_project_created_by FOREIGN KEY (created_by_user_id_project) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_project_updated_by FOREIGN KEY (updated_by_user_id_project) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_project_inactivated_by FOREIGN KEY (inactivated_by_user_id_project) REFERENCES sec_user(id_user),
            CONSTRAINT fk_crm_project_deleted_by FOREIGN KEY (deleted_by_user_id_project) REFERENCES sec_user(id_user)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_project_external_reference (
            id_project_external_reference BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            project_id_project_external_reference BIGINT UNSIGNED NOT NULL,
            external_system_id_project_external_reference BIGINT UNSIGNED NOT NULL,
            external_id_project_external_reference VARCHAR(180) NOT NULL,
            status_project_external_reference ENUM('active','inactive') NOT NULL DEFAULT 'active',
            metadata_project_external_reference JSON NULL,
            created_at_project_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            updated_at_project_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
            deleted_at_project_external_reference DATETIME(3) NULL,
            PRIMARY KEY (id_project_external_reference),
            UNIQUE KEY uq_crm_project_external_reference (external_system_id_project_external_reference,external_id_project_external_reference),
            KEY idx_crm_project_external_reference_project (project_id_project_external_reference,deleted_at_project_external_reference),
            CONSTRAINT fk_crm_project_external_reference_project FOREIGN KEY (project_id_project_external_reference) REFERENCES crm_project(id_project),
            CONSTRAINT fk_crm_project_external_reference_system FOREIGN KEY (external_system_id_project_external_reference) REFERENCES int_external_system(id_external_system)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        // Shared tables remain only for the six domains not yet split into independent tables.
        for (const constraint of [
            { table: "crm_catalog_item", name: "chk_catalog_item_not_projects", column: "catalog_code_catalog_item" },
            { table: "crm_catalog_item_external_reference", name: "chk_catalog_reference_not_projects", column: "catalog_code_catalog_item_external_reference" },
        ]) {
            const existing = await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=${constraint.table} AND CONSTRAINT_NAME=${constraint.name}`.execute(db);
            if (Number(existing.rows[0]?.total) === 0) await sql`ALTER TABLE ${sql.table(constraint.table)} ADD CONSTRAINT ${sql.id(constraint.name)} CHECK (${sql.ref(constraint.column)} <> 'projects')`.execute(db);
        }
    },
};
