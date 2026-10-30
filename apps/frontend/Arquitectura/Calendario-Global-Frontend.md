# Calendario global por módulo

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
