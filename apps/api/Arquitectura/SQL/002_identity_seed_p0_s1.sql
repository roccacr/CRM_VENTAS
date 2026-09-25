-- CRM_THINK_V2 - P0-S1 identity seeds.
-- Controlled architecture artifact only. Do not execute in production without owner approval.
-- This seed intentionally does not create owner or jefe_general users because real email/name are still pending.

USE `CRM_THINK_V2`;

START TRANSACTION;

INSERT INTO sec_permission (
  code_permission,
  module_code_permission,
  action_code_permission,
  description_permission,
  status_permission
) VALUES
  ('auth.login', 'auth', 'login', 'Permite iniciar sesion.', 'active'),
  ('auth.logout', 'auth', 'logout', 'Permite cerrar sesion.', 'active'),
  ('user.view_self', 'user', 'view_self', 'Permite ver el propio perfil.', 'active'),
  ('user.view_list', 'user', 'view_list', 'Permite ver lista de usuarios dentro del alcance.', 'active'),
  ('user.view_detail', 'user', 'view_detail', 'Permite ver detalle de usuario dentro del alcance.', 'active'),
  ('user.create', 'user', 'create', 'Permite crear usuarios.', 'active'),
  ('user.update', 'user', 'update', 'Permite modificar usuarios.', 'active'),
  ('user.activate', 'user', 'activate', 'Permite activar usuarios.', 'active'),
  ('user.deactivate', 'user', 'deactivate', 'Permite desactivar usuarios.', 'active'),
  ('role.view', 'role', 'view', 'Permite ver roles.', 'active'),
  ('role.assign', 'role', 'assign', 'Permite asignar roles dentro del alcance permitido.', 'active'),
  ('permission.view', 'permission', 'view', 'Permite ver permisos.', 'active'),
  ('permission.override', 'permission', 'override', 'Permite agregar o quitar permisos puntuales a un usuario dentro del alcance.', 'active'),
  ('org.view', 'org', 'view', 'Permite ver areas y equipos.', 'active'),
  ('org.manage', 'org', 'manage', 'Permite crear, editar, activar o desactivar areas.', 'active'),
  ('org.assign_user', 'org', 'assign_user', 'Permite asignar usuarios a areas o equipos.', 'active'),
  ('audit.security.view', 'audit', 'security_view', 'Permite ver auditoria de seguridad.', 'active')
ON DUPLICATE KEY UPDATE
  module_code_permission = VALUES(module_code_permission),
  action_code_permission = VALUES(action_code_permission),
  description_permission = VALUES(description_permission),
  status_permission = VALUES(status_permission);

INSERT INTO sec_role (
  code_role,
  name_role,
  description_role,
  status_role
) VALUES
  ('owner', 'Owner', 'Control maximo del CRM. Uso limitado a muy pocas personas.', 'active'),
  ('jefe_general', 'Jefe General', 'Supervision general de negocio sobre varias o todas las areas segun alcance.', 'active'),
  ('gerente', 'Gerente', 'Gestion amplia de operacion segun areas asignadas.', 'active'),
  ('jefe_area', 'Jefe de Area', 'Supervision de una o varias areas especificas.', 'active'),
  ('subjefe_area', 'Subjefe de Area', 'Apoyo de supervision en una o varias areas o subareas.', 'active'),
  ('supervisor', 'Supervisor', 'Supervision operativa de equipo o vendedores asignados.', 'active'),
  ('vendedor', 'Vendedor', 'Atiende registros comerciales asignados.', 'active'),
  ('soporte_sistemas', 'Soporte Sistemas', 'Soporte tecnico, diagnostico e integraciones sin acceso comercial automatico.', 'active')
ON DUPLICATE KEY UPDATE
  name_role = VALUES(name_role),
  description_role = VALUES(description_role),
  status_role = VALUES(status_role);

INSERT INTO sec_role_permission (
  role_id_role_permission,
  permission_id_role_permission,
  status_role_permission
)
-- Re-run this seed after adding identity permissions so owner and jefe_general receive the updated catalog.
SELECT r.id_role, p.id_permission, 'active'
FROM sec_role r
CROSS JOIN sec_permission p
WHERE r.code_role IN ('owner', 'jefe_general')
ON DUPLICATE KEY UPDATE
  status_role_permission = VALUES(status_role_permission);

INSERT INTO sec_role_permission (
  role_id_role_permission,
  permission_id_role_permission,
  status_role_permission
)
SELECT r.id_role, p.id_permission, 'active'
FROM sec_role r
CROSS JOIN sec_permission p
WHERE r.code_role IN ('gerente', 'jefe_area')
  AND p.code_permission IN (
    'auth.login',
    'auth.logout',
    'user.view_self',
    'user.view_list',
    'user.view_detail',
    'user.update',
    'role.view',
    'permission.view',
    'org.view',
    'org.assign_user'
  )
ON DUPLICATE KEY UPDATE
  status_role_permission = VALUES(status_role_permission);

INSERT INTO sec_role_permission (
  role_id_role_permission,
  permission_id_role_permission,
  status_role_permission
)
SELECT r.id_role, p.id_permission, 'active'
FROM sec_role r
CROSS JOIN sec_permission p
WHERE r.code_role = 'subjefe_area'
  AND p.code_permission IN (
    'auth.login',
    'auth.logout',
    'user.view_self',
    'user.view_list',
    'user.view_detail',
    'role.view',
    'permission.view',
    'org.view'
  )
ON DUPLICATE KEY UPDATE
  status_role_permission = VALUES(status_role_permission);

INSERT INTO sec_role_permission (
  role_id_role_permission,
  permission_id_role_permission,
  status_role_permission
)
SELECT r.id_role, p.id_permission, 'active'
FROM sec_role r
CROSS JOIN sec_permission p
WHERE r.code_role = 'supervisor'
  AND p.code_permission IN (
    'auth.login',
    'auth.logout',
    'user.view_self',
    'user.view_list',
    'user.view_detail',
    'org.view'
  )
ON DUPLICATE KEY UPDATE
  status_role_permission = VALUES(status_role_permission);

INSERT INTO sec_role_permission (
  role_id_role_permission,
  permission_id_role_permission,
  status_role_permission
)
SELECT r.id_role, p.id_permission, 'active'
FROM sec_role r
CROSS JOIN sec_permission p
WHERE r.code_role = 'vendedor'
  AND p.code_permission IN (
    'auth.login',
    'auth.logout',
    'user.view_self'
  )
ON DUPLICATE KEY UPDATE
  status_role_permission = VALUES(status_role_permission);

INSERT INTO sec_role_permission (
  role_id_role_permission,
  permission_id_role_permission,
  status_role_permission
)
SELECT r.id_role, p.id_permission, 'active'
FROM sec_role r
CROSS JOIN sec_permission p
WHERE r.code_role = 'soporte_sistemas'
  AND p.code_permission IN (
    'auth.login',
    'auth.logout',
    'user.view_self',
    'user.view_list',
    'user.view_detail',
    'role.view',
    'permission.view',
    'org.view',
    'audit.security.view'
  )
ON DUPLICATE KEY UPDATE
  status_role_permission = VALUES(status_role_permission);

INSERT INTO sec_org_unit (
  public_id_org_unit,
  parent_org_unit_id_org_unit,
  code_org_unit,
  name_org_unit,
  status_org_unit,
  sort_order_org_unit
) VALUES
  ('01KCRM00000000000000000001', NULL, 'empresa', 'Empresa', 'active', 10)
ON DUPLICATE KEY UPDATE
  parent_org_unit_id_org_unit = VALUES(parent_org_unit_id_org_unit),
  name_org_unit = VALUES(name_org_unit),
  status_org_unit = VALUES(status_org_unit),
  sort_order_org_unit = VALUES(sort_order_org_unit);

INSERT INTO sec_org_unit (
  public_id_org_unit,
  parent_org_unit_id_org_unit,
  code_org_unit,
  name_org_unit,
  status_org_unit,
  sort_order_org_unit
) VALUES
  ('01KCRM00000000000000000002', (SELECT id_org_unit FROM sec_org_unit WHERE code_org_unit = 'empresa'), 'ventas', 'Ventas', 'active', 20),
  ('01KCRM00000000000000000003', (SELECT id_org_unit FROM sec_org_unit WHERE code_org_unit = 'empresa'), 'formalizacion', 'Formalizacion', 'active', 30),
  ('01KCRM00000000000000000004', (SELECT id_org_unit FROM sec_org_unit WHERE code_org_unit = 'empresa'), 'contabilidad', 'Contabilidad', 'active', 40),
  ('01KCRM00000000000000000005', (SELECT id_org_unit FROM sec_org_unit WHERE code_org_unit = 'empresa'), 'mercadeo', 'Mercadeo', 'active', 50),
  ('01KCRM00000000000000000006', (SELECT id_org_unit FROM sec_org_unit WHERE code_org_unit = 'empresa'), 'sistemas', 'Sistemas', 'active', 60)
ON DUPLICATE KEY UPDATE
  parent_org_unit_id_org_unit = VALUES(parent_org_unit_id_org_unit),
  name_org_unit = VALUES(name_org_unit),
  status_org_unit = VALUES(status_org_unit),
  sort_order_org_unit = VALUES(sort_order_org_unit);

INSERT INTO int_external_system (
  code_external_system,
  name_external_system,
  status_external_system
) VALUES
  ('netsuite', 'NetSuite', 'active'),
  ('odoo', 'Odoo', 'pending'),
  ('legacy_crm', 'CRM Legacy', 'active')
ON DUPLICATE KEY UPDATE
  name_external_system = VALUES(name_external_system),
  status_external_system = VALUES(status_external_system);

INSERT INTO audit_security_event (
  public_id_security_event,
  event_type_security_event,
  actor_user_id_security_event,
  target_user_id_security_event,
  summary_security_event,
  reason_security_event,
  metadata_security_event
) VALUES
  ('01KCRM00000000000000001001', 'seed_permissions_created', NULL, NULL, 'Permisos iniciales de identidad creados.', 'Seed P0-S1 controlado por arquitectura.', JSON_OBJECT('seed_file', '002_identity_seed_p0_s1.sql')),
  ('01KCRM00000000000000001002', 'seed_roles_created', NULL, NULL, 'Roles iniciales de identidad creados.', 'Seed P0-S1 controlado por arquitectura.', JSON_OBJECT('seed_file', '002_identity_seed_p0_s1.sql')),
  ('01KCRM00000000000000001003', 'seed_org_units_created', NULL, NULL, 'Areas iniciales creadas.', 'Seed P0-S1 controlado por arquitectura.', JSON_OBJECT('seed_file', '002_identity_seed_p0_s1.sql')),
  ('01KCRM00000000000000001004', 'seed_external_systems_created', NULL, NULL, 'Sistemas externos iniciales creados.', 'Seed P0-S1 controlado por arquitectura.', JSON_OBJECT('seed_file', '002_identity_seed_p0_s1.sql'))
ON DUPLICATE KEY UPDATE
  summary_security_event = VALUES(summary_security_event),
  reason_security_event = VALUES(reason_security_event),
  metadata_security_event = VALUES(metadata_security_event);

-- User bootstrap intentionally pending.
-- Do not create sec_user, sec_auth_identity, sec_user_role or sec_user_org_unit
-- until the official owner and jefe_general email/display names are confirmed.
-- Local auth must be activated through invitation/reset flow, never by seeded passwords.

COMMIT;
