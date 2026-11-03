# 86 — Bancos y ejecutivos bancarios

## Corrección de permisos efectivos — 2026-11-03

La autorización del catálogo acepta permisos efectivos por rol o por excepción personal. Se retiró la restricción adicional Owner/Jefe General del perfil de identidad, navegación y servicio; los requisitos de lectura, acción, módulo activo y deny permanecen. Los apartados históricos que limitaban Bancos por nombre de rol quedan sustituidos por esta corrección solicitada por el usuario. No se cambian roles, grants guardados, esquema ni credenciales.


## Diagnóstico de acceso — 2026-11-03

Verificación real de Roberto: roles Owner/Jefe General activos,20 permisos Bancos efectivos,40 grants activos entre ambos roles y ninguna excepción personal Bancos. `canUseBanks` autoriza lectura en Formalización. No se alteraron asignaciones, módulos ni denies. Navegador con esa sesión confirmó los cinco bancos y respuestas200 de catálogo/detalle/ejecutivos.

Reintento visual final: `/identity/me` y catálogo respondieron200; se abrió BAC y se mostraron Paola Peñaranda Rivera, correo/teléfono guardados y área vacía, con acciones de creación/edición habilitadas. Sin escrituras durante esta verificación.

`BanksPage` absorbía errores de `getIdentityProfile` y mostraba indebidamente «Sin acceso a Bancos». Prueba RED reprodujo ese comportamiento ante fallo de red. Ahora conserva permisos vacíos y datos bloqueados, distingue «No fue posible verificar el acceso» y permite reintento explícito; una denegación confirmada mantiene el mensaje original. Epoch/limpieza siguen descartando perfiles tardíos. Pruebas ampliadas58/58; después de simplificar presentación, UI/permisos25/25 y revisión independiente del caso de recuperación1/1 aprobadas. ESLint focal aprobado. Typecheck/build global bloqueados por prueba concurrente de OneDrive `order-documents.spec.tsx` (`null` no asignable a `string`).

## Carga inicial autorizada — 2026-11-03

Verificación de esta carga:10 eventos de seguridad y10 eventos de bitácora comercial confirmados por SELECT. Pruebas de lectura/asignación11/11, ESLint y formato focal aprobados. Typecheck/build frontend se detuvieron en un error concurrente ajeno, `test/home/order-documents.spec.tsx:10` (`null` no asignable a `string`); no se declara aprobado el build global.

Después de la entrega del catálogo, el usuario solicitó cargar BAC, Davibank, Davivienda, BCT y BCR con un ejecutivo por banco. Se guardaron los nombres, correos y teléfonos proporcionados, conservando sus formatos, y área vacía porque no fue suministrada. Todos activos. Se reutilizó BanksRepository con una transacción única, auditoría existente y mirror legacy: SELECT posterior confirmó5 bancos/5 ejecutivos con datos exactos en CRM_THINK_V2 y crmdatabase-api. Preflight y comprobación por banco/correo evitan duplicar o sobrescribir contactos distintos. Sin cambios de esquema ni nueva migración; los datos personales de los contactos no se incluyen en este documento. La lectura frontend acepta área vacía, manteniendo obligatorios los identificadores, nombre, correo y teléfono. Los ceros de las evidencias de entrega inferiores corresponden al corte anterior a esta carga.

Fecha:2026-11-03, Costa Rica. Estado: implementacion local y esquema compartido verificados; sin deploy. Catalogo/API/UI y tablas nuevas autorizadas en CRM_THINK_V2 y crmdatabase-api. Jefe Global corresponde a jefe_general. Sin importar bancos ni relacion automatica con ordenes.

## Requisitos y decisiones

- Bancos compartidos entre los contextos actuales de Catálogos. Nombre y estado activo/inactivo; múltiples ejecutivos por banco.
- Ejecutivo: nombre, correo válido, teléfono y área (texto), todos obligatorios. Estado activo/inactivo; no borrar ni trasladar un ejecutivo a otro banco mediante edición.
- Solo roles activos owner/jefe_general con permiso efectivo y módulo permitido; deny individual prevalece. No asignar automáticamente otros roles/membresías. React oculta y API revalida.
- Cuatro permisos por contexto: {context}.catalog_bank.read/create/update/inactivate. Cubren banco y ejecutivos. Reactivar requiere update; inactivar requiere inactivate. Read es prerrequisito del catálogo.
- Alta/edición de bancos y ejecutivos se audita en BD nueva con actor, antes/después y motivo obligatorio de 3 a 255 caracteres después de trim. Concurrencia expectedVersion en edición/estado, conflicto409. No reintentar POST automáticamente.
- Banco inactivo conserva ejecutivos y sus estados, pero no admite nuevos ejecutivos. Su disponibilidad efectiva futura requiere banco y ejecutivo activos; esta tarea no agrega selección a órdenes.
- Nombre de banco único, correo de ejecutivo único dentro del banco, con validación/normalización y restricciones SQL. No hay datos de ejemplo en BD compartidas.

## Modelo y contratos congelados

Dos tablas por BD, mismas columnas de negocio: crm_bank y crm_bank_advisor. Identidad pública ULID, PK local BIGINT UNSIGNED; FK de ejecutivo al banco local. Nombres canónicos, comentarios por columna, InnoDB, utf8mb4, índices de búsqueda por banco/estado/nombre; versión INT UNSIGNED y fechas DATETIME(3) UTC. Sin referencias NetSuite/Odoo ficticias.

Banco API: {publicId,name,status,version,createdAt,updatedAt,advisorCount}. Ejecutivo: {publicId,bankPublicId,name,email,phone,area,status,version,createdAt,updatedAt}. Fechas ISO.

- GET /catalogs/banks/items?moduleCode&search&status&limit&offset → {items:Bank[],total}.
- POST /catalogs/banks/items body {moduleCode,name,reason} → Bank.
- GET /catalogs/banks/items/:bankId?moduleCode → Bank.
- PATCH /catalogs/banks/items/:bankId body {moduleCode,name,reason,expectedVersion} → Bank.
- PATCH /catalogs/banks/items/:bankId/status body {moduleCode,status,reason,expectedVersion} → Bank.
- GET /catalogs/banks/items/:bankId/advisors?moduleCode&search&status&limit&offset → {items:Advisor[],total}.
- POST /catalogs/banks/items/:bankId/advisors body {moduleCode,name,email,phone,area,reason} → Advisor.
- PATCH /catalogs/banks/items/:bankId/advisors/:advisorId body {moduleCode,name,email,phone,area,reason,expectedVersion} → Advisor.
- PATCH /catalogs/banks/items/:bankId/advisors/:advisorId/status body {moduleCode,status,reason,expectedVersion} → Advisor.

Los ids públicos son ULID válidos, no PK recibidas del navegador. Listas paginadas por servidor (default25,max200), búsqueda y filtros servidor; lista completa navegable, no truncada sin total.

Fuente autoritativa nueva. Nuevo adaptador legacy de Bancos aislado; copia por publicId sin importar bancos antiguos. Con ENABLE_LEGACY_FALLBACK=true, mutar exige también ENABLE_LEGACY_WRITES=true y esquema exacto crmdatabase-api; excepción específica Bancos permite API local como el contrato ya autorizado de Formalización, sin debilitar compuertas de otros catálogos. Una transacción de conexión nativa en el mismo servidor/InnoDB cubre ambas tablas y auditoría. Sin fallback, opera solo nativo explícitamente. No silenciosa divergencia cuando lectura legacy está habilitada y escritura no.

## Plan, reutilización y propiedad

1. Esquema: migrations/schema-only/202611030068_banks_and_advisors.ts y CLI scripts/migrate-legacy-banks.ts, helpers DDL propios revisables y rollback documentado. Registrar solo068, sin ejecutar toda la cadena.
2. Backend: módulo CRM banks, DTO/contratos/servicio/repositorio; puerto/adaptador legacy. Reutilizar IdentityService, RequirePermission, catálogo contextual, DatabaseService, SecurityAuditService/buildAuditChangeSet. No SQL legacy dentro del core.
3. Frontend: BanksPage y panel/formularios en administration/banks, servicio BFF tipado, rutas y permisos existentes, tema EnterpriseSurface y componentes Ant Design. No proveedores externos ni formularios ERP. Reutilizar autorización de catálogo con restricción adicional de rol.
4. Integración: menú/permisos/guardas, tipos y registro AppModule; revisar diff sin tocar trabajo concurrente de calendario/órdenes/perfil.
5. QA: RED/GREEN de permisos/DTO y flujos UI; SQL aislado para integridad/versiones/rollback/mirror; lint,typecheck,tests,build focalizados y comando raíz con fallos ajenos separados.
6. Tras pruebas y revisión independiente, aplicar solo068 y tablas legacy autorizadas; verificar ledger, columnas, índices y grants por SELECT. Sin fixtures comerciales ni deploy.

## Estilo y comandos

pnpm por app, TypeScript estricto, NestJS+Kysely/mysql2, React/Vite+Ant Design. Mutaciones con actor de sesión y motivo, nunca permisos/actor enviados por cliente. Validar antes de SQL y conservar límites/cargas/errores/revocación. Ejemplo de patrón existente: getCatalogPermissionCode(context,definition,action), sql parametrizado y audit.record dentro de la transacción.

Desde apps/api o apps/frontend: pnpm lint, pnpm typecheck, pnpm test, pnpm build. Root: .\check-all.cmd. Las suites focalizadas se registrarán por archivo y resultado real. No considerar mocks, skip o build como confirmación de persistencia real.

## Rollback y límites

Antes de aplicar: revisar tipos, índice único, FK, motor, tablas existentes compatibles, roles/grants y actor Owner. DDL MySQL confirma implícitamente; reintento debe reconocer solo esquema compatible y preservar tablas/datos. Rollback requiere detener escritor, respaldar tablas y grants delta, retirar primero FK/hija y luego padre por BD, revocar solo grants creados por068 y conservar auditoría/ledger. No ejecutar DROP como parte del plan ni perder datos por retry.

Las tablas/permiso nuevos están autorizados en esta solicitud; no se autorizan cambios destructivos, credenciales, producción de otros módulos ni envío de mensajes. Pruebas con cuentas reales y navegador se separan de unidades/SQL aislado.

## Resultados

Cierre 2026-11-03: catálogo, API, adaptador legacy aislado y UI implementados en el checkout. El coordinador ejecutó ambas aplicaciones autorizadas al servidor compartido con salida 0: CLI legacy y migración nativa068 seleccionada. SELECT posterior confirmó `crm_bank` y `crm_bank_advisor` InnoDB en `CRM_THINK_V2` y `crmdatabase-api`, 20 grants Owner y 20 Jefe General exclusivamente, y 0 filas comerciales en las cuatro tablas. Sin despliegue ni importación.

Evidencia de cierre comunicada por el coordinador:

- Verificación final: API/esquema 60/60; repositorio con SQL real 12/12; frontend Bancos, permisos, navegación y cliente HTTP 74/74 en 8 archivos. ESLint focal de Bancos, migración y pruebas aprobado.
- Typecheck y build frontend aprobados. Typecheck global API bloqueado por error ajeno en `calendar-lookup.service.spec.ts:307`. Build API final aprobado. Ledger068: `2026-11-03T22:48:25.226Z`; auditoría `role_permissions_replaced`: `22:48:25.065Z`; 20 permisos activos confirmados por SELECT.
- check-all encontró formato en `banks.module.ts`, corregido, y 5 archivos ajenos pendientes (log check-all-final); no declarar verde global.
- Visual real confirmada con Owner en `/home/formalization/catalogs/banks`: lista vacía sin error; Nuevo Banco abre Nombre, Motivo máximo255 e información de auditoría; cancelar cierra sin crear. Las mutaciones UI sobre RDS no se probaron deliberadamente para evitar fixtures compartidas.

`reason`: 3 a 255 caracteres después de trim, consistente con DTO/OpenAPI. Logs locales en `C:/codex-data/tmp/crm-banks-20261103/`: `sql-final.log`, `api-tests-final.log`, `ui-tests-final.log`, `banks-lint-final.log`, `api-build-final.log` y `frontend-build-final.log`. La instancia QA exclusiva 3311 se detuvo al terminar. Estos checks no acreditan despliegue.

## Esquema068: ejecución y recuperación

La definición compartida `migrations/schema-only/banks-schema.ts` crea las mismas columnas en ambas BD. `SHOW CREATE TABLE` debe coincidir con el contrato completo (columnas, comentarios, defaults, claves, FK, CHECK y collation); se normalizan únicamente representación SQL y contador AUTO_INCREMENT. Una tabla incompatible bloquea todo el plan antes de crear la otra. Si DDL se interrumpe entre padre/hija, repetir reconoce únicamente la tabla compatible; no modifica datos ni usa `CREATE IF NOT EXISTS`.

068 primero valida destino nativo, seis tablas de seguridad InnoDB, roles activos Owner/Jefe General, actor Owner activo y definiciones de permisos existentes. Después crea tablas ausentes, con sesión UTC y `lock_wait_timeout=10`. DDL confirma implícitamente en MySQL; luego permisos, grants nuevos, versiones y auditoría se escriben en una transacción separada. Un fallo de auditoría revierte DML y deja DDL recuperable. Grants inactivos existentes se conservan; no cambia denies, usuarios, membresías ni techos de módulo. La auditoría registra exactamente `createdPermissionCodes` y `createdGrants` para recuperación.

Comandos especificos usados para la aplicacion autorizada, desde `apps/api` (no repetir por leer este documento):

```powershell
$env:MIGRATION_CONFIRM_SCHEMA_ONLY = 'CRM_THINK_V2'
pnpm exec tsx scripts/run-schema-migrations.ts --only=202611030068_banks_and_advisors
pnpm exec tsx scripts/migrate-legacy-banks.ts --plan
pnpm exec tsx scripts/migrate-legacy-banks.ts --apply=crmdatabase-api
```

El CLI usa DB_HOST/DB_PORT/DB_USER y TLS del runner nativo, pero fija exclusivamente `crmdatabase-api`. No usa LEGACY_DB_HOST alternativo ni ejecuta grants legacy; requiere el mismo servidor aprobado. `--plan` inspecciona sin DDL. El lock asesor propio tiene espera máxima10 segundos; el MDL de apply también10 segundos. No ejecutar toda la cadena por incorporar068.

Rollback manual, nunca automático: detener escritores Bancos; respaldar ambas tablas en cada BD y exportar el evento `role_permissions_replaced` cuyo metadata.migration es `202611030068_banks_and_advisors`. Inspeccionar `createdGrants` y verificar que cada grant conserva la configuración creada antes de revocarlo; no seleccionar por prefijo porque podría afectar grants preexistentes. Dentro de una transacción nativa, inactivar exclusivamente los pares role/code de ese delta, incrementar versiones activas y registrar auditoría de reversión con actor/motivo. Conservar definiciones de permiso, auditoría y ledger: no borrar historia. Si hubo cambios posteriores, reconciliar manualmente antes de revocar.

Solo tras respaldo/restauración ensayada y aprobación destructiva independiente, el orden físico de retirada es:

```sql
DROP TABLE `crmdatabase-api`.`crm_bank_advisor`;
DROP TABLE `crmdatabase-api`.`crm_bank`;
DROP TABLE `CRM_THINK_V2`.`crm_bank_advisor`;
DROP TABLE `CRM_THINK_V2`.`crm_bank`;
```

Estos DROP se documentan, no se ejecutan. Al conservar ledger, recrear requeriría procedimiento aprobado específico; el runner omite migraciones registradas. No borrar ledger para forzar replay general.

### Evidencia del esquema068 (QA local, 2026-11-03)

- RED real: seis pruebas de comportamiento fallaron con stubs antes de implementar; primer SQL real detectó plegado de esquema Windows. El guard acepta diferencias de mayúsculas únicamente si `@@lower_case_table_names` declara nombres insensibles; con0 conserva coincidencia exacta.
- GREEN focal: `pnpm exec vitest run test/migrations/banks-and-advisors.spec.ts test/migrations/identity-schema-migration.spec.ts`:34/34. Incluye actor previo al DDL, drift, retry sin escrituras, grant inactivo preservado, rollback de permisos si falla auditoría, parser CLI estricto y casefold0/1.
- SQL real aislado: instancia MariaDB loopback3311 preparada específicamente para QA, sin tocar RDS ni3309. `RUN_BANKS_MYSQL_QA=3311` + `pnpm exec vitest run test/migrations/banks-schema.mysql.spec.ts`:1/1 ejecutada. Aplicó solo068 con ledger y creó tablas legacy; verificó SHOW CREATE/retry,20 permisos/40 grants únicamente Owner/General, una auditoría tras repetir, unicidad CI de nombre/correo, CHECK de estado, FK y RESTRICT al borrar banco. Datos de negocio de prueba dentro de transacciones revertidas:0 bancos/ejecutivos en ambas BD al cerrar.
- Build y ESLint focal del esquema aprobados; los resultados globales posteriores figuran en Resultados.
- El test SQL está omitido por defecto y conecta solo a127.0.0.1:3311 sin leer `.env`; ejecutarlo requiere esa instancia QA dedicada. Esta evidencia local no acredita persistencia en servidor compartido ni aceptación E2E.
