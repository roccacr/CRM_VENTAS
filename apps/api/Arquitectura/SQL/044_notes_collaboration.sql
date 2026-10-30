-- Schema044: no imported content or delivery to external providers. Apply only through the guarded runner.
ALTER TABLE crm_note
 ADD COLUMN collaboration_version_note INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Version independiente de comandos colaborativos para concurrencia y eventos',
 ADD COLUMN collaboration_updated_at_note DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Ultimo cambio colaborativo UTC actualizado explicitamente',
 ADD CONSTRAINT ck_note_collaboration_version CHECK (collaboration_version_note>0);
CREATE TABLE sec_notification (
 id_notification BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identidad interna ordenable de la notificacion',
 public_id_notification CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'ULID publico de la notificacion individual',
 recipient_user_id_notification BIGINT UNSIGNED NOT NULL COMMENT 'Destinatario nativo exclusivo de lectura y cambios',
 actor_user_id_notification BIGINT UNSIGNED NOT NULL COMMENT 'Autor nativo del evento colaborativo',
 source_event_id_notification BIGINT UNSIGNED NOT NULL COMMENT 'Evento duradero que origino la notificacion',
 note_id_notification BIGINT UNSIGNED NOT NULL COMMENT 'Nota nativa cuya autorizacion vigente debe comprobarse',
 module_code_notification VARCHAR(40) NOT NULL COMMENT 'Modulo inmutable de origen sin otorgar acceso por si mismo',
 kind_notification VARCHAR(16) NOT NULL COMMENT 'Motivo compartida respuesta o mencion sin contenido privado',
 status_notification VARCHAR(16) NOT NULL DEFAULT 'active' COMMENT 'Estado active o suppressed; revocacion permanente por evento',
 read_at_notification DATETIME(3) NULL COMMENT 'Primera lectura explicita UTC del destinatario',
 created_at_notification DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha UTC del evento original para respetar el corte de lectura',
 PRIMARY KEY (id_notification),
 UNIQUE KEY uq_notification_public (public_id_notification),
 UNIQUE KEY uq_notification_event_recipient (source_event_id_notification,recipient_user_id_notification),
 KEY ix_notification_recipient_status (recipient_user_id_notification,status_notification,created_at_notification,id_notification),
 KEY ix_notification_note_recipient (note_id_notification,recipient_user_id_notification,status_notification),
 CONSTRAINT fk_notification_recipient FOREIGN KEY (recipient_user_id_notification) REFERENCES sec_user(id_user),
 CONSTRAINT fk_notification_actor FOREIGN KEY (actor_user_id_notification) REFERENCES sec_user(id_user),
 CONSTRAINT fk_notification_event FOREIGN KEY (source_event_id_notification) REFERENCES int_event_outbox(id_event_outbox),
 CONSTRAINT fk_notification_note FOREIGN KEY (note_id_notification) REFERENCES crm_note(id_note),
 CONSTRAINT ck_notification_kind CHECK (kind_notification IN ('shared','reply','mention')),
 CONSTRAINT ck_notification_status CHECK (status_notification IN ('active','suppressed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Campana interna con metadata exclusivamente y autorizacion vigente obligatoria';
