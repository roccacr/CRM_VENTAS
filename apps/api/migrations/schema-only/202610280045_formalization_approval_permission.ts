import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const roleCode = "jefe_formalizaciones";
const permission = {
    code: "formalizacion.orders.approve",
    module: "formalizacion",
    action: "approve",
    description: "Permite marcar únicamente la aprobación de Formalización después de la confirmación de NetSuite; no modifica las demás aprobaciones ni omite otras validaciones.",
    status: "active",
} as const;
const requiredTables = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"] as const;

/** Fail closed unless every security write targets a native transactional table. */
async function assertNativeTables(tx: Kysely<unknown>): Promise<void> {
    const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx);
    if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Formalization approval permission requires CRM_THINK_V2");
    const tables = await sql<{ table_name: string; table_type: string; engine: string }>`SELECT TABLE_NAME AS table_name,TABLE_TYPE AS table_type,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(requiredTables)})`.execute(tx);
    if (tables.rows.length !== requiredTables.length || !requiredTables.every((name) => tables.rows.some((table) => table.table_name === name && table.table_type === "BASE TABLE" && table.engine === "InnoDB"))) throw new Error("Formalization approval permission requires native InnoDB security tables");
}

/** Never create or reactivate a retired supervisor role. */
async function readActiveSupervisor(tx: Kysely<unknown>): Promise<{ id: number }> {
    const roles = await sql<{ id: number; status: string; deleted: Date | null }>`SELECT id_role AS id,status_role AS status,deleted_at_role AS deleted FROM sec_role WHERE code_role=${roleCode} FOR UPDATE`.execute(tx);
    const role = roles.rows[0];
    if (roles.rows.length !== 1 || !role || role.status !== "active" || role.deleted) throw new Error("Formalization approval permission requires active jefe_formalizaciones role");
    return role;
}

/** Preserve independently managed definitions, including revoked permissions. */
async function readPermission(tx: Kysely<unknown>): Promise<boolean> {
    const existing = await sql<Record<string, unknown>>`SELECT code_permission AS code,module_code_permission AS module,action_code_permission AS action,description_permission AS description,status_permission AS status FROM sec_permission WHERE code_permission=${permission.code} FOR UPDATE`.execute(tx);
    if (existing.rows.length && (existing.rows.length !== 1 || !Object.entries(permission).every(([key, value]) => existing.rows[0]?.[key] === value))) throw new Error("Formalization approval permission conflicts with existing configuration; reconciliation required");
    return existing.rows.length === 1;
}

/** Independent approval permission; only the active supervisor role receives a default grant.
 * Individual denies, other grants and Owner's existing policy remain untouched.
 */
export const formalizationApprovalPermissionMigration = {
    name: "202610280045_formalization_approval_permission",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            await assertNativeTables(tx);
            const role = await readActiveSupervisor(tx);
            const permissionExists = await readPermission(tx);
            const grants = await sql<{ code: string; status: string }>`SELECT p.code_permission AS code,rp.status_role_permission AS status FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE rp.role_id_role_permission=${role.id} FOR UPDATE`.execute(tx);
            const matchingGrants = grants.rows.filter((grant) => grant.code === permission.code);
            if (matchingGrants.length > 1 || matchingGrants.some((grant) => grant.status !== "active")) throw new Error("Revoked or conflicting role grant requires explicit reconciliation");
            if (matchingGrants.length === 1) return;
            const actor = (
                await sql<{
                    id: number;
                    publicId: string;
                    name: string;
                }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)
            ).rows[0];
            if (!actor) throw new Error("Formalization approval permission requires Owner migration attribution");
            if (!permissionExists) await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${permission.code},${permission.module},${permission.action},${permission.description},${permission.status})`.execute(tx);
            await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) SELECT ${role.id},id_permission,'active' FROM sec_permission WHERE code_permission=${permission.code}`.execute(tx);
            await sql`UPDATE sec_user u SET permission_version_user=permission_version_user+1 WHERE EXISTS (SELECT 1 FROM sec_user_role ur WHERE ur.user_id_user_role=u.id_user AND ur.role_id_user_role=${role.id} AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL)`.execute(tx);
            const before = grants.rows
                .filter((grant) => grant.status === "active")
                .map((grant) => grant.code)
                .sort();
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'role_permissions_replaced',${actor.id},'Permiso Aprobar Formalización habilitado para Jefe de Formalizaciones.','Asignación independiente autorizada por el propietario; denegaciones individuales intactas.',${JSON.stringify({ migration: formalizationApprovalPermissionMigration.name, moduleCode: "administration", sectionCode: "roles", roleCode, actor: { publicId: actor.publicId, name: actor.name }, changeSet: { version: 1, entity: "role", recordId: roleCode, action: "update", before: { permissionCodes: before }, after: { permissionCodes: [...new Set([...before, permission.code])].sort() } } })})`.execute(
                tx,
            );
        });
    },
};
