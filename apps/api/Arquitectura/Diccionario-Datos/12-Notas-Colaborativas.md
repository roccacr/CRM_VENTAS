# 12 - Notas colaborativas: esquema nativo, etapa1

## Uso actual de vínculos - revisión 2026-11-02

La ampliación [68](../68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md) reutiliza
`crm_note_link` sin añadir otra tabla o migración. `is_primary_note_link=1`
identifica el contexto original único; los enlaces secundarios soportados son
`lead` y `sales_order`. Destinos nativos usan sus FK y publicId resuelto; legacy
usa sistema `legacy_crm` + tipo + PK original, nunca un número ERP sin calificar.
La PK antigua de lead es `id_lead`, no `idinterno_lead`.

La clave secundaria hash se deriva de tipo/fuente/ID sin módulo; el hash antiguo
del principal sigue siendo válido. Las búsquedas de notas de una orden admiten
secundarios y aliases confirmados sin duplicar notas. Se validan FK, destino y
clave; no se elimina la validación del único principal para aceptar cualquier fila.
El historial público redacta identidades de relaciones, conservando la auditoría
interna. La presencia de una referencia no concede acceso al recurso ni copia
su contenido. No se reejecutó DDL ni metadata MySQL en esta revisión.

## Extensiones vigentes - 2026-10-29

Este diccionario conserva el corte de039 y añade040/044/046/052/053. El esquema
no acredita permisos por sí solo: NotesModule registra comandos, colaboración,
workflow y entrega interna con autorización actual. No se importaron notas ni
se activó copia legacy. [66](../66-Notas-Enterprise-Seguimiento.md) explica reglas
operativas y [67](../67-Plan-QA-Regresiones-20261029.md) contiene QA fechado.
Los conteos de tablas vacías y verificaciones de039 son históricos del27.

Corte:2026-10-27. Migracion039 aplicada y conciliada en CRM_THINK_V2.
Siete tablas vacias:91 columnas comentadas,24 FK y15 CHECK verificados mediante
metadata y cotejo del DDL. Corte histórico etapa1: sin notas importadas, grants, API, UI ni avisos en ese momento; ver extensiones040/044 al final.

DDL fuente: [039](../SQL/039_notes_domain.sql). Plan: [56](../56-Plan-Notas-Colaborativas-y-Convivencia-Legacy.md).
La nueva BD es principal; int_note_external_reference solo reserva la estructura
de compatibilidad. No escribe en legacy por existir una fila o default pending.

## Reglas y límites del corte histórico039

- PK internas BIGINT UNSIGNED, publicId ULID en nota/respuesta, FK a sec_user y
  dominios nativos reales. Enlaces externos incluyen sistema+tipo+ID.
- Home es un contexto view, sin lead/transaccion ficticios. Un solo enlace
  principal y unicidad por nota/contexto. No habilita entidades futuras sin adapter.
- Respuesta citada/mencion debe pertenecer al mismo hilo por FK compuesta.
- Participacion es independiente de mencion. No existe edit_any ni grant nuevo.
- Completar/archivar conserva contenido; fecha/actor y atribucion consistentes.
- PIN, tamano, ocultamiento y posicion son por usuario/contexto/pantalla.
- UTC_TIMESTAMP(3) en defaults; NO triggers ni ON UPDATE dependiente de zona.
  Los comandos de etapa2 DEBEN actualizar updated_at explicitamente en UTC.
- La autoria inmutable y ACL de usuario autenticado son reglas de los futuros
  comandos, no una politica de acceso ya activa en MySQL. CHECK valida actores
  declarados, pero no identifica al usuario HTTP. No hay endpoints de notas hoy.
- Citas de respuesta sin ciclos y menciones de version vigente se validaran en
  API; la FK garantiza hilo, no orden temporal ni permiso. Los cuerpos JSON y
  links requieren limites/sanitizacion en etapa2, no solo tipo JSON de BD.
- No se crea otro historial que duplique audit_record_event. Versiones y
  auditoria de contenido se conectaran antes de habilitar edicion a usuarios.

## Incidencia y recuperacion

El primer intento creo las siete tablas, pero fallo al crear triggers por
privilegio SUPER requerido con binlog. No se cambio log_bin_trust_function_creators,
privilegios ni configuracion. Se retiro esa dependencia antes de registrar039.

La recuperacion explicita cotejo tablas/engine/collation/comentarios, columnas,
tipos/null/default/generadas, PK/indices, FK, CHECK enforced y ausencia de filas
y triggers con el DDL final, antes de registrar mediante runSelectedSchemaMigrations.
No se borraron ni alteraron tablas para completar el ledger. El runner normal
sigue rechazando tablas parciales; no se agrego adopcion silenciosa al producto.
Recibo y verificador local de esta operacion: C:/codex-data/notes-schema-039-reconcile.mjs.
Hash SHA256 del DDL por sentencias revisadas:
`5ca99c91cb92a548f05e7ccb5f7c8f8ac3ebe868e42a742d5c25dc327e4a6be8`.
El reintento oficial de039 se omitio por ledger aplicado. Un futuro drift exige
reconciliacion explicita; no borrar entradas de ledger para reparar.

## Verificacion de entrega

- Prueba roja inicial: faltaba la migracion039; luego pruebas de destino incorrecto,
  parentesco, tablas parciales, creacion sin imports y estructura comentada.
- Suite migraciones:191 aprobadas,17 optativas omitidas.
- Suite API completa del27:5734 aprobadas,119 omitidas; no se cuentan como prueba
  de escritura real de notas ni aceptacion MySQL de ACL/concurrencia.
- API build y typecheck aprobados; Prettier de archivos tocados aprobado.
- Lint global tuvo primero ENOENT de .tmp-verify-primary.ts, archivo temporal
  ajeno que desaparecio durante el barrido; segunda ejecucion global aprobada.
- Las comprobaciones nativas reales fueron de DDL/metadata y conteos vacios.
  No se insertaron fixtures de notas/usuarios/transacciones en CRM_THINK_V2.


Enlaces locales de documentos de entrega:122 validos,0 rotos; diff-check
aprobado. Conciliacion final posterior a pruebas: siete tablas,91 columnas,
24 FK,15 CHECK y0 filas. Sin cambios adicionales al esquema.

## Tablas y campos

### crm_note

| Columna | Tipo | Significado |
| --- | --- | --- |
| `id_note` | `BIGINT UNSIGNED` | Identidad interna propia de la nota |
| `public_id_note` | `CHAR(26)` | ULID publico estable; no identifica una copia externa |
| `author_user_id_note` | `BIGINT UNSIGNED` | Autor inmutable relacionado con sec_user, nunca un ID ERP |
| `title_note` | `VARCHAR(200)` | Titulo opcional de la nota |
| `content_note` | `JSON` | Contenido estructurado validado por API; no HTML arbitrario |
| `plain_text_note` | `TEXT` | Texto derivado para lectura y busqueda con control de acceso |
| `color_note` | `CHAR(7)` | Color RGB validado por API, sin significado de permiso |
| `priority_note` | `VARCHAR(16)` | Prioridad low, normal o high independiente del estado |
| `visibility_note` | `VARCHAR(16)` | Private para autor o shared para participantes explicitamente autorizados |
| `status_note` | `VARCHAR(16)` | Estado open, completed o archived; no es lectura individual |
| `version_note` | `INT UNSIGNED` | Version optimista del contenido y acciones de negocio |
| `updated_by_user_id_note` | `BIGINT UNSIGNED` | Autor responsable de la ultima modificacion de la nota original |
| `completed_at_note` | `DATETIME(3)` | Fecha UTC en que el autor completo la nota |
| `completed_by_user_id_note` | `BIGINT UNSIGNED` | Autor que completo la nota; no un destinatario |
| `archived_at_note` | `DATETIME(3)` | Fecha UTC del archivo logico; no destruye respuestas ni historial |
| `archived_by_user_id_note` | `BIGINT UNSIGNED` | Autor que archivo la nota |
| `created_at_note` | `DATETIME(3)` | Creacion UTC de la nota principal nativa |
| `updated_at_note` | `DATETIME(3)` | Ultimo cambio UTC de contenido; el layout se guarda separado |

### crm_note_reply

| Columna | Tipo | Significado |
| --- | --- | --- |
| `id_note_reply` | `BIGINT UNSIGNED` | Identidad interna de una respuesta |
| `public_id_note_reply` | `CHAR(26)` | ULID publico de la respuesta |
| `note_id_note_reply` | `BIGINT UNSIGNED` | Nota a la que pertenece permanentemente la respuesta |
| `author_user_id_note_reply` | `BIGINT UNSIGNED` | Autor inmutable de esta respuesta, no necesariamente autor de la nota |
| `quoted_reply_id_note_reply` | `BIGINT UNSIGNED` | Respuesta citada del mismo hilo; no crea otro contenido |
| `content_note_reply` | `JSON` | Cuerpo estructurado de la respuesta validado por API |
| `plain_text_note_reply` | `TEXT` | Texto de la respuesta derivado para consultas autorizadas |
| `version_note_reply` | `INT UNSIGNED` | Version optimista de esta respuesta |
| `withdrawn_at_note_reply` | `DATETIME(3)` | Retiro logico de la respuesta por su autor; conserva atribucion |
| `created_at_note_reply` | `DATETIME(3)` | Publicacion UTC de la respuesta |
| `updated_at_note_reply` | `DATETIME(3)` | Ultima edicion UTC de esta respuesta |

### crm_note_participant

| Columna | Tipo | Significado |
| --- | --- | --- |
| `id_note_participant` | `BIGINT UNSIGNED` | Identidad interna del acceso individual a una nota |
| `note_id_note_participant` | `BIGINT UNSIGNED` | Nota compartida por su autor |
| `user_id_note_participant` | `BIGINT UNSIGNED` | Usuario interno destinatario, nunca una lista CSV |
| `access_note_participant` | `VARCHAR(16)` | Capacidad read o reply; nunca edicion de la nota original |
| `status_note_participant` | `VARCHAR(16)` | Estado active o revoked del acceso explicito |
| `granted_by_user_id_note_participant` | `BIGINT UNSIGNED` | Actor autorizado que concedio el acceso; la API exige autor de nota |
| `revoked_by_user_id_note_participant` | `BIGINT UNSIGNED` | Actor autorizado que retiro el acceso |
| `revoked_at_note_participant` | `DATETIME(3)` | Revocacion UTC que invalida lectura y avisos pendientes |
| `following_note_participant` | `TINYINT UNSIGNED` | Preferencia individual de seguimiento del hilo |
| `muted_until_note_participant` | `DATETIME(3)` | Silencio individual UTC sin revocar el acceso |
| `created_at_note_participant` | `DATETIME(3)` | Primer otorgamiento UTC; reactivaciones se auditan |
| `updated_at_note_participant` | `DATETIME(3)` | Ultimo cambio UTC de acceso o preferencias |

### crm_note_mention

| Columna | Tipo | Significado |
| --- | --- | --- |
| `id_note_mention` | `BIGINT UNSIGNED` | Identidad interna de una mencion estructurada |
| `note_id_note_mention` | `BIGINT UNSIGNED` | Nota cuyo contenido o respuesta menciona a la persona |
| `reply_id_note_mention` | `BIGINT UNSIGNED` | Respuesta del mismo hilo; null identifica el cuerpo de la nota |
| `reply_key_note_mention` | `BIGINT UNSIGNED` | Clave tecnica de unicidad; cero solo representa el cuerpo, no una FK ficticia |
| `user_id_note_mention` | `BIGINT UNSIGNED` | Usuario mencionado por identidad nativa y no texto libre |
| `content_version_note_mention` | `INT UNSIGNED` | Version de nota o respuesta que origino la mencion |
| `created_at_note_mention` | `DATETIME(3)` | Registro UTC de esta mencion; no acredita entrega ni concede acceso |
| `updated_at_note_mention` | `DATETIME(3)` | Ultima modificacion UTC de metadata de mencion |

### crm_note_link

| Columna | Tipo | Significado |
| --- | --- | --- |
| `id_note_link` | `BIGINT UNSIGNED` | Identidad interna del contexto relacionado |
| `note_id_note_link` | `BIGINT UNSIGNED` | Nota relacionada sin duplicar su contenido |
| `target_key_note_link` | `CHAR(64)` | Huella canonica de tipo fuente e identidad para evitar enlaces duplicados |
| `target_kind_note_link` | `VARCHAR(16)` | Contexto view, native o external; cada tipo exige sus referencias |
| `entity_type_note_link` | `VARCHAR(40)` | Tipo canonico resuelto por adaptadores registrados; no nombre SQL arbitrario |
| `view_code_note_link` | `VARCHAR(120)` | Vista registrada como marketing.home; no requiere un lead ficticio |
| `lead_id_note_link` | `BIGINT UNSIGNED` | Lead nativo relacionado cuando el tipo es lead |
| `contact_id_note_link` | `BIGINT UNSIGNED` | Contacto nativo relacionado cuando el tipo es contact |
| `sales_order_id_note_link` | `BIGINT UNSIGNED` | Orden nativa relacionada cuando el tipo es sales_order |
| `calendar_event_id_note_link` | `BIGINT UNSIGNED` | Evento nativo relacionado cuando el tipo es calendar_event |
| `external_system_id_note_link` | `BIGINT UNSIGNED` | Sistema de la entidad externa; un numero solo no identifica al proveedor |
| `external_id_note_link` | `VARCHAR(191)` | Identidad externa conservada como texto sin convertirla en PK nativa |
| `is_primary_note_link` | `TINYINT UNSIGNED` | Marca el destino preferido al abrir la nota |
| `primary_key_note_link` | `TINYINT` | Permite un solo destino principal por nota |
| `created_at_note_link` | `DATETIME(3)` | Fecha UTC de vinculacion del contexto |
| `updated_at_note_link` | `DATETIME(3)` | Ultima modificacion UTC del enlace |

### crm_note_placement

| Columna | Tipo | Significado |
| --- | --- | --- |
| `id_note_placement` | `BIGINT UNSIGNED` | Identidad interna del layout individual |
| `note_id_note_placement` | `BIGINT UNSIGNED` | Nota cuya presentacion administra esta persona |
| `user_id_note_placement` | `BIGINT UNSIGNED` | Usuario propietario de la posicion; no cambia autor ni contenido |
| `context_code_note_placement` | `VARCHAR(120)` | Vista o contexto registrado; la API vuelve a autorizar su lectura |
| `viewport_class_note_placement` | `VARCHAR(16)` | Clase desktop, tablet o mobile para restauracion adaptable |
| `anchor_mode_note_placement` | `VARCHAR(16)` | Context desplaza con vista; viewport permanece fijo al hacer scroll |
| `x_note_placement` | `DECIMAL(12,4)` | Posicion horizontal CSS no negativa respecto al espacio de anclaje |
| `y_note_placement` | `DECIMAL(12,4)` | Posicion vertical CSS no negativa respecto al espacio de anclaje |
| `width_note_placement` | `INT UNSIGNED` | Ancho CSS de la nota limitado para restaurar dentro de pantalla |
| `height_note_placement` | `INT UNSIGNED` | Alto CSS de la nota limitado para restaurar dentro de pantalla |
| `collapsed_note_placement` | `TINYINT UNSIGNED` | Minimizacion personal sin completar la nota |
| `hidden_at_note_placement` | `DATETIME(3)` | Ocultamiento individual UTC sin modificar a otros participantes |
| `layout_version_note_placement` | `INT UNSIGNED` | Version optimista del layout independiente del texto |
| `created_at_note_placement` | `DATETIME(3)` | Primer guardado UTC de esta presentacion personal |
| `updated_at_note_placement` | `DATETIME(3)` | Ultimo guardado UTC; no actualiza fecha de contenido |

### int_note_external_reference

| Columna | Tipo | Significado |
| --- | --- | --- |
| `id_note_external_reference` | `BIGINT UNSIGNED` | Identidad interna del vinculo de compatibilidad |
| `note_id_note_external_reference` | `BIGINT UNSIGNED` | Nota principal nativa cuya copia depende de un adaptador |
| `external_system_id_note_external_reference` | `BIGINT UNSIGNED` | Sistema registrado que contiene la copia; no campo especifico de proveedor |
| `external_id_note_external_reference` | `VARCHAR(191)` | Identidad de la copia; null hasta confirmar la primera sincronizacion |
| `sync_status_note_external_reference` | `VARCHAR(16)` | Estado pending, synced, failed o disabled de la proyeccion |
| `requested_version_note_external_reference` | `INT UNSIGNED` | Version nativa que debe representar la copia |
| `synced_version_note_external_reference` | `INT UNSIGNED` | Ultima version confirmada; cero significa que no existe confirmacion |
| `last_synced_at_note_external_reference` | `DATETIME(3)` | Confirmacion UTC de la ultima version aplicada externamente |
| `last_error_code_note_external_reference` | `VARCHAR(80)` | Codigo tecnico acotado sin cuerpos privados ni secretos |
| `created_at_note_external_reference` | `DATETIME(3)` | Creacion UTC del vinculo; no ejecuta escrituras externas |
| `updated_at_note_external_reference` | `DATETIME(3)` | Ultimo cambio UTC del estado de sincronizacion |


## Extension040 - API de notas

crm_note.origin_module_code_note: VARCHAR(40) NOT NULL, modulo de origen inmutable con CHECK de cinco modulos e indice de autor/estado/fecha. int_note_command almacena recibos por actor+operationId, hash de solicitud y resultado JSON minimo. int_event_outbox almacena eventos versionados por agregado/destino, estado, intentos y fechas UTC; en etapa4 el worker consume únicamente eventos nuevos note_collaboration para campana interna. Todos los campos llevan COMMENT. DDL autoritativo: [040](../SQL/040_notes_commands.sql). Contrato y limites: [57](../57-Notas-Etapa2-API.md). Sin datos importados ni fixtures en la base del CRM.

## Contextos opcionales y041

El esquema039/040 no cambia. Enlaces view aceptan codigos de vistas registradas y `<modulo>.personal`; external guarda la orden legacy con sistema registrado e ID textual.041 registra solo (`legacy_crm`,`CRM Legacy`,`active`) en int_external_system, sin DDL/imports. Contrato y evidencia en [59](../59-Notas-Contexto-Opcional-y-Vistas.md).


## Extension044 - colaboración y campana interna

044 aplicada27octubre2026; ledger=1,13 columnas nuevas verificadas y0 comentarios ausentes,20 definiciones de permisos. Sin imports. El esquema039 conserva datos y relaciones; versión de contenido, colaboración y layout son independientes. [Contrato60](../60-Notas-Etapa4-Colaboracion-y-Notificaciones.md).

| Columna nueva | Definición SQL | Significado |
| --- | --- | --- |
| collaboration_version_note | INT UNSIGNED NOT NULL DEFAULT 1 | Version independiente de comandos colaborativos para concurrencia y eventos |
| collaboration_updated_at_note | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Ultimo cambio colaborativo UTC actualizado explicitamente |
| id_notification | BIGINT UNSIGNED NOT NULL AUTO_INCREMENT | Identidad interna ordenable de la notificacion |
| public_id_notification | CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL | ULID publico de la notificacion individual |
| recipient_user_id_notification | BIGINT UNSIGNED NOT NULL | Destinatario nativo exclusivo de lectura y cambios |
| actor_user_id_notification | BIGINT UNSIGNED NOT NULL | Autor nativo del evento colaborativo |
| source_event_id_notification | BIGINT UNSIGNED NOT NULL | Evento duradero que origino la notificacion |
| note_id_notification | BIGINT UNSIGNED NOT NULL | Nota nativa cuya autorizacion vigente debe comprobarse |
| module_code_notification | VARCHAR(40) NOT NULL | Modulo inmutable de origen sin otorgar acceso por si mismo |
| kind_notification | VARCHAR(16) NOT NULL | Motivo compartida respuesta o mencion sin contenido privado |
| status_notification | VARCHAR(16) NOT NULL DEFAULT 'active' | Estado active o suppressed; revocacion permanente por evento |
| read_at_notification | DATETIME(3) NULL | Primera lectura explicita UTC del destinatario |
| created_at_notification | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Fecha UTC del evento original para respetar el corte de lectura |

sec_notification incluye ULID único, clave única por evento/destinatario, índices de bandeja y nota, cuatro FK nativas y CHECK de tipo/estado; no almacena título ni cuerpo privado. Revocar marca suppressed y nunca revive esos avisos por reinvitar. DDL: [044](../SQL/044_notes_collaboration.sql).

## Publicación realtime: migración046

DDL: [046](../SQL/046_notes_realtime.sql). Intenciones nativas sin contenido privado; no proyección legacy. Estado operativo y seguridad: [62](../62-Notas-Tiempo-Real-Implementacion.md).

| Columna | Definición | Significado |
| --- | --- | --- |
| id_note_realtime_event | BIGINT UNSIGNED NOT NULL AUTO_INCREMENT | Identidad interna de intencion duradera de publicacion |
| public_id_note_realtime_event | CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL | ULID estable para deduplicar reintentos de transporte |
| recipient_user_id_note_realtime_event | BIGINT UNSIGNED NOT NULL | Destinatario nativo exclusivo reautorizado al publicar |
| note_id_note_realtime_event | BIGINT UNSIGNED NULL | Nota opcional sin contenido ni identificadores comerciales |
| notification_id_note_realtime_event | BIGINT UNSIGNED NULL | Aviso ya persistido atomicamente antes de su publicacion |
| kind_note_realtime_event | VARCHAR(32) NOT NULL | Tipo versionado de invalidacion segura sin cuerpos privados |
| version_note_realtime_event | INT UNSIGNED NULL | Version opcional del contenido nativo |
| collaboration_version_note_realtime_event | INT UNSIGNED NULL | Version opcional de colaboracion nativa |
| status_note_realtime_event | VARCHAR(16) NOT NULL DEFAULT 'pending' | Pending processing published o failed; publicado nunca significa leido |
| attempts_note_realtime_event | TINYINT UNSIGNED NOT NULL DEFAULT 0 | Intento monotono usado como fencing de lease |
| available_at_note_realtime_event | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Disponibilidad UTC o vencimiento de lease activo |
| occurred_at_note_realtime_event | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Instante UTC de la mutacion original |
| published_at_note_realtime_event | DATETIME(3) NULL | Instante UTC del intento de publicacion confirmado por dispatcher |
| last_error_code_note_realtime_event | VARCHAR(64) NULL | Codigo tecnico seguro sin texto de errores privados |

Tres FK a usuario, nota y aviso; ULID/destinatario único; índices por claim, destinatario y nota. Cuatro CHECK restringen tipo, estado/intentos, versiones positivas y referencias obligatorias. Publicado no significa leído.


## Extensión052 - ubicaciones visuales adicionales

DDL autoritativo: [052](../SQL/052_notes_locations.sql). No cambia el vínculo
principal de crm_note_link ni duplica nota/contenido. PK compuesta por nota,
módulo y vista, FK a nota/autor y CHECK de Homes registrados; no guarda URLs.

### crm_note_location

| Columna | Tipo | Significado |
| --- | --- | --- |
| note_id_note_location | BIGINT UNSIGNED | Nota nativa única cuya ACL no cambia por agregar un Home |
| module_code_note_location | VARCHAR(40) | Módulo del Home adicional, sin conceder membresía ni permisos |
| view_code_note_location | VARCHAR(100) | Código registrado sales-home, marketing-home, formalization-home, accounting-home o admin-home |
| created_by_user_id_note_location | BIGINT UNSIGNED | Autor que agrega la ubicación |
| created_at_note_location | DATETIME(3) | Alta UTC de la referencia visual |

Solo el autor administra ubicaciones con share_own; el servidor ofrece únicamente
Homes autorizados. Las ubicaciones que no puede administrar no se borran por
omitirlas desde un selector restringido. Ver la misma orden en otro módulo usa
sales_order + source + id; un Home es una ubicación adicional distinta de ese
vínculo principal y no modifica el permiso comercial del registro.

## Extensión053 - tarea compartida y programación privada

DDL autoritativo: [053](../SQL/053_notes_workflow.sql). No cambia autoría ni
concede permisos. Las 13 columnas nuevas de estas dos tablas y las cinco de052
llevan COMMENT; ese total no incluye columnas modificadas ni toda la estructura
histórica del dominio. La migración amplía kind_notification a
shared/reply/mention/assigned/reminder/due.

### crm_note_task

| Columna | Tipo | Significado |
| --- | --- | --- |
| note_id_note_task | BIGINT UNSIGNED | PK/FK: una tarea compartida como máximo por nota |
| assignee_user_id_note_task | BIGINT UNSIGNED NULL | Responsable nativo opcional: autor o participante vigente, no creador ERP |
| due_at_note_task | DATETIME(3) NULL | Vencimiento UTC compartido, distinto del recordatorio privado |
| version_note_task | INT UNSIGNED | Versión optimista de tarea, independiente de contenido y colaboración |
| updated_at_note_task | DATETIME(3) | Última modificación UTC de responsable/vencimiento |

### crm_note_workflow_event

| Columna | Tipo | Significado |
| --- | --- | --- |
| id_note_workflow_event | INT UNSIGNED | Identidad monotónica interna del aviso programado y recibo |
| note_id_note_workflow_event | BIGINT UNSIGNED | Nota cuyo estado/ACL vuelve a comprobar el worker |
| recipient_user_id_note_workflow_event | BIGINT UNSIGNED | Destinatario exclusivo del recordatorio o aviso de tarea |
| kind_note_workflow_event | VARCHAR(16) | assigned, reminder o due |
| scheduled_at_note_workflow_event | DATETIME(3) | Fecha UTC original de programación, sin depender del navegador abierto |
| available_at_note_workflow_event | DATETIME(3) | Próxima ejecución UTC o expiración del lease |
| status_note_workflow_event | VARCHAR(16) | pending, processing, delivered, cancelled o suppressed; no equivale a leído |
| attempts_note_workflow_event | INT UNSIGNED | Token creciente de fencing que invalida confirmaciones de leases anteriores |

FK a nota/usuario; índices de claim y nota/destinatario/tipo; CHECK de kind y
status. Cancelar un recordatorio no elimina contenido ni cancela el vencimiento
compartido. Los comandos/worker validan estado abierto, ACL y destinatario;
completar/archivar y revocar invalidan la programación correspondiente. Un
recordatorio es propio: el contrato de lectura muestra solo el del actor, no
el de todos los participantes. El historial respeta la misma privacidad.

Las validaciones de autoría, participante elegible, versión, idempotencia y
fechas UTC pertenecen a la API; las FK no autentican al usuario HTTP. No asumir
que una tabla o fila habilita copia legacy, invitación ni entrega externa.
