# 30 - Estado frontend contrastado con el código - 2026-10-27

## Corte vigente - 2026-10-29

La revisión documental actual contrasta código y evidencia registrada; no
certifica despliegue ni vuelve a ejecutar pruebas o acciones comerciales.
[67 - Plan y resultados QA](../../api/Arquitectura/67-Plan-QA-Regresiones-20261029.md)
registra el trabajo ejecutado el 29: API 6524 aprobadas/151 omitidas condicionales,
frontend 1233 aprobadas y 32 SQL/socket de notas aprobadas aparte. Los resultados
no se suman porque hay suites solapadas. Ambos proyectos aprobaron formato,
lint, tipos y build. El primer check-all terminó con exit1 por nueve errores de
tipado en nuevas aserciones QA; se corrigieron y el check frontend posterior
terminó con exit0. No atribuir exit0 retrospectivo al primer comando.

Se corrigieron expectativas obsoletas, sin cambiar permisos de producción:
inventario 78 handlers, mappings de Calendario con lectura/membresía,
actividad reciente con lectura de órdenes y cuatro casos de App que aún
buscaban el menú Resumen retirado. Se agregaron 23 negativos HTTP; 441 casos
HTTP y 73 de App aprobaron. Solo el beforeAll de precarga tiene límite de 60s;
las esperas de interacción no se ampliaron para ocultar fallos funcionales.

Las notas incluyen invitaciones, comentarios/menciones, campana y Socket.IO,
responsables, vencimiento, recordatorios privados, Homes adicionales, búsqueda
API e historial. [16 - UX vigente](16-UX-Notas-Adhesivas-y-Anotaciones.md) describe
bandejas, acciones, privacidad y guardado; [66 API](../../api/Arquitectura/66-Notas-Enterprise-Seguimiento.md)
registra contratos y límites. Compartir y campana ya no están pendientes.
Copia legacy y adjuntos no están activados. Redis multinodo, benchmark y
aceptación visual con dos cuentas reales siguen sin verificarse.

El [calendario global](Calendario-Global-Frontend.md) ya usa API, calendarios
superpuestos y formularios nativos en Formalización, Mercadeo, Ventas y
Contabilidad. Sustituye los cortes inferiores de calendario vacío/maqueta.
Outlook, invitados y notificaciones de eventos no quedan conectados por ello.
Las secciones fechadas del 27/28 conservan su historia y no son restricciones
para retirar las funcionalidades actuales.

Cierre documental anterior: [55](../../api/Arquitectura/55-Revision-Documental-Integral-20261027.md).
La evidencia del 29 pertenece al QA67, no se presenta como pruebas ejecutadas de
nuevo durante esta conciliación documental. Sin BD, imports, commits o despliegue.

## Precedencia y alcance

La ley de producto API conserva autoridad; este inventario corrige descripciones
anteriores que todavía llaman maqueta a Captación o declaran vacío todo el
seguimiento de Formalización. Blueprint y cronologías quedan como antecedentes,
no como instrucciones para retirar funcionalidad ya implementada.

## Rutas y consumidores reales

Fuente: `src/routes/app-routes.ts`, `AppRouteContent.tsx` y
`src/modules/home/GlobalHomeShell.tsx`. Las rutas privadas se montan después de
sesión/perfil y autorización visual; el API decide autorización definitiva.

| Ruta o familia | Estado contrastado | Contrato/consumidor principal |
| --- | --- | --- |
| `/auth/login` | Identidad local/Microsoft BFF; pública | `auth-service.ts`, sesión y perfil canónicos |
| `/home/administration/users` | Directorio y formularios conectados | `auth-service.ts`, componentes Users y hooks de catálogo/directorio |
| `/home/administration/roles-security` | Roles, permisos y excepciones conectados | `RolesSecurityPage`, `RolePermissionHierarchy`, catálogo API |
| `/home/administration/audit-logs` | Lectura de auditoría con filtros y detalle | `security-audit.api.ts`: `/audit`, `/audit/options`, `/audit/:publicId` |
| `.../catalogs/projects|campaigns|classes|brokers|files|subsidiaries|locations` | Páginas reutilizadas por contexto modular | `catalog-service.ts`, definiciones y `unit-files.api.ts` |
| `/home/marketing` | Home conectado, sin cifras demo de respaldo | `GET /marketing/home/summary?period=day|week|month|year` |
| `/home/marketing/leads` | Reporte de cohortes conectado | `GET /marketing/leads/report?period=day|week|month|all` |
| `/home/formalization` y `/home/formalization/orders` | Inicio/Gestión con seguimiento canónico y cambio protegido de etapa | Resúmenes, follow-up y stage descritos abajo |
| `/home/{formalization,marketing,sales,accounting}/calendar` | Calendario global conectado, overlay por módulo y formularios nativos | `SharedCalendarPage`, API `/calendar/calendars` y `/calendar/events`; legacy solo lectura |
| `/home/formalization/summary` | Ruta y menú retirados | La maqueta conservada no se expone como ruta operativa |
| `/home/sales`, `/home/accounting`, portadas de catálogos, integraciones y rutas Formalización files/contracts | Rutas registradas con placeholder o sin flujo propio | Una ruta no acredita CRUD o integración operativa |

Los siete catálogos se reutilizan en Administración y cuatro contextos operativos;
son vistas del mismo dominio, no copias de datos por módulo. Expedientes usa el
servicio especializado `/unit-files`; no confundirlo con documentación de una
orden de venta. Los cambios de catálogo/usuario son comandos reales autorizados
por el API, a diferencia de los formularios preview de Formalización.

## Mercadeo: Inicio y Captación son reportes diferentes

El menú vigente contiene Inicio, Captación de leads, Calendario y Catálogos.
**Eventos y citas fue retirado**; no existe su ruta ni debe ofertarse el permiso
`mercadeo.appointments.read` en Roles y seguridad. La migración API 038 retira esa
definición y asociaciones; la evidencia de ejecución pertenece al registro API.
`mercadeo.calendar.read` protege la ruta `/home/marketing/calendar`, que delega
en el calendario global conectado. Sus acciones requieren capacidades efectivas
y permisos de lectura/escritura del módulo; no habilita Outlook.

Inicio usa `mercadeo.home.read`, cuatro indicadores, comparación temporal y filtros
múltiples vendedor/proyecto. La foto de vendedores seleccionados se resuelve por
publicId nativo y tiene fallback. No consulta BD ni proveedor directamente.

Captación requiere `mercadeo.leads.read`; `MarketingLeadCapturePage` se remonta por
publicId y permissionVersion. `lead-report-service.ts` valida forma, fechas,
catálogos, partición de cohortes y totales; `useCaptureReport` aísla solicitudes
por periodo/identidad/intento y descarta respuestas obsoletas. Fallo muestra
Reintentar y nunca genera cifras de muestra o ceros como sustituto de un error.

### Controles y resultados actuales de Captación

- Qué medir: Leads, Leads con cita y Leads perdidos. No son nueve informes ni un
  constructor de KPIs financieros.
- Ver por: Proyecto; Proyecto › Campaña; Proyecto › Campaña › Anuncio.
- Periodos visibles: Hoy, Semana, Mes, Trimestre y Año. Trimestre/Año solicitan
  `all` al API y recortan localmente desde el inicio calendario correspondiente
  hasta el fin recibido, sin retroceder antes del rango disponible. `Todo` sigue
  siendo valor de contrato API, no botón visible actual.
- Vendedor admite multiselección y por defecto incluye todos. La selección de un
  vendedor ausente en el siguiente periodo se conserva y produce su resultado
  vacío; no se convierte silenciosamente en todos.
- Tres banners: total; proyectos con leads o porcentaje general de la medida;
  promedio por unidad del nivel elegido (total dividido por grupos con leads).
- Gráfico de columnas apiladas por vendedor, color estable por identidad,
  avatares y leyenda. Límite inicial de 15 grupos; el propio componente ofrece
  controles de presentación y amplitud. Cada combinación proyecto/campaña/anuncio
  conserva su identidad, incluso si contiene separadores en el nombre.
- Ver desglose en tabla abre un modal. La selección múltiple de proyectos en la
  tabla acota gráfico, KPIs y tablas relacionadas; Limpiar restituye el alcance.
  Proyectos que ya no existen en las filas del periodo salen de esa selección.
- `CaptureLoading` dibuja un esqueleto estático con forma de tabla/gráfico y
  `role=status`; no es `antd Skeleton` ni shimmer. La corrección Vite anterior
  queda como antecedente, no prueba de causa del error de hooks de una sesión.
- PNG rasteriza una copia del reporte mediante SVG/foreignObject y canvas; PDF
  abre impresión del navegador con CSS de impresión. No es un PDF generado por
  servidor ni una exportación CSV/Excel. Fotos se incrustan para la imagen; la
  compatibilidad de impresión/canvas debe verificarse en el navegador destino.
  No se exportan resultados mientras falta la respuesta vigente.

Fotos: `SellerAvatar.tsx` usa `import.meta.glob` de `public/vendedores` para
webp/png/jpg/jpeg/avif y nombre igual a publicId ULID válido; no busca por nombre ni
por ID ERP. Ausencia, identidad nula o error de imagen conserva fallback.

Las cifras de Captación pertenecen a leads creados en el periodo. Cada lead con
cita cuenta una vez; realizada tiene prioridad sobre programada; canceladas solas
no significan cita vigente. No equivale a número de eventos ni asistencia. Perdido
es etapa actual, no todas las entradas históricas a perdido. Ambas fuentes se
resuelven en API, nativa primero, legacy opcional y sin copiar registros. Contrato
y limitaciones de datos: [53 API](../../api/Arquitectura/53-Captacion-Leads-Reporte-Federado.md).

## Formalización: seguimiento y cambio de etapa ya conectados

`formalization-read-policy.ts` acepta rol efectivo activo `formalizacion` o
`jefe_formalizaciones` y conserva allow sin deny por cada banner/bandeja.
`formalizacion.home.stages.read` es compatibilidad solo si no hay entradas
granulares de las categorías. La ficha requiere independientemente
`formalizacion.orders.read`: no depende de un permiso de banner. Ambos roles
gestionan todas las órdenes con el permiso de la acción, preservando reglas y
auditoría; Owner usa el perfil efectivo del API sin bypass local.
[Contrato65](../../api/Arquitectura/65-Formalizacion-Correcciones-Roles-y-Recuperacion.md).

| Lectura/comando | Servicio frontend | Comportamiento y límite |
| --- | --- | --- |
| `GET /formalization/approvals/summary` | `approval-summary-service.ts` | Total protegido independiente |
| `GET /formalization/contracts/summary` | `contract-summary-service.ts` | Servicio presente; no confundir su existencia con envío de correos |
| `GET /formalization/home/summary` | `home-summary-service.ts`, `useHomeSummary` | Seis banners, refresh explícito/foco; no tiempo real |
| `GET /formalization/home/follow-up` | `follow-up-service.ts`, `FormalizationFollowUpPreview` | Tabla canónica, búsqueda con debounce 300ms, proyecto, bandeja, paginación de 25; respuestas antiguas no se muestran |
| `POST /formalization/orders/stage` | `order-stage-service.ts`, `FormalizationStageEditor` | Permiso independiente `formalizacion.orders.stage.update`, confirmación, expectedSequence y operationId; retroceso con motivo; error/conflicto conserva edición y requiere releer cuando corresponde |
| `GET /formalization/orders/:source/:id/netsuite` | `netsuite-order-service.ts`, `useNetsuiteOrderConsole` | Inspección temporal solo DEV al abrir identidad autorizada; no alimenta los campos de Información primaria |

Bandejas reconocidas: all, approvals, contracts, send, signature, bank, balance,
transfer, signed y closed. Todas aparece primero; otras opciones y proyectos se
ordenan con colación española. La bandeja approvals no se solicita con su permiso
revocado. Permisos y búsqueda participan en la clave de la respuesta; la
revocación desmonta el consumidor. Abrir una fila canónica usa la identidad
`source:id`, nunca la convierte en una orden de los fixtures de simulación.

El panel y el registro completo muestran datos canónicos de identidad/avance.
**Información primaria** conserva un bloque explícito Datos de ejemplo desde
`FormalizationRecordSummary.tsx`: no es respuesta NetSuite, no es fallback del
listado y no acredita Estado de cuenta. El cambio de etapa real es independiente
de las acciones locales de contrato/banco/traspaso de las previews. No inferir
que enviar/revertir contratos o notificar clientes quedó conectado por existir
el editor de etapas.

El hook DEV consulta NetSuite con identidad source/id, escribe solo sus claves
orderSource/orderId/netsuiteId en URL con replaceState y registra el resultado en
consola. No persiste el payload. Esto no es una pantalla productiva de integración
ni autorización para compartir logs que puedan contener datos de una orden.

## Infraestructura y seguridad frontend

- React/Vite/TypeScript, Ant Design, DataTables/SearchPanes, fetch y hooks React.
  TanStack Query, Zustand, React Hook Form, Tailwind/Radix continúan blueprint.
- `api-client.ts` centraliza credenciales de sesión/CSRF; React no almacena tokens
  ERP ni consulta las dos BD. Los códigos públicos conservan identidad canónica.
- History API, popstate, `LazyRoute`, Suspense y `RouteErrorBoundary` entregan
  carga y reintento explícito sin revelar stack al usuario ni recarga en bucle.
- `vite.config.ts` deduplica react/react-dom y preoptimiza antd/es/skeleton; no
  implica que Captación actual utilice ese Skeleton ni demuestra retrospectivamente
  la causa de un fallo observado antes.
- Los permisos visibles no reemplazan validaciones del servidor. Una opción o
  placeholder tampoco demuestra disponibilidad de operación backend.

## Cobertura de la revisión y pendientes

Se inspeccionaron los registros de rutas y consumidores de identidad/catálogos,
auditoría, Home/Captación de Mercadeo y Home/Gestión/etapas/preview de
Formalización. Se contrastaron los documentos 00–29 y AGENTS por su propósito:
00/01/19/27 son entradas de estado, 25–29 mezclan historia con entregas, 02–24
contienen arquitectura/base conceptual o blueprints de fases. Los antecedentes
fechados no se borran para convertirlos artificialmente en pruebas recientes.

Quedan fuera de una confirmación documental: ejecución en producción, sesión real
por cada perfil, pruebas de impresión en cada navegador, accesibilidad completa,
seguridad exhaustiva, SLA y rendimiento representativo, integraciones externas y
persistencia real de cada comando. Cualquier prueba nueva debe registrarse con
fecha y comando; no reutilizar conteos antiguos como aceptación de este corte.

### Antecedente de notas personales, etapa3 (27 octubre2026)

[58 API](../../api/Arquitectura/58-Notas-Etapa3-Interfaz-Personal.md): icono junto a campana, Drawer derecho, Home y orden nativa de Formalizacion; contenido propio y layout/PIN por dispositivo. Clientes tipados, reintentos con mismo identificador, conflictos explicitos y sin datos ficticios de fallback. En ese corte compartir/respuestas/campanita estaban pendientes; etapa4 las
implementó después. Copia legacy continúa pendiente. El corte vigente es16/66.

Correccion vigente de notas: [59 API](../../api/Arquitectura/59-Notas-Contexto-Opcional-y-Vistas.md). Creacion desde cualquier pantalla, personal por defecto, checkbox opcional para vista registrada/orden native o legacy; vincular no comparte. Contexto incluye source+id y siempre revalida acceso; sin URLs arbitrarias/imports.

Notas etapa4 implementada27octubre2026: [contrato60 API](../../api/Arquitectura/60-Notas-Etapa4-Colaboracion-y-Notificaciones.md), invitaciones, conversación y campana interna conectadas. Copia legacy sigue pendiente.

Estado vigente de notas 2026-10-28: [implementación realtime y límites](../../api/Arquitectura/62-Notas-Tiempo-Real-Implementacion.md). Provider único por sesión, campana y conversación actualizadas, preservación de borradores, lectura explícita y revocación. La invitación no concede acceso al registro: contexto restringido se recibe como null. Reconciliación REST al reconectar; copia legacy inactiva.

### Movimientos recientes personales — 2026-10-28

El Home de Formalización consulta `GET /formalization/home/recent-activity` para
mostrar las seis últimas acciones del usuario autenticado, con orden de venta,
acción, fecha y transición cuando exista. Requiere lectura efectiva de órdenes.
Actualiza al regresar al Home, recargar o guardar una acción; no consulta NetSuite.
Incluye carga, vacío y reintento. Las acciones sin bitácora no se inventan.
Pruebas enfocadas: 32 correctas. Contrato y evidencia de lectura real en
[resumen del Home API](../../api/Arquitectura/40-Formalizacion-Home-Resumen-y-Rendimiento.md).

### Inicio desde el detalle de una orden — 2026-10-28

Pulsar Inicio limpia los parámetros de la orden y reinicia únicamente la página
seleccionada, incluso si comparte pathname con el detalle. El shell y la sesión
permanecen montados; se mantienen los controles existentes de acceso por ruta.
La navegación compara pathname, query y hash para distinguir la ficha del Home.

### Resumen completo de bandejas — 2026-10-28

El listado de órdenes muestra diez tarjetas: total, aprobaciones, contratos,
por enviar, firma, banco, saldo, traspasos, traspaso firmado y cerradas este año.
Reutiliza los contadores del seguimiento y filtra cada tarjeta por las bandejas
autorizadas existentes. No agrega peticiones ni cambios de BD. Distribución de
cinco columnas en pantalla amplia y ajuste automático en pantallas menores.

### Retiro de Resumen y acceso a Catálogos — 2026-10-28

Por solicitud del propietario, Resumen se retira del menú y del registro de rutas
de Formalización. La URL anterior se trata como ruta inexistente. La maqueta
conservada en código no se publica en la navegación.

La migración `202610280050_formalization_catalog_access` inactiva exclusivamente
concesiones activas `formalizacion.catalog_*` de `formalizacion` y
`jefe_formalizaciones`, sin borrar definiciones, permisos de órdenes, otros roles
ni excepciones individuales. Owner mantiene su política. Los catálogos siguen
protegidos por su permiso de contexto en el API; el menú desaparece cuando no
hay una concesión efectiva. Una concesión independiente puede mantener acceso.

Aplicada solo en CRM_THINK_V2: lectura posterior confirma cero concesiones
activas de Catálogos en ambos roles y registro de la migración050. No se tocó
crmdatabase-api, órdenes ni NetSuite. En esta BD ya no había concesiones activas;
por eso no se alteraron versiones ni se generó un evento de cambio inexistente.
Cuando existen concesiones que revocar, se actualizan versiones y auditoría
junto con la revocación en una transacción.

### Resumen sin repetición de contratos — 2026-10-28

Sustituye la distribución de diez tarjetas: Contratos pendientes reúne sus dos
métricas, Por enviar y Pendientes de firma, y no vuelve a mostrar su suma ni
otras tarjetas separadas para esos mismos contadores. Total de órdenes y las
otras etapas se conservan. Ocho tarjetas en dos filas de cuatro en pantalla
amplia; ajuste responsive y permisos de cada bandeja preservados. Se reutiliza
la respuesta del API, sin consultas adicionales ni cambios de BD.

### Reinicio visual del Calendario — 2026-10-28

Por solicitud del propietario, Calendario de Formalización conserva únicamente
breadcrumb, título Calendario y subtítulo Tareas y reuniones. Se retiraron la
agenda de muestra, contador ficticio, navegación mensual, filtros y editor de
creación/edición. La ruta y sus controles de acceso existentes permanecen.
No consulta eventos ni habilita comandos, Outlook o Graph; no borra tablas ni
datos de calendario en ninguna BD. Sustituye las descripciones históricas de
la maqueta interactiva de Calendario.

### Calendario corporativo: FullCalendar — 2026-10-28

Selección para el stack React19/Vite: `@fullcalendar/react`7.1.3 y su peer
`temporal-polyfill`1.0.6, con versiones registradas en pnpm-lock.yaml. Las vistas
Mes, Semana, Día y Agenda usan los entrypoints nativos de v7, sin instalar los
paquetes de plugins separados de v6. Español, America/Costa_Rica y tema Monarch
adaptado a la superficie CRM; carga por la ruta lazy existente.

Se compararon FullCalendar Standard y Bryntum Calendar: ambos disponen de React
y pueden presentar datos de Outlook mediante Graph. FullCalendar se elige por
su integración React17–19, vistas estándar y licencia MIT comercial; las vistas
por recursos/timeline de FullCalendar Premium requieren licencia aparte.
Bryntum ofrece una alternativa comercial e instrucciones de integración Graph,
pero no se instaló ni se asumió una licencia de pago.

La integración Outlook es una responsabilidad distinta de la librería visual:
Microsoft Graph v1.0 ofrece eventos, asistentes, respuestas, recurrencias y
seguimiento incremental. En este CRM la futura autenticación/tokens y lectura o
escritura Graph deben quedar en el API BFF. Este corte solo muestra un calendario
vacío: sin solicitudes Graph/API, eventos ficticios, selección, arrastre, creación,
edición, asignaciones ni escrituras en BD. No acredita sincronización Outlook.

Referencias oficiales consultadas:
- https://fullcalendar.io/docs/react
- https://fullcalendar.io/license
- https://fullcalendar.io/pricing
- https://bryntum.com/blog/how-to-connect-and-sync-a-react-bryntum-calendar-to-a-microsoft-outlook-calendar/
- https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/delta-query-events

La prueba usa la librería real (sin sustituir su componente): cambia las cuatro
vistas, confirma agenda vacía y ausencia de solicitudes de red o controles de
creación/edición. Verificación visual del calendario vacío en navegador local.
