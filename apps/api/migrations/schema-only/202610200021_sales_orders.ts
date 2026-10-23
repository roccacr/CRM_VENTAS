import { type Kysely, sql } from "kysely";

import { readTargetTableNames } from "./202609250001_identity_schema.js";

export const salesOrderStatements = [
    `CREATE TABLE IF NOT EXISTS conf_sales_order_state (
  code_sales_order_state VARCHAR(48) NOT NULL COMMENT 'Codigo legible de la etapa; no depende de un proveedor',
  name_sales_order_state VARCHAR(120) NOT NULL COMMENT 'Nombre en espanol de la etapa',
  display_order_sales_order_state SMALLINT UNSIGNED NOT NULL COMMENT 'Orden de presentacion; no impone transiciones',
  PRIMARY KEY (code_sales_order_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS conf_sales_order_approval_type (
  code_sales_order_approval_type VARCHAR(32) NOT NULL COMMENT 'Tipo de aprobacion independiente',
  name_sales_order_approval_type VARCHAR(100) NOT NULL COMMENT 'Descripcion visible de la aprobacion',
  PRIMARY KEY (code_sales_order_approval_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS crm_sales_order (
  id_sales_order BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad interna propia del CRM',
  public_id_sales_order CHAR(26) NOT NULL COMMENT 'Identidad publica estable para el API',
  native_code_sales_order VARCHAR(140) NOT NULL COMMENT 'Codigo propio de la orden en CRM',
  id_old_produccion_sales_order INT NULL COMMENT 'id_ov original; permite reconciliar sin usarlo como PK nueva',
  unit_file_id_sales_order BIGINT UNSIGNED NULL COMMENT 'Expediente propio de unidad cuando este conciliado',
  subsidiary_id_sales_order BIGINT UNSIGNED NULL COMMENT 'Subsidiaria propia conciliada',
  owner_user_id_sales_order BIGINT UNSIGNED NULL COMMENT 'Responsable CRM; nunca un id externo',
  status_sales_order ENUM('active','inactive','unknown') NOT NULL DEFAULT 'unknown' COMMENT 'Actividad confirmada; unknown no habilita operaciones',
  cancelled_sales_order ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' COMMENT 'Venta caida; yes no elimina la orden',
  currency_code_sales_order CHAR(3) NULL COMMENT 'Moneda ISO confirmada; no se asume al importar',
  transaction_date_sales_order DATE NULL COMMENT 'Fecha comercial confirmada; no es fecha de importacion',
  list_price_sales_order DECIMAL(19,4) NULL COMMENT 'Precio de lista normalizado; null si no es interpretable',
  net_sale_price_sales_order DECIMAL(19,4) NULL COMMENT 'Precio neto normalizado',
  sale_price_sales_order DECIMAL(19,4) NULL COMMENT 'Precio de venta normalizado',
  advisor_commission_sales_order DECIMAL(19,4) NULL COMMENT 'Importe de comision del asesor, no porcentaje',
  contract_signed_sales_order ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' COMMENT 'Firma de contrato observada; no equivale a traspaso',
  commercial_closure_signed_sales_order ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' COMMENT 'Marca cierre_firmado_ov; no se infiere entrega ni traspaso',
  advisor_commission_calculated_sales_order ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' COMMENT 'Marca de calculo de comision observada',
  advisor_commission_paid_sales_order ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' COMMENT 'Marca comision_cancelada_ov segun el mapper recibido',
  source_created_at_sales_order DATETIME(3) NULL COMMENT 'creado_ov observado; puede no ser la creacion real en el ERP',
  created_at_sales_order DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Instante de creacion del registro en CRM nuevo; UTC',
  created_by_user_id_sales_order BIGINT UNSIGNED NULL COMMENT 'Usuario CRM creador si es conocido',
  updated_at_sales_order DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Ultima modificacion local auditada; UTC',
  updated_by_user_id_sales_order BIGINT UNSIGNED NULL COMMENT 'Usuario responsable de la ultima modificacion local',
  deleted_at_sales_order DATETIME(3) NULL COMMENT 'Borrado logico sin perder trazabilidad',
  PRIMARY KEY (id_sales_order),
  UNIQUE KEY uq_so_public (public_id_sales_order),
  UNIQUE KEY uq_so_native (native_code_sales_order),
  UNIQUE KEY uq_so_legacy (id_old_produccion_sales_order),
  KEY idx_so_valid (status_sales_order,cancelled_sales_order,deleted_at_sales_order),
  FOREIGN KEY (unit_file_id_sales_order) REFERENCES crm_unit_file(id_unit_file),
  FOREIGN KEY (subsidiary_id_sales_order) REFERENCES crm_subsidiary(id_subsidiary),
  FOREIGN KEY (owner_user_id_sales_order) REFERENCES sec_user(id_user),
  FOREIGN KEY (created_by_user_id_sales_order) REFERENCES sec_user(id_user),
  FOREIGN KEY (updated_by_user_id_sales_order) REFERENCES sec_user(id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS crm_sales_order_external_reference (
  id_sales_order_external_reference BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad de referencia de proveedor',
  sales_order_id_sales_order_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Orden propia enlazada',
  external_system_id_sales_order_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Sistema o cuenta de proveedor registrado; nunca contiene secretos',
  external_id_sales_order_external_reference VARCHAR(180) NOT NULL COMMENT 'Id de transaccion como texto para cualquier proveedor',
  transaction_number_sales_order_external_reference VARCHAR(180) NULL COMMENT 'Numero visible de transaccion del proveedor',
  status_sales_order_external_reference ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Vigencia del enlace externo',
  created_at_sales_order_external_reference DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha de registro del enlace; UTC',
  updated_at_sales_order_external_reference DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Ultima conciliacion del enlace; UTC',
  PRIMARY KEY (id_sales_order_external_reference),
  UNIQUE KEY uq_so_external (external_system_id_sales_order_external_reference,external_id_sales_order_external_reference),
  KEY idx_so_external_order (sales_order_id_sales_order_external_reference),
  FOREIGN KEY (sales_order_id_sales_order_external_reference) REFERENCES crm_sales_order(id_sales_order),
  FOREIGN KEY (external_system_id_sales_order_external_reference) REFERENCES int_external_system(id_external_system)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS crm_sales_order_approval (
  sales_order_id_sales_order_approval BIGINT UNSIGNED NOT NULL COMMENT 'Orden propia de la aprobacion',
  type_code_sales_order_approval VARCHAR(32) NOT NULL COMMENT 'Jefatura, desarrolladora o formalizacion',
  status_sales_order_approval ENUM('approved','not_approved','unknown') NOT NULL DEFAULT 'unknown' COMMENT 'Resultado legible; unknown no es aprobacion',
  version_sales_order_approval INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Version de la proyeccion; cada cambio agrega un evento',
  updated_at_sales_order_approval DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Registro de ultima observacion o cambio; no fecha historica inferida',
  updated_by_user_id_sales_order_approval BIGINT UNSIGNED NULL COMMENT 'Usuario CRM del ultimo cambio conocido',
  PRIMARY KEY (sales_order_id_sales_order_approval,type_code_sales_order_approval),
  KEY idx_so_approval_pending (type_code_sales_order_approval,status_sales_order_approval,sales_order_id_sales_order_approval),
  FOREIGN KEY (sales_order_id_sales_order_approval) REFERENCES crm_sales_order(id_sales_order),
  FOREIGN KEY (type_code_sales_order_approval) REFERENCES conf_sales_order_approval_type(code_sales_order_approval_type),
  FOREIGN KEY (updated_by_user_id_sales_order_approval) REFERENCES sec_user(id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS audit_sales_order_state_event (
  id_sales_order_state_event BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Secuencia tecnica del evento inmutable',
  public_id_sales_order_state_event CHAR(26) NOT NULL COMMENT 'Identidad publica del evento',
  sales_order_id_sales_order_state_event BIGINT UNSIGNED NOT NULL COMMENT 'Orden propia cuyo recorrido se registra',
  sequence_sales_order_state_event INT UNSIGNED NOT NULL COMMENT 'Numero de visita o transicion por orden',
  from_state_code_sales_order_state_event VARCHAR(48) NULL COMMENT 'Estado anterior; null solo en el primer evento',
  to_state_code_sales_order_state_event VARCHAR(48) NOT NULL COMMENT 'Estado observado o nuevo; permite reingresos',
  event_kind_sales_order_state_event ENUM('created','transition','import_snapshot') NOT NULL COMMENT 'Snapshot inicial no inventa transiciones previas',
  effective_at_sales_order_state_event DATETIME(3) NULL COMMENT 'Fecha efectiva confirmada; null para pasado desconocido',
  recorded_at_sales_order_state_event DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Cuando CRM registro la evidencia; UTC',
  actor_user_id_sales_order_state_event BIGINT UNSIGNED NULL COMMENT 'Usuario autenticado si es conocido',
  actor_snapshot_sales_order_state_event JSON NULL COMMENT 'Nombre y roles del actor en ese momento; sin secretos',
  origin_sales_order_state_event ENUM('crm','integration','legacy_import') NOT NULL COMMENT 'Origen real del cambio o de la observacion',
  reason_sales_order_state_event VARCHAR(500) NOT NULL COMMENT 'Motivo obligatorio del cambio u observacion',
  operation_id_sales_order_state_event VARCHAR(100) NOT NULL COMMENT 'Idempotencia por orden; reintentar no agrega otra transicion',
  correlation_id_sales_order_state_event VARCHAR(100) NOT NULL COMMENT 'Relaciona accion, auditoria y sincronizacion futura',
  PRIMARY KEY (id_sales_order_state_event),
  UNIQUE KEY uq_so_state_public (public_id_sales_order_state_event),
  UNIQUE KEY uq_so_state_sequence (sales_order_id_sales_order_state_event,sequence_sales_order_state_event),
  UNIQUE KEY uq_so_state_operation (sales_order_id_sales_order_state_event,operation_id_sales_order_state_event),
  KEY idx_so_state_reporting (to_state_code_sales_order_state_event,effective_at_sales_order_state_event,sales_order_id_sales_order_state_event),
  FOREIGN KEY (sales_order_id_sales_order_state_event) REFERENCES crm_sales_order(id_sales_order),
  FOREIGN KEY (from_state_code_sales_order_state_event) REFERENCES conf_sales_order_state(code_sales_order_state),
  FOREIGN KEY (to_state_code_sales_order_state_event) REFERENCES conf_sales_order_state(code_sales_order_state),
  FOREIGN KEY (actor_user_id_sales_order_state_event) REFERENCES sec_user(id_user),
  CHECK ((sequence_sales_order_state_event=1 AND from_state_code_sales_order_state_event IS NULL) OR (sequence_sales_order_state_event>1 AND from_state_code_sales_order_state_event IS NOT NULL)),
  CHECK (event_kind_sales_order_state_event<>'import_snapshot' OR sequence_sales_order_state_event=1),
  CHECK (event_kind_sales_order_state_event='import_snapshot' OR effective_at_sales_order_state_event IS NOT NULL),
  CHECK (origin_sales_order_state_event<>'crm' OR actor_user_id_sales_order_state_event IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS audit_sales_order_approval_event (
  id_sales_order_approval_event BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad del cambio inmutable de aprobacion',
  sales_order_id_sales_order_approval_event BIGINT UNSIGNED NOT NULL COMMENT 'Orden propia revisada',
  type_code_sales_order_approval_event VARCHAR(32) NOT NULL COMMENT 'Aprobacion revisada de forma independiente',
  version_sales_order_approval_event INT UNSIGNED NOT NULL COMMENT 'Version correlativa por orden y tipo',
  before_status_sales_order_approval_event ENUM('approved','not_approved','unknown') NULL COMMENT 'Resultado anterior; null si es primera observacion',
  after_status_sales_order_approval_event ENUM('approved','not_approved','unknown') NOT NULL COMMENT 'Resultado nuevo o observado',
  effective_at_sales_order_approval_event DATETIME(3) NULL COMMENT 'Fecha real confirmada; null si se importa sin evidencia',
  recorded_at_sales_order_approval_event DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Cuando se registro el evento; UTC',
  actor_user_id_sales_order_approval_event BIGINT UNSIGNED NULL COMMENT 'Usuario CRM si es conocido',
  actor_snapshot_sales_order_approval_event JSON NULL COMMENT 'Nombre y roles del actor al momento de la accion',
  origin_sales_order_approval_event ENUM('crm','integration','legacy_import') NOT NULL COMMENT 'Origen del resultado de aprobacion',
  reason_sales_order_approval_event VARCHAR(500) NOT NULL COMMENT 'Motivo del resultado u observacion inicial',
  operation_id_sales_order_approval_event VARCHAR(100) NOT NULL COMMENT 'Idempotencia por orden y tipo',
  correlation_id_sales_order_approval_event VARCHAR(100) NOT NULL COMMENT 'Traza comun de la operacion',
  PRIMARY KEY (id_sales_order_approval_event),
  UNIQUE KEY uq_so_approval_version (sales_order_id_sales_order_approval_event,type_code_sales_order_approval_event,version_sales_order_approval_event),
  UNIQUE KEY uq_so_approval_operation (sales_order_id_sales_order_approval_event,type_code_sales_order_approval_event,operation_id_sales_order_approval_event),
  FOREIGN KEY (sales_order_id_sales_order_approval_event) REFERENCES crm_sales_order(id_sales_order),
  FOREIGN KEY (type_code_sales_order_approval_event) REFERENCES conf_sales_order_approval_type(code_sales_order_approval_type),
  FOREIGN KEY (actor_user_id_sales_order_approval_event) REFERENCES sec_user(id_user),
  CHECK (origin_sales_order_approval_event<>'crm' OR (actor_user_id_sales_order_approval_event IS NOT NULL AND effective_at_sales_order_approval_event IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS int_sales_order_source_snapshot (
  id_sales_order_source_snapshot BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad de la observacion externa',
  sales_order_id_sales_order_source_snapshot BIGINT UNSIGNED NOT NULL COMMENT 'Orden propia relacionada',
  external_system_id_sales_order_source_snapshot BIGINT UNSIGNED NOT NULL COMMENT 'Origen registrado de la observacion',
  source_record_id_sales_order_source_snapshot VARCHAR(180) NOT NULL COMMENT 'Id del registro en el sistema de origen',
  payload_sales_order_source_snapshot JSON NOT NULL COMMENT 'Copia original restringida; conserva campos aun no interpretados',
  observed_at_sales_order_source_snapshot DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha de lectura; no fecha efectiva del pasado',
  operation_id_sales_order_source_snapshot VARCHAR(100) NOT NULL COMMENT 'Idempotencia de la observacion',
  PRIMARY KEY (id_sales_order_source_snapshot),
  UNIQUE KEY uq_so_snapshot_operation (external_system_id_sales_order_source_snapshot,operation_id_sales_order_source_snapshot),
  KEY idx_so_snapshot_order (sales_order_id_sales_order_source_snapshot,observed_at_sales_order_source_snapshot),
  FOREIGN KEY (sales_order_id_sales_order_source_snapshot) REFERENCES crm_sales_order(id_sales_order),
  FOREIGN KEY (external_system_id_sales_order_source_snapshot) REFERENCES int_external_system(id_external_system)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS audit_sales_order_change (
  id_sales_order_change BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad de cambio comercial',
  sales_order_id_sales_order_change BIGINT UNSIGNED NOT NULL COMMENT 'Orden propia modificada',
  action_sales_order_change ENUM('create','update','import_snapshot') NOT NULL COMMENT 'Accion registrada sin reemplazar eventos de etapa',
  before_sales_order_change JSON NULL COMMENT 'Campos anteriores; null en alta o snapshot inicial',
  after_sales_order_change JSON NOT NULL COMMENT 'Campos nuevos o observados',
  actor_user_id_sales_order_change BIGINT UNSIGNED NULL COMMENT 'Usuario responsable cuando es conocido',
  recorded_at_sales_order_change DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha de registro de la auditoria; UTC',
  origin_sales_order_change ENUM('crm','integration','legacy_import') NOT NULL COMMENT 'Origen real de la accion',
  reason_sales_order_change VARCHAR(500) NOT NULL COMMENT 'Motivo obligatorio',
  operation_id_sales_order_change VARCHAR(100) NOT NULL COMMENT 'Operacion idempotente por orden',
  correlation_id_sales_order_change VARCHAR(100) NOT NULL COMMENT 'Traza de la accion',
  PRIMARY KEY (id_sales_order_change),
  UNIQUE KEY uq_so_change_operation (sales_order_id_sales_order_change,operation_id_sales_order_change),
  FOREIGN KEY (sales_order_id_sales_order_change) REFERENCES crm_sales_order(id_sales_order),
  FOREIGN KEY (actor_user_id_sales_order_change) REFERENCES sec_user(id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
] as const;
export const legacyStateStatements = [
    `CREATE TABLE IF NOT EXISTS conf_sales_order_state (
  code_sales_order_state VARCHAR(48) NOT NULL COMMENT 'Codigo legible de la etapa; no depende de un proveedor',
  name_sales_order_state VARCHAR(120) NOT NULL COMMENT 'Nombre en espanol de la etapa',
  display_order_sales_order_state SMALLINT UNSIGNED NOT NULL COMMENT 'Orden de presentacion; no impone transiciones',
  PRIMARY KEY (code_sales_order_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS audit_sales_order_state_event (
  id_sales_order_state_event BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad del evento nuevo; no altera ordenventa',
  legacy_order_id_sales_order_state_event INT NOT NULL COMMENT 'id_ov original; sin FK para no cambiar borrados existentes',
  sequence_sales_order_state_event INT UNSIGNED NOT NULL COMMENT 'Numero correlativo por orden',
  from_state_code_sales_order_state_event VARCHAR(48) NULL COMMENT 'Estado anterior conocido',
  to_state_code_sales_order_state_event VARCHAR(48) NOT NULL COMMENT 'Estado nuevo u observado',
  event_kind_sales_order_state_event ENUM('transition','import_snapshot') NOT NULL COMMENT 'Tipo de evidencia; no reconstruye pasado',
  effective_at_sales_order_state_event DATETIME(3) NULL COMMENT 'Fecha efectiva si se conoce; no inventar al migrar',
  recorded_at_sales_order_state_event DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha de registro; UTC',
  actor_reference_sales_order_state_event VARCHAR(180) NULL COMMENT 'Referencia con sistema del actor; null si se desconoce',
  origin_sales_order_state_event VARCHAR(64) NOT NULL COMMENT 'Sistema que observo o produjo el cambio',
  reason_sales_order_state_event VARCHAR(500) NOT NULL COMMENT 'Motivo de transicion u observacion',
  operation_id_sales_order_state_event VARCHAR(100) NOT NULL COMMENT 'Idempotencia de la escritura',
  correlation_id_sales_order_state_event VARCHAR(100) NOT NULL COMMENT 'Traza compartida con el CRM nuevo',
  PRIMARY KEY (id_sales_order_state_event),
  UNIQUE KEY uq_so_state_sequence (legacy_order_id_sales_order_state_event,sequence_sales_order_state_event),
  UNIQUE KEY uq_so_state_operation (legacy_order_id_sales_order_state_event,operation_id_sales_order_state_event),
  KEY idx_so_state_reporting (to_state_code_sales_order_state_event,effective_at_sales_order_state_event),
  FOREIGN KEY (from_state_code_sales_order_state_event) REFERENCES conf_sales_order_state(code_sales_order_state),
  FOREIGN KEY (to_state_code_sales_order_state_event) REFERENCES conf_sales_order_state(code_sales_order_state),
  CHECK ((sequence_sales_order_state_event=1 AND from_state_code_sales_order_state_event IS NULL) OR (sequence_sales_order_state_event>1 AND from_state_code_sales_order_state_event IS NOT NULL)),
  CHECK (event_kind_sales_order_state_event<>'import_snapshot' OR sequence_sales_order_state_event=1),
  CHECK (event_kind_sales_order_state_event='import_snapshot' OR effective_at_sales_order_state_event IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
] as const;
export const salesOrderStates = [
    ["unclassified", "Sin etapa confirmada"],
    ["pending_approval", "Pendientes de aprobacion"],
    ["contract_pending_send", "Contrato por enviar"],
    ["contract_pending_signature", "Contrato pendiente de firma"],
    ["bank_management", "Gestion bancaria"],
    ["pending_balance", "Pendientes de saldo"],
    ["pending_transfer", "Traspasos pendientes"],
    ["transfer_signed", "Traspaso firmado"],
    ["closed", "Formalizacion cerrada"],
] as const;

/** Additive schema only. DDL commits implicitly; never wrap it in a pretend rollback. */
export const salesOrdersMigration = {
    name: "202610200021_sales_orders",
    async up(db: Kysely<unknown>): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Sales orders require CRM_THINK_V2");
        // The runner skips ledgered migrations; existing targets here require reconciliation, not adoption.
        const existing = await sql<{ table_name: string }>`SELECT TABLE_NAME AS table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${sql.join(readTargetTableNames([...salesOrderStatements]))})`.execute(db);
        if (existing.rows.length > 0) throw new Error("Existing sales order tables require DBA reconciliation before recording this migration");
        for (const statement of salesOrderStatements) await sql.raw(statement).execute(db);
        for (const [index, [code, name]] of salesOrderStates.entries()) {
            await sql`INSERT INTO conf_sales_order_state (code_sales_order_state,name_sales_order_state,display_order_sales_order_state) VALUES (${code},${name},${index}) ON DUPLICATE KEY UPDATE code_sales_order_state=VALUES(code_sales_order_state)`.execute(db);
        }
        for (const [code, name] of [
            ["sales_management", "Jefatura de ventas"],
            ["developer", "Desarrolladora"],
            ["formalization", "Formalizacion"],
        ] as const) {
            await sql`INSERT INTO conf_sales_order_approval_type (code_sales_order_approval_type,name_sales_order_approval_type) VALUES (${code},${name}) ON DUPLICATE KEY UPDATE code_sales_order_approval_type=VALUES(code_sales_order_approval_type)`.execute(db);
        }
    },
};
