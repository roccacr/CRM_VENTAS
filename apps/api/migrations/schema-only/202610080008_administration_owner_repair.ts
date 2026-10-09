import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

// Frozen migration snapshot: future catalog changes must not alter this repair.
const catalogs = ["catalog_project", "catalog_campaign", "catalog_class", "catalog_broker", "catalog_file", "catalog_subsidiary", "catalog_location"] as const;
const contexts = ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"] as const;
const actions = ["read", "create", "update", "inactivate"] as const;
const catalogLabels = {
    catalog_project: ["proyecto", "proyectos"],
    catalog_campaign: ["campa\u00f1a", "campa\u00f1as"],
    catalog_class: ["clase", "clases"],
    catalog_broker: ["corredor", "corredores"],
    catalog_file: ["expediente", "expedientes"],
    catalog_subsidiary: ["subsidiaria", "subsidiarias"],
    catalog_location: ["ubicaci\u00f3n", "ubicaciones"],
} as const;
const actionLabels = { read: "Ver", create: "Crear", update: "Editar", inactivate: "Inactivar" } as const;
const permissionCodes = catalogs.flatMap((catalog) => contexts.flatMap((context) => actions.map((action) => `${context}.${catalog}.${action}`)));

export const administrationOwnerRepairMigration = {
    name: "202610080008_administration_owner_repair",
    async up(db: Kysely<unknown>): Promise<void> {
        // DML only: grants, session revocation, and audit commit atomically.
        await db.transaction().execute(async (transaction) => {
            const parents = await sql<{ id: number }>`SELECT id_org_unit AS id FROM sec_org_unit WHERE code_org_unit = 'empresa' AND status_org_unit = 'active' AND deleted_at_org_unit IS NULL FOR UPDATE`.execute(transaction);
            const roles = await sql<{ id: number }>`SELECT id_role AS id FROM sec_role WHERE code_role = 'owner' AND status_role = 'active' AND deleted_at_role IS NULL FOR UPDATE`.execute(transaction);
            const parent = parents.rows[0];
            const role = roles.rows[0];
            if (!parent || !role) throw new Error("Administration repair requires an active empresa module and Owner role");
            const existing = await sql<{ id: number }>`SELECT id_org_unit AS id FROM sec_org_unit WHERE code_org_unit = 'administration' FOR UPDATE`.execute(transaction);
            if (existing.rows.length === 0) {
                // Never upsert by public ID: the historical ID belongs to Sistemas.
                await sql`INSERT INTO sec_org_unit (public_id_org_unit, parent_org_unit_id_org_unit, code_org_unit, name_org_unit, status_org_unit, sort_order_org_unit)
                    VALUES (${ulid()}, ${parent.id}, 'administration', 'Administracion', 'active', 60)`.execute(transaction);
            } else {
                await sql`UPDATE sec_org_unit SET parent_org_unit_id_org_unit = ${parent.id}, status_org_unit = 'active', deleted_at_org_unit = NULL WHERE id_org_unit = ${existing.rows[0]?.id}`.execute(transaction);
            }
            const permissionRows = catalogs.flatMap((catalog) => contexts.flatMap((context) => actions.map((action) => sql`(${`${context}.${catalog}.${action}`}, ${context}, ${action}, ${`${actionLabels[action]} ${catalogLabels[catalog][action === "read" ? 1 : 0]}.`}, 'active')`)));
            await sql`INSERT INTO sec_permission (code_permission, module_code_permission, action_code_permission, description_permission, status_permission)
                VALUES ${sql.join(permissionRows)}
                ON DUPLICATE KEY UPDATE module_code_permission = VALUES(module_code_permission), action_code_permission = VALUES(action_code_permission), status_permission = 'active'`.execute(transaction);
            await sql`INSERT INTO sec_role_permission (role_id_role_permission, permission_id_role_permission, status_role_permission)
                SELECT ${role.id}, id_permission, 'active' FROM sec_permission WHERE code_permission IN (${sql.join(permissionCodes)})
                ON DUPLICATE KEY UPDATE status_role_permission = 'active'`.execute(transaction);
            const owners = await sql<{ id: number }>`SELECT DISTINCT u.id_user AS id FROM sec_user u
                INNER JOIN sec_user_role ur ON ur.user_id_user_role = u.id_user
                WHERE ur.role_id_user_role = ${role.id} AND ur.status_user_role = 'active' AND ur.revoked_at_user_role IS NULL
                AND u.status_user = 'active' AND u.deleted_at_user IS NULL FOR UPDATE`.execute(transaction);
            for (const owner of owners.rows) {
                await sql`INSERT INTO sec_user_org_unit (user_id_user_org_unit, org_unit_id_user_org_unit, membership_code_user_org_unit, scope_code_user_org_unit, status_user_org_unit)
                    SELECT ${owner.id}, id_org_unit, 'leader', 'all_areas', 'active' FROM sec_org_unit WHERE code_org_unit = 'administration'
                    ON DUPLICATE KEY UPDATE revoked_at_user_org_unit = NULL, revoked_by_user_id_user_org_unit = NULL`.execute(transaction);
                await sql`UPDATE sec_user SET permission_version_user = permission_version_user + 1 WHERE id_user = ${owner.id}`.execute(transaction);
                await sql`UPDATE sec_refresh_token rt INNER JOIN sec_auth_session s ON s.id_auth_session = rt.auth_session_id_refresh_token
                    SET rt.status_refresh_token = 'revoked', rt.revoked_at_refresh_token = CURRENT_TIMESTAMP(3), rt.revoked_reason_refresh_token = 'administration_owner_repair'
                    WHERE s.user_id_auth_session = ${owner.id} AND rt.status_refresh_token = 'active'`.execute(transaction);
                await sql`UPDATE sec_auth_session SET status_auth_session = 'revoked', revoked_at_auth_session = CURRENT_TIMESTAMP(3)
                    WHERE user_id_auth_session = ${owner.id} AND status_auth_session = 'active'`.execute(transaction);
                await sql`INSERT INTO audit_security_event (public_id_security_event, event_type_security_event, target_user_id_security_event, summary_security_event, reason_security_event, metadata_security_event)
                    VALUES (${ulid()}, 'administration_owner_repaired', ${owner.id}, 'Administration membership and catalog grants repaired; sessions revoked', 'administration_owner_repair', ${JSON.stringify({ migration: administrationOwnerRepairMigration.name, catalogPermissionCount: permissionCodes.length })})`.execute(transaction);
            }
        });
    },
};
