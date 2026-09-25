# 13 - Bitacora, Acciones y Timeline del Lead

## Veredicto

Todo lead debe tener una bitacora completa desde su creacion hasta su cierre, perdida, conversion o eliminacion logica.

La bitacora no es opcional y no es solo para errores. Es la historia operacional del lead:

- quien hizo la accion;
- cuando la hizo;
- con que rol efectivo actuo;
- desde que seccion del CRM;
- que accion realizo;
- que motivo aplico;
- que cambio antes/despues;
- que evento, tarea, nota, correo, WhatsApp o integracion se genero;
- que sistema origen provoco la accion cuando no fue manual;
- que permiso permitio ejecutar la accion.

## Evidencia del CRM actual

Revision read-only en base actual `crmdatabase-api`, MySQL 8.0.45.

Tablas relevantes encontradas:

```txt
bitacoras
caidas
corredores
crm_lead_email_delivery
info_extra_lead
leads
```

Procedimientos relevantes encontrados:

```txt
13_INSERTAR_INFO_EXTRA_LEAD
14_INSERTAR_BITACORA_LEAD
24_CONSULTAR_DATOS_CORREDOR
30_OBTENER_BITACORA_LEAD
```

Hallazgos:

- `bitacoras` tiene 199181 registros y 55786 leads con bitacora.
- `bitacoras` registra `id_lead_bit`, `id_admin_bit`, `id_caida_bit`, `detalle_bit`, `tipo_documento_bit`, `estado_bit`, `fecha_creado_bit`.
- `caidas` no representa solamente motivo de perdida. En la practica mezcla motivos de accion, eventos, notas, WhatsApp, cambios de estado, reservas, cierres y perdida.
- `caidas.estado_caida` y `caidas.segui` funcionan como filtros de vistas, pero no tienen nombres de negocio claros.
- `info_extra_lead` concentra datos de perfil, contacto alterno, residencia, ingresos, motivo de compra, momento de compra, origen de fondos y datos de persona adicional.
- `corredores` es una asignacion posible para el lead. No debe quedar como texto libre dentro del perfil extra.
- El procedimiento `24_CONSULTAR_DATOS_CORREDOR` tiene una condicion ambigua `estado_corredor = estado_corredor`; en el diseno nuevo debe evitarse sombra de nombres y todo filtro debe ser explicito.

Top motivos/acciones usados en bitacora actual:

```txt
Sin contactar
Sin actividad registrada en los ultimos 7 dias
Evento Lead
No Contesta
Nota Manual
SIN FEEDBACK
Empezando a buscar
Mistake
Duplicado
Presupuesto
No es lo que buscaba
Template inicial entregado por WhatsApp
Oportunidad
Ubicacion
No tiene WhatsApp
Reserva Ov
Busca alquiler
Falta de seguimiento
Cliente acepto recibir informacion por WhatsApp
Seguimiento Futuro
```

Conclusion: en el CRM nuevo, `caidas` debe dividirse conceptualmente en `action types`, `action reasons`, `lead status history`, `activities`, `events` y `audit`.

## Benchmark de CRM enterprise

Patrones relevantes observados en CRMs maduros:

| CRM | Patron util para este proyecto |
| --- | --- |
| Salesforce | Lead record con actividades, historial de campos, status tracking, conversion y reportes por owner/equipo. |
| HubSpot | Timeline del registro con notas, emails, llamadas, tareas, reuniones, cambios de etapa, filtros por tipo, usuario, equipo y fecha. |
| Microsoft Dynamics 365 / Dataverse | Audit History por registro y Audit Summary global: quien creo, actualizo, elimino, que campo cambio, valor anterior/nuevo y acceso de usuario. |
| Zoho CRM | Diferencia clara entre Timeline del registro y Audit Log global; filtros por entidad, usuario, accion y fecha. |
| Pipedrive | Actividades como llamadas, reuniones, tareas, correos y tipos personalizados vinculables a lead, deal, persona u organizacion. |
| Freshsales | Audit logs cronologicos para cambios administrativos/configuracion; CRM centrado en actividades y seguimiento. |
| Monday Sales CRM | Activity logs y audit logs separados; seguridad/auditoria a nivel cuenta y actividad operacional a nivel board/item. |
| Zendesk Sell | Feed de actividad en lead/contacto/deal; campos calculados como ultima actividad, dias sin respuesta, ultima comunicacion. |
| ActiveCampaign | Deals con actividades, tareas, notas y contacto principal; activity endpoint por deal. |
| Odoo | Chatter por lead/oportunidad, actividades planificadas, tipos de actividad configurables y activity plans. |
| Bitrix24 | Timeline como workspace principal: cambios de etapa, tareas, emails, llamadas, comentarios, documentos y logs de aplicacion. |
| GoHighLevel | Oportunidades con notas, tareas, pipeline/status y busqueda filtrada incluyendo notas. |
| Brevo | Tareas, notas y archivos asociados a contacto, compania o deal; tareas con tipo, fecha, asignado y estado. |
| Insightly | Field History Tracking como audit log: usuario, fecha, cambios, valor anterior/nuevo y aplicacion origen. |
| SugarCRM | Audit log por campo con source, change date, old/new values y actor cuando aplica; activity stream para contexto operacional. |

Decision para este CRM:

- usar un timeline visible por lead para vendedores y supervisores;
- usar auditoria tecnica completa para cumplimiento y soporte;
- separar actividad comercial de auditoria tecnica;
- guardar historial de cambios de campos importantes;
- no perder contexto de rol, permiso, seccion y sistema origen;
- soportar filtros por accion, motivo, usuario, rol, fecha, seccion, estado, proyecto, campana y canal.

## Conceptos canonicos

### Lead action type

Tipo principal de accion realizada sobre el lead.

Ejemplos:

```txt
lead_created
lead_updated
status_changed
note_added
activity_scheduled
activity_completed
calendar_event_created
email_sent
whatsapp_sent
whatsapp_received
broker_assigned
owner_assigned
duplicate_marked
opportunity_created
pre_reservation_created
reservation_created
contract_signed
lead_lost
integration_synced
integration_failed
system_cleanup
```

### Lead action reason

Motivo de la accion. Sustituye el uso ambiguo de `caidas`.

Regla: no se debe llamar `motivo de caida` salvo que realmente sea una perdida.

Ejemplos por categoria:

```txt
contact_result:
- no_contesta
- sin_contactar
- primer_contacto
- sin_feedback

follow_up:
- seguimiento_futuro
- falta_de_seguimiento
- sin_actividad_7_dias

lost:
- presupuesto
- ubicacion
- no_es_lo_que_buscaba
- busca_alquiler
- duplicado
- prueba
- no_tiene_whatsapp
- numero_telefono_no_valido
- mejor_oferta
- tema_laboral
- tema_personal
- no_sujeto_credito

workflow:
- cambio_de_estado
- oportunidad
- pre_reserva
- reserva
- cierre_firmado

whatsapp:
- template_inicial_entregado
- cliente_acepto_informacion
- cliente_rechazo_informacion
```

### Lead timeline entry

Entrada visible en la historia del lead.

Debe responder:

```txt
Que paso?
Quien lo hizo?
Cuando paso?
Desde donde paso?
Con que rol/permisos paso?
Que cambio?
Que motivo se selecciono?
Que sistema origen participo?
```

### Lead audit log

Registro tecnico/inmutable para auditoria, soporte y seguridad.

No todo audit log debe mostrarse al vendedor, pero todo cambio sensible debe quedar registrado.

## Modelo de datos propuesto

### Catalogo de tipos de accion

```sql
CREATE TABLE crm_lead_action_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(140) NOT NULL,
  category VARCHAR(80) NOT NULL,
  is_visible_in_timeline TINYINT(1) NOT NULL DEFAULT 1,
  requires_reason TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_lead_action_types_code (code),
  KEY ix_crm_lead_action_types_category_active (category, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### Catalogo de motivos de accion

```sql
CREATE TABLE crm_lead_action_reasons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  ui_scope VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 100,
  is_loss_reason TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_lead_action_reasons_code (code),
  KEY ix_crm_lead_action_reasons_scope_active (ui_scope, is_active, sort_order),
  KEY ix_crm_lead_action_reasons_category_active (category, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

`ui_scope` define donde se muestra:

```txt
lead_detail
lost_lead_modal
follow_up_modal
activity_modal
whatsapp_flow
bulk_cleanup
status_change_modal
```

El frontend no decide por numeros. El API devuelve motivos por palabra, categoria y scope.

### Timeline del lead

```sql
CREATE TABLE crm_lead_timeline_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) NOT NULL,
  lead_id BIGINT UNSIGNED NOT NULL,
  action_type_id BIGINT UNSIGNED NOT NULL,
  action_reason_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_role_id BIGINT UNSIGNED NULL,
  actor_role_code_snapshot VARCHAR(100) NULL,
  effective_permission_code VARCHAR(140) NULL,
  section_code VARCHAR(100) NOT NULL,
  source_channel VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  detail TEXT NULL,
  previous_status_id BIGINT UNSIGNED NULL,
  new_status_id BIGINT UNSIGNED NULL,
  occurred_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  metadata JSON NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_lead_timeline_public_id (public_id),
  KEY ix_crm_lead_timeline_lead_occurred (lead_id, occurred_at, id),
  KEY ix_crm_lead_timeline_action_occurred (action_type_id, occurred_at),
  KEY ix_crm_lead_timeline_actor_occurred (actor_user_id, occurred_at),
  KEY ix_crm_lead_timeline_reason_occurred (action_reason_id, occurred_at),
  KEY ix_crm_lead_timeline_section_occurred (section_code, occurred_at),
  CONSTRAINT fk_crm_lead_timeline_lead FOREIGN KEY (lead_id) REFERENCES crm_leads(id),
  CONSTRAINT fk_crm_lead_timeline_action_type FOREIGN KEY (action_type_id) REFERENCES crm_lead_action_types(id),
  CONSTRAINT fk_crm_lead_timeline_action_reason FOREIGN KEY (action_reason_id) REFERENCES crm_lead_action_reasons(id),
  CONSTRAINT fk_crm_lead_timeline_actor FOREIGN KEY (actor_user_id) REFERENCES sec_user(id),
  CONSTRAINT fk_crm_lead_timeline_actor_role FOREIGN KEY (actor_role_id) REFERENCES sec_role(id),
  CONSTRAINT fk_crm_lead_timeline_previous_status FOREIGN KEY (previous_status_id) REFERENCES crm_lead_statuses(id),
  CONSTRAINT fk_crm_lead_timeline_new_status FOREIGN KEY (new_status_id) REFERENCES crm_lead_statuses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### Cambios de campos

```sql
CREATE TABLE crm_lead_field_changes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  timeline_entry_id BIGINT UNSIGNED NOT NULL,
  field_code VARCHAR(120) NOT NULL,
  field_name VARCHAR(160) NOT NULL,
  old_value_text TEXT NULL,
  new_value_text TEXT NULL,
  old_value_json JSON NULL,
  new_value_json JSON NULL,
  is_sensitive TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_crm_lead_field_changes_entry (timeline_entry_id),
  KEY ix_crm_lead_field_changes_field (field_code),
  CONSTRAINT fk_crm_lead_field_changes_entry FOREIGN KEY (timeline_entry_id) REFERENCES crm_lead_timeline_entries(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Campos sensibles deben poder enmascararse en la UI segun permisos.

### Historial de estado del lead

```sql
CREATE TABLE crm_lead_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id BIGINT UNSIGNED NOT NULL,
  previous_status_id BIGINT UNSIGNED NULL,
  new_status_id BIGINT UNSIGNED NOT NULL,
  changed_by_user_id BIGINT UNSIGNED NULL,
  timeline_entry_id BIGINT UNSIGNED NOT NULL,
  reason_id BIGINT UNSIGNED NULL,
  changed_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_crm_lead_status_history_lead_changed (lead_id, changed_at),
  KEY ix_crm_lead_status_history_status_changed (new_status_id, changed_at),
  CONSTRAINT fk_crm_lead_status_history_lead FOREIGN KEY (lead_id) REFERENCES crm_leads(id),
  CONSTRAINT fk_crm_lead_status_history_previous FOREIGN KEY (previous_status_id) REFERENCES crm_lead_statuses(id),
  CONSTRAINT fk_crm_lead_status_history_new FOREIGN KEY (new_status_id) REFERENCES crm_lead_statuses(id),
  CONSTRAINT fk_crm_lead_status_history_user FOREIGN KEY (changed_by_user_id) REFERENCES sec_user(id),
  CONSTRAINT fk_crm_lead_status_history_entry FOREIGN KEY (timeline_entry_id) REFERENCES crm_lead_timeline_entries(id),
  CONSTRAINT fk_crm_lead_status_history_reason FOREIGN KEY (reason_id) REFERENCES crm_lead_action_reasons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## Corredores

`corredor` debe ser entidad propia. No debe guardarse como texto libre en informacion extra del lead.

```sql
CREATE TABLE crm_brokers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) NOT NULL,
  name VARCHAR(220) NOT NULL,
  category VARCHAR(100) NULL,
  company_name VARCHAR(220) NULL,
  phone VARCHAR(80) NULL,
  normalized_phone VARCHAR(40) NULL,
  email VARCHAR(180) NULL,
  normalized_email VARCHAR(180) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_brokers_public_id (public_id),
  KEY ix_crm_brokers_active_name (is_active, name),
  KEY ix_crm_brokers_email (normalized_email),
  KEY ix_crm_brokers_phone (normalized_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

```sql
CREATE TABLE crm_lead_broker_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id BIGINT UNSIGNED NOT NULL,
  broker_id BIGINT UNSIGNED NOT NULL,
  assigned_by_user_id BIGINT UNSIGNED NULL,
  timeline_entry_id BIGINT UNSIGNED NOT NULL,
  assigned_at DATETIME(3) NOT NULL,
  unassigned_at DATETIME(3) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY ix_crm_lead_broker_assignments_lead_active (lead_id, is_active),
  KEY ix_crm_lead_broker_assignments_broker_active (broker_id, is_active),
  CONSTRAINT fk_crm_lead_broker_assignments_lead FOREIGN KEY (lead_id) REFERENCES crm_leads(id),
  CONSTRAINT fk_crm_lead_broker_assignments_broker FOREIGN KEY (broker_id) REFERENCES crm_brokers(id),
  CONSTRAINT fk_crm_lead_broker_assignments_user FOREIGN KEY (assigned_by_user_id) REFERENCES sec_user(id),
  CONSTRAINT fk_crm_lead_broker_assignments_entry FOREIGN KEY (timeline_entry_id) REFERENCES crm_lead_timeline_entries(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Toda asignacion o retiro de corredor genera timeline entry.

## Perfil extendido del lead

`info_extra_lead` debe convertirse en perfil extendido/qualification details, no en una tabla ambigua.

```sql
CREATE TABLE crm_lead_profile_details (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id BIGINT UNSIGNED NOT NULL,
  national_id VARCHAR(80) NULL,
  nationality VARCHAR(120) NULL,
  marital_status VARCHAR(120) NULL,
  age SMALLINT UNSIGNED NULL,
  profession VARCHAR(180) NULL,
  children_count SMALLINT UNSIGNED NULL,
  alternate_phone VARCHAR(80) NULL,
  normalized_alternate_phone VARCHAR(40) NULL,
  residence_address TEXT NULL,
  residence_zone VARCHAR(120) NULL,
  income_range VARCHAR(120) NULL,
  purchase_reason VARCHAR(160) NULL,
  purchase_timing VARCHAR(160) NULL,
  employment_type VARCHAR(160) NULL,
  funds_origin TEXT NULL,
  buyer_profile TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_lead_profile_details_lead (lead_id),
  KEY ix_crm_lead_profile_details_national_id (national_id),
  CONSTRAINT fk_crm_lead_profile_details_lead FOREIGN KEY (lead_id) REFERENCES crm_leads(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Datos de una segunda persona no deben ir como columnas duplicadas `nombre_extra`, `cedula_extra`, etc. Deben ir en una tabla relacional:

```sql
CREATE TABLE crm_lead_related_people (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id BIGINT UNSIGNED NOT NULL,
  relationship_type VARCHAR(80) NOT NULL,
  full_name VARCHAR(220) NOT NULL,
  national_id VARCHAR(80) NULL,
  email VARCHAR(180) NULL,
  phone VARCHAR(80) NULL,
  nationality VARCHAR(120) NULL,
  profession VARCHAR(180) NULL,
  marital_status VARCHAR(120) NULL,
  residence_place VARCHAR(220) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_crm_lead_related_people_lead (lead_id),
  KEY ix_crm_lead_related_people_national_id (national_id),
  CONSTRAINT fk_crm_lead_related_people_lead FOREIGN KEY (lead_id) REFERENCES crm_leads(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## API contracts

### Crear lead

El API debe crear minimo dos registros de timeline:

1. `lead_created`
2. `status_changed` si se asigna estado inicial explicitamente

### Actualizar lead

Toda actualizacion debe crear:

1. `crm_lead_timeline_entries`
2. `crm_lead_field_changes` por cada campo cambiado relevante
3. `crm_lead_status_history` si cambio estado
4. `crm_business_logs` o `crm_audit_logs` si aplica por seguridad/compliance

### Cambiar estado

Debe requerir:

```txt
leadId
newStatusCode
reasonCode cuando la transicion lo requiera
detail opcional/obligatorio segun regla
sectionCode
```

Nunca debe depender de numeros enviados por el frontend.

### Obtener timeline

Debe soportar:

```txt
leadId
cursor
limit
actionTypeCode
reasonCategory
sectionCode
actorUserId
dateFrom
dateTo
visibleOnly
```

Orden recomendado:

```txt
occurred_at DESC, id DESC
```

Usar keyset pagination, no OFFSET para historiales grandes.

## Reglas de aplicacion

1. Ningun caso de uso que modifique lead puede guardar sin timeline.
2. Las mutaciones deben ejecutarse en transaccion: cambio del lead + timeline + field changes + outbox si aplica.
3. Si falla la bitacora, falla la operacion completa.
4. Integraciones externas tambien deben crear timeline, usando actor de sistema y source channel.
5. El actor puede ser usuario o sistema; si es sistema, debe indicar job/integracion/correlation id.
6. El rol efectivo debe quedar como snapshot porque el usuario puede cambiar de rol luego.
7. El permiso efectivo usado debe quedar como snapshot para auditoria.
8. El frontend nunca envia `id_caida`; envia `reasonCode`.
9. La UI nunca muestra ids numericos de motivos; muestra `name`.
10. Motivos activos por vista salen desde API segun `ui_scope`.

## Consultas criticas esperadas

```sql
-- Timeline de un lead
SELECT *
FROM crm_lead_timeline_entries
WHERE lead_id = ?
  AND (occurred_at, id) < (?, ?)
ORDER BY occurred_at DESC, id DESC
LIMIT ?;
```

```sql
-- Acciones por vendedor y fecha
SELECT actor_user_id, action_type_id, COUNT(*) AS total
FROM crm_lead_timeline_entries
WHERE occurred_at >= ?
  AND occurred_at < ?
GROUP BY actor_user_id, action_type_id;
```

```sql
-- Leads sin actividad reciente
SELECT l.id
FROM crm_leads l
LEFT JOIN crm_lead_timeline_entries t
  ON t.lead_id = l.id
GROUP BY l.id
HAVING MAX(t.occurred_at) < ?;
```

## Fuentes publicas revisadas

- Salesforce Help: Lead History reports and activity tracking.
- HubSpot Knowledge Base: record timelines, activities, lead records and activity filters.
- Microsoft Learn: Dataverse auditing.
- Zoho CRM Help/API: audit logs and record timeline.
- Pipedrive Help/API: activities linked to lead/deal/person/organization.
- Odoo CRM documentation: activities, chatter and activity plans.
- Bitrix24 REST documentation: CRM timeline.
- Insightly Help: Field History Tracking.
- Zendesk Sell Help: standard calculated activity fields.
- Brevo API/Help: CRM tasks, notes and attachments.
- ActiveCampaign Developer Docs: deal activities.
- SugarCRM documentation: audit log and activity stream.
