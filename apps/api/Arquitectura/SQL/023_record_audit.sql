-- Central audit for native and legacy records. No changes to business tables.
-- Events are append-only by application contract; DBA privileges must enforce it.
CREATE TABLE IF NOT EXISTS audit_record (
    id_record CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'ULID del expediente de auditoria; no crea un registro comercial',
    source_schema_record VARCHAR(64) NOT NULL COMMENT 'Esquema de origen al identificar el registro; CRM_THINK_V2 o crmdatabase-api',
    entity_type_record VARCHAR(64) NOT NULL COMMENT 'Tipo canonico del registro; sales_order, lead u otra entidad autorizada',
    source_table_record VARCHAR(64) NOT NULL COMMENT 'Tabla fisica original; referencia logica sin FK a la tabla comercial',
    source_id_record VARCHAR(191) NOT NULL COMMENT 'Clave primaria original como texto; no es el ID del proveedor ERP',
    created_at_record DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Creacion del expediente de auditoria en UTC; no fecha de creacion comercial',
    PRIMARY KEY (id_record),
    UNIQUE KEY uq_audit_record_identity (source_schema_record, entity_type_record, source_table_record, source_id_record),
    CONSTRAINT ck_audit_record_identity CHECK (CHAR_LENGTH(TRIM(source_schema_record)) > 0 AND CHAR_LENGTH(TRIM(entity_type_record)) > 0 AND CHAR_LENGTH(TRIM(source_table_record)) > 0 AND CHAR_LENGTH(TRIM(source_id_record)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='Identidad de un registro auditado, sin FK a registros nativos ni legados';

CREATE TABLE IF NOT EXISTS audit_record_event (
    id_record_event CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'ULID inmutable del evento de auditoria',
    record_id_record_event CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Expediente de auditoria; no referencia la tabla de negocio',
    sequence_record_event INT UNSIGNED NOT NULL COMMENT 'Version consecutiva del historial por registro; comienza en uno',
    action_record_event VARCHAR(32) NOT NULL COMMENT 'Accion canonica: create, update, delete, state_change, approval_change, revert, restore, import_snapshot o annotation',
    module_record_event VARCHAR(64) NOT NULL COMMENT 'Modulo responsable del cambio; no es una autorizacion',
    origin_record_event VARCHAR(32) NOT NULL COMMENT 'Origen tecnico: crm, integration, migration o job',
    source_schema_record_event VARCHAR(64) NOT NULL COMMENT 'Esquema donde se efectuo u observo la accion; preserva la trayectoria tras migrar',
    source_table_record_event VARCHAR(64) NOT NULL COMMENT 'Tabla fisica afectada u observada en ese instante',
    source_id_record_event VARCHAR(191) NOT NULL COMMENT 'ID fisico afectado en ese instante, conservado como texto',
    actor_kind_record_event VARCHAR(16) NOT NULL COMMENT 'Tipo de responsable: user, service o unknown; unknown solo al importar evidencia',
    actor_reference_record_event VARCHAR(191) NULL COMMENT 'ID estable del usuario o servicio; sin FK para conservar evidencia de usuarios eliminados',
    actor_snapshot_record_event JSON NOT NULL COMMENT 'Identidad confiable del actor al actuar: nombre y roles o identificacion del servicio; nunca credenciales',
    occurred_at_record_event DATETIME(3) NULL COMMENT 'Fecha efectiva del cambio en UTC si existe evidencia; NULL si se desconoce',
    recorded_at_record_event DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha de registro de la evidencia en UTC asignada por MySQL',
    operation_id_record_event VARCHAR(100) NOT NULL COMMENT 'Clave idempotente por registro; reintentos deben comparar el contenido completo',
    correlation_id_record_event VARCHAR(100) NOT NULL COMMENT 'Traza de peticion o proceso para agrupar cambios relacionados',
    reason_record_event VARCHAR(1000) NULL COMMENT 'Nota o motivo; obligatorio para reversiones y restauraciones',
    snapshot_version_record_event INT UNSIGNED NOT NULL COMMENT 'Version del contrato canonico de snapshots de esta entidad',
    snapshot_scope_record_event VARCHAR(16) NOT NULL COMMENT 'Cobertura: full para campos comerciales declarados, partial u observation; no implica restaurabilidad automatica',
    before_record_event JSON NULL COMMENT 'Snapshot anterior del agregado permitido, incluidas relaciones auditadas; NULL solo sin evidencia o en creacion',
    after_record_event JSON NULL COMMENT 'Snapshot posterior del agregado permitido; NULL solo en borrado o anotacion sin snapshot',
    changes_record_event JSON NOT NULL COMMENT 'Lista de cambios por ruta con beforeExists, afterExists, before y after; distingue ausente de NULL',
    restored_sequence_record_event INT UNSIGNED NULL COMMENT 'Version del mismo registro tomada como objetivo de restauracion; nunca elimina eventos',
    request_id_record_event VARCHAR(100) NULL COMMENT 'Identificador interno de peticion, sin headers ni tokens',
    ip_address_record_event VARCHAR(80) NULL COMMENT 'IP normalizada si procede segun politica de privacidad y retencion',
    user_agent_record_event VARCHAR(500) NULL COMMENT 'Agente del cliente acotado; dato informativo no confiable',
    PRIMARY KEY (id_record_event),
    UNIQUE KEY uq_audit_record_event_sequence (record_id_record_event, sequence_record_event),
    UNIQUE KEY uq_audit_record_event_operation (record_id_record_event, operation_id_record_event),
    KEY ix_audit_record_event_time (recorded_at_record_event, id_record_event),
    KEY ix_audit_record_event_actor (actor_reference_record_event, recorded_at_record_event),
    KEY ix_audit_record_event_correlation (correlation_id_record_event),
    KEY ix_audit_record_event_restore (record_id_record_event, restored_sequence_record_event),
    CONSTRAINT fk_audit_record_event_record FOREIGN KEY (record_id_record_event) REFERENCES audit_record (id_record),
    CONSTRAINT fk_audit_record_event_restore FOREIGN KEY (record_id_record_event, restored_sequence_record_event) REFERENCES audit_record_event (record_id_record_event, sequence_record_event),
    CONSTRAINT ck_audit_record_event_sequence CHECK (sequence_record_event > 0 AND snapshot_version_record_event > 0),
    CONSTRAINT ck_audit_record_event_action CHECK (action_record_event IN ('create', 'update', 'delete', 'state_change', 'approval_change', 'revert', 'restore', 'import_snapshot', 'annotation')),
    CONSTRAINT ck_audit_record_event_origin CHECK (origin_record_event IN ('crm', 'integration', 'migration', 'job')),
    CONSTRAINT ck_audit_record_event_actor CHECK ((actor_kind_record_event IN ('user', 'service') AND actor_reference_record_event IS NOT NULL AND CHAR_LENGTH(TRIM(actor_reference_record_event)) > 0) OR (actor_kind_record_event = 'unknown' AND action_record_event = 'import_snapshot' AND actor_reference_record_event IS NULL)),
    CONSTRAINT ck_audit_record_event_json CHECK (JSON_TYPE(actor_snapshot_record_event) = 'OBJECT' AND JSON_TYPE(changes_record_event) = 'ARRAY' AND (before_record_event IS NULL OR JSON_TYPE(before_record_event) = 'OBJECT') AND (after_record_event IS NULL OR JSON_TYPE(after_record_event) = 'OBJECT')),
    CONSTRAINT ck_audit_record_event_scope CHECK (snapshot_scope_record_event IN ('full', 'partial', 'observation')),
    CONSTRAINT ck_audit_record_event_identity CHECK (CHAR_LENGTH(TRIM(operation_id_record_event)) > 0 AND CHAR_LENGTH(TRIM(correlation_id_record_event)) > 0 AND CHAR_LENGTH(TRIM(module_record_event)) > 0 AND CHAR_LENGTH(TRIM(source_schema_record_event)) > 0 AND CHAR_LENGTH(TRIM(source_table_record_event)) > 0 AND CHAR_LENGTH(TRIM(source_id_record_event)) > 0),
    CONSTRAINT ck_audit_record_event_time CHECK (occurred_at_record_event IS NOT NULL OR action_record_event = 'import_snapshot'),
    CONSTRAINT ck_audit_record_event_reason CHECK (action_record_event NOT IN ('revert', 'restore') OR (reason_record_event IS NOT NULL AND CHAR_LENGTH(TRIM(reason_record_event)) > 0)),
    CONSTRAINT ck_audit_record_event_snapshots CHECK (
        (action_record_event = 'create' AND before_record_event IS NULL AND after_record_event IS NOT NULL) OR
        (action_record_event = 'delete' AND before_record_event IS NOT NULL AND after_record_event IS NULL) OR
        (action_record_event IN ('update', 'state_change', 'approval_change', 'revert', 'restore') AND before_record_event IS NOT NULL AND after_record_event IS NOT NULL) OR
        (action_record_event = 'import_snapshot' AND before_record_event IS NULL AND after_record_event IS NOT NULL AND snapshot_scope_record_event = 'observation') OR
        action_record_event = 'annotation'
    ),
    CONSTRAINT ck_audit_record_event_restore CHECK ((action_record_event = 'restore' AND restored_sequence_record_event IS NOT NULL AND restored_sequence_record_event < sequence_record_event AND snapshot_scope_record_event = 'full') OR (action_record_event <> 'restore' AND restored_sequence_record_event IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='Eventos comerciales centrales; append-only por contrato y permisos DBA, sin captura automatica';
