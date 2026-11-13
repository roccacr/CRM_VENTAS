import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

// Contrato histórico de 030: no depender del catálogo runtime, que puede retirar módulos después.
const OPERATIONAL_MODULE_CODES = ["ventas", "mercadeo", "formalizacion", "contabilidad"] as const;

const migrationName = "202610230030_general_manager_template";
const requiredTables = ["sec_role", "sec_role_module", "sec_org_unit", "sec_permission", "sec_role_permission", "sec_user", "sec_user_role", "sec_user_permission_override", "audit_security_event", "conf_schema_migration"];
type Role = { id: number; code: string; name: string; status: string; deleted: Date | null; roleMode: string; permissionMode: string };
type Module = { id: number; code: string; status: string; deleted: Date | null };
type Permission = { id: number; code: string; module: string; status: string };
type Mapping = { moduleId: number; code: string; status: string };
type Grant = { permissionId: number; code: string; module: string; status: string; permissionStatus: string };
type Column = { table: string; name: string; type: string; nullable: string; defaultValue: string | null };

/** No DDL: require native InnoDB identity tables and the already-applied 029 structures. */
async function validateSchema(tx: Kysely<unknown>): Promise<void> {
    const destination = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx)).rows[0];
    if (destination?.name !== "CRM_THINK_V2") throw new Error("General template requires CRM_THINK_V2");
    const tables = (await sql<{ name: string; engine: string }>`SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(requiredTables)})`.execute(tx)).rows;
    if (tables.length !== requiredTables.length || tables.some((table) => table.engine !== "InnoDB")) throw new Error("General template requires InnoDB identity tables");
    const columns = (
        await sql<Column>`SELECT TABLE_NAME AS 'table',COLUMN_NAME AS name,COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue
        FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND (TABLE_NAME='sec_role_module' OR (TABLE_NAME='sec_role' AND COLUMN_NAME IN ('role_inheritance_mode_role','permission_inheritance_mode_role')))`.execute(tx)
    ).rows;
    validateColumns(columns);
    const prerequisite = (await sql<{ id: number }>`SELECT id_schema_migration AS id FROM conf_schema_migration WHERE migration_name_schema_migration='202610230029_general_manager_modules'`.execute(tx)).rows[0];
    if (!prerequisite) throw new Error("General template requires applied migration 029");
}

/** Refuse an incompatible policy or relation rather than assuming the ledger proves its current shape. */
function validateColumns(columns: Column[]): void {
    const expected = [
        ["sec_role", "role_inheritance_mode_role", "enum('assigned','all_active_roles')", "assigned"],
        ["sec_role", "permission_inheritance_mode_role", "enum('assigned','selected_modules')", "assigned"],
        ["sec_role_module", "role_id_role_module", "bigint unsigned", null],
        ["sec_role_module", "org_unit_id_role_module", "bigint unsigned", null],
        ["sec_role_module", "status_role_module", "varchar(30)", "active"],
        ["sec_role_module", "created_at_role_module", "datetime(3)", "utc_timestamp(3)"],
        ["sec_role_module", "updated_at_role_module", "datetime(3)", "utc_timestamp(3)"],
    ] as const;
    if (columns.length !== expected.length || !expected.every(([table, name, type, defaultValue]) => columns.some((column) => column.table === table && column.name === name && column.type === type && column.nullable === "NO" && (column.defaultValue?.toLowerCase().replace(/^\((.*)\)$/, "$1") ?? null) === defaultValue))) throw new Error("General template identity schema conflicts with 029");
}

/** Require an active capable Owner; direct denies remain authoritative and are never erased. */
async function readActor(tx: Kysely<unknown>) {
    const actor = (
        await sql<{ id: number; publicId: string; name: string }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name
        FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role owner ON owner.id_role=ur.role_id_user_role
        WHERE owner.code_role='owner' AND owner.status_role='active' AND owner.deleted_at_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL
          AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL
          AND NOT EXISTS (SELECT 1 FROM sec_user_permission_override o JOIN sec_permission p ON p.id_permission=o.permission_id_user_permission_override
            WHERE o.user_id_user_permission_override=u.id_user AND p.code_permission='role.assign' AND p.status_permission='active'
              AND o.effect_user_permission_override='deny' AND o.status_user_permission_override='active' AND o.revoked_at_user_permission_override IS NULL
              AND o.starts_at_user_permission_override<=UTC_TIMESTAMP(3) AND (o.ends_at_user_permission_override IS NULL OR o.ends_at_user_permission_override>UTC_TIMESTAMP(3)))
          AND EXISTS (SELECT 1 FROM sec_permission p WHERE p.code_permission='role.assign' AND p.status_permission='active' AND (
            EXISTS (SELECT 1 FROM sec_role_permission rp JOIN sec_role r ON r.id_role=rp.role_id_role_permission
              WHERE rp.permission_id_role_permission=p.id_permission AND rp.status_role_permission='active' AND r.status_role='active' AND r.deleted_at_role IS NULL
                AND (r.id_role=owner.id_role OR owner.role_inheritance_mode_role='all_active_roles'))
            OR EXISTS (SELECT 1 FROM sec_user_permission_override o WHERE o.user_id_user_permission_override=u.id_user AND o.permission_id_user_permission_override=p.id_permission
              AND o.effect_user_permission_override='allow' AND o.status_user_permission_override='active' AND o.revoked_at_user_permission_override IS NULL
              AND o.starts_at_user_permission_override<=UTC_TIMESTAMP(3) AND (o.ends_at_user_permission_override IS NULL OR o.ends_at_user_permission_override>UTC_TIMESTAMP(3)))))
        ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)
    ).rows[0];
    if (!actor) throw new Error("General template requires an active capable Owner without role.assign deny");
    return actor;
}

/** Keep 029's inheritance policy unchanged; this cut only persists an editable template. */
async function readRole(tx: Kysely<unknown>): Promise<Role> {
    const role = (await sql<Role>`SELECT id_role AS id,code_role AS code,name_role AS name,status_role AS status,deleted_at_role AS deleted,role_inheritance_mode_role AS roleMode,permission_inheritance_mode_role AS permissionMode FROM sec_role WHERE code_role='jefe_general' FOR UPDATE`.execute(tx)).rows[0];
    if (!role || ![role.status === "active", role.deleted === null, role.roleMode === "assigned", role.permissionMode === "selected_modules"].every(Boolean)) throw new Error("General template requires the active compatible Jefe General role");
    return role;
}

/** Include inactive history so an explicit revocation can never masquerade as a missing grant. */
async function readTemplate(tx: Kysely<unknown>, roleId: number) {
    const mappings = (await sql<Mapping>`SELECT rm.org_unit_id_role_module AS moduleId,o.code_org_unit AS code,rm.status_role_module AS status FROM sec_role_module rm JOIN sec_org_unit o ON o.id_org_unit=rm.org_unit_id_role_module WHERE rm.role_id_role_module=${roleId} ORDER BY rm.org_unit_id_role_module FOR UPDATE`.execute(tx)).rows;
    const permissions = (await sql<Grant>`SELECT rp.permission_id_role_permission AS permissionId,p.code_permission AS code,p.module_code_permission AS module,rp.status_role_permission AS status,p.status_permission AS permissionStatus FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE rp.role_id_role_permission=${roleId} ORDER BY rp.permission_id_role_permission,rp.id_role_permission FOR UPDATE`.execute(tx)).rows;
    return { mappings, permissions };
}

/** Reject administrative ceilings/grants and deliberate revocations instead of silently replacing them. */
function validateTemplate(before: Awaited<ReturnType<typeof readTemplate>>, permissions: Permission[]): void {
    const operational = new Set<string>(OPERATIONAL_MODULE_CODES);
    if (before.mappings.some((mapping) => mapping.status !== "active" || !operational.has(mapping.code))) throw new Error("General template module mapping was revoked or conflicts");
    if (before.permissions.some((grant) => grant.status === "active" && !operational.has(grant.module))) throw new Error("General template contains a non-operational grant; explicit reconciliation required");
    if (permissions.some((permission) => before.permissions.some((grant) => grant.permissionId === permission.id) && !before.permissions.some((grant) => grant.permissionId === permission.id && grant.status === "active"))) throw new Error("General template permission was revoked; refusing reactivation");
}

/** One native identity transaction; no assignment changes, policy flips, DDL or business writes. */
export const generalManagerTemplateMigration = {
    name: migrationName,
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            await validateSchema(tx);
            const actor = await readActor(tx);
            const role = await readRole(tx);
            // Later Owner edits are intentional: replay must never restore deleted or revoked template entries.
            const applied = (await sql<{ id: number }>`SELECT id_security_event AS id FROM audit_security_event WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata_security_event,'$.migration'))=${migrationName} LIMIT 1`.execute(tx)).rows.length > 0;
            if (applied) return;
            const modules = (await sql<Module>`SELECT id_org_unit AS id,code_org_unit AS code,status_org_unit AS status,deleted_at_org_unit AS deleted FROM sec_org_unit WHERE code_org_unit IN (${sql.join(OPERATIONAL_MODULE_CODES)}) ORDER BY id_org_unit FOR UPDATE`.execute(tx)).rows;
            if (modules.length !== OPERATIONAL_MODULE_CODES.length || modules.some((module) => module.status !== "active" || module.deleted !== null)) throw new Error("General template requires all four active operational modules");
            const permissions = (await sql<Permission>`SELECT id_permission AS id,code_permission AS code,module_code_permission AS module,status_permission AS status FROM sec_permission WHERE status_permission='active' AND module_code_permission IN (${sql.join(OPERATIONAL_MODULE_CODES)}) ORDER BY id_permission FOR UPDATE`.execute(tx)).rows;
            const before = await readTemplate(tx, role.id);
            validateTemplate(before, permissions);
            for (const module of modules.filter((module) => !before.mappings.some((mapping) => mapping.moduleId === module.id))) await sql`INSERT INTO sec_role_module (role_id_role_module,org_unit_id_role_module,status_role_module) VALUES (${role.id},${module.id},'active')`.execute(tx);
            for (const permission of permissions.filter((permission) => !before.permissions.some((grant) => grant.permissionId === permission.id && grant.status === "active"))) await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) VALUES (${role.id},${permission.id},'active')`.execute(tx);
            await sql`UPDATE sec_user u SET permission_version_user=permission_version_user+1 WHERE EXISTS (
                SELECT 1 FROM sec_user_role ur JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE ur.user_id_user_role=u.id_user
                  AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND r.status_role='active' AND r.deleted_at_role IS NULL
                  AND (r.id_role=${role.id} OR r.code_role='owner' OR r.role_inheritance_mode_role='all_active_roles'))`.execute(tx);
            const after = await readTemplate(tx, role.id);
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event)
                VALUES (${ulid()},'role_permissions_replaced',${actor.id},'Plantilla editable de Jefe General persistida con modulos y permisos operativos actuales.','Plantilla administrada por Owner; sin permisos administrativos ni asignaciones de usuarios.',
                ${JSON.stringify({ migration: migrationName, moduleCode: "administration", sectionCode: "roles", roleCode: role.code, actor: { publicId: actor.publicId, name: actor.name }, directAssignmentsChanged: false, directOverridesChanged: false, changeSet: { version: 1, entity: "role", recordId: role.code, action: "update", before: { role, ...before }, after: { role, ...after } } })})`.execute(tx);
        });
    },
};
