import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const roleCodes = ["owner", "formalizacion", "jefe_formalizaciones", "jefe_general"] as const;
const permission = {
    code: "formalizacion.orders.addendum.update",
    module: "formalizacion",
    action: "update",
    description: "Gestionar estado de adéndum",
    status: "active",
} as const;
const requiredTables = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"] as const;
const columnNames = {
    native: ["addendum_status_sales_order", "addendum_version_sales_order", "addendum_changed_at_sales_order"],
    legacy: ["estado_adendum_ov", "version_adendum_ov", "fecha_adendum_ov"],
} as const;
type Column = { name: string; type: string; nullable: string; defaultValue: string | number | null; extra: string };
const targets = { native: { database: "CRM_THINK_V2", table: "crm_sales_order" }, legacy: { database: "crmdatabase-api", table: "ordenventa" } } as const;

/** El display width de MariaDB no cambia el entero; defaults o automatismos distintos sí cambian el contrato. */
function assertColumn(column: Column, index: number): void {
    const expectedType = ["enum('pending','completed','cancelled')", "int unsigned", "datetime(3)"][index];
    const value = index === 1 ? String(column.defaultValue) : column.defaultValue;
    const expectedDefault = index === 1 ? "0" : null;
    const validDefault = value === expectedDefault || (index !== 1 && value === "NULL");
    if (![index >= 0, column.type.replace(/^int\(\d+\) unsigned$/, "int unsigned") === expectedType, column.nullable === (index === 1 ? "NO" : "YES"), validDefault, column.extra === ""].every(Boolean)) throw new Error("Addendum column drift: " + column.name);
}

/** Revisa las tres columnas antes de construir un único ALTER; una discrepancia no deja cambios parciales. */
export async function planAddendumColumns(db: Kysely<unknown>, source: "native" | "legacy"): Promise<string[]> {
    const { database, table } = targets[source];
    if ((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name !== database) throw new Error("Addendum destination mismatch");
    const tables = (await sql<{ name: string; engine: string; kind: string }>`SELECT TABLE_NAME AS name,ENGINE AS engine,TABLE_TYPE AS kind FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table}`.execute(db)).rows;
    const metadata = tables.find((row) => row.name === table);
    if (metadata?.engine !== "InnoDB" || metadata.kind !== "BASE TABLE") throw new Error("Addendum requires an InnoDB base table");
    const names = columnNames[source];
    const existing = (await sql<Column>`SELECT COLUMN_NAME AS name,COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue,EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table} AND COLUMN_NAME IN (${sql.join(names)})`.execute(db)).rows;
    for (const column of existing) {
        const index = names.findIndex((name) => name === column.name);
        assertColumn(column, index);
    }
    const definitions = ["ENUM('pending','completed','cancelled') NULL DEFAULT NULL", "INT UNSIGNED NOT NULL DEFAULT 0", "DATETIME(3) NULL DEFAULT NULL"];
    const missing = names.flatMap((name, index) => (existing.some((column) => column.name === name) ? [] : [`ADD COLUMN \`${name}\` ${String(definitions[index])}`]));
    return missing.length ? [`ALTER TABLE \`${table}\` ${missing.join(", ")}, ALGORITHM=INSTANT`] : [];
}

/** Impide escrituras si el destino no contiene las tablas nativas transaccionales. */
async function assertNativeTables(tx: Kysely<unknown>): Promise<void> {
    const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx);
    if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Formalization order addendum permission requires CRM_THINK_V2");
    const tables = await sql<{ table_name: string; table_type: string; engine: string }>`SELECT TABLE_NAME AS table_name,TABLE_TYPE AS table_type,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(requiredTables)})`.execute(tx);
    if (tables.rows.length !== requiredTables.length || !requiredTables.every((name) => tables.rows.some((table) => table.table_name === name && table.table_type === "BASE TABLE" && table.engine === "InnoDB"))) throw new Error("Formalization order addendum permission requires native InnoDB security tables");
}

/** Exige los cuatro roles autorizados activos sin cambiar su política de herencia. */
async function readActiveRoles(tx: Kysely<unknown>): Promise<{ id: number; code: string }[]> {
    const roles = (await sql<{ id: number; code: string; status: string; deleted: Date | null }>`SELECT id_role AS id,code_role AS code,status_role AS status,deleted_at_role AS deleted FROM sec_role WHERE code_role IN (${sql.join(roleCodes)}) FOR UPDATE`.execute(tx)).rows;
    if (roles.length !== roleCodes.length || !roleCodes.every((code) => roles.filter((role) => role.code === code && role.status === "active" && !role.deleted).length === 1)) throw new Error("Formalization order addendum permission requires all authorized active roles");
    return roles;
}

/** Preserva definiciones administradas previamente y exige reconciliar cualquier discrepancia. */
async function readPermission(tx: Kysely<unknown>): Promise<boolean> {
    const existing = await sql<Record<string, unknown>>`SELECT code_permission AS code,module_code_permission AS module,action_code_permission AS action,description_permission AS description,status_permission AS status FROM sec_permission WHERE code_permission=${permission.code} FOR UPDATE`.execute(tx);
    if (existing.rows.length && (existing.rows.length !== 1 || !Object.entries(permission).every(([key, value]) => existing.rows[0]?.[key] === value))) throw new Error("Formalization order addendum permission conflicts with existing configuration; reconciliation required");
    return existing.rows.length === 1;
}

/** El mismo preflight se repite después del DDL para no aplicar permisos desde una fotografía obsoleta. */
async function readSecurityPlan(tx: Kysely<unknown>) {
    await assertNativeTables(tx);
    const roles = await readActiveRoles(tx);
    const permissionExists = await readPermission(tx);
    const grants = (await sql<{ role: number; code: string; status: string }>`SELECT rp.role_id_role_permission AS role,p.code_permission AS code,rp.status_role_permission AS status FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE p.code_permission=${permission.code} FOR UPDATE`.execute(tx)).rows;
    const missing = roles.filter((role) => !grants.some((grant) => grant.role === role.id));
    if (permissionExists && !missing.length) return null;
    const actor = (
        await sql<{
            id: number;
            publicId: string;
            name: string;
        }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)
    ).rows[0];
    if (!actor) throw new Error("Formalization order addendum permission requires Owner migration attribution");
    return { roles, permissionExists, grants, missing, actor };
}

/** DDL no transaccional en MySQL: no hace backfill y permite retomar una falla posterior sin perder estados. */
export const formalizationOrderAddendumMigration = {
    name: "202611030065_formalization_order_addendum",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.connection().execute(async (connection) => {
            const statements = await planAddendumColumns(connection, "native");
            // Todo el preflight de esquema, roles y auditoría precede al primer DDL; no equivale a una transacción común.
            await connection.transaction().execute((tx) => readSecurityPlan(tx));
            // INSTANT también espera metadata locks: se limita la espera en la misma conexión y se restaura al terminar.
            const original = (await sql<{ timeout: number }>`SELECT @@SESSION.lock_wait_timeout AS timeout`.execute(connection)).rows[0]?.timeout;
            if (!Number.isSafeInteger(original) || original === undefined || original < 1) throw new Error("Invalid metadata lock timeout");
            await sql`SET SESSION lock_wait_timeout=10`.execute(connection);
            try {
                for (const statement of statements) await sql.raw(statement).execute(connection);
                await connection.transaction().execute(async (tx) => {
                    const plan = await readSecurityPlan(tx);
                    if (!plan) return;
                    const { roles, permissionExists, grants, missing, actor } = plan;
                    if (!permissionExists) await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${permission.code},${permission.module},${permission.action},${permission.description},${permission.status})`.execute(tx);
                    for (const role of missing) await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) SELECT ${role.id},id_permission,'active' FROM sec_permission WHERE code_permission=${permission.code}`.execute(tx);
                    if (missing.length) await sql`UPDATE sec_user u SET permission_version_user=permission_version_user+1 WHERE EXISTS (SELECT 1 FROM sec_user_role ur WHERE ur.user_id_user_role=u.id_user AND ur.role_id_user_role IN (${sql.join(missing.map((role) => role.id))}) AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL)`.execute(tx);
                    await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'role_permissions_replaced',${actor.id},'Permiso Gestionar estado de adéndum habilitado para las órdenes de Formalización.','Asignación a Owner, Formalización, Jefe de Formalizaciones y Jefe General; excepciones individuales intactas.',${JSON.stringify({ migration: formalizationOrderAddendumMigration.name, moduleCode: "administration", sectionCode: "roles", actor: { publicId: actor.publicId, name: actor.name }, changeSet: { version: 1, entity: "permission", recordId: permission.code, action: permissionExists ? "update" : "create", before: { roleCodes: roles.filter((role) => grants.some((grant) => grant.role === role.id && grant.status === "active")).map((role) => role.code) }, after: { roleCodes: roles.filter((role) => missing.some((candidate) => candidate.id === role.id) || grants.some((grant) => grant.role === role.id && grant.status === "active")).map((role) => role.code) } } })})`.execute(
                        tx,
                    );
                });
            } finally {
                await sql`SET SESSION lock_wait_timeout=${original}`.execute(connection);
            }
        });
    },
};
