# Changelog

## Unreleased - Continuidad de sesion local y cambios de acceso - 2026-10-13

- Los cambios de acceso invalidan la autorizacion anterior mediante la version
  de permisos, sin cerrar una identidad todavia activa. El refresh valida los
  estados vigentes y la siguiente lectura obtiene los permisos actuales.
- Se conservan el vencimiento absoluto, la rotacion y las revocaciones por
  logout, bloqueo, desactivacion o reutilizacion de tokens. No se rehabilitan
  sesiones ya revocadas bajo la regla anterior.
- Regresiones de login local, recarga, errores de red y renovacion de permisos;
  pruebas HTTP con MySQL y cookie jar aislado, usando rollback.
- Solo un refresh rechazado con 401 produce anonimato. Errores de red, servidor
  o CSRF conservan la URL y muestran el problema de acceso sin forzar login ni
  repetir automaticamente el POST de rotacion.

## Unreleased - Avisos de acceso dentro del layout - 2026-10-13

- Una sesion valida conserva cabecera y menu ante una vista sin permiso o una
  URL inexistente; el aviso aparece exclusivamente dentro del contenido.
- El aviso no cierra sesion ni solicita iniciar sesion nuevamente. El retorno
  utiliza una ruta permitida del perfil, sin montar la pagina protegida.
- La autorizacion de rutas reutiliza el menu filtrado por permisos efectivos;
  las validaciones del API y el tratamiento de sesiones expiradas se conservan.
- Sin modificaciones de la linea grafica del menu, permisos persistidos o DB.

## Unreleased - Acciones de catalogos por permiso - 2026-10-13

- Cabecera, tabla y detalle ocultan las acciones sin permiso efectivo scoped;
  lectura no concede alta, edicion o cambio de estado. Reactivar usa update;
  inactivar usa inactivate. Revalidacion al abrir/enviar y ante foco.
- Formularios vinculados a su modulo/catalogo; se descartan al cambiar de
  contexto. Volver a paginas cacheadas no consulta perfil ni listado nuevamente.
- API exige grant exacto incluso para Owner, conservando solo su exencion de
  membresia. Deny prevalece; rutas compartidas y dedicadas cubiertas por HTTP.
- Sin cambios de estilos/menu, grants persistidos, migraciones o datos legacy.

## Unreleased - Autorizacion de Usuarios y Roles - 2026-10-13

- Controles de Usuarios y Roles dependen de permisos efectivos, sin conceder
  acciones por nombre de rol ni datos de demostracion ante errores de carga.
- Alta con roles requiere `user.create` y `role.assign`; editar datos requiere
  `user.update` y cambiar roles/modulos requiere tambien `role.assign`.
- Activar exige `user.activate`; bloquear/inactivar exige `user.deactivate`.
  Se preservan las restricciones de autoedicion y proteccion de Owner.
- Regresiones de interfaz, servicios y HTTP con servicios reales verifican
  rechazos y ausencia de escrituras no autorizadas. Evidencia y limites en API 36.

## Unreleased - Clave inicial privilegiada - 2026-10-13

- Alta de usuario admite clave inicial manual opcional con privilegio sensible
  `user.assign_password` ademas de `user.create`, solo para acceso local.
- Argon2id y activacion local transaccional; password/hash no se devuelven ni
  entran al snapshot auditable. Sin clave se conserva el flujo pendiente.
- Migracion 018 registra el permiso, lo concede inicialmente solo a Owner y
  versiona sus perfiles para revalidacion. No modifica claves existentes ni
  implementa claves temporales/cambio obligatorio.

## Unreleased - Formalizacion Inicio - 2026-10-13

- Rol `formalizacion` y permiso exclusivo `formalizacion.home.read`, agrupado
  bajo Formalizacion / Inicio. Migracion puntual 017 transaccional y auditable,
  sin altas de usuarios, cambios legacy ni grants de secciones operativas.
- Alta de perfil con modulo Formalizacion por defecto si no se especifica area;
  Inicio separado de permisos de Expedientes/Resumen y sin datos comerciales.
- Regresiones de navegacion, alta, catalogo de permisos, denegacion de inventario
  y catalogos; MySQL opt-in rollback-only para idempotencia, grants y auditoria.
- Requisitos de habilitacion futura documentados en API 36 y frontend 27. No
  habilita contratos, expedientes, catalogos, integraciones o despliegue.

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
