import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const roles = [
    { code: "mercadeo", name: "Mercadeo", description: "Consulta de Inicio, captacion de leads, eventos y citas, calendario y catalogos de Mercadeo." },
    { code: "jefe_mercadeo", name: "Jefe de Mercadeo", description: "Jefatura de Mercadeo con acceso inicial de lectura; sin facultades adicionales de escritura o aprobacion." },
];
const sections = [
    { code: "mercadeo.home.read", description: "Permite ver el inicio de Mercadeo." },
    { code: "mercadeo.leads.read", description: "Permite ver la seccion Captacion de leads; no habilita todavia consultas ni exportaciones de leads." },
    { code: "mercadeo.appointments.read", description: "Permite ver la seccion Eventos y citas; no habilita todavia consultas ni exportaciones de citas." },
    { code: "mercadeo.calendar.read", description: "Permite ver la seccion Calendario de Mercadeo; no permite crear ni modificar citas." },
];
const catalogCodes = ["project", "campaign", "class", "broker", "file", "subsidiary", "location"].map((name) => `mercadeo.catalog_${name}.read`);
const permissionCodes = [...sections.map(({ code }) => code), ...catalogCodes];
type RoleRow = { id: number; name: string; description: string | null; status: string; deleted: Date | null; mode: string };

/** Reuse active catalog grants and create only the four approved section permissions. */
async function ensurePermissions(tx: Kysely<unknown>): Promise<void> {
    for (const code of permissionCodes) {
        const current = (await sql<{ id: number; module: string; action: string; status: string }>`SELECT id_permission AS id,module_code_permission AS module,action_code_permission AS action,status_permission AS status FROM sec_permission WHERE code_permission=${code} FOR UPDATE`.execute(tx)).rows[0];
        if (current && (current.module !== "mercadeo" || current.action !== "read" || current.status !== "active")) throw new Error("Marketing permission conflicts with existing configuration");
        if (current) continue;
        const section = sections.find((entry) => entry.code === code);
        if (!section) throw new Error("Marketing requires existing active catalog read permissions");
        await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${code},'mercadeo','read',${section.description},'active')`.execute(tx);
    }
}

/** Keep stable identities, extra grants and revocations; never turn the supervisor into an administrator. */
async function ensureRole(tx: Kysely<unknown>, definition: (typeof roles)[number]): Promise<{ role: RoleRow; existed: boolean }> {
    const read = () => sql<RoleRow>`SELECT id_role AS id,name_role AS name,description_role AS description,status_role AS status,deleted_at_role AS deleted,role_inheritance_mode_role AS mode FROM sec_role WHERE code_role=${definition.code} FOR UPDATE`.execute(tx);
    const existing = (await read()).rows[0];
    if (existing && ![existing.status === "active", existing.deleted === null, existing.mode === "assigned", existing.name === definition.name].every(Boolean)) throw new Error("Marketing role conflicts with existing configuration; explicit reconciliation required");
    if (!existing) await sql`INSERT INTO sec_role (code_role,name_role,description_role,status_role) VALUES (${definition.code},${definition.name},${definition.description},'active')`.execute(tx);
    const role = existing ?? (await read()).rows[0];
    if (!role) throw new Error("Marketing role was not created");
    return { role, existed: existing !== undefined };
}

type MigrationActor = { id: number; publicId: string; name: string };

/** Validate the native destination and an administratively capable audit actor before writes. */
async function readMigrationContext(tx: Kysely<unknown>): Promise<MigrationActor> {
    const destination = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx)).rows[0];
    if (destination?.name !== "CRM_THINK_V2") throw new Error("Marketing roles require CRM_THINK_V2");
    const tables = await sql<{ name: string; engine: string }>`SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
                AND TABLE_NAME IN ('sec_role','sec_permission','sec_role_permission','sec_org_unit','sec_user','sec_user_role','sec_user_permission_override','audit_security_event')`.execute(tx);
    if (tables.rows.length !== 8 || tables.rows.some(({ engine }) => engine !== "InnoDB")) throw new Error("Marketing migration requires InnoDB identity/audit tables");
    const module = (await sql<{ id: number }>`SELECT id_org_unit AS id FROM sec_org_unit WHERE code_org_unit='mercadeo' AND status_org_unit='active' AND deleted_at_org_unit IS NULL FOR UPDATE`.execute(tx)).rows[0];
    if (!module) throw new Error("Marketing requires an active Mercadeo module");
    const actor = (
        await sql<{ id: number; publicId: string; name: string }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name
                FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role
                WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL
                AND u.status_user='active' AND u.deleted_at_user IS NULL
                AND NOT EXISTS (SELECT 1 FROM sec_user_permission_override o JOIN sec_permission p ON p.id_permission=o.permission_id_user_permission_override
                    WHERE o.user_id_user_permission_override=u.id_user AND p.code_permission='role.assign' AND p.status_permission='active'
                    AND o.effect_user_permission_override='deny' AND o.status_user_permission_override='active' AND o.revoked_at_user_permission_override IS NULL
                    AND o.starts_at_user_permission_override<=CURRENT_TIMESTAMP(3) AND (o.ends_at_user_permission_override IS NULL OR o.ends_at_user_permission_override>CURRENT_TIMESTAMP(3)))
                ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)
    ).rows[0];
    if (!actor) throw new Error("Marketing roles require an active Owner without a role.assign deny");
    return actor;
}

/** Apply and audit one role atomically, preserving all unrelated grants. */
async function grantRole(tx: Kysely<unknown>, definition: (typeof roles)[number], actor: MigrationActor): Promise<boolean> {
    const { role, existed } = await ensureRole(tx, definition);
    const grants = (await sql<{ code: string; status: string }>`SELECT p.code_permission AS code,rp.status_role_permission AS status FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE rp.role_id_role_permission=${role.id} FOR UPDATE`.execute(tx)).rows;
    if (grants.some((grant) => permissionCodes.includes(grant.code) && grant.status !== "active")) throw new Error("Marketing grant was revoked; refusing silent reactivation");
    const missing = permissionCodes.filter((code) => !grants.some((grant) => grant.code === code));
    if (existed && missing.length === 0) return false;
    for (const code of missing) await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) SELECT ${role.id},id_permission,'active' FROM sec_permission WHERE code_permission=${code}`.execute(tx);
    const previousCodes = grants
        .filter((grant) => grant.status === "active")
        .map(({ code }) => code)
        .sort();
    const before = existed
        ? {
              name: role.name,
              description: role.description,
              status: "active",
              permissionCodes: previousCodes,
          }
        : null;
    const after = { name: role.name, description: role.description, status: "active", permissionCodes: [...previousCodes, ...missing].sort() };
    await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event)
                    VALUES (${ulid()},'role_permissions_replaced',${actor.id},${`Rol ${definition.name} habilitado con permisos de lectura.`},'Roles y secciones de Mercadeo autorizados por el propietario.',
                    ${JSON.stringify({ migration: marketingRolesMigration.name, moduleCode: "administration", sectionCode: "roles", roleCode: definition.code, actor: { publicId: actor.publicId, name: actor.name, roles: [{ code: "owner", name: "Owner" }] }, changeSet: { version: 1, entity: "role", recordId: definition.code, action: existed ? "update" : "create", before, after } })})`.execute(tx);
    return true;
}

/** Authorized identity-only migration: no employees assigned, business writes, legacy or new tables. */
export const marketingRolesMigration = {
    name: "202610230028_marketing_roles",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            const actor = await readMigrationContext(tx);
            await ensurePermissions(tx);
            let changed = false;
            for (const definition of roles) {
                if (await grantRole(tx, definition, actor)) changed = true;
            }
            // Inherited Owner access also changes; refresh versions without modifying assignments or denies.
            if (changed)
                await sql`UPDATE sec_user u SET permission_version_user=permission_version_user+1 WHERE EXISTS (
                SELECT 1 FROM sec_user_role ur JOIN sec_role r ON r.id_role=ur.role_id_user_role
                WHERE ur.user_id_user_role=u.id_user AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL
                AND r.status_role='active' AND r.deleted_at_role IS NULL AND (r.code_role IN ('mercadeo','jefe_mercadeo') OR r.role_inheritance_mode_role='all_active_roles'))`.execute(tx);
        });
    },
};
