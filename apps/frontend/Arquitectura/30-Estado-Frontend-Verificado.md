# 30 - Estado frontend contrastado con el código - 2026-10-27

Cierre transversal y límites de verificación: [55 - Revisión documental integral](../../api/Arquitectura/55-Revision-Documental-Integral-20261027.md).

Este corte describe los archivos presentes, no una certificación de producción. Se
revisaron rutas, servicios, permisos, pantallas, carga/error, exportación y límites.
No se ejecutaron migraciones, consultas de BD, integraciones ni pruebas de negocio
para esta revisión documental. Los resultados QA fechados de 27/29 siguen siendo
históricos; no se presentan como pruebas ejecutadas hoy.

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
| `/home/formalization/calendar` y `/home/formalization/summary` | Simulaciones locales que siguen separadas de registros reales | Modelos preview, sin editor persistido de calendario |
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
`mercadeo.calendar.read` permanece para la opción visual Calendario: el menú no
contiene una `routePath` propia ni implementa un editor operativo.

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

`FormalizationHomePage.tsx` requiere rol efectivo activo `formalizacion` y allow
sin deny de `formalizacion.home.stages.read` para consumidores de etapas y
seguimiento. Aprobaciones conserva `formalizacion.home.approvals.read` separado.
Owner usa el perfil efectivo entregado por API, no un bypass local.

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
