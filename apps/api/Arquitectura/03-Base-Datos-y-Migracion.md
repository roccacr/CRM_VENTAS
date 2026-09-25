# 03 - Base de Datos y Migracion

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

## Tablas base

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
LEGACY_CRM_DB_USER = usuario separado de solo lectura, obligatorio si legacy esta activo
```

No se cambia `DB_NAME` para leer legacy. Si ambas bases viven en el mismo servidor MySQL, legacy reutiliza `DB_HOST`, `DB_PORT`, `DB_SSL` y `DB_SSL_CA`; el schema/base vive en `LEGACY_CRM_DB_NAME` y las credenciales de lectura viven en `LEGACY_CRM_DB_USER` / `LEGACY_CRM_DB_PASSWORD`.

Fases:

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
