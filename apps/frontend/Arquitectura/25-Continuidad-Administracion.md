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

### Projects-only presentation refinement - 2026-10-09

The projects catalog opts into `ProjectsView.css` and explicit table/drawer variants. Other catalogs and Users retain their existing presentation; global navigation, theme, API contracts, authorization and audited mutation flows are unchanged. The existing DataTables/SearchPanes engine, saved-state keys, column indices and batch loading remain authoritative.

The table prioritizes project names over internal codes, retains native-code searching, displays descriptions and the API last-update date, and separates NetSuite/Odoo identifiers with explicit `Sin asignar` placeholders. Additional returned providers remain visible. Internal CRM/native identifiers remain copyable in the drawer. Reference status is not presented as a fabricated synchronization status. Provider cards are siblings, never nested or mixed.

Design foundations: existing Aptos/system typography and Administration colors, 4px spacing cadence, restrained borders, 8px card radii, 140ms row feedback, visible keyboard focus and reduced-motion support. Narrow screens stack filter panes and drawer labels; the table owns horizontal scrolling and the drawer body owns vertical scrolling. Mobile drawer actions and table action buttons have 44px targets.

All ten requested design skills were available locally and inspected. Product-interface, responsive, interaction and design-token guidance applies; marketing-only prescriptions (oversized typography, pill navigation, gradients and excessive whitespace) are excluded. The read-only `improve-ui` workflow informed the inspection only; implementation follows the owner's explicit authorization.

Regression tests explicitly compare all seven catalog definitions so the projects variant cannot silently propagate to sibling catalogs. Existing drawer keyboard, provider fallback, loading/error/retry, row-action isolation and audited editor tests remain in the focused suite. Automated checks and browser evidence are reported separately from database migration and broader Administration acceptance.

Verification: test-first failure observed, then 26 focused catalog tests passed. The final sequential `check-all.cmd` passed formatting, lint, typechecking, tests and builds: API 227 passed / 12 opt-in database tests skipped; frontend 127 passed. The existing bundle-size warning remains non-blocking. Chrome validation covered desktop, 390px and 320px widths, search/empty results, pane selection/clearing/expand/collapse, page length/pagination, row selection, drawer navigation, provider fallbacks, independent scrolling and edit/cancel without persistence. No console warnings/errors were captured. Desktop/mobile screenshots are stored outside the repository under the task visualization directory; no production records were changed. Real-device testing and broader Administration acceptance remain separate.

### Dashboard-design precedence refinement - 2026-10-09

Pre-flight changes were committed and pushed as `65c4245` on `temp/crm-tink-api-frontend-inicial` before installation or implementation. The authorized `npx skillfish add arnavpuri/designskills dashboard-design` command installed the skill from upstream revision `9929d1543bd248de53d7dc7f879dcc4fd0238ebd`. Its instructions were inspected and made available in the configured Codex skill root. `dashboard-design` takes precedence over overlapping design skills; existing Administration tokens and product contracts remain authoritative. No dependencies were added to the application.

Projects map existing colors, Aptos/system typography, 4px spacing and 8px radii into local tokens. Desktop/tablet tables have solid sticky headers, contained scrolling and unbroken status badges. Below 768px, the same filtered/paginated DataTables rows become labeled cards; this supersedes the earlier projects-only mobile horizontal-table presentation. A mobile sort selector controls and reflects the existing table order, preserving saved state without introducing a second list engine. Initial loading reserves skeleton space. Missing provider placeholders participate in global search, while SearchPanes retain their existing reference labels. Provider cards remain separate, with semantic reference-status badges and explicit unassigned values; no synchronization state is inferred.

Scope remains projects only. Other catalog variants are covered by isolation assertions; global navigation, Users, API contracts, authorization, database records and audited mutations were not changed. KPI/chart/sidebar prescriptions are inapplicable to this catalog workflow and were not introduced.

Verification: failing regressions were observed before implementation. The final sequential `check-all.cmd` passed formatting, lint, typechecking, tests and builds: API 227 passed / 12 opt-in database tests skipped; frontend 132 passed, including 31 focused catalog tests. The existing bundle-size warning remains. A subsequent tablet status-width CSS adjustment was included in the successful build; formatting was checked again afterward. No claim of complete branch coverage is made. Browser checks covered 320px, 390x844, 768x1024 and 1440x900: no page-level horizontal overflow at narrow widths, sticky table headers, mobile sorting, provider search, filter selection/clearing/expand/collapse, page length/pagination, keyboard drawer selection, row-action isolation, provider fallbacks and independently scrolling drawer body. No console warnings/errors were captured. Screenshots are stored outside the repository in the task visualization directory with the `dashboard-projects-` prefix. No production data was modified; real-device and broader Administration acceptance remain separate. This refinement is local and is not included in the pre-flight commit.

### Installed skill finalization - 2026-10-09

The seven requested upstream skill packages are installed locally and globally; [the versioned registry](../../../SKILLS.md) records exact sources, revisions, packaged-file hash checks, backup location and applicability. Root AGENTS.md links the registry. Local skill packages remain ignored under the existing repository policy. Global discovery refreshes on the next Codex turn; relevant instructions were read directly for this task. `dashboard-design` retains precedence within design guidance, subordinate to product law and engineering constraints. Wizard/diagram generation, Stitch conversion and unsupported KPI dashboards were not forced into the catalog workflow.

The projects-only finalization preserves the current table/drawer implementation and adds an icon-only, tooltip-labeled list refresh control that reuses the scoped loader, is disabled during requests/mutations, and permits recovery after an initial list error. The list exposes `aria-busy` during initial and batch requests. Local CSS improves refresh/focus targets, selection/caret colors, scroll styling, independent drawer overscroll, sticky-header scroll padding and reduced-motion handling for skeleton/refresh animations. Mobile filter panes use an 8px gap and explicitly override the vendor's important top margin; other catalog and Users styles are unchanged. Provider cards, fallback values, contracts, audit operations and permissions remain intact.

Verification: two expected failing tests were observed first, followed by 32 focused catalog tests passing. The sequential root check passed API formatting/lint/typecheck/tests/build (227 passed, 12 opt-in database tests skipped) and frontend formatting/lint/typecheck/tests/build (133 passed). After the final CSS correction, frontend formatting and typecheck/build passed again. The existing bundle-size warning remains. Impeccable context ran successfully; its single mechanical detector pass returned no findings. Browser checks confirmed list refresh, busy-state completion, 390px width without page overflow, 8px pane gap/zero vendor margins, keyboard detail opening, and visible NetSuite/Odoo fallback fields. Desktop/mobile visual inspection was performed; screenshots use the `skills-projects-` prefix in the task visualization directory. This is not real-device, full accessibility certification, database CRUD/ETL or complete Administration acceptance. No database changes, dependency changes, commit or push were performed in this task.

### Projects clipping correction and enterprise palette - 2026-10-09

The first-row clipping was reproduced in Chrome at scrollTop zero: the sticky header ended at 543.875px while the first row began at 511.40625px. DataTables' flex layout centered its oversized table inside the 640px scroll container, moving content above the reachable scroll origin. The projects-only scroll row now uses `align-items: flex-start` and zero block margins. The existing opaque sticky header and z-index remain unchanged; raising z-index would not fix the negative origin.

`ProjectsView.css` also introduces local muted steel/teal accents, pale neutral filter/header bands, deliberate row/card borders and separate provider cards. Primary action colors remain scoped to projects; disabled and destructive AntD button semantics are preserved. Shared navigation, other catalogs, Users, API contracts, permissions, database records and audited mutations are unchanged.

Browser regression evidence: the failing geometry assertion passed after the correction with 10 and 25 rows, and at the 768px tablet breakpoint. At 390px the existing card presentation fits the viewport; the 390px drawer has an independently scrolling body (636px client height / 970px content height) and distinct NetSuite/Odoo sections with explicit unassigned values. Search, mobile sorting and pagination were exercised. No browser console warnings/errors were captured. Key contrast ratios: muted header text 5.26:1, white/primary action 7.00:1 and body text/white 12.04:1. This is not a full accessibility certification. Screenshots use the `projects-overlap-fixed-` prefix in the task visualization directory.

The root `check-all.cmd` passed formatting, lint, typecheck, tests and builds: API 227 passed / 12 opt-in database tests skipped; frontend 133 passed. The existing bundle-size warning remains. An earlier focused run timed out in the detail refresh/retry test; the subsequent full suite passed that test, followed by an isolated catalog rerun with all 37 tests passing. Geometry checks are real-browser probes, not persistent automated layout tests or evidence of complete coverage. Real-device and broader Administration acceptance remain separate. No dependencies, commit, push or database changes were made.

### Projects section hierarchy and forms - 2026-10-09

Projects now use separate full-width search, filter and table bands with 16px separation. The DataTables layout API supplies the search-row class; SearchPanes still owns selections, clear/expand/collapse and the active-filter count. Its action row has a counter aligned left, grouped buttons with an 8px cadence, and a divider above the panes. The table and pagination footer have their own restrained border/background treatment. The top-aligned scroll container and opaque sticky header correction remain intact.

Create/Edit opt into the same local palette as the drawer through `catalog-items-modal--projects`. Semantic fieldsets group record information, NetSuite, Odoo and audit reason; section headers, 16px content spacing and 24px desktop/16px mobile shell spacing match the detail cards. Provider fields stack on mobile. Modal content scrolls independently while header/footer remain outside that scroll area. The installed AntD 6 `ant-modal-container` is styled explicitly; other catalogs retain their existing form hierarchy. Validation rules, optional-reference omission, audit requirements, payloads and persistence flows are unchanged.

Verification: the new grouping regression failed before implementation; all 38 focused catalog tests subsequently passed. Browser checks confirmed filter count 0 -> 1 -> 0 with select/clear, separate section bounds with 16px gaps, a first row beginning exactly below the sticky header, prefilled NetSuite/empty Odoo in Edit, and the 390px Create modal fitting at 358px with an independently scrolling body (549px client height / 878px content height). Screenshots use `projects-sections-` in the task visualization directory. No live form was submitted and no database records were changed. Browser layout evidence is separate from unit coverage; no complete coverage or real-device certification is claimed.

Final sequential `check-all.cmd`: formatting, lint, typecheck, tests and builds passed; API 227 passed / 12 opt-in database tests skipped, frontend 134 passed. The initial check caught an unsupported Testing Library option in the new test; it was corrected before the successful rerun. The existing bundle-size warning remains. Changes remain local, with no dependency changes, commit or push.

### Projects palette and icon consistency - 2026-10-09

Projects-only tokens now pair neutral gray surfaces with sapphire actions (#2856a3), darker hover/pressed states (#204580), and existing emerald/amber status semantics. Control borders have a separate contrast token (#7b8492); decorative dividers remain subtle. Create/Edit inputs and keyboard focus reuse these tokens. Global navigation and other catalogs are unchanged.

Root cause: the global page-header rule explicitly colored button icons gray, overriding inherited white text. A projects-scoped rule now makes AntD icons inherit the control color at a consistent 16px size, preserving the library's SVG fill/stroke geometry and disabled/destructive states. Browser computed styles confirm white button text, icon and SVG fill on the sapphire create action, plus matching drawer action/icon colors. At 390px the drawer fits the viewport and action/icon inheritance still matches. Screenshots use the `projects-palette-` prefix in the task visualization directory.

Eight regression assertions read the actual stylesheet tokens and check selected WCAG contrast thresholds (4.5:1 text, 3:1 controls/focus). The missing control-border assertion failed before the CSS correction; the focused run passed 41 tests. Enabled SearchPanes icons override inherited 60% opacity locally; disabled controls retain their existing treatment. This is targeted contrast evidence, not full WCAG certification or physical-monitor/high-glare testing. No records were changed and no form was submitted.

Final sequential `check-all.cmd` passed formatting, lint, typecheck, tests and builds: API 227 passed / 12 opt-in database tests skipped; frontend 142 passed. The initial run exposed lint violations in the new contrast test, corrected before this successful run. The existing bundle-size warning remains. No dependencies, commit or push were performed.

### Projects filter toolbar alignment / Alineacion de filtros - 2026-10-09

EN: Projects reuse the existing SearchPanes controls in one labeled toolbar: the live filter-count badge and Clear are grouped left; Expand/Collapse remain right. Desktop (1100px and above) filter tracks derive from the rendered five-column table, with empty Description/Actions positions rather than inventing filters. A ResizeObserver updates measurements on resize and disconnects on teardown; table draws also refresh alignment. Filter wrappers use the same 16px inset as table cells. Compact screens retain adaptive filter grouping, with stacked filters and a two-row toolbar below 768px; mobile toolbar buttons are 44px high. Search has a full-width header band and consistent inset. Existing neutral/sapphire tokens, semantic status colors, persisted state, pagination and drawer behavior remain unchanged. Raster search/sort glyphs retain their geometry with consistent size and softer idle weight.

ES: Proyectos reutiliza los controles de SearchPanes en una barra unificada: indicador y Limpiar a la izquierda; Expandir/Contraer a la derecha. En escritorio los filtros se alinean con las columnas reales; en pantallas compactas mantienen una distribucion adaptable. No cambian contratos, datos, permisos ni otros catalogos.

Verification: the new measured-column regression failed before implementation; 42 focused catalog/palette tests passed afterwards. Browser checks at default desktop and 1280px measured zero horizontal-position/width difference for all three filter tracks against their corresponding headers. Selecting Activo changed the counter 0 -> 1 and filtered 35 records to 21; Clear restored 0 and the full set. At 390px controls fit in two rows with 44px button heights; 768px uses compact grouping and horizontal table scrolling. Screenshots use `projects-toolbar-`. No captured console warnings/errors, database mutations, dependency changes, commit or push. Browser evidence is separate from persistent geometry-unit coverage and is not full accessibility certification.

Final verification / Verificacion final: sequential `check-all.cmd` passed formatting, lint, typecheck, tests and builds; API 227 passed / 12 opt-in database tests skipped, frontend 143 passed. The initial complexity-lint failure was corrected before this successful rerun. The existing bundle-size warning remains.

### Projects Bunker palette / Paleta Bunker de Proyectos - 2026-10-09

EN: The owner-supplied screenshot scale replaces the earlier sapphire recommendation for Projects only: 50 #f5f7fa, 100 #ebeef3, 200 #d2dae5, 300 #abbbce, 400 #7d96b3, 500 #5d799a, 600 #496180, 700 #3c4f68, 800 #354357, 900 #2f3a4b, 950 #0e1116. Primary actions use 950 with white text/icons and 900 on hover/pressed; muted text/focus use 600, control borders 500 and decorative dividers 200. Page, provider cards, drawer, create/edit and status modals share the scoped tokens. Status green/amber and destructive red are intentionally retained. The leading plus is 16px, inherits white, and is vertically centered. The header action is now Nuevo proyecto; sibling catalogs retain Nuevo valor. The existing header helper groups refresh/create actions without changing their behavior or adding a new abstraction.

ES: La paleta Bunker de la imagen sustituye el azul zafiro solo en Proyectos. La accion principal se llama Nuevo proyecto, con fondo oscuro e icono/texto blancos. Pagina, detalle y modales comparten los mismos tokens; se conservan los colores semanticos de estado y peligro. No se modifican la navegacion global, contratos, permisos ni persistencia.

Verification: three palette regressions verify every supplied scale color across page/drawer/modal roots; label regressions also protect sibling catalogs. Five assertions failed against the prior implementation, then all 45 focused tests passed. Eight selected contrast checks remain passing: white/950 18.91:1, white/900 11.49:1, 600/100 5.46:1 and control-border/50 4.19:1. Browser checks confirmed actual resting/hover/icon colors, create/edit fields with NetSuite 11 and empty Odoo, status-modal theme, and a 390px drawer fitting the viewport. A lazy shared drawer stylesheet initially overrode the canvas; a projects-only specificity correction restored #f5f7fa. Screenshots use `projects-bunker-`. Forms were canceled without submitting mutations. These checks do not certify full WCAG compliance or physical-monitor performance.

Final checks / Verificacion final: `check-all.cmd` passed formatting, lint, typecheck, API/frontend tests and both builds; frontend 146 passed, API 227 passed / 12 opt-in database tests skipped. The initial page-complexity lint failure was resolved by extending the existing header helper before the successful rerun. Browser console checks captured no warnings/errors. The existing bundle-size warning remains. No dependency changes, database writes, commit or push were performed.

## Projects Compact Density / Densidad Compacta (2026-10-09)

EN: Supersedes the earlier two-row filter layout. Both the projects desktop grid override and SearchPanes' important narrow-mode column rule caused stacking. Projects now keeps search and tools inline, reserves State column space, and retains measured column-to-filter alignment. Body/form text is 13px, main heading 22px, modal/drawer titles 18px, card headers 40px, and outer modal/drawer padding 16px. Mobile retains larger touch targets and stacked filter groups rather than forcing a desktop-width page.

ES: Sustituye el diseño anterior de filtros en dos filas. Se corrigen la cuadrícula de escritorio y la regla de columna del modo estrecho de SearchPanes; búsqueda y herramientas permanecen en línea. Se conserva la alineación con columnas, la paleta Bunker, los filtros, contratos y permisos. La densidad compacta se limita a Proyectos.

Verification: the new regression failed before implementation (16px instead of 13px); 46 focused tests then passed. Browser geometry at 1920/1280/390px showed no horizontal document overflow; desktop filter wrappers measured 39px and mobile 48px without internal overflow. Create/Edit titles and form typography were inspected without submitting mutations. Screenshot: `projects-compact-desktop.png`. No database writes, dependency changes, commit or push.

Final checks: `check-all.cmd` passed format, lint, typecheck, tests and builds. Frontend: 147 passed. API: 227 passed, 12 opt-in database tests skipped. Existing bundle-size warning remains; this UI task does not establish database or full accessibility certification.

## Projects Structured Loading / Carga Estructurada (2026-10-09)

EN: Replaced the five-line paragraph loader with Ant Design Skeleton.Node placeholders for the 440px search, action toolbar, three filters, five-column header, eight rows and pagination footer. Desktop table space is reserved at 640px; filters follow the Projects column proportions and existing responsive breakpoints. Bunker neutral-100/200 drive a 1.8-second shimmer, disabled for reduced-motion preferences. The redundant generic loading message is suppressed only for Projects. Existing populated-table refresh behavior and other catalogs remain unchanged.

ES: La carga de Proyectos ahora reproduce la estructura de búsqueda, filtros y tabla, con ocho filas y animación suave que respeta movimiento reducido. No se modifican otros catálogos ni contratos de datos.

TDD: the new structural assertions failed against the paragraph skeleton, then the 46 focused regressions passed. Additional regressions cover pending-to-data replacement and isolation from sibling catalogs. Integrated Codex preview opened at localhost; authentication is required before visual loading/CLS verification. No external browser was opened, and zero layout shift is not yet established by browser measurements.

Loading verification: `check-all.cmd` passed formatting, lint, typecheck, tests and both builds. Frontend: 149 passed. API: 227 passed / 12 opt-in database tests skipped. Existing bundle-size warning remains. Integrated visual verification remains pending login; no database mutations or dependencies were introduced.

## Projects Color Contract Adoption (2026-10-09)

The binding palette and design-system rules are now defined in [26 - Projects Design System](26-Projects-Design-System.md), linked from the architecture index and frontend AGENTS.md. All eleven primitives have exact values, functional roles, component mappings and accessibility constraints. Contrast takes precedence where shade 300/400/500 cannot meet the intended text/control requirement. Current hierarchy differences are explicitly recorded; this documentation change does not claim runtime conformance or change shared components.

Verification: existing palette suite passed all 12 tests. Independent WCAG luminance calculations verified the documented contrast pairs. No runtime code, dependencies, database records, Git commit or push changed in this documentation task. Full build/test pipeline was not rerun because runtime files were unchanged. Integrated browser verification remains pending login.

ES: Paleta formalizada como contrato obligatorio de Proyectos, con roles y excepciones accesibles. Se preserva el alcance local y se registran las diferencias actuales sin afirmar cumplimiento total.

## Projects Ultralight Loading (2026-10-09)

EN: Supersedes the eight-row shimmer design. Projects initial loading now uses five airy rows with short 8px bars instead of dense full-width blocks, while retaining the reserved desktop table space. Search/filter placeholders are slender within their existing section heights. Drawer loading uses five label/value pairs (6px label, 8px value) with whitespace. Both use only the official light neutral tokens and a two-second 15-20% opacity pulse; reduced-motion disables animation. Other catalog loaders and modal mutation/loading behavior are unchanged. No artificial request delay or authentication bypass was introduced.

ES: Carga ligera con cinco filas y pares etiqueta/valor en el detalle. Se conservan la paleta oficial, el espacio reservado y el movimiento reducido; otros catalogos y operaciones de modales permanecen intactos.

TDD: two structural regressions failed against the prior loader before implementation. Integrated Codex preview still shows login, so visual smoothness and zero flicker/CLS are not certified. Browser authentication is required to complete that verification.

Ultralight verification: 49 focused regressions passed. Final `check-all.cmd` passed formatting, lint, strict types, tests and both builds: frontend 150 passed; API 227 passed / 12 opt-in database tests skipped. Earlier import ordering, exact-optional typing and complexity lint failures were corrected before the passing run. Existing bundle-size warning remains. No database writes, dependency changes, commit or push were performed.

## Projects Consolidated Filter Group (2026-10-09)

EN: Replaced the five-track desktop filter placement (columns 1/3/4 with empty gaps) with one contiguous three-track group. Filters share equal flexible widths, 16px gaps, common padding and inline control baselines. Mobile retains one-column containment. Loading placeholders follow the same grouping. Official surfaces/dividers and accessible input boundaries remain unchanged; SearchPanes behavior, persistence and other catalogs are preserved. Earlier measured table-column alignment is superseded for filter presentation.

ES: Filtros agrupados en tres columnas contiguas, con anchos proporcionales y espaciado uniforme; en movil se conserva una columna sin desbordamiento.

TDD: the new contiguous-grid regression failed before the CSS correction. Integrated visual validation remains pending login; no external browser, database mutations or dependency changes.

Filter-group verification: 50 focused tests passed, then `check-all.cmd` passed formatting, lint, typecheck, tests and both builds. Frontend: 151 passed. Existing bundle-size warning remains. `git diff --check` passed. Integrated visual verification remains pending authentication; no commit or push was performed.

## Projects Centered Enterprise Loader (2026-10-09)

EN: Replaces the initial table skeleton with a centered 34px, 2px ring on white, a 200 border and 400px minimum canvas height. Messages: `Cargando proyectos...` and `Sincronizando registros y catálogo CRM`. The accent uses approved 600; the caption also uses 600 rather than inaccessible small text in 400. Once loading resolves, the outgoing indicator stays mounted for a 400ms opacity fade while data reveals with a 4px glide. The timeout only handles presentation, is cleared on unmount, and does not delay requests. Populated refreshes keep the existing grid mounted. Reduced-motion disables rotation, fade and glide. Drawer skeleton and other catalog behavior remain unchanged. Zero CLS is not certified: final content height depends on records and viewport.

ES: Loader central de Proyectos con mensaje de dos niveles y transicion suave, respetando paleta, contraste y movimiento reducido. No cambia el detalle ni otros catalogos.

Centered-loader verification: the initial-loader regression failed before implementation; all 50 focused tests subsequently passed. Final `check-all.cmd` passed formatting, lint, typecheck, tests and both builds, including 151 frontend tests. Existing bundle-size warning remains. Integrated preview is still unauthenticated, so visual crossfade and layout-shift measurements remain pending. No external browser, database writes, dependency changes, commit or push were performed.

## Continuidad

### Navigation Enterprise Styling (2026-10-09)

EN: Owner-authorized adoption of document 26 for navigation only. Scoped header/menu/mobile aliases use the established neutral palette and typography; menu/popover corners and option spacing are normalized. Existing routes, permission visibility, viewport-aware dropdowns and mobile mechanics are preserved. No backend, authentication or content-module behavior changed. Thirteen focused navigation tests passed. Production deployment is not independently verified; the earlier Git push is not deployment evidence.

ES: Navegacion adaptada al lenguaje visual establecido, sin modificar rutas, permisos ni contenido de otros modulos.

Integrated local preview: authenticated Administration menu inspected on desktop and at 390px. Catalog dropdown and mobile catalog accordion open with expected entries; mobile drawer closes and viewport override was reset. Desktop screenshot captured. This is a limited local visual check, not production deployment evidence or exhaustive accessibility/device certification.

Verification: `check-all.cmd` passed formatting, lint, typecheck, tests and both builds; frontend 153 passed. Thirteen focused navigation tests passed. Existing bundle-size warning remains. `git diff --check` passed. No commit, push, database mutation or deployment performed for this navigation change.

### Consolidated UX Reference (2026-10-09)

EN: Expanded document 26 into a standalone Enterprise UX Rules and Replication Guide. Covers the complete palette, accessible overrides, fonts/density, spacing, page/search/filter hierarchy, table/mobile cards, drawer/provider separation, forms/status dialogs, icons, loading lifecycle, reduced motion and acceptance checklist. Includes a copyable implementation brief, source traceability and explicit current deviations; preserves the existing color contract rather than creating a competing document. Documentation only; no runtime changes or new test execution are claimed. Previous runtime results are labeled historical. Authenticated visual validation remains pending.

ES: Documento 26 consolidado como referencia unica de UX para replicar el diseno sin depender del historial de la conversacion. Incluye reglas, implementacion, estados y limitaciones verificables.

Documentation verification: 13 required topic sections and 11 source references verified; relative links in documents 00/25/26 resolve. `git diff --check` passed. Runtime tests/build were not rerun for this documentation-only update.

### Projects Mobile Card Layout (2026-10-09)

EN: Mobile rows retain the existing DataTables records, filtering, pagination and actions. A flexible title track shares its header with adjacent status/action tracks. Description and integration metadata stack label above value with light dividers; provider references wrap as compact groups. Long titles and identifiers can break within available width. Existing 16px padding, 44px touch targets and 8px design-system corners remain. Meaningful small labels use accessible neutral 600 rather than 400. Desktop and other catalogs are unchanged.

ES: Tarjetas moviles con titulo adaptable, estado y acciones alineados; campos verticales y referencias ajustables. Se conservan comportamiento, paleta accesible y alcance exclusivo de Proyectos.

TDD: mobile structural regression failed against the previous two-track layout, then all 51 focused tests passed. Integrated visual verification remains pending login; CSS assertions do not certify pixel-level rendering or zero overflow on devices.

Verification: final `check-all.cmd` passed formatting, lint, typecheck, tests and both builds: frontend 152 passed; API 227 passed / 12 opt-in tests skipped. An initial frontend formatting failure was corrected with Prettier only. Existing bundle-size warning remains. `git diff --check` passed. No database changes, dependencies, commit or push.

### Roles and Security Visual Adoption (2026-10-09)

EN: Scoped `RolesSecurityPage.css` adopts Projects neutral tokens, compact type,
consistent panel/dialog chrome, keyboard focus and mobile touch targets. A tablet
preview exposed module-name/count collisions; the module grid now uses two columns
at 1280px and one at 900px. Permission persistence and authorization are unchanged.

ES: Misma base visual de Proyectos aplicada a Roles y seguridad. Verificacion
local en el panel integrado: escritorio/tablet, movil de 390px y dialogo de
renombrado, cerrado sin guardar. No se modificaron accesos durante la revision.

Verification: `check-all.cmd` passed format, lint, typecheck and both builds;
frontend 154 tests passed, API 227 passed / 12 opt-in tests skipped. Existing
bundle-size warning remains. Visual evidence is local, not production or a full
WCAG/security acceptance audit. No database changes, dependencies, commit or push.

### Campaigns Design Replication (2026-10-09)

EN: Campaigns opts into the existing Projects presentation rather than copying
CSS/components. Domain labels, loader, accessible filter toolbar and mobile sorting
use campaign text. Campaign-specific API context and preference key are preserved.
Regression coverage includes populated rows, drawer/edit fields, optional provider
groups and a signed NetSuite identifier (`-5`). No migrations or mutations performed.

ES: Vista integrada revisada en escritorio y movil de 390px; formulario de alta
cerrado sin guardar. El API devolvio una lista vacia: la tabla poblada y el Drawer
se verifican con fixtures automatizados, no con datos reales en el navegador.

Verification: frontend format/lint/typecheck, 156 tests and production build passed;
API format/lint/typecheck, 227 tests and build passed, with 12 opt-in tests skipped.
An initial complexity failure was resolved by shared presentation metadata; a new
table assertion was corrected to await asynchronous React cell rendering.
The existing bundle-size warning remains. No commit, push or deployment performed.

1. Cerrar riesgos backend del documento 34, especialmente referencias y migraciones.
2. Completar QA Owner y operativo con evidencia Network.
3. Cubrir CRUD real y auditoria; considerar Playwright con fixtures aislados.
4. Consolidar metadata de catalogos y editor de proveedores.
5. Cerrar Administracion; luego contrato de entrada Leads NetSuite -> API.
6. Construir UI Leads solo con contrato y fase aprobados.

Ver [cierre API](../../api/Arquitectura/34-Cierre-Operativo-Administracion-P0-S1.md) para decisiones, migraciones, preguntas y registro de pruebas.
# Projects Editing Continuity - 2026-10-09

Navigation breakpoint correction, 2026-10-12: global menu dropdowns use viewport-fixed coordinates, bounded by 16px viewport gutters and the remaining height. Resize and captured scroll events re-anchor the panel to its trigger. Tablet horizontal scrolling remains; the track mask is removed because it clips descendant dropdowns. Do not revert dropdowns to absolute positioning inside the clipped tablet track. Existing keyboard, blur, pointer tolerance, permissions and mobile drawer behavior remain unchanged.

Projects palette alignment, 2026-10-12: owner requested full Bunker-scale adherence for the Projects page, filters, buttons, row actions, drawer and forms only. Applied the 700/800/900 hierarchy recorded in document 26, a scoped `PROJECTS_THEME` with `esES` locale (removes English `(optional)`), and a scoped class for the row action dropdown portal. Verification: focused Projects suites 58 passed; frontend format/lint/typecheck, 162 tests and build passed (existing bundle-size warning). Repository `check-all.cmd` stopped earlier at API lint: 7 pre-existing `jsdoc/require-jsdoc` errors in API catalogs/projects files not touched by this change. Integrated browser verification blocked by Microsoft session login; visual approval is pending owner review.

Projects enterprise refinement, same day: owner approved all proposed composition fixes (see document 26, "Owner refinement"). Verification: catalog suites 65 passed; frontend format/lint/typecheck, 164 tests and build passed. Integrated browser verification still requires an authenticated session.

Projects final polish, same day: single 40px toolbar row (search, panes, expand/collapse), floating pane list that does not grow the row, `Actualizado …` moved under the project name, drawer header status as the grid pill, singular modal copy (`Nuevo proyecto` / `Editar proyecto` / `Crear proyecto`), 600-weight labels and 900 textarea text. Verified live in an authenticated browser at 1440px: toolbar controls 40px on one row, open list floating at z-index 5 with the toolbar at 65px, drawer and edit modal computed colors match the Bunker scale. Verification: frontend format/lint/typecheck, 165 tests and build passed (existing bundle-size warning). Root `check-all.cmd` still stops at the 7 pre-existing API `jsdoc/require-jsdoc` errors.

Owner rejected floating pane lists (with `Expandir` they covered rows and paging). Lists now stay in flow under each trigger with a fixed 200px body, forming an aligned filter panel that pushes the grid down. Verified live at 929px and 1440px: three lists at equal height (202px), grid starts below the panel.

Projects 10/10 polish, same day: pane focus uses the box ring only (no native inner ring), pane lists truncate instead of scrolling horizontally, the expanded panel fills the full toolbar width (no gap under search), a single `Expandir`/`Contraer` command, stroke chevrons, and Spanish ARIA for sorting, paging and pane buttons. Verified live at 1440px, 929px and 390px. Frontend format/lint/typecheck, 166 tests and build passed.

Projects drawer 10/10 pass, same day: labels 600/500 and values 900/500 (the shared drawer's 650/600 made them compete), muted empty values, 12px monospace ID and system-code chips (were 10.2px), provider status pill moved to each provider card header, system code shown as a chip, `Última actualización` without seconds. Drawer navigation now follows the table's visible filter and order (a filtered table showing one row reads `Registro 1 de 1`; previously `1 de 37` with arrows reaching hidden records). Table minimum width lowered from 900px to 840px to remove a horizontal scrollbar at a 929px viewport. Verified live at 929px and 390px with computed styles. Frontend `pnpm check` passed with 167 tests; in three further full runs one intermittent CatalogItemsPage failure appeared once and did not reproduce (isolated file and two full reruns green).

Projects create/edit modal without desktop scroll, same day: the owner rejected the internal scroll. The `65dvh` body cap was replaced by `calc(100dvh - 200px)`, Projects textareas auto-size (detail 2-6 rows, reason 2-4), and windows at most 820px tall on desktop get a compact density (12px spacing, 32px fields, counters in the label row). Measured live: 929x906 body 595/595, 1366x657 body 497/497 with the modal 12px from both edges, 390x844 keeps the internal scroll on mobile. Frontend `pnpm check` passed with 168 tests, including a palette regression test for the body cap and compact density.

Global top bar without the tablet two-row jump, same day (owner: "se deforma"). This is a shell-wide change, not Projects-only: at 1024px or less the header no longer moves module selector and search to a second row nor grows to 126px; it keeps the desktop single 72px row (`max-content minmax(0, 1fr) max-content`), 112px logo, 196px selector (172px truncated `Administración` and was reverted) and a shrinking command bar; at 900px or less the avatar hides its visible name. Measured live: 768px search 251px, no overflow, menu at 72px; 929px search 314px with the name visible. Rule recorded in document 24; navigation regression test added.

Projects drawer and row actions allow editing and status changes for legacy identities as well as native identities, subject to existing permissions and request validation. Other legacy catalog identities remain read-only. No delete action is available. After promotion, follow the canonical public ID returned by save/status before reloading so the drawer remains associated with the migrated record. Legacy synchronization is controlled only by the API global gate; the frontend must not choose a database or implement dual writes.
