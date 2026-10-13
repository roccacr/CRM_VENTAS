import { type Kysely, sql } from "kysely";

/** Seed-free native schema; no statement targets the legacy database. */
export const unitFilesDomainMigration = {
    name: "202610120015_unit_files_domain",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const identity = await sql<{ db: string }>`SELECT DATABASE() AS db`.execute(db);
        if (identity.rows[0]?.db !== "CRM_THINK_V2") throw new Error("Unit Files migration requires CRM_THINK_V2");
        await sql`CREATE TABLE IF NOT EXISTS crm_unit_file (
            id_unit_file BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            public_id_unit_file CHAR(26) NOT NULL,
            native_code_unit_file VARCHAR(140) NOT NULL,
            project_id_unit_file BIGINT UNSIGNED NOT NULL,
            id_old_produccion_unit_file INT NULL,
            source_project_reference_unit_file INT NULL,
            code VARCHAR(100) NULL,
            projectNameSnapshot VARCHAR(50) NULL,
            housingType VARCHAR(200) NULL,
            lotArea VARCHAR(100) NULL,
            sourceStatus VARCHAR(250) NULL,
            advertisedSalePrice VARCHAR(250) NULL,
            habitableArea VARCHAR(250) NULL,
            totalArea VARCHAR(250) NULL,
            approximateMaintenanceFee VARCHAR(250) NULL,
            unitPlans TEXT NULL,
            estimatedDelivery TEXT NULL,
            storageArea VARCHAR(250) NULL,
            mezzanineArea VARCHAR(250) NULL,
            balconyArea VARCHAR(250) NULL,
            groundFloorArea VARCHAR(250) NULL,
            upperFloorArea VARCHAR(250) NULL,
            extensionArea VARCHAR(250) NULL,
            terraceArea VARCHAR(250) NULL,
            pricePerSquareMeter VARCHAR(250) NULL,
            thirdLevelBasementArea VARCHAR(250) NULL,
            approximateParkingArea VARCHAR(250) NULL,
            externalGardenArea VARCHAR(250) NULL,
            slopedGardenArea VARCHAR(250) NULL,
            openCommonArea VARCHAR(250) NULL,
            minimumSalePrice VARCHAR(250) NULL,
            modifiedAt VARCHAR(35) NULL,
            cronValue VARCHAR(20) NULL,
            created_at_unit_file DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            updated_at_unit_file DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id_unit_file),
            UNIQUE KEY uq_unit_file_public (public_id_unit_file),
            UNIQUE KEY uq_unit_file_native (native_code_unit_file),
            UNIQUE KEY uq_unit_file_legacy (id_old_produccion_unit_file),
            KEY idx_unit_file_project_seek (project_id_unit_file,id_unit_file),
            KEY idx_unit_file_project_status_seek (project_id_unit_file,sourceStatus,id_unit_file),
            KEY idx_unit_file_project_type_seek (project_id_unit_file,housingType,id_unit_file),
            CONSTRAINT fk_unit_file_project FOREIGN KEY (project_id_unit_file) REFERENCES crm_project(id_project)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_unit_file_external_reference (
            id_unit_file_external_reference BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            unit_file_id BIGINT UNSIGNED NOT NULL,
            external_system_id BIGINT UNSIGNED NOT NULL,
            external_id VARCHAR(180) NOT NULL,
            status ENUM('active','inactive') NOT NULL DEFAULT 'active',
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id_unit_file_external_reference),
            UNIQUE KEY uq_unit_file_provider (external_system_id,external_id),
            KEY idx_unit_file_reference_owner (unit_file_id),
            CONSTRAINT fk_unit_file_reference_owner FOREIGN KEY (unit_file_id) REFERENCES crm_unit_file(id_unit_file),
            CONSTRAINT fk_unit_file_reference_system FOREIGN KEY (external_system_id) REFERENCES int_external_system(id_external_system)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`.execute(db);
    },
};
