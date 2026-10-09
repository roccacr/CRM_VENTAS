# 34 - Cierre Operativo Administracion P0-S1

## Catalog verification evidence - 2026-10-09

The direct .env MySQL regression run passed all seven tests using rollback-only fixtures. Repository-only V8 coverage measured listCatalogItems 11/11 ranges, assertExternalReferencesAreAvailable 7/8, replaceExternalReferences 4/4, and insertExternalReferences 8/9. These are V8 execution ranges, not a claim of complete Istanbul branch coverage. The first coverage collector incorrectly included the service's same-named listing method; filtering by repository source corrected that reporting failure.

Authenticated Chrome verification confirmed all three SearchPanes (Name, References, Status), readable provider labels, active filtering (21 of 35 projects), text search (Amara), search persistence after reload, and opening project details with separate NetSuite/Odoo sections. At a requested 390x844 mobile viewport, document clientWidth and scrollWidth were both 375 pixels: no page-level horizontal overflow. The temporary viewport was reset. No live records were edited or migrated. Browser testing found and corrected empty-data initialization, React DOM pane labels, and SearchPanes column-definition precedence; jsdom intentionally disables the plugin as in the users module, so this browser evidence is separate from unit coverage.

The final sequential check-all.cmd rerun exited 0: API formatting, lint, typecheck, 227 tests passed (12 opt-in tests skipped), and build; frontend formatting, lint, typecheck, 120 tests passed, and build. The seven catalog MySQL tests passed separately with explicit opt-in. The existing frontend bundle-size warning remains non-blocking. A preceding formatting failure in the revised coverage collector was corrected before this rerun. Remaining ETL gates are the authoritative subsidiary name for NetSuite 63, the broker identifier mapping, and the Files domain mapping. Signed negative campaign identifiers must be preserved exactly. No target ETL batch was committed.

## Owner-to-Sales revocation lifecycle: 2026-10-08

The audited replacement path already revoked removed sec_user_role assignments, replaced memberships/overrides, incremented permission_version_user, and persisted user_access_replaced atomically. IdentityService.getCurrentUser reloads the canonical profile for protected identity, access-management, and catalog operations. IdentityProfileRepository rejects inactive sessions and permission-version mismatches and calculates current roles, module scopes, and effective permissions. There is no permanent Owner claim in a client token and no authorization cache to invalidate.

The missing enforcement was explicit revocation of session and refresh records. Before the patch, the old session failed profile validation after a version bump, but its row and refresh token remained active. The refresh path could rotate that old session using the new version (and lower current permissions). This was not proof of stale Owner authorization, but it violated the requested requirement that access replacement invalidate all existing credentials.

The repository now locks the target user and reuses IdentitySessionRepository.revokeAllActiveSessionsForUser within the same access-replacement transaction. Active sessions are revoked with the initiating actor, active refresh tokens are revoked with reason user_access_replaced, and audit failure rolls everything back. Active refresh tokens attached to previously inactive sessions are also included. Existing refresh-reuse handling retains its reused status; access-change tokens use revoked status. No schema migration, public response change, JWT dependency, redundant guard, or live user downgrade was introduced.

Database semantics are intentional: the removed Owner assignment becomes inactive/revoked history, not an orphan. Shared Owner role-permission mappings are unchanged for other Owners. Replaced memberships and overrides are revoked historically; new Sales membership uses the existing scope rules. A Sales-only replacement uses ventas as its sole role/module and no direct overrides. Existing service restrictions reject administrative overrides for non-Owners and prevent Owner self-demotion.

The opt-in IDENTITY_ACCESS_MYSQL_TESTS=1 suite uses the existing .env MySQL connection and rollback-only transactions with savepoints. Test-first reproduction failed because the prior session remained active. Real persistence regressions now cover Owner assignment revocation, removal of an existing administrative override and Administration membership, retained shared role mappings, explicit session/refresh revocation, rejection of old refresh rotation, Sales-only fresh-session resolution without administrative permissions, successful audit persistence, and complete rollback on audit failure. The downgrade is a repository-level fixture; existing service tests continue to enforce self-demotion protection. Focused verification passed 75 tests in five suites. Full verification results are recorded after the final check completes; browser acceptance is not implied by these tests.

An additional service regression resolves Owner on one request, changes the authoritative-profile double to Sales, and verifies the next request is forbidden without calling the administrative repository. Persistence coverage also includes revoking an active refresh token attached to an already-revoked session. These are explicit exercised paths, not a claim of exhaustive source-branch coverage; simultaneous production clients and cancellation of already-authorized requests are not tested.

The first combined opt-in run failed during savepoint rollback while suites concurrently mutated shared Owner fixtures. The serial API rerun passed. vitest.config.mjs now disables file parallelism whenever any real-MySQL suite is enabled; ordinary unit-test runs remain parallel. Test rollback preserves the original database error if InnoDB has already removed the savepoint. Initial test lint/complexity issues were also corrected before the final rerun. No failures are hidden by retries.

Run the complete verification from the repository root:

```powershell
$env:IDENTITY_ACCESS_MYSQL_TESTS = '1'
$env:ADMINISTRATION_MYSQL_TESTS = '1'
$env:CATALOG_MYSQL_TESTS = '1'
.\check-all.cmd
```

The full sequential check-all.cmd passed: API formatting, lint, typecheck, 25 files/222 tests (including all opt-in MySQL tests), and build; frontend formatting, lint, typecheck, 9 files/97 tests, and build. The existing frontend bundle-size warning remains non-blocking. Read-only post-test inspection confirms Roberto and Karina retain active Owner assignments with permission versions 9 and 6, respectively; zero downgrade fixture overrides or audit events persisted. No live role assignments were changed by this task.

Final review moved the target-user locking read before the actor/snapshot reads, so waiting access replacements establish their snapshot after acquiring the lock. The final API pnpm check after this adjustment also passed formatting, lint, typecheck, all 222 tests, and build. Simultaneous-client concurrency remains outside the executed regression coverage.

## Owner Administration linkage audit: 2026-10-08

### Verified cause and scope

Roberto (rzuniga@roccacr.com, internal user 1) already has active Owner and ventas roles. His local and Microsoft identities resolve to the same canonical user. Before repair, permission version was 8, both current Microsoft sessions carried version 8, and the profile resolver returned both roles and 55 effective permissions. Frontend profile parsing preserved those values. This is not a lost Owner claim or stale permission-version mismatch.

The user had active memberships in ventas and sistemas only. Administration was absent from sec_org_unit. Navigation filters by active module membership before filtering permissions, so Sistemas (which is not a workspace) and ventas correctly produced Sales-only navigation. Owner is a permission policy, not an automatic navigation membership.

The database records migration 202610030007_crm_catalogs as applied on 2026-10-04, but contains none of its current 140 scoped catalog permissions. Its current Administration seed also reuses public ID 01KCRM00000000000000000006, already owned by Sistemas. The upsert cannot create Administration when it collides with that unique ID; it can update the Sistemas row without changing its code. Source/database drift and the collision are verified; the exact earlier script version/execution is not recoverable from migration history, which has no source checksum. Do not replay or edit the historical migration.

Read-only integrity checks found zero orphaned user-role, role-permission, user-module, override, or module-parent links and zero session/identity user-ownership mismatches. All eight mutation tables use InnoDB. There are two active Owner users (Roberto and Karina); this is a role-wide repair, not an email-based privilege escalation.

### Incremental repair and verification

Migration 202610080008_administration_owner_repair uses a frozen permission snapshot, generates a new ULID only when Administration is absent, preserves Sistemas and existing module IDs, activates Administration, maps all 140 scoped catalog permissions to Owner, and assigns active Owners leader/all_areas membership. Existing unrelated permissions and non-Owner grants are unchanged. Historical membership rows are retained. Existing active membership is reused by its unique key.

The transaction increments each affected user's permission version, revokes their existing sessions and active refresh tokens, and writes administration_owner_repaired audit events. Revoked sessions cannot refresh into privileged sessions; users must sign in normally to receive fresh sessions. Existing guards, Owner bypass policy, cookie contracts, profile parser, and routes remain unchanged.

Tests first failed for missing migration registration. The focused regression run subsequently passed 59 tests, including real MySQL migration execution twice, retained Sistemas identity, all 140 role mappings, Owner memberships, unchanged non-Owner permission versions, session/refresh invalidation, and audit persistence. A late injected audit failure proves complete rollback of module, permission, grant, membership, user-version, session, and refresh-token writes. All test writes are enclosed in rollback-only transactions; no Docker or disposable schema is required. Enable ADMINISTRATION_MYSQL_TESTS=1 explicitly.

Catalog persistence coverage was remeasured: replaceExternalReferences 4/4 V8 ranges, insertExternalReferences 8/9, assertExternalReferencesAreAvailable 5/7. These are runtime ranges, not full source-branch coverage. The repair test exercises missing/existing-module and successful/failed-transaction paths; it does not establish exhaustive migration branch coverage.

### Applied result and remaining acceptance

- The full sequential check-all.cmd passed with ADMINISTRATION_MYSQL_TESTS=1 and CATALOG_MYSQL_TESTS=1: API formatting, lint, typecheck, 24 files/219 tests, build; frontend formatting, lint, typecheck, 9 files/97 tests, build. The initial check caught two lint issues in the new test, corrected before this successful rerun. The existing frontend bundle-size warning remains non-blocking.
- The official pnpm migrate:identity:schema runner applied only migration 202610080008_administration_owner_repair to the approved .env database at 2026-10-08T20:58:52.272Z. All six historical entries were skipped and retained. Running the command again skipped all seven migrations without further permission-version changes.
- Administration now has internal ID 19 and public ID 01M4EMZJPDSF602MRV27VK85YG. Sistemas retains ID 6, public ID 01KCRM00000000000000000006, its name, and active status. Auto-increment gaps from rollback-only tests are expected and do not represent persisted fixture records.
- Both active Owners have leader/all_areas Administration membership. Roberto's permission version changed 8 -> 9; Karina's changed 5 -> 6. The database contains exactly 140 active scoped catalog grants mapped to Owner and one persisted administration_owner_repaired audit event for each affected user.
- Read-only execution of the actual profile repository and permission service resolves Roberto's owner/ventas roles, ventas/sistemas/administration memberships, 195 effective permissions (including all 140 new scoped catalog allows), and rejects the old session. Existing legacy permission rows were deliberately retained; their cleanup is outside this repair.
- Reloading the in-app browser invalidated the previous session and displayed sign-in. Microsoft sign-in attempts returned the UI's controlled login error and did not create a fresh session. The local callback configuration references port 3000 while the testing frontend calls API 3001; both listeners were verified as this repository's API processes, so this difference alone does not establish the login failure's cause. No identity-provider settings, credentials, or authentication code were changed. User-assisted sign-in with existing credentials is required to complete fresh-session/browser acceptance. Do not treat the resolved database graph as proof of a successful new login.

This repair resolves the relational Administration blocker. Fresh-session browser verification and broader Administration acceptance remain separate and pending.

## Catalog reference editing regression: 2026-10-08

The external-reference editing defect is reproduced and corrected locally. Before the fix, the real MySQL suite failed three cases: retaining a reference, adding/removing/restoring references, and rejecting another item's removed reference with a controlled conflict. MySQL returned ER_DUP_ENTRY because the unique key includes soft-deleted rows.

The repository now retains unchanged rows, restores removed rows belonging to the same item, inserts new references, and soft-deletes only removed references. References belonging to another item remain reserved, including soft-deleted references. MySQL uniqueness collisions return the existing conflict response. Item row locking serializes edits to the same item; transaction and audit behavior remain intact. No public contracts or historical migrations changed.

### Test execution and isolation

- Uses the actual .env connection through DatabaseService, Kysely/mysql2, existing Zod validation, and TLS configuration. Actual keys are DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL, and optional DB_SSL_CA. No credentials are recorded here.
- No Docker, schema migration, or persistent fixtures. Each case runs in an outer rollback-only transaction. Repository operations use real MySQL savepoints to preserve per-operation rollback. Existing actor/system rows are read; only generated catalog/reference/audit fixtures are written, then rolled back. Teardown verifies no fixture catalog items remain.
- Five integration tests cover retained row identity and repeated edits, add/remove/restore, active/removed ownership conflicts, real audit insert failure, and a real unique-index collision injected after lookup. The collision injection is deterministic; it is not a simultaneous-client concurrency test.
- The focused catalog suite passed 17 tests, including the five MySQL cases and existing service authorization tests. The full check-all.cmd completed with exit code 0: API formatting, lint, typecheck, 23 files/218 tests, and build; frontend formatting, lint, typecheck, 9 files/97 tests, and build. The existing frontend bundle-size warning is non-blocking. A focused rerun also passed all five MySQL tests with measured coverage enabled.
- MySQL tests require explicit CATALOG_MYSQL_TESTS=1; ordinary test runs skip them. Optional CATALOG_MYSQL_COVERAGE=1 uses Node's built-in inspector without adding dependencies.

Run from the repository root in PowerShell:

```powershell
$env:CATALOG_MYSQL_TESTS = '1'
$env:CATALOG_MYSQL_COVERAGE = '1'
.\check-all.cmd
```

Focused reproduction from apps/api:

```powershell
$env:CATALOG_MYSQL_TESTS = '1'
$env:CATALOG_MYSQL_COVERAGE = '1'
pnpm test test/catalogs/catalogs.repository.mysql.spec.ts --reporter=verbose --silent=false
```

Measured V8 named-method block ranges: replaceExternalReferences 4/4; insertExternalReferences 8/9; assertExternalReferencesAreAvailable 5/7. These are executed V8 ranges, not Istanbul source-branch percentages or full-application coverage. The integration suite does not cover every defensive branch. Browser/Owner acceptance, migration-history verification, and Administration closure remain pending.

## Traspaso integral: 2026-10-08

Esta seccion conserva decisiones y evidencia para continuar sin el chat. El checkout es CRM VERION NESTJS; CRM VENTAS es legacy. Los planes aprobados por el usuario ampliaron Administracion y catalogos; las cabeceras historicas de septiembre no describen todo el runtime actual. Este traspaso no acredita produccion.

### Decisiones definitivas

| Decision | Razon |
| --- | --- |
| Cerrar Administracion antes de Leads | Identidad, seguridad y auditoria son la base de los modulos siguientes. |
| Rol = paquete de permisos | Evitar un rol por area; soportar multirol. |
| Modulo = contexto visible via sec_user_org_unit | Ver menu no equivale a poder ejecutar acciones. |
| Permiso efectivo = roles + overrides | Deny gana para usuarios ordinarios; revisar excepcion Owner abajo. |
| Catalogos scoped por modulo | Mercadeo no autoriza Formalizacion. Reemplaza propuesta anterior de permisos globales. |
| Un valor CRM y varias referencias externas | No duplicar Proyecto X por modulo ni por proveedor. |
| Inactivar/reactivar valores; no eliminar | Preservar relaciones e historial. |
| Motivo en cambios sensibles | Auditar actor, objetivo, accion, cambio y fecha. |
| Legacy solo lectura | Entender campos sin escribir/migrar negocio real. |
| Leads empieza como contrato NetSuite -> API | Resolver payload, duplicados y reintentos antes de UI. |
| Sin commit/push/deploy/migracion implicitos | Cada accion requiere autorizacion especifica. |

Regla ordinaria: modulo activo + permiso scoped allow sin deny. Excepcion actual: CatalogsService.assertCan retorna inmediatamente si existe rol owner activo. Owner no requiere modulo ni evalua deny en ese metodo. El test lo acepta; falta confirmar si esta politica irrestricta es la deseada antes de decir que deny siempre gana.

### Mapa del API

Rutas relativas a apps/api:

| Responsabilidad | Ubicacion |
| --- | --- |
| Arranque/wiring | src/main.ts, src/app.module.ts |
| Entorno, TLS y seguridad | src/config/env.validation.ts, database-env.schema.ts; src/common/security/ |
| Sesion, login, refresh, perfil | src/modules/crm/identity/identity.controller.ts, identity.service.ts, identity-profile.repository.ts |
| Usuarios | identity-user-directory.repository.ts, dto/system-users.dto.ts dentro de identity |
| Roles/modulos/overrides | identity-access-management.controller.ts, .service.ts, .repository.ts |
| Permisos efectivos | src/modules/crm/permissions/effective-permission.service.ts |
| Auditoria | src/modules/crm/audit/ |
| Catalogos | src/modules/crm/catalogs/catalogs.controller.ts, .service.ts, .repository.ts, .constants.ts |
| DTO catalogos | src/modules/crm/catalogs/dto/catalog-items.dto.ts |
| MySQL tipado | src/database/database.types.ts, database.service.ts |
| Proveedores aislados | src/integrations/microsoft365/, src/integrations/legacy-crm/ |
| Migraciones | migrations/schema-only/, scripts/run-schema-migrations.ts |

Stack instalado: NestJS/Fastify, TypeScript, Kysely/mysql2, MySQL y Vitest. Controllers delegan; servicios autorizan; repositorios persisten. @Inject explicito es necesario por tsx/Vitest. No introducir Prisma ni dependencia ERP directa en core.

BFF usa cookies, refresh, CSRF y adapter Microsoft. React no guarda tokens. Entorno en .env.example y validadores; no documentar valores secretos. Node >=22, pnpm >=10.28.2. Ejecutar pnpm dev por aplicacion, API default 127.0.0.1:3000. Mantener localhost coherente con cookies/CORS/callback.

### Contratos reales

La fuente de rutas identidad es identity-route.constants.ts. /identity/security/catalog fue un nombre conceptual: la ruta real es /identity/roles/security-catalog.

| Metodo/ruta | Uso |
| --- | --- |
| GET /identity/session y /identity/me | Sesion/perfil |
| GET /identity/users y /identity/users/:userPublicId | Directorio/detalle |
| POST /identity/users | Crear |
| PATCH /identity/users/:userPublicId | Editar |
| PATCH /identity/users/:userPublicId/status | Cambiar estado |
| GET /identity/roles/security-catalog | Matriz y auditoria reciente |
| PATCH /identity/roles/:roleCode | Renombrar |
| GET/PUT /identity/roles/:roleCode/permissions | Leer/reemplazar permisos |
| GET/PUT /identity/users/:userPublicId/access | Leer/reemplazar roles, modulos, overrides |
| DELETE /identity/roles/:roleCode | Borrado logico de rol sin usuarios activos; no de catalogos |
| GET/POST /catalogs/:catalogCode/items | Listar/crear |
| PATCH /catalogs/:catalogCode/items/:itemPublicId | Editar |
| PATCH /catalogs/:catalogCode/items/:itemPublicId/status | Inactivar/reactivar |

Auth adicional: /identity/local/login, /local/request-reset, /local/complete-reset bajo identity; /identity/microsoft/start, /identity/microsoft/callback, /identity/logout, /identity/refresh, /identity/sessions y /identity/sessions/:sessionPublicId/revoke. Metodos/DTO exactos en controllers y documento 24.

Catalogos: projects/catalog_project, campaigns/catalog_campaign, classes/catalog_class, brokers/catalog_broker, files/catalog_file, subsidiaries/catalog_subsidiary, locations/catalog_location.

Contextos: ventas, mercadeo, formalizacion, contabilidad, administration. Permiso: {contexto}.{vista}.{read|create|update|inactivate}. Son 140 permisos de catalogos (7 x 5 x 4), no el total del sistema.

GET /catalogs/projects/items?moduleCode=administration&limit=100. limit se transforma en DTO y normaliza en servicio, rango 1..200, default 100. Invalido: 400; sin permiso: 403; valor inexistente: 404; referencia ocupada: 409.

Body crear/editar: moduleCode, name (2..180), detail opcional (hasta 500), reason (5..255), externalReferences opcional (hasta 12), cada una {systemCode, externalId}. Estado: {moduleCode, status: active|inactive, reason}. Reactivar exige update; inactivar exige inactivate. Update hereda create, no es PATCH parcial libre. Omitir referencias produce []; el repositorio las reemplaza.

Respuesta lista: catalog, items, total. Item: publicId, nativeCode, name, detail, status, updatedAt, externalReferences. DTO/types son contrato exhaustivo; Swagger depende de OPENAPI_ENABLED.

### Datos y migraciones

Mantener crm_catalog_item y crm_catalog_item_external_reference. Relaciones internas con ID CRM; publicId para contratos publicos. Uniques: publicId; (catalog_code, native_code); (catalog_code, external_system_id, external_id). El repositorio valida sistemas externos activos, referencias repetidas y asignacion a otro valor. Nombre unico por catalogo no esta impuesto.

Orden del runner:
1. 202609250001_identity_schema.
2. 202609250003_identity_login_readiness.
3. 202609280004_identity_microsoft_session.
4. 202609300005_identity_user_directory.
5. 202610010006_identity_role_security_model.
6. 202610030007_crm_catalogs.

conf_schema_migration registra nombres; el runner toma lock y omite nombres aplicados. Nest no migra al arrancar. Catalogos tambien escribe seeds: scoped permissions, globales inactivos, permisos Owner, modulo administration y permission_version. schema-only no significa solo lectura.

No se consulto historial real MySQL en este traspaso. Si una version previa del mismo nombre ya esta aplicada, editar el archivo no actualiza esa base: crear una migracion incremental aprobada. No borrar historial para forzar ejecucion.

Agregar catalogo a constantes no actualiza bases migradas. Una nueva migracion debe asignar sus permisos a Owner. Evitar depender de constantes runtime mutables en migraciones historicas sin congelar version.

### Inventario de lo construido

| Bloque | Estado comprobable |
| --- | --- |
| Auth/BFF local y Microsoft | Codigo/pruebas presentes; validacion local historica documentada, no produccion actual. |
| Usuarios y acciones | API/frontend/tests presentes; aceptacion real por flujo pendiente. |
| Roles/modulos/overrides | Implementacion/tests presentes; verificar revocacion y excepcion Owner. |
| Siete catalogos scoped | Servicio/pagina/rutas/migracion presentes; QA MySQL/navegador pendiente. |
| Auditoria | Persistencia/vista seguridad presentes; confirmar catalogos en vista. |
| Filtros y capas UI | Cambios presentes; repetir refresh/panes/menu/modal sobre drawer. |
| Fuente unica catalogos | Parcial: backend centralizado; metadata frontend duplicada. |
| Leads entrantes | Direccion documentada; contrato de negocio pendiente, sin UI nueva. |

Los cambios anteriores siguen en working tree; no asumir commit o despliegue. Las solicitudes del chat y los mocks no prueban aceptacion.

### Hallazgos y trabajo pendiente priorizado

| Prioridad | Evidencia | Accion y salida |
| --- | --- | --- |
| Resuelto local | replaceExternalReferences hacia soft-delete + INSERT; unique no incluye deleted_at | Reproducido y corregido con reconciliacion; cinco pruebas MySQL aprobadas. Ver seccion de regresion arriba; aceptacion en navegador pendiente. |
| Alta | Runner omite nombres ya registrados | Comparar historial/esquema reales en lectura; nueva migracion si corresponde. |
| Alta | Owner bypass precede modulo/deny | Confirmar politica; alinear pruebas API/frontend. |
| Media | Migracion catalogos no tiene COMMENT en columnas | Evolucion aprobada para cumplir estandar MySQL; preservar historia aplicada. |
| Media | Metadata API/frontend duplicada | Endpoint/contrato derivado y test de consistencia. |
| Media | UI carga 100 y pagina local | Paginacion servidor y total para volumen superior. |
| Media | UI solo edita NetSuite/Odoo; backend admite proveedores genericos | Editor dinamico; preservar referencias no visibles. |
| Media | Auditoria UI viene de security-catalog | Confirmar eventos catalogos, historico y paginacion; ampliar si falta. |
| Media | Servicios usan mocks; repositorio ya tiene cinco pruebas MySQL de referencias | Persistencia de referencias, unicidad y rollback verificados; completar QA administrativo restante sin asumir cobertura integral. |
| Baja | Test titulado permisos globales verifica scoped | Renombrar en siguiente tarea de pruebas. |

Hallazgos originales de inspeccion; no todos reproducidos. La correccion posterior de referencias y su evidencia estan registradas en la seccion de regresion al inicio.

### Continuidad paso a paso

1. Leer README, ley, este cierre y guia frontend 25; revisar git status.
2. Referencias externas corregidas localmente y verificadas con MySQL transaccional; verificar historial de migraciones y aceptacion en navegador.
3. Confirmar Owner y coherencia de contratos scoped en cinco contextos.
4. Ejecutar check-all secuencial y completar pruebas reales faltantes.
5. QA Owner/operativo: siete catalogos, acciones usuarios, roles y auditoria; guardar Network/resultados.
6. Corregir errores y firmar cierre con evidencia.
7. Acordar contrato NetSuite -> API; construir siguiente slice solo despues.

Cada tarea debe tener requisito, archivos, prueba, resultado y pendiente. No saltar a Leads para eludir bloqueos administrativos.

### Preguntas para producto

- NetSuite: tiempo real/batch, evento disparador y autenticacion?
- Payload: campos obligatorios, IDs externos o vendedor/proyecto/campana resueltos?
- Idempotencia/reintentos; duplicados por evento, telefono, correo, cedula o ID externo?
- Vendedor desconocido/faltante: rechazo, pendiente o asignacion?
- Catalogo externo desconocido: rechazo, cuarentena o creacion autorizada?
- Auditoria de integracion: actor sistema y responsable vendedor?
- Owner irrestricto o sujeto a deny? Retencion/alcance de auditoria?
- Proveedores adicionales, cantidad e importacion masiva requerida?

No inventar respuestas. Contrato futuro requiere mapeo canonico, errores, reconciliacion e idempotencia; no implica instalar broker ahora.

### Registro de horas reconstruidas

Tablas solicitadas para 24/09, 25/09, 01/10 y 02/10/2026: 8.00 horas por dia. Son distribuciones reconstruidas, no cronometraje ni evidencia de ejecucion. Columnas Fecha, Nombre, Tipo, Apunte, Duracion; el 24 no tenia Tipo. CT se uso para pruebas/verificacion; confirmar nomenclatura laboral.

| Fecha | Tareas y horas decimales |
| --- | --- |
| 24/09 | Alcance .65; usuarios/accesos .70; docs arquitectura .80; roles/modulos .55; permisos base .75; catalogos .60; referencias .50; riesgos legacy .65; plan cierre .85; enfoque Leads .70; preguntas .45; norte .80. |
| 25/09 | Identidad .70; permisos modulo .85; servicios .60; navegacion .75; Owner .50; catalogos .90; permisos usuarios .55; vistas .65; pruebas .80; riesgos .45; docs .75; consolidacion .50. |
| 01/10 | Reunion entrega 2.00 (indicada por usuario); pendientes usuarios .55; acciones API .80; detalle .60; filtros .70; permisos .65; auditoria .55; capas .50; pruebas .75; decisiones .45; continuidad .45. |
| 02/10 | Arquitectura catalogos .70; scoped .85; migracion .65; menu .70; roles visual .60; compartidos .55; autorizacion .75; listas .80; limite .50; docs .65; cierre .45; contrato NetSuite .80. |

No volver a registrar estas mismas tareas como nuevas; no deducir de las horas que los bugs se resolvieron.

### Evidencia de esta entrega

Ejecutado el 2026-10-08: check-all.cmd termino con codigo 0. API: format:check, lint, typecheck, 22 archivos/213 pruebas y build aprobados. Frontend: format:check, lint, typecheck, 9 archivos/97 pruebas y build aprobados. Advertencia no bloqueante: bundle Ant Design supera 500 kB. Pruebas unitarias/HTTP con doubles no acreditan MySQL ni aceptacion Owner reales. git diff --check sin errores (aviso de normalizacion CRLF en documento preexistente).

No se ejecutaron migraciones/importaciones, ni escritura en base real, commit, push o deploy. No se validaron sesiones reales Owner/operativo ni Network. Resultados frescos de checks se registran al terminar.


## Proposito

Este documento define como cerrar la parte administrativa antes de construir mas pantallas operativas.

Administracion es la base de seguridad del CRM. Si usuarios, roles, permisos, catalogos o auditoria quedan ambiguos, los modulos futuros heredaran errores de acceso, navegacion y trazabilidad.

## Modelo mental obligatorio

| Concepto | Significado | Regla |
| --- | --- | --- |
| Rol | Paquete de permisos base. | No representa por si solo un modulo visible. |
| Modulo | Area visible en menu y alcance operativo. | Debe existir como asignacion activa del usuario cuando la accion lo requiere. |
| Permiso efectivo | Resultado de roles activos mas overrides personales. | Una denegacion directa gana sobre un permiso permitido. |
| Catalogo compartido | Vista reutilizable por varios modulos. | El valor vive una vez, pero la autorizacion es scoped por modulo consumidor. |
| Auditoria | Evidencia de acciones sensibles. | Todo cambio de acceso, rol, permiso, estado o catalogo debe tener motivo. |

Regla superior: ninguna accion sensible queda autorizada solo por frontend.

## Orden de cierre

El cierre se hace en este orden. No se debe saltar a nuevas pantallas hasta completar la fase anterior.

1. Cierre tecnico del diff actual.
2. Validacion automatica API y frontend.
3. Validacion manual con usuario Owner.
4. Matriz funcional de Administracion.
5. Revision de seguridad y permisos scoped.
6. Revision de migraciones y datos de catalogos.
7. Documentacion de resultados y riesgos.

## Norte despues del cierre administrativo

Decision vigente:

- no se construye UI ni runtime de Leads antes de cerrar Administracion;
- el siguiente trabajo de Leads sera contrato NetSuite -> API, no pantalla;
- NetSuite sera la fuente futura de entrada del lead hacia el API nuevo;
- el CRM viejo se consulta solo en lectura para entender campos, conteos, conceptos y mapeos;
- no se migra ni se escribe data real hasta autorizacion explicita.

Preguntas que se abren solo despues de validar Administracion:

1. Que evento exacto de NetSuite dispara el envio del lead.
2. Que payload enviara NetSuite y si mandara IDs externos o valores ya resueltos.
3. Cual sera la regla de duplicados: telefono, correo, cedula, NetSuite ID o combinacion.
4. Que pasa si el vendedor enviado por NetSuite no existe en el CRM nuevo.
5. Si proyecto, campana, subsidiaria, corredor y clase se crean automaticamente o se rechazan cuando vengan desconocidos.
6. Si la auditoria del lead de integracion queda como actor sistema o como vendedor relacionado.

## Cierre tecnico del diff

Antes de considerar listo el modulo, revisar:

- archivos modificados por bloque: identidad, usuarios, roles/permisos, catalogos, navegacion, tests y documentacion;
- que no existan cambios de formato masivos sin razon;
- que no se hayan tocado modulos comerciales fuera de Administracion/Identidad;
- que no se haya agregado una dependencia sin justificacion;
- que no haya commits, push, deploy o migraciones reales sin autorizacion explicita.

Comandos minimos:

```bash
git status --short
git diff --stat
git diff --name-only
```

## Validacion automatica

No hay `package.json` raiz. La verificacion se ejecuta por app.

API:

```bash
cd apps/api
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check
```

Frontend:

```bash
cd apps/frontend
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check
```

La evidencia debe registrar comando, resultado y observaciones. Un warning de bundle grande en frontend no bloquea por si solo, pero debe quedar anotado si aparece.

## Validacion manual Owner

Requiere API y frontend reales levantados, sesion real y hard refresh del navegador.

Rutas minimas:

| Ruta | Debe validar |
| --- | --- |
| `/home/administration/users` | Lista de usuarios, filtros, detalle, crear, editar y cambios de estado. |
| `/home/administration/roles-security` | Roles, modulos habilitados, permisos efectivos y catalogos compartidos por modulo. |
| `/home/administration/audit` | Eventos de seguridad, actor, objetivo, modulo, motivo y resumen. |
| `/home/administration/catalogs/projects` | Listado, busqueda, crear, editar e inactivar/reactivar. |
| `/home/administration/catalogs/campaigns` | Carga sin error y respeta permisos scoped. |
| `/home/administration/catalogs/classes` | Carga sin error y respeta permisos scoped. |
| `/home/administration/catalogs/brokers` | Carga sin error y respeta permisos scoped. |
| `/home/administration/catalogs/files` | Carga sin error y respeta permisos scoped. |
| `/home/administration/catalogs/subsidiaries` | Carga sin error y respeta permisos scoped. |
| `/home/administration/catalogs/locations` | Carga sin error y respeta permisos scoped. |

Network debe confirmar:

- sin `ERR_CONNECTION_REFUSED`;
- sin HTTP 500 inesperado;
- sin `Limite de catalogos invalido`;
- catalogos usando `moduleCode=administration`;
- catalogos usando `limit=100`;
- mutaciones con motivo de auditoria.

## Matriz funcional por pantalla

### Usuarios

| Flujo | Automatico | Manual | Criterio |
| --- | --- | --- | --- |
| Listar usuarios | Si | Si | Tabla carga sin duplicados y sin exponer tokens. |
| Filtrar/buscar | Si | Si | Filtros conservan estado esperado. |
| Ver detalle | Si | Si | Muestra rol, modulo, seguridad, registro e ids externos. |
| Crear usuario | Si | Si | API recibe rol, modulo derivado, accesos y referencias externas. |
| Editar usuario | Si | Si | Cambia roles/datos y exige motivo auditable. |
| Activar/desactivar | Si | Si | Llama API con permiso y motivo. |
| Bloquear/desbloquear | Si | Si | Llama API con permiso y motivo. |

### Roles y seguridad

| Flujo | Automatico | Manual | Criterio |
| --- | --- | --- | --- |
| Ver matriz | Si | Si | Se separan roles asignados, modulos habilitados y permisos efectivos. |
| Expandir modulo | Si | Si | Solo se abre la seccion solicitada. |
| Catalogos compartidos | Si | Si | Aparecen dentro del modulo, no como modulo principal infinito. |
| Guardar cambios | Si | Si | Exige motivo y audita. |
| Deny directo | Si | Si | Oculta o bloquea solo el contexto scoped indicado. |

### Catalogos

| Flujo | Automatico | Manual | Criterio |
| --- | --- | --- | --- |
| Cargar lista | Si | Si | Cada catalogo usa `moduleCode=administration` y `limit=100`. |
| Buscar | Si | Si | Query remota respeta texto de busqueda. |
| Filtrar estado | Si | Si | Todos no envia estado; activos/inactivos si. |
| Crear valor | Si | Si | Genera valor nativo CRM y referencias externas opcionales. |
| Editar valor | Si | Si | Actualiza nombre/detalle/referencias con motivo. |
| Inactivar/reactivar | Si | Si | Cambia estado con motivo. |
| Duplicado externo | Si | Si | NetSuite/Odoo duplicado falla con error controlado. |

### Auditoria

| Flujo | Automatico | Manual | Criterio |
| --- | --- | --- | --- |
| Listar eventos | Si | Si | Carga actor, objetivo, evento, modulo y fecha. |
| Filtrar eventos | Si | Si | Filtra por texto/modulo sin perder datos. |
| Ver motivo | Si | Si | Cambios sensibles muestran motivo auditable. |

## Seguridad y permisos scoped

Casos obligatorios:

| Caso | Resultado esperado |
| --- | --- |
| Owner sin permisos explicitos | Puede administrar catalogos y seguridad por regla de Owner. |
| Usuario con `administration.catalog_project.read` pero sin modulo `administration` | No ve ni opera catalogos administrativos. |
| Usuario con `mercadeo.catalog_project.read` | Puede operar solo contexto Mercadeo si tiene modulo activo. |
| Mismo usuario intentando `formalizacion.catalog_project.read` | Falla si no tiene permiso y modulo de Formalizacion. |
| Permiso global viejo `catalog_project.read` | No autoriza endpoints nuevos. |
| Deny directo sobre `formalizacion.catalog_project.read` | Bloquea Formalizacion sin quitar Mercadeo. |

## Datos y migraciones

La base de catalogos queda asi:

- `crm_catalog_item` guarda el valor nativo CRM;
- `crm_catalog_item_external_reference` guarda ids externos como NetSuite u Odoo;
- el valor no se duplica por modulo;
- la autorizacion se diferencia por permiso scoped;
- Owner debe recibir todo nuevo permiso scoped;
- `int_external_system` debe contener sistemas externos activos antes de usar referencias.

No crear permisos por combinacion valor+modulo. Si algun dia un catalogo necesita valores distintos por modulo, eso sera otra fase con una tabla de alcance del valor.

## Evidencia de cierre

Cada cierre administrativo debe dejar un resumen con:

- fecha;
- rama o checkout;
- comandos ejecutados;
- resultado de cada comando;
- rutas manuales probadas;
- usuario usado para validar;
- riesgos pendientes;
- decision de si se puede avanzar o no.

Plantilla:

```txt
Fecha:
Checkout:
API tests:
API lint/typecheck/build/format:
Frontend tests:
Frontend lint/typecheck/build/format:
Validacion manual Owner:
Catalogos probados:
Permisos scoped probados:
Auditoria probada:
Riesgos:
Decision:
```

## Criterio de salida

### Catalog UI and migration execution gates - 2026-10-09

Scope: seven Administration catalogs only. Legacy production remains read-only. No Leads, property-domain expansion, source updates, credential changes, historical migration edits or deployment are authorized by this process.

#### Phase 1: UI and regression gate

1. Reuse the users module's installed DataTables/SearchPanes integration, hook and CSS. The screenshot refers to SearchPanes; no existing React component named SearchPanel was found.
2. Replace the shared catalog table once for all seven routes. Preserve row/keyboard drawer selection, edit/status actions, optional external identifiers and audit reasons. Keep saved search, panes, sort and page settings isolated by catalog and operational module.
3. Remove the silent 100-row cutoff: add an optional validated offset and authoritative filtered total to the existing list contract. Load 100 records at a time explicitly, matching the users directory's incremental-load/local-table pattern. SearchPanes and local search operate on loaded rows, not on unloaded database records; loaded/total counts and a load-more action must stay visible while incomplete. This is not server-side SearchPanes or full-dataset search.
4. Require failing-then-passing focused regression tests, real MySQL pagination/transaction tests with full rollback, root sequential checks and browser evidence. Rollback-only tests may create disposable fixtures; no real catalog ETL commit occurs in this phase.

#### Phase 2: source inventory and decisions, before target writes

1. Read source schema, keys, types, statuses, identifiers and counts. On 2026-10-09, read-only production queries returned: projects 36 rows/35 distinct NetSuite IDs; campaigns 291/291; classes 22/22; brokers 105/105 using id_netsuiteCorredor; files 3358/3358; subsidiaries 44/43; locations 23/23. These are dated counts, not a frozen extraction. No declared source foreign keys exist on these seven tables; logical dependencies still require validation.
2. Preserve signed NetSuite identifiers exactly as strings. Owner explicitly confirmed campaign IDs -5, -4, -6 and -3 are valid; never reject them solely because they are negative or fabricate replacements. Do not reuse the project mapper's positive-ID rule blindly across catalogs.
3. Resolve blockers before authoring the complete batch mapping: brokers have two candidate identifier columns (103 of 105 disagree); subsidiaries legacy records 40 and 42 share ID 63 with names Lean Homes and Lean Homes SRL; the official NetSuite name cannot be inferred from source row order. Deduplicate by provider/catalog/external ID, never by name alone; contradictory fields require an authoritative resolution.
4. Files contain property attributes and a project identifier, not just a lookup name. Their statuses include available/reserved/sold/delivered and missing/undefined values, not a binary active flag. Obtain approval for identity-only import with full source staging, or model the domain separately; do not discard attributes, invent active/inactive mappings or claim a project FK was persisted in the generic catalog schema.
5. Confirm source-to-target mappings: projects id_ProNetsuite/Nombre_proyecto/estado_proyecto; campaigns id_NetsauiteCampana/Nombre_Campana/Estado_Campana; classes idNetsuite_clase/nombre_clase/estado_calase; subsidiaries id_NetsuiteSub/Nombre_Subsidiaria/Estado_Subsidiaria; locations idNetsuite_ubicaciones/nombre_ubicaciones/estado_ubicaciones. Brokers and files remain gated by the decisions above. Known binary flags map 1 to active and 0 to inactive; reject other values rather than guessing.

#### Phase 3: frozen extraction and target preflight

1. Extract catalog-by-catalog using deterministic primary-key order and a read-only consistent snapshot. Save a restricted local snapshot and manifest with extraction time, source database/table, row count, checksum and mapping version. Retain all source attributes in staging; never print broker contact data or credentials in logs.
2. Validate the entire catalog snapshot before opening a target write transaction: primary identities, signed external-ID representation, required names, length/type limits, statuses, duplicate identity groups and any logical parent references. Abort a contradictory group; do not silently select the first row.
3. Use the target `.env` connection directly, no Docker. Verify database identity, active authorized actor, active NetSuite provider, InnoDB tables, existing UNIQUE indexes and foreign keys. Odoo remains unassigned (no reference row), without requiring an Odoo provider or credentials. Uniqueness stays catalog + provider + external ID until a separate cross-catalog decision is approved.
4. Reuse the existing sync-legacy-projects transaction/audit/upsert approach instead of a second persistence architecture. Extend only after mapping decisions are resolved; preserve unrelated references, native IDs and fields. Revalidate the existing projects import against the fresh snapshot rather than blindly reinserting it.

#### Phase 4: controlled application and reconciliation

1. Process independent catalogs one at a time: subsidiaries, locations, classes, projects, brokers, campaigns; files last, after approved project-reference and property-status mapping. These independent catalogs have no mutual target FK; the chosen order does not invent dependencies. A blocked catalog is not reported as migrated.
2. Run a rollback-only preview of each complete catalog. Produce inserted/updated/unchanged/deduplicated/rejected counts and an explicit change set. Validate source coverage, external-reference ownership and audit writes. Do not commit if any mapping, FK, uniqueness or audit check fails.
3. Apply only the validated frozen snapshot in one atomic transaction per catalog, using the existing provider lock and uniqueness guard. Match on NetSuite identity; update existing owned rows or insert new ones, never reassign another item's reference or revive archived ownership implicitly. Record source identities, snapshot hash, mapping version, actor, reason, previous/next values and batch identity in atomic audit metadata.
4. Before commit, reconcile every expected native row/reference/status and required relationship; any mismatch rolls back the whole catalog. After commit, perform independent read-only reconciliation and a second preview that must report zero changes. Confirm zero Odoo assignments were introduced. Validate the catalog in the UI, including records beyond the first 100.
5. Recovery: roll back failed transactions automatically. For an already committed catalog, use the batch audit and before-image manifest for an approved compensating transaction; inactivate newly introduced rows and restore prior fields with new audit events. Never hard-delete history or remove unrelated data. Stop on failure; prior successfully committed catalogs remain separately traceable.

Execution status: production schema/count profiling only; no target ETL writes in this task. Complete extraction and migration remain blocked on broker identity, subsidiary 63's authoritative name and Files scope/status semantics. Source reads are not proof of completed migration. A fresh read-only connection attempt through the configured `.env` legacy client returned ER_ACCESS_DENIED_ERROR; the read-only CRM database connector succeeded for inventory. No credentials were altered. Freeze a verified connector snapshot for the existing runner's source-json path, or restore dedicated read-only client access through the owner; do not invalidate shared credentials.

### Optional external reference correction - 2026-10-08

- DTO validation accepts omitted, NULL, empty and whitespace-only external identifiers. The application removes unassigned references before provider lookup on create and update; missing Odoo does not require an Odoo system record or integration credentials. Nonempty identifiers still require an active configured system. Missing assignments remain absent reference rows, not NULL rows in the reference table.
- Existing authorization, transactional reference synchronization and audit recording remain unchanged. Duplicate assigned references in a request return 409 before persistence; cross-item collisions retain repository preflight checks and database race protection. The live composite UNIQUE index was verified through `information_schema.STATISTICS`: catalog + provider + external identifier, including archived reference ownership. No migration history or database constraints were changed. Provider-wide uniqueness across different catalogs requires an explicit scope decision.
- The catalog form stays mounted and initializes every field on opening, avoiding calls on a disconnected Ant Design form. Blank Odoo inputs are omitted from outgoing mutations. The shared provider constant is already imported correctly; a refreshed in-app browser displayed the project page and edit form without current ReferenceError or useForm warnings. Browser verification opened/cancelled/reopened the form without saving real records.
- TDD evidence: five added service regressions failed before normalization, then all 17 service tests passed. The frontend regression verifies NetSuite-only submission with blank Odoo; it passed before the lifecycle change, so it does not independently reproduce the reported warning.
- Real MySQL evidence: `CATALOG_MYSQL_TESTS=1 CATALOG_MYSQL_COVERAGE=1 pnpm exec vitest run test/catalogs/catalogs.repository.mysql.spec.ts` passed six tests against the `.env` connection with outer transaction rollback and fixture cleanup verification. Assertions cover optional Odoo creation/repeated edits, reference row identity, create/update ownership conflicts, remove/restore, database uniqueness and audit-failure rollback, and persisted audit events. No Docker or committed test fixture writes.
- Precise V8 executed-range coverage for persistence: availability checks 7/8, reference replacement 4/4, insertion 8/9. This is not full branch coverage; uncovered ranges remain a separate coverage gap. Broader Administration acceptance remains separate.
- Sequential root `check-all.cmd` passed API formatting/lint/typecheck, 226 tests and build (11 opt-in tests skipped), followed by frontend formatting/lint/typecheck, 117 tests and build. The separately executed six-test MySQL suite is the persistence evidence; the default suite alone is not. Initial runs caught strict lint errors in the added test typings; these were corrected before the successful run. Frontend build retains its existing large-chunk warning. `git diff --check` passed.

### Project catalog import evidence - 2026-10-08

- Explicit owner instruction authorized a one-time project sync keyed by the NetSuite identifier. This does not authorize Leads implementation, deployment, or writes to legacy production.
- Source: all 36 rows from `crmdatabase-api.proyectos`; target: `CRM_THINK_V2`. The configured legacy account returned MySQL `ER_ACCESS_DENIED_ERROR` (1045). No credentials were changed. Extraction used the working read-only CRM database connector and a local JSON snapshot instead.
- Snapshot: `C:/codex-data/visualizations/2026/10/08/01a11c8c-6976-77d0-8ffe-bc28b2cdb2ed/legacy-projects-source.json`; SHA-256 `832c2f209217a4c943c86b23f81e9c4d4247a7a7e97b0663997429880203aaaf`. This is a dated operational snapshot, not a live sync or a committed source fixture.
- Mapping: trimmed `Nombre_proyecto` -> native name; `estado_proyecto` 1/0 -> active/inactive; `id_ProNetsuite` -> string external ID under the active `netsuite` system. Native public IDs and codes are generated by CRM. Legacy source IDs are retained in reference metadata, never used as internal foreign keys. Missing Odoo identifiers are represented by no Odoo reference row, not an invalid NULL external-ID row.
- Source IDs 29 and 35 have identical name, status and NetSuite ID 40. They became one project with `legacyProjectIds: [29, 35]`. Contradictory duplicates abort validation rather than silently picking a winner.
- Runner: `pnpm exec tsx scripts/sync-legacy-projects.ts --actor=rzuniga@roccacr.com --source-json=<snapshot-path>` defaults to rollback-only. Add `--apply` only for an approved commit. Without `--source-json`, it uses the existing isolated read-only legacy connection. Database credentials remain in `.env`.
- The runner validates source types, required names, name lengths, positive identifiers, duplicate identities, source statuses, active actor/provider foreign keys and InnoDB target engines. Existing unique indexes and foreign keys remain enabled. All project/reference/audit writes share one Kysely transaction. Existing NetSuite matches update in place or skip; unrelated references and fields remain unchanged; missing source projects are not deleted. Soft-deleted or inconsistent reference matches abort.
- Execution: two successful rollback-only previews preceded the commit. First committed run inserted 35, updated 0, skipped 0. Second committed run inserted 0, updated 0, skipped 35, proving persisted idempotency.
- Post-commit verification: 35 native projects, 35 NetSuite mappings, 0 Odoo mappings, 21 active and 14 inactive; 0 name/status/identifier mismatches against the source snapshot; 35 atomic audit events. Duplicate metadata retained both legacy IDs. Actor: the active CRM account `rzuniga@roccacr.com`.
- Verification: API `pnpm check` passed formatting, lint, typecheck, 221 tests and build (10 opt-in MySQL tests skipped in that normal run). Separately, `PROJECT_SYNC_MYSQL_TESTS=1 pnpm exec vitest run test/catalogs/project-sync.spec.ts test/catalogs/project-sync.mysql.spec.ts --no-file-parallelism` passed 9 tests using real MySQL for insert, repeat skip, identity-preserving update, unrelated-reference preservation, archived-reference rejection and complete rollback after a second-item audit failure. All test fixtures roll back.
- Recovery: do not hard-delete imported projects or edit migration history. Use the audit event item public IDs and source snapshot to identify this batch. An approved reversal should inactivate those native items transactionally with new audit events, preserving reference identity and history. No rollback was executed after the successful import.
- This evidence covers this project import only; broader Administration acceptance remains separate.

Administracion queda lista para avanzar cuando:

- todas las verificaciones automaticas pasan;
- el Owner valida usuarios, roles, auditoria y todos los catalogos;
- un usuario operativo no cruza permisos entre modulos;
- los catalogos crean, editan e inactivan sin errores de contrato;
- la auditoria registra cambios sensibles;
- la documentacion y la UI explican el mismo modelo;
- no queda una decision arquitectonica abierta sobre usuarios, roles, permisos o catalogos;
- queda documentado que Leads sigue despues como contrato NetSuite -> API, no como pantalla inmediata;
- cualquier revision del CRM viejo usada como evidencia fue solo lectura.
