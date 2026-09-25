# 12 - Modelo de Datos P0 MySQL + Kysely

## Veredicto

La base nueva `CRM_THINK_V2` debe iniciar normalizada.

No se debe copiar la tabla legacy de leads. Esa tabla mezcla usuario, rol, proyecto, campana, estado, seguimiento, ERP, comentario y auditoria en una sola estructura. En el CRM nuevo cada concepto debe tener una tabla clara, relaciones explicitas e indices utiles para filtros, reportes y joins.

Importante: este documento describe el modelo objetivo inicial y su vision por fases. El primer corte ejecutable esta definido en `23-Alcance-P0-Vertical-Leads.md`.

Importante: los ejemplos SQL antiguos de este documento son conceptuales hasta que se ajusten al estandar oficial de nombres definido en `26-Estandar-Nombres-Base-Datos.md`. Antes de crear migraciones reales, todo nombre de tabla, columna, indice y constraint debe cumplir ese estandar, y toda columna debe incluir `COMMENT` explicando que registra y para que sirve.

## Reglas no negociables

- MySQL/InnoDB.
- Kysely + mysql2 como capa de acceso a datos.
- Sin Docker.
- Relaciones internas siempre por IDs propios del CRM; nunca por IDs de NetSuite, Odoo, legacy CRM ni otro proveedor.
- Tablas y columnas con lenguaje canonico del CRM y estandar fisico definido en `26-Estandar-Nombres-Base-Datos.md`.
- No usar nombres de proveedores externos en tablas o columnas core.
- No usar nombres legacy mal escritos o ambiguos.
- Normalizar primero siempre que sea posible; denormalizar solo con evidencia de rendimiento, impacto medido y ADR aprobado.
- Todo id externo vive en tablas genericas de referencias externas.
- Todo cambio critico genera auditoria.
- Toda sincronizacion externa confiable usa outbox/inbox.
- El frontend nunca recibe ni envia estructuras de proveedores externos.

La regla transversal de identidad interna y referencias externas vive en `30-Identidad-Canonica-y-Referencias-Externas.md`.

## Convenciones de base

- Tablas con prefijo por dominio: `crm_`, `conf_`, `sec_`, `audit_`, `int_` o `job_`.
- Tablas en singular.
- Columnas con sufijo de entidad, por ejemplo `id_lead`, `public_id_lead`, `project_id_lead`, `created_at_lead`.
- Todas las columnas con `COMMENT` obligatorio en MySQL.
- Normalizacion obligatoria por defecto: no repetir datos, no mezclar responsabilidades y no usar `JSON` para datos que se filtran, relacionan o auditan.
- PK internas: `BIGINT UNSIGNED AUTO_INCREMENT`.
- Identificador publico: `public_id_<entidad> CHAR(26)` con ULID o equivalente.
- Fechas: `created_at_<entidad>`, `updated_at_<entidad>`, `deleted_at_<entidad>`.
- Borrado logico para entidades principales.
- Estados y tipos en catalogos.
- `*_id` siempre referencia a otra tabla interna.
- Indices compuestos por casos reales de consulta.
- `JSON` solo para metadata no critica y no filtrada frecuentemente.

## Inventario de datos por fases

Para evitar sobreconstruccion, las tablas se clasifican asi:

| Fase | Tablas |
| --- | --- |
| P0-S1A obligatorio | Tablas de identidad, areas y seguridad definidas en `27-Identidad-Usuarios-Roles-P0-S1.md` y `28-Matriz-Roles-Permisos-Areas-P0-S1.md`: `sec_user`, `sec_auth_identity`, `sec_role`, `sec_permission`, `sec_user_role`, `sec_role_permission`, `sec_org_unit`, `sec_user_org_unit`, `sec_user_permission_override`, `audit_security_event`. |
| P0-S1B comercial, despues de cerrar identidad | Contacto, lead, estado operativo, timeline, cambios de campo y auditoria comercial. No se crean hasta cerrar P0-S1A, contrato canonico y modelo minimo. |
| P0-S1 opcional si se prepara integracion | Referencias externas y outbox/inbox solo si el contrato del slice lo aprueba. |
| P0-S2 | `crm_lead_loss_records` y reglas de pausa/perdida cuando existan motivos aprobados. |
| P1/P2 vision | SLA policies, perfiles extendidos, corredores, calendarios, notas, participantes, sync externo completo y flujos complejos de aprobacion comercial. |

No implementar UI, endpoints ni workers para tablas de fases posteriores solo porque esten descritas aqui.

```txt
Identidad y seguridad
+-- sec_user
+-- sec_auth_identity
+-- sec_auth_session
+-- sec_refresh_token
+-- sec_role
+-- sec_permission
+-- sec_user_role
+-- sec_role_permission
+-- sec_org_unit
+-- sec_user_org_unit
+-- sec_user_permission_override
+-- audit_security_event
+-- int_external_system
+-- int_user_external_identity

CRM comercial
+-- crm_contact
+-- crm_account
+-- conf_project
+-- conf_subsidiary
+-- conf_campaign
+-- conf_lead_source
+-- conf_lead_status
+-- crm_lead
+-- crm_lead_contact
+-- crm_lead_relation
+-- conf_action_type
+-- conf_action_reason
+-- audit_lead_timeline
+-- audit_lead_field_change
+-- crm_lead_status_history
+-- crm_lead_operational_state
+-- crm_lead_loss_records             [P0-S2]
+-- crm_lead_sla_policies             [P1]
+-- crm_lead_profile_details          [P1]
+-- crm_lead_related_people           [P1]
+-- crm_brokers                       [P1]
+-- crm_lead_broker_assignments       [P1]
+-- crm_activities                    [P1]
+-- crm_calendars                     [P1]
+-- crm_calendar_event_types          [P1]
+-- crm_calendar_events               [P1]
+-- crm_calendar_event_links          [P1]
+-- crm_calendar_event_participants   [P1]
+-- crm_calendar_event_appointment_details [P1]
+-- crm_calendar_event_external_syncs [P1]
+-- crm_calendar_event_history        [P1]
+-- crm_note_types                    [P1]
+-- crm_notes                         [P1]
+-- crm_note_positions                [P1]
+-- crm_note_shares                   [P1]
+-- crm_note_history                  [P1]

Operacion, auditoria e integracion
+-- crm_business_logs
+-- crm_audit_logs
+-- int_external_system
+-- int_external_reference             [futuro comercial/integraciones]
+-- int_outbox_event
+-- int_inbox_event
```

## Identidad y permisos

El permiso efectivo de una persona se calcula asi:

```txt
roles asignados
+ permisos directos del usuario
- permisos denegados explicitamente al usuario
= permisos efectivos
```

La denegacion directa gana sobre rol y permiso directo. Delegacion temporal avanzada queda prevista para una fase posterior y fuera de P0-S1A.

### Tablas principales

El modelo fisico autorizado para identidad vive en `29-Modelo-Fisico-MySQL-Identidad-P0-S1.md`.

Reglas ya cerradas:

- `sec_user` guarda la persona interna, no password, proveedor ni supervisor fijo;
- `sec_auth_identity` guarda Microsoft/local login;
- `sec_user_org_unit` guarda areas, jefaturas y alcances;
- `int_user_external_identity` guarda ids de NetSuite, Odoo, CRM viejo u otros sistemas;
- `int_external_reference` queda para el corte comercial/integraciones de entidades futuras;
- no usar `manager_user_id`, `idnetsuite_admin`, `idodoo_user` ni campos similares dentro de `sec_user`.

Relaciones internas canonicas:

```txt
crm_lead.owner_user_id_lead -> sec_user.id_user
crm_opportunity.lead_id_opportunity -> crm_lead.id_lead
crm_estimate.opportunity_id_estimate -> crm_opportunity.id_opportunity
crm_sales_order.estimate_id_sales_order -> crm_estimate.id_estimate
crm_contract.sales_order_id_contract -> crm_sales_order.id_sales_order
```

Ninguna de esas relaciones debe usar ids externos.

```sql
CREATE TABLE sec_role (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  level_rank INT NOT NULL DEFAULT 100,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sec_role_code (code),
  KEY ix_sec_role_active_rank (is_active, level_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE sec_permission (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(120) NOT NULL,
  module_code VARCHAR(80) NOT NULL,
  action_code VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sec_permission_code (code),
  KEY ix_sec_permission_module_action (module_code, action_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## Leads normalizados

Un lead representa una oportunidad comercial inicial. Los datos de persona/contacto viven fuera de la tabla principal para evitar duplicacion, mejorar busquedas y permitir que un mismo contacto se relacione con varios leads.

### Catalogos

```sql
CREATE TABLE crm_lead_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL,
  is_initial TINYINT(1) NOT NULL DEFAULT 0,
  is_terminal TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_lead_statuses_code (code),
  KEY ix_crm_lead_statuses_active_order (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Estados iniciales recomendados, usando nombres limpios:

```txt
interesado
seguimiento
oportunidad
pre_reserva
reserva
contrato
perdido
```

Si manana se necesita un estado entre `interesado` y `seguimiento`, se agrega un registro nuevo al catalogo con `sort_order` intermedio. No se cambia codigo ni estructura.

Regla operativa:

- el estado comercial del lead no es lo mismo que su estado operativo;
- `interesado`, `seguimiento`, `oportunidad`, `pre_reserva`, `reserva`, `contrato`, `perdido` representan avance comercial;
- `new`, `needs_attention`, `paused`, `reactivation_due`, `stale`, `lost` representan trabajo operativo;
- leads nuevos salen de nuevo con cualquier accion comercial significativa;
- leads activos sin accion significativa por 4 dias pasan a requiere atencion;
- leads pausados deben tener fecha de reactivacion;
- leads perdidos deben tener motivo y bitacora entendible para jefatura.

Ver detalle en `19-Reglas-Operativas-Leads-SLA-y-Perdida.md`.

```sql
CREATE TABLE crm_projects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) NOT NULL,
  name VARCHAR(160) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_projects_public_id (public_id),
  KEY ix_crm_projects_active_name (is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE crm_campaigns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) NOT NULL,
  name VARCHAR(180) NOT NULL,
  source_code VARCHAR(80) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_campaigns_public_id (public_id),
  KEY ix_crm_campaigns_active_name (is_active, name),
  KEY ix_crm_campaigns_source (source_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### Contactos

```sql
CREATE TABLE crm_contacts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) NOT NULL,
  full_name VARCHAR(220) NOT NULL,
  email VARCHAR(180) NULL,
  normalized_email VARCHAR(180) NULL,
  phone VARCHAR(80) NULL,
  normalized_phone VARCHAR(40) NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'CR',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_contacts_public_id (public_id),
  KEY ix_crm_contacts_email (normalized_email),
  KEY ix_crm_contacts_phone (normalized_phone),
  KEY ix_crm_contacts_name (full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### Leads

```sql
CREATE TABLE crm_leads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) NOT NULL,
  primary_contact_id BIGINT UNSIGNED NOT NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  status_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NULL,
  campaign_id BIGINT UNSIGNED NULL,
  subsidiary_id BIGINT UNSIGNED NULL,
  source_id BIGINT UNSIGNED NULL,
  loss_reason_id BIGINT UNSIGNED NULL,
  last_activity_type VARCHAR(80) NULL,
  has_related_lead TINYINT(1) NOT NULL DEFAULT 0,
  priority_score INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_leads_public_id (public_id),
  KEY ix_crm_leads_status_created (status_id, created_at),
  KEY ix_crm_leads_owner_status_updated (owner_user_id, status_id, updated_at),
  KEY ix_crm_leads_project_status (project_id, status_id),
  KEY ix_crm_leads_campaign_created (campaign_id, created_at),
  KEY ix_crm_leads_related (has_related_lead),
  CONSTRAINT fk_crm_leads_contact FOREIGN KEY (primary_contact_id) REFERENCES crm_contacts(id),
  CONSTRAINT fk_crm_leads_owner FOREIGN KEY (owner_user_id) REFERENCES sec_user(id),
  CONSTRAINT fk_crm_leads_status FOREIGN KEY (status_id) REFERENCES crm_lead_statuses(id),
  CONSTRAINT fk_crm_leads_project FOREIGN KEY (project_id) REFERENCES crm_projects(id),
  CONSTRAINT fk_crm_leads_campaign FOREIGN KEY (campaign_id) REFERENCES crm_campaigns(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE crm_lead_relations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id BIGINT UNSIGNED NOT NULL,
  related_lead_id BIGINT UNSIGNED NOT NULL,
  relation_type VARCHAR(60) NOT NULL DEFAULT 'possible_duplicate',
  matched_by VARCHAR(40) NOT NULL,
  confidence_score DECIMAL(5,2) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_lead_relations_pair (lead_id, related_lead_id, relation_type),
  KEY ix_crm_lead_relations_related (related_lead_id, relation_type),
  CONSTRAINT fk_crm_lead_relations_lead FOREIGN KEY (lead_id) REFERENCES crm_leads(id),
  CONSTRAINT fk_crm_lead_relations_related FOREIGN KEY (related_lead_id) REFERENCES crm_leads(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## Actividades, calendario y bitacoras

Regla de calendario:

- los eventos de vendedores pertenecen al dominio `sales`;
- los eventos de Formalizaciones pertenecen al dominio `formalizations`;
- los eventos de Cobros pertenecen al dominio `collections`;
- los eventos de Modificaciones pertenecen al dominio `modifications`;
- jefatura ve una vista consolidada por permisos, no un calendario fisicamente mezclado.
- los estados, tipos, acciones y motivos de calendario se guardan como codigos legibles, no como enteros magicos;
- los eventos se asocian a usuario/persona y no desaparecen si el usuario cambia de rol;
- las citas de lead se numeran por `lead_id + project_id`: primera cita, segunda cita, tercera cita;
- las personas notificadas o copiadas viven en `crm_calendar_event_participants`;
- la sincronizacion con calendarios externos vive en `crm_calendar_event_external_sync` o `int_external_reference`, sin columnas core llamadas por proveedor.

Ver detalle en `17-Calendarios-por-Dominio-y-Supervision.md`.

```sql
CREATE TABLE crm_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) NOT NULL,
  lead_id BIGINT UNSIGNED NULL,
  contact_id BIGINT UNSIGNED NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  activity_type VARCHAR(80) NOT NULL,
  subject VARCHAR(220) NOT NULL,
  notes TEXT NULL,
  due_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_activities_public_id (public_id),
  KEY ix_crm_activities_lead_due (lead_id, due_at),
  KEY ix_crm_activities_owner_due (owner_user_id, due_at),
  KEY ix_crm_activities_type_created (activity_type, created_at),
  CONSTRAINT fk_crm_activities_lead FOREIGN KEY (lead_id) REFERENCES crm_leads(id),
  CONSTRAINT fk_crm_activities_contact FOREIGN KEY (contact_id) REFERENCES crm_contacts(id),
  CONSTRAINT fk_crm_activities_owner FOREIGN KEY (owner_user_id) REFERENCES sec_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE crm_business_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  action_code VARCHAR(100) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  summary VARCHAR(255) NOT NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_crm_business_logs_entity_created (entity_type, entity_id, created_at),
  KEY ix_crm_business_logs_actor_created (actor_user_id, created_at),
  CONSTRAINT fk_crm_business_logs_actor FOREIGN KEY (actor_user_id) REFERENCES sec_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## Notas adhesivas y anotaciones

Regla de notas:

- las notas son datos del CRM, no decoracion local del navegador;
- pueden vincularse a entidad o vista;
- deben tener permisos, visibilidad, auditoria e historial;
- el contenido rico se guarda como JSON canonico;
- el texto plano se guarda para busqueda e indices FULLTEXT;
- la posicion visual se guarda separada del contenido;
- Kapso, correo o Microsoft 365 solo se activan por integraciones/backend, nunca desde la UI directamente.

Ver detalle en `18-Notas-Adhesivas-y-Anotaciones.md`.

## Referencias externas genericas

La base core no guarda columnas con nombres de proveedores externos. Cualquier id externo se registra aqui:

```sql
CREATE TABLE int_external_system (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_int_external_system_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE int_external_reference (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  external_system_id BIGINT UNSIGNED NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  external_entity_type VARCHAR(80) NOT NULL,
  external_id VARCHAR(180) NOT NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_int_external_reference_lookup (external_system_id, external_entity_type, external_id),
  KEY ix_int_external_reference_entity (entity_type, entity_id),
  CONSTRAINT fk_int_external_reference_system FOREIGN KEY (external_system_id) REFERENCES int_external_system(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## Outbox para sincronizacion

Cuando el CRM crea o actualiza un lead, primero guarda el dato propio y despues registra un evento de salida. Un worker procesa ese evento y llama al adapter externo activo.

```sql
CREATE TABLE int_outbox_event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) NOT NULL,
  aggregate_type VARCHAR(80) NOT NULL,
  aggregate_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  payload JSON NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at DATETIME(3) NULL,
  processed_at DATETIME(3) NULL,
  last_error TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_int_outbox_event_public_id (public_id),
  KEY ix_int_outbox_event_status_next (status, next_attempt_at),
  KEY ix_int_outbox_event_aggregate (aggregate_type, aggregate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## Consultas P0 que deben ser rapidas

1. Leads nuevos por vendedor.
2. Leads que requieren atencion.
3. Leads por estado, proyecto, campana y rango de fechas.
4. Eventos del dia por usuario.
5. Auditoria de cambios de un lead.
6. Posibles leads relacionados por correo o telefono.
7. Reporte de conversion por estado.
8. Reporte de rendimiento por vendedor/supervisor.

## Repositories Kysely esperados

```txt
src/modules/crm/leads/infrastructure/kysely-lead.repository.ts
src/modules/crm/leads/infrastructure/kysely-lead-operational-state.repository.ts
src/modules/crm/leads/infrastructure/kysely-lead-loss.repository.ts        [P0-S2]
src/modules/crm/leads/infrastructure/kysely-lead-sla-policy.repository.ts  [P1]
src/modules/crm/users/infrastructure/kysely-user.repository.ts
src/modules/crm/permissions/infrastructure/kysely-permission.repository.ts
src/modules/crm/activities/infrastructure/kysely-activity.repository.ts    [P1]
src/modules/crm/calendars/infrastructure/kysely-calendar.repository.ts     [P1]
src/modules/crm/calendars/infrastructure/kysely-calendar-event.repository.ts [P1]
src/modules/crm/notes/infrastructure/kysely-note.repository.ts             [P1]
src/modules/crm/notes/infrastructure/kysely-note-position.repository.ts    [P1]
src/modules/crm/audit/infrastructure/kysely-audit.repository.ts
src/modules/crm/integration-events/infrastructure/kysely-outbox.repository.ts [Opcional P0-S1]
```

## Regla para el siguiente paso

Antes de escribir codigo NestJS se debe convertir el slice aprobado en:

1. migracion SQL inicial alineada a `23-Alcance-P0-Vertical-Leads.md`;
2. tipos Kysely;
3. seed minimo de estados, roles y permisos;
4. contrato OpenAPI de leads;
5. pruebas de repository con MySQL local.
