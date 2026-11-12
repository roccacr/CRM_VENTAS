import { type Kysely, sql } from "kysely";

/** Reserva durable independiente del commit de la etapa; no contiene FK al padre bloqueado. */
export const orderWorkflowExecutionMigration = {
    name: "202611120077_order_workflow_execution",
    async up(db: Kysely<unknown>): Promise<void> {
        await sql`CREATE TABLE int_order_workflow_execution (
            id_order_workflow_execution CHAR(26) NOT NULL COMMENT 'Identificador del intento durable',
            environment_order_workflow_execution VARCHAR(16) NOT NULL COMMENT 'Entorno externo autorizado',
            external_id_order_workflow_execution VARCHAR(20) NOT NULL COMMENT 'Referencia externa de la orden',
            action_order_workflow_execution VARCHAR(64) NOT NULL COMMENT 'Accion de negocio unidad traspasada',
            actor_order_workflow_execution CHAR(26) NOT NULL COMMENT 'Usuario autenticado que solicita la accion',
            operation_order_workflow_execution VARCHAR(64) NOT NULL COMMENT 'Operacion idempotente del comando',
            correlation_order_workflow_execution CHAR(26) NOT NULL COMMENT 'Correlacion con la bitacora de etapa',
            status_order_workflow_execution VARCHAR(16) NOT NULL COMMENT 'pending confirmed o unknown; unknown requiere conciliacion',
            result_order_workflow_execution VARCHAR(255) NULL COMMENT 'Confirmacion tecnica sin datos personales ni errores crudos',
            created_at_order_workflow_execution DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha UTC de reserva',
            updated_at_order_workflow_execution DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha UTC del resultado',
            PRIMARY KEY (id_order_workflow_execution),
            UNIQUE KEY uq_order_workflow_once (environment_order_workflow_execution, external_id_order_workflow_execution, action_order_workflow_execution)
        ) ENGINE=InnoDB COMMENT='Ejecuciones externas de orden; sobrevive al rollback de la etapa'`.execute(db);
    },
    async down(db: Kysely<unknown>): Promise<void> {
        await sql`DROP TABLE int_order_workflow_execution`.execute(db);
    },
};
