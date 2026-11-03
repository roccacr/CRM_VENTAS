# Calendario global: API y contexto por módulo

## Revisión del contrato actual - 2026-11-02

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

## Ampliación vigente — 29/10/2026

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
