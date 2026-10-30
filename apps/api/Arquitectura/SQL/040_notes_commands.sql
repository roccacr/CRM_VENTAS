-- Ejecutar exclusivamente mediante el runner 040: verifica destino, dependencias nativas y crm_note vacia.
-- MySQL confirma cada DDL implicitamente. Si falla parcialmente, detener: inventariar objetos y
-- permisos, restaurar el respaldo previo o aprobar una recuperacion explicita antes de reintentar.
-- No adoptar tablas/columnas existentes ni inventar modulos mediante backfill. Sin triggers ni workers.
ALTER TABLE crm_note
  ADD COLUMN origin_module_code_note VARCHAR(40) NOT NULL COMMENT 'Modulo nativo de origen inmutable para permisos y consultas de la nota',
  ADD CONSTRAINT ck_note_origin_module CHECK (origin_module_code_note IN ('ventas','mercadeo','formalizacion','contabilidad','administration')),
  ADD KEY ix_note_module_author_status (origin_module_code_note,author_user_id_note,status_note,updated_at_note,id_note);

CREATE TABLE int_note_command (
  id_note_command BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad interna del recibo de un comando confirmado',
  actor_user_id_note_command BIGINT UNSIGNED NOT NULL COMMENT 'Usuario nativo que ejecuto el comando y delimita su idempotencia',
  operation_id_note_command VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Identificador opaco de operacion unico por actor',
  request_hash_note_command CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Hash canonico de la solicitud para rechazar reutilizacion incompatible',
  result_note_command JSON NOT NULL COMMENT 'Resultado minimo con notePublicId y version; nunca contenido privado',
  created_at_note_command DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha UTC de confirmacion atomica del comando sin estado pendiente',
  PRIMARY KEY (id_note_command),
  UNIQUE KEY uq_note_command_actor_operation (actor_user_id_note_command,operation_id_note_command),
  CONSTRAINT fk_note_command_actor FOREIGN KEY (actor_user_id_note_command) REFERENCES sec_user(id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Recibos de idempotencia guardados al final de la transaccion de notas';

CREATE TABLE int_event_outbox (
  id_event_outbox BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad interna para ordenar entregas pendientes',
  public_id_event_outbox CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'ULID publico estable del evento para deduplicacion',
  aggregate_type_event_outbox VARCHAR(40) NOT NULL COMMENT 'Tipo canonico del agregado que origina el evento',
  aggregate_public_id_event_outbox CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'ULID publico del agregado nativo sin identidad externa',
  aggregate_version_event_outbox INT UNSIGNED NOT NULL COMMENT 'Version del agregado que ordena eventos y evita proyecciones antiguas',
  event_type_event_outbox VARCHAR(60) NOT NULL COMMENT 'Tipo canonico del cambio confirmado',
  destination_code_event_outbox VARCHAR(40) NOT NULL COMMENT 'Destino notification o legacy_projection sin activar transporte',
  payload_event_outbox JSON NOT NULL COMMENT 'Identificadores de contexto exclusivamente; nunca cuerpo privado de notas',
  status_event_outbox VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'Estado pending, processing, delivered o failed de la entrega',
  attempts_event_outbox INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Cantidad de intentos de entrega realizados',
  available_at_event_outbox DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha UTC minima para un intento de entrega',
  delivered_at_event_outbox DATETIME(3) NULL COMMENT 'Fecha UTC de entrega confirmada al destino',
  last_error_code_event_outbox VARCHAR(80) NULL COMMENT 'Codigo de fallo sin texto privado ni datos sensibles',
  created_at_event_outbox DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha UTC de creacion atomica con el agregado',
  updated_at_event_outbox DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Ultimo cambio UTC explicitamente actualizado por el consumidor futuro',
  PRIMARY KEY (id_event_outbox),
  UNIQUE KEY uq_event_outbox_public (public_id_event_outbox),
  UNIQUE KEY uq_event_outbox_aggregate_destination (aggregate_type_event_outbox,aggregate_public_id_event_outbox,aggregate_version_event_outbox,destination_code_event_outbox),
  KEY ix_event_outbox_pending (status_event_outbox,available_at_event_outbox,id_event_outbox),
  CONSTRAINT ck_event_outbox_status CHECK (status_event_outbox IN ('pending','processing','delivered','failed')),
  CONSTRAINT ck_event_outbox_destination CHECK (destination_code_event_outbox IN ('notification','legacy_projection')),
  CONSTRAINT ck_event_outbox_version CHECK (aggregate_version_event_outbox>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Eventos duraderos de notas sin emisor ni proyeccion externa activados';
