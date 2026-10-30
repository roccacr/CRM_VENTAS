import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const operational = [
    "formalizacion.home.contracts.read",
    "formalizacion.home.banking.read",
    "formalizacion.home.balance.read",
    "formalizacion.home.transfer_pending.read",
    "formalizacion.home.transfer_signed.read",
    "formalizacion.home.closed.read",
    "formalizacion.orders.read",
    "formalizacion.contracts.send",
    "formalizacion.contracts.revert",
    "formalizacion.orders.stage.update",
    ...["contract_pending_send", "contract_pending_signature", "bank_management", "pending_balance", "pending_transfer", "transfer_signed", "closed"].map((stage) => `formalizacion.orders.stage.${stage}`),
];
/** Baselines contain implemented commands only; approvals and exceptional movement stay supervisory. */
export const formalizationRolePermissions: Readonly<Record<"formalizacion" | "jefe_formalizaciones", readonly string[]>> = {
    formalizacion: operational,
    jefe_formalizaciones: [...operational, "formalizacion.home.approvals.read", "formalizacion.orders.approve", "formalizacion.orders.stage.skip"],
};
const tables = ["sec_role", "sec_permission", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"];
type Grant = { role: number; code: string; status: string };

/** Only existing active native definitions can be provisioned; never repair drift by reviving access. */
async function preflight(tx: Kysely<unknown>) {
    const destinations = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx)).rows;
    if (!destinations.some(({ name }) => name === "CRM_THINK_V2")) throw new Error("Formalization workflow grants require CRM_THINK_V2");
    const inventory = (await sql<{ table_name: string; table_type: string; engine: string }>`SELECT TABLE_NAME AS table_name,TABLE_TYPE AS table_type,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(tables)})`.execute(tx)).rows;
    if (inventory.length !== tables.length || !tables.every((name) => inventory.some((table) => table.table_name === name && table.table_type === "BASE TABLE" && table.engine === "InnoDB"))) throw new Error("Formalization workflow grants require native InnoDB security tables");
    const roles = (await sql<{ id: number; code: string; status: string; deleted: Date | null }>`SELECT id_role AS id,code_role AS code,status_role AS status,deleted_at_role AS deleted FROM sec_role WHERE code_role IN (${sql.join(Object.keys(formalizationRolePermissions))}) FOR UPDATE`.execute(tx)).rows;
    if (roles.length !== 2 || !Object.keys(formalizationRolePermissions).every((code) => roles.filter((role) => role.code === code && role.status === "active" && !role.deleted).length === 1)) throw new Error("Both active Formalization workflow roles are required");
    const codes = [...new Set(Object.values(formalizationRolePermissions).flat())];
    const permissions = (await sql<{ id: number; code: string; module: string; status: string }>`SELECT id_permission AS id,code_permission AS code,module_code_permission AS module,status_permission AS status FROM sec_permission WHERE code_permission IN (${sql.join(codes)}) FOR UPDATE`.execute(tx)).rows;
    if (permissions.length !== codes.length || !codes.every((code) => permissions.filter((permission) => permission.code === code && permission.module === "formalizacion" && permission.status === "active").length === 1)) throw new Error("Active Formalization permission definitions are incomplete or conflicting");
    return { roles, codes };
}

/** Add missing baseline grants without overwriting revocations, user overrides or any business data. */
export const formalizationRoleWorkflowsMigration = {
    name: "202610280049_formalization_role_workflows",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            const { roles, codes } = await preflight(tx);
            const grants = (await sql<Grant>`SELECT rp.role_id_role_permission AS role,p.code_permission AS code,rp.status_role_permission AS status FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE rp.role_id_role_permission IN (${sql.join(roles.map((role) => role.id))}) AND p.code_permission IN (${sql.join(codes)}) FOR UPDATE`.execute(tx)).rows;
            const missing = roles.flatMap((role) => formalizationRolePermissions[role.code as keyof typeof formalizationRolePermissions].filter((code) => !grants.some((grant) => grant.role === role.id && grant.code === code)).map((code) => ({ role: role.id, code })));
            if (!missing.length) return;
            const actor = (
                await sql<{
                    id: number;
                    publicId: string;
                    name: string;
                }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)
            ).rows[0];
            if (!actor) throw new Error("Formalization workflow grants require Owner audit attribution");
            for (const grant of missing) await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) SELECT ${grant.role},id_permission,'active' FROM sec_permission WHERE code_permission=${grant.code}`.execute(tx);
            // Owner/module inheritance and direct overrides can affect users outside the two direct role assignments.
            await sql`UPDATE sec_user SET permission_version_user=permission_version_user+1 WHERE status_user='active' AND deleted_at_user IS NULL`.execute(tx);
            const before = grants.filter((grant) => grant.status === "active").map(({ role, code }) => ({ role, code }));
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'role_permissions_replaced',${actor.id},'Roles de Formalización preparados para gestión y supervisión.','Ambos roles gestionan todas las órdenes con el permiso correspondiente; se preservan denegaciones y configuraciones independientes.',${JSON.stringify({ migration: formalizationRoleWorkflowsMigration.name, moduleCode: "administration", sectionCode: "roles", actor: { publicId: actor.publicId, name: actor.name }, changeSet: { version: 1, entity: "role", recordId: "formalization-workflows", action: "update", before: { grants: before }, after: { grants: [...before, ...missing] } } })})`.execute(
                tx,
            );
        });
    },
};
