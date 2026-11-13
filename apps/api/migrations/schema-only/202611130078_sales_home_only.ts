import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const roleCodes = ["owner", "jefe_general", "jefe_ventas", "ventas"] as const;
const permissionCode = "ventas.home.read";
const tables = ["sec_org_unit", "sec_role", "sec_role_module", "sec_permission", "sec_role_permission", "sec_user", "sec_user_role", "sec_user_org_unit", "sec_user_permission_override", "audit_security_event"];

type Role = { id: number; code: string; status: string; deleted: Date | null };

/** Valida el destino antes de cualquier cambio. */
async function assertNative(tx: Kysely<unknown>): Promise<void> {
    const schema = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx)).rows[0];
    if (schema?.name !== "CRM_THINK_V2") throw new Error("Sales Home requires CRM_THINK_V2");
    const engines = (await sql<{ name: string; engine: string }>`SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(tables)})`.execute(tx)).rows;
    if (engines.length !== tables.length || engines.some((table) => table.engine !== "InnoDB")) throw new Error("Sales Home requires native InnoDB security tables");
}

/** El módulo ya existe y la operación queda atribuida a un Owner activo. */
async function readContext(tx: Kysely<unknown>): Promise<{ moduleId: number; actor: { id: number } }> {
    const modules = (await sql<{ id: number; status: string; deleted: Date | null }>`SELECT id_org_unit AS id,status_org_unit AS status,deleted_at_org_unit AS deleted FROM sec_org_unit WHERE code_org_unit='ventas' FOR UPDATE`.execute(tx)).rows;
    const salesModule = modules[0];
    if (!salesModule) throw new Error("Sales Home requires the existing active Sales module");
    if (modules.length !== 1 || salesModule.status !== "active" || salesModule.deleted) throw new Error("Sales Home requires the existing active Sales module");
    const moduleId = salesModule.id;
    const actor = (await sql<{ id: number }>`SELECT u.id_user AS id FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)).rows[0];
    if (!actor) throw new Error("Sales Home requires Owner migration attribution");

    return { moduleId, actor };
}

/** Crea solamente la jefatura faltante; no reactiva roles deshabilitados. */
async function ensureRoles(tx: Kysely<unknown>): Promise<Role[]> {
    // Existing disabled configuration is never silently reactivated.
    await sql`INSERT INTO sec_role (code_role,name_role,description_role,status_role) SELECT 'jefe_ventas','Jefe de ventas','Jefatura del módulo Ventas.','active' WHERE NOT EXISTS (SELECT 1 FROM sec_role WHERE code_role='jefe_ventas')`.execute(tx);
    const roles = (await sql<Role>`SELECT id_role AS id,code_role AS code,status_role AS status,deleted_at_role AS deleted FROM sec_role WHERE code_role IN (${sql.join(roleCodes)}) FOR UPDATE`.execute(tx)).rows;
    if (roles.length !== roleCodes.length || roles.some((role) => role.status !== "active" || role.deleted)) throw new Error("Sales Home requires four active authorized roles");
    return roles;
}

/** Una definición administrada incompatible exige reconciliación explícita. */
async function ensurePermission(tx: Kysely<unknown>): Promise<{ id: number }> {
    await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) SELECT ${permissionCode},'ventas','read','Permite ver Inicio de Ventas.','active' WHERE NOT EXISTS (SELECT 1 FROM sec_permission WHERE code_permission=${permissionCode})`.execute(tx);
    const permission = (await sql<{ id: number; module: string; status: string; action: string }>`SELECT id_permission AS id,module_code_permission AS module,status_permission AS status,action_code_permission AS action FROM sec_permission WHERE code_permission=${permissionCode} FOR UPDATE`.execute(tx)).rows[0];
    if (!permission || permission.module !== "ventas" || permission.status !== "active" || permission.action !== "read") throw new Error("Sales Home permission conflicts with existing configuration");

    return permission;
}

/** Completa relaciones faltantes sin restaurar grants revocados ni overrides. */
async function configureGrants(tx: Kysely<unknown>, moduleId: number, roles: Role[], permission: { id: number }): Promise<void> {
    for (const role of roles) {
        if (role.code !== "owner") {
            await sql`INSERT INTO sec_role_module (role_id_role_module,org_unit_id_role_module,status_role_module) SELECT ${role.id},${moduleId},'active' WHERE NOT EXISTS (SELECT 1 FROM sec_role_module WHERE role_id_role_module=${role.id} AND org_unit_id_role_module=${moduleId})`.execute(tx);
            const mapping = (await sql<{ status: string }>`SELECT status_role_module AS status FROM sec_role_module WHERE role_id_role_module=${role.id} AND org_unit_id_role_module=${moduleId} FOR UPDATE`.execute(tx)).rows[0];
            if (mapping?.status !== "active") throw new Error("Sales Home role module mapping is disabled; reconcile explicitly");
        }
        await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) SELECT ${role.id},${permission.id},'active' WHERE NOT EXISTS (SELECT 1 FROM sec_role_permission WHERE role_id_role_permission=${role.id} AND permission_id_role_permission=${permission.id})`.execute(tx);
    }
}

/** Retira las secciones solo en Ventas e invalida sesiones potencialmente afectadas. */
async function retireSections(tx: Kysely<unknown>, moduleId: number, ids: number[], permission: { id: number }): Promise<void> {
    // Keep revoked grants and every individual deny. Only active unauthorized grants are revoked.
    await sql`UPDATE sec_role_permission SET status_role_permission='revoked' WHERE permission_id_role_permission=${permission.id} AND role_id_role_permission NOT IN (${sql.join(ids)}) AND status_role_permission='active'`.execute(tx);
    // Solo Inicio queda activo; las notas y demás datos históricos no se eliminan.
    await sql`UPDATE sec_permission SET status_permission='inactive' WHERE module_code_permission='ventas' AND code_permission<>${permissionCode} AND status_permission='active'`.execute(tx);
    await sql`UPDATE sec_role_module SET status_role_module='inactive' WHERE org_unit_id_role_module=${moduleId} AND role_id_role_module NOT IN (${sql.join(ids)}) AND status_role_module='active'`.execute(tx);
    await sql`UPDATE sec_user u SET permission_version_user=permission_version_user+1 WHERE u.deleted_at_user IS NULL AND (
    EXISTS (SELECT 1 FROM sec_user_org_unit m WHERE m.user_id_user_org_unit=u.id_user AND m.org_unit_id_user_org_unit=${moduleId} AND m.status_user_org_unit='active')
    OR EXISTS (SELECT 1 FROM sec_user_role ur JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE ur.user_id_user_role=u.id_user AND ur.status_user_role='active' AND (r.code_role IN (${sql.join(roleCodes)}) OR EXISTS (SELECT 1 FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE rp.role_id_role_permission=r.id_role AND p.module_code_permission='ventas')))
    OR EXISTS (SELECT 1 FROM sec_user_permission_override o JOIN sec_permission p ON p.id_permission=o.permission_id_user_permission_override WHERE o.user_id_user_permission_override=u.id_user AND p.module_code_permission='ventas'))`.execute(tx);
}

/** Solo DML nativo y transaccional; no asigna personas ni borra historia comercial. */
export const salesHomeOnlyMigration = {
    name: "202611130078_sales_home_only",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            await assertNative(tx);
            const { moduleId, actor } = await readContext(tx);
            const roles = await ensureRoles(tx);
            const before = (await sql<Record<string, unknown>>`SELECT p.code_permission AS permission,p.status_permission AS permissionStatus,r.code_role AS role,rp.status_role_permission AS status FROM sec_permission p LEFT JOIN sec_role_permission rp ON rp.permission_id_role_permission=p.id_permission LEFT JOIN sec_role r ON r.id_role=rp.role_id_role_permission WHERE p.module_code_permission='ventas' ORDER BY p.code_permission,r.code_role`.execute(tx)).rows;
            const beforeMappings = (await sql<Record<string, unknown>>`SELECT r.code_role AS role,m.status_role_module AS status FROM sec_role_module m JOIN sec_role r ON r.id_role=m.role_id_role_module WHERE m.org_unit_id_role_module=${moduleId} ORDER BY r.code_role FOR UPDATE`.execute(tx)).rows;
            const permission = await ensurePermission(tx);
            await configureGrants(tx, moduleId, roles, permission);
            await retireSections(
                tx,
                moduleId,
                roles.map((role) => role.id),
                permission,
            );
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'sales_home_only_configured',${actor.id},'Ventas conserva únicamente Inicio.','Primera etapa autorizada de migración: acceso por cuatro roles, membresía y permiso efectivo.',${JSON.stringify({ migration: salesHomeOnlyMigration.name, moduleCode: "ventas", before: { permissions: before, mappings: beforeMappings }, after: { sections: ["home"], roleCodes, permission: permissionCode }, preservesPersonalOverrides: true, assignsUsers: false })})`.execute(
                tx,
            );
        });
    },
};
