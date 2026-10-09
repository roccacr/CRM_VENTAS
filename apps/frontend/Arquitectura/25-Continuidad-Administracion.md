# 25 - Continuidad de Administracion frontend

Fecha de corte: 2026-10-08. Guia de traspaso basada en archivos inspeccionados. Sustituye como entrada operativa los mapas iniciales 18/19; estos quedan como antecedentes de direccion. La ley de producto sigue siendo la autoridad de alcance.

## Producto y lenguaje

Rol asignado es un paquete de permisos; modulo habilitado es un contexto visible; permiso efectivo es el resultado de roles y overrides; catalogo es una vista compartida. Tener rol Formalizacion no obliga a tener rol Mercadeo para operar alli: se necesita modulo mercadeo activo y el permiso de esa accion.

Ejemplo: mercadeo.catalog_project.read permite leer Proyectos desde Mercadeo; no concede formalizacion.catalog_project.read. Un deny del segundo codigo afecta ese contexto. Los datos de Proyectos son los mismos para todos los modulos: la separacion es de acceso, no de registros.

## Implementacion y carpetas

| Responsabilidad | Archivos relativos a apps/frontend |
| --- | --- |
| Rutas privadas y workspaces | src/routes/app-routes.ts, AppRouteContent.tsx, auth-state.ts |
| Menu y filtro por permisos/modulos | src/modules/home/GlobalHomeShell.tsx |
| Sesion, auth y contratos | src/services/auth/auth-service.ts, identity-contracts.ts |
| HTTP BFF | src/services/api/api-client.ts |
| Origen API | src/config/frontend-env.ts |
| Usuarios | src/modules/administration/pages/SystemUsersPage.tsx |
| Tabla y SearchPanes | src/modules/administration/components/SystemUsersDataTable.tsx |
| Persistencia reutilizable | src/modules/administration/hooks/useDataTableSearchPanes.ts |
| Estado del directorio | hooks/useSystemUsersDirectory.ts, useSystemUsersUrlState.ts dentro de administration |
| Crear/editar y detalle | components/CreateSystemUserDrawer.tsx, UserDetailDrawer.tsx |
| Roles y acceso | src/modules/administration/pages/RolesSecurityPage.tsx |
| Auditoria | src/modules/administration/pages/SecurityAuditPage.tsx |
| Pagina compartida de catalogos | src/modules/administration/catalogs/CatalogItemsPage.tsx |
| Definiciones visibles | src/modules/administration/catalogs/catalog-definitions.ts |
| Contrato HTTP catalogos | src/services/catalogs/catalog-service.ts |

Runtime instalado: React, Vite, TypeScript, Ant Design y DataTables con SearchPanes/Select. TanStack Query, Zustand y Tailwind descritos en documentos iniciales son direccion futura; no figuran como dependencias runtime actuales. No introducirlos solo para hacer coincidir un blueprint.

## Rutas y contratos reales

| Vista | Ruta |
| --- | --- |
| Usuarios | /home/administration/users |
| Roles y seguridad | /home/administration/roles-security |
| Auditoria | /home/administration/audit-logs |
| Catalogo administrativo | /home/administration/catalogs/{codigo} |
| Catalogos operativos | /home/{sales,marketing,formalization,accounting}/catalogs/{codigo} |

Codigos: projects, campaigns, classes, brokers, files, subsidiaries, locations. Workspace -> modulo: sales -> ventas; marketing -> mercadeo; formalization -> formalizacion; accounting -> contabilidad; administration -> administration.

Each catalog page calls GET /catalogs/{code}/items with moduleCode and limit=100; subsequent explicit batches add offset. The API returns the authoritative filtered total, not just the batch length. Create/edit/status retain moduleCode in the body. The frontend consumes only canonical BFF responses and cookie sessions, never direct ERP calls or stored tokens.

SecurityAuditPage consume /identity/roles/security-catalog y sus auditEvents. No existe en esta pantalla un endpoint de auditoria independiente ni prueba de que muestre todos los eventos historicos de negocio. La ruta /home/administration/audit que aparecio en planes anteriores no es la registrada.

## Comportamiento administrativo construido

- Usuarios: directorio, detalle, crear/editar, roles/acceso y cambios de estado conectados mediante servicios HTTP. Confirmar cada accion en entorno real antes de cerrar.
- Exportar usuarios fue descartado por requerimiento: no reincorporarlo.
- Filtros de usuario: Usuario, Estado, Rol; tres columnas; iniciar contraidos; persistir busqueda/seleccion. El hook usa localStorage para estado de tabla, nunca para tokens.
- Revisar que abrir un pane no estire visualmente los cerrados y que refresh conserve seleccion efectiva.
- Menus de fila deben anclarse al disparador. Modales de auditoria deben quedar por encima del drawer, con foco y cierre correctos.
- Detalle: IDs propios y referencias externas disponibles; no inventar ID Odoo cuando no exista.
- Roles: separar resumen de roles, modulos y permisos; agrupaciones contraibles; catalogos compartidos dentro de cada modulo, sin tarjetas principales por cada catalogo.
- Catalogos: buscar, estados, crear, editar, inactivar/reactivar con motivo. No existe eliminacion fisica de valores.

## Limitaciones y deuda visible

1. Catalogs now support explicit incremental batches with offset and a real total. As in Users, DataTables search, SearchPanes, sorting and pagination operate locally on loaded rows. Loaded/total counts and Cargar más expose incomplete results; this is not full-dataset/server-side SearchPanes. Offset pagination is not a frozen snapshot under concurrent catalog mutations; refresh reloads from the beginning.
2. API y frontend mantienen definiciones separadas de catalogos. Hace falta contrato de metadata compartida o endpoint para evitar divergencia.
3. El formulario actual ofrece IDs NetSuite/Odoo y construye referencias desde esos dos campos. El backend admite sistemas activos genericos (hasta 12 referencias por payload); no hay editor dinamico de N proveedores en UI. Editar un valor con otros proveedores requiere revisar preservacion para no omitirlos.
4. Ant Design reporto advertencias de message/Notification en el chat. No declarar resueltas sin reproducirlas y revisar uso de contexto App.
5. Rutas home operativas e integraciones pueden ser placeholders: registrar una ruta no acredita modulo comercial terminado.
6. Tests de pagina de catalogos usan mocks del servicio. Acreditan parametros y render, no una base real.

## QA reproducible

### Shared catalog SearchPanes - 2026-10-09

All seven catalog routes use CatalogItemsDataTable with the users module's installed DataTables/SearchPanes/Select stack, useDataTableSearchPanes hook and SystemUsersPage stylesheet. No separate SearchPanel component existed. Name, external references and status have dedicated panes, initially collapsed, with the same clear/expand/collapse controls, search field, page-length menu and pagination. The old Ant Design search/status toolbar is removed rather than duplicated.

Saved state uses rocca.{module}.catalogs.{catalog}.datatable.v1, isolated from Users and other catalog/context screens. Canonical data is rendered through React slots to avoid interpolating untrusted text into HTML. Row actions retain their own behavior; clicking or keyboard-selecting a row opens the existing drawer. Batch requests are deduplicated, preserve loaded rows on failure and ignore obsolete responses after context changes. Loading disables row selection; no automatic download of thousands of complete property records occurs.

The ETL plan, dated source inventory, signed-ID decision and unresolved broker/subsidiary/Files mappings are centralized in API document 34. UI implementation is not evidence that a data migration was executed.

### Shared catalog detail drawer - 2026-10-08

All seven catalog views and their operational contexts reuse `CatalogItemsPage` and `CatalogItemDetailDrawer`. Clicking a non-interactive row area, or pressing Enter/Space on its focused row, opens the same Administration drawer pattern used for user details. Row action menus do not open the drawer. Edit and status actions reuse the existing audited modal flows; backend authorization and HTTP contracts are unchanged.

The panel displays all fields currently returned by the catalog contract: name, detail, CRM public ID, native code, status, last update, and each external reference's system name/code, identifier and status. NetSuite and Odoo remain visible using the provider definitions shared with the editor; missing identifiers/status and empty optional detail show `Sin asignar`. These are display-only placeholders, not fabricated domain references or mutation payloads. Additional API-returned providers remain visible. Empty identifiers have no copy action. Null/omitted optional detail and reference collections retain the existing client normalization; malformed assigned reference payloads still fail validation instead of being disguised as missing data. Actor history and reference metadata are not fabricated. No new detail endpoint was added.

Details use the current loaded list response. Refresh reloads the existing scoped list; loading hides stale content/actions, errors offer retry, and a record absent from the current result shows an unavailable state. A sequence guard discards responses from obsolete contexts. Selection is scoped to the catalog and module. Explicit batch loading now replaces the former 100-row cutoff; drawer navigation traverses loaded rows, independently of local DataTables filters.

The drawer directly reuses the Users detail stylesheet and component hierarchy: identity header, gray body with small titled cards, horizontal label/value descriptions, code identifiers, and position/navigation/edit/primary-status footer. Each reference provider has its own top-level titled card (NetSuite, Odoo, and any additional returned system); fields from different providers never share a card. Multiple references for one system stay together in that provider's card. The card title identifies the provider, replacing the redundant system-name field. Reference status remains the API-returned reference status, not an inferred synchronization state. Catalog-specific content replaces user-only fields; no user permissions or security fields are fabricated. Previous/next buttons and Up/Down keys traverse the loaded catalog result. Keyboard handling stays inside the drawer so an overlaid edit modal does not change selection. Shared footer wrapping and mobile touch targets apply equally to Users and catalogs.

Administration sizing, mask, close placement and modal layering are preserved; width is capped at the viewport. The body scrolls independently, long identifiers wrap, and mobile controls have 44px targets. The table scrolls horizontally within its own container on narrow screens. Tests cover all seven definitions, shared hierarchy, record navigation, keyboard selection, row-action isolation, refresh/loading/error/retry, updated data, empty references, edit handoff, missing records and closing. This change does not close broader Administration acceptance.

Ejecutar pnpm check desde apps/frontend. Tests en test/; no en src/. Referencias: test/administration/SystemUsersPage.spec.tsx, RolesSecurityPage.spec.tsx; test/catalogs/CatalogItemsPage.spec.tsx, catalog-service.spec.ts; test/home/navigation-permissions.spec.tsx; test/app/App.spec.tsx y test/auth/.

Manual validation per catalog: sign in as Owner, verify moduleCode/limit/offset in Network, search, select/clear/expand/collapse panes, change page/page length, refresh and verify isolated saved state. Where total exceeds loaded rows, load another batch and verify counts. Create/edit/inactivate/reactivate only disposable authorized test records, preserving references and audit reasons. Record responses, audit events and results.

Con usuario operativo: Mercadeo permitido, Formalizacion prohibida; URL directa tambien prohibida; permiso sin modulo prohibido; deny oculta solo su contexto. El backend debe rechazar la misma operacion aunque se fabrique el request.

Usuarios: buscar/seleccionar/refrescar; abrir detalle; editar nombre/correo/roles; probar estados; duplicados y motivo invalido; comprobar menu y modal sobre drawer. No modificar personas reales como prueba sin autorizacion.

## Continuidad

1. Cerrar riesgos backend del documento 34, especialmente referencias y migraciones.
2. Completar QA Owner y operativo con evidencia Network.
3. Cubrir CRUD real y auditoria; considerar Playwright con fixtures aislados.
4. Consolidar metadata de catalogos y editor de proveedores.
5. Cerrar Administracion; luego contrato de entrada Leads NetSuite -> API.
6. Construir UI Leads solo con contrato y fase aprobados.

Ver [cierre API](../../api/Arquitectura/34-Cierre-Operativo-Administracion-P0-S1.md) para decisiones, migraciones, preguntas y registro de pruebas.
