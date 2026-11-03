import { type Kysely, sql } from "kysely";

import { assertBankSchemaDestination, normalizeBankDdl } from "./banks-schema.js";

/** Identidad canonica: una orden legacy no requiere importar su registro comercial. */
export const salesOrderBankAssignmentDdl = `CREATE TABLE crm_sales_order_bank_assignment (
 source_bank_assignment VARCHAR(6) NOT NULL COMMENT 'Origen canonico nativo o legacy de la orden.',
 order_id_bank_assignment VARCHAR(26) NOT NULL COMMENT 'Identificador canonico de la orden en su origen.',
 bank_id_bank_assignment BIGINT UNSIGNED NOT NULL COMMENT 'Banco nativo asignado a la gestion de la orden.',
 advisor_id_bank_assignment BIGINT UNSIGNED NOT NULL COMMENT 'Ejecutivo nativo cuya pertenencia al banco valida la API.',
 version_bank_assignment INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Version de concurrencia optimista de la asignacion.',
 changed_by_user_id_bank_assignment BIGINT UNSIGNED NOT NULL COMMENT 'Usuario nativo responsable de la ultima asignacion.',
 changed_at_bank_assignment DATETIME(3) NOT NULL COMMENT 'Fecha UTC de la ultima asignacion bancaria.',
 PRIMARY KEY (source_bank_assignment,order_id_bank_assignment),
 KEY ix_crm_order_bank_assignment_bank (bank_id_bank_assignment),
 KEY ix_crm_order_bank_assignment_advisor (advisor_id_bank_assignment),
 KEY ix_crm_order_bank_assignment_actor (changed_by_user_id_bank_assignment),
 CONSTRAINT fk_crm_order_bank_assignment_actor FOREIGN KEY (changed_by_user_id_bank_assignment) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_crm_order_bank_assignment_advisor FOREIGN KEY (advisor_id_bank_assignment) REFERENCES crm_bank_advisor (id_bank_advisor) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_crm_order_bank_assignment_bank FOREIGN KEY (bank_id_bank_assignment) REFERENCES crm_bank (id_bank) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT ck_crm_order_bank_assignment_source CHECK (source_bank_assignment IN ('native','legacy'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Asignacion bancaria central por identidad canonica de orden.'`;

/** DDL recuperable; un retry verifica el contrato completo y nunca adopta divergencias. */
export const salesOrderBankAssignmentMigration = {
    name: "202611030069_sales_order_bank_assignment",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.connection().execute(async (connection) => {
            await assertBankSchemaDestination(connection, "CRM_THINK_V2");
            const tables = (await sql<{ table_name: string; table_type: string; engine: string; collation: string }>`SELECT TABLE_NAME AS table_name,TABLE_TYPE AS table_type,ENGINE AS engine,TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('crm_bank','crm_bank_advisor','sec_user','crm_sales_order_bank_assignment')`.execute(connection)).rows;
            const parents = ["crm_bank", "crm_bank_advisor", "sec_user"];
            if (!parents.every((name) => tables.some((table) => table.table_name === name && table.table_type === "BASE TABLE" && table.engine === "InnoDB"))) throw new Error("Bank assignment requires native InnoDB parent tables");
            const existing = tables.find((table) => table.table_name === "crm_sales_order_bank_assignment");
            if (existing) {
                if ([existing.table_type, existing.engine, existing.collation].join(":") !== "BASE TABLE:InnoDB:utf8mb4_unicode_ci") throw new Error("Bank assignment schema drift");
                const actual = (await sql<Record<string, unknown>>`SHOW CREATE TABLE crm_sales_order_bank_assignment`.execute(connection)).rows[0]?.["Create Table"];
                if (typeof actual !== "string" || normalizeBankDdl(actual) !== normalizeBankDdl(salesOrderBankAssignmentDdl)) throw new Error("Bank assignment schema drift; reconcile explicitly before retry");
                return;
            }
            await sql`SET SESSION lock_wait_timeout=10`.execute(connection);
            await sql.raw(salesOrderBankAssignmentDdl).execute(connection);
        });
    },
};
