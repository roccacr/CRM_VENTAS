-- CRM_THINK_V2 - P0-S1 identity seeds.
-- Controlled architecture artifact only. Do not execute in production without owner approval.
-- This seed intentionally does not create or activate users. User bootstrap and local password activation live in controlled flows.

USE `CRM_THINK_V2`;

START TRANSACTION;

DELETE FROM sec_role_permission;

DELETE override_permission
FROM sec_user_permission_override AS override_permission
INNER JOIN sec_permission AS permission
  ON permission.id_permission = override_permission.permission_id_user_permission_override
WHERE permission.code_permission NOT IN (
  'user.view_list',
  'user.view_detail',
  'user.create',
  'user.update',
  'user.activate',
  'user.deactivate',
  'role.assign',
  'lead.read',
  'lead.create',
  'lead.update',
  'lead.status',
  'lead.assign',
  'opportunity.read',
  'opportunity.create',
  'opportunity.close',
  'estimate.read',
  'estimate.create',
  'estimate.approve',
  'campaign.read',
  'campaign.create',
  'source.update',
  'file.read',
  'contract.review',
  'signature.manage',
  'wallet.read',
  'invoice.read',
  'payment.reconcile'
);

DELETE FROM sec_permission
WHERE code_permission NOT IN (
  'user.view_list',
  'user.view_detail',
  'user.create',
  'user.update',
  'user.activate',
  'user.deactivate',
  'role.assign',
  'lead.read',
  'lead.create',
  'lead.update',
  'lead.status',
  'lead.assign',
  'opportunity.read',
  'opportunity.create',
  'opportunity.close',
  'estimate.read',
  'estimate.create',
  'estimate.approve',
  'campaign.read',
  'campaign.create',
  'source.update',
  'file.read',
  'contract.review',
  'signature.manage',
  'wallet.read',
  'invoice.read',
  'payment.reconcile'
);

INSERT INTO sec_permission (
  code_permission,
  module_code_permission,
  action_code_permission,
  description_permission,
  status_permission
) VALUES
  ('user.view_list', 'user', 'view_list', 'Permite ver lista de usuarios dentro del alcance.', 'active'),
  ('user.view_detail', 'user', 'view_detail', 'Permite ver detalle de usuario dentro del alcance.', 'active'),
  ('user.create', 'user', 'create', 'Permite crear usuarios.', 'active'),
  ('user.update', 'user', 'update', 'Permite modificar usuarios.', 'active'),
  ('user.activate', 'user', 'activate', 'Permite activar usuarios.', 'active'),
  ('user.deactivate', 'user', 'deactivate', 'Permite desactivar usuarios.', 'active'),
  ('role.assign', 'role', 'assign', 'Permite administrar roles y asignaciones dentro del alcance permitido.', 'active'),
  ('lead.read', 'ventas', 'read', 'Permite leer la tabla de prospectos.', 'active'),
  ('lead.create', 'ventas', 'create', 'Habilita la creacion de leads.', 'active'),
  ('lead.update', 'ventas', 'update', 'Permite modificar datos del expediente comercial.', 'active'),
  ('lead.status', 'ventas', 'status', 'Permite mover etapa en el pipeline.', 'active'),
  ('lead.assign', 'ventas', 'assign', 'Permite reasignar responsable.', 'active'),
  ('opportunity.read', 'ventas', 'read', 'Permite consultar oportunidades abiertas.', 'active'),
  ('opportunity.create', 'ventas', 'create', 'Habilita la creacion de oportunidades.', 'active'),
  ('opportunity.close', 'ventas', 'close', 'Permite cerrar oportunidad ganada o perdida.', 'active'),
  ('estimate.read', 'ventas', 'read', 'Permite ver estimaciones asociadas.', 'active'),
  ('estimate.create', 'ventas', 'create', 'Habilita calculo y guardado de estimaciones.', 'active'),
  ('estimate.approve', 'ventas', 'approve', 'Permiso sensible para aprobar estimaciones.', 'active'),
  ('campaign.read', 'mercadeo', 'read', 'Permite ver campanas activas.', 'active'),
  ('campaign.create', 'mercadeo', 'create', 'Permite crear campanas.', 'active'),
  ('source.update', 'mercadeo', 'update', 'Permite modificar fuentes de trafico.', 'active'),
  ('file.read', 'formalizacion', 'read', 'Permite ver expedientes.', 'active'),
  ('contract.review', 'formalizacion', 'review', 'Permite revisar contratos.', 'active'),
  ('signature.manage', 'formalizacion', 'manage', 'Permite gestionar firmas.', 'active'),
  ('wallet.read', 'contabilidad', 'read', 'Permite ver cartera.', 'active'),
  ('invoice.read', 'contabilidad', 'read', 'Permite consultar facturas.', 'active'),
  ('payment.reconcile', 'contabilidad', 'reconcile', 'Permiso sensible para conciliacion.', 'active')
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
  ('jefe_general', 'Jefe General', 'Supervision de negocio sobre una o varias areas operativas segun alcance asignado.', 'active'),
  ('subjefe_area', 'Subjefe', 'Apoyo de supervision sobre una o varias areas operativas asignadas.', 'active'),
  ('ventas', 'Ventas', 'Rol operativo del modulo Ventas.', 'active'),
  ('mercadeo', 'Mercadeo', 'Rol operativo del modulo Mercadeo.', 'active'),
  ('formalizacion', 'Formalizacion', 'Rol operativo del modulo Formalizacion.', 'active'),
  ('contabilidad', 'Contabilidad', 'Rol operativo del modulo Contabilidad.', 'active')
ON DUPLICATE KEY UPDATE
  name_role = VALUES(name_role),
  description_role = VALUES(description_role),
  status_role = VALUES(status_role);

-- Roles descartados para el modelo actual. Si existen usuarios activos con
-- estos roles en una base real, deben reasignarse por flujo auditado antes de
-- inactivarlos definitivamente.
UPDATE sec_role
SET
  status_role = 'inactive',
  deleted_at_role = COALESCE(deleted_at_role, CURRENT_TIMESTAMP(3))
WHERE code_role IN ('gerente', 'jefe_area', 'supervisor', 'vendedor', 'soporte_sistemas')
  AND NOT EXISTS (
    SELECT 1
    FROM sec_user_role ur
    WHERE ur.role_id_user_role = sec_role.id_role
      AND ur.status_user_role = 'active'
      AND ur.revoked_at_user_role IS NULL
  );

INSERT INTO sec_role_permission (
  role_id_role_permission,
  permission_id_role_permission,
  status_role_permission
)
-- Owner nace con todo el catalogo administrativo y operativo.
SELECT r.id_role, p.id_permission, 'active'
FROM sec_role r
CROSS JOIN sec_permission p
WHERE r.code_role = 'owner'
ON DUPLICATE KEY UPDATE
  status_role_permission = VALUES(status_role_permission);

INSERT INTO sec_role_permission (
  role_id_role_permission,
  permission_id_role_permission,
  status_role_permission
)
-- Jefatura general solo hereda modulos operativos. Administracion queda reservada a Owner.
SELECT r.id_role, p.id_permission, 'active'
FROM sec_role r
CROSS JOIN sec_permission p
WHERE r.code_role = 'jefe_general'
  AND p.module_code_permission IN ('ventas', 'mercadeo', 'formalizacion', 'contabilidad')
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
  AND p.module_code_permission IN ('ventas', 'mercadeo', 'formalizacion', 'contabilidad')
ON DUPLICATE KEY UPDATE
  status_role_permission = VALUES(status_role_permission);

INSERT INTO sec_role_permission (
  role_id_role_permission,
  permission_id_role_permission,
  status_role_permission
)
SELECT r.id_role, p.id_permission, 'active'
FROM sec_role r
INNER JOIN sec_permission p
  ON p.code_permission IN ('lead.read', 'lead.create', 'lead.update')
WHERE r.code_role = 'ventas'
ON DUPLICATE KEY UPDATE
  status_role_permission = VALUES(status_role_permission);

INSERT INTO sec_role_permission (
  role_id_role_permission,
  permission_id_role_permission,
  status_role_permission
)
SELECT r.id_role, p.id_permission, 'active'
FROM sec_role r
INNER JOIN sec_permission p
  ON p.code_permission IN ('campaign.read', 'campaign.create', 'source.update')
WHERE r.code_role = 'mercadeo'
ON DUPLICATE KEY UPDATE
  status_role_permission = VALUES(status_role_permission);

INSERT INTO sec_role_permission (
  role_id_role_permission,
  permission_id_role_permission,
  status_role_permission
)
SELECT r.id_role, p.id_permission, 'active'
FROM sec_role r
INNER JOIN sec_permission p
  ON p.code_permission IN ('file.read', 'contract.review', 'signature.manage')
WHERE r.code_role = 'formalizacion'
ON DUPLICATE KEY UPDATE
  status_role_permission = VALUES(status_role_permission);

INSERT INTO sec_role_permission (
  role_id_role_permission,
  permission_id_role_permission,
  status_role_permission
)
SELECT r.id_role, p.id_permission, 'active'
FROM sec_role r
INNER JOIN sec_permission p
  ON p.code_permission IN ('wallet.read', 'invoice.read', 'payment.reconcile')
WHERE r.code_role = 'contabilidad'
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
)
SELECT
  child.public_id_org_unit,
  parent.id_org_unit,
  child.code_org_unit,
  child.name_org_unit,
  child.status_org_unit,
  child.sort_order_org_unit
FROM (
  SELECT '01KCRM00000000000000000002' AS public_id_org_unit, 'ventas' AS code_org_unit, 'Ventas' AS name_org_unit, 'active' AS status_org_unit, 20 AS sort_order_org_unit
  UNION ALL SELECT '01KCRM00000000000000000003', 'formalizacion', 'Formalizacion', 'active', 30
  UNION ALL SELECT '01KCRM00000000000000000004', 'contabilidad', 'Contabilidad', 'active', 40
  UNION ALL SELECT '01KCRM00000000000000000005', 'mercadeo', 'Mercadeo', 'active', 50
) AS child
JOIN sec_org_unit AS parent ON parent.code_org_unit = 'empresa'
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
