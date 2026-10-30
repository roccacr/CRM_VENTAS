import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const roleCodes = ["formalizacion", "owner"] as const;
const permission = {
    code: "formalizacion.orders.read",
    module: "formalizacion",
    action: "read",
    description: "Ver orden de venta",
    status: "active",
} as const;
const requiredTables = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"] as const;

/** Fail closed unless every security write targets a native transactional table. */
async function assertNativeTables(tx: Kysely<unknown>): Promise<void> {
    const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx);
    if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Formalization order read permission requires CRM_THINK_V2");
    const tables = await sql<{ table_name: string; table_type: string; engine: string }>`SELECT TABLE_NAME AS table_name,TABLE_TYPE AS table_type,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(requiredTables)})`.execute(tx);
    if (tables.rows.length !== requiredTables.length || !requiredTables.every((name) => tables.rows.some((table) => table.table_name === name && table.table_type === "BASE TABLE" && table.engine === "InnoDB"))) throw new Error("Formalization order read permission requires native InnoDB security tables");
}

/** Existing active base roles retain their native inheritance policy. */
async function readActiveRoles(tx: Kysely<unknown>): Promise<{ id: number; code: string }[]> {
    const roles = (await sql<{ id: number; code: string; status: string; deleted: Date | null }>`SELECT id_role AS id,code_role AS code,status_role AS status,deleted_at_role AS deleted FROM sec_role WHERE code_role IN (${sql.join(roleCodes)}) FOR UPDATE`.execute(tx)).rows;
    if (roles.length !== roleCodes.length || !roleCodes.every((code) => roles.filter((role) => role.code === code && role.status === "active" && !role.deleted).length === 1)) throw new Error("Formalization order read permission requires active Formalización and Owner base roles");
    return roles;
}

/** Preserve independently managed definitions, including revoked permissions. */
async function readPermission(tx: Kysely<unknown>): Promise<boolean> {
    const existing = await sql<Record<string, unknown>>`SELECT code_permission AS code,module_code_permission AS module,action_code_permission AS action,description_permission AS description,status_permission AS status FROM sec_permission WHERE code_permission=${permission.code} FOR UPDATE`.execute(tx);
    if (existing.rows.length && (existing.rows.length !== 1 || !Object.entries(permission).every(([key, value]) => existing.rows[0]?.[key] === value))) throw new Error("Formalization order read permission conflicts with existing configuration; reconciliation required");
    return existing.rows.length === 1;
}

/** Provision independent detail access; never copy banner denies or overwrite existing role grants/user overrides. */
export const formalizationOrderReadPermissionMigration = {
    name: "202610280048_formalization_order_read_permission",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            await assertNativeTables(tx);
            const roles = await readActiveRoles(tx);
            const permissionExists = await readPermission(tx);
            const grants = (await sql<{ role: number; code: string; status: string }>`SELECT rp.role_id_role_permission AS role,p.code_permission AS code,rp.status_role_permission AS status FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE p.code_permission=${permission.code} FOR UPDATE`.execute(tx)).rows;
            const missing = roles.filter((role) => !grants.some((grant) => grant.role === role.id));
            if (permissionExists && !missing.length) return;
            const actor = (
                await sql<{
                    id: number;
                    publicId: string;
                    name: string;
                }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)
            ).rows[0];
            if (!actor) throw new Error("Formalization order read permission requires Owner migration attribution");
            if (!permissionExists) await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${permission.code},${permission.module},${permission.action},${permission.description},${permission.status})`.execute(tx);
            for (const role of missing) await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) SELECT ${role.id},id_permission,'active' FROM sec_permission WHERE code_permission=${permission.code}`.execute(tx);
            if (missing.length) await sql`UPDATE sec_user u SET permission_version_user=permission_version_user+1 WHERE EXISTS (SELECT 1 FROM sec_user_role ur WHERE ur.user_id_user_role=u.id_user AND ur.role_id_user_role IN (${sql.join(missing.map((role) => role.id))}) AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL)`.execute(tx);
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'role_permissions_replaced',${actor.id},'Permiso Ver orden de venta habilitado independientemente de los banners.','Asignación a roles base activos; configuración independiente y excepciones individuales intactas.',${JSON.stringify({ migration: formalizationOrderReadPermissionMigration.name, moduleCode: "administration", sectionCode: "roles", actor: { publicId: actor.publicId, name: actor.name }, changeSet: { version: 1, entity: "permission", recordId: permission.code, action: permissionExists ? "update" : "create", before: { roleCodes: roles.filter((role) => grants.some((grant) => grant.role === role.id && grant.status === "active")).map((role) => role.code) }, after: { roleCodes: roles.filter((role) => missing.some((candidate) => candidate.id === role.id) || grants.some((grant) => grant.role === role.id && grant.status === "active")).map((role) => role.code) } } })})`.execute(
                tx,
            );
        });
    },
};
