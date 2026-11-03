# 53 - Captacion de leads: reporte federado de solo lectura

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
