# CRM TINK: inicio y continuidad

Actualizado: 2026-10-09. Este repositorio contiene el CRM nuevo NestJS/React. El checkout legacy llamado CRM VENTAS es otro proyecto; no usarlo para ejecutar estos comandos.

## Leer en este orden

1. [Ley de producto](apps/api/Arquitectura/00-Producto-CRM-TINK-y-P0.md): alcance y restricciones.
2. [Traspaso y estado del API](apps/api/Arquitectura/34-Cierre-Operativo-Administracion-P0-S1.md): implementacion, decisiones, riesgos y cierre.
3. [Traspaso frontend](apps/frontend/Arquitectura/25-Continuidad-Administracion.md): pantallas, componentes, contratos y QA.
4. [Indice API](apps/api/Arquitectura/00-Indice.md) e [indice frontend](apps/frontend/Arquitectura/00-Indice.md): diseno completo y vision futura.
5. AGENTS.md raiz y de cada aplicacion antes de cambiar codigo.

## Norte del producto

CRM propio, independiente del ERP, para el expediente comercial Lead -> Oportunidad -> Estimacion -> Orden de Venta -> Contrato. Relaciones por identidad CRM; NetSuite/Odoo son referencias externas y adapters.

Prioridad vigente: cerrar Administracion (usuarios, roles, permisos, auditoria y siete catalogos) con evidencia automatica y validacion Owner. Despues definir contrato NetSuite -> API para Leads. La UI comercial, sincronizacion ERP, jobs, calendarios y notas requieren su fase aprobada. Legacy se consulta solo en lectura; no se migra negocio real por defecto.

## Ejecutar y verificar

Node >=22 y pnpm >=10.28.2. No hay package.json raiz ni workspace Node conjunto. Cada app tiene su lockfile.

Desde cada carpeta: `pnpm install --frozen-lockfile`, luego `pnpm dev`. Configurar primero el entorno con los responsables; no copiar secretos a documentacion.

- API: `apps/api`; defaults de desarrollo bind 127.0.0.1, puerto 3000. Variables y validacion en src/config/env.validation.ts; plantilla .env.example.
- Frontend: `apps/frontend`; Vite. VITE_API_ORIGIN apunta al origen API; en desarrollo default http://localhost:3000. No admite secretos. Mantener localhost coherente con CORS, cookies y callback Microsoft.
- Verificacion completa desde raiz: `.\check-all.cmd`. Ejecuta API y frontend secuencialmente: format:check, lint, typecheck, test, build.
- Comando por app: `pnpm check`. Los checks no acreditan despliegue, migracion ni aceptacion real.

No ejecutar migraciones, importaciones, commit, push o deploy sin autorizacion especifica. El runner de migraciones escribe datos de seguridad ademas de esquema; su nombre schema-only no significa solo lectura.

## Estado de entrega

El codigo administrativo existe y tiene pruebas; su cierre operativo sigue pendiente de sesion Owner, navegador, API y MySQL reales. Consultar el registro de verificaciones del documento 34 para resultados de esta entrega.

Git history and remote branch status determine what is backed up. A commit/push is not a deployment, database migration, or operational acceptance.

Las tablas de horas reconstruidas en el chat para 24/09, 25/09, 01/10 y 02/10 no prueban fechas de implementacion. Ver su registro resumido en el documento 34.

## Current Implementation - 2026-10-09

- Administration includes users, roles/security, audit and seven shared catalogs: projects, campaigns, classes, brokers, files, subsidiaries and locations.
- Catalog screens reuse the users DataTables/SearchPanes styling, persistence and pagination. Filters apply to loaded rows; additional batches use `offset` and an authoritative filtered `total`. This is not full-dataset remote filtering or snapshot pagination.
- Detail Drawers follow the users pattern, with separate provider sections and explicit unassigned values. Empty Odoo identifiers require no configured Odoo provider; non-empty references require an active provider.
- Updates retain unchanged reference row identity, archive removed references, restore references belonging to the same item and return HTTP 409 for conflicting ownership. Database uniqueness is catalog + provider + external ID, including archived ownership, not global across catalogs.
- Access replacement revokes sessions/refresh credentials and increments permission versions atomically with role/membership changes and audit. Protected operations resolve the authoritative current profile.
- Incremental migrations add catalog persistence and repair Administration/Owner linkage. Applying migrations is a separately authorized operation, not part of startup or push.
- The project-only sync runner defaults to rollback. Complete seven-catalog ETL remains pending mapping decisions; valid negative campaign NetSuite IDs must be preserved exactly. No Odoo identifier is fabricated.

See [CHANGELOG](CHANGELOG.md), [migration guide](apps/api/Arquitectura/03-Base-Datos-y-Migracion.md), [catalog API/schema](apps/api/Arquitectura/35-Catalog-API-and-Schema.md), and the closure/continuity documents above.

API configuration uses `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` and `DB_SSL_CA`, validated by `env.validation.ts`. Legacy access uses separate read-only `LEGACY_CRM_*` settings. Use app `.env.example` templates; real `.env` files stay untracked. These catalog changes require no Docker, new Odoo credentials or new database environment keys.

Recorded baseline: API 227 tests, frontend 120 tests and seven separately enabled rollback-only MySQL catalog tests; formatting, lint, typecheck and builds passed. The frontend bundle-size warning remains. Measured coverage and remaining acceptance gates live in document 34; test totals do not imply full coverage.
