-- Autorizado: solo tablas nuevas. No modifica ordenventa ni crea triggers.
-- MySQL 8. No ejecutar contra otra base.
USE `crmdatabase-api`;

CREATE TABLE IF NOT EXISTS conf_sales_order_state (
  code_sales_order_state VARCHAR(48) NOT NULL COMMENT 'Codigo legible de la etapa; no depende de un proveedor',
  name_sales_order_state VARCHAR(120) NOT NULL COMMENT 'Nombre en espanol de la etapa',
  display_order_sales_order_state SMALLINT UNSIGNED NOT NULL COMMENT 'Orden de presentacion; no impone transiciones',
  PRIMARY KEY (code_sales_order_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_sales_order_state_event (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO conf_sales_order_state (code_sales_order_state,name_sales_order_state,display_order_sales_order_state) VALUES ('unclassified','Sin etapa confirmada',0),('pending_approval','Pendientes de aprobacion',1),('contract_pending_send','Contrato por enviar',2),('contract_pending_signature','Contrato pendiente de firma',3),('bank_management','Gestion bancaria',4),('pending_balance','Pendientes de saldo',5),('pending_transfer','Traspasos pendientes',6),('transfer_signed','Traspaso firmado',7),('closed','Formalizacion cerrada',8) ON DUPLICATE KEY UPDATE code_sales_order_state=VALUES(code_sales_order_state);
