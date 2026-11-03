# Calendario global por módulo

## Contrato vigente contrastado — 03/11/2026

Relectura de interfaz: el interruptor Reunión de Microsoft Teams está junto a los datos del evento, fuera del acordeón Participantes; elegirlo solicita el enlace con la invitación, sin acreditar entrega. La búsqueda de colaboradores acepta varios nombres/correos separados por coma solo cuando cada token coincide de forma única con una cuenta devuelta por el lookup autorizado. No fabrica participantes por texto libre; los invitados externos conservan su campo separado. El snapshot congelado de las16:02:13 UTC confirma el consumidor de avisos descrito a continuación.

### Avisos y edición externa en el snapshot de cierre

`NoteNotificationsButton` integra `useCalendarNotifications` y `CalendarNotificationList`: suma el contador de calendario al de notas y monta una sección Calendario en la campana. El hook de calendario consulta por separado del socket de notas, cada30 segundos cuando el documento está visible, al recuperar foco y al abrir la campana. Usa `GET /calendar/notifications` y `PUT /calendar/notifications/:id/read`; abrir un aviso lo marca y navega al contexto autorizado con fecha/evento. Marcar leído no confirma asistencia. Los errores de consulta/lectura se muestran sin inventar entrega externa. El switch `enabled` de notas no deshabilita ese hook: su habilitación depende de la variante visible del encabezado.

`SharedCalendarPage` reconoce el enlace `?date=…&event=…` y abre una vez el evento devuelto por el feed; no inventa un evento si falta ni concede permisos por la invitación. Para un evento nativo invitado fuera de los calendarios seleccionados prepara un descriptor sin crear/editar, conservando la revalidación de acceso.

Existe `OutlookEventEdit`, montado desde el drawer externo cuando recibe contexto y callback. Exige `canEdit`, organizador propio y versión Outlook; modifica únicamente nombre, lugar, inicio/fin y allDay vía `PATCH /calendar/outlook-events/:id` con `expectedVersion`, sin reescribir asistentes/cuerpo/Teams. **Brecha del corte:** el parser `readOrigin` aún exige `canEdit=false` para `source=outlook`; por tanto no se certifica un recorrido operativo para editar eventos exclusivos propios aunque componente y comando estén preparados. Ante fallo la interfaz pide recargar/revisar versión y organizador; no hace reintento automático. No se confunde esta edición preparada con la publicación/PATCH de eventos CRM ya documentada.
Este corte describe el código local; prevalece sobre los antecedentes de editor vacío, invitados solo CRM o ausencia de Graph que se conservan abajo. No acredita despliegue ni escrituras externas reales.

- `SharedCalendarPage` presenta calendarios autorizados, búsqueda local sin distinguir tildes, filtros por tipo y Outlook, vistas Mes/Semana laboral/Semana/Día/Agenda y selección de un intervalo para precargar el alta. Los filtros visuales no reescriben los totales recibidos. Los atajos N/T/flechas/M/S/W/D/L y `/` se suspenden al escribir o abrir un panel.
- Outlook se consulta mediante el BFF, nunca directamente desde React. Los eventos exclusivos de Outlook se abren en una tarjeta de consulta y después en un drawer con organizador, invitados, respuesta propia, recurrencia, privacidad e importancia. Los recursos no cuentan como personas que aceptaron. Responder se delega a «Abrir en Outlook»; la UI no envía una aceptación o rechazo Graph. La tarjeta abre a derecha/izquierda según espacio y se cierra con Escape, clic externo o cambio de tamaño.
- `useCalendarOutlook` consulta disponibilidad por intervalo, asistentes, sala e identidad editada con espera de 500 ms; descarta respuestas anteriores. El panel diario abarca 00:00–24:00, distribuye solapamientos en columnas, muestra conflictos y permite aplicar sugerencias confirmadas. Un resultado desconocido no significa libre. Lugar ofrece autocompletado de salas devueltas por API y ubicación libre; conserva dirección de sala separada de su etiqueta.
- Tipo empieza vacío y habilita el resto. Tipo, nombre, inicio y fin son obligatorios. `publishToCalendar=true` solicita publicación automática; `crm_only` confirma un guardado CRM válido, `synced` muestra recibo con Teams y respuesta de sala. Pendiente no equivale a reserva aceptada; rechazo de sala mantiene el evento y explica que no hay reserva confirmada. No se muestra éxito externo ante fallo.
- El consentimiento ampliado reutiliza `startMicrosoftLogin(true)` y popup BFF; una sesión anterior no prueba que el callback nuevo terminó. Se exige una nueva identidad de sesión y se relee el usuario; si cambia, se recarga la aplicación. No se guardan tokens en React. Los estados de conexión no se convierten en privilegios CRM.
- El acceso global del encabezado de Formalización abre un evento vacío sin heredar orden, referencia, participantes o vínculos desde la URL; abrir/cerrar conserva la ficha y URL actuales. «Agendar evento» desde una orden o cliente resuelve primero su identidad exacta autorizada y cliente mediante lookup. Precarga y bloquea ambas relaciones, conserva notas editables y no enlaza por nombre.
- Adéndum (`adendum`) exige exactamente una orden y su cliente. Elegir orden incorpora su lead autorizado; quitar un lead confirma también retirar sus órdenes. Las relaciones de una orden contextual y las de Adéndum persistido quedan bloqueadas; `linksEditable=false` sigue omitiendo links en PATCH. El preflight de adéndum futuro espera 250 ms, bloquea mientras consulta o falla y ofrece reintento; al editar excluye el propio evento. El servidor revalida también al guardar y un 409 `EXISTING_FUTURE_ADDENDUM` exige releer.
- Un resultado incierto congela campos y sugerencias, conserva `operationId`, versión e ID CRM confirmado y admite el mismo comando. Un conflicto de versión Outlook conserva el evento CRM y obliga a recargar antes de sincronizar. Completar/cancelar el marcador de adéndum es una operación distinta del evento.

Fuentes: `src/modules/calendar/{SharedCalendarPage,CalendarEventDrawer,CalendarGuestFields,CalendarDayPanel}.tsx`, `useCalendarEventForm.ts`, `useCalendarOutlook.ts`, `useAddendumConflict.ts`, `calendar-view-tools.ts` y `src/modules/home/{FormalizationCalendarQuickCreate,FormalizationScheduleEvent}.tsx`. Pruebas de referencia: `test/calendar/` y `test/home/formalization-calendar-quick-create.spec.tsx`, `formalization-schedule-event.spec.tsx`; su existencia no constituye una ejecución nueva en esta revisión documental.

Relectura de cambios concurrentes del mismo día: las salas se reconsultan tras 350 ms por intervalo válido (hasta 31 días), y el servicio admite `availability=available|busy|unknown`. Lugar presenta punto y texto Disponible/No disponible/Sin confirmar; la reserva final continúa dependiendo de Exchange, no del color. Un intervalo inválido no se convierte en disponibilidad libre. Los hashes del inventario de revisión delimitan el último código inspeccionado; ediciones posteriores requieren otra conciliación.

## Carga combinada y guardado predeterminado — 02/11/2026

Lugar consulta el catálogo real `GET /calendar/rooms` al habilitar el formulario, independientemente de las sugerencias de horario. La búsqueda muestra nombre/capacidad del recurso; seleccionar guarda `location` y `details.roomAddress`. Escribir otra ubicación limpia la dirección de recurso anterior. Consulta libre/ocupado para el intervalo seleccionado: punto verde Disponible, rojo No disponible y gris Sin confirmar ante errores o información ausente; la reserva se solicita como asistente de recurso al guardar en Outlook y sigue sujeta a Exchange. Al cambiar fecha u horas se actualiza la consulta y se descartan los estados del intervalo anterior.

El formulario solicita la publicación automática; el servidor la determina según la sesión actual. `delivery.status=crm_only` es un guardado válido cuando la sesión no es Microsoft: termina y actualiza el calendario sin error ni confirmación falsa de Outlook. `synced` muestra la confirmación de ambos sistemas. Los errores reales de publicación de una sesión Microsoft siguen conservando el ID CRM y el mismo comando para reintentar.

Revisión de creación 03/11/2026: Tipo, Nombre del evento, Inicio y Fin se marcan con `*` y mantienen validación nativa `required`. Lugar, referencia, participantes, notas y descripción son opcionales. Adéndum conserva su regla de exactamente una orden y su cliente, con asteriscos en ambos selectores y validación adicional de adéndum futuro. Los nombres accesibles de los campos se mantienen. Un conflicto de versión de Outlook conserva el ID CRM confirmado y exige recargar antes de editar/sincronizar; no repite indefinidamente la versión remota obsoleta. Un resultado de red incierto sigue admitiendo únicamente el mismo comando/operación.

El calendario muestra un preload centrado «Cargando eventos…» durante la consulta inicial, recarga y cambios de intervalo o filtros. La cuadrícula permanece montada pero oculta e inerte hasta terminar; `aria-busy` y un estado accesible anuncian la carga. Si falla, el preload desaparece y se conserva el aviso de error.

Crear y editar solicita publicación automática (`publishToCalendar=true`), sin casilla ni sección «Outlook y salas». Conserva conflictos reales, sugerencias confirmadas y errores de guardado; Lugar ofrece autocompletado de salas y ubicación libre. El resultado efectivo distingue CRM y Outlook según la sesión y respuesta del servidor; un fallo externo conserva el ID CRM y no anuncia sincronización exitosa.

El calendario principal consume la lista combinada del API: Outlook se consulta primero y sus IDs se relacionan con la nueva BD. Un evento vinculado se muestra una vez, con horario/texto de Outlook y datos/permisos CRM. Las copias de invitados se correlacionan por iCalUId. Los exclusivos de Outlook se identifican como Outlook, no se les asigna módulo CRM y su detalle es de lectura. La agenda del formulario evita duplicar los mismos IDs ya cargados. `outlookStatus` advierte consultas incompletas sin confundirlas con una agenda vacía. Al editar se conserva la versión remota observada para `If-Match`.

## Antecedente anterior a la integración Outlook - 2026-11-02

La implementación actual conserva el formulario ampliado y metadatos descritos
en el corte29/10 siguiente. Rutas: `/home/{formalization,marketing,sales,accounting}/calendar`.
`SharedCalendarPage` reutiliza el mismo dominio y sólo solicita módulos/rangos
autorizados; `calendar-service.ts` valida descriptores, eventos y lookup.
El tipo no se inventa en React y el servidor entrega capacidades efectivas.

`CalendarDayPanel` presenta la jornada 07:00–22:00, eventos ya cargados y el horario
del borrador, excluyendo la propia identidad al editar y eventos cancelados.
No consulta disponibilidad externa, no reserva espacio ni cambia el evento al
arrastrar. El resumen/agenda se deriva del intervalo autorizado recibido y no
constituye un reporte histórico completo de toda la organización.

El formulario captura invitados y relaciones CRM; `selectionOptions` aporta las
etiquetas autorizadas de selecciones persistidas, sin añadirse al POST/PATCH.
Las relaciones restringidas se preservan omitiendo `links`, no enviando `[]`.
Las invitaciones de lectura pueden presentarse sin capacidad de modificar el
calendario origen. Todo ello conserva la distinción entre invitación CRM y acceso
al registro relacionado; no envía correo ni crea Teams/Outlook.

No hay ejecución nueva de BD ni aceptación externa en esta conciliación. El
resultado actual de checks está separado del QA histórico que figura abajo.

## Corte vigente — formulario ampliado 2026-10-29

El tipo aparece primero, es obligatorio y empieza sin selección. Le siguen el
nombre del evento, inicio/fin y día completo, invitados internos múltiples,
correos externos, preferencia Teams, lugar, referencia y descripción. Notas,
leads y órdenes de venta se seleccionan en «Relaciones» de la columna izquierda,
con identidad tipo/origen/ID. Invitados y Teams son únicamente datos CRM: no se
envían correos ni se crean reuniones externas.

`linksEditable=false` oculta los selectores de relaciones y muestra «Relaciones
restringidas; se conservan sin cambios». PATCH omite `links` para preservar
vínculos que el API no permite consultar. Crear o no recibir la bandera conserva
la selección normal. Las invitaciones autorizadas pueden abrirse sin membresía
en el origen mediante un descriptor de presentación sin permisos de escritura;
la vista de solo lectura oculta participantes y relaciones y no consulta lookups.

Las etiquetas y el texto secundario obtenidos por lookup se conservan en un mapa
en memoria del formulario, separado por clase de búsqueda y por origen/ID.
Cambiar o borrar la búsqueda, recibir cero resultados o un error no sustituye
los nombres seleccionados por IDs. Este mapa es solo presentación y desaparece
al desmontar el formulario: no autoriza recursos, no modifica identidades y no
se incluye en POST/PATCH. Al reabrir un evento, `selectionOptions` inicializa el mapa con nombres
autorizados por el API para el actor actual. Si no se reciben estos metadatos ni
resultados de búsqueda para una identidad, se conserva el ID sin inventar etiquetas.

El panel del día a la derecha (`CalendarDayPanel`) es trabajo concurrente
preexistente del usuario, conservado en esta ampliación; no se atribuye a esta
entrega. La sección vacía descrita abajo es un antecedente, no el diseño vigente.
El contrato API ampliado se documenta en [68 - Calendario, participantes y
vínculos](../../api/Arquitectura/68-Calendario-Participantes-y-Vinculos.md),
mantenido por el trabajo principal. Este corte frontend no certifica lecturas o escrituras reales.

## Antecedente de presentación — 2026-10-29 (histórico)

Presentación inicial: el panel de evento conserva el formulario actual a la izquierda y reserva una sección vacía a la derecha con el H1 «Detalle del evento». Ancho máximo960px, limitado al viewport; bajo720px las secciones se apilan. Esa sección no incorpora campos ni integraciones hasta definir sus requisitos. No cambia autorización ni persistencia.

Actualización29/10/2026: el API entrega Tarea, Reunión, Cita y Seguimiento, ordenados y coloreados desde el JSON global del API y registrados mediante054. Se conservan IDs persistidos por módulo; el frontend no mantiene otra lista ni inventa IDs. El selector usa los tipos autorizados y el evento usa su color por tipo. Disponibilidad por módulo no sustituye los permisos del perfil. Contrato: [catálogo API](../../api/Arquitectura/64-Calendario-Global-API-y-Contexto.md).

Alcance autorizado el 2026-10-28: calendario compartido de Formalización,
Mercadeo, Ventas y Contabilidad. `FormalizationCalendarPage` conserva la entrada
existente y delega en `SharedCalendarPage`. Las rutas son `/home/{formalization,
marketing,sales,accounting}/calendar` y cargan el calendario de forma diferida.

## Autorización y origen

Cada ruta y checkbox requiere allow y ausencia de deny para
`{moduleCode}.calendar.read`. No hay excepción visual por Owner. El catálogo de
`GET /calendar/calendars` se intersecta con estos permisos; sus tipos, colores,
`canCreate` y `canUpdate` provienen del servidor. Al cambiar el perfil se
descartan las capacidades anteriores y se solicita de nuevo el catálogo.

Solo el módulo actual está marcado inicialmente. Los otros calendarios son
overlays opcionales. El origen de un evento es inmutable y determina el
formulario, título del drawer y etiqueta de referencia. Un evento nativo de
otro módulo se consulta sin editar y ofrece «Ir a [origen]» cuando el calendario
permite actualizar. `event.canEdit` puede ser falso en el overlay; el origen
revalida el acceso al recurso sin prometer edición. El destino abre la misma fecha y evento si está
incluido en el intervalo autorizado. Legacy siempre es de solo lectura.

Los formularios soportados son `{moduleCode}.general.v1`; una clave desconocida
no habilita otro formulario. Crear usa un tipo del catálogo actual; editar
requiere además `event.canEdit`. La referencia opcional es texto, sin enlace ni
inferencia de autorización sobre otro registro. El estado recibido se muestra;
el contrato acordado no incluye acciones para completarlo o cancelarlo.

## Lecturas, fechas y comandos

`GET /calendar/events` recibe únicamente los módulos marcados y autorizados,
`contextModule` actual y el intervalo visible de FullCalendar. Cambiar vista,
mes o selección relee los eventos. Selección vacía no hace una petición de
eventos. Claves de solicitud y limpieza de efectos evitan mostrar respuestas
anteriores después de cambiar intervalo, permisos o módulos. Fallar una lectura
no conserva eventos anteriores ni inventa datos de respaldo.

FullCalendar React 7.1.3 usa las cuatro vistas instaladas y `temporal-polyfill`
para `America/Costa_Rica`. Los campos locales se convierten a ISOZ sin depender
del huso del dispositivo, conservando segundos y milisegundos en los campos
de fecha/hora (`step=0.001`). Día completo usa medianoche de Costa Rica
(`06:00:00Z`) y fin exclusivo. Arrastrar/redimensionar eventos está deshabilitado;
los cambios pasan por el formulario y servicio tipado.

POST conserva el módulo actual. PATCH conserva el origen, ID y `expectedVersion`
del evento abierto. Cada borrador mantiene un `operationId` UUID para reintentar
un resultado desconocido sin alterar el comando; mientras está incierto se
bloquean los campos. Conflictos o revocación bloquean el guardado y requieren
recargar. No hay confirmación optimista: tras una respuesta válida se cierra el
drawer y se relee el calendario.

## Verificación y límites

Pruebas bajo `test/calendar/` ejercitan FullCalendar real, sin sustituirlo:
vistas, intervalo visible, overlays, deny/revocación, respuestas tardías, origen,
creación, edición/versiones, reintentos, legacy, formularios desconocidos y
conversión de día completo. La API se sustituye en pruebas; no se crean eventos
en BD ni se verifica concurrencia MySQL. Las pruebas de navegación cubren las
cuatro rutas y el permiso independiente del calendario de Formalización.

Sin Graph, envío de correo, importación de eventos o integración Outlook. Los invitados de la ampliación se registran únicamente en CRM.
Referencia técnica: [zona horaria de FullCalendar](https://fullcalendar.io/docs/timeZone).

## Archivos de la entrega inicial (histórico)

Rutas relativas a `apps/frontend/`; se preservan los cambios ajenos existentes
en los archivos compartidos.

- `src/modules/calendar/calendar-config.ts`
- `src/modules/calendar/calendar-time.ts`
- `src/modules/calendar/CalendarEventDrawer.tsx`
- `src/modules/calendar/SharedCalendarPage.tsx`
- `src/modules/calendar/SharedCalendarPage.css`
- `src/modules/calendar/useCalendarData.ts`
- `src/modules/calendar/useCalendarEventForm.ts`
- `src/services/calendar/calendar-service.ts`
- `src/modules/home/FormalizationCalendarPage.tsx`
- `src/modules/home/GlobalHomeShell.tsx`
- `src/routes/app-routes.ts`
- `test/calendar/calendar-service.spec.ts`
- `test/calendar/shared-calendar.spec.tsx`
- `test/home/formalization-calendar.spec.tsx`
- `test/home/formalization-home.spec.ts`
- `test/home/navigation-permissions.spec.tsx`
- `Arquitectura/Calendario-Global-Frontend.md`


## Contrato del formulario ampliado — 2026-10-29

Tipo requerido sin selección inicial, nombre del evento, fechas, lugar, referencia,
invitados internos múltiples, correos externos y preferencia Teams. Solo CRM:
no envía correo, invitaciones ni crea reuniones externas.

POST/PATCH conservan el contrato anterior y agregan `participants: [{userId?: publicid,
email?: string}]` (una identidad por participante), `links: [{entityType:
'note'|'lead'|'sales_order', source:'native'|'legacy', id:string}]` y
`details.teamsRequested: boolean` junto a `details.reference`.
GET de eventos debe devolver las identidades persistidas para conservarlas al editar.

`GET /calendar/lookup?kind=users|notes|leads|orders&search=...&moduleCode=...`
devuelve `{items:[{id,source,label,secondary?}]}`; usuarios siempre native.
moduleCode es el origen del formulario. Solo se consulta con acceso de edición;
el servidor debe exigir permiso de lectura del calendario exacto, capacidad de
creación/actualización según corresponda y autorización específica del recurso.
Vincular no comparte ni concede permisos. Sin acceso de edición no hay lookups.

La identidad incluye tipo/origen/ID. Las etiquetas no se guardan en comandos.
Si una identidad persistida todavía no tiene etiqueta resuelta, se muestra su
ID y se conserva hasta que el usuario la retire. Una etiqueta ya resuelta se
conserva en memoria durante la sesión del formulario aunque cambie la búsqueda. La hidratación inicial usa `event.selectionOptions` cuando se recibe; la búsqueda
actual no garantiza devolver selecciones fuera de su página. No se infieren nombres.
Este contrato frontend no acredita soporte API ni persistencia real; no se
realizan escrituras de BD en esta entrega.


Las invitaciones devueltas por API pueden abrirse sin membresía ni descriptor
del módulo de origen. Se sintetiza únicamente un descriptor de presentación
sin tipos ni capacidades de escritura. La selección debe seguir perteneciendo
a la respuesta vigente: una recarga de autorización oculta selecciones obsoletas.
La vista de solo lectura omite participantes y relaciones, no solicita lookups
y muestra fechas, lugar y preferencia Teams. El API sigue siendo responsable de
redactar datos restringidos antes de enviarlos al navegador.


`CalendarEvent.linksEditable?: boolean` proviene de la autorización del API.
Al editar con `false` no se montan ni consultan los selectores de relaciones;
se muestra «Relaciones restringidas; se conservan sin cambios» y se OMITE `links`
del PATCH. No se envía una lista vacía que pudiera borrar vínculos ocultos.
En creación o sin la bandera se permite la selección normal. El API preserva
relaciones omitidas y sigue validando permisos de cada vínculo nuevo.


## Archivos de la ampliación frontend y verificación

- `src/modules/calendar/CalendarEventDrawer.tsx`: orden y presentación de campos,
  Relaciones, vista de solo lectura; conserva el panel del día preexistente.
- `src/modules/calendar/CalendarGuestFields.tsx`: invitados, preferencia Teams,
  lookups y conservación en memoria de etiquetas.
- `src/modules/calendar/useCalendarEventForm.ts`: validación, identidades,
  preferencia Teams y omisión de relaciones restringidas en PATCH.
- `src/modules/calendar/SharedCalendarPage.tsx`: presentación de invitaciones
  autorizadas sin descriptor de origen y descarte de selecciones obsoletas.
- `src/modules/calendar/useCalendarData.ts`: conserva invitaciones autorizadas
  devueltas por API aunque su origen no sea un overlay seleccionado.
- `src/services/calendar/calendar-service.ts`: contratos tipados y lookup con
  módulo de origen; decodificación de participantes, vínculos y linksEditable.
- `test/calendar/calendar-expanded-form.spec.tsx`: regresiones de identidades,
  etiquetas, correos, Teams y preservación de relaciones restringidas.
- `test/calendar/calendar-global-types.spec.tsx`: tipo requerido inicialmente vacío.
- `test/calendar/shared-calendar.spec.tsx`: campos ampliados e invitaciones de
  solo lectura sin membresía de origen.
- `Arquitectura/Calendario-Global-Frontend.md`: corte vigente e historial.

No se modifica README ni API, no se crean fixtures de BD y no se realizan commits.
La prueba de etiquetas reproduce primero la pérdida del nombre al cambiar la
búsqueda; después exige conservar nombre y texto secundario al cambiarla
y borrarla. Las pruebas sustituyen HTTP; no acreditan funcionamiento del API real.


### Etiquetas autorizadas de selecciones persistidas

El evento puede incluir `selectionOptions?: {users: CalendarLookupItem[],
notes: CalendarLookupItem[], leads: CalendarLookupItem[], orders: CalendarLookupItem[]}`.
El parser valida sus cuatro listas con el mismo lector de opciones del lookup;
los usuarios deben ser native. El hook entrega `initialSelectionOptions` y cada
selector inicia su mapa con la lista de su clase. Resultados de búsquedas
posteriores actualizan el mapa sin perder etiquetas previamente resueltas.
Los metadatos no seleccionan nuevas identidades, no conceden permisos y no se
serializan en POST/PATCH. Relaciones restringidas siguen sin selectores ni
consultas; el API omite sus opciones para ese actor. Sin metadatos opcionales se
mantiene compatibilidad con eventos anteriores.
La prueba de reapertura pasa una orden legacy por el parser real, verifica su
nombre y texto secundario sin mostrar el ID, cambia la búsqueda y confirma que
PATCH conserva solo la identidad de la relación, sin `selectionOptions`.

Los selectores muestran nombre y datos útiles, sin las etiquetas técnicas «Legacy» o «Nativo». El origen sigue formando parte de la identidad interna; el aviso de eventos que no se pueden editar dice «Evento de solo lectura».

### Cierre de participantes y vínculos (29/10/2026)

Los campos nuevos se agrupan en invitados y relaciones, con resultados de altura acotada. Enter en los cuatro buscadores y en correos externos no envía el formulario. Verificados 38 tests de calendario, ESLint y formato del alcance; en navegador, las cuatro búsquedas respondieron 200 y mostraron identidades nativas y legacy. No se guardaron eventos ficticios. La última ejecución de `pnpm build` aprobó TypeScript y Vite, con una advertencia de tamaño del chunk compartido de Ant Design. Evidencia y límites del API: `apps/api/Arquitectura/68-Calendario-Participantes-y-Vinculos.md`.

## Ampliación aprobada — 02/11/2026

Formulario guiado: seleccionar Tipo habilita campos y Guardar; cambiarlo conserva datos. Referencia interna es texto libre. Se separan colaboradores e invitados externos. Órdenes se filtran por los leads seleccionados con identidad de origen; elegir una orden agrega su lead autorizado. Retirar un lead confirma la retirada de sus órdenes. Notas propias/compartidas accesibles sin requisito de asignación.

El servicio BFF conecta `/calendar/availability` y `/calendar/rooms`. Panel diario de00:00 a24:00 con agenda Outlook, conflictos no bloqueantes y sugerencias seleccionables. Disponibilidad desconocida o parcial nunca se presenta como libre. Sala opcional junto a ubicación libre. Publicación externa automática sin checkbox; Teams requiere Microsoft y esa publicación. Resultado separado de CRM, enlace Teams y respuesta de la sala, conservando ID y operación ante fallos. Botón Conectar Microsoft reutiliza el popup del BFF; si cambia de usuario, recarga la aplicación para descartar el contexto anterior.

Sin Microsoft o consentimiento: crear solo en CRM permanece disponible. No hay tokens en React ni llamadas directas a Graph. El contrato y los límites de consentimiento, ETag, reintentos y reserva están en API [64](../../api/Arquitectura/64-Calendario-Global-API-y-Contexto.md). El código local y las pruebas con dobles no certifican una reserva, envío de invitaciones o despliegue.

## Participación y autoría — 2026-11-03

Teams tiene un interruptor visible junto a los datos principales. Participantes permite colaboradores por selección o listas exactas separadas por coma y correos externos separados por coma; los correos válidos de leads vinculados se incorporan y validan en servidor. Con sesión Microsoft se publican invitaciones Outlook; con sesión local se conserva el evento CRM.

La campana integra avisos del calendario incluso sin permisos de notas. Consulta al abrir, cada30 segundos y al recuperar foco, independientemente del socket de notas. El aviso abre el detalle existente por `?date=…&event=…`; la lectura es independiente de RSVP. El destinatario no recibe permisos sobre los registros vinculados.

Solo el organizador puede editar. El detalle Outlook muestra asistentes, respuestas y Teams; terceros quedan en consulta. Los eventos propios exclusivos de Outlook permiten editar título, lugar y horario con versión observada. Los de día completo conservan fechas originales y permiten título/lugar. El servidor revalida `isOrganizer` y ETag. La edición básica conserva asistentes, contenido Teams y recurrencia.

El selector de relaciones muestra leads autorizados al abrirse y, al escoger uno, carga sus órdenes sin otra búsqueda. Selecciona automáticamente solo si la consulta completa de ese lead devuelve exactamente una orden; con varias, exige elección manual. Filtrar varias órdenes a una coincidencia no provoca selección. Cambiar el lead de un Adéndum retira la orden anterior; una respuesta tardía no sustituye la elección actual.

## Detalle unificado — 2026-11-03

`OutlookEventDrawer` incorpora `CalendarCrmDetails`: tipo con su color, módulo, estado, referencia, campos guardados en CRM, participantes y vínculos legibles a lead/orden/nota. El snapshot CRM permanece independiente de la descripción/horario/lugar de Outlook. Las relaciones se cargan con `GET /calendar/events/:id/detail` al abrir el modal, no para todo el feed; el skeleton y la clave id/versión impiden mostrar datos de otra selección. Los vínculos restringidos se indican sin revelar su identidad. Sin correspondencia CRM se informa expresamente; no se fabrican relaciones. Un evento nativo sincronizado se abre primero en detalle; «Editar evento CRM» conserva el formulario, permisos y versiones existentes para su organizador.

Corrección verificada en Habita (03/11/2026): las listas de `selectionOptions` son parciales; una lista omitida se lee vacía y una lista presente malformada se rechaza. Esto permite confirmar guardados y listar eventos propios sin participantes ni vínculos, evitando el falso aviso de guardado incierto después de un POST200. Prueba real: creación y edición sincronizadas con Outlook, un único registro CRM, auditoría versiones1/2 y detalle combinado con Teams.

Confirmación de guardado (03/11/2026): una entrega `synced` muestra una tarjeta dedicada con resumen del evento y acciones `Volver al calendario`/`Abrir Teams`; el formulario se conserva oculto y bloqueado. El anuncio de estado y el encabezado mantienen roles distintos, y los iconos decorativos no alteran el nombre accesible de las acciones. En móvil se apilan los botones. Estados inciertos y avisos de sala conservan su comportamiento.

Colores de calendario (03/11/2026): cada evento conserva dos señales independientes. La franja izquierda indica el módulo; la derecha y el fondo suave indican el tipo. El mismo código de tipo utiliza el mismo color entre módulos, según el catálogo autorizado. `calendarEventColors` centraliza esta resolución para agenda principal, próximos eventos y panel diario. Sin registro CRM, un evento de Outlook conserva su color de proveedor y no adquiere un módulo/tipo inventado. La leyenda y el título emergente explican las señales sin depender solo del color.

## Acceso rápido de Mercadeo en cabecera — 2026-11-03

La barra superior incorpora «Nuevo evento de Mercadeo» con icono de calendario. Reutiliza `FormalizationCalendarQuickCreate` para los workspaces formalization/marketing, `CALENDAR_CONTEXT` y `CalendarEventDrawer`; selecciona el descriptor mercadeo, nunca el de Formalización. Abre un evento vacío sin relaciones heredadas del URL; guardar/cerrar conserva la pantalla actual. Exige lectura efectiva del calendario (deny prevalece), descriptor con canCreate y tipo compatible; no agrega permisos, migraciones ni acceso para otros módulos. El componente se remonta al cambiar módulo/permisos para cerrar borradores y descartar respuestas tardías. Suite focal:13 casos aprobados, incluidos apertura/guardar/cerrar sin navegación, falta de permiso, deny y descriptor sin creación.

Verificación de esta ampliación:13/13 pruebas, ESLint focal, typecheck y build aprobados (solo advertencia de tamaño de chunks). Navegador: icono visible en Captación de leads, abre «Nuevo evento de Mercadeo» con origen Mercadeo y relaciones vacías; al cerrar conserva `/home/marketing/leads`. No se guardaron eventos reales ni se enviaron invitaciones durante la verificación.

## Extensión a los cuatro módulos con calendario — 2026-11-03

El acceso rápido de cabecera contempla Formalización, Mercadeo, Ventas y Contabilidad. Sustituye la restricción anterior a dos workspaces; Administración y Todos no disponen de calendario propio en el contrato vigente y no reciben un origen inventado. Cada botón utiliza el descriptor/tipos/permisos de su módulo.16 pruebas aprobadas: incluye los cuatro orígenes, deny, capacidades y retorno Mercadeo→Formalización cerrando el borrador. Navegador: comprobada apertura vacía de Formalización, Ventas y Contabilidad; Mercadeo verificado en el corte anterior. La ausencia capturada en Formalización no se reprodujo con la sesión actual: el botón y su formulario funcionaron. No se atribuye a permisos o caché sin evidencia ni se escribieron eventos reales.
