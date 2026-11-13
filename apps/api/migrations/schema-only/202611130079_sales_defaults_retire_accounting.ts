import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const allowedRoles = ["owner", "jefe_general", "jefe_ventas", "ventas"];

/** Destino nativo y dependencias de 078; nunca crea módulos ni activa usuarios. */
async function readContext(tx: Kysely<unknown>): Promise<{ salesId: number; actorId: number }> {
    const schema = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx)).rows[0];
    if (schema?.name !== "CRM_THINK_V2") throw new Error("Sales defaults require CRM_THINK_V2");
    const module = (await sql<{ id: number }>`SELECT id_org_unit AS id FROM sec_org_unit WHERE code_org_unit='ventas' AND status_org_unit='active' AND deleted_at_org_unit IS NULL FOR UPDATE`.execute(tx)).rows[0];
    const permission = (await sql<{ id: number }>`SELECT id_permission AS id FROM sec_permission WHERE code_permission='ventas.home.read' AND module_code_permission='ventas' AND status_permission='active' FOR UPDATE`.execute(tx)).rows[0];
    if (!module || !permission) throw new Error("Apply Sales Home migration 078 first");
    const actor = (await sql<{ id: number }>`SELECT u.id_user AS id FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)).rows[0];
    if (!actor) throw new Error("Owner attribution required");
    return { salesId: module.id, actorId: actor.id };
}

/** Un módulo retirado no puede recibir nuevos accesos; los vínculos históricos se conservan. */
async function retireAccounting(tx: Kysely<unknown>, actorId: number): Promise<void> {
    await sql`UPDATE sec_permission SET status_permission='inactive' WHERE module_code_permission='contabilidad' AND status_permission='active'`.execute(tx);
    await sql`UPDATE sec_role_module m JOIN sec_org_unit o ON o.id_org_unit=m.org_unit_id_role_module SET m.status_role_module='inactive' WHERE o.code_org_unit='contabilidad' AND m.status_role_module='active'`.execute(tx);
    await sql`UPDATE sec_user_org_unit m JOIN sec_org_unit o ON o.id_org_unit=m.org_unit_id_user_org_unit SET m.status_user_org_unit='inactive',m.revoked_at_user_org_unit=UTC_TIMESTAMP(3),m.revoked_by_user_id_user_org_unit=${actorId} WHERE o.code_org_unit='contabilidad' AND m.status_user_org_unit='active'`.execute(tx);
    await sql`UPDATE conf_calendar_event_type t JOIN sec_org_unit o ON o.id_org_unit=t.module_id_calendar_event_type SET t.status_calendar_event_type='inactive' WHERE o.code_org_unit='contabilidad' AND t.status_calendar_event_type='active'`.execute(tx);
    await sql`UPDATE sec_org_unit SET status_org_unit='inactive',deleted_at_org_unit=COALESCE(deleted_at_org_unit,UTC_TIMESTAMP(3)),updated_at_org_unit=UTC_TIMESTAMP(3) WHERE code_org_unit='contabilidad'`.execute(tx);
}

/** Membresías de Inicio por defecto, sin activar personas ni borrar revocaciones anteriores. */
async function assignSalesDefaults(tx: Kysely<unknown>, salesId: number, actorId: number): Promise<void> {
    await sql`INSERT INTO sec_user_org_unit (user_id_user_org_unit,org_unit_id_user_org_unit,membership_code_user_org_unit,scope_code_user_org_unit,status_user_org_unit,assigned_at_user_org_unit,assigned_by_user_id_user_org_unit)
    SELECT DISTINCT u.id_user,${salesId},'member','self','active',UTC_TIMESTAMP(3),${actorId}
    FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role
    WHERE u.deleted_at_user IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND r.status_role='active' AND r.deleted_at_role IS NULL AND r.code_role IN (${sql.join(allowedRoles)})
    AND NOT EXISTS (SELECT 1 FROM sec_user_org_unit m WHERE m.user_id_user_org_unit=u.id_user AND m.org_unit_id_user_org_unit=${salesId} AND m.status_user_org_unit='active' AND m.revoked_at_user_org_unit IS NULL)`.execute(tx);
}

/** Cambio de configuración autorizado, íntegro en una transacción nativa y con auditoría. */
export const salesDefaultsRetireAccountingMigration = {
    name: "202611130079_sales_defaults_retire_accounting",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            const { salesId, actorId } = await readContext(tx);
            const before = (await sql<Record<string, unknown>>`SELECT code_permission,status_permission FROM sec_permission WHERE module_code_permission='contabilidad' ORDER BY code_permission FOR UPDATE`.execute(tx)).rows;
            const beforeMemberships = (await sql<Record<string, unknown>>`SELECT m.id_user_org_unit,m.user_id_user_org_unit,m.org_unit_id_user_org_unit,m.status_user_org_unit,m.revoked_at_user_org_unit FROM sec_user_org_unit m JOIN sec_org_unit o ON o.id_org_unit=m.org_unit_id_user_org_unit WHERE o.code_org_unit IN ('ventas','contabilidad') ORDER BY m.id_user_org_unit FOR UPDATE`.execute(tx)).rows;
            const beforeModule = (await sql<Record<string, unknown>>`SELECT id_org_unit,code_org_unit,status_org_unit,deleted_at_org_unit,updated_at_org_unit FROM sec_org_unit WHERE code_org_unit='contabilidad' FOR UPDATE`.execute(tx)).rows;
            const beforeRoleModules = (await sql<Record<string, unknown>>`SELECT m.* FROM sec_role_module m JOIN sec_org_unit o ON o.id_org_unit=m.org_unit_id_role_module WHERE o.code_org_unit='contabilidad' FOR UPDATE`.execute(tx)).rows;
            const beforeCalendarTypes = (await sql<Record<string, unknown>>`SELECT t.id_calendar_event_type,t.status_calendar_event_type FROM conf_calendar_event_type t JOIN sec_org_unit o ON o.id_org_unit=t.module_id_calendar_event_type WHERE o.code_org_unit='contabilidad' FOR UPDATE`.execute(tx)).rows;
            await assignSalesDefaults(tx, salesId, actorId);
            await retireAccounting(tx, actorId);
            // Modificación de alcance organizativo: invalida solo sesiones de personas potencialmente afectadas.
            await sql`UPDATE sec_user u SET permission_version_user=permission_version_user+1 WHERE u.deleted_at_user IS NULL AND (
                EXISTS (SELECT 1 FROM sec_user_org_unit m JOIN sec_org_unit o ON o.id_org_unit=m.org_unit_id_user_org_unit WHERE m.user_id_user_org_unit=u.id_user AND o.code_org_unit IN ('ventas','contabilidad'))
                OR EXISTS (SELECT 1 FROM sec_user_role ur JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE ur.user_id_user_role=u.id_user AND ur.status_user_role='active' AND (r.code_role IN (${sql.join(allowedRoles)}) OR EXISTS (SELECT 1 FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE rp.role_id_role_permission=r.id_role AND p.module_code_permission='contabilidad')))
                OR EXISTS (SELECT 1 FROM sec_user_permission_override v JOIN sec_permission p ON p.id_permission=v.permission_id_user_permission_override WHERE v.user_id_user_permission_override=u.id_user AND p.module_code_permission='contabilidad'))`.execute(tx);
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'sales_defaults_accounting_retired',${actorId},'Ventas por defecto y retiro del módulo Contabilidad.','Solicitud expresa del propietario. Solo CRM_THINK_V2; sin activar cuentas ni modificar otra base.',${JSON.stringify({ migration: salesDefaultsRetireAccountingMigration.name, before, beforeMemberships, beforeModule, beforeRoleModules, beforeCalendarTypes, salesRoles: allowedRoles, salesSections: ["home"], retiredModule: "contabilidad", preservesPersonalDenies: true })})`.execute(
                tx,
            );
        });
    },
};
