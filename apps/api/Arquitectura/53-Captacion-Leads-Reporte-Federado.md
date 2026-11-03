# 53 - Captacion de leads: reporte federado de solo lectura

## Motivos de pérdida — 03/11/2026

La opción **Qué medir → Motivos de pérdida** reutiliza el mismo GET y las cohortes autorizadas. Cada fila agrega `lossReasons: [{code,name,count}]`; su suma es exactamente `lost`. No se crea otro reporte ni se importan datos. La cohorte sigue siendo leads captados en el período y actualmente perdidos, no transiciones ocurridas durante ese período.

- Nativo: último evento de `audit_lead_status_event` hacia `lost`, ordenado por secuencia e ID, para un lead actualmente perdido. Etiqueta histórica del evento y, si falta, catálogo `conf_action_reason`. Si no hay código/etiqueta fiable, queda sin motivo.
- Legacy: `leads.id_Caida → caidas.id_caida`. El flujo antiguo solicita opciones de pérdida con parámetro3; la pérdida automática guarda el motivo66. Se aceptan motivos manuales `estado_caida=3/segui=0` y referencias históricas/automáticas confirmadas10,19,20,60,61,65,66,68. No se interpreta un evento/nota genérico como causa. Si la referencia fue reemplazada por una actividad o no resuelve, se conserva el conteo en **Sin motivo registrado**, sin inferirlo desde texto libre de bitácoras.
- Las equivalencias ya revisadas en `HISTORY_REASONS` (por ejemplo19/25→`no_answer`,21→`budget`) reutilizan códigos canónicos; los demás motivos legacy conservan identidad `legacy:<id>`. No se unen motivos por semejanza del nombre.
- Nativo prevalece en coincidencias inequívocas; pérdida/motivo se cuentan una sola vez. Se mantienen permisos, alcances y deny antes de leer fuentes.
- Gráfico, tabla y exportación usan los proyectos seleccionados. El gráfico muestra cantidad o porcentaje del total de perdidos; el KPI general sigue indicando perdidos sobre todos los leads captados. «Contexto del desglose» conserva tablas por proyecto/campaña/anuncio para seleccionar proyectos.
- Compatibilidad: el parser permite un API anterior sin `lossReasons` y presenta sus pérdidas como no documentadas; un detalle presente debe tener códigos únicos, conteos positivos y reconciliar exactamente con `lost` o se rechaza el reporte.

Verificación local:56 pruebas API y54 frontend focalizadas; lectura conjunta readonly ejecutada con0 leads nativos y57.904 legacy (52.476 perdidos,50.480 con clasificación válida en ese corte). La BD nativa sí tiene las tablas, pero no registra leads/motivos todavía: comportamiento de datos nativos cubierto por pruebas, sin afirmar aceptación con registros nativos reales. Sin migraciones, actualizaciones de datos ni despliegue por esta tarea.


## Alcance de vendedores vigente - revisión 2026-11-02

El contrato API y las cohortes no cambian. La capacidad opcional
`mercadeo.reports.read_all` permite consultar todos los vendedores, siempre junto
con `mercadeo.leads.read`. Su deny no anula una lectura ya autorizada: conserva
el filtro ordinario; un deny de `mercadeo.leads.read` sí bloquea el reporte.
Se evalúa antes de consultar fuentes y no concede lectura individual de leads
o acceso a órdenes/notas. Definición056 y asignaciones históricas independientes
en [69](69-Mercadeo-Lectura-Global.md). No se importan registros ni se concede
el permiso a todo un rol al actualizar este documento.

## Estado actual y precedencia - 2026-10-27

El contrato API sigue siendo `period=day|week|month|all`. La UI actual ofrece
Hoy/Semana/Mes/Trimestre/Ano: `capture-period.ts` solicita `all` para trimestre y
ano y recorta localmente desde el inicio del trimestre/ano hasta `report.today`,
sin cambiar las consultas del servidor. Ya usa `CaptureLoading`, no `Skeleton`.
El grafico actual es apilado por vendedor con limite inicial de 15 grupos;
KPIs, modal de tablas y proyecto se documentan en el
[estado frontend](../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md).
Las secciones de entrega y diagnostico del2026-10-26 son historicas y no
describen por si solas el JSX actual ni constituyen pruebas nuevas.
La ampliacion posterior038 retira solo Eventos y citas/permiso; no cambia el
contrato, Calendario o el calculo de citas. No hay importaciones comerciales.

## Alcance autorizado - 2026-10-26

Conectar `/home/marketing/leads` a una respuesta de API que consulta primero
`CRM_THINK_V2` y despues el adaptador opcional `crmdatabase-api`. Prohibido copiar
leads, citas, historiales o catalogos de una BD a otra. No migraciones, comandos
comerciales, cambios de permisos, credenciales, integraciones, commit o despliegue.
La vista conserva las medidas actuales: leads creados, leads con cita y leads
actualmente perdidos; proyectos/campanas/anuncios y vendedor son dimensiones.

Contrato de trabajo: `GET /marketing/leads/report?period=day|week|month|all`.
Permiso servidor: `mercadeo.leads.read`, con deny y alcance existentes antes de
consultar fuentes. El JSON contiene rango/cobertura en Costa Rica, conteos diarios
por vendedor/proyecto/campana/anuncio, directorios con IDs estables y `publicId`
nativo para fotos, ademas de origen y calidad. No contactos ni filas individuales
de leads. No alterar el endpoint de Inicio ni convertir su permiso en requisito
para Captacion.

## Predicados y atribucion

- Volumen: todos los leads creados en el periodo, incluidos inactivos/perdidos.
- La fecha del reporte es la creacion del lead, no la fecha de su cita.
- Cita: evento tipificado como Cita/appointment y vinculado al lead. Autor,
  organizador, asistentes y copias no cambian su propietario ni multiplican conteos.
- Cada lead ocupa una sola categoria: completada si existe evidencia completada;
  en otro caso programada si existe pendiente; en otro caso sin cita vigente.
  Cancelada sola no califica. No equivale a cantidad de eventos ni asistencia.
- Legacy: `calendars.id_lead -> leads.idinterno_lead`, no PK `leads.id_lead`.
- Campana legacy: `idcampana_lead -> campanas.id_NetsauiteCampana`, no PK del catalogo.
- Anuncio: texto de `ad_name_lead` o `custentityaccion_campana`. Blancos y literales
  undefined/null/none no son anuncios. Claves con contexto/origen evitan fusionar
  por nombre anuncios sin identidad comun fiable.
- Identidad nativa primero; referencias proveedor+ID, luego correo exacto unico
  para vendedores cuando corresponde. Ambiguedad conserva identidad legacy,
  nunca reasigna arbitrariamente ni inventa una foto. No deduplicar leads por
  correo, telefono o nombre del cliente.
- Todo empieza en el primer lead autorizado, no en una fecha fija de demo.
- Un fallo de fuente habilitada debe producir error controlado, no ceros ni demo.

## Evidencia inicial en vivo

Consulta SELECT-only, 2026-10-26T17:39:58Z: nativo mes=0; legacy octubre 1-26:
1160 leads, 438 perdidos, 22 con cita completada, 3 programada, 1135 sin cita vigente.
Global legacy: 57607 leads, 52258 perdidos, 638 completados, 5 programados y
56964 sin cita vigente. Son snapshots que pueden cambiar por operaciones ajenas.
Los 838 eventos legacy Cita se enlazaban por idinterno, ninguno por PK. Los cuatro
archivos locales de fotos coincidian con publicId nativos. Native crm_lead,
crm_campaign, eventos, detalles y catalogo de tipos/estados estaban vacios;
sec_user tenia 46 registros. Esta lectura no acredita flujos de escritura nativos.

Consultas de conciliacion: [SQL de solo lectura](SQL/marketing-capture-read-checks.sql).
La primera consulta exploratoria de campanas con subconsultas correlacionadas
agoto 5s; se reemplazo por agrupaciones y joins. No se alteraron indices legacy.

## Entrega y verificacion historica - 2026-10-26

Implementado `GET /marketing/leads/report` en el modulo Marketing existente,
con controller/service/contract/model/identities/repository y puerto legacy propios
`marketing-leads-report.*`, mas `legacy-marketing-leads-report.reader.ts`.
Se reutilizan readSnapshot, visibleSellers, apiRequest, identidad y protecciones
existentes; Inicio conserva su servicio, permiso y contrato. Las paginas internas
de lectura se consumen completas, sin recortar silenciosamente los resultados.

Frontend: `lead-report-service.ts`, `useCaptureReport.ts`, directorios inyectados
inmutables en `lead-capture-report.ts`, controles/tabla/grafico/secciones actualizados.
Las fixtures se movieron a test; ningun catalogo global mutable ni muestra de respaldo
alimenta la vista. Los colores dependen del ID, no del orden de los elegidos. Los IDs
con caracteres como `|` se agrupan por tuplas JSON sin romper nombres o cifras.
La identidad y permissionVersion invalidan peticiones/resultados y seleccion local.

Resultados de ejecucion:
- API: 5651 pruebas aprobadas, 119 omitidas por sus gates; 127 suites aprobadas y
  23 omitidas. Lint y build aprobados. Verificacion opt-in MySQL de solo lectura
  aprobada, incluyendo conciliacion independiente de mes e historial completo
  dentro del mismo snapshot. No se activaron pruebas de escritura sobre datos reales.
- Frontend: 45 pruebas focalizadas de Captacion aprobadas. Suite completa tuvo
  776 aprobadas y 72 omitidas por timeout del beforeAll que precarga RolesSecurityPage;
  esas 72 pasaron al repetir App.spec aislado con --hookTimeout=60000. No se cambio
  el timeout del archivo ni se declara limpio el comando original. Typecheck, lint,
  formato y build aprobados; persiste aviso de bundle vendor mayor de 500kB.
- Typecheck global API: bloqueado por `test/sales-orders/follow-up.spec.ts:69`,
  fixture sin clientEmail. El archivo esta fuera de los cambios de Captacion;
  no se establece con esta evidencia un baseline previo al trabajo. El build
  productivo de API, que excluye esos tests, pasa.
- Revision independiente: API14/14 y frontend26/26 focalizadas aprobadas. Se
  corrigieron claves con separadores en anuncios y ampliacion silenciosa de
  vendedor a todos al cambiar a un periodo sin resultados. Sin P1/P2 restantes
  en el alcance revisado; no es certificacion de todo el CRM.

Prueba en navegador REAL autenticado: HTTP200; octubre 1161 leads, 25 leads con
cita (22 completadas + 3 programadas), 1136 sin cita vigente. Cambiar de Proyecto
a Proyecto/Campana/Anuncio conserva 25; Todo muestra 643 leads con cita y 518
combinaciones, manteniendo vendedores separados. El cambio de periodo mostro
la carga y retiro cifras anteriores. Se observaron 12 instancias de fotos sin
imagenes rotas. La consulta anonima responde401. No se imprimieron cookies.
Lighthouse reporto ausencia del fallo de contraste local tras corregir placeholder;
quedan dos avisos de nombres accesibles en GlobalHomeShell, fuera de esta entrega.
La puntuacion automatica no constituye conformidad WCAG completa.

Snapshot SQL/JSON guardado el 2026-10-26T17:55:42.927Z: Todo 57608 leads,
56965 sin cita vigente, 5 programados, 638 completados; mes 1161/1136/3/22.
Los perdidos cambiaron durante la verificacion por operaciones ajenas; no congelar
esas cifras en la interfaz. Calidad Todo: 1122 leads sin vendedor resuelto,
672 sin campana resuelta y 6 referencias incompletas/ambiguas; mes3 referencias.
La consulta posterior 2026-10-26T18:00:04.798Z seguia con crm_lead=0,
crm_campaign=0 y crm_calendar_event=0 nativos: no se importaron datos de legacy.

Performance observada con JSON Todo: 28220 filas agregadas, 18 vendedores y
518 rutas hasta anuncio. Validacion frontend125ms; procesamiento puro de reporte
67-113ms segun profundidad. Esto no mide red ni tiempo total de pintura/exportacion.

Sin migraciones, imports, cambios de credenciales/configuracion, commits, push o
despliegue. Las reglas de citas son cohortes por creacion del lead; no representan
asistencia ni cantidad de eventos. Nativo estaba vacio, por lo que escenarios
positivos nativos se verifican con pruebas de codigo, no insertando fixtures reales.

### Carga de Skeleton en desarrollo - 2026-10-26

Ante un fallo intermitente `Invalid hook call` en Skeleton, se verificaron versiones
coincidentes de React/React DOM 19.3.0 y llamadas de hooks dentro de componentes.
El fallo original no se reprodujo en una apertura nueva. Vite ahora deduplica
React/React DOM y preoptimiza `antd/es/skeleton` desde el arranque para mantener
el loader de la ruta lazy dentro del mismo grafo inicial de dependencias.
La prueba real con respuesta demorada mostro Skeleton sin error de hooks ni
RouteErrorBoundary. Pasaron las 45 pruebas de Captacion y el build/typecheck.
Esto verifica la carga actual; no demuestra retrospectivamente la causa exacta
de la sesion que fallo. API y consultas de BD no cambian.

### Retiro de Eventos y citas - 2026-10-26

Por solicitud del propietario se retira ese menu y el permiso
`mercadeo.appointments.read`. Migracion 038 elimina sus relaciones rol-permiso,
excepciones por usuario y definicion; incrementa versiones de permisos para
refrescar sesiones. La migracion historica 028 se conserva: una instalacion
nueva aplica 038 despues de ella. No se eliminan auditorias historicas,
Calendario, eventos, leads ni metricas de citas. Verificacion real posterior:
0 permisos, 0 relaciones y 0 excepciones del permiso retirado; 038 registrada.


## Contrato serializado y revision documental - 2026-10-27

Fuente ejecutable: `src/modules/crm/marketing/marketing-leads-report.contract.ts`
y `marketing-leads-report.service.ts`. Query estricta: solo `period`, con default
`month`; valores `day|week|month|all`. `today` y limites se calculan en servidor,
no desde fechas de prueba del frontend.

| Campo JSON | Contenido |
| --- | --- |
| `schemaVersion`, `observedAt`, `today`, `timeZone`, `period` | Version1, instante de observacion, dia Costa Rica, zona America/Costa_Rica y periodo elegido |
| `range`, `coverage` | `{start,end}` del rango y cobertura autorizada |
| `rows` | Agregados por `date,sellerId,projectId,campaignId,adId` con `leads,noAppointment,scheduled,completed,lost` |
| `sellers` | `{id,name,publicId}`; publicId nativo o null, nunca un ID ERP supuesto |
| `projects`, `campaigns`, `ads` | Catalogos `{id,name}` de la respuesta autorizada |
| `sources` | `native,legacy,duplicatesExcluded,legacyEnabled` |
| `quality` | `unresolvedSellers,unresolvedCampaigns,ambiguousLeadReferences,unclassifiedAppointments,invalidDates` |

`noAppointment + scheduled + completed = leads` por fila. `lost` es un estado
actual del mismo conjunto y puede coincidir con cualquiera de las tres categorias;
no debe sumarse como una cuarta categoria excluyente. Es una cohorte por creacion,
no la cantidad de perdidas o citas ocurridas durante el periodo.
El servicio valida identidad/deny/alcance/query antes de leer fuentes. Ante fallo
de una fuente habilitada responde 503 sanitizado; no entrega JSON parcial ni demo.
No se proporciona listado de clientes, email, telefono o nombres individuales.

Los resultados de pruebas/BD/navegador anteriores conservan fecha de entrega y no
se reejecutan durante esta revision documental. El typecheck bloqueado de aquel
corte no implica que continue bloqueado hoy. El gate nuevo se registra en49/55;
no sustituir sus resultados por los snapshots anteriores.


## Rango personalizado y comparación temporal — 03/11/2026

El API conserva `period=day|week|month|all`, con las mismas fuentes, autoridad y permisos. El frontend usa `all` al aplicar Desde/Hasta o seleccionar períodos históricos concretos, y filtra días de creación inclusivos; no manda parámetros arbitrarios al servidor. Las fechas en edición no sustituyen las aplicadas. La barra usa un único selector Período para rango y agrupación (día/semana/mes/trimestre/año); se eliminó el selector independiente de agrupación. Personalizado decide automáticamente la escala según la amplitud y mantiene Aplicar filtro. Mes, Semana, Trimestre y Año muestran un selector múltiple de períodos calendario basado en coverage; no se incluyen los huecos entre períodos seleccionados. Los filtros de cohorte, el gráfico por proyecto y las exportaciones usan esa misma selección. Esto no altera las métricas de citas o pérdida. Semanas de lunes a domingo, extremos parciales recortados al rango, color estable por dimensión e intervalos vacíos en cero; motivos de pérdida se distribuyen por intervalo con el mismo criterio de cohorte existente. Sin DDL, mutaciones ni cambios del contrato de consulta. Verificación y estado productivo deben distinguirse del corte local.

La selección múltiple de meses, semanas, trimestres y años permanece en edición hasta pulsar **Aplicar filtro**. Cambiar o retirar opciones no ejecuta consultas ni modifica las cifras aplicadas. El botón exige al menos un período. Cambiar el tipo de período reinicia la selección en edición; el rango personalizado conserva su propio envío explícito.

El tipo de Período también queda en edición: Hoy/Semana/Mes/Trimestre/Año/Personalizado no consulta ni cambia el rango, agrupación o gráfico aplicados al cambiar el desplegable. Solo Aplicar filtro confirma el tipo junto con sus intervalos.

La comparación temporal se presenta primero por proyecto (o dimensión elegida) y luego por período. El gráfico reúne sus barras en un bloque compacto con escala común; el desglose usa una matriz con una fila por dimensión, períodos como columnas, total por fila y totales por período. Se conserva la cohorte, los ceros y los porcentajes originales.
