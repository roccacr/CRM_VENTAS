import { type Kysely, sql } from "kysely";

import { readTargetTableNames } from "./202609250001_identity_schema.js";

/** Shared UTC metadata; source dates are separate from the native record lifetime. */
const timestamps = (entity: string): string => `
  created_at_${entity} DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha de creacion del registro nativo; UTC con milisegundos',
  updated_at_${entity} DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Ultima modificacion nativa; el trigger mantiene UTC con milisegundos',`;

/** Every FK stays inside CRM_THINK_V2; no provider-specific columns or legacy writes. */
export const leadStatements = [
    `CREATE TABLE IF NOT EXISTS conf_lead_status (
  code_lead_status VARCHAR(48) NOT NULL COMMENT 'Codigo estable de la etapa comercial independiente de proveedores',
  name_lead_status VARCHAR(120) NOT NULL COMMENT 'Nombre visible de la etapa comercial',
  display_order_lead_status SMALLINT UNSIGNED NOT NULL COMMENT 'Orden de presentacion; no restringe cambios de etapa',
  status_lead_status ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Disponibilidad de la etapa para nuevas operaciones; no elimina historia',${timestamps("lead_status")}
  PRIMARY KEY (code_lead_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Etapas comerciales administrables del lead'`,
    `CREATE TABLE IF NOT EXISTS conf_action_reason (
  code_action_reason VARCHAR(80) NOT NULL COMMENT 'Codigo estable del motivo de una accion comercial',
  name_action_reason VARCHAR(180) NOT NULL COMMENT 'Nombre visible del motivo; no es una etapa ni una actividad',
  detail_action_reason VARCHAR(1000) NULL COMMENT 'Explicacion del significado y uso del motivo',
  status_action_reason ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Permite nuevas selecciones sin borrar motivos historicos',${timestamps("action_reason")}
  PRIMARY KEY (code_action_reason)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Motivos administrables; no replica la mezcla de actividades del sistema anterior'`,
    `CREATE TABLE IF NOT EXISTS conf_action_reason_status (
  status_code_action_reason_status VARCHAR(48) NOT NULL COMMENT 'Etapa de destino en que se permite seleccionar el motivo',
  reason_code_action_reason_status VARCHAR(80) NOT NULL COMMENT 'Motivo permitido para la etapa de destino',
  status_action_reason_status ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Habilita nuevas selecciones; las relaciones usadas en historia no se eliminan',${timestamps("action_reason_status")}
  PRIMARY KEY (status_code_action_reason_status,reason_code_action_reason_status),
  FOREIGN KEY (status_code_action_reason_status) REFERENCES conf_lead_status(code_lead_status),
  FOREIGN KEY (reason_code_action_reason_status) REFERENCES conf_action_reason(code_action_reason)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Aplicabilidad de motivos por etapa; permite separar perdida y seguimiento'`,
    `CREATE TABLE IF NOT EXISTS conf_lead_source (
  code_lead_source VARCHAR(80) NOT NULL COMMENT 'Codigo canonico del canal de captacion; no identifica una conexion ERP',
  name_lead_source VARCHAR(120) NOT NULL COMMENT 'Nombre visible del origen comercial del lead',
  status_lead_source ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Disponibilidad del origen para nuevos leads',${timestamps("lead_source")}
  PRIMARY KEY (code_lead_source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Canales de captacion configurables del CRM'`,
    `CREATE TABLE IF NOT EXISTS conf_lead_interest (
  code_lead_interest VARCHAR(80) NOT NULL COMMENT 'Codigo canonico de clasificacion de interes; distinto de etapa comercial',
  name_lead_interest VARCHAR(180) NOT NULL COMMENT 'Nombre visible de la clasificacion de interes',
  status_lead_interest ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Disponibilidad para nuevas clasificaciones; conserva referencias historicas',${timestamps("lead_interest")}
  PRIMARY KEY (code_lead_interest)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Clasificaciones de interes administrables sin numeros heredados'`,
    `CREATE TABLE IF NOT EXISTS crm_contact (
  id_contact BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad interna de la persona; nunca un identificador de proveedor',
  public_id_contact CHAR(26) NOT NULL COMMENT 'Identificador publico estable del contacto generado por el CRM',
  full_name_contact VARCHAR(250) NOT NULL COMMENT 'Nombre completo de la persona de contacto',
  email_contact VARCHAR(254) NULL COMMENT 'Correo original; no demuestra identidad unica por si mismo',
  normalized_email_contact VARCHAR(254) NULL COMMENT 'Correo normalizado para buscar posibles coincidencias sin fusion automatica',
  phone_contact VARCHAR(50) NULL COMMENT 'Telefono original de la persona sin perder el formato recibido',
  normalized_phone_contact VARCHAR(50) NULL COMMENT 'Telefono normalizado para busqueda; no es clave unica de persona',
  country_code_contact CHAR(2) NULL COMMENT 'Pais confirmado en formato ISO de dos letras; null si se desconoce',
  status_contact ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Actividad del contacto independiente de las etapas de sus leads',${timestamps("contact")}
  created_by_user_id_contact BIGINT UNSIGNED NULL COMMENT 'Usuario interno que creo el contacto; null en operaciones sin usuario conocido',
  updated_by_user_id_contact BIGINT UNSIGNED NULL COMMENT 'Usuario interno responsable de la ultima modificacion conocida',
  deleted_at_contact DATETIME(3) NULL COMMENT 'Fecha UTC del borrado logico; no borra expedientes relacionados',
  PRIMARY KEY (id_contact),
  UNIQUE KEY uq_contact_public (public_id_contact),
  KEY idx_contact_email (normalized_email_contact),
  KEY idx_contact_phone (normalized_phone_contact),
  FOREIGN KEY (created_by_user_id_contact) REFERENCES sec_user(id_user),
  FOREIGN KEY (updated_by_user_id_contact) REFERENCES sec_user(id_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Personas de contacto separadas de sus expedientes comerciales'`,
    `CREATE TABLE IF NOT EXISTS crm_lead (
  id_lead BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Llave interna propia del expediente comercial del CRM',
  public_id_lead CHAR(26) NOT NULL COMMENT 'Identificador publico estable del lead; no cambia al agregar proveedores',
  primary_contact_id_lead BIGINT UNSIGNED NOT NULL COMMENT 'Persona de contacto principal registrada en el CRM',
  owner_user_id_lead BIGINT UNSIGNED NULL COMMENT 'Usuario responsable de sec_user; null mientras no se asigne o concilie; nunca un ID ERP',
  project_id_lead BIGINT UNSIGNED NOT NULL COMMENT 'Proyecto interno de interes; el adaptador resuelve previamente referencias externas',
  campaign_id_lead BIGINT UNSIGNED NOT NULL COMMENT 'Campana interna de captacion del lead',
  subsidiary_id_lead BIGINT UNSIGNED NULL COMMENT 'Subsidiaria interna cuando se conoce y esta conciliada',
  broker_id_lead BIGINT UNSIGNED NULL COMMENT 'Corredor interno relacionado cuando existe una asignacion confirmada',
  source_code_lead VARCHAR(80) NOT NULL COMMENT 'Origen comercial administrable del lead',
  interest_code_lead VARCHAR(80) NULL COMMENT 'Clasificacion de interes opcional y distinta de la etapa comercial',
  status_code_lead VARCHAR(48) NOT NULL DEFAULT 'interested' COMMENT 'Etapa comercial actual; su cambio futuro debe guardar evento y auditoria atomicamente',
  status_lead ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Actividad del registro; perdido no implica inactivo',
  ad_name_lead VARCHAR(250) NULL COMMENT 'Nombre del anuncio cuando se conoce; no guarda un nombre de campo del proveedor',
  company_name_lead VARCHAR(250) NULL COMMENT 'Empresa asociada al expediente cuando negocio la informa',
  currency_code_lead CHAR(3) NULL COMMENT 'Codigo ISO de moneda confirmado; null si no esta conciliado',
  initial_comment_lead TEXT NULL COMMENT 'Comentario inicial; no reemplaza el historial de acciones posteriores',
  initial_contact_template_sent_lead TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Indica envio del template inicial de contacto; no demuestra entrega, lectura ni consentimiento',
  has_related_lead_lead TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Marca de posible relacion con otro lead; no fusiona registros ni bloquea creacion',
  version_lead INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Version local que el escritor incrementa para detectar actualizaciones concurrentes',
  source_created_at_lead DATETIME(3) NULL COMMENT 'Creacion conocida en el origen normalizada a UTC; no se inventa al importar',
  source_updated_at_lead DATETIME(3) NULL COMMENT 'Ultima modificacion conocida en el origen normalizada a UTC',${timestamps("lead")}
  created_by_user_id_lead BIGINT UNSIGNED NULL COMMENT 'Usuario interno que creo el registro local cuando se conoce',
  updated_by_user_id_lead BIGINT UNSIGNED NULL COMMENT 'Usuario interno responsable de la ultima modificacion local conocida',
  inactivated_at_lead DATETIME(3) NULL COMMENT 'Fecha UTC de inactivacion del registro, independiente de perdida comercial',
  deleted_at_lead DATETIME(3) NULL COMMENT 'Fecha UTC del borrado logico sin eliminar el historial',
  PRIMARY KEY (id_lead),
  UNIQUE KEY uq_lead_public (public_id_lead),
  KEY idx_lead_owner (owner_user_id_lead,status_lead,deleted_at_lead,created_at_lead),
  KEY idx_lead_project (project_id_lead,status_code_lead,created_at_lead),
  KEY idx_lead_campaign (campaign_id_lead,created_at_lead),
  KEY idx_lead_updated (updated_at_lead,id_lead),
  FOREIGN KEY (primary_contact_id_lead) REFERENCES crm_contact(id_contact),
  FOREIGN KEY (owner_user_id_lead) REFERENCES sec_user(id_user),
  FOREIGN KEY (project_id_lead) REFERENCES crm_project(id_project),
  FOREIGN KEY (campaign_id_lead) REFERENCES crm_campaign(id_campaign),
  FOREIGN KEY (subsidiary_id_lead) REFERENCES crm_subsidiary(id_subsidiary),
  FOREIGN KEY (broker_id_lead) REFERENCES crm_broker(id_broker),
  FOREIGN KEY (source_code_lead) REFERENCES conf_lead_source(code_lead_source),
  FOREIGN KEY (interest_code_lead) REFERENCES conf_lead_interest(code_lead_interest),
  FOREIGN KEY (status_code_lead) REFERENCES conf_lead_status(code_lead_status),
  FOREIGN KEY (created_by_user_id_lead) REFERENCES sec_user(id_user),
  FOREIGN KEY (updated_by_user_id_lead) REFERENCES sec_user(id_user),
  CONSTRAINT chk_lead_template CHECK (initial_contact_template_sent_lead IN (0,1)),
  CONSTRAINT chk_lead_related CHECK (has_related_lead_lead IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Expediente comercial nativo independiente de la base anterior y de proveedores'`,
    `CREATE TABLE IF NOT EXISTS crm_lead_external_reference (
  id_lead_external_reference BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad interna de la vinculacion del lead con un sistema',
  lead_id_lead_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Lead interno al que corresponde la identidad externa',
  external_system_id_lead_external_reference BIGINT UNSIGNED NOT NULL COMMENT 'Sistema o cuenta configurada; diferencia proveedores aunque repitan el mismo numero',
  external_id_lead_external_reference VARCHAR(180) COLLATE utf8mb4_bin NOT NULL COMMENT 'Identificador externo como texto sensible a mayusculas; no es FK del negocio',
  status_lead_external_reference ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Estado de la vinculacion sin reasignar silenciosamente una identidad',${timestamps("lead_external_reference")}
  PRIMARY KEY (id_lead_external_reference),
  UNIQUE KEY uq_lead_external (external_system_id_lead_external_reference,external_id_lead_external_reference),
  KEY idx_lead_external_lead (lead_id_lead_external_reference,status_lead_external_reference),
  FOREIGN KEY (lead_id_lead_external_reference) REFERENCES crm_lead(id_lead),
  FOREIGN KEY (external_system_id_lead_external_reference) REFERENCES int_external_system(id_external_system),
  CONSTRAINT chk_lead_external_not_empty CHECK (CHAR_LENGTH(TRIM(external_id_lead_external_reference)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Referencias multiples de un lead; incluye vinculacion al sistema anterior sin acoplar el core'`,
    `CREATE TABLE IF NOT EXISTS audit_lead_status_event (
  id_lead_status_event BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad interna del evento comercial',
  public_id_lead_status_event CHAR(26) NOT NULL COMMENT 'Identidad publica estable del evento',
  lead_id_lead_status_event BIGINT UNSIGNED NOT NULL COMMENT 'Lead interno cuya etapa se observa o cambia',
  sequence_lead_status_event INT UNSIGNED NOT NULL COMMENT 'Orden inequívoco de eventos dentro del lead; permite visitas repetidas a una etapa',
  event_kind_lead_status_event ENUM('initial_snapshot','transition') NOT NULL COMMENT 'Distingue estado inicial observado de un cambio comercial conocido',
  from_status_code_lead_status_event VARCHAR(48) NULL COMMENT 'Etapa anterior conocida; null para la observacion inicial',
  to_status_code_lead_status_event VARCHAR(48) NOT NULL COMMENT 'Etapa observada o destino del cambio comercial',
  reason_code_lead_status_event VARCHAR(80) NULL COMMENT 'Motivo propio de esta transicion; obligatorio al cambiar de etapa',
  reason_name_snapshot_lead_status_event VARCHAR(180) NULL COMMENT 'Nombre del motivo al ocurrir el evento; conserva el significado visible si el catalogo cambia',
  comment_lead_status_event TEXT NULL COMMENT 'Explicacion especifica de esta accion, perdida o recuperacion',
  actor_kind_lead_status_event ENUM('user','system','integration') NOT NULL COMMENT 'Tipo de actor que provoco el evento; no confunde importacion con accion humana',
  actor_user_id_lead_status_event BIGINT UNSIGNED NULL COMMENT 'Usuario interno responsable cuando el actor es humano',
  external_system_id_lead_status_event BIGINT UNSIGNED NULL COMMENT 'Sistema configurado responsable cuando la accion procede de una integracion',
  operation_id_lead_status_event VARCHAR(100) NOT NULL COMMENT 'Clave de idempotencia del evento; un reintento no agrega otra perdida',
  occurred_at_lead_status_event DATETIME(3) NULL COMMENT 'Fecha UTC real de la accion; null si la observacion historica no tiene fecha verificable',
  recorded_at_lead_status_event DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha UTC en que el CRM registro esta evidencia; no sustituye la fecha historica',
  PRIMARY KEY (id_lead_status_event),
  UNIQUE KEY uq_lead_event_public (public_id_lead_status_event),
  UNIQUE KEY uq_lead_event_sequence (lead_id_lead_status_event,sequence_lead_status_event),
  UNIQUE KEY uq_lead_event_operation (lead_id_lead_status_event,operation_id_lead_status_event),
  KEY idx_lead_event_destination (to_status_code_lead_status_event,occurred_at_lead_status_event),
  FOREIGN KEY (lead_id_lead_status_event) REFERENCES crm_lead(id_lead),
  FOREIGN KEY (from_status_code_lead_status_event) REFERENCES conf_lead_status(code_lead_status),
  FOREIGN KEY (to_status_code_lead_status_event) REFERENCES conf_lead_status(code_lead_status),
  FOREIGN KEY (to_status_code_lead_status_event,reason_code_lead_status_event) REFERENCES conf_action_reason_status(status_code_action_reason_status,reason_code_action_reason_status),
  FOREIGN KEY (actor_user_id_lead_status_event) REFERENCES sec_user(id_user),
  FOREIGN KEY (external_system_id_lead_status_event) REFERENCES int_external_system(id_external_system),
  CONSTRAINT chk_lead_event_sequence CHECK (sequence_lead_status_event > 0),
  CONSTRAINT chk_lead_event_actor CHECK ((actor_kind_lead_status_event='user' AND actor_user_id_lead_status_event IS NOT NULL AND external_system_id_lead_status_event IS NULL) OR (actor_kind_lead_status_event='system' AND actor_user_id_lead_status_event IS NULL AND external_system_id_lead_status_event IS NULL) OR (actor_kind_lead_status_event='integration' AND actor_user_id_lead_status_event IS NULL AND external_system_id_lead_status_event IS NOT NULL)),
  CONSTRAINT chk_lead_event_kind CHECK ((event_kind_lead_status_event='initial_snapshot' AND from_status_code_lead_status_event IS NULL) OR (event_kind_lead_status_event='transition' AND from_status_code_lead_status_event IS NOT NULL AND from_status_code_lead_status_event<>to_status_code_lead_status_event AND reason_code_lead_status_event IS NOT NULL AND reason_name_snapshot_lead_status_event IS NOT NULL AND occurred_at_lead_status_event IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Historia comercial: cada perdida y recuperacion conserva su motivo y actor propios'`,
] as const;

/** UTC timestamps must not depend on the session timezone used by a future writer. */
export const leadTimestampStatements = ["lead_status", "action_reason", "action_reason_status", "lead_source", "lead_interest", "contact", "lead", "lead_external_reference"].map((entity) => {
    const prefix = ["contact", "lead", "lead_external_reference"].includes(entity) ? "crm" : "conf";
    return `CREATE TRIGGER trg_${entity}_updated_utc BEFORE UPDATE ON ${prefix}_${entity} FOR EACH ROW SET NEW.updated_at_${entity} = UTC_TIMESTAMP(3)`;
});

const initialStatuses = [
    ["interested", "Interesado"],
    ["opportunity", "Oportunidad"],
    ["pre_reservation", "Pre-reserva"],
    ["reservation", "Reserva"],
    ["contract", "Contrato"],
    ["lost", "Perdido"],
    ["follow_up", "Seguimiento"],
] as const;

/** Additive native schema only. A partial DDL failure needs explicit recovery, never silent data loss. */
export const leadsDomainMigration = {
    name: "202610230031_leads_domain",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const identity = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (identity.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Leads migration requires CRM_THINK_V2");
        const targets = readTargetTableNames([...leadStatements]);
        const existing = await sql<{ table_name: string }>`SELECT TABLE_NAME AS table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(targets)})`.execute(db);
        if (existing.rows.length) throw new Error("Existing lead tables require explicit recovery before this migration");
        for (const statement of leadStatements) await sql.raw(statement).execute(db);
        for (const statement of leadTimestampStatements) await sql.raw(statement).execute(db);
        for (const [index, [code, name]] of initialStatuses.entries()) {
            await sql`INSERT INTO conf_lead_status (code_lead_status,name_lead_status,display_order_lead_status) VALUES (${code},${name},${index + 1})`.execute(db);
        }
    },
};
