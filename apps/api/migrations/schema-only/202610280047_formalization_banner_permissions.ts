import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const umbrella = "formalizacion.home.stages.read";
export const formalizationBannerPermissions = (
    [
        ["contracts", "Ver contratos de Formalización"],
        ["banking", "Ver gestión bancaria de Formalización"],
        ["balance", "Ver pendientes de saldo de Formalización"],
        ["transfer_pending", "Ver traspasos pendientes de Formalización"],
        ["transfer_signed", "Ver traspasos firmados de Formalización"],
        ["closed", "Ver cierres anuales de Formalización"],
    ] as const
).map(([category, description]) => ({ code: `formalizacion.home.${category}.read`, module: "formalizacion", action: "read", description, status: "active" }));
const requiredTables = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "sec_user_permission_override", "audit_security_event"];
type Definition = { id: number; code: string; module: string; action: string; description: string; status: string };
type RoleGrant = { id: number; role: number; permission: number; status: string; created: Date };
type Override = { id: number; user: number; permission: number; effect: string; reason: string; status: string; starts: Date; ends: Date | null; creator: number | null; created: Date; revoker: number | null; revoked: Date | null };

/** Reject cross-database and nontransactional destinations before any writes. */
async function assertNativeTables(tx: Kysely<unknown>): Promise<void> {
    const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx);
    if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Formalization banner permissions require CRM_THINK_V2");
    const tables = await sql<{ table_name: string; table_type: string; engine: string }>`SELECT TABLE_NAME AS table_name,TABLE_TYPE AS table_type,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(requiredTables)})`.execute(tx);
    if (tables.rows.length !== requiredTables.length || !requiredTables.every((name) => tables.rows.some((table) => table.table_name === name && table.table_type === "BASE TABLE" && table.engine === "InnoDB"))) throw new Error("Formalization banner permissions require native InnoDB security tables");
}

/** Validate all definitions before provisioning or retiring permissions. */
async function readDefinitions(tx: Kysely<unknown>): Promise<{ definitions: Definition[]; source: Definition }> {
    const definitions = (await sql<Definition>`SELECT id_permission AS id,code_permission AS code,module_code_permission AS module,action_code_permission AS action,description_permission AS description,status_permission AS status FROM sec_permission WHERE code_permission IN (${sql.join([umbrella, ...formalizationBannerPermissions.map((p) => p.code)])}) FOR UPDATE`.execute(tx)).rows;
    const sources = definitions.filter((p) => p.code === umbrella);
    const source = sources[0];
    if (sources.length !== 1 || !source || !["active", "inactive"].includes(source.status)) throw new Error("Missing or conflicting umbrella permission; reconciliation required");
    for (const definition of formalizationBannerPermissions) {
        const existing = definitions.filter((p) => p.code === definition.code);
        if (existing.length > 1 || existing.some((p) => !Object.entries(definition).every(([key, value]) => p[key as keyof Definition] === value))) throw new Error("Conflicting banner permission definition; reconciliation required");
    }
    return { definitions, source };
}

/** Preserve each principal's complete existing configuration; otherwise copy all source history. */
async function copyHistory(tx: Kysely<unknown>, sourceId: number, targetId: number, { grants, overrides }: { grants: RoleGrant[]; overrides: Override[] }): Promise<void> {
    for (const grant of grants.filter((g) => g.permission === sourceId)) {
        if (grants.some((g) => g.permission === targetId && g.role === grant.role)) continue;
        await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission,created_at_role_permission) VALUES (${grant.role},${targetId},${grant.status},${grant.created})`.execute(tx);
    }
    for (const override of overrides.filter((o) => o.permission === sourceId)) {
        if (overrides.some((o) => o.permission === targetId && o.user === override.user)) continue;
        await sql`INSERT INTO sec_user_permission_override (user_id_user_permission_override,permission_id_user_permission_override,effect_user_permission_override,reason_user_permission_override,status_user_permission_override,starts_at_user_permission_override,ends_at_user_permission_override,created_by_user_id_user_permission_override,created_at_user_permission_override,revoked_by_user_id_user_permission_override,revoked_at_user_permission_override) VALUES (${override.user},${targetId},${override.effect},${override.reason},${override.status},${override.starts},${override.ends},${override.creator},${override.created},${override.revoker},${override.revoked})`.execute(
            tx,
        );
    }
}

/** Replace the retired umbrella without reviving independently revoked granular access.
 * The transaction copies complete histories only for principals lacking any granular configuration.
 */
export const formalizationBannerPermissionsMigration = {
    name: "202610280047_formalization_banner_permissions",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            await assertNativeTables(tx);
            const { definitions, source } = await readDefinitions(tx);
            // An inactive source is the completion marker. Never resurrect deleted granular grants.
            if (source.status === "inactive") {
                if (definitions.length !== 7) throw new Error("Retired umbrella has incomplete banner definitions; reconciliation required");
                return;
            }
            const actor = (
                await sql<{
                    id: number;
                    publicId: string;
                    name: string;
                }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)
            ).rows[0];
            if (!actor) throw new Error("Formalization banner permissions require Owner migration attribution");
            const grants = (await sql<RoleGrant>`SELECT id_role_permission AS id,role_id_role_permission AS role,permission_id_role_permission AS permission,status_role_permission AS status,created_at_role_permission AS created FROM sec_role_permission WHERE permission_id_role_permission IN (${sql.join(definitions.map((p) => p.id))}) FOR UPDATE`.execute(tx)).rows;
            const overrides = (
                await sql<Override>`SELECT id_user_permission_override AS id,user_id_user_permission_override AS user,permission_id_user_permission_override AS permission,effect_user_permission_override AS effect,reason_user_permission_override AS reason,status_user_permission_override AS status,starts_at_user_permission_override AS starts,ends_at_user_permission_override AS ends,created_by_user_id_user_permission_override AS creator,created_at_user_permission_override AS created,revoked_by_user_id_user_permission_override AS revoker,revoked_at_user_permission_override AS revoked FROM sec_user_permission_override WHERE permission_id_user_permission_override IN (${sql.join(definitions.map((p) => p.id))}) FOR UPDATE`.execute(
                    tx,
                )
            ).rows;
            for (const definition of formalizationBannerPermissions) {
                let target = definitions.find((p) => p.code === definition.code);
                if (!target) {
                    await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${definition.code},${definition.module},${definition.action},${definition.description},${definition.status})`.execute(tx);
                    target = (await sql<Definition>`SELECT id_permission AS id,code_permission AS code,module_code_permission AS module,action_code_permission AS action,description_permission AS description,status_permission AS status FROM sec_permission WHERE code_permission=${definition.code} FOR UPDATE`.execute(tx)).rows.find((p) => p.code === definition.code);
                    if (!target) throw new Error("Inserted banner permission cannot be resolved");
                }
                await copyHistory(tx, source.id, target.id, { grants, overrides });
            }
            await sql`UPDATE sec_permission SET status_permission='inactive',updated_at_permission=CURRENT_TIMESTAMP WHERE id_permission=${source.id}`.execute(tx);
            await sql`UPDATE sec_user SET permission_version_user=permission_version_user+1 WHERE status_user='active' AND deleted_at_user IS NULL`.execute(tx);
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'role_permissions_replaced',${actor.id},'Lectura de Formalización separada por banner.','Sustitución del permiso agregado; configuración granular y denegaciones preservadas.',${JSON.stringify({ migration: formalizationBannerPermissionsMigration.name, moduleCode: "administration", sectionCode: "roles", actor: { publicId: actor.publicId, name: actor.name }, changeSet: { version: 1, entity: "permission", recordId: umbrella, action: "update", before: { permissionCodes: [umbrella] }, after: { permissionCodes: formalizationBannerPermissions.map((p) => p.code) } } })})`.execute(
                tx,
            );
        });
    },
};
