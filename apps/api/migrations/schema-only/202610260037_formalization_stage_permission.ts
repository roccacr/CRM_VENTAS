import { type Kysely, sql } from "kysely";

const permission = {
    code: "formalizacion.orders.stage.update",
    module: "formalizacion",
    action: "stage_update",
    description: "Permite cambiar la etapa de una orden con tres aprobaciones completas; retrocesos requieren motivo; no envia correos ni modifica ERP.",
    status: "active",
} as const;

/** Independent permission only: no business-role grants, reactivation or user-version updates.
 * Owner's existing live all-active-permissions policy sees this permission without a new session.
 */
export const formalizationStagePermissionMigration = {
    name: "202610260037_formalization_stage_permission",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx);
            if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Formalization stage permission requires CRM_THINK_V2");
            const tables = await sql<{ table_name: string; table_type: string; engine: string }>`SELECT TABLE_NAME AS table_name,TABLE_TYPE AS table_type,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sec_permission'`.execute(tx);
            if (tables.rows.length !== 1 || !tables.rows.every((table) => table.table_name === "sec_permission" && table.table_type === "BASE TABLE" && table.engine === "InnoDB")) throw new Error("Formalization stage permission requires native InnoDB sec_permission");
            const existing = await sql<Record<string, unknown>>`SELECT code_permission AS code,module_code_permission AS module,action_code_permission AS action,description_permission AS description,status_permission AS status FROM sec_permission WHERE code_permission=${permission.code} FOR UPDATE`.execute(tx);
            if (existing.rows.length) {
                // Never silently reactivate or overwrite an independently managed definition.
                if (existing.rows.length !== 1 || !Object.entries(permission).every(([key, value]) => existing.rows[0]?.[key] === value)) throw new Error("Formalization stage permission conflicts with existing configuration; reconciliation required");
                return;
            }
            await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${permission.code},${permission.module},${permission.action},${permission.description},${permission.status})`.execute(tx);
        });
    },
};
