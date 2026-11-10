# Calendario global: API y contexto por módulo

## Lectura efectiva y consultas relacionadas — 2026-11-10

Mercadeo puede ampliar la población de lectura con `mercadeo.reports.read_all`;
los roles activos de Formalización y Jefe de Formalizaciones pueden leer
agenda de equipo con membresía y permiso efectivo. Las denegaciones siguen
prevaleciendo. La ampliación no concede actualización de eventos ajenos.
Al resolver opciones de órdenes, el API reutiliza la lectura autorizada del
mismo lead dentro de una petición. [90 — Reconciliación](90-Reconciliacion-API-20261110.md).

## Precedencia del contrato vigente — 2026-11-03

El formulario y la integración Microsoft365 descritos a continuación están
conectados en el código local. Los apartados28/29 y la revisión02/11 inferior
son históricos cuando niegan Graph/Teams o cuentan cinco rutas: hoy el controlador
registra siete handlers. La aceptación del tenant, entrega real de invitaciones,
Teams y reserva de salas se verifica por separado; no se acredita por esta revisión.

Adéndum agrega un efecto CRM específico: requiere exactamente una orden y su
cliente canónico; la relación queda bloqueada por metadato del servidor aun si
cambia el tipo del evento. Crear o convertir a `adendum` marca la orden pendiente
y aumenta su versión en la misma transacción; una edición ordinaria no la reabre.
Otro adéndum programado con inicio futuro bloquea la creación/reprogramación,
incluso fuera del intervalo visible; se excluye el propio evento al editar y se
ocultan detalles de eventos sin acceso. El bloqueo de orden serializa creadores.
La publicación Graph ocurre después del commit CRM y no decide la marca.
[83](83-Adendum-Migracion-065-y-Rollback.md) y [84](84-Adendum-Manual-Migracion-066-y-Permisos.md)
detallan marcador, nota, permisos y evidencia de065–067. Agregar una relación nueva
a lead/orden exige `formalizacion.calendar.assign_lead`; conservar relaciones
existentes u omitirlas al editar no concede una asignación nueva.

## Formulario guiado y Microsoft 365 — 02/11/2026

Ampliación solicitada y aprobada por el propietario en este chat. El formulario empieza con Tipo como único campo editable; cambiarlo conserva el borrador. Tipo y nombre siguen obligatorios en API y frontend. Formalización muestra «Referencia interna (opcional)», texto libre sin vínculo comercial. Participantes separa colaboradores de la empresa e invitados externos.

`GET /calendar/lookup` admite `leads` como JSON de identidades canónicas (tipo/origen/ID), hasta20. Revalida acceso a esos leads antes de filtrar órdenes del mismo origen. Una orden expone su lead solo si hay una identidad única y autorizada; seleccionarla incorpora ese lead. Retirar un lead pide confirmación para retirar sus órdenes y las que no tengan correspondencia confirmada. Notas incluye propias y compartidas accesibles, abiertas o completadas, sin exigir asignación de tarea; conserva ACL, permisos por módulo y denies. Guardar vuelve a comprobar relaciones y compatibilidad orden/lead.

### Integración externa y carga combinada

Regla de publicación (03/11/2026): el servidor decide según `profile.auth.currentProvider`. Una sesión Microsoft publica únicamente en el buzón de ese usuario y vincula el ID recibido al registro CRM ya confirmado. Una sesión local devuelve `delivery.status=crm_only`, incluso si el usuario tiene una identidad Microsoft vinculada de un acceso anterior; no adquiere tokens ni llama Graph para publicar. Una sesión Microsoft sin cuenta válida, consentimiento o servicio disponible conserva el evento CRM y devuelve el fallo real, no una confirmación de Outlook.

`ENABLE_CALENDAR_EXTERNAL=false` por defecto. Activado únicamente en el entorno local de esta implementación. No modifica la configuración de Azure ni acredita consentimiento del tenant. El botón Conectar Microsoft solicita `Calendars.ReadWrite`, `Calendars.Read.Shared` y `Place.Read.All` mediante `POST /identity/microsoft/start?calendar=true` y el flujo OIDC/PKCE existente. Esa variante exige sesión y permisos efectivos de calendario; firma en el challenge el hash del correo actual y rechaza otra cuenta en el callback antes de guardar identidad/sesión. El login ordinario y las renovaciones básicas conservan sus scopes previos. Un consentimiento de calendario faltante no revoca la sesión CRM.

- `POST /calendar/availability`: módulo, inicio/fin UTC, colaboradores CRM, sala opcional y evento nativo opcional; requiere sesión, CSRF, permiso de lectura y membresía efectiva. Intervalo máximo31 días;100 colaboradores. No acepta correos arbitrarios para consultar disponibilidad de terceros. Reutiliza el consentimiento actual `Calendars.ReadWrite` para agenda y disponibilidad por lotes de hasta20. Las sugerencias de trabajo de los siguientes7 días usan una adquisición independiente `Calendars.Read.Shared`; su falta no bloquea agenda ni salas y se informa como `suggestionsStatus=consent_required`. Los fallos parciales se muestran como desconocidos, nunca como disponibilidad libre.
- `GET /calendar/rooms?moduleCode=...`: salas reales del tenant, permiso delegado `Place.Read.All`, paginación acotada. Puede requerir consentimiento administrativo. Acepta opcionalmente `start` y `end` juntos (UTC, hasta31 días); consulta `getSchedule` en lotes de20 usando `Calendars.ReadWrite` sobre las direcciones del catálogo autorizado. Devuelve `availability=available|busy|unknown` por sala; un fallo o resultado ausente conserva unknown y no impide mostrar el catálogo. Esa consulta no reserva la sala.
- `POST/PATCH /calendar/events`: `publishToCalendar` opcional, con comportamiento predeterminado `true`; la UI envía `true` automáticamente al crear y editar, sin casilla ni panel técnico de Outlook/salas. El contrato API conserva `false` explícito por compatibilidad. `details.roomAddress` sigue opcional. `teamsRequested` activa una reunión Teams sobre el evento externo, sujeto a licencia/proveedor habilitado en el buzón.
- `GET /calendar/events` consulta primero el `calendarView` de Outlook para el intervalo visible y luego sus correspondencias en la BD nueva. Conserva `external_event_id_calendar_event_sync` (ID inmutable) y `external_uid_calendar_event_sync` (iCalUId compartido entre copias de asistentes), sin migración. Revalida módulos, ACL, invitaciones y denies al cargar los eventos nativos, incluso si la fecha CRM quedó fuera del intervalo. Une una sola entrada con datos actuales de Outlook y relaciones autorizadas del CRM; nunca correlaciona por título/hora. Eventos exclusivos de Outlook tienen `source=outlook`, `originModule=null` y no se importan a la BD. La edicion propia acotada del corte concurrente se describe abajo; invitaciones de otro organizador conservan solo lectura. Una cita vinculada movida/cancelada fuera del intervalo no reaparece en su fecha anterior. Ante fallo externo conserva CRM y devuelve `outlookStatus` explícito.
- La lectura pide `body` completo en texto, no `bodyPreview`, e incorpora `outlookId` y `outlookVersion` a las entradas combinadas. La edición envía `expectedOutlookVersion` observado; Graph mantiene `If-Match` y rechaza otro cambio posterior. No admite comodín ni saltos de línea. Las credenciales siguen exclusivamente en el servidor.
- La agenda lateral muestra las24 horas, eventos CRM y propios de Outlook, sin repetir las entradas ya combinadas. Conflictos de organizador, colaboradores y sala advierten sin bloquear. Otros colaboradores solo exponen horario/estado, no asuntos privados.
- `delivery` separa el resultado externo de `event` confirmado en CRM. Conserva el ID CRM ante fallo externo, congela el borrador y permite reintentar la misma operación o cerrar conservando ese registro. Un resultado incierto no declara ausencia de evento remoto.
- La sincronización reutiliza `int_external_system`, `int_calendar_connection` e `int_calendar_event_sync`, sin migración ni importación legacy. El organizador publica en su calendario predeterminado; no se permite publicar un evento de otro organizador. El evento nativo se confirma antes del proveedor. El bloqueo de evento y fila de sincronización serializa la entrega; `transactionId=crm:{eventPublicId}` evita recreaciones ante respuestas inciertas. Actualizaciones usan el ID remoto y `If-Match`/ETag. Una versión ya confirmada relee el evento externo, sin reenviar invitaciones. La confirmación se audita con códigos/datos permitidos, sin tokens o respuestas crudas.
- Una sala se envía como asistente `resource`; `accepted` acredita confirmación y `declined` rechazo. La solicitud no equivale a reserva. La UI muestra enlace Teams y resultado de sala antes de cerrar.

No incluye edición de recurrencia, configuración de recordatorios o de estado libre/ocupado, importación entrante a BD, cancelación externa ni trabajador de reintentos automático. Sí consulta disponibilidad libre/ocupado según el contrato anterior. Modificar un evento fuera del CRM puede producir conflicto de ETag y requiere reconciliación; no se sobrescribe automáticamente. El consentimiento, la reserva y una invitación real requieren validación con una cuenta Microsoft autorizada. No hay despliegue de producción por esta ampliación.

## Revisión histórica anterior a Microsoft365 - 2026-11-02

Se conserva el contrato ampliado del29: catálogo JSON054, participantes y
vínculos055, lookup protegido y eventos nativos auditados. El controlador registra
cinco rutas: calendarios, eventos, lookup, crear y editar. `GET /calendar/lookup`
requiere `moduleCode`, `kind` y búsqueda comercial mínima; el permiso del calendario
no sustituye el del registro. Campos `participants`, `links` y
`details.teamsRequested` se rigen por [68](68-Calendario-Participantes-y-Vinculos.md).
El texto libre `details.reference` sigue siendo texto, no reemplaza esos links.

Las limitaciones «sin invitados» del contrato base28 inferior no describen los
participantes CRM actuales; sí siguen pendientes envío de correo/Outlook, RSVP
y creación de reuniones Teams. Los datos de aplicación, conteos y navegador son
evidencias fechadas del28/29; esta revisión no volvió a consultar ni guardar eventos.

## Ampliación histórica — 29/10/2026

Crear/editar incorpora tipo obligatorio, participantes internos/correos externos, preferencia Teams y vínculos a notas pendientes, leads y órdenes nativas/legacy. Contrato y controles: [68 - Participantes y vínculos](68-Calendario-Participantes-y-Vinculos.md). La migración055 se aplicó y verificó únicamente en CRM_THINK_V2. El registro del evento es nativo; vincular un recurso legacy no lo copia ni lo modifica. Invitaciones internas dan lectura del evento sin acceso global al módulo; un deny de origen prevalece. No hay envío externo, Graph, reunión Teams ni RSVP operativo.

Los apartados del28 conservan su evidencia histórica. El trigger legacy allí indicado dejó de ser requisito por decisión posterior expresa del propietario; no se instaló ni se ampliaron privilegios RDS.

## Ajuste de Formalización — 02/11/2026

Por solicitud del propietario, Formalización ofrece únicamente Tarea (`tarea`), Reunión (`reunion`), Seguimiento (`seguimiento`), Formalización bancaria (`formalizacion_bancaria`) y Adéndum (`adendum`). Se retira `cita` del JSON para ese módulo. Mercadeo, Ventas y Contabilidad conservan sus cuatro tipos originales.

La migración061 agrega los dos tipos exclusivos y desactiva únicamente Cita de Formalización, con auditoría transaccional. Conserva IDs, eventos históricos y el registro `general` de consulta; no cambia permisos ni otros módulos. Los cinco tipos reutilizan `formalizacion.general.v1`, sin generación automática por procesos bancarios o contratos. Aplicación verificada en `CRM_THINK_V2`: ledger061 presente, un registro de auditoría, cinco tipos vigentes en Formalización y cuatro originales en cada otro módulo; cero eventos nativos. Esta verificación no acredita despliegue del API.

## Catálogo global conectado — 29/10/2026 (histórico)

`src/modules/crm/calendar/calendar-event-types.json` define Tarea, Reunión, Cita y Seguimiento. Cada entrada contiene `codigo` estable, `tipo` visible, `color` hexadecimal de seis dígitos y `modulos` con códigos canónicos. Inicialmente los cuatro tipos se habilitan en Formalización, Mercadeo, Ventas y Contabilidad; se restringe uno enumerando únicamente los módulos correspondientes. El color pertenece al tipo y será el mismo en todos sus módulos.

El runtime valida e importa el JSON mediante `calendar-event-types.catalog.ts`; una definición inválida o duplicada impide el arranque. `resolveJsonModule` incluye el archivo en la compilación del API. `GET /calendar/calendars` usa los IDs persistidos activos, filtra pares tipo/módulo definidos en JSON y entrega su nombre, color y orden global. El selector y FullCalendar consumen ese contrato existente sin duplicar el catálogo en el frontend.

La migración054, `202610290054_calendar_event_types`, aplicada solo a `CRM_THINK_V2`, registra los pares autorizados en `conf_calendar_event_type` y actualiza únicamente nombre/color/form key de coincidencias, conservando IDs y estados inactivos. Configuración y evento de auditoría de seguridad se guardan en una transacción; si no hay cambios no hay escrituras ni nueva auditoría. No modifica permisos ni eventos, ni accede a legacy. Los cuatro `general` se conservan como históricos pero no se ofrecen para crear/editar; el servidor bloquea también un PATCH directo sobre un tipo histórico retirado.

Agregar un tipo requiere añadir una entrada con código único y registrar sus pares en BD mediante una nueva migración de configuración; no basta editar el JSON para generar IDs. Cambiar el nombre visible no debe cambiar el código. Quitar un módulo del JSON retira la opción y bloquea su escritura sin borrar eventos históricos. Incluir un módulo no concede permisos a usuarios. La clave de formulario sigue siendo `{modulo}.general.v1`: el tipo clasifica el evento, el módulo determina su formulario actual.

Verificación live del 29/10:16 pares nuevos (cuatro por módulo), nombre/color coincidentes con JSON, cuatro IDs `general` originales conservados, cero eventos antes/después y un evento de auditoría de configuración. No se guardaron fixtures en las BD compartidas.

## Contrato base histórico - 28/10/2026

Complementa el modelo de tablas de `47-Calendario-Compartido-Esquema.md`.
Los párrafos de este contrato base se leen con las ampliaciones vigentes anteriores.

## Comportamiento

Una vista compartida sirve Formalización, Mercadeo, Ventas y Contabilidad. Inicialmente selecciona el calendario del módulo activo. El usuario puede superponer otros calendarios autorizados mediante casillas. Cambiar la selección visible no cambia el origen de ningún evento.

Cada evento conserva un módulo de origen inmutable y un tipo. El tipo aporta una clave persistida `formKey`, por ejemplo `formalizacion.general.v1`. Esa clave selecciona el formulario del módulo. Se entrega una base común (título, horario, día completo, descripción, ubicación y referencia libre); los campos comerciales específicos se incorporarán al definir sus reglas.

El detalle de un evento de otro módulo es de lectura. La interfaz permite ir al módulo de origen; allí comprueba nuevamente permisos para editar. Los permisos de lectura y edición son independientes: un permiso de escritura nunca amplía el alcance de lectura. Las denegaciones explícitas prevalecen, también para Owner mediante el perfil efectivo existente.

## API protegida

Todos los endpoints usan sesión, autorización global y `Cache-Control: no-store`. Las escrituras además pasan por la protección CSRF existente.

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/calendar/calendars` | Calendarios y tipos autorizados; capacidades de creación/edición |
| GET | `/calendar/events` | Eventos superpuestos en un intervalo autorizado |
| POST | `/calendar/events` | Crear evento nativo y registrar bitácora |
| PATCH | `/calendar/events/:id` | Editar evento nativo con versión y bitácora |

El listado recibe `moduleCodes` separados por coma, `contextModule`, `start` y `end` ISO UTC. Rechaza módulos duplicados, desconocidos o no autorizados; intervalo máximo 93 días. Usa solapamiento de intervalos semiabiertos: inicio del evento menor que fin solicitado y fin del evento mayor que inicio solicitado. Más de 500 resultados produce un error explícito para reducir el intervalo, sin devolver una lista incompleta como si fuera el total.

La respuesta es un solo JSON `{schemaVersion:1,events:[...]}`. Cada evento expone identidad pública, fuente, origen, tipo, formulario, título, descripción, ubicación, inicio/fin, día completo, estado, versión, referencia y `canEdit`. No expone IDs internos ni el propietario interno utilizado para autorizar.

Crear requiere `{moduleCode,typeId,title,start,end,allDay,details,operationId}`; descripción y ubicación son opcionales. Editar añade `expectedVersion`. `operationId` es UUID de una operación y debe conservarse al reintentar un resultado incierto. El API deriva al actor de la sesión, nunca del cuerpo. Los campos desconocidos se rechazan.

La referencia de `details.reference` es texto libre opcional, no una relación validada con una orden, lead o expediente. No concede acceso a registros. Los enlaces reales requieren el resolvedor de identidad y autorización del registro correspondiente.

## Persistencia y auditoría

Las nuevas creaciones viven en `CRM_THINK_V2.crm_calendar_event`. Se reutilizan tipo, organizador, participantes, módulo, versión y auditoría existentes. La migración 051 agrega detalles JSON, alias legacy único opcional y clave de formulario por tipo; configura un tipo general y permisos `*.calendar.read/create/update` para los módulos incluidos, conservando revocaciones y techos de módulo.

El evento y su bitácora se guardan en una sola transacción. Un bloqueo por actor serializa reintentos; el bloqueo de evento y `expectedVersion` rechazan ediciones obsoletas. Un fallo de bitácora revierte el guardado. La misma operación con contenido diferente se rechaza; una repetición válida no inserta ni edita de nuevo y devuelve la proyección actual autorizada.

Las fechas son UTC en MySQL y en el JSON, conservando milisegundos. Se enlazan como texto UTC explícito para evitar que mysql2 convierta según la zona horaria del proceso. La interfaz muestra América/Costa_Rica. Los días completos comienzan y terminan a medianoche de Costa Rica; el final es exclusivo. Máxima duración por evento: 366 días.

## Compatibilidad con la BD antigua

`crmdatabase-api.calendars` conserva sus filas y columnas. La ampliación aditiva crea `crm_calendar_event_context`, relacionada con el ID local del calendario antiguo: módulo, tipo, identidad pública, propietario público, fechas UTC, zona, día completo, estado, versión y detalles. No infiere origen, no convierte fechas ambiguas ni importa eventos antiguos automáticamente.

El lector combina únicamente eventos legacy con contexto explícito. Si existe un evento nativo con su alias legacy, el nativo tiene prioridad incluso si está eliminado lógicamente: no reaparece el anterior. Los resultados legacy son de lectura en este corte; no hay creación o edición del calendario productivo desde esta interfaz.

Las dos fuentes se consultan en una sola transacción de lectura del servidor configurado. Si la fuente legacy está habilitada y falla, se devuelve un error, no un calendario vacío aparentemente correcto. Los eventos históricos sin contexto necesitan una clasificación posterior autorizada antes de mostrarse.

## Despliegue y límites

Aplicar exclusivamente la migración nativa `202610280051_global_calendar` con el runner existente y la confirmación `CRM_THINK_V2`. Para legacy, revisar `scripts/migrate-legacy-calendar-context.ts --plan`; su aplicación exige `--apply=crmdatabase-api`. Los cambios DDL de MySQL no son atómicos junto con los permisos; ambos runners son idempotentes y validan estructura para recuperarse ante un fallo parcial.

No incluye sincronización Microsoft Graph/Outlook, envío de correo, invitados/RSVP, notificaciones de campana, cancelación operativa ni formularios comerciales completos. Las tablas previas mantienen capacidad futura; no se simula ninguna de esas integraciones.

Verificación: pruebas de autorización, contrato, consultas compiladas y transacciones con dobles; comprobación de estructura real tras aplicar migraciones. No se crean fixtures en las bases compartidas. Las pruebas con dobles no prueban contención/concurrencia en un servidor MySQL real.

### Evidencia de aplicación — 28/10/2026

- Migración051 aplicada y registrada en `CRM_THINK_V2`; lectura real confirmó cuatro tipos generales con sus claves de formulario y los doce permisos.
- `crmdatabase-api.crm_calendar_event_context` creada con catorce columnas, índices y restricciones verificadas. El plan posterior devuelve solamente el trigger pendiente.
- **Pendiente DBA:** RDS rechaza `CREATE TRIGGER` con `ER_BINLOG_CREATE_ROUTINE_NEED_SUPER`. No se cambian privilegios ni `log_bin_trust_function_creators`. El SQL revisado queda en `scripts/sql/legacy-calendar-context-trigger.sql`; ejecutar con una cuenta autorizada y repetir el runner en modo `--plan` para confirmar cero DDL pendiente.
- Lectura de ambas fuentes con el repositorio real sobre octubre2026: cero eventos nativos y cero eventos legacy clasificados. No significa que la tabla antigua esté vacía; sus filas sin contexto no se atribuyen a ningún módulo.
- Navegador: sesión real Owner, Formalización seleccionada inicialmente, superposición de Mercadeo y formulario lateral del módulo comprobados. No se guardaron eventos de prueba ni se ejerció concurrencia real en MySQL compartido.

### Avisos nativos y autoria: corte concurrente del 03/11/2026

El guardado crea avisos en `crm_calendar_notification` dentro de la misma transaccion del evento, relaciones y auditoria. Para participantes internos distintos del actor registra `invitation` si no estaban antes y `event_updated` si permanecen, usando la version del evento como clave de deduplicacion. Los correos externos no reciben este aviso nativo. No es una invitacion Exchange ni una confirmacion de asistencia; la entrega Graph mantiene su estado independiente.

`GET /calendar/notifications` devuelve hasta 100 avisos y `unreadCount`; cada item contiene `id`, `eventId`, `title`, `start`, `moduleCode`, `contextModule`, `organizer`, `kind` y `readAt`. El destinatario procede de la sesion. Revalida usuario activo, participacion vigente, modulo activo, evento no eliminado/cancelado, deny del origen y visibilidad/vencimiento del aviso. Requiere al menos un calendario legible; `contextModule` usa el origen si es legible y, en caso contrario, un contexto autorizado. No concede acceso a relaciones comerciales. `PUT /calendar/notifications/:id/read` valida ULID y marca leido de forma idempotente bajo los mismos filtros; `{ok:true}` no prueba que un ID ajeno exista o haya sido modificado.

Solo el organizador puede editar un evento CRM, incluso con permiso de calendario amplio; la proyeccion `canEdit` y el escritor aplican esa restriccion. Guardar relaciones de clientes vuelve a resolver sus identidades/ACL y agrega los correos validos de los leads vinculados a participantes. No se toma el contacto del texto enviado por el navegador.

Implementacion inspeccionada en desarrollo concurrente; no se ejecutaron pruebas de avisos, entrega real ni aceptacion externa. La presencia del codigo y de la tabla previa no acredita despliegue ni QA.

### Edicion propia de Outlook: ultimo delta concurrente (03/11/2026)

`PATCH /calendar/outlook-events/:id` ya esta conectado a `updateOwnEvent`. Requiere lectura y actualizacion efectivas del modulo y sesion Microsoft; el cuerpo estricto contiene `moduleCode`, `title` (1-300), `location` (hasta 500), `start`, `end`, `allDay` y `expectedVersion` no vacio. El intervalo debe ser positivo y no exceder 366 dias; dia completo exige medianoche de Costa Rica expresada a las 06:00 UTC. El servidor usa `Calendars.ReadWrite`; Graph relee `/me/events/:id`, exige `isOrganizer=true` y ETag coincidente antes del PATCH con `If-Match`. Solo cambia asunto, ubicacion, fechas y dia completo; no reemplaza participantes, descripcion, Teams ni recurrencia. Un resultado externo no confirmado devuelve conflicto para recargar; `{ok:true}` confirma respuesta del proveedor, sin crear un registro CRM para un evento exclusivo de Outlook.

Antes de editar un evento nativo sincronizado, una sesion Microsoft con correspondencia remota exige que Graph confirme el organizador; sin esa confirmacion se rechaza la edicion CRM. Las sesiones locales y eventos sin correspondencia conservan el control CRM del organizador. Revision estatica, sin prueba Graph real ni QA de este ultimo delta.

### Corte documental verificable — 2026-11-03 16:02:13.527338 UTC

Las ampliaciones vigentes de calendario se contrastaron con copias físicas de las fuentes tomadas a esta hora. El desarrollo de otros chats continuó durante la revisión; cambios posteriores quedan fuera de este corte. En `mergeOutlook`, una entrada combinada conserva `canEdit` solo si la autorización CRM ya lo permite y Graph confirma `isOrganizer=true`. Una entrada exclusiva de Outlook necesita actualización efectiva del contexto y ese mismo indicador del proveedor; conserva `outlookVersion`, no adquiere relaciones CRM y el servidor vuelve a comprobar organizador/ETag al editar. La ausencia o malformación del detalle remoto no autoriza edición.

Los avisos nativos y su API están conectados en backend y tienen consumidor frontend: `NoteNotifications.tsx` incorpora `useCalendarNotifications` y `CalendarNotificationList`, suma su contador a la campana y no condiciona ese consumidor a `enabled` de notas. Esta conexión estática no acredita entrega real ni aceptación E2E. Las pruebas de calendario del corte se leyeron como evidencia de intención y límites; no fueron ejecutadas en esta revisión documental.

**Brecha del mismo corte:** API y editor de eventos propios de Outlook están implementados, pero `apps/frontend/src/services/calendar/calendar-service.ts:231` todavía exige `canEdit===false` cuando `source=outlook`. La API ya puede devolver `true` para el organizador autorizado; el parser rechaza esa entrada e impide completar el recorrido de lectura/edición en esos casos. No debe interpretarse la implementación del endpoint/editor como aceptación E2E. La corrección de fuente queda fuera de esta revisión documental.

## Participación, Teams y campana — 2026-11-03

Teams tiene un interruptor visible fuera de Participantes. Los colaboradores admiten selección o listas de nombres/correos exactos separados por coma; las coincidencias ambiguas no seleccionan cuentas automáticamente. Los correos válidos de leads vinculados se resuelven en su origen con ACL vigente. El conjunto de participantes se deduplica y limita a100 antes de persistir. Con sesión Microsoft, Graph publica el evento e invitaciones; con sesión local se conserva el evento CRM.

La tabla existente `crm_calendar_notification` recibe invitaciones y actualizaciones en la transacción del evento, excluyendo al organizador y con dedupe por versión. `GET /calendar/notifications` devuelve hasta100 avisos y total no leído; `PUT /calendar/notifications/:id/read` confirma lectura individual. Se revalidan destinatario, cuenta activa, participación vigente, fechas y denies. No concede acceso a leads, órdenes o notas.

Solo el organizador nativo puede editar CRM, incluso con alcance amplio. Para eventos sincronizados se consulta `isOrganizer` antes de modificar CRM con sesión Microsoft. `PATCH /calendar/outlook-events/:id` permite editar título, lugar y horario de citas propias del buzón: requiere permiso CRM, sesión Microsoft, organizador confirmado por Graph y ETag con `If-Match`; registra auditoría de seguridad. Conserva asistentes, descripción/Teams y recurrencia. Los eventos Outlook de día completo conservan sus fechas y zona originales; solo editan título/lugar. Los de terceros son de consulta. Guardar no confirma aceptación de invitados ni reserva de sala.

## Detalle unificado de Outlook y CRM — 2026-11-03

El feed conserva `crmDetail` como copia independiente de los campos CRM antes de superponer los valores de Outlook. Incluye tipo/nombre/color persistidos, color específico, referencia, estado, horario/lugar/descripción CRM, organizador, Teams solicitado, recurso de sala, zona, creación/actualización y versiones. El JSON interno y los IDs internos no se exponen. La correspondencia Outlook/CRM conserva las identidades remotas y UID existentes, sin unir por título o fecha.

El listado marca `crmDetail.loaded=false` y no resuelve nuevas etiquetas de relaciones. `GET /calendar/events/:id/detail` devuelve el detalle actual con `loaded=true` únicamente después de validar sesión, permiso de calendario, propiedad/alcance o participación activa y ausencia de deny en el módulo de origen. Cada lead/orden/nota revalida su ACL individualmente: vínculos ilegibles no exponen identidad ni etiqueta y no ocultan los demás. Participar en el evento no concede acceso al registro comercial. Se incluye la lista de participantes CRM del evento autorizado.

El detalle se consulta al abrirlo, con skeleton y descarte de respuestas atrasadas. Los eventos sincronizados muestran ambas fuentes y el organizador conserva la acción al formulario CRM; eventos exclusivos de Outlook indican ausencia de registro CRM, sin inventar relaciones ni tipo. La lectura adicional no concede edición ni altera datos o reservas.
