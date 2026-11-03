import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

import { assertBankSchemaDestination, planBankTables } from "./banks-schema.js";

const roleCodes = ["owner", "jefe_general"] as const;
const requiredTables = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"] as const;
const actions = { read: "Ver bancos y ejecutivos", create: "Crear bancos y ejecutivos", update: "Editar bancos y ejecutivos", inactivate: "Inactivar bancos y ejecutivos" } as const;
const permissions = ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"].flatMap((module) => Object.entries(actions).map(([action, description]) => ({ code: `${module}.catalog_bank.${action}`, module, action, description, status: "active" })));

/** Rechaza definiciones previas divergentes en vez de sobrescribir politica administrada. */
function assertPermissions(existing: Record<string, unknown>[]): void {
    for (const permission of permissions) {
        const matches = existing.filter((row) => row.code === permission.code);
        if (matches.length > 1 || (matches.length === 1 && !Object.entries(permission).every(([key, value]) => matches[0]?.[key] === value))) throw new Error(`Banks permission drift: ${permission.code}`);
    }
}

/** Exige seguridad nativa transaccional y atribucion Owner antes del primer DDL. */
async function preflightSecurity(db: Kysely<unknown>) {
    await assertBankSchemaDestination(db, "CRM_THINK_V2");
    const tables = (await sql<{ table_name: string; table_type: string; engine: string }>`SELECT TABLE_NAME AS table_name,TABLE_TYPE AS table_type,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(requiredTables)})`.execute(db)).rows;
    if (tables.length !== requiredTables.length || !requiredTables.every((name) => tables.some((table) => table.table_name === name && table.table_type === "BASE TABLE" && table.engine === "InnoDB"))) throw new Error("Banks migration requires native InnoDB security tables");
    const roles = (await sql<{ id: number; code: string; status: string; deleted: Date | null }>`SELECT id_role AS id,code_role AS code,status_role AS status,deleted_at_role AS deleted FROM sec_role WHERE code_role IN (${sql.join(roleCodes)}) FOR UPDATE`.execute(db)).rows;
    if (roles.length !== 2 || !roleCodes.every((code) => roles.some((role) => role.code === code && role.status === "active" && !role.deleted))) throw new Error("Banks migration requires active Owner and Jefe General roles");
    const actor = (
        await sql<{
            id: number;
            publicId: string;
            name: string;
        }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(db)
    ).rows[0];
    if (!actor) throw new Error("Banks migration requires Owner audit attribution");
    const existing = (await sql<Record<string, unknown>>`SELECT code_permission AS code,module_code_permission AS module,action_code_permission AS action,description_permission AS description,status_permission AS status FROM sec_permission WHERE code_permission IN (${sql.join(permissions.map((permission) => permission.code))}) FOR UPDATE`.execute(db)).rows;
    assertPermissions(existing);
    return { actor, roles, existing };
}

/** DDL recuperable separado de DML atomico: un fallo de auditoria nunca deja grants parciales. */
export const banksAndAdvisorsMigration = {
    name: "202611030068_banks_and_advisors",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.connection().execute(async (connection) => {
            // MySQL DDL confirma implicitamente. Nunca abrir una transaccion que mezcle DDL y grants.
            await sql`SET SESSION lock_wait_timeout=10`.execute(connection);
            await preflightSecurity(connection);
            const statements = await planBankTables(connection, "CRM_THINK_V2");
            await sql`SET SESSION time_zone='+00:00'`.execute(connection);
            for (const statement of statements) await sql.raw(statement).execute(connection);
            await connection.transaction().execute(async (tx) => {
                const { actor, roles, existing } = await preflightSecurity(tx);
                const grants = (await sql<{ role: number; code: string; status: string }>`SELECT rp.role_id_role_permission AS role,p.code_permission AS code,rp.status_role_permission AS status FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE p.code_permission IN (${sql.join(permissions.map((permission) => permission.code))}) FOR UPDATE`.execute(tx)).rows;
                const missing = permissions.flatMap((permission) => roles.filter((role) => !grants.some((grant) => grant.role === role.id && grant.code === permission.code)).map((role) => ({ role: role.id, roleCode: role.code, code: permission.code })));
                const created = permissions.filter((permission) => !existing.some((row) => row.code === permission.code));
                if (!created.length && !missing.length) return;
                for (const permission of created) await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${permission.code},${permission.module},${permission.action},${permission.description},${permission.status})`.execute(tx);
                for (const grant of missing) await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) SELECT ${grant.role},id_permission,'active' FROM sec_permission WHERE code_permission=${grant.code}`.execute(tx);
                // Owner puede heredar permisos: invalida snapshots activos sin alterar membresias ni techos.
                if (missing.length) await sql`UPDATE sec_user SET permission_version_user=permission_version_user+1 WHERE status_user='active' AND deleted_at_user IS NULL`.execute(tx);
                await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'role_permissions_replaced',${actor.id},'Permisos de bancos y ejecutivos registrados.','Catalogo autorizado exclusivamente para Owner y Jefe General; excepciones intactas.',${JSON.stringify({ migration: banksAndAdvisorsMigration.name, moduleCode: "administration", sectionCode: "roles", actor: { publicId: actor.publicId, name: actor.name }, createdPermissionCodes: created.map((permission) => permission.code), createdGrants: missing, changeSet: { version: 1, entity: "permission", recordId: "catalog_bank", action: "update", before: { grants }, after: { createdGrants: missing } } })})`.execute(
                    tx,
                );
            });
        });
    },
};
