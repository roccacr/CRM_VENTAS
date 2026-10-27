import { type Kysely, sql } from "kysely";

import { readTargetTableNames } from "./202609250001_identity_schema.js";

export const leadHistoryStatements = [
    `CREATE TABLE IF NOT EXISTS conf_lead_action_type (
  code_lead_action_type VARCHAR(80) NOT NULL COMMENT 'Codigo estable del tipo de actividad, separado de su motivo',
  name_lead_action_type VARCHAR(180) NOT NULL COMMENT 'Nombre visible de la actividad comercial',
  status_lead_action_type ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Disponibilidad para registrar nuevas actividades',
  created_at_lead_action_type DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Creacion de la configuracion en UTC',
  updated_at_lead_action_type DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Ultima modificacion de configuracion en UTC',
  PRIMARY KEY (code_lead_action_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tipos de actividad del lead; no son etapas comerciales'`,
    `CREATE TABLE IF NOT EXISTS conf_action_reason_action (
  action_code_action_reason_action VARCHAR(80) NOT NULL COMMENT 'Tipo de actividad que admite el motivo',
  reason_code_action_reason_action VARCHAR(80) NOT NULL COMMENT 'Motivo aplicable al tipo de actividad',
  status_action_reason_action ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Habilita nuevas selecciones sin borrar historia',
  created_at_action_reason_action DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Creacion de la aplicabilidad en UTC',
  updated_at_action_reason_action DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Ultima modificacion de la aplicabilidad en UTC',
  PRIMARY KEY (action_code_action_reason_action,reason_code_action_reason_action),
  FOREIGN KEY (action_code_action_reason_action) REFERENCES conf_lead_action_type(code_lead_action_type),
  FOREIGN KEY (reason_code_action_reason_action) REFERENCES conf_action_reason(code_action_reason)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Motivos permitidos por actividad; independiente de los motivos por etapa'`,
    `CREATE TABLE IF NOT EXISTS int_lead_history_entry (
  id_lead_history_entry BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad interna de evidencia historica archivada',
  source_entry_id_lead_history_entry INT NOT NULL COMMENT 'PK original de la entrada de bitacora; no es un ID del lead',
  source_lead_reference_lead_history_entry VARCHAR(180) NOT NULL COMMENT 'Referencia original del lead en el sistema fuente',
  source_lead_id_lead_history_entry INT NULL COMMENT 'PK original del lead solo si su relacion se resolvio sin ambiguedad',
  record_id_lead_history_entry CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Expediente central estable que conserva la evidencia',
  event_id_lead_history_entry CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Evento central importado; no es un evento de seguridad',
  action_code_lead_history_entry VARCHAR(80) NOT NULL COMMENT 'Clasificacion explicita de actividad o de observacion no revisada',
  reason_code_lead_history_entry VARCHAR(80) NULL COMMENT 'Motivo canonico solo cuando su significado esta revisado',
  source_reason_id_lead_history_entry INT NULL COMMENT 'Identificador original del motivo o actividad para verificar la correspondencia',
  resolution_lead_history_entry ENUM('matched','ambiguous','missing') NOT NULL COMMENT 'Resultado de resolver el padre; ambiguos nunca se asignan por conveniencia',
  source_hash_lead_history_entry CHAR(64) NOT NULL COMMENT 'SHA256 del contenido fuente; detecta cambios sin sobrescribir evidencia',
  recorded_at_lead_history_entry DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Instante UTC de archivo en el CRM nuevo',
  PRIMARY KEY (id_lead_history_entry),
  UNIQUE KEY uq_history_source_entry (source_entry_id_lead_history_entry),
  UNIQUE KEY uq_history_central_event (event_id_lead_history_entry),
  KEY idx_history_record (record_id_lead_history_entry,source_entry_id_lead_history_entry),
  KEY idx_history_resolution (resolution_lead_history_entry,source_entry_id_lead_history_entry),
  FOREIGN KEY (record_id_lead_history_entry) REFERENCES audit_record(id_record),
  FOREIGN KEY (event_id_lead_history_entry) REFERENCES audit_record_event(id_record_event),
  FOREIGN KEY (action_code_lead_history_entry) REFERENCES conf_lead_action_type(code_lead_action_type),
  FOREIGN KEY (reason_code_lead_history_entry) REFERENCES conf_action_reason(code_action_reason)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Archivo de entradas del adaptador legacy; datos originales dentro del evento central'`,
    `CREATE TABLE IF NOT EXISTS int_lead_history_link (
  lead_id_lead_history_link BIGINT UNSIGNED NOT NULL COMMENT 'Lead nativo vinculado explicitamente al expediente central',
  record_id_lead_history_link CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Identidad de auditoria conservada al promover el lead antiguo',
  linked_at_lead_history_link DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha UTC de la vinculacion explicita',
  PRIMARY KEY (lead_id_lead_history_link),
  UNIQUE KEY uq_history_link_record (record_id_lead_history_link),
  FOREIGN KEY (lead_id_lead_history_link) REFERENCES crm_lead(id_lead),
  FOREIGN KEY (record_id_lead_history_link) REFERENCES audit_record(id_record)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Puente nativo de identidad para conservar una sola historia tras retirar legacy'`,
    `CREATE TABLE IF NOT EXISTS crm_lead_activity (
  id_lead_activity BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad interna de la actividad comercial',
  public_id_lead_activity CHAR(26) NOT NULL COMMENT 'Identidad publica de la actividad generada por el CRM',
  lead_id_lead_activity BIGINT UNSIGNED NOT NULL COMMENT 'Lead nativo de la actividad',
  action_code_lead_activity VARCHAR(80) NOT NULL COMMENT 'Tipo de actividad; registrar un reporte no ejecuta mensajeria ni calendarios',
  reason_code_lead_activity VARCHAR(80) NULL COMMENT 'Motivo seleccionado cuando corresponde',
  detail_lead_activity TEXT NOT NULL COMMENT 'Detalle comercial de la actividad',
  actor_user_id_lead_activity BIGINT UNSIGNED NOT NULL COMMENT 'Usuario interno que registro la actividad',
  operation_id_lead_activity VARCHAR(100) NOT NULL COMMENT 'Clave de idempotencia de la actividad por lead',
  event_id_lead_activity CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Evento central correspondiente; evita mostrar la accion dos veces',
  created_at_lead_activity DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha UTC de registro; actividades anteriores se conservan como importaciones',
  PRIMARY KEY (id_lead_activity),
  UNIQUE KEY uq_lead_activity_public (public_id_lead_activity),
  UNIQUE KEY uq_lead_activity_operation (lead_id_lead_activity,operation_id_lead_activity),
  UNIQUE KEY uq_lead_activity_event (event_id_lead_activity),
  FOREIGN KEY (lead_id_lead_activity) REFERENCES crm_lead(id_lead),
  FOREIGN KEY (actor_user_id_lead_activity) REFERENCES sec_user(id_user),
  FOREIGN KEY (action_code_lead_activity) REFERENCES conf_lead_action_type(code_lead_action_type),
  FOREIGN KEY (action_code_lead_activity,reason_code_lead_activity) REFERENCES conf_action_reason_action(action_code_action_reason_action,reason_code_action_reason_action),
  FOREIGN KEY (event_id_lead_activity) REFERENCES audit_record_event(id_record_event)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Actividades comerciales nativas separadas del historial de etapas'`,
] as const;

const actions = [
    ["legacy_observation", "Observación del sistema anterior"],
    ["note_added", "Nota registrada"],
    ["calendar_event_created", "Evento registrado"],
    ["message_delivery_reported", "Entrega de mensaje reportada"],
    ["contact_preference_reported", "Preferencia de contacto reportada"],
    ["contact_result", "Resultado de contacto"],
] as const;
const reasons = [
    ["budget", "Presupuesto"],
    ["location", "Ubicación"],
    ["no_answer", "No contesta"],
    ["better_offer", "Mejor oferta"],
    ["invalid_phone", "Número de teléfono no válido"],
] as const;

/** Additive history storage, never alters 031 or the old database. */
export const leadHistoryMigration = {
    name: "202610230032_lead_history",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Lead history requires CRM_THINK_V2");
        const names = readTargetTableNames([...leadHistoryStatements]);
        const existing = await sql`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(names)})`.execute(db);
        if (existing.rows.length) throw new Error("Existing lead history tables require explicit recovery");
        for (const statement of leadHistoryStatements) await sql.raw(statement).execute(db);
        for (const entity of ["lead_action_type", "action_reason_action"]) await sql.raw(`CREATE TRIGGER trg_${entity}_updated_utc BEFORE UPDATE ON conf_${entity} FOR EACH ROW SET NEW.updated_at_${entity}=UTC_TIMESTAMP(3)`).execute(db);
        for (const [code, name] of actions) await sql`INSERT INTO conf_lead_action_type (code_lead_action_type,name_lead_action_type) VALUES (${code},${name})`.execute(db);
        for (const [code, name] of reasons) {
            await sql`INSERT INTO conf_action_reason (code_action_reason,name_action_reason) VALUES (${code},${name})`.execute(db);
            await sql`INSERT INTO conf_action_reason_status (status_code_action_reason_status,reason_code_action_reason_status) VALUES ('lost',${code})`.execute(db);
            await sql`INSERT INTO conf_action_reason_action (action_code_action_reason_action,reason_code_action_reason_action) VALUES ('contact_result',${code})`.execute(db);
        }
    },
};
