import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const permissionCode = "formalizacion.home.stages.read";
type Role = { id: number; code: string; mode: string; status: string; deleted: Date | null };

/** Expand first: DDL commits independently; its assigned default grants no inherited access. */
async function ensurePolicyColumn(db: Kysely<unknown>): Promise<void> {
    const tables = await sql<{ name: string; engine: string }>`SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.TABLES
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('sec_role','sec_permission','sec_role_permission','sec_user','sec_user_role','sec_user_permission_override','audit_security_event')`.execute(db);
    if (tables.rows.length !== 7 || tables.rows.some((table) => table.engine !== "InnoDB")) throw new Error("Owner inheritance requires all identity/audit tables to be InnoDB");
    const columns = await sql<{ type: string; nullable: string; defaultValue: string | null }>`
        SELECT COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue
        FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sec_role' AND COLUMN_NAME='role_inheritance_mode_role'`.execute(db);
    const column = columns.rows[0];
    if (column) {
        if (column.type !== "enum('assigned','all_active_roles')" || column.nullable !== "NO" || column.defaultValue !== "assigned") throw new Error("Owner inheritance column conflicts with existing schema");
        return;
    }
    await sql`SET SESSION lock_wait_timeout=5`.execute(db);
    await sql`ALTER TABLE sec_role ADD COLUMN role_inheritance_mode_role ENUM('assigned','all_active_roles') NOT NULL DEFAULT 'assigned'
        COMMENT 'Owner puede heredar roles activos sin crear asignaciones directas a usuarios', ALGORITHM=INSTANT`.execute(db);
}

/** Revoke neither old assignments nor overrides; conflicting/revoked grants require an explicit decision. */
async function prepareGrants(tx: Kysely<unknown>, roles: Role[]): Promise<boolean> {
    const definitions = await sql<{ module: string; action: string; status: string }>`SELECT module_code_permission AS module, action_code_permission AS action, status_permission AS status
        FROM sec_permission WHERE code_permission=${permissionCode} FOR UPDATE`.execute(tx);
    const definition = definitions.rows[0];
    if (definition && ![definition.module === "formalizacion", definition.action === "read", definition.status === "active"].every(Boolean)) throw new Error("Stage read permission conflicts with existing configuration");
    const grants = await sql<{ roleId: number; status: string }>`SELECT rp.role_id_role_permission AS roleId,rp.status_role_permission AS status
        FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission
        WHERE p.code_permission=${permissionCode} AND rp.role_id_role_permission IN (${sql.join(roles.map((role) => role.id))}) FOR UPDATE`.execute(tx);
    if (grants.rows.some((grant) => grant.status !== "active")) throw new Error("Stage read grant was revoked; refusing silent reactivation");
    if (!definition)
        await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission)
        VALUES (${permissionCode},'formalizacion','read','Permite consultar los banners de etapas de Formalizacion; no autoriza modificar ordenes.','active')`.execute(tx);
    const missing = roles.filter((role) => !grants.rows.some((grant) => grant.roleId === role.id));
    for (const role of missing)
        await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission)
        SELECT ${role.id},id_permission,'active' FROM sec_permission WHERE code_permission=${permissionCode}`.execute(tx);
    return !definition || missing.length > 0;
}

export const ownerRoleInheritanceMigration = {
    name: "202610230027_owner_role_inheritance",
    async up(db: Kysely<unknown>): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Owner inheritance requires CRM_THINK_V2");
        await ensurePolicyColumn(db);
        await db.transaction().execute(async (tx) => {
            const result = await sql<Role>`SELECT id_role AS id,code_role AS code,role_inheritance_mode_role AS mode,status_role AS status,deleted_at_role AS deleted
                FROM sec_role WHERE code_role IN ('owner','formalizacion') ORDER BY id_role FOR UPDATE`.execute(tx);
            const roles = result.rows;
            const owner = roles.find((role) => role.code === "owner");
            if (roles.length !== 2 || roles.some((role) => role.status !== "active" || role.deleted !== null) || !owner) throw new Error("Owner inheritance requires active Owner and Formalizacion roles");
            if (roles.some((role) => role.code !== "owner" && role.mode !== "assigned")) throw new Error("Only Owner may inherit all roles");
            const changedGrants = await prepareGrants(tx, roles);
            if (owner.mode === "all_active_roles" && !changedGrants) return;
            // Keep an administratively capable Owner; never erase an existing direct deny to obtain one.
            const actors = await sql<{ id: number; publicId: string; name: string }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name
                FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user
                WHERE ur.role_id_user_role=${owner.id} AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL
                AND u.status_user='active' AND u.deleted_at_user IS NULL
                AND NOT EXISTS (SELECT 1 FROM sec_user_permission_override o JOIN sec_permission p ON p.id_permission=o.permission_id_user_permission_override
                    WHERE o.user_id_user_permission_override=u.id_user AND p.code_permission='role.assign' AND p.status_permission='active'
                    AND o.effect_user_permission_override='deny' AND o.status_user_permission_override='active' AND o.revoked_at_user_permission_override IS NULL
                    AND o.starts_at_user_permission_override<=CURRENT_TIMESTAMP(3) AND (o.ends_at_user_permission_override IS NULL OR o.ends_at_user_permission_override>CURRENT_TIMESTAMP(3)))
                ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx);
            const actor = actors.rows[0];
            if (!actor) throw new Error("Owner inheritance requires an active Owner without a role.assign deny; recovery must be resolved explicitly");
            await sql`UPDATE sec_role SET role_inheritance_mode_role='all_active_roles',updated_at_role=UTC_TIMESTAMP(3) WHERE id_role=${owner.id}`.execute(tx);
            await sql`UPDATE sec_user u SET permission_version_user=permission_version_user+1
                WHERE EXISTS (SELECT 1 FROM sec_user_role ur WHERE ur.user_id_user_role=u.id_user AND ur.role_id_user_role IN (${sql.join(roles.map((role) => role.id))})
                    AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL)`.execute(tx);
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event)
                VALUES (${ulid()},'owner_role_inheritance_enabled',${actor.id},'Herencia efectiva de roles activos habilitada para Owner.','Politica confirmada por el propietario; las denegaciones individuales prevalecen.',
                ${JSON.stringify({ migration: ownerRoleInheritanceMigration.name, moduleCode: "administration", sectionCode: "roles", roleCode: "owner", actor: { publicId: actor.publicId, name: actor.name, roles: [{ code: "owner", name: "Owner" }] }, permissionCode, grantedRoleCodes: roles.map((role) => role.code), directAssignmentsChanged: false, directOverridesChanged: false, changeSet: { version: 1, entity: "role", recordId: "owner", action: "update", before: { roleInheritanceMode: owner.mode }, after: { roleInheritanceMode: "all_active_roles", directDenyPrecedence: true } } })})`.execute(
                tx,
            );
        });
    },
};
