# Changelog

## Unreleased - Consolidacion 2026-10-13

### Implementado

- Campanas, Clases, Ubicaciones, Subsidiarias y Corredores adoptan el patron dedicado de Proyectos: carpeta de dominio, referencias multiproveedor, lazy promotion y sincronizacion legacy autorizada. Corredores excluye columnas obsoletas.
- Catalogos pasan a paginas acotadas con cache local, sin Cargar mas; Expedientes usa criterios previos, cursor, facetas del alcance completo y detalle bajo demanda.
- Expedientes conserva 27 valores de negocio y FK al proyecto CRM; comparacion visual por campo, semaforo/flechas y enlace seguro a Planos. Lectura solamente, sin importacion masiva ni escrituras de inventario.
- Roles y seguridad usa selectores modulo/seccion y pestanas de catalogo, tanto por rol como por empleado.
- Auditoria incorpora snapshots seguros antes/despues, diferencias, actor/roles historicos, contexto y registro, consulta paginada y textos comprensibles.
- Cliente API deja de repetir conflictos 409 de negocio; conserva un reintento para sesion de permisos obsoleta, protecciones Owner y CSRF. Errores de red no repiten mutaciones y advierten resultado incierto. Notification usa title.

### Documentacion y limites

- Registro integral API 36, contrato de auditoria 37 y guia frontend 27 enlazan solicitudes, codigo, pruebas, reglas, decisiones y pendientes. README e indices actualizados; entradas anteriores permanecen como evidencia historica.
- Ultima evidencia anterior a esta consolidacion: frontend check con 257 pruebas y 13 pruebas API de acceso aprobadas. Check global bloqueado por formato preexistente en unit-files-search.spec.ts; reset de conexion no reproducido. No son resultados de una ejecucion documental nueva.
- Pendientes: aceptacion manual, reconciliacion externa, relaciones ambiguas e importacion de inventario, optimizacion medida de indices, conectores ERP y despliegue. No se hicieron cambios productivos por documentar.

## Unreleased - 2026-10-09

### Added

- Guarded, checksum-pinned recovery of Roberto's original Owner identity without other users, business seeds or session/token restoration; owner-only seed policy documented.

- Administration catalog API, typed Kysely persistence, scoped permissions and atomic security audit for seven catalogs.
- Incremental catalog schema and Administration Owner-linkage repair migrations, preserving prior history.
- Independent project aggregate and provider-reference tables, with targeted empty-schema migration and rollback-only MySQL tests.
- Catalog detail Drawer matching users, separate provider sections and explicit unassigned values.
- Opt-in rollback-only MySQL regressions for catalog persistence, access replacement and Administration repair.

### Changed

- Projects legacy records are editable with lazy native promotion and atomic same-server synchronization, gated together with reads by one global legacy switch. Creates retain generated legacy IDs; native-only edits do not create legacy counterparts. Existing permissions/audit remain mandatory and no delete route is introduced.

- Projects now owns its Nest controller/service/repository and fallback in a dedicated feature folder. Legacy Projects and Campaigns own separate readers and mappers; shared pools, permission policy and existing HTTP contracts are preserved without schema/data changes.

- Legacy reads now reuse DB credentials in an isolated read-only transaction pool; Projects append unmigrated legacy rows with native precedence and native-first pagination. The optional adapter remains removable and local fallback is explicitly enabled.

- Removed the unrestricted legacy administrator importer. Active security configuration remains separate from business catalog seeds.

- Projects persistence now uses dedicated tables; shared tables reject project records and remain for the other six domains. Retired bulk importer and obsolete importer tests removed. API contracts and audit transactions preserved.

- Catalog listing supports offset and authoritative filtered totals. Shared screens reuse users SearchPanes, isolated saved state and incremental loading.
- Responsive navigation, authorization-aware routes, user/role management and audit views are included in the Administration delivery.

### Fixed

- Reference editing retains unchanged identities, archives/removes/restores references without changing ownership and returns controlled uniqueness conflicts.
- Empty optional Odoo IDs no longer block unrelated edits; non-empty IDs still require an active provider.
- Access replacement explicitly revokes sessions and refresh tokens with atomic audit rollback.
- SearchPanes initialize with loaded data and escaped textual labels instead of React DOM objects.

### Verification and Limits

- Recorded baseline: API 227 passing tests, frontend 120, seven separate MySQL catalog regressions; formatting, lint, typecheck and builds passed. See document 34 for coverage evidence.
- Filters apply to loaded rows; offset pagination is not a concurrent-write snapshot. Uniqueness is per catalog/provider/identifier, including archived ownership, not global across catalogs.
- Full ETL is pending subsidiary 63 naming, broker identifier selection and Files domain mapping. Negative campaign identifiers must be preserved; the project mapper is not a universal importer.
- No deployment, automatic production migration or complete Owner acceptance is implied.
