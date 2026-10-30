import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

/** Revoke only the two business-role catalog grants; keep Owner, other roles and user overrides intact. */
export const formalizationCatalogAccessMigration = {
    name: "202610280050_formalization_catalog_access",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx);
            if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Catalog grant revocation requires CRM_THINK_V2");
            const roles = (await sql<{ id: number; code: string }>`SELECT id_role AS id,code_role AS code FROM sec_role WHERE code_role IN ('formalizacion','jefe_formalizaciones') AND deleted_at_role IS NULL FOR UPDATE`.execute(tx)).rows;
            if (roles.length !== 2) throw new Error("Both Formalization roles are required");
            const grants = (
                await sql<{
                    id: number;
                    role: string;
                    code: string;
                }>`SELECT rp.id_role_permission AS id,r.code_role AS role,p.code_permission AS code FROM sec_role_permission rp JOIN sec_role r ON r.id_role=rp.role_id_role_permission JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE rp.role_id_role_permission IN (${sql.join(roles.map((role) => role.id))}) AND p.module_code_permission='formalizacion' AND LEFT(p.code_permission,22)='formalizacion.catalog_' AND rp.status_role_permission='active' FOR UPDATE`.execute(
                    tx,
                )
            ).rows;
            if (!grants.length) return;
            const actor = (await sql<{ id: number }>`SELECT u.id_user AS id FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL AND r.deleted_at_role IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)).rows[0];
            if (!actor) throw new Error("Owner audit attribution required");
            await sql`UPDATE sec_role_permission SET status_role_permission='inactive' WHERE id_role_permission IN (${sql.join(grants.map((grant) => grant.id))}) AND status_role_permission='active'`.execute(tx);
            // Inherited role snapshots also need invalidation; no roles or sessions are removed.
            await sql`UPDATE sec_user SET permission_version_user=permission_version_user+1 WHERE status_user='active' AND deleted_at_user IS NULL`.execute(tx);
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'role_permissions_replaced',${actor.id},'Acceso a Catálogos retirado de los roles de Formalización.','Retiro solicitado por el propietario; Owner y asignaciones independientes se conservan.',${JSON.stringify({ migration: formalizationCatalogAccessMigration.name, moduleCode: "administration", sectionCode: "roles", changeSet: { version: 1, entity: "role", recordId: "formalization-catalogs", action: "update", before: { grants }, after: { grants: [] } } })})`.execute(
                tx,
            );
        });
    },
};
