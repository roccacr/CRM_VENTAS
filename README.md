# CRM TINK: inicio y continuidad

Checklist central de seguimiento: [Pendiente Roberto](<Pendiente Roberto.md>).
Aquí se mantienen los avances, las validaciones abiertas y los nuevos pendientes del sistema.

## Estado vigente - 2026-10-29

Este corte sustituye las descripciones de estado de los snapshots inferiores;
conserva su evidencia histórica y no autoriza por sí mismo operaciones.

- **Notas colaborativas:** API e interfaz personal, invitaciones múltiples,
  respuestas, menciones, campana y sockets internos. El autor administra contenido,
  participantes y ubicaciones; cada lector conserva posición, tamaño, PIN,
  seguimiento y recordatorio personal. Se incorporaron responsable opcional,
  vencimiento, búsqueda/filtros en servidor e historial. Contratos:
  [66 - Seguimiento de notas](apps/api/Arquitectura/66-Notas-Enterprise-Seguimiento.md)
  y [60 - Colaboración](apps/api/Arquitectura/60-Notas-Etapa4-Colaboracion-y-Notificaciones.md).
- **Identidad de notas:** vínculo por tipo, origen e ID del registro, independiente
  de URL. Invitar no concede acceso a la orden; sin permiso de ficha, la persona
  conserva acceso a la nota desde su bandeja/campana según su autorización vigente.
  Ubicaciones adicionales son Homes autorizados, sin duplicar notas. La ficha
  operativa de orden actualmente implementada sigue siendo Formalización.
- **Formalización:** ambos roles gestionan todas las órdenes con el permiso de
  cada acción. Banners/listas y detalle mantienen permisos independientes;
  `formalizacion.orders.read` basta para abrir una ficha. [65 - Roles y recuperación](apps/api/Arquitectura/65-Formalizacion-Correcciones-Roles-y-Recuperacion.md).
- **Calendario compartido:** `CalendarModule` registra lectura por intervalo y
  creación/edición nativa auditada; exige módulo activo, lectura y permiso de
  escritura cuando corresponda. La superposición no cambia el origen del evento.
  Legacy aporta solo eventos con contexto explícito, sin importar historia ni
  inferir módulos. [Contrato de calendario](apps/api/Arquitectura/64-Calendario-Global-API-y-Contexto.md).
- **Mercadeo:** Inicio y Captación consultan API con prioridad nativa y adaptador
  legacy opcional, sin copiar Leads. Se mantienen filtros múltiples, identidad de
  vendedor por publicId y métricas de citas vinculadas al lead. El menú Eventos
  y citas y su permiso fueron retirados; Calendario conserva su propio contrato.

### QA registrado el 29 de octubre

[67 - Plan y resultados](apps/api/Arquitectura/67-Plan-QA-Regresiones-20261029.md)
registra las correcciones de pruebas obsoletas y los logs de aceptación:

- API: 6.524 pruebas aprobadas, 151 omitidas condicionales; formato, lint, tipos y build aprobados.
- Frontend: 1.233 pruebas aprobadas, sin omitidas; formato, lint, tipos y build aprobados.
- MySQL/sockets de notas: 32 pruebas aprobadas aparte, en esquemas temporales eliminados.
- El primer `check-all.cmd` terminó con error de tipado en las nuevas aserciones
  del frontend. Se corrigió y el `pnpm check` completo del frontend posterior
  terminó con exit0; no se presenta el primer comando raíz como aprobado.

Las suites focalizadas y generales se solapan; no sumar sus cifras como pruebas
únicas. Las otras pruebas API omitidas no quedan certificadas. Redis multinodo,
latencia/carga y aceptación visual con dos cuentas reales siguen pendientes.
No hay aceptación de producción, commit, despliegue ni copia de notas a legacy
acreditados por este QA. Adjuntos y correo externo de notas siguen fuera del alcance.

## Antecedentes de implementación - 2026-10-28 y 2026-10-27

Formalización (2026-10-28): ambos roles gestionan todas las órdenes con permisos
efectivos por acción. Banners/listas y detalle mantienen permisos independientes;
se corrigen revalidación, revocación, operación incierta y recorrido de etapas.
Migración049 aplicada sin importar datos ni modificar órdenes. Estado, valores
por defecto de cada rol y límites: [65 - Roles y recuperación](apps/api/Arquitectura/65-Formalizacion-Correcciones-Roles-y-Recuperacion.md).

Notas colaborativas (2026-10-27): etapas1/2/3/4 implementadas, esquema039/040, API y notas personales.
[Plan y avance](apps/api/Arquitectura/56-Plan-Notas-Colaborativas-y-Convivencia-Legacy.md)
y [diccionario/evidencia](apps/api/Arquitectura/Diccionario-Datos/12-Notas-Colaborativas.md).
API y25 permisos por modulo documentados en [57](apps/api/Arquitectura/57-Notas-Etapa2-API.md). Interfaz personal: [58](apps/api/Arquitectura/58-Notas-Etapa3-Interfaz-Personal.md). Campanita interna implementada en etapa4; copia legacy pendiente, sin importar datos.

Snapshot documental histórico: 2026-10-27. Este repositorio contiene el CRM nuevo NestJS/React. El checkout legacy llamado CRM VENTAS es otro proyecto; no usarlo para ejecutar estos comandos.

## Snapshot de estado - 2026-10-27

Ver [55 - Revision documental integral](apps/api/Arquitectura/55-Revision-Documental-Integral-20261027.md)
y [49 - Estado consolidado](apps/api/Arquitectura/49-Estado-Actual-y-Cierre-Documental.md).
Este corte prevalecía sobre los resúmenes anteriores; el corte del 29 de octubre lo actualiza. Una funcion registrada
en codigo no acredita despliegue, ejecucion real ni conciliacion de todas las fuentes.

- Identidad, usuarios, roles, permisos, auditoria y catalogos: runtime registrado;
  sus contratos y restricciones siguen en la arquitectura de API/frontend.
- Mercadeo: Inicio y Captacion consumen datos mediante API, con prioridad nativa
  y legacy opcional, sin importar registros. Captacion distingue leads con cita
  de cantidad de eventos y conserva fotos por publicId. El menu Eventos y citas
  fue retirado junto con `mercadeo.appointments.read` mediante migracion038;
  Calendario y las metricas de citas se conservan. Contrato en [53](apps/api/Arquitectura/53-Captacion-Leads-Reporte-Federado.md).
- Formalizacion: seguimiento, tiempos, envio/reversion y cambio de etapas tienen
  controladores registrados. No describir el modulo actual como solo Home.
  Cada comando mantiene sus permisos, reglas y compuertas. Consulta diagnostica
  NetSuite GET registrada, sin autorizar escrituras ERP. [52](apps/api/Arquitectura/52-Etapas-Responsables-y-Tiempos.md).
- Calendario nativo: esquema preparado; no equivale a editor operativo, Outlook
  o notificaciones conectadas. [47](apps/api/Arquitectura/47-Calendario-Compartido-Esquema.md).
- Los conteos de usuarios/tablas, flags locales y pruebas de los cortes anteriores
  son evidencia fechada. Esta revision no consulta ni modifica la BD o `.env`.

Verificacion de esta revision: ambos `pnpm typecheck` pasaron. `check-all.cmd`
se detuvo en format:check de API por tres archivos de codigo; no ejecuto despues
lint, pruebas ni build. El detalle y los limites estan en55. Sin cambios de
codigo, configuracion, datos, commits ni despliegue en este cierre documental.

## Corte historico de estado y limites - 2026-10-23

Entrada consolidada del 2026-10-23: [49 - Estado actual y cierre documental](apps/api/Arquitectura/49-Estado-Actual-y-Cierre-Documental.md).
El plan de revision con tres agentes y coordinacion esta aplicado: 97 Markdown
revisados por vigencia, referencias y trazabilidad. Esta referencia distingue
codigo operativo, esquema aplicado, simulaciones,
evidencia historica y pendientes; prevalece sobre cortes anteriores de este README.

- Usuarios: 43 perfiles creados por correo, uno existente omitido; total nativo
  observado 46. Los 43 tienen rol Ventas sin permisos; 30 pending y 13 inactive,
  sin credenciales ni acceso habilitado. [45 - Evidencia](apps/api/Arquitectura/45-Usuarios-Por-Correo.md).
- Leads: esquemas 031/032 aplicados y lectura de timeline; no CRUD comercial
  completo ni importacion historica. El servicio interno de historial esta registrado
  y exportado, sin consumidor comercial de escritura ni endpoint localizado. 033 existe pero no figura aplicada en el
  SELECT nativo del cierre, 2026-10-23 17:56 Costa Rica. [43](apps/api/Arquitectura/43-Leads-Esquema-Nativo.md),
  [44](apps/api/Arquitectura/44-Bitacora-Legacy-y-Timeline.md).
- Inicio de Mercadeo: resumen real protegido por mercadeo.home.read, nativo y
  fallback legacy autorizado, con agregados de leads/citas. No es calendario
  operativo ni administracion de Leads. [46](apps/api/Arquitectura/46-Mercadeo-Resumen-Leads.md),
  [48](apps/api/Arquitectura/48-Mercadeo-Metricas-Citas.md). Cita se atribuye al
  vendedor/proyecto del lead; conversion cuenta leads unicos y completadas cuenta
  eventos por fecha. Las fotos siguen a todos los vendedores seleccionados;
  pendientes/canceladas y asistencia sin verificar quedan separados.
- Calendario: 034 aplicada, ocho tablas vacias. Modelo compartido por modulo
  original, participantes, vinculos, lectura de campana y sync externo preparados;
  sin tipos sembrados, endpoints de gestion, notificaciones ni Outlook activos.
  [47 - Esquema y reglas](apps/api/Arquitectura/47-Calendario-Compartido-Esquema.md).

Jerarquia modular: [42 - Jefaturas](apps/api/Arquitectura/42-Jefaturas-Modulos-y-Permisos.md).
Migraciones nativas 029 y 030 aplicadas. Owner conserva herencia global y denies
individuales; administra la plantilla de Jefe General en Roles y seguridad,
Por rol. El empleado recibe la interseccion de los modulos habilitados en esa
plantilla y sus modulos asignados. Los jefes de area conservan sus grants bajo su techo modular.
La administracion del acceso reutiliza Usuarios y Roles y seguridad; no modifica
ordenes ni identidad en la BD legacy. Evidencia final y limites en 42.

La [remediacion y evidencia de verificacion](apps/api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md) conserva el corte fechado de seguridad. Incluye autenticacion global por defecto denegada, permisos declarativos de ruta con comprobaciones adicionales en servicios/recursos, limites de lectura por proceso, recuperacion de clave deshabilitada con 503, salud HTTP, navegacion con historial/carga diferida y errores recuperables. No acredita despliegue ni cierre completo de seguridad.

Formalizacion tiene persistencia interna normalizada de ordenes e historial.
Aprobaciones conserva `formalizacion.home.approvals.read`; contratos y las cinco
etapas posteriores comparten `GET /formalization/home/summary`, con permisos
específicos de banner y uno de los dos roles efectivos activos de Formalización.
El detalle usa `formalizacion.orders.read`, independiente de los banners.
Owner puede heredar esos roles, pero no omitir un deny individual. No consultan sin
su autorizacion. El agregado lee ambas fuentes sin cache, con autoridad nativa
y conteo de etapas actuales por ultima secuencia; el cierre anual acumula
eventos finales del ano. No son ceros demostrativos. Definiciones,
acumulado anual de finalizaciones y evidencia: [Home y rendimiento](apps/api/Arquitectura/40-Formalizacion-Home-Resumen-y-Rendimiento.md).
Bandejas vacias y seguimiento/movimientos sin fuente operacional. En ese corte era solo Home:
list/send/revert no estaban registrados en runtime; las clases preparadas no autorizan
acciones. Calendario/resumen y recorridos de gestion conservan simulaciones,
no operaciones reales.

`CRM_THINK_V2` es desarrollo con datos que deben conservarse; `crmdatabase-api` es produccion. No usar la primera como dataset desechable. Lectura legacy y escritura tienen compuertas distintas: `ENABLE_LEGACY_FALLBACK` no habilita mutaciones. Los escritores legacy de catalogos requieren ademas produccion y destino exacto; en ese corte los comandos contractuales preparados no estaban habilitados en runtime.

Los defaults de [`.env.example`](apps/api/.env.example) y validacion son `ENABLE_LEGACY_FALLBACK=false`, `ENABLE_RECORD_AUDIT=false` y `ENABLE_LEGACY_WRITES=false`. El snapshot local autorizado del 2026-10-22, [posterior al retiro de acciones](apps/api/Arquitectura/38-Ordenes-Venta-Estados-Auditoria.md#alcance-final-corregido-solo-home---2026-10-22), documenta fallback/auditoria `true` y legacy writes `false`; no se relee ni modifica `.env` en esta remediacion. El estado de produccion es desconocido. Con fallback apagado los resumenes consultan solo nativo; una configuracion local no acredita operacion productiva.

El [plan central F01-F13 y resultados nuevos](apps/api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md#plan-central-f01-f13---2026-10-23) registra la remediacion local: check-all aprobado, API 5194 pruebas y 113 MySQL omitidas, frontend 507 pruebas en cinco corridas seriales y cobertura aprobada. No certifica despliegue, MySQL aislado, clon limpio ni CI remoto del arbol actual.

El corte `f2dc4f1` tuvo clon limpio y `check-all.cmd` aprobados: API 4583 pruebas aprobadas y 113 MySQL omitidas; frontend 428 aprobadas. Es evidencia fechada de esa entrega, no una nueva corrida de esta revision documental. CI esta versionado/preparado, sin ejecucion remota acreditada. MySQL sigue informativo y bloqueado hasta disponer de dataset aislado autorizado.

## Leer en este orden

Entrada actual: [QA y resultados del 29 de octubre](apps/api/Arquitectura/67-Plan-QA-Regresiones-20261029.md), [seguimiento de notas](apps/api/Arquitectura/66-Notas-Enterprise-Seguimiento.md), [estado consolidado y plan aplicado](apps/api/Arquitectura/49-Estado-Actual-y-Cierre-Documental.md), [registro integral de entrega y pendientes](apps/api/Arquitectura/36-Registro-Entrega-Administracion.md), [auditoria y conflictos](apps/api/Arquitectura/37-Auditoria-Trazabilidad-y-Conflictos.md) y [comportamiento visual / QA](apps/frontend/Arquitectura/27-Entrega-Administracion-y-QA.md). Incluyen matriz solicitud -> codigo -> pruebas -> estado. Los documentos fechados anteriores conservan evidencia historica, no necesariamente estado operativo actual.

1. [Ley de producto](apps/api/Arquitectura/00-Producto-CRM-TINK-y-P0.md): alcance y restricciones.
2. [Traspaso y estado del API](apps/api/Arquitectura/34-Cierre-Operativo-Administracion-P0-S1.md): implementacion, decisiones, riesgos y cierre.
3. [Traspaso frontend](apps/frontend/Arquitectura/25-Continuidad-Administracion.md): pantallas, componentes, contratos y QA.
4. [Indice API](apps/api/Arquitectura/00-Indice.md) e [indice frontend](apps/frontend/Arquitectura/00-Indice.md): diseno completo y vision futura.
5. AGENTS.md raiz y de cada aplicacion antes de cambiar codigo.

## Norte del producto

CRM propio, independiente del ERP, para el expediente comercial Lead -> Oportunidad -> Estimacion -> Orden de Venta -> Contrato. Relaciones por identidad CRM; NetSuite/Odoo son referencias externas y adapters.

Prioridad: conservar identidad y permisos como base, junto con las ampliaciones aprobadas de Formalización, Mercadeo, calendario compartido y notas descritas en el corte vigente. El CRUD comercial general de Leads y la sincronización ERP completa mantienen sus fases y compuertas; el calendario y los trabajadores de notas ya registrados no autorizan otros jobs. Lecturas legacy usan transacciones de solo lectura; los seis catalogos dedicados tienen la excepcion de escritura bajo compuerta independiente descrita en documento 35. Expedientes sigue siendo solo lectura. No se migra negocio real por defecto.

## Ejecutar y verificar

CI preparado en [.github/workflows/quality.yml](.github/workflows/quality.yml).
El [runbook CI/MySQL](apps/api/Arquitectura/CI-MySQL-Pruebas.md) distingue los
checks de calidad de la persistencia real. Sin infraestructura de pruebas
habilitada, el gate MySQL queda bloqueado, no aprobado por omision.

La [remediacion de auditoria](apps/api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md)
registra cambios, verificaciones y pendientes. Ver tambien el
[runbook de operacion y rollback](apps/api/Arquitectura/Operacion-Despliegue-Rollback.md).

Node >=22 y pnpm >=10.28.2. No hay package.json raiz ni workspace Node conjunto. Cada app tiene su lockfile.

Desde cada carpeta: `pnpm install --frozen-lockfile`, luego `pnpm dev`. Configurar primero el entorno con los responsables; no copiar secretos a documentacion.

- API: `apps/api`; defaults de desarrollo bind 127.0.0.1, puerto 3000. Variables y validacion en src/config/env.validation.ts; plantilla .env.example.
- Frontend: `apps/frontend`; Vite. VITE_API_ORIGIN apunta al origen API; en desarrollo default http://localhost:3000. No admite secretos. Mantener localhost coherente con CORS, cookies y callback Microsoft.
- Verificacion completa desde raiz: `.\check-all.cmd`. Ejecuta API y frontend secuencialmente: format:check, lint, typecheck, test, build.
- Comando por app: `pnpm check`. Los checks no acreditan despliegue, migracion ni aceptacion real.

No ejecutar migraciones, importaciones, commit, push o deploy sin autorizacion especifica. El runner de migraciones escribe datos de seguridad ademas de esquema; su nombre schema-only no significa solo lectura.

## Estado de entrega

Proyectos, Campanas, Clases, Ubicaciones, Subsidiarias y Corredores tienen agregados y tablas dedicadas con referencias externas por proveedor. Expedientes usa `crm_unit_file` y su tabla de referencias, con API de lectura y consulta por proyecto CRM. El importador masivo de Proyectos fue retirado. Ver [esquema/API](apps/api/Arquitectura/35-Catalog-API-and-Schema.md) y [registro de entrega](apps/api/Arquitectura/36-Registro-Entrega-Administracion.md). No inferir el contenido actual de identidad a partir del reset historico ni repetir toda la cadena de migraciones para probar un dominio.

El codigo administrativo existe y tiene pruebas; su cierre operativo sigue pendiente de sesion Owner, navegador, API y MySQL reales. Consultar el registro de verificaciones del documento 34 para resultados de esta entrega.

Git history and remote branch status determine what is backed up. A commit/push is not a deployment, database migration, or operational acceptance.

Las tablas de horas reconstruidas en el chat para 24/09, 25/09, 01/10 y 02/10 no prueban fechas de implementacion. Ver su registro resumido en el documento 34.

## Base administrativa - corte 2026-10-13

- Administration includes users, roles/security, audit and seven catalog views: projects, campaigns, classes, brokers, files, subsidiaries and locations. Storage is domain-owned, not seven shared aggregates.
- Six editable catalog screens reuse DataTables/SearchPanes with bounded offset pages (default 100; 10/50/100/200), authoritative totals and instance-local page cache. Unit Files is a separate criteria-first keyset read view (default 50/max 100), with full-scope facet counts and completeness-checked local filtering. Neither scheme guarantees a concurrent-write snapshot.
- Detail Drawers follow the users pattern, with separate provider sections and explicit unassigned values. Empty Odoo identifiers require no configured Odoo provider; non-empty references require an active provider.
- Updates retain unchanged reference row identity, archive removed references, restore references belonging to the same item and return HTTP 409 for conflicting ownership. Database uniqueness is catalog + provider + external ID, including archived ownership, not global across catalogs.
- Access replacement increments permission versions atomically with role/membership changes and audit; permission-only changes renew the active session to current grants. Blocking/inactivation and logout retain hard revocation. Protected operations resolve the authoritative current profile.
- Incremental migrations add catalog persistence and repair Administration/Owner linkage. Applying migrations is a separately authorized operation, not part of startup or push.
- Unit Files preflight defaults to report-only; its explicit project-identity preparation is not an inventory import. Complete inventory migration and ambiguous relationships remain pending. Valid signed provider IDs must be preserved exactly; no Odoo identifier is fabricated.
- Audit writers record safe before/after snapshots, field differences, actor roles and record identity transactionally. Read APIs require module/section scope and fetch detail lazily; historical missing values remain unknown.
- Roles/security uses module/section selectors and catalog tabs in role and employee modes. Business 409 conflicts are not retried; only the explicit stale-permission-session 409 renews once. Owner protections remain enforced.
- Automatic reconciliation of changes made by external systems is not implemented; native precedence and caching are not bidirectional synchronization.

See [CHANGELOG](CHANGELOG.md), [migration guide](apps/api/Arquitectura/03-Base-Datos-y-Migracion.md), [catalog API/schema](apps/api/Arquitectura/35-Catalog-API-and-Schema.md), and the closure/continuity documents above.

API configuration uses `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` and `DB_SSL_CA`, validated by `env.validation.ts`. Legacy reuses DB connection credentials with its own database name. Its SELECT pool enforces read-only transactions; mirrored writes additionally require the separate write gate described above and domain authorization. Read-only transactions do not prove least-privilege credentials. Use app `.env.example` templates; real `.env` files stay untracked. Never change shared credentials as a side effect of testing.

Historical baseline (2026-10-09): API 227 and frontend 120 tests, plus seven separately enabled MySQL tests. An intermediate permission-fix cut recorded frontend 257 tests and 13 API access-guard tests, with API formatting blocking its global check. That blocker is historical, not the current result; use the dated verification above. Bundle-size warning and operational acceptance remain pending.

### Cliente de una orden: estado y bitácora unificados

`GET /formalization/orders/:source/:id/database` conserva la autorización de sesión, permiso y alcance de la orden. Incluye `lead.status` (`active`, `inactive`, `unknown`, con etiqueta) separado de la etapa comercial; el 1/0 legacy se normaliza en el API. `sourceFields` conserva evidencia original. `lead.followUpReason` presenta código, nombre, origen y significado: `caidas` es una clasificación de seguimiento, no necesariamente una venta perdida.

`clientHistory` devuelve `items`, `hasMore`, `nextCursor`; para continuar se envía `historyCursor` al mismo endpoint. Cada página tiene hasta 50 eventos. El cursor está ligado al cliente de la orden autorizada. Los eventos de ambas fuentes se relacionan solo por identidades y enlaces explícitos de `int_lead_history_link`; no se buscan clientes por nombre/correo. Las entradas legacy preservadas en un archivo enlazado se deduplican. No se expone el contenido arbitrario de snapshots de auditoría ni metadatos privados de la petición.

El panel muestra la línea temporal debajo de Captación y seguimiento, con Cargar más registros y reintento. Las fechas legacy sin zona confirmada conservan su hora original; los nombres resueltos desde el directorio actual se identifican como tales. No se inventan fechas ni actores. Si el adaptador legacy está deshabilitado, solo son consultables los eventos conservados en la BD nueva. No se importan ni escriben eventos en esta consulta.

Validación: abrir el cliente de una orden autorizada, comprobar estado y clasificación, consultar el historial y su paginación; denegar acceso fuera del alcance. La verificación real de solo lectura de legacy:208 devolvió estado Activo, clasificación legacy:58 Cierre Firmado y 8 eventos. La ruta nativa y el límite de 50 se probaron con dobles; esto no equivale a un historial nativo poblado ni a probar escrituras.

Detalle de orden (lectura): [bitácora de orden y expediente de unidad](apps/api/Arquitectura/56-Orden-Bitacora-y-Expediente-Lectura.md). La bitácora se abre con su botón y Proyecto · Unidad abre el expediente; mantienen autorización por orden y consultas frescas al abrir.

Notas: [59 - contexto opcional](apps/api/Arquitectura/59-Notas-Contexto-Opcional-y-Vistas.md). Crear desde cualquier pantalla; check para vincular vista u orden native/legacy; privadas hasta compartir.041 registra solo el origen de referencia, sin copiar datos.

Notas etapa4: [colaboración y campana interna](apps/api/Arquitectura/60-Notas-Etapa4-Colaboracion-y-Notificaciones.md). Participantes por invitación, comentarios propios, menciones, avisos y lectura individual;044 aplicada. Copia legacy pendiente; sin imports ni envíos externos.

Notas realtime, 2026-10-28: [contrato, configuración y evidencia](apps/api/Arquitectura/62-Notas-Tiempo-Real-Implementacion.md). Transporte Socket.IO protegido, persistencia nativa046 y actualización de campana/conversación; sin copia legacy ni despliegue. Redis multiinstancia y aceptación visual real pendientes.
