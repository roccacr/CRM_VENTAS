import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

// Frozen security catalog change: no business seeds, legacy access or broad seed replay.
const roleCode = "formalizacion";
const homePermission = "formalizacion.home.read";

/** Preserve an existing module; never silently reactivate an administrative revocation. */
async function ensureModule(transaction: Kysely<unknown>, hasHomeGrant: boolean): Promise<void> {
    const parents = await sql<{ id: number }>`SELECT id_org_unit AS id FROM sec_org_unit WHERE code_org_unit = 'empresa' AND status_org_unit = 'active' AND deleted_at_org_unit IS NULL FOR UPDATE`.execute(transaction);
    if (!parents.rows[0]) throw new Error("Formalization role requires the active empresa module");
    const modules = await sql<{ status: string; deleted: Date | null }>`SELECT status_org_unit AS status, deleted_at_org_unit AS deleted FROM sec_org_unit WHERE code_org_unit = ${roleCode} FOR UPDATE`.execute(transaction);
    if (modules.rows[0] && (modules.rows[0].status !== "active" || modules.rows[0].deleted)) throw new Error("Formalization module is inactive; explicit reconciliation required");
    if (!modules.rows.length) {
        if (hasHomeGrant) throw new Error("Formalization module is missing for an existing Home grant; explicit reconciliation required");
        await sql`INSERT INTO sec_org_unit (public_id_org_unit, parent_org_unit_id_org_unit, code_org_unit, name_org_unit, status_org_unit, sort_order_org_unit)
            VALUES (${ulid()}, ${parents.rows[0].id}, ${roleCode}, 'Formalizaci\u00f3n', 'active', 30)`.execute(transaction);
    }
}

/** Retain the stable role identity and fail on a previously revoked profile. */
async function ensureRole(transaction: Kysely<unknown>) {
    const roles = await sql<{ id: number; name: string; description: string | null; status: string; deleted: Date | null }>`SELECT id_role AS id, name_role AS name, description_role AS description, status_role AS status, deleted_at_role AS deleted FROM sec_role WHERE code_role = ${roleCode} FOR UPDATE`.execute(transaction);
    if (roles.rows[0] && (roles.rows[0].status !== "active" || roles.rows[0].deleted)) throw new Error("Formalization role is inactive; explicit reconciliation required");
    if (!roles.rows.length) {
        await sql`INSERT INTO sec_role (code_role, name_role, description_role, status_role)
            VALUES (${roleCode}, 'Formalizaci\u00f3n', 'Perfil de Formalizaci\u00f3n. Acceso inicial exclusivo a Inicio; secciones operativas pendientes.', 'active')`.execute(transaction);
    }
    const role = (await sql<{ id: number; name: string; description: string | null }>`SELECT id_role AS id, name_role AS name, description_role AS description FROM sec_role WHERE code_role = ${roleCode} FOR UPDATE`.execute(transaction)).rows[0];
    if (!role) throw new Error("Formalization role was not created");
    return { role, existed: roles.rows.length > 0 };
}

/** A permission code must not be repurposed or reactivated by a seed. */
async function ensureHomePermission(transaction: Kysely<unknown>): Promise<void> {
    const permissions = await sql<{ id: number; module: string; action: string; status: string }>`SELECT id_permission AS id, module_code_permission AS module, action_code_permission AS action, status_permission AS status FROM sec_permission WHERE code_permission = ${homePermission} FOR UPDATE`.execute(transaction);
    const existing = permissions.rows[0];
    if (existing && (existing.module !== roleCode || existing.action !== "read" || existing.status !== "active")) throw new Error("Formalization Home permission conflicts with existing configuration");
    if (!existing) {
        await sql`INSERT INTO sec_permission (code_permission, module_code_permission, action_code_permission, description_permission, status_permission)
            VALUES (${homePermission}, ${roleCode}, 'read', 'Permite ver el inicio de Formalizacion sin acceso a secciones operativas.', 'active')`.execute(transaction);
    }
}

export const formalizationHomeRoleMigration = {
    name: "202610130017_formalization_home_role",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (transaction) => {
            const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(transaction);
            if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Formalization role requires CRM_THINK_V2");
            const owners = await sql<{ id: number; publicId: string; name: string }>`SELECT u.id_user AS id, u.public_id_user AS publicId, u.display_name_user AS name
                FROM sec_user u INNER JOIN sec_user_role ur ON ur.user_id_user_role = u.id_user
                INNER JOIN sec_role r ON r.id_role = ur.role_id_user_role
                WHERE r.code_role = 'owner' AND r.status_role = 'active' AND r.deleted_at_role IS NULL
                AND ur.status_user_role = 'active' AND ur.revoked_at_user_role IS NULL
                AND u.status_user = 'active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(transaction);
            const actor = owners.rows[0];
            if (!actor) throw new Error("Formalization role requires an active Owner for audit attribution");
            const { role, existed } = await ensureRole(transaction);
            const grants = await sql<{ code: string }>`SELECT p.code_permission AS code FROM sec_role_permission rp
                INNER JOIN sec_permission p ON p.id_permission = rp.permission_id_role_permission
                WHERE rp.role_id_role_permission = ${role.id} AND rp.status_role_permission = 'active' FOR UPDATE`.execute(transaction);
            if (grants.rows.some((grant) => grant.code !== homePermission)) throw new Error("Formalization has existing non-Home grants; refusing to overwrite access");
            await ensureModule(transaction, grants.rows.length > 0);
            await ensureHomePermission(transaction);
            if (grants.rows.length) return;
            await sql`INSERT INTO sec_role_permission (role_id_role_permission, permission_id_role_permission, status_role_permission)
                SELECT ${role.id}, id_permission, 'active' FROM sec_permission WHERE code_permission = ${homePermission}`.execute(transaction);
            // Existing holders must revalidate; Owner and unrelated profiles are not changed.
            await sql`UPDATE sec_user u SET u.permission_version_user = u.permission_version_user + 1
                WHERE EXISTS (SELECT 1 FROM sec_user_role ur WHERE ur.user_id_user_role = u.id_user AND ur.role_id_user_role = ${role.id}
                    AND ur.status_user_role = 'active' AND ur.revoked_at_user_role IS NULL)`.execute(transaction);
            const actorRoles = await sql<{ code: string; name: string }>`SELECT r.code_role AS code, r.name_role AS name FROM sec_user_role ur INNER JOIN sec_role r ON r.id_role = ur.role_id_user_role
                WHERE ur.user_id_user_role = ${actor.id} AND ur.status_user_role = 'active' AND ur.revoked_at_user_role IS NULL AND r.status_role = 'active' AND r.deleted_at_role IS NULL`.execute(transaction);
            const before = existed ? { name: role.name, description: role.description, status: "active", permissionCodes: [] } : null;
            const after = { name: role.name, description: role.description, status: "active", permissionCodes: [homePermission] };
            await sql`INSERT INTO audit_security_event (public_id_security_event, event_type_security_event, actor_user_id_security_event, summary_security_event, reason_security_event, metadata_security_event)
                VALUES (${ulid()}, 'role_permissions_replaced', ${actor.id}, 'Perfil Formalizacion habilitado exclusivamente para Inicio.', 'Alta de perfil Formalizacion aprobada por el propietario.',
                    ${JSON.stringify({ migration: formalizationHomeRoleMigration.name, moduleCode: "administration", sectionCode: "roles", roleCode, actor: { publicId: actor.publicId, name: actor.name, roles: actorRoles.rows }, changeSet: { version: 1, entity: "role", recordId: roleCode, action: before ? "update" : "create", before, after } })})`.execute(transaction);
        });
    },
};
