import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const permissionCode = "user.assign_password";

/** Frozen permission semantics; never reuse a revoked or differently scoped code. */
async function ensurePasswordPermission(transaction: Kysely<unknown>): Promise<void> {
    const rows = await sql<{ module: string; action: string; status: string }>`SELECT module_code_permission AS module, action_code_permission AS action, status_permission AS status
        FROM sec_permission WHERE code_permission = ${permissionCode} FOR UPDATE`.execute(transaction);
    const current = rows.rows[0];
    if (current && (current.module !== "user" || current.action !== "assign_password" || current.status !== "active")) throw new Error("Initial password permission conflicts with existing configuration");
    if (!current)
        await sql`INSERT INTO sec_permission (code_permission, module_code_permission, action_code_permission, description_permission, status_permission)
        VALUES (${permissionCode}, 'user', 'assign_password', 'Permite asignar una contrasena inicial al crear un usuario con acceso local. Privilegio sensible independiente de crear usuarios.', 'active')`.execute(transaction);
}

export const userAssignPasswordPermissionMigration = {
    name: "202610130018_user_assign_password_permission",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (transaction) => {
            const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(transaction);
            if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Password permission requires CRM_THINK_V2");
            const owners = await sql<{ id: number; name: string; description: string | null }>`SELECT id_role AS id, name_role AS name, description_role AS description FROM sec_role
                WHERE code_role = 'owner' AND status_role = 'active' AND deleted_at_role IS NULL FOR UPDATE`.execute(transaction);
            const owner = owners.rows[0];
            if (!owner) throw new Error("Password permission requires an active Owner role");
            const grants = await sql<{ code: string }>`SELECT p.code_permission AS code FROM sec_role_permission rp INNER JOIN sec_permission p ON p.id_permission = rp.permission_id_role_permission
                WHERE rp.role_id_role_permission = ${owner.id} AND rp.status_role_permission = 'active' ORDER BY p.code_permission FOR UPDATE`.execute(transaction);
            await ensurePasswordPermission(transaction);
            if (grants.rows.some((grant) => grant.code === permissionCode)) return;
            const actors = await sql<{ id: number; publicId: string; name: string }>`SELECT u.id_user AS id, u.public_id_user AS publicId, u.display_name_user AS name FROM sec_user u
                INNER JOIN sec_user_role ur ON ur.user_id_user_role = u.id_user WHERE ur.role_id_user_role = ${owner.id}
                AND ur.status_user_role = 'active' AND ur.revoked_at_user_role IS NULL AND u.status_user = 'active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(transaction);
            const actor = actors.rows[0];
            if (!actor) throw new Error("Password permission requires an active Owner for migration attribution");
            await sql`INSERT INTO sec_role_permission (role_id_role_permission, permission_id_role_permission, status_role_permission)
                SELECT ${owner.id}, id_permission, 'active' FROM sec_permission WHERE code_permission = ${permissionCode}`.execute(transaction);
            await sql`UPDATE sec_user u SET u.permission_version_user = u.permission_version_user + 1
                WHERE EXISTS (SELECT 1 FROM sec_user_role ur WHERE ur.user_id_user_role = u.id_user AND ur.role_id_user_role = ${owner.id}
                    AND ur.status_user_role = 'active' AND ur.revoked_at_user_role IS NULL)`.execute(transaction);
            const actorRoles = await sql<{ code: string; name: string }>`SELECT r.code_role AS code, r.name_role AS name FROM sec_user_role ur INNER JOIN sec_role r ON r.id_role = ur.role_id_user_role
                WHERE ur.user_id_user_role = ${actor.id} AND ur.status_user_role = 'active' AND ur.revoked_at_user_role IS NULL AND r.status_role = 'active' AND r.deleted_at_role IS NULL`.execute(transaction);
            const previousCodes = grants.rows.map((grant) => grant.code);
            await sql`INSERT INTO audit_security_event (public_id_security_event, event_type_security_event, actor_user_id_security_event, summary_security_event, reason_security_event, metadata_security_event)
                VALUES (${ulid()}, 'role_permissions_replaced', ${actor.id}, 'Privilegio de asignacion de contrasena inicial habilitado para Owner.', 'Permiso sensible solicitado por el propietario.',
                    ${JSON.stringify({ migration: userAssignPasswordPermissionMigration.name, moduleCode: "administration", sectionCode: "roles", roleCode: "owner", actor: { publicId: actor.publicId, name: actor.name, roles: actorRoles.rows }, changeSet: { version: 1, entity: "role", recordId: "owner", action: "update", before: { name: owner.name, description: owner.description, permissionCodes: previousCodes }, after: { name: owner.name, description: owner.description, permissionCodes: [...previousCodes, permissionCode].sort() } } })})`.execute(
                transaction,
            );
        });
    },
};
