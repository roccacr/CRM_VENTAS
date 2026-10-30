# 03 - Base de Datos y Migracion

Ampliacion posterior del27:039 de notas aplicada y conciliada; el runner contiene
ahora37 migraciones. Siete tablas nuevas vacias; sin triggers privilegiados,
imports, grants, runtime o cambios legacy. Ver [diccionario de notas](Diccionario-Datos/12-Notas-Colaborativas.md).
El inventario de36 siguiente conserva el corte anterior a esta entrega.


## Corte de codigo y documentacion - 2026-10-27

Revision de los archivos actuales, sin conexion MySQL ni ejecucion de migraciones.
Los resultados fechados de reset, recuperacion, limpieza y esquema conservan su
fecha: no describen los conteos de hoy. Autoridad vigente: [49](49-Estado-Actual-y-Cierre-Documental.md).

El runner `scripts/run-schema-migrations.ts` registra **36 migraciones**, con
sufijos 001, 003-025 y 027-038; los saltos de numeracion no son pendientes por
completar. Estar en `schemaMigrations` no acredita aplicacion en un servidor.
El ledger `conf_schema_migration` es evidencia de ejecucion, no un validador de
compatibilidad ni una restauracion de catalogos vaciados despues de migrar.

| Tramo registrado | Responsabilidad real |
| --- | --- |
| 001, 003-006 | Identidad, acceso local/Microsoft, directorio y politica de roles |
| 007-016 | Catalogos, reparacion Owner, tablas dedicadas de siete dominios y nombre de expedientes |
| 017-020 | Formalizacion, contrasena inicial, jefatura y banner de aprobaciones |
| 021-025 | Ordenes, fechas UTC, auditoria central y permisos de contratos |
| 027-030 | Herencia Owner, roles Mercadeo, modulos y plantilla de Jefe General |
| 031-034 | Leads, contactos, etapas/motivos, historia y calendario nativo |
| 035 | `crm_sales_order.lead_id_sales_order` nullable, indice y FK a `crm_lead.id_lead`; no rellena relaciones |
| 036 | Responsable por visita, snapshot, vista de duraciones y restauracion solo de catalogos tecnicos vacios |
| 037 | Definicion `formalizacion.orders.stage.update`, sin grants automaticos a roles de negocio |
| 038 | Retira `mercadeo.appointments.read`, asociaciones y overrides; refresca versiones de permisos |

038 no elimina eventos ni Calendario; 028 se conserva como migracion historica.
La confirmacion de aplicacion de 038 y conteos posteriores esta registrada en
[53](53-Captacion-Leads-Reporte-Federado.md), no se repitio en esta revision.
El detalle de 035-037 y del runner separado de trayectoria legacy esta en
[52](52-Etapas-Responsables-y-Tiempos.md).

Operacion segura: desde `apps/api`, con autorizacion especifica y destino revisado,
`pnpm migrate:identity:schema --only=<nombre-exacto-registrado>`; requiere
`DB_NAME=CRM_THINK_V2` y `MIGRATION_CONFIRM_SCHEMA_ONLY=CRM_THINK_V2`.
Sin `--only`, el runner selecciona todas las registradas: no usarlo como reparacion
ni para rellenar numeracion. El mutex es `crm_think_v2_schema_migration`.
El control SQL bloquea acceso legacy dentro del runner nativo; no cambia grants
ni protege conexiones independientes. DDL MySQL puede autocommit y requiere
conciliacion ante drift, no borrado o adopcion silenciosa.

La politica vigente separa fuentes y adapta JSON sin importar registros.
[Inicio](46-Mercadeo-Resumen-Leads.md), [citas](48-Mercadeo-Metricas-Citas.md)
y [Captacion](53-Captacion-Leads-Reporte-Federado.md) leen datos federados.
Esto no autoriza los antiguos pasos de promocion/backfill listados como propuesta.
Las escrituras de contratos/etapas son otro alcance, parametrizado y auditado:
no confundirlas con un importador ni con una sincronizacion ERP.

Estado documental 2026-10-22: los resets, recuperaciones y conteos fechados siguientes son evidencia historica, no estado vivo ni instrucciones para repetirlos. `CRM_THINK_V2` es desarrollo en host compartido con produccion `crmdatabase-api`: no ejecutar fixtures alli. No se abrio MySQL, inspecciono `.env` ni ejecuto SQL/003, SQL/004 o SQL/021 en esta revision. Ver [36 - Estado vigente y registro](36-Registro-Entrega-Administracion.md) y [operacion](Operacion-Despliegue-Rollback.md) para limites y compuertas.

## Historical Migration Runbook - 2026-10-09

This describes implemented operations, not permission to execute. See [catalog schema/API](35-Catalog-API-and-Schema.md) and [Administration closure/phased ETL](34-Cierre-Operativo-Administracion-P0-S1.md).

1. Validate `.env` with `src/config/env.validation.ts`. Target `DB_NAME` stays `CRM_THINK_V2`; legacy is separate/read-only. Actual keys are `DB_USER`/`DB_NAME`, not `DB_USERNAME`/`DB_DATABASE`. No Docker. Never commit credentials or source snapshots.
2. Confirm environment, backup/recovery, migration ledger and explicit authorization. Existing `pnpm migrate:identity:schema` also writes security seeds and can invalidate sessions. Catalog migration `202610030007_crm_catalogs` and repair `202610080008_administration_owner_repair` are incremental; preserve history. MySQL DDL can auto-commit, so schema rollback is not guaranteed by transactions.
3. Profile source read-only and freeze a validated extraction. Deduplicate by canonical provider identity, not names. Resolve contradictory fields before writes. Validate lengths/statuses, FK ownership, unique indexes and InnoDB item/reference/audit tables.
4. The retired project bulk importer and its tests were removed. Use only the optional read-only legacy fallback; no automatic import or legacy mutation is provided.
5. Projects cutover: set `MIGRATION_CONFIRM_SCHEMA_ONLY=CRM_THINK_V2` securely, then run `pnpm migrate:identity:schema --only=202610090009_projects_domain`. This targets only the new project migration; it does not replay identity seeds or Owner repair. It refuses non-empty shared project records. It creates dedicated project/reference tables and blocks project records in shared tables. Preserve historical migrations while the other six domains still use them.
6. The isolated read-only mapper preserves signed NetSuite IDs, including -5, -4, -6, -3 for Campaigns. No general seven-catalog importer exists. Subsidiary 63 naming, broker identifier columns and Files property/status/project mapping remain unresolved. Absent Odoo stays unassigned.
7. For documentation-only updates, review links and diff. Runtime validation uses `.\check-all.cmd`; MySQL suites require a separately verified isolated instance and explicit authorization. Never enable fixture flags on the shared development/production host, even for rollback-only tests. See [MySQL CI prerequisites](CI-MySQL-Pruebas.md). Historical runs below do not authorize repeating them.

Architectural/future tables below are not an inventory of implemented commercial runtime.

### Authorized Full Data Reset - 2026-10-09

At the owner's explicit request, all 20 existing tables in `CRM_THINK_V2` were emptied with transactional DELETE, including identity, permissions, sessions, audit and migration history. All table structures and auto-increment counters were retained. A separate post-commit connection confirmed zero rows in every table. No connection to the legacy database was opened by the reset operation.

A local SQL backup and SHA-256 manifest were saved outside Git under the current user's `AppData/Local/CRM-TINK/backups`. File integrity was verified before deletion; restoration has not been tested. Post-reset review identified a backup limitation: the column filter excluded `DEFAULT_GENERATED` timestamps as well as computed columns. Restoring this export would regenerate those timestamps rather than recover their original values; it is not a byte-exact archival backup. Login and authenticated catalog access cannot work until identity is deliberately re-established. The fallback flag remains disabled and dedicated legacy reader access remains a separate prerequisite. Do not automatically rerun migrations or imports after this reset: cleared migration history no longer records the existing schema, and seed operations would repopulate intentionally empty tables.

### Owner-Only Recovery and Seed Policy - 2026-10-09

The approved identity bootstrap contains only `rzuniga@roccacr.com` with the active `owner` role. Active permission definitions, organizational modules and their Owner grants are required authorization configuration, not business seeds. No projects, campaigns, other catalog records, additional users or secondary roles may be seeded. Schema migrations never create users; there is no startup bootstrap.

`pnpm recover:owner` is an explicit recovery operation, not a general production seed. It requires `DB_NAME=CRM_THINK_V2`, `MIGRATION_CONFIRM_SCHEMA_ONLY=CRM_THINK_V2`, `OWNER_RECOVERY_CONFIRM=rzuniga@roccacr.com` and `OWNER_RECOVERY_BACKUP` pointing to the approved local pre-reset SQL artifact. Its SHA-256 is pinned in the script. It refuses nonempty identity configuration and restores only Roberto's original user/authentication rows, one Owner role and active permissions/modules in one transaction. It grants Owner every active permission and every active module with `all_areas` scope. Original password hashes and stable Microsoft identity subjects are preserved without logging them. Sessions, refresh/reset tokens and Microsoft token caches are not restored; sign in again. Backup-generated default timestamps are not original timestamps.

The unrestricted legacy administrator importer was removed. Historical `SQL/002_identity_seed_p0_s1.sql` is not an approved bootstrap and must not be executed: it inserts multiple roles and obsolete permission definitions. Historical migrations remain immutable for existing installations. Migrations 001/003/004/005 are structural, 006 changes security policy, 007 creates shared catalog storage and scoped permissions, 008 repairs Administration/Owner configuration, and 009 creates dedicated Projects storage without business seeds. Do not replay all migrations merely because the ledger was emptied. Use the targeted 009 command above after reviewing actual schema.

Historical state at the 009 cut: six catalog domains still used shared storage. Migrations 010-015 subsequently introduced their dedicated tables/references. Current repositories must be inspected before claiming a runtime dependency on `crm_catalog_item`; the old paragraph is not a current table inventory or authorization to drop shared tables. The historical schema remains preserved.

For a fresh production installation, use a separately approved secure owner bootstrap; do not distribute the backup, create a default password, or bulk-import administrators. Future permissions must be granted to Owner in their reviewed migration. A repository push does not prove deployment or authentication acceptance.

Execution evidence: owner-only recovery committed on 2026-10-09. An independent connection verified one active Roberto user, two active authentication methods (local with the original hash and Microsoft), one Owner role, 195 active permissions with zero missing Owner grants, seven active module memberships, and zero rows in both project tables and both shared catalog tables. The targeted 009 runner confirmed the migration was already applied. No legacy connection was opened. This proves selective identity restoration, not full-backup recovery or a successful interactive login.

## Ampliaciones documentadas - 2026-10-23

El esquema nativo de Leads se documenta en [43](43-Leads-Esquema-Nativo.md): SQL fisico en `migrations/schema-only/202610230031_leads_domain.ts`, no en los plurales del blueprint. Calendario usa [SQL/034](SQL/034_calendar_domain.sql) y su runner `202610230034_calendar_domain.ts`; [47](47-Calendario-Compartido-Esquema.md) registra ocho tablas vacias, 106 columnas comentadas, 27 CHECK, 40 indices y ocho triggers. Son evidencias fechadas, sin nueva consulta MySQL en esta revision. No hay importacion de leads, bitacoras ni calendarios.

La prohibicion de importar administradores sin autorizacion no elimina la excepcion [45](45-Usuarios-Por-Correo.md): 43 perfiles nuevos, 30 pending y 13 inactive, un existente omitido y total nativo 46, segun verificacion del 2026-10-23. La asignacion posterior del rol `ventas` ID 317 a esos 43 no agrega permisos, identidades de acceso ni membresias individuales. No es una autorizacion general de importacion.

Las fases bajo demanda/backfill siguientes son propuestas historicas pendientes de nueva aprobacion; la regla vigente consulta cada origen y adapta un JSON, sin copiar historia. El resumen de Mercadeo ya lee ambas fuentes bajo su permiso y flag, incluyendo citas por tipo y responsable/proyecto del lead ([48](48-Mercadeo-Metricas-Citas.md)); no es migracion. En el snapshot del 2026-10-23 el runner registraba 031-034 y solo se acreditaban 031/032/034 aplicadas: no ejecutar todas las pendientes para completar la numeracion. Ver [49 - Estado actual](49-Estado-Actual-y-Cierre-Documental.md).

## Motor recomendado

MySQL.

## Acceso a datos

Kysely + mysql2.

Prisma no sera la capa principal porque el CRM requiere joins, filtros dinamicos, reportes, consultas pesadas y updates masivos con control fino del SQL.

## Principios

- MySQL/InnoDB como motor de la base nueva del CRM.
- Base nueva confirmada por arquitectura: `CRM_THINK_V2`.
- No usar Docker para levantar la base ni el runtime del proyecto.
- Normalizar la base de datos es regla obligatoria.
- El modelo debe ser legible, entendible y logico para que consultas, joins, filtros y reportes sean mantenibles y rapidos.
- Usar tablas catalogo y relaciones claras antes que strings repetidos o columnas ambiguas.
- Evitar columnas duplicadas con el mismo significado.
- Evitar tablas anchas copiadas del legacy.
- Id interno estable para dominio CRM; si se usan UUID, evitar que sean el clustered PK principal en tablas de alta escritura.
- Datos criticos en columnas fuertes.
- JSON solo para metadata flexible y no para datos criticos de busqueda frecuente.
- No usar nombres NetSuite/Odoo/legacy como tablas o columnas del dominio.
- Toda referencia externa vive en tablas genericas de sistemas/referencias externas.
- Toda relacion interna usa IDs propios del CRM; no se permite relacionar vendedor, lead, oportunidad, estimacion u orden por ids externos.
- Toda sincronizacion critica usa outbox/inbox.
- Repositories deben usar Kysely para SQL tipado.
- SQL raw solo cuando sea necesario y siempre parametrizado.

## Tablas base conceptuales (no inventario fisico)

```txt
sec_user
sec_role
sec_permission
sec_user_role
sec_role_permission
sec_org_unit
sec_user_org_unit
sec_user_permission_override

crm_lead
crm_contact
crm_account
crm_opportunity
crm_activity
crm_calendar_event
crm_estimate
crm_sales_order
crm_contract

audit_business_log
audit_security_event
int_external_system
int_external_reference
int_outbox_event
int_inbox_event
crm_migration_map
crm_custom_fields
crm_custom_field_values
```

## Migracion legacy

La base vieja se trata como integracion temporal:

```txt
src/integrations/legacy-crm/
```

Regla de conexion:

```txt
DB_NAME = CRM_THINK_V2
LEGACY_CRM_DB_NAME = nombre de la base vieja, opcional
ENABLE_LEGACY_FALLBACK = true para activar; false para retirar sin queries legacy
```

No se cambia `DB_NAME` para leer legacy. Por instruccion explicita del propietario, el pool independiente reutiliza `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` y `DB_SSL_CA`; solo cambia el nombre de base a `crmdatabase-api`. Las variables anteriores `LEGACY_CRM_DB_USER` / `LEGACY_CRM_DB_PASSWORD` se ignoran. Las consultas lectoras del adapter usan transacciones de solo lectura. Los seis writers de catalogos usan la transaccion nativa del mismo servidor y requieren `NODE_ENV=production`, `LEGACY_CRM_DB_NAME=crmdatabase-api` y ambos booleanos estrictos `ENABLE_LEGACY_FALLBACK=true` y `ENABLE_LEGACY_WRITES=true` (defaults `false`). El fallback lector no concede escrituras. La cuenta compartida no tiene privilegios exclusivamente de lectura: no cambiar sus grants ni credenciales. Ver contrato y retiro en documento 35.

Fases del blueprint historico (5-6 requieren nueva autorizacion y contradicen la regla actual de no copiar si se ejecutan sin ella):

1. P0: leads nuevos nacen solo en la base MySQL nueva.
2. P0: el CRM legacy no se consulta en el flujo principal.
3. P1: legacy queda como fuente temporal de solo lectura mediante adapter.
4. P1: el API devuelve un JSON estandar aunque los datos vengan de la base nueva o del legacy.
5. P1/P2: migracion bajo demanda cuando se trabaje un registro viejo.
6. P2: backfill historico.
7. P2/P3: apagado legacy por modulo.

## Indices obligatorios iniciales

- estado + fecha en leads.
- owner + estado en leads.
- email normalizado.
- telefono normalizado.
- entidad + fecha en actividades.
- actor + fecha en auditoria.
- provider + external id en referencias externas.
- internal entity type + internal entity id en referencias externas.

## Campos minimos P0 de lead

Basado en la tabla legacy `leads`, los campos nucleo del nuevo CRM deben ser:

- nombre;
- email;
- telefono;
- estado;
- propietario/vendedor;
- proyecto;
- campana;
- subsidiaria;
- comentario;
- fecha de creacion;
- fecha de ultima actualizacion;
- accion o ultimo tipo de seguimiento;
- motivo de perdida cuando aplique;
- indicador de posible relacion con otro lead.

Campos legacy que deben conservarse como referencias o metadata, no como nombres centrales del dominio:

- id externo del ERP;
- id interno legacy;
- id externo de proyecto;
- id externo de subsidiaria;
- id externo de campana;
- id externo de referencia;
- accion de campana externa.

`id_corredor` no entra al nucleo P0 porque en la revision actual aparece sin uso poblado en la tabla de leads.

## Duplicados y relaciones entre leads

El P0 no debe bloquear creacion por duplicados.

Regla P0:

- al insertar un lead, buscar coincidencias por correo o telefono normalizado;
- si existe coincidencia, marcar el nuevo lead con `has_related_lead = true`;
- guardar relacion opcional en una tabla de relaciones;
- no fusionar automaticamente;
- no impedir la creacion;
- no intentar resolver duplicados por proyecto en P0.

## Contrato unificado de datos

El frontend no debe conocer si un registro viene de la base nueva, legacy, NetSuite, Odoo u otro sistema. El API debe normalizar todas las fuentes y responder siempre con campos estandar del CRM.

Ejemplo conceptual:

```txt
LeadResponse
├── id interno CRM
├── source: crm | external
├── externalRefs opcional
├── nombre
├── correo
├── telefono
├── estado
├── owner
├── fechaCreacion
└── metadata controlada
```

La normalizacion de legacy pertenece a `src/integrations/legacy-crm/`. La normalizacion de ERP pertenece a `src/integrations/netsuite/` o `src/integrations/odoo/`. El frontend no debe mapear campos de proveedores externos.

Regla de identidad:

```txt
CRM interno crea y conserva su propio id.
Proveedor externo solo agrega referencia en int_external_reference.
```

Ver `30-Identidad-Canonica-y-Referencias-Externas.md`.

Notas044 aplicada27octubre2026: columnas collaboration_version_note/collaboration_updated_at_note y sec_notification con COMMENT/FK/índices;20 definiciones sin grants. Sin copiar datos legacy. [Contrato60](60-Notas-Etapa4-Colaboracion-y-Notificaciones.md).

Actualización vigente 2026-10-28: [62 - Notas en tiempo real](62-Notas-Tiempo-Real-Implementacion.md). Socket.IO, migración046 aditiva aplicada, campana/hilo/bandejas, recuperación REST y acceso a notas independiente del registro vinculado. Esta actualización sustituye las limitaciones históricas de transporte y acceso de las etapas anteriores. Copia legacy inactiva; Redis multiinstancia y aceptación visual real pendientes.
