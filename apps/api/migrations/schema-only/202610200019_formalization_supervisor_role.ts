import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const roleCode = "jefe_formalizaciones";
const roleName = "Jefe de Formalizaciones";
const description = "Rol complementario de supervision. Sin permisos iniciales; requiere Formalizacion para acceso operativo.";

/** Create only the approved role; never grant permissions, assign users or reactivate revoked access. */
export const formalizationSupervisorRoleMigration = {
    name: "202610200019_formalization_supervisor_role",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (transaction) => {
            const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(transaction);
            if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Supervisor role requires CRM_THINK_V2");
            const roles = await sql<{ status: string; deleted: Date | null }>`SELECT status_role AS status, deleted_at_role AS deleted FROM sec_role WHERE code_role = ${roleCode} FOR UPDATE`.execute(transaction);
            if (roles.rows[0]) {
                if (roles.rows[0].status !== "active" || roles.rows[0].deleted) throw new Error("Supervisor role is inactive; explicit reconciliation required");
                return;
            }
            const actors = await sql<{ id: number; publicId: string; name: string }>`SELECT u.id_user AS id, u.public_id_user AS publicId, u.display_name_user AS name
                FROM sec_user u INNER JOIN sec_user_role ur ON ur.user_id_user_role = u.id_user INNER JOIN sec_role r ON r.id_role = ur.role_id_user_role
                WHERE r.code_role = 'owner' AND r.status_role = 'active' AND r.deleted_at_role IS NULL
                AND ur.status_user_role = 'active' AND ur.revoked_at_user_role IS NULL AND u.status_user = 'active' AND u.deleted_at_user IS NULL
                ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(transaction);
            const actor = actors.rows[0];
            if (!actor) throw new Error("Supervisor role requires an active Owner for audit attribution");
            await sql`INSERT INTO sec_role (code_role, name_role, description_role, status_role) VALUES (${roleCode}, ${roleName}, ${description}, 'active')`.execute(transaction);
            await sql`INSERT INTO audit_security_event (public_id_security_event, event_type_security_event, actor_user_id_security_event, summary_security_event, reason_security_event, metadata_security_event)
                VALUES (${ulid()}, 'role_permissions_replaced', ${actor.id}, 'Rol Jefe de Formalizaciones creado sin permisos ni usuarios.', 'Creacion del rol complementario autorizada por el propietario.',
                ${JSON.stringify({ migration: formalizationSupervisorRoleMigration.name, moduleCode: "administration", sectionCode: "roles", roleCode, actor: { publicId: actor.publicId, name: actor.name, roles: [{ code: "owner", name: "Owner" }] }, changeSet: { version: 1, entity: "role", recordId: roleCode, action: "create", before: null, after: { name: roleName, description, status: "active", permissionCodes: [] } } })})`.execute(transaction);
        });
    },
};
