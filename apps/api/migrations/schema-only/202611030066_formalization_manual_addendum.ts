import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

import { planAddendumColumns } from "./202611030065_formalization_order_addendum.js";

const roleCodes = ["owner", "formalizacion", "jefe_formalizaciones", "jefe_general"];
const definitions = [
    { code: "formalizacion.orders.addendum.mark_pending", module: "formalizacion", action: "mark_pending", description: "Marcar adéndum pendiente", status: "active", roles: ["jefe_formalizaciones"] },
    { code: "formalizacion.orders.addendum.read", module: "formalizacion", action: "read", description: "Ver adéndum en la orden", status: "active", roles: roleCodes },
    { code: "formalizacion.home.addendum.read", module: "formalizacion", action: "read", description: "Ver banner de adéndum", status: "active", roles: roleCodes },
] as const;
const securityTables = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"];

/** No aplica 065 de manera implícita: valida su contrato completo antes de agregar la nota. */
export async function planAddendumNoteColumn(db: Kysely<unknown>, source: "native" | "legacy"): Promise<string[]> {
    if ((await planAddendumColumns(db, source)).length) throw new Error("Addendum note requires the three approved base columns");
    const table = source === "native" ? "crm_sales_order" : "ordenventa";
    const column = source === "native" ? "addendum_note_sales_order" : "nota_adendum_ov";
    const existing = (await sql<{ type: string; nullable: string; defaultValue: string | null; extra: string }>`SELECT COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue,EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table} AND COLUMN_NAME=${column}`.execute(db)).rows[0];
    if (existing) {
        if (![existing.type === "text", existing.nullable === "YES", [null, "NULL"].includes(existing.defaultValue), existing.extra === ""].every(Boolean)) throw new Error("Addendum note column drift");
        return [];
    }
    return [`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` TEXT NULL DEFAULT NULL, ALGORITHM=INSTANT`];
}

/** Una definición administrativa previa se conserva íntegra o bloquea la migración por discrepancia. */
function assertPermissionDefinitions(existing: readonly Record<string, unknown>[]): void {
    for (const row of existing) {
        const expected = definitions.find((definition) => definition.code === row.code);
        if (!expected || !["code", "module", "action", "description", "status"].every((key) => row[key] === expected[key as keyof typeof expected]) || existing.filter((definition) => definition.code === row.code).length !== 1) throw new Error("Manual addendum permission drift");
    }
}

/** Roles, definiciones, grants y actor se comprueban antes del DDL y nuevamente dentro del DML auditado. */
async function readPermissionPlan(tx: Kysely<unknown>) {
    const tables = (await sql<{ table_name: string; table_type: string; engine: string }>`SELECT TABLE_NAME AS table_name,TABLE_TYPE AS table_type,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(securityTables)})`.execute(tx)).rows;
    if (tables.length !== securityTables.length || !securityTables.every((name) => tables.some((table) => table.table_name === name && table.table_type === "BASE TABLE" && table.engine === "InnoDB"))) throw new Error("Manual addendum requires native InnoDB security tables");
    const roles = (await sql<{ id: number; code: string; status: string; deleted: Date | null }>`SELECT id_role AS id,code_role AS code,status_role AS status,deleted_at_role AS deleted FROM sec_role WHERE code_role IN (${sql.join(roleCodes)}) FOR UPDATE`.execute(tx)).rows;
    if (roles.length !== roleCodes.length || !roleCodes.every((code) => roles.filter((role) => role.code === code && role.status === "active" && role.deleted === null).length === 1)) throw new Error("Manual addendum requires four active roles");
    const existing = (await sql<Record<string, unknown>>`SELECT code_permission AS code,module_code_permission AS module,action_code_permission AS action,description_permission AS description,status_permission AS status FROM sec_permission WHERE code_permission IN (${sql.join(definitions.map((definition) => definition.code))}) FOR UPDATE`.execute(tx)).rows;
    assertPermissionDefinitions(existing);
    const grants = (await sql<{ role: number; code: string; status: string }>`SELECT rp.role_id_role_permission AS role,p.code_permission AS code,rp.status_role_permission AS status FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE p.code_permission IN (${sql.join(definitions.map((definition) => definition.code))}) FOR UPDATE`.execute(tx)).rows;
    const plans = definitions.map((definition) => ({ definition, exists: existing.some((row) => row.code === definition.code), missing: roles.filter((role) => definition.roles.some((code) => code === role.code) && !grants.some((grant) => grant.role === role.id && grant.code === definition.code)) }));
    if (plans.every((plan) => plan.exists && plan.missing.length === 0)) return null;
    const actor = (
        await sql<{
            id: number;
            publicId: string;
            name: string;
        }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)
    ).rows[0];
    if (!actor) throw new Error("Manual addendum requires Owner attribution");
    return { plans, actor, grants, roles };
}

/** Solo los grants faltantes cambian; no reactiva revocaciones ni concede marcado manual a Owner implícitamente. */
async function applyPermissions(tx: Kysely<unknown>) {
    const state = await readPermissionPlan(tx);
    if (!state) return;
    const { plans, actor, roles, grants } = state;
    for (const plan of plans) {
        const { definition } = plan;
        if (!plan.exists) await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${definition.code},${definition.module},${definition.action},${definition.description},${definition.status})`.execute(tx);
        for (const role of plan.missing) await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) SELECT ${role.id},id_permission,'active' FROM sec_permission WHERE code_permission=${definition.code}`.execute(tx);
    }
    const changedRoles = [...new Set(plans.flatMap((plan) => plan.missing.map((role) => role.id)))];
    if (changedRoles.length) await sql`UPDATE sec_user u SET permission_version_user=permission_version_user+1 WHERE EXISTS (SELECT 1 FROM sec_user_role ur WHERE ur.user_id_user_role=u.id_user AND ur.role_id_user_role IN (${sql.join(changedRoles)}) AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL)`.execute(tx);
    const before = definitions.map((definition) => ({ code: definition.code, roleCodes: roles.filter((role) => grants.some((grant) => grant.role === role.id && grant.code === definition.code && grant.status === "active")).map((role) => role.code) }));
    const after = plans.map((plan) => ({ code: plan.definition.code, roleCodes: roles.filter((role) => plan.missing.some((missing) => missing.id === role.id) || grants.some((grant) => grant.role === role.id && grant.code === plan.definition.code && grant.status === "active")).map((role) => role.code) }));
    await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'role_permissions_replaced',${actor.id},'Permisos de consulta y marcado manual de adéndum registrados.','Marcado por defecto solo Jefe de Formalizaciones; consulta independiente; excepciones personales preservadas.',${JSON.stringify({ migration: formalizationManualAddendumMigration.name, moduleCode: "administration", sectionCode: "roles", actor: { publicId: actor.publicId, name: actor.name }, changeSet: { version: 1, entity: "permission", recordId: "formalizacion.addendum.manual", action: "update", before: { permissions: before }, after: { permissions: after } } })})`.execute(
        tx,
    );
}

/** MySQL confirma DDL implícitamente; si falla DML se conserva la nota compatible para reintentar sin backfill. */
export const formalizationManualAddendumMigration = {
    name: "202611030066_formalization_manual_addendum",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.connection().execute(async (connection) => {
            const statements = await planAddendumNoteColumn(connection, "native");
            await connection.transaction().execute((tx) => readPermissionPlan(tx));
            const original = (await sql<{ timeout: number }>`SELECT @@SESSION.lock_wait_timeout AS timeout`.execute(connection)).rows[0]?.timeout;
            if (!Number.isSafeInteger(original) || original === undefined || original < 1) throw new Error("Invalid metadata lock timeout");
            await sql`SET SESSION lock_wait_timeout=10`.execute(connection);
            try {
                for (const statement of statements) await sql.raw(statement).execute(connection);
                await connection.transaction().execute((tx) => applyPermissions(tx));
            } finally {
                await sql`SET SESSION lock_wait_timeout=${original}`.execute(connection);
            }
        });
    },
};
