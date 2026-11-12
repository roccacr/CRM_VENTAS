## Alcance de vendedores vigente - revisión 2026-11-02

Inicio conserva `GET /marketing/home/summary`, periodo day/week/month/year y
`mercadeo.home.read`. Con la capacidad adicional `mercadeo.reports.read_all`
consulta todos los vendedores; sin ella o con deny de esa capacidad mantiene
el alcance ordinario. Un deny de la vista continúa bloqueando el reporte. La
capacidad no cambia permisos comerciales ni modifica leads. Definición056 y
evidencia de asignaciones puntuales: [69](69-Mercadeo-Lectura-Global.md).

> Actualizacion autorizada 2026-10-23: la ampliacion de citas descrita en

## Dos lecturas distintas de Mercadeo - 2026-10-27

Este documento gobierna Inicio, `GET /marketing/home/summary`, con
`mercadeo.home.read` y periodos day/week/month/year. Captacion usa otro permiso,
`mercadeo.leads.read`, endpoint `/marketing/leads/report` y periodos
 day/week/month/all: ver [53](53-Captacion-Leads-Reporte-Federado.md). No reutilizar
el periodo all como year ni intercambiar sus JSON. Ambos son lecturas federadas
native-first, sin importar registros. El retiro de Eventos y citas por038 no
retira Calendario ni calculos de citas.
Snapshots/benchmarks y pruebas de este registro conservan su fecha; la revision
documental actual no vuelve a consultar las bases.
> [48-Mercadeo-Metricas-Citas.md](48-Mercadeo-Metricas-Citas.md) sustituye
> las limitaciones de citas pendientes de este registro historico. Se conservan
> el endpoint, permisos y lectura sin importar datos.

# 46 - Inicio de Mercadeo: lectura unificada de leads

## Alcance autorizado 2026-10-23

Conectar Inicio de Mercadeo: consultar primero CRM_THINK_V2.crm_lead y despues
crmdatabase-api.leads, generar un JSON de agregados sin copiar ni modificar filas.
El propietario confirma contar TODOS los creados en el periodo, sin filtrar por
estado actual. La exclusion inicial de citas fue sustituida por la ampliacion
de 48: el runtime actual lee calendars mediante el adapter legacy y las tablas
nativas de 034 para agregados de citas. No migraciones, importaciones, grants ni ERP.

## Contrato y fechas

GET /marketing/home/summary?period=day|week|month|year (month por defecto).
Permiso efectivo mercadeo.home.read, deny prevalece, comprobado antes de las BD.
Respuesta schemaVersion=1: observedAt, today, period, timeZone America/Costa_Rica,
coverage, rows diarios con date/sellerId/projectId/leads, sellers (id/publicId/name),
projects (id/publicId/name), counts del periodo y sources con precedencia/exclusiones.
Incluye appointments: disponibilidad, eventos unicos con fecha/estado/asistencia,
pares vendedor/proyecto, cohortes leadsWithAppointment y calidad de datos.
No correos, telefonos, notas ni filas individuales de leads en el JSON.

Hoy es el dia local completo; semana inicia lunes; mes y ano empiezan el dia 1.
Todos terminan en el dia local observado. Comparaciones usan los mismos dias
transcurridos del periodo previo y se ajustan a meses cortos. Un mes completo
compara el mes previo completo; ano compara las mismas fechas de calendario,
ajustando el 29 de febrero. La cobertura de
consulta incluye el ano actual para horizontes y el tramo comparativo requerido.
DATETIME nativo representa UTC; TIMESTAMP legacy se filtra con epoch y se agrupa
con UTC-6 para no depender de la zona de la sesion MySQL. Lectura REPEATABLE READ,
READ ONLY, consistente entre los dos esquemas de la misma instancia.

## Identidades y prioridad

Responsable nativo: owner_user_id_lead -> sec_user.id_user; UI usa public_id_user.
Responsable viejo: id_empleado_lead -> admins.idnetsuite_admin (FK real verificada).
Resolver por sistema+referencia externa activa; si falta, usar solo correo
normalizado exacto e inequivoco de admins y sec_user (sin escrituras). Una relacion
ambigua no se inventa. Mantener vendedor legado separado si no hay usuario nativo.
Proyectos legacy idproyecto_lead corresponde al ID de proveedor, no al PK viejo;
resolver por referencia configurada, conservar clave de origen si no hay nativa.

Un alias nativo de proveedor conocido excluye la coincidencia vieja si la referencia
vieja identifica exactamente un lead. No deduplicar por nombre/correo del cliente.
Referencias repetidas no se eliminan adivinando: conservarlas y reportar ambiguedad.
Con fallback deshabilitado, lectura solo nativa. Si el fallback esta habilitado y
falla, responder error; nunca convertir fallo en ceros ni datos ficticios.

## Frontend

Reutilizar cliente BFF y componentes/calculos actuales. Una sola peticion por
periodo; filtros por IDs estables en los agregados recibidos. Ignorar respuestas
obsoletas al cambiar periodo, usuario o desmontar. Estados de carga/error/reintento
sin mostrar datos anteriores como actuales. Los indicadores de citas y tasas del
ranking usan appointments cuando available=true; si no, conservan placeholders.
Citas realizadas cuenta eventos completed, no asistencia confirmada.
Fotos public/vendedores/<publicId> con
extensiones presentes; si no existe o falla usar ilustracion original.

## Plan inicial y verificacion historica - 2026-10-23

Cambiar: modulo marketing nuevo, adapter legacy y registro global, app.module,
servicio/hook frontend y dashboard/paneles/fotos. Reutilizar transaccion read-only,
IdentityService, descriptores de permiso, cliente apiRequest y agregaciones visuales.
Pruebas: fechas Costa Rica/lunes/mes corto/ano; precedencia y referencias ambiguas;
correo exacto sin mezcla de collations; permisos antes de consultar; fallo legacy;
respuesta sin PII; carga/cambio de periodo/error/fotos y citas pendientes.
Verificar SQL real con SELECT/EXPLAIN y conteos directos, sin fixtures compartidos.
Ejecutar lint, tipos, pruebas relevantes y build. Revisar diff y limites reales.


## Scope and historical live evidence - 2026-10-23

`all_areas` permits the whole summary. `self`/`assigned` restrict both sources,
metadata and counters to the current native seller. `own_area` uses active native
organizational memberships; `own_area_and_children` includes only their active
subtree. Unresolved old sellers remain visible only to global scope. No permission
or membership is modified. Exact normalized email equality is binary in legacy SQL
and string equality in the canonical mapper, independently of source collations.

Read-only MySQL check, 2026-10-23 Costa Rica: day 20 (comparison 64), week 243
(125), month 1062 (2568), year 19862 (13882). Native contribution 0; all old-source
counts matched direct COUNT queries, including inactive/lost records. No rows copied.
EXPLAIN shows legacy created date has no index: full scan about 55k estimated rows;
combined snapshot plus verification measured 1.5-2.4 seconds. No index/schema change
was performed. Statement timeouts and aggregate limits reject excessive reports.
Native creation counts and cross-source exclusions are covered by unit tests; the
shared database had no native leads at that check, so populated-native SQL evidence is
not claimed. SQL ran through actual repositories, not a mock connection.

Browser checked with the existing local session: 1062 monthly leads; seller Marlon
313 with original illustration, seller Dayan 306 with matching public-ID photo.
Project breakdowns and chart followed the filter; all appointment counters stayed
pending. No login, permission or data changes were performed for verification.


## Historical verification result - 2026-10-23, before appointment extension

API: global format/lint/typecheck/build passed; full suite 5439 passed, 118 skipped
(opt-in integration suites, not executed as persistence proof). Subsequent focused
Marketing tests: 21 passed including the additional April boundary regression.
Frontend: global lint and typecheck/build passed. Marketing focused tests: 49 passed
(39 existing pure-view cases plus 10 connection/parser/photo/scope/calendar cases).
Full frontend run: 693 passed, one failure in SystemUsersPage detail navigation
following table sort, outside Marketing; that exact test passed when rerun in
isolation (one passed, 42 not selected). The full run is therefore not reported
as fully passing. Global frontend formatting reports five
other files: CatalogItemsPage.tsx, EnterpriseSurface.css, SystemUsersPage.tsx,
MarketingHomeSections.tsx, MarketingPeriodPicker.tsx. No unrelated formatting repair.
Vite build retains the existing large vendor chunk warning. No deployment or commit.

A new response reconciles absent seller/project filters, and a different signed-in
user resets them. Loading retains the visible selection but hides old counters;
failed or stale requests cannot publish a current zero or another period's data.


## Project comparison copy - 2026-10-23

Project cards now explain each change with more/less wording, the comparison
period name, both actual date ranges and both lead counts. Colors and the existing
0.5-percent neutral threshold are unchanged. A zero previous count explicitly says
there were no previous leads, rather than implying an infinite percentage or a new
project. Seller filters continue to apply to both quantities. No API/SQL changes.


## Loading feedback - 2026-10-23

Marketing Home displays the existing Ant Design spinner during initial API load,
period requests, retries and local seller/project transitions. It clears on success
or error and exposes aria-busy/status without preventing a newer selection. Local
filters remain local; no artificial waits, extra requests or appointment changes.
Memoized date views, project cards, seller groups and chart buckets avoid repeating
expensive aggregations solely to render the urgent pending indicator. The existing
stale-response protections and pending counters are preserved.


## Multiple sellers and projects - 2026-10-23

Home seller/project controls use the existing searchable multiple Select with
removable tags and clear-all. Empty selection means all. Sellers combine with OR;
projects combine with OR; the two dimensions intersect. Project options are the
union observed for the selected sellers in the returned coverage, without duplicate
options for shared projects. Removing a seller retains selected projects only if
still present for remaining sellers. A new available response reconciles both lists;
changing user resets them. Internal legacy single-filter callers remain supported.

All totals, comparison periods, chart rows and per-project horizons use the same
multi-selection. Ranking clicks toggle individual sellers instead of replacing the
whole selection, with separate seller counts and selected states kept visible.
Each selected seller displays its own public-ID photo and name; the team artwork
is used when no seller is selected. Missing or broken individual photos retain the
existing fallback without hiding the other selected sellers.
No API, SQL, permissions, database changes, appointment metrics or extra requests.


Multiple-selection verification: 59 focused Marketing tests passed, including
shared-project counts, dependent project pruning, seller ranking toggles and the
existing period/preload/photo/error tests. Global lint, TypeScript and build passed.
Browser: Dayan + Marlon = 619 monthly leads; DOSO + BC Lofts limits that combination
to 420 (374 + 46), with both seller and project tags visible. Rapid consecutive
selections were checked: controls update urgently while only report calculations
use deferred values, preventing stale controlled Select values from losing clicks.

Related Home/application navigation suite: 21 files, 389 tests passed.

## Reconciliacion documental - 2026-10-23

Los resultados, tiempos y comprobaciones anteriores pertenecen al corte inicial
y sus ajustes visuales; no validan la ampliacion de citas de 48. En esta revision
solo se inspeccionaron archivos, sin pruebas, BD, CI ni despliegue. Cobertura:
[49 - Estado actual](49-Estado-Actual-y-Cierre-Documental.md).

Un lead puede no tener eventos, tener eventos no Cita o multiples citas. El tipo
Cita clasifica el evento, no cita_lead ni la etapa comercial del lead. Contar IDs
de evento distintos, no participantes/copias. scheduled, cancelled, completed y
asistencia permanecen separados. La clasificacion nativa es futura sobre datos
configurados: las ocho tablas de 034 estaban vacias en la evidencia registrada,
sin tipo Cita sembrado. Los predicados actuales se documentan en 48; el lector no
crea tipos ni concede permisos. Las reglas de gestion de 47 siguen siendo futuras.

Evidencia API (relativa a apps/api): src/modules/crm/marketing/marketing-home.module.ts,
marketing-home.service.ts, marketing-home.repository.ts, marketing-home.model.ts,
marketing-home.contract.ts y marketing-appointments.{repository,model,contract}.ts
del mismo directorio; src/integrations/legacy-crm/legacy-marketing-home.reader.ts
y legacy-marketing-appointments.reader.ts. Evidencia frontend (relativa a apps/frontend):
src/modules/home/MarketingHomePage.tsx, marketing-appointments.model.ts y
src/services/marketing/home-summary-service.ts.

## Leads con reserva — ampliación 2026-11-11

El resumen incorpora `reservationsAvailable` y `rows[].withReservation`.
La tarjeta «Leads con reserva», junto a «Leads», suma los leads registrados en
el período elegido con reserva o pre-reserva vigente; no cuenta documentos ni
filtra por fecha de la reserva. Respeta proyecto, vendedor autorizado y la
precedencia de cohortes nativas. Varios documentos para un lead cuentan una vez.

- Nativo: OV vinculada por `lead_id_sales_order`, activa, `cancelled='no'` y sin
  borrado. No existe una columna nativa de reserva/pre-reserva independiente.
- Legacy: OV activa, sin caída, `reserva_ov=1`, o estimación con `pre_reserva=1`
  y `COALESCE(pre_caida,0)=0`, sin OV asociada o con una OV de pre-reserva activa
  sin caída. Reutiliza la validación del listado legado de Órdenes de venta.
- Una OV promovida se rige por su versión nativa mediante
  `id_old_produccion_sales_order`; cancelar, inactivar o borrar esa versión no
  rehabilita la reserva antigua. Una OV nativa vigente vinculada al documento
  legado también acredita la reserva para el lead legacy.
- El puente de lead por referencia NetSuite exige referencia positiva, lead
  legacy único y alias nativo inequívoco. Una cohorte promovida conserva su fecha,
  vendedor y proyecto nativos, incorporando evidencia legacy válida.

La lectura continúa en una transacción REPEATABLE READ / READ ONLY, sin copiar
registros, modificar estados ni cambiar permisos. Si falta el nuevo contrato
(API anterior), la tarjeta muestra «—», no un cero inventado. El cliente valida
conteos enteros no negativos, no mayores a los leads de su cohorte, y exige la
medida en todas las filas cuando `reservationsAvailable=true`.

Prueba SQL sintética de solo lectura: desde `apps/api`, establecer
`CRM_MARKETING_RESERVATIONS_LIVE=true` y ejecutar
`pnpm exec vitest run test/marketing/marketing-reservations.readonly.mysql.spec.ts`.
Usa CTE, sin tablas temporales ni escrituras, y propiedades generadas con semilla
20261111 para precedencia nativa, reservas caídas y pre-reservas.
