import { type Kysely, sql } from "kysely";

import { salesOrderBankAssignmentDdl } from "./202611030069_sales_order_bank_assignment.js";
import { assertBankSchemaDestination, normalizeBankDdl } from "./banks-schema.js";

export const salesOrderBankAssignmentUnlinkAlter = `ALTER TABLE crm_sales_order_bank_assignment
 MODIFY COLUMN bank_id_bank_assignment BIGINT UNSIGNED NULL COMMENT 'Banco nativo asignado a la gestion de la orden.',
 MODIFY COLUMN advisor_id_bank_assignment BIGINT UNSIGNED NULL COMMENT 'Ejecutivo nativo cuya pertenencia al banco valida la API.',
 ADD CONSTRAINT ck_crm_order_bank_assignment_pair CHECK ((bank_id_bank_assignment IS NULL AND advisor_id_bank_assignment IS NULL) OR (bank_id_bank_assignment IS NOT NULL AND advisor_id_bank_assignment IS NOT NULL))`;

/** La revisión final conserva todos los comentarios, índices y FK de069. */
export const salesOrderBankAssignmentUnlinkDdl = salesOrderBankAssignmentDdl
    .replace("bank_id_bank_assignment BIGINT UNSIGNED NOT NULL", "bank_id_bank_assignment BIGINT UNSIGNED DEFAULT NULL")
    .replace("advisor_id_bank_assignment BIGINT UNSIGNED NOT NULL", "advisor_id_bank_assignment BIGINT UNSIGNED DEFAULT NULL")
    .replace("\n) ENGINE=", ",\n CONSTRAINT ck_crm_order_bank_assignment_pair CHECK ((bank_id_bank_assignment IS NULL AND advisor_id_bank_assignment IS NULL) OR (bank_id_bank_assignment IS NOT NULL AND advisor_id_bank_assignment IS NOT NULL))\n) ENGINE=");

/** MySQL ordena CHECK por nombre; MariaDB conserva el orden de creación del ALTER. */
export const salesOrderBankAssignmentUnlinkMysqlDdl = salesOrderBankAssignmentUnlinkDdl.replace(/( CONSTRAINT ck_crm_order_bank_assignment_source CHECK [^\n]+),\n( CONSTRAINT ck_crm_order_bank_assignment_pair CHECK [^\n]+)/, "$2,\n$1");

/** MySQL8.4 explicita el COLLATE heredado en VARCHAR; conservar literales y COLLATE de tabla. */
function normalizeAssignmentDdl(ddl: string): string {
    return normalizeBankDdl(
        ddl
            .split(/('(?:''|[^'])*')/)
            .map((token, index) => (index % 2 ? token : token.replace(/\bCOLLATE\s+utf8mb4_unicode_ci\b/gi, "")))
            .join(""),
    );
}

/** Un único ALTER atómico permite recuperar fallos antes o después del DDL sin adoptar drift. */
export const salesOrderBankAssignmentUnlinkMigration = {
    name: "202611030071_sales_order_bank_assignment_unlink",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.connection().execute(async (connection) => {
            await assertBankSchemaDestination(connection, "CRM_THINK_V2");
            const actual = (await sql<Record<string, unknown>>`SHOW CREATE TABLE crm_sales_order_bank_assignment`.execute(connection)).rows[0]?.["Create Table"];
            if (typeof actual !== "string") throw new Error("Bank assignment schema missing");
            const normalized = normalizeAssignmentDdl(actual);
            if ([salesOrderBankAssignmentUnlinkDdl, salesOrderBankAssignmentUnlinkMysqlDdl].some((definition) => normalized === normalizeAssignmentDdl(definition))) return;
            if (normalized !== normalizeAssignmentDdl(salesOrderBankAssignmentDdl)) throw new Error("Bank assignment schema drift; expected original069 or final071");
            await sql`SET SESSION lock_wait_timeout=10`.execute(connection);
            await sql.raw(salesOrderBankAssignmentUnlinkAlter).execute(connection);
        });
    },
};
