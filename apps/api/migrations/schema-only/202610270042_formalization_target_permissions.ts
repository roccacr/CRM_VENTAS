import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const permissions = [
    ["formalizacion.orders.stage.pending_approval", "Devolver a pendientes de aprobación"],
    ["formalizacion.orders.stage.contract_pending_send", "Pasar a Por enviar"],
    ["formalizacion.orders.stage.contract_pending_signature", "Pasar a Pendiente de firma"],
    ["formalizacion.orders.stage.bank_management", "Pasar a Gestión bancaria"],
    ["formalizacion.orders.stage.pending_balance", "Pasar a Pendiente de saldo"],
    ["formalizacion.orders.stage.pending_transfer", "Pasar a Traspaso pendiente"],
    ["formalizacion.orders.stage.transfer_signed", "Pasar a Traspaso firmado"],
    ["formalizacion.orders.stage.closed", "Cerrar Formalización"],
    ["formalizacion.orders.stage.update", "Cambiar etapa de Formalización"],
    ["formalizacion.contracts.send", "Registrar envío de contrato"],
    ["formalizacion.contracts.revert", "Revertir envío de contrato"],
] as const;

/** Existing revoked/differently scoped grants are never silently reactivated. */
async function ensurePermission(tx: Kysely<unknown>, code: string, action: string, description: string): Promise<void> {
    const found = await sql<{ module: string; action: string; status: string }>`SELECT module_code_permission AS module, action_code_permission AS action, status_permission AS status FROM sec_permission WHERE code_permission=${code} FOR UPDATE`.execute(tx);
    const current = found.rows[0];
    if (current && (current.module !== "formalizacion" || current.action !== action || current.status !== "active")) throw new Error("Contract permission conflicts with existing configuration");
    if (!current) await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${code},'formalizacion',${action},${description},'active')`.execute(tx);
}

/** Migration must not recreate or reactivate a retired business role. */
async function activeFormalizationRole(tx: Kysely<unknown>) {
    const role = (await sql<{ id: number; status: string; deleted: Date | null }>`SELECT id_role AS id,status_role AS status,deleted_at_role AS deleted FROM sec_role WHERE code_role='formalizacion' FOR UPDATE`.execute(tx)).rows[0];
    if (!role || role.status !== "active" || role.deleted) throw new Error("Contract permissions require active Formalizacion role");
    return role;
}

async function grantTarget(tx: Kysely<unknown>, roleId: number, grants: readonly { code: string; status: string }[], definition: readonly [string, string]): Promise<boolean> {
    const [code, label] = definition;
    const existing = (await sql<{ status: string; module: string }>`SELECT status_permission AS status,module_code_permission AS module FROM sec_permission WHERE code_permission=${code} FOR UPDATE`.execute(tx)).rows[0];
    if (existing && (existing.status !== "active" || existing.module !== "formalizacion")) throw new Error("Permission conflict requires reconciliation");
    if (!existing) await ensurePermission(tx, code, code.slice(code.lastIndexOf(".") + 1), label + "; sujeto a reglas de negocio y bitácora, sin envío de correo ni escritura ERP.");
    const grant = grants.find((g) => g.code === code);
    if (grant?.status === "active") return false;
    if (grant) throw new Error("Revoked role grant requires explicit reconciliation");
    await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) SELECT ${roleId},id_permission,'active' FROM sec_permission WHERE code_permission=${code}`.execute(tx);
    return true;
}

/** Owner-authorized per-destination role grants; individual overrides remain untouched. */
export const formalizationTargetPermissionsMigration = {
    name: "202610270042_formalization_target_permissions",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx);
            if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Contract permissions require CRM_THINK_V2");
            const role = await activeFormalizationRole(tx);
            const actor = (
                await sql<{
                    id: number;
                    publicId: string;
                    name: string;
                }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1`.execute(tx)
            ).rows[0];
            if (!actor) throw new Error("Contract permissions require Owner migration attribution");
            const grants = await sql<{ code: string; status: string }>`SELECT p.code_permission AS code,rp.status_role_permission AS status FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE rp.role_id_role_permission=${role.id} FOR UPDATE`.execute(tx);
            let changed = false;
            for (const [code, label] of permissions) {
                if (await grantTarget(tx, role.id, grants.rows, [code, label])) changed = true;
            }
            if (!changed) return;
            await sql`UPDATE sec_user u SET permission_version_user=permission_version_user+1 WHERE EXISTS (SELECT 1 FROM sec_user_role ur WHERE ur.user_id_user_role=u.id_user AND ur.role_id_user_role=${role.id} AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL)`.execute(tx);
            const before = grants.rows
                .filter((grant) => grant.status === "active")
                .map((grant) => grant.code)
                .sort();
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'role_permissions_replaced',${actor.id},'Permisos por etapa habilitados para Formalizacion.','Asignación por etapa y rol autorizada por el propietario; denegaciones individuales intactas.',${JSON.stringify({ migration: formalizationTargetPermissionsMigration.name, moduleCode: "administration", sectionCode: "roles", roleCode: "formalizacion", actor: { publicId: actor.publicId, name: actor.name }, changeSet: { version: 1, entity: "role", recordId: "formalizacion", action: "update", before: { permissionCodes: before }, after: { permissionCodes: [...new Set([...before, ...permissions.map(([code]) => code)])].sort() } } })})`.execute(
                tx,
            );
        });
    },
};
