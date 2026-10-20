import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const permissionCode = "formalizacion.home.approvals.read";
const previousCode = "formalizacion.home.read";
const description = "Permite ver el banner de pendientes de aprobacion de Formalizacion; no permite aprobar ni devolver ordenes.";

type PermissionRow = { code: string; module: string; action: string; status: string };

/** A retired or differently scoped permission must not be silently repurposed. */
function assertBannerPermission(current: PermissionRow | undefined): void {
    if (current && (current.module !== "formalizacion" || current.action !== "read" || current.status !== "active")) throw new Error("Formalization banner permission conflicts with existing configuration");
}

/** Retire the page gate without transferring its grants to the new, independently assignable banner. */
export const formalizationHomeBannerMigration = {
    name: "202610200020_formalization_home_banner",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (transaction) => {
            const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(transaction);
            if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Formalization banner requires CRM_THINK_V2");
            const permissions = await sql<PermissionRow>`SELECT code_permission AS code, module_code_permission AS module, action_code_permission AS action, status_permission AS status
                FROM sec_permission WHERE code_permission IN (${permissionCode}, ${previousCode}) FOR UPDATE`.execute(transaction);
            const current = permissions.rows.find((permission) => permission.code === permissionCode);
            const previous = permissions.rows.find((permission) => permission.code === previousCode);
            assertBannerPermission(current);
            if (current && previous?.status !== "active") return;
            const actors = await sql<{ id: number; publicId: string; name: string }>`SELECT u.id_user AS id, u.public_id_user AS publicId, u.display_name_user AS name
                FROM sec_user u INNER JOIN sec_user_role ur ON ur.user_id_user_role = u.id_user INNER JOIN sec_role r ON r.id_role = ur.role_id_user_role
                WHERE r.code_role = 'owner' AND r.status_role = 'active' AND r.deleted_at_role IS NULL
                AND ur.status_user_role = 'active' AND ur.revoked_at_user_role IS NULL AND u.status_user = 'active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1`.execute(transaction);
            const actor = actors.rows[0];
            if (!actor) throw new Error("Formalization banner requires an active Owner for audit attribution");
            if (!current)
                await sql`INSERT INTO sec_permission (code_permission, module_code_permission, action_code_permission, description_permission, status_permission)
                    VALUES (${permissionCode}, 'formalizacion', 'read', ${description}, 'active')`.execute(transaction);
            // Keep historical grants/overrides, but the inactive permission no longer resolves as effective access.
            await sql`UPDATE sec_permission SET status_permission = 'inactive' WHERE code_permission = ${previousCode} AND status_permission = 'active'`.execute(transaction);
            await sql`INSERT INTO audit_security_event (public_id_security_event, event_type_security_event, actor_user_id_security_event, summary_security_event, reason_security_event, metadata_security_event)
                VALUES (${ulid()}, 'formalization_home_access_updated', ${actor.id}, 'Inicio disponible por modulo; permiso independiente para ver pendientes de aprobacion.', 'Separacion de acceso a Inicio y visibilidad del banner autorizada por el propietario.',
                ${JSON.stringify({ migration: formalizationHomeBannerMigration.name, moduleCode: "administration", sectionCode: "roles", actor: { publicId: actor.publicId, name: actor.name }, changeSet: { version: 1, entity: "permission", recordId: permissionCode, action: "update", before: { permissions: permissions.rows }, after: { retiredPermissionCode: previousCode, activePermissionCode: permissionCode, grantsTransferred: false, homeAccess: "active_module_membership" } } })})`.execute(
                transaction,
            );
        });
    },
};
