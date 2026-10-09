import { type Kysely, sql } from "kysely";

import { CATALOG_CONTEXT_MODULES, CATALOG_DEFINITIONS, CATALOG_PERMISSION_ACTIONS, getCatalogPermissionCode, getCatalogPermissionCodes, getCatalogPermissionDescription, getLegacyCatalogPermissionCodes } from "../../src/modules/crm/catalogs/catalogs.constants.js";

export const crmCatalogsMigration = {
    name: "202610030007_crm_catalogs",
    async up(db: Kysely<unknown>): Promise<void> {
        await sql`
            CREATE TABLE IF NOT EXISTS crm_catalog_item (
                id_catalog_item BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                public_id_catalog_item CHAR(26) NOT NULL,
                catalog_code_catalog_item VARCHAR(80) NOT NULL,
                native_code_catalog_item VARCHAR(140) NOT NULL,
                name_catalog_item VARCHAR(180) NOT NULL,
                detail_catalog_item VARCHAR(500) NULL,
                status_catalog_item ENUM('active','inactive') NOT NULL DEFAULT 'active',
                created_at_catalog_item DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                created_by_user_id_catalog_item BIGINT UNSIGNED NULL,
                updated_at_catalog_item DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
                updated_by_user_id_catalog_item BIGINT UNSIGNED NULL,
                inactivated_at_catalog_item DATETIME(3) NULL,
                inactivated_by_user_id_catalog_item BIGINT UNSIGNED NULL,
                deleted_at_catalog_item DATETIME(3) NULL,
                deleted_by_user_id_catalog_item BIGINT UNSIGNED NULL,
                PRIMARY KEY (id_catalog_item),
                UNIQUE KEY uq_crm_catalog_item_public_id (public_id_catalog_item),
                UNIQUE KEY uq_crm_catalog_item_native (catalog_code_catalog_item, native_code_catalog_item),
                KEY idx_crm_catalog_item_catalog_status (catalog_code_catalog_item, status_catalog_item, deleted_at_catalog_item),
                CONSTRAINT fk_crm_catalog_item_created_by FOREIGN KEY (created_by_user_id_catalog_item) REFERENCES sec_user (id_user),
                CONSTRAINT fk_crm_catalog_item_updated_by FOREIGN KEY (updated_by_user_id_catalog_item) REFERENCES sec_user (id_user),
                CONSTRAINT fk_crm_catalog_item_inactivated_by FOREIGN KEY (inactivated_by_user_id_catalog_item) REFERENCES sec_user (id_user),
                CONSTRAINT fk_crm_catalog_item_deleted_by FOREIGN KEY (deleted_by_user_id_catalog_item) REFERENCES sec_user (id_user)
            )
        `.execute(db);

        await sql`
            CREATE TABLE IF NOT EXISTS crm_catalog_item_external_reference (
                id_catalog_item_external_reference BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                catalog_item_id_catalog_item_external_reference BIGINT UNSIGNED NOT NULL,
                catalog_code_catalog_item_external_reference VARCHAR(80) NOT NULL,
                external_system_id_catalog_item_external_reference BIGINT UNSIGNED NOT NULL,
                external_id_catalog_item_external_reference VARCHAR(180) NOT NULL,
                status_catalog_item_external_reference ENUM('active','inactive') NOT NULL DEFAULT 'active',
                metadata_catalog_item_external_reference JSON NULL,
                created_at_catalog_item_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                updated_at_catalog_item_external_reference DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
                deleted_at_catalog_item_external_reference DATETIME(3) NULL,
                PRIMARY KEY (id_catalog_item_external_reference),
                UNIQUE KEY uq_crm_catalog_item_external_reference (catalog_code_catalog_item_external_reference, external_system_id_catalog_item_external_reference, external_id_catalog_item_external_reference),
                KEY idx_crm_catalog_item_external_reference_item (catalog_item_id_catalog_item_external_reference, deleted_at_catalog_item_external_reference),
                CONSTRAINT fk_crm_catalog_item_external_reference_item FOREIGN KEY (catalog_item_id_catalog_item_external_reference) REFERENCES crm_catalog_item (id_catalog_item),
                CONSTRAINT fk_crm_catalog_item_external_reference_system FOREIGN KEY (external_system_id_catalog_item_external_reference) REFERENCES int_external_system (id_external_system)
            )
        `.execute(db);

        await sql`
            INSERT INTO sec_org_unit (
                public_id_org_unit,
                parent_org_unit_id_org_unit,
                code_org_unit,
                name_org_unit,
                status_org_unit,
                sort_order_org_unit
            )
            SELECT
                '01KCRM00000000000000000006',
                parent.id_org_unit,
                'administration',
                'Administracion',
                'active',
                60
            FROM sec_org_unit AS parent
            WHERE parent.code_org_unit = 'empresa'
            ON DUPLICATE KEY UPDATE
                parent_org_unit_id_org_unit = VALUES(parent_org_unit_id_org_unit),
                name_org_unit = VALUES(name_org_unit),
                status_org_unit = VALUES(status_org_unit),
                sort_order_org_unit = VALUES(sort_order_org_unit)
        `.execute(db);

        for (const definition of CATALOG_DEFINITIONS) {
            for (const contextModuleCode of CATALOG_CONTEXT_MODULES) {
                for (const actionCode of CATALOG_PERMISSION_ACTIONS) {
                    await sql`
                        INSERT INTO sec_permission (
                            code_permission,
                            module_code_permission,
                            action_code_permission,
                            description_permission,
                            status_permission,
                            created_at_permission,
                            updated_at_permission
                        )
                        VALUES (
                            ${getCatalogPermissionCode(contextModuleCode, definition, actionCode)},
                            ${contextModuleCode},
                            ${actionCode},
                            ${getCatalogPermissionDescription(definition, actionCode)},
                            'active',
                            CURRENT_TIMESTAMP(3),
                            CURRENT_TIMESTAMP(3)
                        )
                        ON DUPLICATE KEY UPDATE
                            module_code_permission = VALUES(module_code_permission),
                            action_code_permission = VALUES(action_code_permission),
                            description_permission = VALUES(description_permission),
                            status_permission = 'active',
                            updated_at_permission = CURRENT_TIMESTAMP(3)
                    `.execute(db);
                }
            }
        }

        await sql`
            UPDATE sec_permission
            SET status_permission = 'inactive',
                updated_at_permission = CURRENT_TIMESTAMP(3)
            WHERE code_permission IN (${sql.join(getLegacyCatalogPermissionCodes())})
        `.execute(db);

        await sql`
            INSERT INTO sec_role_permission (
                role_id_role_permission,
                permission_id_role_permission,
                status_role_permission,
                created_at_role_permission
            )
            SELECT
                role.id_role,
                permission.id_permission,
                'active',
                CURRENT_TIMESTAMP(3)
            FROM sec_role role
            INNER JOIN sec_permission permission
                ON permission.code_permission IN (${sql.join(getCatalogPermissionCodes())})
            WHERE role.code_role = 'owner'
            ON DUPLICATE KEY UPDATE
                status_role_permission = 'active'
        `.execute(db);

        await sql`
            INSERT INTO sec_user_org_unit (
                user_id_user_org_unit,
                org_unit_id_user_org_unit,
                membership_code_user_org_unit,
                scope_code_user_org_unit,
                status_user_org_unit,
                assigned_at_user_org_unit
            )
            SELECT
                user_role.user_id_user_role,
                org_unit.id_org_unit,
                'leader',
                'all_areas',
                'active',
                CURRENT_TIMESTAMP(3)
            FROM sec_user_role user_role
            INNER JOIN sec_role role
                ON role.id_role = user_role.role_id_user_role
            INNER JOIN sec_org_unit org_unit
                ON org_unit.code_org_unit = 'administration'
            WHERE role.code_role = 'owner'
              AND user_role.status_user_role = 'active'
              AND user_role.revoked_at_user_role IS NULL
            ON DUPLICATE KEY UPDATE
                status_user_org_unit = 'active',
                revoked_at_user_org_unit = NULL,
                revoked_by_user_id_user_org_unit = NULL
        `.execute(db);

        await sql`
            UPDATE sec_user user
            INNER JOIN sec_user_role user_role
                ON user_role.user_id_user_role = user.id_user
            INNER JOIN sec_role role
                ON role.id_role = user_role.role_id_user_role
            SET user.permission_version_user = user.permission_version_user + 1,
                user.updated_at_user = CURRENT_TIMESTAMP(3)
            WHERE role.code_role = 'owner'
              AND user_role.status_user_role = 'active'
              AND user_role.revoked_at_user_role IS NULL
        `.execute(db);
    },
};
