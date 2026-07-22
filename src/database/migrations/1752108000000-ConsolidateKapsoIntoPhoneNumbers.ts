/**
 * Migración de consolidación del modelo Kapso en una sola tabla.
 *
 * Motivo: aplanar proyecto, customer, setup y auditoría de webhooks dentro de
 * `kapso_phone_numbers`, eliminando el esquema relacional normalizado previo.
 *
 * Tablas que toca:
 * - `kapso_phone_numbers` (añade columnas consolidadas; elimina FKs/columnas `project_id`/`customer_id`)
 * - Elimina: `kapso_phone_number_webhooks`, `kapso_setup_link_audits`,
 *   `kapso_webhook_event_logs`, `kapso_customers`, `kapso_projects`
 *
 * `down`: IRREVERSIBLE. Solo ejecuta un no-op (`SELECT 1`); no reconstruye
 * tablas ni datos eliminados.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Consolida el estado Kapso en `kapso_phone_numbers` y descarta tablas satélite.
 */
export class ConsolidateKapsoIntoPhoneNumbers1752108000000 implements MigrationInterface {
  name = "ConsolidateKapsoIntoPhoneNumbers1752108000000";

  /**
   * Amplía `kapso_phone_numbers` y elimina tablas/relaciones del modelo normalizado.
   *
   * @param queryRunner - Ejecutor de consultas TypeORM de la migración.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "project_external_id", "varchar(120) NULL AFTER raw_payload");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "project_name", "varchar(255) NULL AFTER project_external_id");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "kapso_customer_id", "varchar(120) NULL AFTER project_name");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "customer_name", "varchar(255) NULL AFTER kapso_customer_id");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "customer_external_id", "varchar(120) NULL AFTER customer_name");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "whatsapp_config_id", "varchar(120) NULL AFTER customer_external_id");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "setup_link_id", "varchar(120) NULL AFTER whatsapp_config_id");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "provisioned_phone_number_id", "varchar(120) NULL AFTER setup_link_id");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "setup_status", "varchar(30) NULL AFTER provisioned_phone_number_id");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "setup_error_code", "varchar(120) NULL AFTER setup_status");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "setup_sync_status", "varchar(40) NULL AFTER setup_error_code");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "setup_sync_error", "text NULL AFTER setup_sync_status");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "project_payload", "json NULL AFTER setup_sync_error");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "customer_payload", "json NULL AFTER project_payload");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "webhooks_json", "json NULL AFTER customer_payload");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "last_webhook_scope", "varchar(20) NULL AFTER webhooks_json");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "last_webhook_event", "varchar(120) NULL AFTER last_webhook_scope");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "last_idempotency_key", "varchar(120) NULL AFTER last_webhook_event");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "last_signature_valid", "tinyint(1) NULL AFTER last_idempotency_key");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "last_processing_status", "varchar(40) NULL AFTER last_signature_valid");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "last_processing_error", "text NULL AFTER last_processing_status");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "last_webhook_received_at", "datetime NULL AFTER last_processing_error");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "last_webhook_payload", "json NULL AFTER last_webhook_received_at");
    await this.ensureColumn(queryRunner, "kapso_phone_numbers", "last_setup_query_json", "json NULL AFTER last_webhook_payload");

    await this.dropForeignKeyIfExists("kapso_phone_numbers", "fk_kapso_phone_numbers_project_id", queryRunner);
    await this.dropForeignKeyIfExists("kapso_phone_numbers", "fk_kapso_phone_numbers_customer_id", queryRunner);
    await this.dropColumnIfExists("kapso_phone_numbers", "project_id", queryRunner);
    await this.dropColumnIfExists("kapso_phone_numbers", "customer_id", queryRunner);

    await this.dropTableIfExists("kapso_phone_number_webhooks", queryRunner);
    await this.dropTableIfExists("kapso_setup_link_audits", queryRunner);
    await this.dropTableIfExists("kapso_webhook_event_logs", queryRunner);
    await this.dropTableIfExists("kapso_customers", queryRunner);
    await this.dropTableIfExists("kapso_projects", queryRunner);
  }

  /**
   * No revierte la consolidación: el down es irreversible a propósito.
   *
   * @param queryRunner - Ejecutor de consultas TypeORM de la migración.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // Esta consolidacion es deliberadamente de una sola via para este entorno.
    await queryRunner.query("SELECT 1");
  }

  private async ensureColumn(queryRunner: QueryRunner, tableName: string, columnName: string, definition: string) {
    const table = await queryRunner.getTable(tableName);

    if (!table?.findColumnByName(columnName)) {
      await queryRunner.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
    }
  }

  private async dropColumnIfExists(tableName: string, columnName: string, queryRunner: QueryRunner) {
    const table = await queryRunner.getTable(tableName);

    if (table?.findColumnByName(columnName)) {
      await queryRunner.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``);
    }
  }

  private async dropForeignKeyIfExists(tableName: string, foreignKeyName: string, queryRunner: QueryRunner) {
    const table = await queryRunner.getTable(tableName);
    const foreignKey = table?.foreignKeys.find((item) => item.name === foreignKeyName);

    if (foreignKey) {
      await queryRunner.dropForeignKey(tableName, foreignKey);
    }
  }

  private async dropTableIfExists(tableName: string, queryRunner: QueryRunner) {
    const hasTable = await queryRunner.hasTable(tableName);

    if (hasTable) {
      await queryRunner.dropTable(tableName);
    }
  }
}
