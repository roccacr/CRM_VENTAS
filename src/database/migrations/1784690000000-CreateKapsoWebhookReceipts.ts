/**
 * Migración de recibos de webhooks Kapso (idempotencia y locks).
 *
 * Motivo: registrar cada entrega por `scope` + `idempotency_key` para evitar
 * reprocesos, controlar reintentos y bloquear procesamiento concurrente
 * mediante `locked_until` / `status`.
 *
 * Tablas que toca:
 * - `kapso_webhook_receipts` (crea tabla e índices de unicidad y lookup por status/lock)
 *
 * `down`: reversible (elimina la tabla). El historial de recibos se pierde.
 */

import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

/**
 * Crea la tabla de recibos de webhooks usada para idempotencia y locking.
 */
export class CreateKapsoWebhookReceipts1784690000000 implements MigrationInterface {
  name = "CreateKapsoWebhookReceipts1784690000000";

  /**
   * Crea `kapso_webhook_receipts` con índices de unicidad y consulta por lock.
   *
   * @param queryRunner - Ejecutor de consultas TypeORM de la migración.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable("kapso_webhook_receipts")) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: "kapso_webhook_receipts",
        columns: [
          { name: "id", type: "bigint", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "scope", type: "varchar", length: "20" },
          { name: "idempotency_key", type: "varchar", length: "120" },
          { name: "phone_number_id", type: "varchar", length: "120", isNullable: true },
          { name: "payload_hash", type: "char", length: "64" },
          { name: "status", type: "varchar", length: "20", default: "'processing'" },
          { name: "attempt_count", type: "int", unsigned: true, default: 1 },
          { name: "processing_error", type: "varchar", length: "500", isNullable: true },
          { name: "locked_until", type: "datetime" },
          { name: "processed_at", type: "datetime", isNullable: true },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
          {
            name: "updated_at",
            type: "datetime",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      "kapso_webhook_receipts",
      new TableIndex({
        name: "uq_kapso_webhook_receipts_scope_key",
        columnNames: ["scope", "idempotency_key"],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      "kapso_webhook_receipts",
      new TableIndex({
        name: "idx_kapso_webhook_receipts_status_lock",
        columnNames: ["status", "locked_until"],
      }),
    );
  }

  /**
   * Elimina `kapso_webhook_receipts` si existe.
   * Es reversible a nivel de schema; el historial de recibos no se recupera.
   *
   * @param queryRunner - Ejecutor de consultas TypeORM de la migración.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable("kapso_webhook_receipts")) {
      await queryRunner.dropTable("kapso_webhook_receipts");
    }
  }
}
