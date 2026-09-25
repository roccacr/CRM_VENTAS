# 17 - Calendarios por Dominio y Supervision

## Veredicto

Los calendarios del CRM no deben mezclarse como si todos los eventos fueran iguales.

El calendario de vendedores es para gestionar eventos comerciales de leads, seguimiento, llamadas, reuniones y actividades del proceso de ventas.

Formalizaciones, Cobros, Modificaciones, Jefatura y otros departamentos deben tener calendarios propios por dominio. Una jefatura o gerencia puede ver calendarios consolidados solo si sus permisos efectivos lo permiten.

## Evidencia del CRM actual

La tabla legacy `calendars` confirma que no debe copiarse como base del CRM nuevo.

Evidencia verificada en la base actual:

```txt
total de eventos: 4975
usuarios con eventos: 16
leads con eventos: 3840
proyectos con eventos: 18
eventos con id externo de calendario: 258
eventos con copia a jefe: 864
```

Problemas detectados:

- fechas y horas guardadas como texto: `fechaIni_calendar`, `fechaFin_calendar`, `horaInicio_calendar`, `horaFinal_calendar`;
- estados numericos ambiguos: `estado_calendar`, `noticia_calendar`, `mostrar_calendar`, `progreso_calendar`;
- banderas de cita mezcladas: `cita_lead`, `citas_chek`, `masDeUnaCita_calendar`;
- supervision y notificacion como banderas sueltas: `supervisor_chek`, `copiaJefe`, `NotificarCliente`, `correoEnviado`;
- integracion externa acoplada en la tabla core: `outlook_event_id`;
- proyecto duplicado como id y texto: `id_proyecto`, `nombre_proyecto`;
- accion y tipo sin catalogo formal: `accion_calendar`, `tipo_calendar`.

Distribucion principal encontrada:

```txt
Seguimientos / Completado: 2963
Cita / Completado: 626
Seguimientos / Cancelado: 515
Reunion / Completado: 382
Cita / Cancelado: 152
Seguimientos / Pendiente: 127
```

Decision:

El CRM nuevo debe normalizar calendario, tipo de evento, estado, participantes, notificaciones, secuencia de citas, links de entidad, historial y sincronizacion externa.

## Regla principal

Cada evento de calendario debe pertenecer a un dominio operativo:

```txt
sales
formalizations
collections
modifications
management
customer_journey
system
```

El dominio define:

- que modulo lo crea;
- que usuarios lo gestionan;
- que roles pueden verlo;
- que acciones se permiten;
- que entidad de negocio lo origina;
- que timeline/auditoria se genera;
- si puede sincronizarse con Microsoft 365.

Reglas no negociables:

- no usar enteros magicos para estado, accion, tipo o motivo;
- usar codigos canonicos legibles: `scheduled`, `completed`, `cancelled`, `lead_appointment`;
- el frontend nunca debe adivinar que significa un numero;
- el API debe devolver etiquetas listas para UI cuando aplique;
- los nombres de proveedor externo no deben existir en tablas core;
- Microsoft 365/Outlook vive en integraciones y referencias externas, no dentro del modelo central.

## Separacion por area

### Calendario de Ventas

Uso:

- eventos de lead;
- llamadas;
- seguimientos;
- reuniones comerciales;
- recordatorios del vendedor;
- actividades previas a oportunidad/estimacion/orden.

Entidades vinculadas:

```txt
lead
contact
opportunity
estimate
sales_order
```

No debe mezclar:

- firma bancaria de Formalizaciones;
- traspasos;
- cuotas vencidas de Cobros;
- visitas de obra de Modificaciones;
- entrega de llaves.

### Calendario de Formalizaciones

Uso:

- envio de contrato;
- seguimiento de firma;
- firma de credito bancaria;
- formalizacion bancaria;
- traspaso;
- excepciones autorizadas;
- fechas internas de cierre de Formalizaciones.

Entidades vinculadas:

```txt
sales_order
formalization_case
contract
bank_process
transfer_process
```

### Calendario de Cobros

Uso futuro:

- cuotas proximas a vencer;
- pagos vencidos;
- fideicomisos;
- promesas de pago;
- seguimiento de mora;
- vencimientos de extras.

Entidades vinculadas:

```txt
sales_order
payment_obligation
collection_case
trust_process
```

### Calendario de Modificaciones

Uso futuro:

- bienvenida;
- reunion de extras;
- visitas contractuales;
- visitas adicionales;
- revision fisica;
- entrega de llaves cuando aplique.

Entidades vinculadas:

```txt
sales_order
modification_case
extras_version
site_visit
unit_review
delivery
```

### Calendario de Jefatura/Gerencia

Uso:

- supervision;
- aprobaciones;
- excepciones;
- vista consolidada por area;
- seguimiento de bloqueos.

Regla:

Jefatura no crea un calendario mezclado. Jefatura ve una vista agregada de los calendarios de cada dominio, filtrada por permisos.

## Modelo de permisos

Permisos sugeridos:

```txt
calendar.sales.view
calendar.sales.manage
calendar.formalizations.view
calendar.formalizations.manage
calendar.collections.view
calendar.collections.manage
calendar.modifications.view
calendar.modifications.manage
calendar.management.view_all
calendar.management.view_team
calendar.management.view_area
calendar.event.create
calendar.event.update
calendar.event.cancel
calendar.event.reassign
calendar.event.audit.view
```

Regla:

```txt
roles + permisos directos - denegaciones = permisos efectivos
```

Ejemplos:

- Un vendedor ve su propio calendario de ventas.
- Un supervisor ve calendarios de vendedores bajo su equipo.
- Un gerente puede ver ventas, formalizaciones u otra area si tiene permiso.
- Una formalizadora no administra eventos de ventas salvo permiso explicito.
- Jefatura puede cambiar el filtro de area solo si el API devuelve ese permiso.

## Regla de cambio de rol

Un evento no debe depender del rol actual del usuario para seguir existiendo o mostrarse al dueno operativo.

Reglas:

- el evento pertenece a un calendario, un dominio y una persona asignada;
- `assigned_user_id` define quien debe seguir viendo y gestionando el evento como propio;
- `created_by_user_id` define quien lo creo;
- `original_assigned_user_id` conserva a quien se asigno originalmente;
- `created_with_role_code_snapshot` y `assigned_role_code_snapshot` guardan el rol historico usado al momento de crear/asignar;
- si una persona cambia de rol, sus eventos anteriores siguen visibles en "Mis eventos";
- la supervision filtra por dominio/equipo/permiso vigente, no por el rol historico del evento.

Ejemplo:

```txt
Maria era vendedora y tenia 20 citas de leads.
Luego pasa a Formalizaciones.
Maria sigue viendo sus 20 citas en "Mis eventos".
Un supervisor de Ventas puede ver esas citas solo si siguen perteneciendo al dominio sales y Maria estaba o esta dentro del alcance supervisado permitido.
Maria tambien podra ver sus eventos de Formalizaciones si se le asignan nuevos eventos bajo ese dominio.
```

Esto evita perder agenda historica por cambios administrativos de rol.

## Modelo de datos propuesto

### crm_calendars

Representa un calendario logico por area, equipo, usuario o vista.

```sql
CREATE TABLE crm_calendars (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) NOT NULL,
  domain_code VARCHAR(80) NOT NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  owner_team_id BIGINT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  visibility_scope VARCHAR(80) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_calendars_public_id (public_id),
  KEY ix_crm_calendars_domain_active (domain_code, is_active),
  KEY ix_crm_calendars_owner_user (owner_user_id, is_active),
  CONSTRAINT fk_crm_calendars_owner_user FOREIGN KEY (owner_user_id) REFERENCES sec_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### crm_calendar_event_types

Catalogo de tipos de evento por dominio.

```sql
CREATE TABLE crm_calendar_event_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  domain_code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_calendar_event_types_code (code),
  KEY ix_crm_calendar_event_types_domain_active (domain_code, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### crm_calendar_events

Evento real del calendario.

```sql
CREATE TABLE crm_calendar_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) NOT NULL,
  calendar_id BIGINT UNSIGNED NOT NULL,
  event_type_id BIGINT UNSIGNED NOT NULL,
  domain_code VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  status VARCHAR(60) NOT NULL DEFAULT 'scheduled',
  starts_at DATETIME(3) NOT NULL,
  ends_at DATETIME(3) NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/Costa_Rica',
  owner_user_id BIGINT UNSIGNED NULL,
  assigned_user_id BIGINT UNSIGNED NULL,
  original_assigned_user_id BIGINT UNSIGNED NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  created_with_role_code_snapshot VARCHAR(80) NULL,
  assigned_role_code_snapshot VARCHAR(80) NULL,
  visibility_scope VARCHAR(80) NOT NULL DEFAULT 'assigned_user',
  source_channel VARCHAR(80) NOT NULL DEFAULT 'crm',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  cancelled_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_calendar_events_public_id (public_id),
  KEY ix_crm_calendar_events_calendar_start (calendar_id, starts_at, id),
  KEY ix_crm_calendar_events_owner_start (owner_user_id, starts_at, id),
  KEY ix_crm_calendar_events_assigned_start (assigned_user_id, starts_at, id),
  KEY ix_crm_calendar_events_original_assigned (original_assigned_user_id, starts_at, id),
  KEY ix_crm_calendar_events_domain_start (domain_code, starts_at, id),
  KEY ix_crm_calendar_events_status_start (status, starts_at),
  CONSTRAINT fk_crm_calendar_events_calendar FOREIGN KEY (calendar_id) REFERENCES crm_calendars(id),
  CONSTRAINT fk_crm_calendar_events_type FOREIGN KEY (event_type_id) REFERENCES crm_calendar_event_types(id),
  CONSTRAINT fk_crm_calendar_events_owner FOREIGN KEY (owner_user_id) REFERENCES sec_user(id),
  CONSTRAINT fk_crm_calendar_events_assigned FOREIGN KEY (assigned_user_id) REFERENCES sec_user(id),
  CONSTRAINT fk_crm_calendar_events_original_assigned FOREIGN KEY (original_assigned_user_id) REFERENCES sec_user(id),
  CONSTRAINT fk_crm_calendar_events_created_by FOREIGN KEY (created_by_user_id) REFERENCES sec_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### crm_calendar_event_links

Permite vincular un evento a lead, orden, contrato, formalizacion u otra entidad sin mezclar dominios.

```sql
CREATE TABLE crm_calendar_event_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  calendar_event_id BIGINT UNSIGNED NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  link_role VARCHAR(80) NOT NULL DEFAULT 'related',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_crm_calendar_event_links_event (calendar_event_id),
  KEY ix_crm_calendar_event_links_entity (entity_type, entity_id),
  CONSTRAINT fk_crm_calendar_event_links_event FOREIGN KEY (calendar_event_id) REFERENCES crm_calendar_events(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### crm_calendar_event_participants

Personas que participan o reciben notificacion del evento.

Esto reemplaza banderas sueltas como `copiaJefe`, `NotificarCliente` y futuros casos de varios notificados.

```sql
CREATE TABLE crm_calendar_event_participants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  calendar_event_id BIGINT UNSIGNED NOT NULL,
  participant_type VARCHAR(60) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  contact_id BIGINT UNSIGNED NULL,
  display_name VARCHAR(180) NULL,
  email VARCHAR(180) NULL,
  participant_role VARCHAR(80) NOT NULL DEFAULT 'attendee',
  response_status VARCHAR(80) NOT NULL DEFAULT 'needs_action',
  notify_by_email TINYINT(1) NOT NULL DEFAULT 0,
  notify_by_whatsapp TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_crm_calendar_event_participants_event (calendar_event_id),
  KEY ix_crm_calendar_event_participants_user (user_id, calendar_event_id),
  KEY ix_crm_calendar_event_participants_contact (contact_id, calendar_event_id),
  KEY ix_crm_calendar_event_participants_email (email),
  CONSTRAINT fk_crm_calendar_event_participants_event FOREIGN KEY (calendar_event_id) REFERENCES crm_calendar_events(id),
  CONSTRAINT fk_crm_calendar_event_participants_user FOREIGN KEY (user_id) REFERENCES sec_user(id),
  CONSTRAINT fk_crm_calendar_event_participants_contact FOREIGN KEY (contact_id) REFERENCES crm_contacts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Valores iniciales de `participant_type`:

```txt
crm_user
lead_contact
external_email
```

Valores iniciales de `participant_role`:

```txt
owner
assigned
attendee
manager_copy
observer
```

### crm_calendar_event_appointment_details

Detalle especializado solo para eventos que son cita de lead/proyecto.

Regla:

- si el evento es `lead_appointment`, debe existir un registro aqui;
- la secuencia se calcula por `lead_id + project_id`;
- mismo lead y mismo proyecto: primera, segunda, tercera cita;
- mismo lead y otro proyecto: vuelve a ser primera cita;
- no depender de banderas como `masDeUnaCita_calendar`.

```sql
CREATE TABLE crm_calendar_event_appointment_details (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  calendar_event_id BIGINT UNSIGNED NOT NULL,
  lead_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  appointment_number INT NOT NULL,
  appointment_label VARCHAR(80) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_calendar_event_appointment_event (calendar_event_id),
  UNIQUE KEY uq_crm_calendar_event_appointment_sequence (lead_id, project_id, appointment_number),
  KEY ix_crm_calendar_event_appointment_lead_project (lead_id, project_id, appointment_number),
  CONSTRAINT fk_crm_calendar_event_appointment_event FOREIGN KEY (calendar_event_id) REFERENCES crm_calendar_events(id),
  CONSTRAINT fk_crm_calendar_event_appointment_lead FOREIGN KEY (lead_id) REFERENCES crm_leads(id),
  CONSTRAINT fk_crm_calendar_event_appointment_project FOREIGN KEY (project_id) REFERENCES crm_projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Etiquetas canonicas:

```txt
first_appointment
second_appointment
third_appointment
additional_appointment
```

La UI puede mostrar:

```txt
Primera cita
Segunda cita
Tercera cita
Cita adicional
```

### crm_calendar_event_external_syncs

Estado de sincronizacion de un evento interno con calendarios externos.

La tabla es generica. No debe llamarse `outlook_*`, porque manana puede existir otro proveedor.

```sql
CREATE TABLE crm_calendar_event_external_syncs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  calendar_event_id BIGINT UNSIGNED NOT NULL,
  external_system_id BIGINT UNSIGNED NOT NULL,
  external_calendar_id VARCHAR(255) NULL,
  external_event_id VARCHAR(1024) NULL,
  external_ical_uid VARCHAR(255) NULL,
  external_change_key VARCHAR(255) NULL,
  sync_status VARCHAR(80) NOT NULL DEFAULT 'pending',
  sync_direction VARCHAR(80) NOT NULL DEFAULT 'crm_to_external',
  last_synced_at DATETIME(3) NULL,
  last_error TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_calendar_event_external_sync (calendar_event_id, external_system_id),
  KEY ix_crm_calendar_event_external_lookup (external_system_id, external_event_id),
  KEY ix_crm_calendar_event_external_status (sync_status, last_synced_at),
  CONSTRAINT fk_crm_calendar_event_external_syncs_event FOREIGN KEY (calendar_event_id) REFERENCES crm_calendar_events(id),
  CONSTRAINT fk_crm_calendar_event_external_syncs_system FOREIGN KEY (external_system_id) REFERENCES int_external_system(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Estados de sincronizacion:

```txt
pending
synced
failed
external_deleted
conflict
reauthorization_required
```

### crm_calendar_event_history

Historial de reprogramaciones, cancelaciones y cambios.

```sql
CREATE TABLE crm_calendar_event_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  calendar_event_id BIGINT UNSIGNED NOT NULL,
  action_code VARCHAR(100) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  previous_values JSON NULL,
  new_values JSON NULL,
  reason TEXT NULL,
  occurred_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_crm_calendar_event_history_event_occurred (calendar_event_id, occurred_at),
  KEY ix_crm_calendar_event_history_actor_occurred (actor_user_id, occurred_at),
  CONSTRAINT fk_crm_calendar_event_history_event FOREIGN KEY (calendar_event_id) REFERENCES crm_calendar_events(id),
  CONSTRAINT fk_crm_calendar_event_history_actor FOREIGN KEY (actor_user_id) REFERENCES sec_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## Tipos de evento iniciales

### sales

```txt
lead_follow_up
lead_call
lead_meeting
lead_appointment
opportunity_follow_up
estimate_follow_up
manual_task
email_follow_up
whatsapp_follow_up
```

### formalizations

```txt
contract_send_follow_up
contract_signature_follow_up
bank_credit_signature
bank_formalization_follow_up
transfer_follow_up
formalization_closure_follow_up
```

### collections

```txt
payment_due_follow_up
overdue_payment_follow_up
trust_opening_follow_up
promise_to_pay
```

### modifications

```txt
welcome_follow_up
extras_meeting
contractual_visit_1
contractual_visit_2
additional_visit
unit_review
key_delivery
```

## Estados canonicos del evento

No usar `0`, `1`, `4` ni cualquier otro entero para representar estado.

Catalogo inicial:

```txt
scheduled
completed
cancelled
rescheduled
no_show
pending_sync
sync_failed
```

Etiquetas sugeridas para UI:

```txt
scheduled -> Pendiente
completed -> Completado
cancelled -> Cancelado
rescheduled -> Reprogramado
no_show -> No asistio
pending_sync -> Pendiente de sincronizar
sync_failed -> Error de sincronizacion
```

Los motivos o acciones tambien deben ser catalogos legibles:

```txt
event_created
event_updated
event_completed
event_cancelled
event_rescheduled
appointment_marked
customer_notified
manager_notified
external_sync_created
external_sync_failed
```

## Vista gerencial consolidada

La vista consolidada no copia eventos a otro calendario.

Debe consultar eventos por:

```txt
domain_code
assigned_user_id
team
date range
status
event_type
project
entity_type
```

El API debe aplicar permisos antes de devolver resultados.

Ejemplo:

```txt
Gerente comercial -> puede ver sales de su area.
Jefe general -> puede ver sales + formalizations + collections + modifications si tiene permiso.
Supervisor ventas -> puede ver sales de su equipo.
Formalizaciones -> ve formalizations asignado o por bandeja autorizada.
```

## Regla de visibilidad

La consulta de calendario debe separar dos casos:

```txt
Mis eventos
Vista de supervision
```

### Mis eventos

Debe devolver eventos donde el usuario sea:

- `owner_user_id`;
- `assigned_user_id`;
- participante en `crm_calendar_event_participants`;
- creador, si el evento aun requiere accion del creador.

Esta vista no depende del rol actual. Si el usuario cambia de rol, mantiene acceso a su propia agenda historica y futura.

### Vista de supervision

Debe devolver eventos solo si el usuario autenticado tiene permiso efectivo para:

- el dominio solicitado;
- el equipo solicitado;
- el vendedor/persona solicitada;
- el rango de fechas;
- la accion solicitada.

El supervisor no ve "todo lo que tenga una persona"; ve lo permitido dentro del dominio y equipo que esta supervisando.

Ejemplo:

```txt
Supervisor de Ventas -> filtra sales.
Jefe General -> puede filtrar sales, formalizations, collections o modifications si tiene permiso.
Usuario reasignado -> ve sus propios eventos aunque su rol haya cambiado.
```

## Reglas de timeline

Crear, editar, cancelar, completar o reprogramar un evento debe generar:

- `crm_calendar_event_history`;
- timeline en la entidad relacionada si aplica;
- audit log si el evento afecta aprobacion, entrega, traspaso, contrato o condicion financiera.

## Reglas Microsoft 365

Microsoft 365 puede sincronizar eventos, pero no decide reglas de negocio.

Reglas:

- el CRM es fuente de autorizacion;
- Microsoft 365 es calendario externo;
- cada evento sincronizado debe tener referencia externa generica;
- guardar identificadores externos en `crm_calendar_event_external_syncs` o `int_external_reference`;
- guardar `external_event_id`, `external_ical_uid` y `external_change_key` cuando el proveedor los devuelva;
- fallos de sincronizacion no deben borrar el evento interno;
- reintentos por outbox;
- no mezclar calendarios personales con calendarios operativos sin permiso.

El adapter `src/integrations/microsoft365/` debe traducir el evento canonico del CRM al evento externo.

La documentacion oficial de Microsoft Graph indica que un evento tiene `attendees`, `id`, `iCalUId` y `changeKey`; tambien permite crear eventos en calendarios de usuario/grupo y enviar asistentes. Por eso el core guarda una estructura generica y deja la forma exacta del proveedor en el adapter.

## Consultas criticas

```sql
-- Calendario propio del vendedor
SELECT *
FROM crm_calendar_events
WHERE domain_code = 'sales'
  AND assigned_user_id = ?
  AND starts_at >= ?
  AND starts_at < ?
ORDER BY starts_at ASC, id ASC;
```

```sql
-- Mis eventos aunque cambie de rol
SELECT e.*
FROM crm_calendar_events e
LEFT JOIN crm_calendar_event_participants p
  ON p.calendar_event_id = e.id
WHERE e.starts_at >= ?
  AND e.starts_at < ?
  AND (
    e.owner_user_id = ?
    OR e.assigned_user_id = ?
    OR p.user_id = ?
  )
ORDER BY e.starts_at ASC, e.id ASC;
```

```sql
-- Vista gerencial por area
SELECT *
FROM crm_calendar_events
WHERE domain_code IN (?, ?, ?)
  AND starts_at >= ?
  AND starts_at < ?
ORDER BY starts_at ASC, id ASC;
```

```sql
-- Numero de cita por lead y proyecto
SELECT COUNT(*) + 1 AS next_appointment_number
FROM crm_calendar_event_appointment_details
WHERE lead_id = ?
  AND project_id = ?;
```

La asignacion de `appointment_number` debe ejecutarse dentro de transaccion, bloqueando la secuencia `lead_id + project_id` para evitar dos primeras citas simultaneas.

## Regla final

Si un evento pertenece a vendedores, debe vivir bajo dominio `sales`.

Si pertenece a otro departamento, debe vivir bajo su dominio.

Si una jefatura ve varios calendarios, eso es una vista consolidada por permisos, no una mezcla fisica ni funcional de calendarios.
