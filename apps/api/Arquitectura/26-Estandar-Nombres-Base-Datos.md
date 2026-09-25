# 26 - Estandar de Nombres de Base de Datos

## Veredicto

La base `CRM_THINK_V2` debe tener nombres fisicos claros, genericos y neutrales.

El objetivo es que una persona pueda leer una consulta SQL y entender rapidamente:

- a que modulo pertenece la tabla;
- que representa cada columna;
- si el dato es propio del CRM o viene de una relacion;
- si una tabla es de configuracion, operacion, seguridad, auditoria o integracion;
- que no hay dependencia directa de NetSuite, Odoo, Kapso u otro proveedor.

Este documento manda sobre los ejemplos SQL viejos cuando haya diferencia de nombres.

## Reglas principales

1. Todo nombre fisico de tabla o columna debe estar en `snake_case`.
2. No usar espacios, tildes, caracteres especiales ni guiones medios.
3. Los nombres fisicos de tablas, columnas, indices, constraints y codigos internos deben estar en ingles canonico y neutral.
4. Los comentarios MySQL, diccionario de datos, documentacion funcional y textos de UI deben estar en espanol claro.
5. No usar nombres de proveedores externos en tablas o columnas core:
   - prohibido: `netsuite`, `odoo`, `kapso`;
   - permitido: `external_system`, `external_reference`, `provider_code`.
6. No usar nombres legacy mal escritos o ambiguos:
   - prohibido: `segimineto`, `caida`, `accion_lead`, `idnetsuite`, `idinterno`;
   - permitido: `status`, `action`, `reason`, `timeline`, `external_reference`.
7. Las columnas deben llevar sufijo de entidad para evitar ambiguedad en consultas con joins.
8. Todas las columnas deben tener `COMMENT` en MySQL explicando en espanol que registra y para que sirve.
9. Siempre que se pueda normalizar la base de datos, se debe normalizar.
10. Las relaciones internas deben usar IDs propios del CRM, nunca IDs externos de proveedores.
11. El API y el frontend no tienen que copiar estos nombres fisicos. El contrato publico sigue siendo canonico y limpio.

## Idioma oficial de la base

Decision:

```txt
nombres fisicos = ingles canonico
comentarios/documentacion/UI = espanol
```

Ejemplo correcto:

```txt
tabla: sec_user
columna: status_user
valor interno: active
comentario MySQL: Estado operativo del usuario dentro del CRM.
texto UI: Activo
```

Motivo:

- el codigo NestJS, Kysely, librerias, permisos y patrones enterprise trabajan mejor con nombres tecnicos en ingles;
- evita tildes, variantes, genero/plural y terminos ambiguos;
- mantiene contratos mas faciles de leer para futuros equipos tecnicos;
- jefatura y usuarios siguen leyendo espanol en UI, comentarios y diccionario;
- separa el idioma tecnico del idioma de negocio.

Regla:

```txt
La base no guarda numeros magicos para estados.
Guarda codigos legibles: active, inactive, blocked, pending.
La UI traduce esos codigos a espanol.
```

## Nombre de base de datos

Nombre oficial:

```txt
CRM_THINK_V2
```

No usar:

```txt
nombres de base con guion medio
```

Motivo: el guion medio obliga a usar backticks y complica scripts, consultas y herramientas.

## Prefijos de tablas

Cada tabla debe iniciar con un prefijo de dominio.

| Prefijo | Uso | Ejemplos |
| --- | --- | --- |
| `crm_` | Datos operativos centrales del CRM. | `crm_lead`, `crm_contact`, `crm_lead_relation` |
| `conf_` | Configuracion, catalogos, estados, tipos y motivos. | `conf_lead_status`, `conf_lead_source`, `conf_action_reason` |
| `sec_` | Seguridad, usuarios, roles, permisos y sesiones. | `sec_user`, `sec_role`, `sec_permission` |
| `audit_` | Auditoria tecnica, timeline, cambios y bitacoras. | `audit_lead_timeline`, `audit_field_change`, `audit_security_log` |
| `int_` | Integraciones externas de forma generica. | `int_external_system`, `int_external_reference`, `int_outbox_event` |
| `job_` | Procesos internos, colas logicas y ejecuciones futuras. | `job_execution`, `job_retry` |

Regla:

- configuracion siempre usa `conf_`;
- seguridad siempre usa `sec_`;
- auditoria siempre usa `audit_`;
- integraciones siempre usan `int_`;
- datos comerciales propios usan `crm_`.

## Singular o plural

Las tablas deben nombrarse en singular.

Correcto:

```txt
crm_lead
crm_contact
conf_lead_status
sec_user_role
audit_lead_timeline
int_external_reference
```

Evitar:

```txt
crm_leads
crm_contacts
lead_statuses
external_references
```

Motivo: en joins y nombres de columnas el singular reduce ruido y mantiene la entidad clara.

## Regla de normalizacion obligatoria

La base del CRM debe disenarse normalizada por defecto.

Regla principal:

```txt
normalizar primero -> medir problemas reales -> justificar excepcion -> aprobar ADR -> desnormalizar solo si aporta valor comprobado
```

Esto significa:

- no repetir datos de persona dentro de varias tablas si pueden vivir en `crm_contact`;
- no guardar estados, motivos, tipos u origenes como texto libre si deben vivir en tablas `conf_`;
- no guardar listas relacionales dentro de columnas `JSON` si se van a filtrar, auditar o consultar por separado;
- no duplicar datos del lead en oportunidad, estimacion, orden o contrato sin una razon documentada;
- no mezclar configuracion, operacion, auditoria e integracion dentro de la misma tabla;
- no copiar la estructura del CRM viejo si mezcla responsabilidades;
- no usar columnas "comodin" para evitar crear una relacion correcta.

Cuando si se permite una excepcion:

- una consulta critica ya fue medida y la normalizacion causa un problema real;
- existe evidencia con `EXPLAIN`, volumen esperado o metrica de rendimiento;
- la alternativa normalizada ya fue evaluada;
- se documenta un ADR explicando la razon, impacto y rollback;
- el dato duplicado tiene una estrategia clara de consistencia.

Regla corta:

```txt
Si no hay evidencia, no se desnormaliza.
```

## Regla de identidad interna y referencias externas

Las llaves foraneas internas siempre apuntan a tablas internas del CRM.

Correcto:

```txt
crm_lead.owner_user_id_lead -> sec_user.id_user
crm_opportunity.lead_id_opportunity -> crm_lead.id_lead
crm_estimate.opportunity_id_estimate -> crm_opportunity.id_opportunity
crm_sales_order.estimate_id_sales_order -> crm_estimate.id_estimate
```

Incorrecto:

```txt
crm_lead.owner_user_id_lead -> idnetsuite_admin
crm_opportunity.lead_id_opportunity -> external_id de NetSuite
crm_sales_order.estimate_id_sales_order -> id de Odoo
```

Los ids externos viven en:

```txt
int_user_external_identity
int_external_reference
```

Ver `30-Identidad-Canonica-y-Referencias-Externas.md`.

## Regla de sufijo para columnas

Cada columna debe terminar con el sufijo de la entidad principal de la tabla.

Formato general:

```txt
<atributo>_<entidad>
```

Ejemplo para tabla `crm_contact`:

```txt
id_contact
public_id_contact
full_name_contact
email_contact
normalized_email_contact
phone_contact
normalized_phone_contact
country_code_contact
created_at_contact
updated_at_contact
deleted_at_contact
```

Ejemplo para tabla `crm_lead`:

```txt
id_lead
public_id_lead
primary_contact_id_lead
owner_user_id_lead
project_id_lead
campaign_id_lead
source_code_lead
status_code_lead
operational_state_code_lead
has_related_lead
created_at_lead
updated_at_lead
deleted_at_lead
```

## Comentarios obligatorios en columnas

Toda columna creada en `CRM_THINK_V2` debe tener comentario fisico de MySQL.

Formato obligatorio:

```sql
<column_name> <data_type> ... COMMENT '<que registra y para que sirve>'
```

Regla:

- no se aprueba ninguna migracion con columnas sin `COMMENT`;
- el comentario debe explicar el proposito de negocio o tecnico de la columna;
- no repetir solamente el nombre de la columna con otras palabras;
- si el campo es FK, explicar que relacion representa;
- si el campo es bandera, explicar cuando vale `1` y cuando vale `0`;
- si el campo es fecha, explicar el evento que marca;
- si el campo guarda datos sensibles, indicarlo en el comentario;
- si el campo existe para auditoria, integracion o rendimiento, decirlo explicitamente.

Ejemplo correcto:

```sql
CREATE TABLE crm_lead (
  id_lead BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno numerico del lead para relaciones y rendimiento de la base.',
  public_id_lead CHAR(26) NOT NULL COMMENT 'Identificador publico del lead usado por API y frontend para no exponer el id interno.',
  primary_contact_id_lead BIGINT UNSIGNED NOT NULL COMMENT 'Contacto principal asociado al expediente comercial del lead.',
  project_id_lead BIGINT UNSIGNED NOT NULL COMMENT 'Proyecto de interes seleccionado para este lead.',
  campaign_id_lead BIGINT UNSIGNED NOT NULL COMMENT 'Campana comercial que origino o clasifica este lead.',
  source_code_lead VARCHAR(80) NOT NULL COMMENT 'Codigo legible del origen donde nacio el lead, por ejemplo website, facebook o crm_manual.',
  has_related_lead TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Indica si el sistema detecto o marco una posible relacion con otro lead; 1 significa que existe relacion posible.',
  created_at_lead DATETIME(3) NOT NULL COMMENT 'Fecha y hora en que se creo el lead dentro del CRM nuevo.',
  PRIMARY KEY (id_lead)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Expediente comercial inicial del cliente dentro del CRM.';
```

Ejemplo incorrecto:

```sql
CREATE TABLE crm_lead (
  id_lead BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id_lead BIGINT UNSIGNED NOT NULL,
  created_at_lead DATETIME(3) NOT NULL,
  PRIMARY KEY (id_lead)
);
```

Motivo: aunque el nombre sea claro, la base debe explicar formalmente el uso de cada campo para futuros ingenieros, analistas, soporte y auditoria.

## Llaves primarias

La llave primaria interna usa:

```txt
id_<entidad>
```

Ejemplos:

```txt
id_lead
id_contact
id_user
id_role
id_lead_status
id_action_reason
```

Regla tecnica:

- tipo recomendado: `BIGINT UNSIGNED AUTO_INCREMENT`;
- no usar UUID como PK clustered;
- si se necesita id publico, usar una columna adicional.

## Identificador publico

El identificador publico usa:

```txt
public_id_<entidad>
```

Ejemplos:

```txt
public_id_lead
public_id_contact
public_id_user
```

Motivo:

- el API/frontend usan identificadores publicos;
- la base conserva PK numerica eficiente;
- no se exponen ids internos.

## Llaves foraneas

Las llaves foraneas deben indicar la entidad referenciada y terminar con el sufijo de la entidad dueña.

Formato:

```txt
<entidad_referenciada>_id_<entidad_duena>
```

Ejemplos en `crm_lead`:

```txt
primary_contact_id_lead
owner_user_id_lead
project_id_lead
campaign_id_lead
```

Ejemplos en `audit_lead_timeline`:

```txt
lead_id_lead_timeline
actor_user_id_lead_timeline
action_reason_id_lead_timeline
```

Motivo: en consultas con muchos joins se sabe cual tabla posee la columna sin depender del alias.

## Codigos de catalogo

Los catalogos de configuracion usan columnas legibles:

Ejemplo `conf_lead_status`:

```txt
id_lead_status
code_lead_status
name_lead_status
sort_order_lead_status
active_lead_status
created_at_lead_status
updated_at_lead_status
```

Reglas:

- el frontend y API nunca envian enteros magicos para estados, tipos o motivos;
- usar `code_*` para decisiones tecnicas;
- usar `name_*` para texto visible;
- usar `sort_order_*` cuando se requiera orden configurable;
- usar `active_*` para activar/desactivar catalogos.

## Fechas y auditoria basica

Las fechas tambien llevan sufijo de entidad.

Formato:

```txt
created_at_<entidad>
updated_at_<entidad>
deleted_at_<entidad>
```

Ejemplos:

```txt
created_at_lead
updated_at_lead
deleted_at_lead
created_at_contact
updated_at_contact
deleted_at_contact
```

Regla:

- usar `DATETIME(3)`;
- evitar `TIMESTAMP` salvo justificacion tecnica;
- `deleted_at_*` aplica a entidades principales con borrado logico.

## Tablas de configuracion

Todo catalogo, estado, motivo, tipo o valor parametrizable debe iniciar con `conf_`.

Ejemplos:

```txt
conf_lead_status
conf_lead_source
conf_action_type
conf_action_reason
conf_project
conf_campaign
conf_operational_state
```

Regla:

- si negocio puede agregar, desactivar, ordenar o renombrar un valor, probablemente es `conf_`;
- no usar `ENUM` para estados comerciales, motivos, tipos de accion o origenes;
- usar tablas catalogo para permitir crecimiento sin cambiar estructura.

## Tablas core CRM

Las tablas transaccionales propias del CRM usan `crm_`.

Ejemplos P0-S1:

```txt
crm_contact
crm_lead
crm_lead_relation
crm_lead_operational_state
```

Regla:

- `crm_` guarda hechos operativos del CRM;
- no debe guardar nombres de proveedor externo;
- no debe mezclar configuracion que pertenece a `conf_`;
- no debe mezclar auditoria que pertenece a `audit_`.

## Tablas de seguridad

Las tablas de identidad y permisos usan `sec_`.

Ejemplos:

```txt
sec_user
sec_role
sec_permission
sec_user_role
sec_role_permission
```

Columnas ejemplo:

```txt
id_user
public_id_user
email_user
normalized_email_user
full_name_user
active_user
created_at_user
updated_at_user
```

## Tablas de auditoria y bitacora

La historia del lead y los cambios sensibles usan `audit_`.

Ejemplos:

```txt
audit_lead_timeline
audit_lead_field_change
audit_security_log
```

Regla:

- todo cambio o accion contra el lead debe tener motivo;
- la bitacora no debe vivir mezclada dentro de `crm_lead`;
- los snapshots de rol, permiso, seccion y canal deben quedar guardados cuando apliquen.

## Tablas de integracion

Las integraciones usan tablas genericas con prefijo `int_`.

Correcto:

```txt
int_external_system
int_external_reference
int_outbox_event
int_inbox_event
```

Incorrecto:

```txt
netsuite_lead
odoo_reference
crm_lead_netsuite
kapso_sync
```

Regla:

- el proveedor se guarda como dato, no como nombre de tabla o columna core;
- usar `external_system_code_*` o relacion a `int_external_system`;
- los adapters de codigo pueden tener carpetas `netsuite` u `odoo`, pero la base core no.

## Indices y constraints

Nombres recomendados:

```txt
pk_<table_name>
uq_<table_name>_<columns>
ix_<table_name>_<columns>
fk_<table_name>_<referenced_table>
```

Ejemplos:

```txt
pk_crm_lead
uq_crm_lead_public_id_lead
ix_crm_lead_owner_user_id_lead_status_code_lead
fk_crm_lead_crm_contact
```

## Relacion con API y Kysely

La base puede ser explicita y mas larga.

El API debe exponer nombres canonicos limpios.

Ejemplo:

```txt
DB:  project_id_lead
API: projectPublicId
```

```txt
DB:  action_reason_id_lead_timeline
API: actionReasonCode
```

Regla:

- Kysely mapea nombres fisicos de base;
- DTOs publicos usan nombres canonicos;
- no se filtran nombres fisicos innecesarios hacia el frontend.

## Checklist antes de crear una tabla

Antes de aprobar una tabla nueva, responder:

1. Pertenece a `crm_`, `conf_`, `sec_`, `audit_`, `int_` o `job_`?
2. Esta en singular?
3. Sus columnas terminan con sufijo de entidad?
4. Todas sus columnas tienen `COMMENT` claro y util?
5. El comentario de cada columna explica que registra y para que sirve?
6. La tabla esta normalizada y tiene una sola responsabilidad?
7. Evita duplicar datos que pertenecen a otra entidad?
8. Evita usar `JSON` para datos que se filtran, relacionan o auditan?
9. Si desnormaliza algo, existe ADR y evidencia?
10. Evita nombres de proveedor externo?
11. Evita nombres legacy ambiguos?
12. Tiene PK interna `id_<entidad>`?
13. Tiene `public_id_<entidad>` si sera expuesta por API?
14. Sus estados/tipos/motivos estan en `conf_` y no en `ENUM`?
15. Sus FKs son legibles en joins?
16. Tiene indices para los filtros reales?

Si una respuesta falla, no crear la migracion todavia.
