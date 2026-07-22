/**
 * Migración histórica de auditoría de setup links Kapso.
 *
 * Motivo: en un entorno previo la tabla `kapso_setup_link_audits` se introdujo
 * como paso separado; se conserva para respetar el orden real de migraciones
 * aunque la migración núcleo ya pueda crearla de forma idempotente.
 *
 * Tablas que toca:
 * - `kapso_setup_link_audits` (crea si no existe e índices de consulta)
 *
 * `down`: reversible (elimina la tabla). Los datos de auditoría se pierden.
 */

import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

/**
 * Crea la tabla historica de redirects de setup cuando aun existia separada.
 * Se mantiene por trazabilidad del orden real de migraciones del entorno.
 */
export class AddKapsoSetupLinkAudits1751391600000 implements MigrationInterface {
  name = "AddKapsoSetupLinkAudits1751391600000";

  /**
   * Crea `kapso_setup_link_audits` e índices asociados si aún no existen.
   *
   * @param queryRunner - Ejecutor de consultas TypeORM de la migración.
   */
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

  /**
   * Elimina `kapso_setup_link_audits` si existe.
   * Es reversible a nivel de schema; los registros de auditoría no se recuperan.
   *
   * @param queryRunner - Ejecutor de consultas TypeORM de la migración.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable("kapso_setup_link_audits");

    if (hasTable) {
      await queryRunner.dropTable("kapso_setup_link_audits");
    }
  }

  private async ensureIndex(queryRunner: QueryRunner, tableName: string, indexName: string, columnNames: string[]): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const hasIndex = table?.indices.some((index) => index.name === indexName) ?? false;

    if (!hasIndex) {
      await queryRunner.createIndex(tableName, new TableIndex({ name: indexName, columnNames }));
    }
  }
}
