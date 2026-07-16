// ============================================================================
// IMPORTS
// ============================================================================

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

// ============================================================================
// MIGRACION
// ============================================================================

/**
 * Crea la tabla many-to-many entre administradores del CRM y numeros Kapso.
 *
 * Nota de modelado:
 * `admins.idnetsuite_admin` no es una PK unica en el schema actual, por eso la
 * relacion se conserva como clave logica indexada y no como FK fisica.
 */
export class CreateAdminKapsoIntegrationsTable1752200400000 implements MigrationInterface {
  name = "CreateAdminKapsoIntegrationsTable1752200400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable("admin_kapso_integrations");

    if (hasTable) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: "admin_kapso_integrations",
        columns: [
          {
            name: "id_admin_kapso_integration",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            isNullable: false,
          },
          {
            name: "idnetsuite_admin",
            type: "int",
            isNullable: false,
          },
          {
            name: "id_kapso_phone_number",
            type: "int",
            isNullable: false,
          },
          {
            name: "status_admin_kapso_integration",
            type: "tinyint",
            width: 1,
            isNullable: false,
            default: "1",
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
            isNullable: false,
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
            isNullable: false,
          },
        ],
        uniques: [
          {
            name: "uq_admin_kapso_integrations_relation",
            columnNames: ["idnetsuite_admin", "id_kapso_phone_number"],
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      "admin_kapso_integrations",
      new TableIndex({
        name: "idx_admin_kapso_integrations_idnetsuite_admin",
        columnNames: ["idnetsuite_admin"],
      }),
    );

    await queryRunner.createIndex(
      "admin_kapso_integrations",
      new TableIndex({
        name: "idx_admin_kapso_integrations_kapso_phone_number_id",
        columnNames: ["id_kapso_phone_number"],
      }),
    );

    await queryRunner.createIndex(
      "admin_kapso_integrations",
      new TableIndex({
        name: "idx_admin_kapso_integrations_status",
        columnNames: ["status_admin_kapso_integration"],
      }),
    );

    await queryRunner.createForeignKey(
      "admin_kapso_integrations",
      new TableForeignKey({
        name: "fk_admin_kapso_integrations_phone_number",
        columnNames: ["id_kapso_phone_number"],
        referencedTableName: "kapso_phone_numbers",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable("admin_kapso_integrations");

    if (hasTable) {
      await queryRunner.dropTable("admin_kapso_integrations");
    }
  }
}
