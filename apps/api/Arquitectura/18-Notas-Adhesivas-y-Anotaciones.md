# 18 - Notas Adhesivas y Anotaciones

## Veredicto

El CRM debe soportar notas adhesivas y anotaciones contextuales como una capacidad transversal.

No son solo un componente visual. Son informacion operativa del CRM y deben tener permisos, auditoria, relacion con entidades, historial y sincronizacion futura cuando aplique.

## Vision

Las notas deben permitir que una persona deje contexto rapido sobre cualquier vista, entidad o accion:

```txt
lead
contact
opportunity
estimate
sales_order
contract
calendar_event
formalization_case
collection_case
modification_case
dashboard_view
custom_view
```

Ejemplos:

- nota interna sobre un lead;
- nota visible solo para el vendedor;
- nota compartida con supervisor;
- recordatorio dentro de una vista de seguimiento;
- observacion sobre una orden de venta;
- aclaracion en Formalizaciones;
- nota sobre evento de calendario;
- nota de jefatura en una vista gerencial.

## Decision de libreria

Para frontend se recomienda:

```txt
@tiptap/react
@tiptap/starter-kit
@dnd-kit/core
```

Decision:

- Tiptap sera el editor rico de notas.
- dnd kit sera el motor para mover/posicionar notas cuando una vista lo requiera.
- Lexical queda como alternativa tecnica valida, pero no es la primera opcion para P0.
- No usar una libreria completa de "sticky notes" como nucleo del dominio, porque el CRM necesita permisos, auditoria, timeline, links de entidad e integraciones propias.

Motivos:

- Tiptap es headless, extensible y basado en ProseMirror.
- Tiptap guarda contenido como JSON, util para persistencia y auditoria.
- Tiptap soporta extensiones como menciones, links, listas y menus.
- dnd kit es especifico para React, accesible y flexible para arrastrar elementos.
- Las notas del CRM requieren backend propio; la libreria solo resuelve UI/editor.

Versiones verificadas en el registro publico de paquetes el 2026-09-24:

```txt
@tiptap/react: 3.31.3, MIT
@tiptap/starter-kit: 3.31.3, MIT
@dnd-kit/core: 6.3.1, MIT
lexical: 0.51.0, MIT
```

## Regla principal

Una nota siempre debe tener:

- autor;
- entidad o vista relacionada;
- tipo de nota;
- visibilidad;
- contenido;
- estado;
- fechas;
- auditoria;
- permisos efectivos.

No se permite guardar notas solo en localStorage como fuente de verdad.

## Tipos de nota

Catalogo inicial:

```txt
sticky_note
internal_note
follow_up_note
manager_note
warning_note
handoff_note
context_note
```

## Visibilidad

Catalogo inicial:

```txt
private
assigned_user
team
department
management
shared_users
system
```

Reglas:

- `private`: solo autor y usuarios con permiso especial de auditoria.
- `assigned_user`: visible para el usuario asignado a la entidad.
- `team`: visible para equipo autorizado.
- `department`: visible para dominio operativo autorizado.
- `management`: visible para jefatura/gerencia autorizada.
- `shared_users`: visible para usuarios especificos en tabla de accesos.
- `system`: nota generada por proceso interno, no editable por usuarios normales.

## Modelo de datos propuesto

### crm_note_types

```sql
CREATE TABLE crm_note_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_note_types_code (code),
  KEY ix_crm_note_types_active (is_active, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### crm_notes

```sql
CREATE TABLE crm_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) NOT NULL,
  note_type_id BIGINT UNSIGNED NOT NULL,
  domain_code VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  view_code VARCHAR(120) NULL,
  title VARCHAR(180) NULL,
  content_json JSON NOT NULL,
  plain_text TEXT NULL,
  color_code VARCHAR(40) NOT NULL DEFAULT 'yellow',
  status VARCHAR(60) NOT NULL DEFAULT 'active',
  visibility_scope VARCHAR(80) NOT NULL DEFAULT 'private',
  author_user_id BIGINT UNSIGNED NOT NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  assigned_user_id BIGINT UNSIGNED NULL,
  pinned_at DATETIME(3) NULL,
  resolved_at DATETIME(3) NULL,
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_notes_public_id (public_id),
  KEY ix_crm_notes_entity (entity_type, entity_id, status, updated_at),
  KEY ix_crm_notes_view (view_code, status, updated_at),
  KEY ix_crm_notes_author (author_user_id, updated_at),
  KEY ix_crm_notes_assigned (assigned_user_id, status, updated_at),
  KEY ix_crm_notes_domain_status (domain_code, status, updated_at),
  FULLTEXT KEY ft_crm_notes_plain_text (plain_text),
  CONSTRAINT fk_crm_notes_type FOREIGN KEY (note_type_id) REFERENCES crm_note_types(id),
  CONSTRAINT fk_crm_notes_author FOREIGN KEY (author_user_id) REFERENCES sec_user(id),
  CONSTRAINT fk_crm_notes_owner FOREIGN KEY (owner_user_id) REFERENCES sec_user(id),
  CONSTRAINT fk_crm_notes_assigned FOREIGN KEY (assigned_user_id) REFERENCES sec_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### crm_note_positions

Guarda posicion visual de la nota por usuario, vista y dispositivo.

```sql
CREATE TABLE crm_note_positions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  view_code VARCHAR(120) NOT NULL,
  x_position DECIMAL(10,2) NOT NULL DEFAULT 0,
  y_position DECIMAL(10,2) NOT NULL DEFAULT 0,
  width DECIMAL(10,2) NULL,
  height DECIMAL(10,2) NULL,
  z_index INT NOT NULL DEFAULT 0,
  is_collapsed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_note_positions_user_view_note (user_id, view_code, note_id),
  KEY ix_crm_note_positions_note (note_id),
  CONSTRAINT fk_crm_note_positions_note FOREIGN KEY (note_id) REFERENCES crm_notes(id),
  CONSTRAINT fk_crm_note_positions_user FOREIGN KEY (user_id) REFERENCES sec_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### crm_note_shares

Permite compartir una nota con usuarios, equipos o roles sin cambiar el autor.

```sql
CREATE TABLE crm_note_shares (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  share_target_type VARCHAR(60) NOT NULL,
  target_user_id BIGINT UNSIGNED NULL,
  target_team_id BIGINT UNSIGNED NULL,
  target_role_id BIGINT UNSIGNED NULL,
  permission_code VARCHAR(80) NOT NULL DEFAULT 'view',
  shared_by_user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY ix_crm_note_shares_note (note_id, revoked_at),
  KEY ix_crm_note_shares_target_user (target_user_id, revoked_at),
  KEY ix_crm_note_shares_target_role (target_role_id, revoked_at),
  CONSTRAINT fk_crm_note_shares_note FOREIGN KEY (note_id) REFERENCES crm_notes(id),
  CONSTRAINT fk_crm_note_shares_target_user FOREIGN KEY (target_user_id) REFERENCES sec_user(id),
  CONSTRAINT fk_crm_note_shares_target_role FOREIGN KEY (target_role_id) REFERENCES sec_role(id),
  CONSTRAINT fk_crm_note_shares_shared_by FOREIGN KEY (shared_by_user_id) REFERENCES sec_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### crm_note_history

Todo cambio relevante de una nota debe quedar registrado.

```sql
CREATE TABLE crm_note_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  action_code VARCHAR(100) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  previous_values JSON NULL,
  new_values JSON NULL,
  occurred_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_crm_note_history_note_occurred (note_id, occurred_at),
  KEY ix_crm_note_history_actor_occurred (actor_user_id, occurred_at),
  CONSTRAINT fk_crm_note_history_note FOREIGN KEY (note_id) REFERENCES crm_notes(id),
  CONSTRAINT fk_crm_note_history_actor FOREIGN KEY (actor_user_id) REFERENCES sec_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## Permisos

Permisos iniciales:

```txt
notes.view
notes.view_private_audit
notes.create
notes.update_own
notes.update_shared
notes.delete_own
notes.delete_any
notes.share
notes.pin
notes.resolve
notes.audit.view
```

Regla:

```txt
roles + permisos directos - denegaciones = permisos efectivos
```

Una nota puede estar en una vista, pero el API debe validar tambien si el usuario puede ver la entidad relacionada.

## Timeline y auditoria

Crear, editar, compartir, resolver, fijar, ocultar o eliminar una nota debe generar:

- `crm_note_history`;
- `crm_business_logs`;
- timeline de la entidad relacionada cuando aplique;
- auditoria si contiene decision, aprobacion, bloqueo o instruccion operacional.

Acciones canonicas:

```txt
note_created
note_updated
note_shared
note_pinned
note_unpinned
note_resolved
note_deleted
note_position_changed
```

## Seguridad de contenido

Reglas:

- persistir `content_json` como formato principal;
- generar `plain_text` sanitizado para busqueda;
- no guardar HTML como fuente primaria;
- sanitizar cualquier render HTML;
- limitar extensiones de editor a las aprobadas;
- no permitir scripts, iframes, estilos arbitrarios ni imagenes externas sin politica aprobada;
- validar tamano maximo de nota;
- registrar autor y cambios.

## Integraciones

Las notas pueden generar eventos de comunicacion o tareas, pero no deben depender de un proveedor.

Ejemplos:

```txt
nota menciona a un usuario -> notificacion interna
nota requiere seguimiento -> crear actividad/calendario
nota debe enviarse por WhatsApp -> usar puerto de comunicaciones
nota requiere correo -> usar puerto de comunicaciones
```

Kapso, Microsoft 365, correo y futuros proveedores deben vivir en adapters de integracion. El core solo emite una intencion canonica.

## Estructura backend esperada

```txt
src/modules/crm/notes/
+-- application/
|   +-- create-note.use-case.ts
|   +-- update-note.use-case.ts
|   +-- share-note.use-case.ts
|   +-- resolve-note.use-case.ts
|   +-- move-note-position.use-case.ts
+-- domain/
|   +-- note.entity.ts
|   +-- note-visibility.policy.ts
|   +-- note-permissions.policy.ts
+-- infrastructure/
|   +-- kysely-note.repository.ts
|   +-- note-search.repository.ts
+-- presentation/
    +-- notes.controller.ts
    +-- dto/
```

## Contrato canonico API

Ejemplo para crear nota:

```json
{
  "entityType": "lead",
  "entityId": "01J...",
  "viewCode": "sales.lead.detail",
  "noteType": "sticky_note",
  "visibility": "team",
  "title": "Revisar llamada",
  "content": {
    "type": "doc",
    "content": []
  },
  "color": "yellow",
  "position": {
    "x": 24,
    "y": 80,
    "width": 280,
    "height": 180
  }
}
```

Respuesta esperada:

```json
{
  "id": "01J...",
  "entityType": "lead",
  "viewCode": "sales.lead.detail",
  "noteType": "sticky_note",
  "visibility": "team",
  "status": "active",
  "title": "Revisar llamada",
  "plainText": "Revisar llamada",
  "canEdit": true,
  "canShare": true,
  "canDelete": true,
  "updatedAt": "2026-09-24T10:00:00-06:00"
}
```

## Regla final

Las notas son datos del CRM, no decoracion de pantalla.

Si una nota ayuda a entender una decision, una accion, un seguimiento o una excepcion, debe quedar persistida, autorizada y auditable.
