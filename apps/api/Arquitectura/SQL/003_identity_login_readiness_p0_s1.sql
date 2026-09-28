-- ============================================================================
-- CRM_THINK_V2 - Evolucion schema-only para preparar login real de identidad
-- Version documental: P0-S1 login readiness
--
-- Proposito:
-- - permitir cookie de sesion con token opaco hasheado;
-- - agregar lockout persistente para login local;
-- - agregar tokens opacos hasheados para activacion/reset local;
-- - conservar public_id_auth_session solo para soporte/auditoria interna.
--
-- Esta migracion NO crea usuarios, NO inserta datos, NO toca crmdatabase-api y
-- NO debe ejecutarse sin autorizacion escrita en la ley vigente.
--
-- Nota de operacion:
-- - este archivo documenta el DDL objetivo;
-- - la ejecucion idempotente debe hacerse por el runner schema-only aprobado
--   (`202609250003_identity_login_readiness`), que valida existencia de columnas
--   e indices antes de aplicar cambios.
-- ============================================================================

USE CRM_THINK_V2;

ALTER TABLE sec_auth_session
  ADD COLUMN token_hash_auth_session VARCHAR(255) NULL COMMENT 'Hash HMAC del token opaco de sesion; nunca almacena el token plano.' AFTER public_id_auth_session;

ALTER TABLE sec_auth_session
  ADD UNIQUE KEY uq_sec_auth_session_token_hash (token_hash_auth_session);

ALTER TABLE sec_auth_identity
  ADD COLUMN failed_login_count_auth_identity INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Contador persistente de intentos fallidos de login local.' AFTER password_hash_auth_identity,
  ADD COLUMN locked_until_auth_identity DATETIME(3) NULL COMMENT 'Fecha y hora hasta la que queda bloqueada temporalmente la identidad local.' AFTER failed_login_count_auth_identity,
  ADD COLUMN last_failed_login_at_auth_identity DATETIME(3) NULL COMMENT 'Ultima fecha y hora de intento fallido de login local.' AFTER locked_until_auth_identity;

CREATE TABLE IF NOT EXISTS sec_local_password_reset_token (
  id_local_password_reset_token BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno del token de activacion/reset local.',
  auth_identity_id_local_password_reset_token BIGINT UNSIGNED NOT NULL COMMENT 'Identidad local que solicito activacion o reset de clave.',
  token_hash_local_password_reset_token VARCHAR(255) NOT NULL COMMENT 'Hash HMAC del token opaco de reset; nunca almacena el token plano.',
  status_local_password_reset_token VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado del token: active, used, revoked o expired.',
  requested_at_local_password_reset_token DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de solicitud del token.',
  expires_at_local_password_reset_token DATETIME(3) NOT NULL COMMENT 'Fecha y hora de expiracion del token.',
  used_at_local_password_reset_token DATETIME(3) NULL COMMENT 'Fecha y hora en que el token fue consumido correctamente.',
  revoked_at_local_password_reset_token DATETIME(3) NULL COMMENT 'Fecha y hora de revocacion manual o automatica del token.',
  ip_address_local_password_reset_token VARCHAR(80) NULL COMMENT 'Direccion IP desde donde se pidio el reset.',
  user_agent_local_password_reset_token VARCHAR(500) NULL COMMENT 'User agent desde donde se pidio el reset.',
  active_key_local_password_reset_token TINYINT AS (CASE WHEN status_local_password_reset_token = 'active' THEN 1 ELSE NULL END) STORED COMMENT 'Clave generada para permitir solo un token activo por identidad y conservar historicos usados, revocados o expirados.',
  PRIMARY KEY (id_local_password_reset_token),
  UNIQUE KEY uq_sec_local_password_reset_token_hash (token_hash_local_password_reset_token),
  UNIQUE KEY uq_sec_local_password_reset_active (auth_identity_id_local_password_reset_token, active_key_local_password_reset_token),
  KEY ix_sec_local_password_reset_identity_status (auth_identity_id_local_password_reset_token, status_local_password_reset_token),
  KEY ix_sec_local_password_reset_expires_at (expires_at_local_password_reset_token),
  CONSTRAINT fk_sec_local_password_reset_identity FOREIGN KEY (auth_identity_id_local_password_reset_token) REFERENCES sec_auth_identity (id_auth_identity) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Tokens opacos hasheados para activacion y reset de login local.';

-- Paso operativo posterior, solo cuando no existan sesiones legacy dependientes
-- de public_id como cookie:
-- ALTER TABLE sec_auth_session MODIFY token_hash_auth_session VARCHAR(255) NOT NULL COMMENT 'Hash HMAC del token opaco de sesion; nunca almacena el token plano.';
