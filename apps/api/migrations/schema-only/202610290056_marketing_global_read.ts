import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

/** Add an assignable read-only capability. Existing roles and employee assignments are untouched. */
export const marketingGlobalReadMigration = {
    name: "202610290056_marketing_global_read",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            const database = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx)).rows[0];
            if (database?.name !== "CRM_THINK_V2") throw new Error("Marketing global read requires CRM_THINK_V2");
            const tables = (await sql<{ name: string; engine: string }>`SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('sec_permission','audit_security_event')`.execute(tx)).rows;
            if (tables.length !== 2 || tables.some((table) => table.engine !== "InnoDB")) throw new Error("Marketing global read requires transactional security tables");
            const existing = (await sql<{ module: string; action: string; status: string }>`SELECT module_code_permission AS module,action_code_permission AS action,status_permission AS status FROM sec_permission WHERE code_permission='mercadeo.reports.read_all' FOR UPDATE`.execute(tx)).rows[0];
            if (existing) {
                if (![existing.module === "mercadeo", existing.action === "read", existing.status === "active"].every(Boolean)) throw new Error("Global Marketing permission conflicts with existing configuration");
                return;
            }
            await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES ('mercadeo.reports.read_all','mercadeo','read','Consultar todos los vendedores en Inicio y Captacion de Mercadeo; requiere el permiso de lectura de cada vista. No permite editar datos ni acceder a otros modulos.','active')`.execute(tx);
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,reason_security_event,summary_security_event,metadata_security_event) VALUES (${ulid()},'permission_created','Migracion aditiva 056 autorizada para lectura global de Mercadeo.','Permiso de consulta global creado sin asignaciones automaticas.',${JSON.stringify({ migration: "202610290056_marketing_global_read", permission: "mercadeo.reports.read_all", automaticGrants: false })})`.execute(tx);
        });
    },
};
