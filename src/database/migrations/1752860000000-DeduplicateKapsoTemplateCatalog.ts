/**
 * Migración de deduplicación del catálogo local de templates Kapso.
 *
 * Motivo: tras compatibilizar esquemas antiguos podían existir varios registros
 * por `action_code`; la API exige uno solo (prioriza `approved` y el id más reciente).
 *
 * Tablas que toca:
 * - `kapso_template_catalog` (borra duplicados y asegura índice único `uq_kapso_template_catalog_action`)
 *
 * `down`: PARCIALMENTE irreversible. Solo elimina el índice único; no restaura
 * las filas duplicadas borradas en el `up`.
 */

import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

/**
 * Normaliza el catalogo local de templates despues de compatibilizar esquemas
 * antiguos. El API espera un unico registro por `action_code`.
 */
export class DeduplicateKapsoTemplateCatalog1752860000000 implements MigrationInterface {
  name = "DeduplicateKapsoTemplateCatalog1752860000000";

  /**
   * Elimina duplicados por `action_code` y asegura el índice único.
   *
   * @param queryRunner - Ejecutor de consultas TypeORM de la migración.
   */
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

  /**
   * Quita el índice único de `action_code` si existe.
   * No recupera las filas eliminadas en el `up` (down irreversible en datos).
   *
   * @param queryRunner - Ejecutor de consultas TypeORM de la migración.
   */
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
