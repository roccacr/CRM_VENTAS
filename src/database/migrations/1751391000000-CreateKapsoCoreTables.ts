// ============================================================================
// IMPORTS
// ============================================================================

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

// ============================================================================
// MIGRACION
// ============================================================================

/**
 * Crea el modelo Kapso original normalizado.
 *
 * Aunque el sistema actual ya fue consolidado en una sola tabla, esta migracion
 * se conserva para respetar la historia real del schema y permitir reconstruir
 * entornos desde cero en el mismo orden en que evoluciono el proyecto.
 */
export class CreateKapsoCoreTables1751391000000 implements MigrationInterface {
  name = "CreateKapsoCoreTables1751391000000";

  // --------------------------------------------------------------------------
  // APPLY
  // --------------------------------------------------------------------------

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureProjectsTable(queryRunner);
    await this.ensureCustomersTable(queryRunner);
    await this.ensurePhoneNumbersTable(queryRunner);
    await this.ensurePhoneNumberWebhooksTable(queryRunner);
    await this.ensureWebhookLogsTable(queryRunner);
    await this.ensureSetupLinkAuditsTable(queryRunner);
  }

  // --------------------------------------------------------------------------
  // ROLLBACK
  // --------------------------------------------------------------------------

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableNames = [
      "kapso_webhook_event_logs",
      "kapso_phone_number_webhooks",
      "kapso_phone_numbers",
      "kapso_customers",
      "kapso_projects",
      "kapso_setup_link_audits",
    ];

    for (const tableName of tableNames) {
      const hasTable = await queryRunner.hasTable(tableName);

      if (hasTable) {
        await queryRunner.dropTable(tableName);
      }
    }
  }

  // --------------------------------------------------------------------------
  // BLOQUES DE TABLAS
  // --------------------------------------------------------------------------

  /** Crea la tabla de proyectos Kapso si aun no existe. */
  private async ensureProjectsTable(queryRunner: QueryRunner): Promise<void> {
    const tableName = "kapso_projects";
    const hasTable = await queryRunner.hasTable(tableName);

    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: tableName,
          columns: [
            {
              name: "id",
              type: "int",
              isPrimary: true,
              isGenerated: true,
              generationStrategy: "increment",
            },
            {
              name: "external_project_id",
              type: "varchar",
              length: "120",
              isNullable: false,
            },
            {
              name: "project_name",
              type: "varchar",
              length: "255",
              isNullable: true,
            },
            { name: "raw_payload", type: "json", isNullable: true },
            {
              name: "created_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
            },
            {
              name: "updated_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              onUpdate: "CURRENT_TIMESTAMP",
            },
          ],
        }),
      );
    }

    await this.ensureUnique(queryRunner, tableName, "uq_kapso_projects_external_project_id", ["external_project_id"]);
  }

  /** Crea la tabla de customers Kapso y sus dependencias de integridad. */
  private async ensureCustomersTable(queryRunner: QueryRunner): Promise<void> {
    const tableName = "kapso_customers";
    const hasTable = await queryRunner.hasTable(tableName);

    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: tableName,
          columns: [
            {
              name: "id",
              type: "int",
              isPrimary: true,
              isGenerated: true,
              generationStrategy: "increment",
            },
            {
              name: "kapso_customer_id",
              type: "varchar",
              length: "120",
              isNullable: false,
            },
            {
              name: "customer_name",
              type: "varchar",
              length: "255",
              isNullable: true,
            },
            {
              name: "external_customer_id",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            { name: "active", type: "tinyint", width: 1, default: "1" },
            { name: "raw_payload", type: "json", isNullable: true },
            { name: "project_id", type: "int", isNullable: true },
            {
              name: "created_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
            },
            {
              name: "updated_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              onUpdate: "CURRENT_TIMESTAMP",
            },
          ],
        }),
      );
    }

    await this.ensureNullableIntColumn(queryRunner, tableName, "project_id");
    await this.ensureUnique(queryRunner, tableName, "uq_kapso_customers_kapso_customer_id", ["kapso_customer_id"]);
    await this.ensureIndex(queryRunner, tableName, "idx_kapso_customers_external_customer_id", ["external_customer_id"]);
    await this.ensureForeignKey(queryRunner, tableName, "fk_kapso_customers_project_id", ["project_id"], "kapso_projects", ["id"]);
  }

  /** Crea la tabla principal de numeros WhatsApp del modelo original. */
  private async ensurePhoneNumbersTable(queryRunner: QueryRunner): Promise<void> {
    const tableName = "kapso_phone_numbers";
    const hasTable = await queryRunner.hasTable(tableName);

    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: tableName,
          columns: [
            {
              name: "id",
              type: "int",
              isPrimary: true,
              isGenerated: true,
              generationStrategy: "increment",
            },
            {
              name: "phone_number_id",
              type: "varchar",
              length: "120",
              isNullable: false,
            },
            {
              name: "phone_number_name",
              type: "varchar",
              length: "255",
              isNullable: true,
            },
            {
              name: "display_phone_number",
              type: "varchar",
              length: "80",
              isNullable: true,
            },
            {
              name: "verified_name",
              type: "varchar",
              length: "255",
              isNullable: true,
            },
            {
              name: "business_account_id",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            { name: "status", type: "varchar", length: "60", isNullable: true },
            {
              name: "quality_rating",
              type: "varchar",
              length: "60",
              isNullable: true,
            },
            {
              name: "throughput_tier",
              type: "varchar",
              length: "60",
              isNullable: true,
            },
            {
              name: "connection_type",
              type: "varchar",
              length: "60",
              isNullable: true,
            },
            { name: "active", type: "tinyint", width: 1, default: "1" },
            { name: "last_synced_at", type: "datetime", isNullable: true },
            { name: "raw_payload", type: "json", isNullable: true },
            { name: "project_id", type: "int", isNullable: true },
            { name: "customer_id", type: "int", isNullable: true },
            {
              name: "created_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
            },
            {
              name: "updated_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              onUpdate: "CURRENT_TIMESTAMP",
            },
          ],
        }),
      );
    }

    await this.ensureNullableIntColumn(queryRunner, tableName, "project_id");
    await this.ensureNullableIntColumn(queryRunner, tableName, "customer_id");
    await this.ensureUnique(queryRunner, tableName, "uq_kapso_phone_numbers_phone_number_id", ["phone_number_id"]);
    await this.ensureIndex(queryRunner, tableName, "idx_kapso_phone_numbers_business_account_id", ["business_account_id"]);
    await this.ensureIndex(queryRunner, tableName, "idx_kapso_phone_numbers_active", ["active"]);
    await this.ensureForeignKey(queryRunner, tableName, "fk_kapso_phone_numbers_project_id", ["project_id"], "kapso_projects", ["id"]);
    await this.ensureForeignKey(queryRunner, tableName, "fk_kapso_phone_numbers_customer_id", ["customer_id"], "kapso_customers", ["id"]);
  }

  /** Crea la tabla de webhooks por numero del modelo anterior. */
  private async ensurePhoneNumberWebhooksTable(queryRunner: QueryRunner): Promise<void> {
    const tableName = "kapso_phone_number_webhooks";
    const hasTable = await queryRunner.hasTable(tableName);

    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: tableName,
          columns: [
            {
              name: "id",
              type: "int",
              isPrimary: true,
              isGenerated: true,
              generationStrategy: "increment",
            },
            {
              name: "kapso_webhook_id",
              type: "varchar",
              length: "120",
              isNullable: false,
            },
            { name: "kind", type: "varchar", length: "20", isNullable: false },
            { name: "url", type: "varchar", length: "500", isNullable: false },
            {
              name: "secret_key",
              type: "varchar",
              length: "255",
              isNullable: true,
            },
            { name: "active", type: "tinyint", width: 1, default: "1" },
            { name: "events_json", type: "json", isNullable: true },
            {
              name: "payload_version",
              type: "varchar",
              length: "20",
              isNullable: true,
            },
            { name: "raw_payload", type: "json", isNullable: true },
            { name: "phone_number_ref_id", type: "int", isNullable: false },
            {
              name: "created_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
            },
            {
              name: "updated_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
              onUpdate: "CURRENT_TIMESTAMP",
            },
          ],
        }),
      );
    }

    await this.ensureUnique(queryRunner, tableName, "uq_kapso_phone_number_webhooks_webhook_id", ["kapso_webhook_id"]);
    await this.ensureIndex(queryRunner, tableName, "idx_kapso_phone_number_webhooks_kind", ["kind"]);
    await this.ensureIndex(queryRunner, tableName, "idx_kapso_phone_number_webhooks_active", ["active"]);
    await this.ensureForeignKey(
      queryRunner,
      tableName,
      "fk_kapso_phone_number_webhooks_phone_number_ref_id",
      ["phone_number_ref_id"],
      "kapso_phone_numbers",
      ["id"],
      "CASCADE",
    );
  }

  /** Crea la tabla historica de logs de eventos webhook. */
  private async ensureWebhookLogsTable(queryRunner: QueryRunner): Promise<void> {
    const tableName = "kapso_webhook_event_logs";
    const hasTable = await queryRunner.hasTable(tableName);

    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: tableName,
          columns: [
            {
              name: "id",
              type: "int",
              isPrimary: true,
              isGenerated: true,
              generationStrategy: "increment",
            },
            { name: "scope", type: "varchar", length: "20", isNullable: false },
            {
              name: "event_name",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            {
              name: "phone_number_id",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            {
              name: "project_external_id",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            {
              name: "customer_external_id",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            {
              name: "idempotency_key",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            {
              name: "signature_valid",
              type: "tinyint",
              width: 1,
              default: "0",
            },
            {
              name: "processing_status",
              type: "varchar",
              length: "40",
              default: "'received'",
            },
            { name: "processing_error", type: "text", isNullable: true },
            { name: "payload_json", type: "json", isNullable: false },
            {
              name: "created_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
            },
          ],
        }),
      );
    }

    await this.ensureIndex(queryRunner, tableName, "idx_kapso_webhook_event_logs_scope", ["scope"]);
    await this.ensureIndex(queryRunner, tableName, "idx_kapso_webhook_event_logs_event_name", ["event_name"]);
    await this.ensureIndex(queryRunner, tableName, "idx_kapso_webhook_event_logs_phone_number_id", ["phone_number_id"]);
    await this.ensureUnique(queryRunner, tableName, "uq_kapso_webhook_event_logs_scope_idempotency", ["scope", "idempotency_key"]);
  }

  /** Crea la tabla de auditoria del setup link del modelo original. */
  private async ensureSetupLinkAuditsTable(queryRunner: QueryRunner): Promise<void> {
    const tableName = "kapso_setup_link_audits";
    const hasTable = await queryRunner.hasTable(tableName);

    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: tableName,
          columns: [
            {
              name: "id",
              type: "int",
              isPrimary: true,
              isGenerated: true,
              generationStrategy: "increment",
            },
            {
              name: "status",
              type: "varchar",
              length: "30",
              isNullable: false,
            },
            {
              name: "setup_link_id",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            {
              name: "phone_number_id",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            {
              name: "business_account_id",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            {
              name: "whatsapp_config_id",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            {
              name: "provisioned_phone_number_id",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            {
              name: "display_phone_number",
              type: "varchar",
              length: "80",
              isNullable: true,
            },
            {
              name: "error_code",
              type: "varchar",
              length: "120",
              isNullable: true,
            },
            {
              name: "sync_status",
              type: "varchar",
              length: "40",
              default: "'not_started'",
            },
            { name: "sync_error", type: "text", isNullable: true },
            {
              name: "request_ip",
              type: "varchar",
              length: "80",
              isNullable: true,
            },
            {
              name: "user_agent",
              type: "varchar",
              length: "500",
              isNullable: true,
            },
            { name: "query_json", type: "json", isNullable: false },
            {
              name: "created_at",
              type: "datetime",
              default: "CURRENT_TIMESTAMP",
            },
          ],
        }),
      );
    }

    await this.ensureIndex(queryRunner, tableName, "idx_kapso_setup_link_audits_status", ["status"]);
    await this.ensureIndex(queryRunner, tableName, "idx_kapso_setup_link_audits_setup_link_id", ["setup_link_id"]);
    await this.ensureIndex(queryRunner, tableName, "idx_kapso_setup_link_audits_phone_number_id", ["phone_number_id"]);
  }

  // --------------------------------------------------------------------------
  // HELPERS DE SCHEMA
  // --------------------------------------------------------------------------

  /** Agrega una columna int nullable si aun no existe. */
  private async ensureNullableIntColumn(queryRunner: QueryRunner, tableName: string, columnName: string): Promise<void> {
    const table = await queryRunner.getTable(tableName);

    if (!table?.findColumnByName(columnName)) {
      await queryRunner.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` int NULL`);
    }
  }

  /** Crea un indice comun si aun no existe. */
  private async ensureIndex(queryRunner: QueryRunner, tableName: string, indexName: string, columnNames: string[]): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const hasIndex = table?.indices.some((index) => index.name === indexName) ?? false;

    if (!hasIndex) {
      await queryRunner.createIndex(tableName, new TableIndex({ name: indexName, columnNames }));
    }
  }

  /** Crea un indice unico si aun no existe. */
  private async ensureUnique(queryRunner: QueryRunner, tableName: string, uniqueName: string, columnNames: string[]): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const hasUniqueIndex = table?.indices.some((index) => index.name === uniqueName && index.isUnique) ?? false;

    if (!hasUniqueIndex) {
      await queryRunner.createIndex(
        tableName,
        new TableIndex({
          name: uniqueName,
          columnNames,
          isUnique: true,
        }),
      );
    }
  }

  /** Crea una foreign key si aun no existe con el nombre indicado. */
  private async ensureForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    foreignKeyName: string,
    columnNames: string[],
    referencedTableName: string,
    referencedColumnNames: string[],
    onDelete: "SET NULL" | "CASCADE" = "SET NULL",
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const hasForeignKey = table?.foreignKeys.some((foreignKey) => foreignKey.name === foreignKeyName) ?? false;

    if (!hasForeignKey) {
      await queryRunner.createForeignKey(
        tableName,
        new TableForeignKey({
          name: foreignKeyName,
          columnNames,
          referencedTableName,
          referencedColumnNames,
          onDelete,
        }),
      );
    }
  }
}
