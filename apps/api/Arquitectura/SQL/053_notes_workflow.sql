-- Native schema only. The existing author is never changed; no imported notes or credentials.
CREATE TABLE crm_note_task (
 note_id_note_task BIGINT UNSIGNED NOT NULL COMMENT 'Nota nativa unica que mantiene autoria inmutable y ACL colaborativa',
 assignee_user_id_note_task BIGINT UNSIGNED NULL COMMENT 'Responsable opcional nativo que debe ser autor o invitado vigente',
 due_at_note_task DATETIME(3) NULL COMMENT 'Vencimiento opcional UTC independiente de recordatorios personales',
 version_note_task INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Version optimista independiente de contenido y colaboracion',
 updated_at_note_task DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Ultima modificacion UTC del responsable o vencimiento',
 PRIMARY KEY (note_id_note_task),
 KEY ix_note_task_assignee_due (assignee_user_id_note_task,due_at_note_task,note_id_note_task),
 CONSTRAINT fk_note_task_note FOREIGN KEY (note_id_note_task) REFERENCES crm_note(id_note),
 CONSTRAINT fk_note_task_assignee FOREIGN KEY (assignee_user_id_note_task) REFERENCES sec_user(id_user),
 CONSTRAINT ck_note_task_version CHECK (version_note_task>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Responsable y fecha de tarea sin cambiar autoria ni permisos';
CREATE TABLE crm_note_workflow_event (
 id_note_workflow_event INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad monotona del aviso programado compatible con version de outbox e idempotencia',
 note_id_note_workflow_event BIGINT UNSIGNED NOT NULL COMMENT 'Nota nativa cuyo estado abierto y ACL se revalidan al entregar',
 recipient_user_id_note_workflow_event BIGINT UNSIGNED NOT NULL COMMENT 'Destinatario nativo exclusivo del recordatorio o aviso de tarea',
 kind_note_workflow_event VARCHAR(16) NOT NULL COMMENT 'Motivo assigned reminder o due con recordatorio personal independiente',
 scheduled_at_note_workflow_event DATETIME(3) NOT NULL COMMENT 'Momento original UTC elegido para entrega aunque el navegador este cerrado',
 available_at_note_workflow_event DATETIME(3) NOT NULL COMMENT 'Proxima entrega UTC o vencimiento de lease para recuperar procesos muertos',
 status_note_workflow_event VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'Estado pending processing delivered cancelled o suppressed sin reactivar avisos obsoletos',
 attempts_note_workflow_event INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Token creciente de fencing para impedir confirmacion de leases antiguos',
 PRIMARY KEY (id_note_workflow_event),
 KEY ix_note_workflow_claim (status_note_workflow_event,available_at_note_workflow_event,id_note_workflow_event),
 KEY ix_note_workflow_note_recipient (note_id_note_workflow_event,recipient_user_id_note_workflow_event,kind_note_workflow_event,id_note_workflow_event),
 CONSTRAINT fk_note_workflow_note FOREIGN KEY (note_id_note_workflow_event) REFERENCES crm_note(id_note),
 CONSTRAINT fk_note_workflow_recipient FOREIGN KEY (recipient_user_id_note_workflow_event) REFERENCES sec_user(id_user),
 CONSTRAINT ck_note_workflow_kind CHECK (kind_note_workflow_event IN ('assigned','reminder','due')),
 CONSTRAINT ck_note_workflow_status CHECK (status_note_workflow_event IN ('pending','processing','delivered','cancelled','suppressed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cola durable UTC con leases y revalidacion por nota antes de notificar';
ALTER TABLE sec_notification DROP CHECK ck_notification_kind,
 MODIFY COLUMN kind_notification VARCHAR(16) NOT NULL COMMENT 'Motivo shared reply mention assigned reminder o due sin contenido privado',
 ADD CONSTRAINT ck_notification_kind CHECK (kind_notification IN ('shared','reply','mention','assigned','reminder','due'));
