import { type Kysely, sql } from "kysely";

/**
 * Alinea permisos base al modelo operativo final:
 * - Organizacion no se expone como modulo de seguridad.
 * - Jefe General no hereda administracion; solo modulos operativos.
 */
export const identityRoleSecurityModelMigration = {
    name: "202610010006_identity_role_security_model",
    async up(db: Kysely<unknown>): Promise<void> {
        await sql`
            UPDATE sec_permission
            SET status_permission = 'inactive'
            WHERE code_permission = 'org.manage'
        `.execute(db);

        await sql`
            UPDATE sec_role_permission rp
            INNER JOIN sec_role r
                ON r.id_role = rp.role_id_role_permission
            INNER JOIN sec_permission p
                ON p.id_permission = rp.permission_id_role_permission
            SET rp.status_role_permission = 'inactive'
            WHERE rp.status_role_permission = 'active'
              AND (
                  p.code_permission = 'org.manage'
                  OR (
                      r.code_role = 'jefe_general'
                      AND p.module_code_permission IN ('user', 'role', 'org')
                  )
              )
        `.execute(db);

        await sql`
            UPDATE sec_user u
            SET u.permission_version_user = u.permission_version_user + 1,
                u.updated_at_user = CURRENT_TIMESTAMP(3)
            WHERE EXISTS (
                SELECT 1
                FROM sec_user_role ur
                INNER JOIN sec_role r
                    ON r.id_role = ur.role_id_user_role
                WHERE ur.user_id_user_role = u.id_user
                  AND ur.status_user_role = 'active'
                  AND ur.revoked_at_user_role IS NULL
                  AND r.code_role IN ('owner', 'jefe_general')
            )
        `.execute(db);
    },
};
