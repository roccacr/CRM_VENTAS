-- CRM_THINK_V2 - P0-S1 identity schema.
-- Controlled architecture artifact only. Do not execute in production without owner approval.
-- Source docs: 26, 29, 31 and 32 under apps/api/Arquitectura.

CREATE DATABASE IF NOT EXISTS `CRM_THINK_V2`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `CRM_THINK_V2`;

CREATE TABLE IF NOT EXISTS sec_user (
  id_user BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno del usuario para relaciones internas del CRM.',
  public_id_user CHAR(26) NOT NULL COMMENT 'Identificador publico del usuario usado por API y frontend sin exponer el id interno.',
  email_user VARCHAR(255) NOT NULL COMMENT 'Correo principal de la persona interna del CRM.',
  normalized_email_user VARCHAR(255) NOT NULL COMMENT 'Correo normalizado en minusculas para busqueda y unicidad.',
  display_name_user VARCHAR(180) NOT NULL COMMENT 'Nombre visible del usuario dentro del CRM.',
  status_user VARCHAR(40) NOT NULL DEFAULT 'pending' COMMENT 'Estado operativo del usuario: active, inactive, blocked, pending o archived.',
  permission_version_user INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Version que cambia cuando se modifican roles, areas, permisos directos o estado del usuario.',
  last_login_at_user DATETIME(3) NULL COMMENT 'Ultima fecha y hora de login exitoso del usuario.',
  created_at_user DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de creacion del usuario.',
  created_by_user_id_user BIGINT UNSIGNED NULL COMMENT 'Usuario que creo este usuario; puede ser nulo durante el bootstrap inicial.',
  updated_at_user DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de la ultima actualizacion del usuario.',
  updated_by_user_id_user BIGINT UNSIGNED NULL COMMENT 'Usuario que actualizo este usuario por ultima vez.',
  deleted_at_user DATETIME(3) NULL COMMENT 'Fecha y hora de borrado logico del usuario.',
  deleted_by_user_id_user BIGINT UNSIGNED NULL COMMENT 'Usuario que aplico el borrado logico del usuario.',
  PRIMARY KEY (id_user),
  UNIQUE KEY uq_sec_user_public_id_user (public_id_user),
  UNIQUE KEY uq_sec_user_normalized_email_user (normalized_email_user),
  KEY ix_sec_user_status_user (status_user),
  KEY ix_sec_user_permission_version_user (permission_version_user),
  CONSTRAINT fk_sec_user_created_by FOREIGN KEY (created_by_user_id_user) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_user_updated_by FOREIGN KEY (updated_by_user_id_user) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_user_deleted_by FOREIGN KEY (deleted_by_user_id_user) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Personas internas que pueden usar o ser referenciadas por el CRM.';

CREATE TABLE IF NOT EXISTS sec_auth_identity (
  id_auth_identity BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la identidad de autenticacion.',
  user_id_auth_identity BIGINT UNSIGNED NOT NULL COMMENT 'Usuario interno al que pertenece esta forma de login.',
  provider_code_auth_identity VARCHAR(40) NOT NULL COMMENT 'Proveedor de autenticacion: microsoft o local.',
  provider_subject_auth_identity VARCHAR(255) NULL COMMENT 'Identificador unico entregado por el proveedor de autenticacion, por ejemplo subject de Microsoft.',
  email_auth_identity VARCHAR(255) NOT NULL COMMENT 'Correo usado por esta identidad de autenticacion.',
  normalized_email_auth_identity VARCHAR(255) NOT NULL COMMENT 'Correo normalizado para login, soporte y busqueda.',
  password_hash_auth_identity VARCHAR(255) NULL COMMENT 'Hash Argon2id o bcrypt para login local; nunca almacena contrasena en texto plano.',
  status_auth_identity VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado de esta identidad de login: active, inactive o blocked.',
  last_used_at_auth_identity DATETIME(3) NULL COMMENT 'Ultima fecha y hora en que se uso esta identidad para autenticar.',
  created_at_auth_identity DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de creacion de la identidad de autenticacion.',
  updated_at_auth_identity DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de la ultima actualizacion de la identidad de autenticacion.',
  deleted_at_auth_identity DATETIME(3) NULL COMMENT 'Fecha y hora de borrado logico de la identidad de autenticacion.',
  PRIMARY KEY (id_auth_identity),
  KEY ix_sec_auth_identity_user_id (user_id_auth_identity),
  UNIQUE KEY uq_sec_auth_identity_provider_subject (provider_code_auth_identity, provider_subject_auth_identity),
  UNIQUE KEY uq_sec_auth_identity_provider_email (provider_code_auth_identity, normalized_email_auth_identity),
  CONSTRAINT fk_sec_auth_identity_user FOREIGN KEY (user_id_auth_identity) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Formas de inicio de sesion asociadas a usuarios internos.';

CREATE TABLE IF NOT EXISTS sec_auth_session (
  id_auth_session BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la sesion backend.',
  public_id_auth_session CHAR(26) NOT NULL COMMENT 'Identificador publico de la sesion para soporte y auditoria interna.',
  user_id_auth_session BIGINT UNSIGNED NOT NULL COMMENT 'Usuario interno propietario de la sesion.',
  auth_identity_id_auth_session BIGINT UNSIGNED NOT NULL COMMENT 'Identidad de autenticacion usada para crear la sesion.',
  permission_version_auth_session INT UNSIGNED NOT NULL COMMENT 'Version de permisos del usuario al emitir la sesion.',
  status_auth_session VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado de la sesion: active, expired o revoked.',
  ip_address_auth_session VARCHAR(80) NULL COMMENT 'Direccion IP desde donde se creo o uso la sesion.',
  user_agent_auth_session VARCHAR(500) NULL COMMENT 'User agent del navegador o cliente asociado a la sesion.',
  created_at_auth_session DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de creacion de la sesion.',
  expires_at_auth_session DATETIME(3) NOT NULL COMMENT 'Fecha y hora maxima de expiracion de la sesion.',
  revoked_at_auth_session DATETIME(3) NULL COMMENT 'Fecha y hora de revocacion manual o automatica de la sesion.',
  revoked_by_user_id_auth_session BIGINT UNSIGNED NULL COMMENT 'Usuario que revoco la sesion, si aplica.',
  PRIMARY KEY (id_auth_session),
  UNIQUE KEY uq_sec_auth_session_public_id (public_id_auth_session),
  KEY ix_sec_auth_session_user_status (user_id_auth_session, status_auth_session),
  KEY ix_sec_auth_session_expires_at (expires_at_auth_session),
  CONSTRAINT fk_sec_auth_session_user FOREIGN KEY (user_id_auth_session) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_auth_session_identity FOREIGN KEY (auth_identity_id_auth_session) REFERENCES sec_auth_identity (id_auth_identity) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_auth_session_revoked_by FOREIGN KEY (revoked_by_user_id_auth_session) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Sesiones backend del patron BFF emitidas por el API.';

CREATE TABLE IF NOT EXISTS sec_refresh_token (
  id_refresh_token BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno del refresh token.',
  auth_session_id_refresh_token BIGINT UNSIGNED NOT NULL COMMENT 'Sesion backend a la que pertenece el refresh token.',
  token_family_id_refresh_token CHAR(26) NOT NULL COMMENT 'Identificador de familia usado para revocar tokens relacionados ante reuso.',
  token_hash_refresh_token VARCHAR(255) NOT NULL COMMENT 'Hash del refresh token; nunca almacena el token plano.',
  status_refresh_token VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado del refresh token: active, rotated, reused, revoked o expired.',
  issued_at_refresh_token DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de emision del refresh token.',
  expires_at_refresh_token DATETIME(3) NOT NULL COMMENT 'Fecha y hora de expiracion del refresh token.',
  rotated_at_refresh_token DATETIME(3) NULL COMMENT 'Fecha y hora en que el token fue reemplazado por rotacion.',
  revoked_at_refresh_token DATETIME(3) NULL COMMENT 'Fecha y hora de revocacion del refresh token.',
  revoked_reason_refresh_token VARCHAR(120) NULL COMMENT 'Motivo tecnico o de seguridad de la revocacion del refresh token.',
  PRIMARY KEY (id_refresh_token),
  UNIQUE KEY uq_sec_refresh_token_hash (token_hash_refresh_token),
  KEY ix_sec_refresh_token_session_status (auth_session_id_refresh_token, status_refresh_token),
  KEY ix_sec_refresh_token_family (token_family_id_refresh_token, status_refresh_token),
  CONSTRAINT fk_sec_refresh_token_session FOREIGN KEY (auth_session_id_refresh_token) REFERENCES sec_auth_session (id_auth_session) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Refresh tokens rotados y guardados como hash para sesiones BFF.';

CREATE TABLE IF NOT EXISTS sec_role (
  id_role BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno del rol.',
  code_role VARCHAR(80) NOT NULL COMMENT 'Codigo estable del rol, por ejemplo owner, jefe_area o vendedor.',
  name_role VARCHAR(120) NOT NULL COMMENT 'Nombre visible del rol para administracion.',
  description_role VARCHAR(255) NULL COMMENT 'Explicacion funcional del rol.',
  status_role VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado del rol: active o inactive.',
  created_at_role DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de creacion del rol.',
  updated_at_role DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de la ultima actualizacion del rol.',
  deleted_at_role DATETIME(3) NULL COMMENT 'Fecha y hora de borrado logico del rol.',
  PRIMARY KEY (id_role),
  UNIQUE KEY uq_sec_role_code_role (code_role),
  KEY ix_sec_role_status_role (status_role)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Catalogo de roles generales sin nombres de areas.';

CREATE TABLE IF NOT EXISTS sec_permission (
  id_permission BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno del permiso atomico.',
  code_permission VARCHAR(120) NOT NULL COMMENT 'Codigo estable del permiso, por ejemplo user.create o role.assign.',
  module_code_permission VARCHAR(80) NOT NULL COMMENT 'Modulo propietario del permiso.',
  action_code_permission VARCHAR(80) NOT NULL COMMENT 'Accion principal que representa el permiso.',
  description_permission VARCHAR(255) NULL COMMENT 'Descripcion funcional del permiso para soporte y jefatura.',
  status_permission VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado del permiso: active o inactive.',
  created_at_permission DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de creacion del permiso.',
  updated_at_permission DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de la ultima actualizacion del permiso.',
  PRIMARY KEY (id_permission),
  UNIQUE KEY uq_sec_permission_code (code_permission),
  KEY ix_sec_permission_module_action (module_code_permission, action_code_permission)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Catalogo atomico de acciones permitidas en el CRM.';

CREATE TABLE IF NOT EXISTS sec_user_role (
  id_user_role BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la asignacion usuario-rol.',
  user_id_user_role BIGINT UNSIGNED NOT NULL COMMENT 'Usuario que recibe el rol.',
  role_id_user_role BIGINT UNSIGNED NOT NULL COMMENT 'Rol asignado al usuario.',
  status_user_role VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado de la asignacion: active o inactive.',
  active_key_user_role TINYINT AS (CASE WHEN status_user_role = 'active' THEN 1 ELSE NULL END) STORED COMMENT 'Clave generada para permitir solo una asignacion activa y conservar multiples historicos inactivos.',
  assigned_at_user_role DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de asignacion del rol.',
  assigned_by_user_id_user_role BIGINT UNSIGNED NULL COMMENT 'Usuario que asigno el rol.',
  revoked_at_user_role DATETIME(3) NULL COMMENT 'Fecha y hora en que se revoco la asignacion del rol.',
  revoked_by_user_id_user_role BIGINT UNSIGNED NULL COMMENT 'Usuario que revoco la asignacion del rol.',
  PRIMARY KEY (id_user_role),
  UNIQUE KEY uq_sec_user_role_active (user_id_user_role, role_id_user_role, active_key_user_role),
  KEY ix_sec_user_role_role (role_id_user_role),
  CONSTRAINT fk_sec_user_role_user FOREIGN KEY (user_id_user_role) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_user_role_role FOREIGN KEY (role_id_user_role) REFERENCES sec_role (id_role) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_user_role_assigned_by FOREIGN KEY (assigned_by_user_id_user_role) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_user_role_revoked_by FOREIGN KEY (revoked_by_user_id_user_role) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Roles asignados a usuarios internos.';

CREATE TABLE IF NOT EXISTS sec_role_permission (
  id_role_permission BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la relacion rol-permiso.',
  role_id_role_permission BIGINT UNSIGNED NOT NULL COMMENT 'Rol que contiene el permiso.',
  permission_id_role_permission BIGINT UNSIGNED NOT NULL COMMENT 'Permiso incluido en el rol.',
  status_role_permission VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado de la relacion rol-permiso: active o inactive.',
  active_key_role_permission TINYINT AS (CASE WHEN status_role_permission = 'active' THEN 1 ELSE NULL END) STORED COMMENT 'Clave generada para permitir solo una relacion activa y conservar historicos inactivos.',
  created_at_role_permission DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de creacion de la relacion rol-permiso.',
  PRIMARY KEY (id_role_permission),
  UNIQUE KEY uq_sec_role_permission_role_permission (role_id_role_permission, permission_id_role_permission, active_key_role_permission),
  KEY ix_sec_role_permission_permission (permission_id_role_permission),
  CONSTRAINT fk_sec_role_permission_role FOREIGN KEY (role_id_role_permission) REFERENCES sec_role (id_role) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_role_permission_permission FOREIGN KEY (permission_id_role_permission) REFERENCES sec_permission (id_permission) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Permisos incluidos por cada rol.';

CREATE TABLE IF NOT EXISTS sec_org_unit (
  id_org_unit BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno del area o equipo.',
  public_id_org_unit CHAR(26) NOT NULL COMMENT 'Identificador publico del area o equipo usado por API y frontend.',
  parent_org_unit_id_org_unit BIGINT UNSIGNED NULL COMMENT 'Area padre para construir la jerarquia organizacional.',
  code_org_unit VARCHAR(80) NOT NULL COMMENT 'Codigo estable del area, por ejemplo ventas o mercadeo.',
  name_org_unit VARCHAR(160) NOT NULL COMMENT 'Nombre visible del area o equipo.',
  status_org_unit VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado del area: active o inactive.',
  sort_order_org_unit INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Orden visual dentro del mismo nivel de la jerarquia.',
  created_at_org_unit DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de creacion del area.',
  updated_at_org_unit DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de la ultima actualizacion del area.',
  deleted_at_org_unit DATETIME(3) NULL COMMENT 'Fecha y hora de borrado logico del area.',
  PRIMARY KEY (id_org_unit),
  UNIQUE KEY uq_sec_org_unit_public_id (public_id_org_unit),
  UNIQUE KEY uq_sec_org_unit_code (code_org_unit),
  KEY ix_sec_org_unit_parent_status (parent_org_unit_id_org_unit, status_org_unit),
  CONSTRAINT fk_sec_org_unit_parent FOREIGN KEY (parent_org_unit_id_org_unit) REFERENCES sec_org_unit (id_org_unit) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Areas y equipos de la empresa en estructura de arbol.';

CREATE TABLE IF NOT EXISTS sec_user_org_unit (
  id_user_org_unit BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la asignacion usuario-area.',
  user_id_user_org_unit BIGINT UNSIGNED NOT NULL COMMENT 'Usuario asignado al area o equipo.',
  org_unit_id_user_org_unit BIGINT UNSIGNED NOT NULL COMMENT 'Area o equipo asignado al usuario.',
  membership_code_user_org_unit VARCHAR(40) NOT NULL COMMENT 'Tipo de participacion: member, leader, assistant_leader o supervisor.',
  scope_code_user_org_unit VARCHAR(40) NOT NULL COMMENT 'Alcance: self, assigned, own_area, own_area_and_children o all_areas.',
  status_user_org_unit VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado de la asignacion usuario-area: active o inactive.',
  active_key_user_org_unit TINYINT AS (CASE WHEN status_user_org_unit = 'active' THEN 1 ELSE NULL END) STORED COMMENT 'Clave generada para permitir solo una asignacion activa y conservar multiples historicos inactivos.',
  assigned_at_user_org_unit DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de asignacion al area.',
  assigned_by_user_id_user_org_unit BIGINT UNSIGNED NULL COMMENT 'Usuario que asigno el area.',
  revoked_at_user_org_unit DATETIME(3) NULL COMMENT 'Fecha y hora de revocacion de la asignacion al area.',
  revoked_by_user_id_user_org_unit BIGINT UNSIGNED NULL COMMENT 'Usuario que revoco la asignacion al area.',
  PRIMARY KEY (id_user_org_unit),
  UNIQUE KEY uq_sec_user_org_unit_active (user_id_user_org_unit, org_unit_id_user_org_unit, membership_code_user_org_unit, scope_code_user_org_unit, active_key_user_org_unit),
  KEY ix_sec_user_org_unit_org_status (org_unit_id_user_org_unit, status_user_org_unit),
  KEY ix_sec_user_org_unit_user_status (user_id_user_org_unit, status_user_org_unit),
  CONSTRAINT fk_sec_user_org_unit_user FOREIGN KEY (user_id_user_org_unit) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_user_org_unit_org FOREIGN KEY (org_unit_id_user_org_unit) REFERENCES sec_org_unit (id_org_unit) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_user_org_unit_assigned_by FOREIGN KEY (assigned_by_user_id_user_org_unit) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_user_org_unit_revoked_by FOREIGN KEY (revoked_by_user_id_user_org_unit) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Areas, equipos, funciones y alcances asignados a usuarios.';

CREATE TABLE IF NOT EXISTS sec_user_permission_override (
  id_user_permission_override BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno del override de permiso.',
  user_id_user_permission_override BIGINT UNSIGNED NOT NULL COMMENT 'Usuario afectado por el override de permiso.',
  permission_id_user_permission_override BIGINT UNSIGNED NOT NULL COMMENT 'Permiso agregado o denegado por el override.',
  effect_user_permission_override VARCHAR(20) NOT NULL COMMENT 'Efecto del override: allow o deny.',
  reason_user_permission_override VARCHAR(255) NOT NULL COMMENT 'Motivo de negocio para agregar o quitar el permiso puntual.',
  status_user_permission_override VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado del override: active o inactive.',
  active_key_user_permission_override TINYINT AS (CASE WHEN status_user_permission_override = 'active' THEN 1 ELSE NULL END) STORED COMMENT 'Clave generada para permitir solo un override activo y conservar multiples historicos inactivos.',
  starts_at_user_permission_override DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora desde la que aplica el override.',
  ends_at_user_permission_override DATETIME(3) NULL COMMENT 'Fecha y hora opcional de vencimiento del override.',
  created_by_user_id_user_permission_override BIGINT UNSIGNED NULL COMMENT 'Usuario que creo el override.',
  created_at_user_permission_override DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de creacion del override.',
  revoked_by_user_id_user_permission_override BIGINT UNSIGNED NULL COMMENT 'Usuario que revoco el override.',
  revoked_at_user_permission_override DATETIME(3) NULL COMMENT 'Fecha y hora de revocacion del override.',
  PRIMARY KEY (id_user_permission_override),
  UNIQUE KEY uq_sec_user_permission_override_active (user_id_user_permission_override, permission_id_user_permission_override, effect_user_permission_override, active_key_user_permission_override),
  KEY ix_sec_user_permission_override_user_status (user_id_user_permission_override, status_user_permission_override),
  CONSTRAINT fk_sec_user_permission_override_user FOREIGN KEY (user_id_user_permission_override) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_user_permission_override_perm FOREIGN KEY (permission_id_user_permission_override) REFERENCES sec_permission (id_permission) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_user_permission_override_created_by FOREIGN KEY (created_by_user_id_user_permission_override) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sec_user_permission_override_revoked_by FOREIGN KEY (revoked_by_user_id_user_permission_override) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Permisos puntuales agregados o quitados a una persona.';

CREATE TABLE IF NOT EXISTS int_external_system (
  id_external_system BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno del sistema externo.',
  code_external_system VARCHAR(80) NOT NULL COMMENT 'Codigo estable del sistema externo, por ejemplo netsuite u odoo.',
  name_external_system VARCHAR(160) NOT NULL COMMENT 'Nombre visible del sistema externo.',
  status_external_system VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado del sistema externo: active, inactive o pending.',
  created_at_external_system DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de creacion del sistema externo.',
  updated_at_external_system DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de la ultima actualizacion del sistema externo.',
  PRIMARY KEY (id_external_system),
  UNIQUE KEY uq_int_external_system_code (code_external_system)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Catalogo generico de sistemas externos.';

CREATE TABLE IF NOT EXISTS int_user_external_identity (
  id_user_external_identity BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la relacion usuario-sistema externo.',
  user_id_user_external_identity BIGINT UNSIGNED NOT NULL COMMENT 'Usuario interno relacionado con el sistema externo.',
  external_system_id_user_external_identity BIGINT UNSIGNED NOT NULL COMMENT 'Sistema externo al que pertenece el identificador externo.',
  external_user_id_user_external_identity VARCHAR(180) NOT NULL COMMENT 'Identificador del usuario en el sistema externo.',
  external_username_user_external_identity VARCHAR(180) NULL COMMENT 'Nombre o correo del usuario en el sistema externo si aplica.',
  status_user_external_identity VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado de la relacion externa: active o inactive.',
  metadata_user_external_identity JSON NULL COMMENT 'Metadata no critica del sistema externo que no se consulta frecuentemente.',
  created_at_user_external_identity DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de creacion de la relacion externa.',
  updated_at_user_external_identity DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de la ultima actualizacion de la relacion externa.',
  deleted_at_user_external_identity DATETIME(3) NULL COMMENT 'Fecha y hora de borrado logico de la relacion externa.',
  PRIMARY KEY (id_user_external_identity),
  UNIQUE KEY uq_int_user_external_identity_external (external_system_id_user_external_identity, external_user_id_user_external_identity),
  KEY ix_int_user_external_identity_user (user_id_user_external_identity, status_user_external_identity),
  CONSTRAINT fk_int_user_external_identity_user FOREIGN KEY (user_id_user_external_identity) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_int_user_external_identity_system FOREIGN KEY (external_system_id_user_external_identity) REFERENCES int_external_system (id_external_system) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Ids externos de usuarios internos por sistema externo.';

CREATE TABLE IF NOT EXISTS audit_security_event (
  id_security_event BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno del evento de seguridad.',
  public_id_security_event CHAR(26) NOT NULL COMMENT 'Identificador publico del evento para soporte y auditoria.',
  event_type_security_event VARCHAR(120) NOT NULL COMMENT 'Tipo de evento de seguridad, por ejemplo login_success o role_assigned.',
  actor_user_id_security_event BIGINT UNSIGNED NULL COMMENT 'Usuario que ejecuto la accion; puede ser nulo durante seeds o procesos de sistema.',
  target_user_id_security_event BIGINT UNSIGNED NULL COMMENT 'Usuario afectado por la accion, si aplica.',
  summary_security_event VARCHAR(255) NOT NULL COMMENT 'Resumen legible del evento de seguridad.',
  reason_security_event VARCHAR(255) NULL COMMENT 'Motivo indicado por el usuario cuando aplica.',
  ip_address_security_event VARCHAR(80) NULL COMMENT 'Direccion IP desde donde se ejecuto la accion.',
  user_agent_security_event VARCHAR(500) NULL COMMENT 'User agent del navegador o cliente que ejecuto la accion.',
  metadata_security_event JSON NULL COMMENT 'Snapshot tecnico no critico del evento.',
  created_at_security_event DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora exacta del evento de seguridad.',
  PRIMARY KEY (id_security_event),
  UNIQUE KEY uq_audit_security_event_public_id (public_id_security_event),
  KEY ix_audit_security_event_actor_date (actor_user_id_security_event, created_at_security_event),
  KEY ix_audit_security_event_target_date (target_user_id_security_event, created_at_security_event),
  KEY ix_audit_security_event_type_date (event_type_security_event, created_at_security_event),
  CONSTRAINT fk_audit_security_event_actor FOREIGN KEY (actor_user_id_security_event) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_audit_security_event_target FOREIGN KEY (target_user_id_security_event) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Bitacora append-only de accesos, roles, permisos, areas y seguridad.';
