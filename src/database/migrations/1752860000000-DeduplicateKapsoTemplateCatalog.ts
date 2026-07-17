// ============================================================================
// IMPORTS
// ============================================================================

import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

// ============================================================================
// MIGRACION
// ============================================================================

/**
 * Normaliza el catalogo local de templates despues de compatibilizar esquemas
 * antiguos. El API espera un unico registro por `action_code`.
 */
export class DeduplicateKapsoTemplateCatalog1752860000000 implements MigrationInterface {
  name = "DeduplicateKapsoTemplateCatalog1752860000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("kapso_template_catalog"))) {
      return;
    }

    await queryRunner.query(`
      DELETE catalog
      FROM kapso_template_catalog catalog
      INNER JOIN (
        SELECT
          action_code,
          CAST(
            SUBSTRING_INDEX(
              GROUP_CONCAT(
                id_kapso_template_catalog
                ORDER BY
                  CASE WHEN template_status = 'approved' THEN 0 ELSE 1 END,
                  id_kapso_template_catalog DESC
              ),
              ',',
              1
            ) AS UNSIGNED
          ) AS keep_id
        FROM kapso_template_catalog
        GROUP BY action_code
        HAVING COUNT(*) > 1
      ) keeper
        ON keeper.action_code = catalog.action_code
      WHERE catalog.id_kapso_template_catalog <> keeper.keep_id
    `);

    const table = await queryRunner.getTable("kapso_template_catalog");
    const hasActionCodeIndex = table?.indices.some((index) => index.name === "uq_kapso_template_catalog_action");

    if (!hasActionCodeIndex) {
      await queryRunner.createIndex(
        "kapso_template_catalog",
        new TableIndex({
          name: "uq_kapso_template_catalog_action",
          columnNames: ["action_code"],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("kapso_template_catalog"))) {
      return;
    }

    const table = await queryRunner.getTable("kapso_template_catalog");
    const hasActionCodeIndex = table?.indices.some((index) => index.name === "uq_kapso_template_catalog_action");

    if (hasActionCodeIndex) {
      await queryRunner.dropIndex("kapso_template_catalog", "uq_kapso_template_catalog_action");
    }
  }
}
