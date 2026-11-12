import { type Kysely, sql } from "kysely";

/** El saldo es una decisión financiera nueva: nunca se infiere de reserva ni de preparación histórica. */
export const finiquitoWorkflowMigration = {
    name: "202611120076_finiquito_workflow",
    async up(db: Kysely<unknown>): Promise<void> {
        await sql`ALTER TABLE crm_sales_order
            ADD COLUMN balance_validated_sales_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
            ADD COLUMN balance_validated_by_sales_order CHAR(26) NULL,
            ADD COLUMN balance_validated_at_sales_order DATETIME(3) NULL,
            ADD COLUMN finiquito_sent_sales_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
            ADD COLUMN finiquito_sent_by_sales_order CHAR(26) NULL,
            ADD COLUMN finiquito_sent_at_sales_order DATETIME(3) NULL,
            ADD COLUMN finiquito_received_sales_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
            ADD COLUMN finiquito_received_by_sales_order CHAR(26) NULL,
            ADD COLUMN finiquito_received_at_sales_order DATETIME(3) NULL`.execute(db);
        await restoreHistoricalFiniquito(db, "native");
    },
    async down(db: Kysely<unknown>): Promise<void> {
        await sql`ALTER TABLE crm_sales_order
            DROP COLUMN balance_validated_sales_order, DROP COLUMN balance_validated_by_sales_order, DROP COLUMN balance_validated_at_sales_order,
            DROP COLUMN finiquito_sent_sales_order, DROP COLUMN finiquito_sent_by_sales_order, DROP COLUMN finiquito_sent_at_sales_order,
            DROP COLUMN finiquito_received_sales_order, DROP COLUMN finiquito_received_by_sales_order, DROP COLUMN finiquito_received_at_sales_order`.execute(db);
    },
};

/** Solo para una aplicación legacy explícitamente autorizada; el runner nativo no llama esta función. */
export async function applyLegacyFiniquitoWorkflow(db: Kysely<unknown>): Promise<void> {
    await sql`ALTER TABLE \`crmdatabase-api\`.ordenventa
        ADD COLUMN saldo_validado_ov TINYINT UNSIGNED NOT NULL DEFAULT 0,
        ADD COLUMN saldo_validado_por_ov CHAR(26) NULL,
        ADD COLUMN saldo_validado_fecha_ov DATETIME(3) NULL,
        ADD COLUMN finiquito_enviado_ov TINYINT UNSIGNED NOT NULL DEFAULT 0,
        ADD COLUMN finiquito_enviado_por_ov CHAR(26) NULL,
        ADD COLUMN finiquito_enviado_fecha_ov DATETIME(3) NULL,
        ADD COLUMN finiquito_recibido_ov TINYINT UNSIGNED NOT NULL DEFAULT 0,
        ADD COLUMN finiquito_recibido_por_ov CHAR(26) NULL,
        ADD COLUMN finiquito_recibido_fecha_ov DATETIME(3) NULL`.execute(db);
    await restoreHistoricalFiniquito(db, "legacy");
}

/** Requiere respaldo y escritores detenidos; no borra la bitácora central. */
export async function rollbackLegacyFiniquitoWorkflow(db: Kysely<unknown>): Promise<void> {
    await sql`ALTER TABLE \`crmdatabase-api\`.ordenventa
        DROP COLUMN saldo_validado_ov, DROP COLUMN saldo_validado_por_ov, DROP COLUMN saldo_validado_fecha_ov,
        DROP COLUMN finiquito_enviado_ov, DROP COLUMN finiquito_enviado_por_ov, DROP COLUMN finiquito_enviado_fecha_ov,
        DROP COLUMN finiquito_recibido_ov, DROP COLUMN finiquito_recibido_por_ov, DROP COLUMN finiquito_recibido_fecha_ov`.execute(db);
}

/** Conserva envío/firma ya documentados, con su primera evidencia real; NO valida saldo de forma automática. */
async function restoreHistoricalFiniquito(db: Kysely<unknown>, destination: "native" | "legacy"): Promise<void> {
    const spec = historicalColumns[destination];
    for (const step of spec.steps) {
        await sql`UPDATE ${sql.table(spec.table)} o JOIN audit_record r ON ${spec.identity}
            JOIN audit_record_event e ON e.record_id_record_event=r.id_record AND e.module_record_event='formalizacion.finiquito' AND ${historicalStatus("e", step.states)}
            SET ${sql.ref("o." + step.flag)}=1,${sql.ref("o." + step.actor)}=CASE WHEN CHAR_LENGTH(e.actor_reference_record_event)=26 THEN e.actor_reference_record_event ELSE NULL END,
                ${sql.ref("o." + step.at)}=e.recorded_at_record_event
            WHERE NOT EXISTS (SELECT 1 FROM audit_record_event earlier WHERE earlier.record_id_record_event=e.record_id_record_event AND earlier.module_record_event=e.module_record_event
                AND earlier.sequence_record_event<e.sequence_record_event AND ${historicalStatus("earlier", step.states)})`.execute(db);
    }
}

function historicalStatus(alias: string, states: readonly string[]) {
    return sql`JSON_UNQUOTE(JSON_EXTRACT(${sql.ref(alias + ".after_record_event")},'$.finiquitoStatus')) IN (${sql.join(states)})`;
}

const historicalColumns = {
    native: {
        table: "crm_sales_order",
        identity: sql`r.source_schema_record=IF(o.id_old_produccion_sales_order IS NULL,'CRM_THINK_V2','crmdatabase-api')
            AND r.source_table_record=IF(o.id_old_produccion_sales_order IS NULL,'crm_sales_order','ordenventa')
            AND r.source_id_record=CAST(COALESCE(o.id_old_produccion_sales_order,o.id_sales_order) AS CHAR)`,
        steps: [
            { flag: "finiquito_sent_sales_order", actor: "finiquito_sent_by_sales_order", at: "finiquito_sent_at_sales_order", states: ["sent", "signed"] },
            { flag: "finiquito_received_sales_order", actor: "finiquito_received_by_sales_order", at: "finiquito_received_at_sales_order", states: ["signed"] },
        ],
    },
    legacy: {
        table: "crmdatabase-api.ordenventa",
        identity: sql`r.source_schema_record='crmdatabase-api' AND r.source_table_record='ordenventa' AND r.source_id_record=CAST(o.id_ov AS CHAR)`,
        steps: [
            { flag: "finiquito_enviado_ov", actor: "finiquito_enviado_por_ov", at: "finiquito_enviado_fecha_ov", states: ["sent", "signed"] },
            { flag: "finiquito_recibido_ov", actor: "finiquito_recibido_por_ov", at: "finiquito_recibido_fecha_ov", states: ["signed"] },
        ],
    },
} as const;
