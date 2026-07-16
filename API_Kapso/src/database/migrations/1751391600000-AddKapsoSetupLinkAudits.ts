// ============================================================================
// IMPORTS
// ============================================================================

import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

// ============================================================================
// MIGRACION
// ============================================================================

/**
 * Crea la tabla historica de redirects de setup cuando aun existia separada.
 * Se mantiene por trazabilidad del orden real de migraciones del entorno.
 */
export class AddKapsoSetupLinkAudits1751391600000 implements MigrationInterface {
  name = "AddKapsoSetupLinkAudits1751391600000";

  // --------------------------------------------------------------------------
  // APPLY
  // --------------------------------------------------------------------------

  public async up(queryRunner: QueryRunner): Promise<void> {
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
  // ROLLBACK
  // --------------------------------------------------------------------------

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable("kapso_setup_link_audits");

    if (hasTable) {
      await queryRunner.dropTable("kapso_setup_link_audits");
    }
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  /** Crea un indice si aun no existe en la tabla objetivo. */
  private async ensureIndex(queryRunner: QueryRunner, tableName: string, indexName: string, columnNames: string[]): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const hasIndex = table?.indices.some((index) => index.name === indexName) ?? false;

    if (!hasIndex) {
      await queryRunner.createIndex(tableName, new TableIndex({ name: indexName, columnNames }));
    }
  }
}
