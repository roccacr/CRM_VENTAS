# 29 - Modelo Fisico MySQL Identidad P0-S1

## Veredicto

El modelo fisico de identidad debe separar cuatro cosas:

```txt
persona interna -> forma de login -> permisos/areas -> referencias externas
```

Regla principal:

```txt
sec_user no depende de NetSuite, Odoo ni del CRM viejo.
```

`sec_user` representa a la persona real dentro del CRM. Los ids externos viven en tablas `int_`.

## Idioma de nombres

Decision oficial:

```txt
nombres fisicos de BD = ingles canonico
comentarios MySQL = espanol
diccionario de datos = espanol
UI = espanol
```

Ejemplo:

```txt
status_user = active
UI = Activo
COMMENT = Estado operativo del usuario dentro del CRM.
```

No se permiten estados numericos sin significado.

## Tablas P0-S1

| Tabla | Responsabilidad |
| --- | --- |
| `sec_user` | Persona interna del CRM. |
| `sec_auth_identity` | Metodo de autenticacion asociado a una persona. |
| `sec_auth_session` | Sesion backend emitida por el API bajo patron BFF. |
| `sec_refresh_token` | Refresh token rotado y guardado como hash. |
| `sec_role` | Catalogo de roles generales. |
| `sec_permission` | Catalogo de permisos atomicos. |
| `sec_user_role` | Roles asignados a usuarios. |
| `sec_role_permission` | Permisos incluidos por rol. |
| `sec_org_unit` | Areas/equipos en estructura de arbol. |
| `sec_user_org_unit` | Areas/equipos asignados a un usuario y su alcance. |
| `sec_user_permission_override` | Permisos puntuales agregados o quitados a una persona. |
| `int_external_system` | Sistemas externos conocidos de forma generica. |
| `int_user_external_identity` | Ids externos de usuarios por sistema externo. |
| `audit_security_event` | Auditoria de seguridad, acceso, roles, permisos y areas. |

## Reglas globales

- Motor: InnoDB.
- Charset: `utf8mb4`.
- PK interna: `BIGINT UNSIGNED AUTO_INCREMENT`.
- ID publico: `public_id_<entity> CHAR(26)` con ULID o equivalente.
- Borrado logico para tablas maestras: `deleted_at_*`, `deleted_by_user_id_*`.
- Estados como palabras: `active`, `inactive`, `blocked`, `pending`, `archived`.
- Todas las columnas llevan `COMMENT` en MySQL.
- Ninguna tabla core contiene `netsuite`, `odoo`, `kapso`, `legacy` en el nombre.
- IDs externos se guardan solo en tablas `int_`.
- Cambios de rol, area o permiso incrementan `permission_version_user`.
- Cambios de seguridad generan `audit_security_event`.

## Campos de auditoria estandar

Toda tabla maestra o relacional administrable debe incluir campos suficientes para explicar creacion, actualizacion, revocacion o borrado logico.

Campos base recomendados:

| Campo | Uso |
| --- | --- |
| `created_at_*` | Fecha de creacion del registro. |
| `created_by_user_id_*` | Usuario que creo el registro, cuando aplica. |
| `updated_at_*` | Ultima fecha de actualizacion. |
| `updated_by_user_id_*` | Usuario que actualizo el registro, cuando aplica. |
| `deleted_at_*` | Borrado logico para entidades maestras. |
| `deleted_by_user_id_*` | Usuario que aplico borrado logico. |
| `revoked_at_*` | Fecha de revocacion para asignaciones, tokens u overrides. |
| `revoked_by_user_id_*` | Usuario que revoco la asignacion, token u override. |

Regla:

```txt
Si una tabla puede afectar acceso, alcance o seguridad, cada cambio debe tener rastro en columnas y en audit_security_event.
```

## Relaciones fisicas obligatorias

La futura migracion SQL debe crear FK internas con `ON DELETE RESTRICT`.

| Tabla origen | Columna | Tabla destino | Regla |
| --- | --- | --- | --- |
| `sec_auth_identity` | `user_id_auth_identity` | `sec_user.id_user` | No borrar usuario con identidades. |
| `sec_auth_session` | `user_id_auth_session` | `sec_user.id_user` | No borrar usuario con sesiones. |
| `sec_refresh_token` | `auth_session_id_refresh_token` | `sec_auth_session.id_auth_session` | No borrar sesion con tokens. |
| `sec_user_role` | `user_id_user_role` | `sec_user.id_user` | Revocar, no borrar. |
| `sec_user_role` | `role_id_user_role` | `sec_role.id_role` | Desactivar rol, no borrar. |
| `sec_role_permission` | `role_id_role_permission` | `sec_role.id_role` | Desactivar relacion, no borrar. |
| `sec_role_permission` | `permission_id_role_permission` | `sec_permission.id_permission` | Desactivar permiso, no borrar. |
| `sec_org_unit` | `parent_org_unit_id_org_unit` | `sec_org_unit.id_org_unit` | Permite arbol de areas. |
| `sec_user_org_unit` | `user_id_user_org_unit` | `sec_user.id_user` | Revocar asignacion, no borrar. |
| `sec_user_org_unit` | `org_unit_id_user_org_unit` | `sec_org_unit.id_org_unit` | Desactivar area, no borrar. |
| `sec_user_permission_override` | `user_id_user_permission_override` | `sec_user.id_user` | Revocar override, no borrar. |
| `sec_user_permission_override` | `permission_id_user_permission_override` | `sec_permission.id_permission` | Permiso atomico afectado. |
| `int_user_external_identity` | `user_id_user_external_identity` | `sec_user.id_user` | Crosswalk externo del usuario. |
| `int_user_external_identity` | `external_system_id_user_external_identity` | `int_external_system.id_external_system` | Sistema externo propietario. |

Regla:

```txt
No usar ON DELETE CASCADE en identidad, permisos ni auditoria.
```

## sec_user

Proposito: guardar la persona interna que puede operar o ser referenciada por el CRM.

No guarda:

- password;
- token;
- id de NetSuite;
- id de Odoo;
- id del CRM viejo;
- supervisor fijo.

Columnas:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_user` | `BIGINT UNSIGNED` | Si | Identificador interno del usuario para relaciones. |
| `public_id_user` | `CHAR(26)` | Si | Identificador publico para API/frontend. |
| `email_user` | `VARCHAR(255)` | Si | Correo principal de la persona interna. |
| `normalized_email_user` | `VARCHAR(255)` | Si | Correo normalizado para busqueda y unicidad. |
| `display_name_user` | `VARCHAR(180)` | Si | Nombre visible del usuario. |
| `status_user` | `VARCHAR(40)` | Si | Estado operativo: active, inactive, blocked, pending o archived. |
| `permission_version_user` | `INT UNSIGNED` | Si | Version que cambia cuando se modifican roles, permisos o areas del usuario. |
| `last_login_at_user` | `DATETIME(3)` | No | Ultima fecha de login exitoso conocida. |
| `created_at_user` | `DATETIME(3)` | Si | Fecha de creacion del usuario. |
| `created_by_user_id_user` | `BIGINT UNSIGNED` | No | Usuario que creo este registro. |
| `updated_at_user` | `DATETIME(3)` | Si | Ultima fecha de actualizacion del usuario. |
| `updated_by_user_id_user` | `BIGINT UNSIGNED` | No | Usuario que actualizo este registro. |
| `deleted_at_user` | `DATETIME(3)` | No | Fecha de borrado logico. |
| `deleted_by_user_id_user` | `BIGINT UNSIGNED` | No | Usuario que aplico el borrado logico. |

Indices:

| Indice | Columnas | Uso |
| --- | --- | --- |
| `pk_sec_user` | `id_user` | PK interna. |
| `uq_sec_user_public_id_user` | `public_id_user` | Busqueda publica/API. |
| `uq_sec_user_normalized_email_user` | `normalized_email_user` | Evita duplicar usuarios por correo. |
| `ix_sec_user_status_user` | `status_user` | Filtros de usuarios activos, bloqueados o inactivos. |
| `ix_sec_user_permission_version_user` | `permission_version_user` | Validacion rapida de permisos/sesion. |

Regla: un usuario bloqueado o inactivo no puede operar aunque tenga roles activos.

## sec_auth_identity

Proposito: guardar las formas de inicio de sesion de un usuario.

Una persona puede tener Microsoft y login local asociado al mismo `sec_user`.

Columnas:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_auth_identity` | `BIGINT UNSIGNED` | Si | Identificador interno de la identidad de autenticacion. |
| `user_id_auth_identity` | `BIGINT UNSIGNED` | Si | Usuario interno al que pertenece esta forma de login. |
| `provider_code_auth_identity` | `VARCHAR(40)` | Si | Proveedor de login: microsoft o local. |
| `provider_subject_auth_identity` | `VARCHAR(255)` | No | Identificador unico del proveedor externo, por ejemplo subject de Microsoft. |
| `email_auth_identity` | `VARCHAR(255)` | Si | Correo usado por esta identidad de login. |
| `normalized_email_auth_identity` | `VARCHAR(255)` | Si | Correo normalizado usado para login y busqueda. |
| `password_hash_auth_identity` | `VARCHAR(255)` | No | Hash Argon2id/bcrypt para login local; nunca texto plano. |
| `status_auth_identity` | `VARCHAR(40)` | Si | Estado de esta identidad: active, inactive o blocked. |
| `last_used_at_auth_identity` | `DATETIME(3)` | No | Ultima fecha en que se uso esta identidad para autenticar. |
| `created_at_auth_identity` | `DATETIME(3)` | Si | Fecha de creacion. |
| `updated_at_auth_identity` | `DATETIME(3)` | Si | Ultima fecha de actualizacion. |
| `deleted_at_auth_identity` | `DATETIME(3)` | No | Fecha de borrado logico. |

Indices:

| Indice | Columnas | Uso |
| --- | --- | --- |
| `pk_sec_auth_identity` | `id_auth_identity` | PK interna. |
| `ix_sec_auth_identity_user_id_auth_identity` | `user_id_auth_identity` | Login y perfil del usuario. |
| `uq_sec_auth_identity_provider_subject` | `provider_code_auth_identity`, `provider_subject_auth_identity` | Evita duplicar identidad Microsoft u otro proveedor. |
| `uq_sec_auth_identity_provider_email` | `provider_code_auth_identity`, `normalized_email_auth_identity` | Evita login local ambiguo por correo y permite buscar soporte por proveedor/correo. |

Reglas:

- `password_hash_auth_identity` solo aplica a `provider_code_auth_identity = local`.
- Microsoft es el login principal.
- Login local es alternativa controlada.
- No puede existir mas de una identidad con el mismo `provider_code_auth_identity` y `normalized_email_auth_identity`.
- El frontend nunca recibe hashes ni tokens.

## sec_auth_session

Proposito: guardar la sesion backend usada por el patron BFF.

No guarda tokens legibles para el frontend.

Columnas clave:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_auth_session` | `BIGINT UNSIGNED` | Si | Identificador interno de la sesion backend. |
| `public_id_auth_session` | `CHAR(26)` | Si | Identificador publico/tecnico de la sesion para auditoria interna. |
| `user_id_auth_session` | `BIGINT UNSIGNED` | Si | Usuario interno propietario de la sesion. |
| `auth_identity_id_auth_session` | `BIGINT UNSIGNED` | Si | Identidad de autenticacion usada para crear la sesion. |
| `permission_version_auth_session` | `INT UNSIGNED` | Si | Version de permisos del usuario al emitir la sesion. |
| `status_auth_session` | `VARCHAR(40)` | Si | Estado de la sesion: active, expired o revoked. |
| `ip_address_auth_session` | `VARCHAR(80)` | No | IP desde donde se creo o uso la sesion. |
| `user_agent_auth_session` | `VARCHAR(500)` | No | Navegador o cliente asociado a la sesion. |
| `created_at_auth_session` | `DATETIME(3)` | Si | Fecha de creacion de la sesion. |
| `expires_at_auth_session` | `DATETIME(3)` | Si | Fecha maxima de expiracion de la sesion. |
| `revoked_at_auth_session` | `DATETIME(3)` | No | Fecha de revocacion manual o automatica. |
| `revoked_by_user_id_auth_session` | `BIGINT UNSIGNED` | No | Usuario que revoco la sesion, si aplica. |

Indices:

- `pk_sec_auth_session` (`id_auth_session`);
- `uq_sec_auth_session_public_id_auth_session` (`public_id_auth_session`);
- `ix_sec_auth_session_user_status` (`user_id_auth_session`, `status_auth_session`);
- `ix_sec_auth_session_expires_at` (`expires_at_auth_session`);

Reglas:

- logout revoca la sesion;
- usuario bloqueado debe invalidar sesiones activas;
- si `permission_version_auth_session` queda atrasado, acciones sensibles deben recalcular permisos o rechazar.

## sec_refresh_token

Proposito: guardar refresh tokens rotados como hash para detectar reuso y revocar familias.

Columnas clave:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_refresh_token` | `BIGINT UNSIGNED` | Si | Identificador interno del refresh token. |
| `auth_session_id_refresh_token` | `BIGINT UNSIGNED` | Si | Sesion backend a la que pertenece el token. |
| `token_family_id_refresh_token` | `CHAR(26)` | Si | Identificador de familia para invalidar tokens relacionados ante reuso. |
| `token_hash_refresh_token` | `VARCHAR(255)` | Si | Hash del refresh token; nunca se guarda el token plano. |
| `status_refresh_token` | `VARCHAR(40)` | Si | Estado: active, rotated, reused, revoked o expired. |
| `issued_at_refresh_token` | `DATETIME(3)` | Si | Fecha de emision del token. |
| `expires_at_refresh_token` | `DATETIME(3)` | Si | Fecha de expiracion del token. |
| `rotated_at_refresh_token` | `DATETIME(3)` | No | Fecha en que fue reemplazado por otro refresh token. |
| `revoked_at_refresh_token` | `DATETIME(3)` | No | Fecha de revocacion del token. |
| `revoked_reason_refresh_token` | `VARCHAR(120)` | No | Motivo tecnico o de seguridad de la revocacion. |

Indices:

- `pk_sec_refresh_token` (`id_refresh_token`);
- `uq_sec_refresh_token_hash_refresh_token` (`token_hash_refresh_token`);
- `ix_sec_refresh_token_session_status` (`auth_session_id_refresh_token`, `status_refresh_token`);
- `ix_sec_refresh_token_family` (`token_family_id_refresh_token`, `status_refresh_token`);

Reglas:

- reusar un refresh token ya rotado marca la familia como comprometida;
- nunca guardar refresh token plano;
- el frontend no conoce esta tabla ni administra tokens.

## sec_role

Proposito: catalogo de roles generales, sin nombre de area.

Columnas clave:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_role` | `BIGINT UNSIGNED` | Si | Identificador interno del rol. |
| `code_role` | `VARCHAR(80)` | Si | Codigo estable del rol: owner, jefe_area, vendedor. |
| `name_role` | `VARCHAR(120)` | Si | Nombre visible del rol. |
| `description_role` | `VARCHAR(255)` | No | Explicacion funcional del rol. |
| `status_role` | `VARCHAR(40)` | Si | Estado del rol: active o inactive. |
| `created_at_role` | `DATETIME(3)` | Si | Fecha de creacion. |
| `updated_at_role` | `DATETIME(3)` | Si | Ultima actualizacion. |
| `deleted_at_role` | `DATETIME(3)` | No | Borrado logico. |

Indices:

- `pk_sec_role` (`id_role`);
- `uq_sec_role_code_role` (`code_role`);
- `ix_sec_role_status_role` (`status_role`).

Regla: no crear roles como `jefe_mercadeo` o `jefe_formalizacion`.

## sec_permission

Proposito: catalogo atomico de acciones permitidas.

Columnas clave:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_permission` | `BIGINT UNSIGNED` | Si | Identificador interno del permiso. |
| `code_permission` | `VARCHAR(120)` | Si | Codigo atomico: user.create, role.assign, org.view. |
| `module_code_permission` | `VARCHAR(80)` | Si | Modulo propietario del permiso. |
| `action_code_permission` | `VARCHAR(80)` | Si | Accion principal del permiso. |
| `description_permission` | `VARCHAR(255)` | No | Explicacion del permiso para soporte/jefatura. |
| `status_permission` | `VARCHAR(40)` | Si | Estado del permiso: active o inactive. |
| `created_at_permission` | `DATETIME(3)` | Si | Fecha de creacion. |
| `updated_at_permission` | `DATETIME(3)` | Si | Ultima actualizacion. |

Indices:

- `pk_sec_permission` (`id_permission`);
- `uq_sec_permission_code_permission` (`code_permission`);
- `ix_sec_permission_module_action` (`module_code_permission`, `action_code_permission`).

## sec_user_role

Proposito: asignar uno o varios roles a un usuario.

Columnas clave:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_user_role` | `BIGINT UNSIGNED` | Si | Identificador interno de la asignacion. |
| `user_id_user_role` | `BIGINT UNSIGNED` | Si | Usuario que recibe el rol. |
| `role_id_user_role` | `BIGINT UNSIGNED` | Si | Rol asignado. |
| `status_user_role` | `VARCHAR(40)` | Si | Estado de la asignacion: active o inactive. |
| `active_key_user_role` | `TINYINT GENERATED` | Si | Clave generada: 1 solo cuando esta active; NULL cuando esta inactive para conservar historico. |
| `assigned_at_user_role` | `DATETIME(3)` | Si | Fecha de asignacion del rol. |
| `assigned_by_user_id_user_role` | `BIGINT UNSIGNED` | No | Usuario que asigno el rol. |
| `revoked_at_user_role` | `DATETIME(3)` | No | Fecha en que se revoco la asignacion. |
| `revoked_by_user_id_user_role` | `BIGINT UNSIGNED` | No | Usuario que revoco el rol. |

Indices:

- `pk_sec_user_role` (`id_user_role`);
- `uq_sec_user_role_active` (`user_id_user_role`, `role_id_user_role`, `active_key_user_role`);
- `ix_sec_user_role_role_id_user_role` (`role_id_user_role`).

Reglas:

- asignar o revocar rol incrementa `permission_version_user`;
- la columna generada permite una sola asignacion activa y multiples historicos inactivos.

## sec_role_permission

Proposito: definir permisos base de cada rol.

Columnas clave:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_role_permission` | `BIGINT UNSIGNED` | Si | Identificador interno de la relacion rol-permiso. |
| `role_id_role_permission` | `BIGINT UNSIGNED` | Si | Rol que contiene el permiso. |
| `permission_id_role_permission` | `BIGINT UNSIGNED` | Si | Permiso incluido en el rol. |
| `status_role_permission` | `VARCHAR(40)` | Si | Estado de la relacion: active o inactive. |
| `active_key_role_permission` | `TINYINT GENERATED` | Si | Clave generada: 1 solo cuando esta active; NULL cuando esta inactive para conservar historico. |
| `created_at_role_permission` | `DATETIME(3)` | Si | Fecha de creacion. |

Indices:

- `pk_sec_role_permission` (`id_role_permission`);
- `uq_sec_role_permission_role_permission` (`role_id_role_permission`, `permission_id_role_permission`, `active_key_role_permission`);
- `ix_sec_role_permission_permission` (`permission_id_role_permission`).

## sec_org_unit

Proposito: representar areas/equipos de la empresa en forma de arbol.

Columnas clave:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_org_unit` | `BIGINT UNSIGNED` | Si | Identificador interno del area/equipo. |
| `public_id_org_unit` | `CHAR(26)` | Si | Identificador publico del area/equipo. |
| `parent_org_unit_id_org_unit` | `BIGINT UNSIGNED` | No | Area padre para construir la jerarquia. |
| `code_org_unit` | `VARCHAR(80)` | Si | Codigo estable del area: ventas, mercadeo, formalizacion. |
| `name_org_unit` | `VARCHAR(160)` | Si | Nombre visible del area. |
| `status_org_unit` | `VARCHAR(40)` | Si | Estado del area: active o inactive. |
| `sort_order_org_unit` | `INT UNSIGNED` | Si | Orden visual dentro del mismo nivel. |
| `created_at_org_unit` | `DATETIME(3)` | Si | Fecha de creacion. |
| `updated_at_org_unit` | `DATETIME(3)` | Si | Ultima actualizacion. |
| `deleted_at_org_unit` | `DATETIME(3)` | No | Borrado logico. |

Indices:

- `pk_sec_org_unit` (`id_org_unit`);
- `uq_sec_org_unit_code_org_unit` (`code_org_unit`);
- `ix_sec_org_unit_parent_status` (`parent_org_unit_id_org_unit`, `status_org_unit`);

Regla: desactivar un area no borra usuarios ni historico.

## sec_user_org_unit

Proposito: asignar usuarios a areas/equipos y definir su alcance.

Esta tabla resuelve el caso:

```txt
Maria es jefa de Mercadeo y Formalizacion.
```

Columnas clave:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_user_org_unit` | `BIGINT UNSIGNED` | Si | Identificador interno de la asignacion usuario-area. |
| `user_id_user_org_unit` | `BIGINT UNSIGNED` | Si | Usuario asignado al area/equipo. |
| `org_unit_id_user_org_unit` | `BIGINT UNSIGNED` | Si | Area/equipo asignado al usuario. |
| `membership_code_user_org_unit` | `VARCHAR(40)` | Si | Tipo de participacion: member, leader, assistant_leader o supervisor. |
| `scope_code_user_org_unit` | `VARCHAR(40)` | Si | Alcance: self, assigned, own_area, own_area_and_children o all_areas. |
| `status_user_org_unit` | `VARCHAR(40)` | Si | Estado de la asignacion: active o inactive. |
| `active_key_user_org_unit` | `TINYINT GENERATED` | Si | Clave generada: 1 solo cuando esta active; NULL cuando esta inactive para conservar historico. |
| `assigned_at_user_org_unit` | `DATETIME(3)` | Si | Fecha de asignacion al area. |
| `assigned_by_user_id_user_org_unit` | `BIGINT UNSIGNED` | No | Usuario que asigno el area. |
| `revoked_at_user_org_unit` | `DATETIME(3)` | No | Fecha de revocacion del area. |
| `revoked_by_user_id_user_org_unit` | `BIGINT UNSIGNED` | No | Usuario que revoco el area. |

Indices:

- `pk_sec_user_org_unit` (`id_user_org_unit`);
- `uq_sec_user_org_unit_active` (`user_id_user_org_unit`, `org_unit_id_user_org_unit`, `membership_code_user_org_unit`, `scope_code_user_org_unit`, `active_key_user_org_unit`);
- `ix_sec_user_org_unit_org_status` (`org_unit_id_user_org_unit`, `status_user_org_unit`);
- `ix_sec_user_org_unit_user_status` (`user_id_user_org_unit`, `status_user_org_unit`).

Reglas:

- agregar o quitar area incrementa `permission_version_user`;
- la columna generada permite una sola asignacion activa y multiples historicos inactivos.

## sec_user_permission_override

Proposito: agregar o quitar permisos puntuales a una persona sin crear roles nuevos.

Columnas clave:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_user_permission_override` | `BIGINT UNSIGNED` | Si | Identificador interno del override. |
| `user_id_user_permission_override` | `BIGINT UNSIGNED` | Si | Usuario afectado por el override. |
| `permission_id_user_permission_override` | `BIGINT UNSIGNED` | Si | Permiso agregado o denegado. |
| `effect_user_permission_override` | `VARCHAR(20)` | Si | Efecto del override: allow o deny. |
| `reason_user_permission_override` | `VARCHAR(255)` | Si | Motivo de negocio para agregar o quitar el permiso. |
| `status_user_permission_override` | `VARCHAR(40)` | Si | Estado del override: active o inactive. |
| `active_key_user_permission_override` | `TINYINT GENERATED` | Si | Clave generada: 1 solo cuando esta active; NULL cuando esta inactive para conservar historico. |
| `starts_at_user_permission_override` | `DATETIME(3)` | Si | Fecha desde la que aplica el override. |
| `ends_at_user_permission_override` | `DATETIME(3)` | No | Fecha opcional de vencimiento. |
| `created_by_user_id_user_permission_override` | `BIGINT UNSIGNED` | No | Usuario que creo el override. |
| `created_at_user_permission_override` | `DATETIME(3)` | Si | Fecha de creacion del override. |
| `revoked_by_user_id_user_permission_override` | `BIGINT UNSIGNED` | No | Usuario que revoco el override. |
| `revoked_at_user_permission_override` | `DATETIME(3)` | No | Fecha de revocacion del override. |

Indices:

- `pk_sec_user_permission_override` (`id_user_permission_override`);
- `uq_sec_user_permission_override_active` (`user_id_user_permission_override`, `permission_id_user_permission_override`, `effect_user_permission_override`, `active_key_user_permission_override`);
- `ix_sec_user_permission_override_user_status` (`user_id_user_permission_override`, `status_user_permission_override`);

Reglas:

- `deny` gana sobre permisos de rol y permisos `allow`.
- Todo cambio incrementa `permission_version_user`.
- Todo cambio requiere motivo.

## int_external_system

Proposito: catalogar sistemas externos de forma generica.

Ejemplos de datos:

```txt
netsuite
odoo
legacy_crm
```

El nombre del proveedor se guarda como dato, no como nombre de tabla core.

Columnas clave:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_external_system` | `BIGINT UNSIGNED` | Si | Identificador interno del sistema externo. |
| `code_external_system` | `VARCHAR(80)` | Si | Codigo estable del sistema externo. |
| `name_external_system` | `VARCHAR(160)` | Si | Nombre visible del sistema externo. |
| `status_external_system` | `VARCHAR(40)` | Si | Estado: active o inactive. |
| `created_at_external_system` | `DATETIME(3)` | Si | Fecha de creacion. |
| `updated_at_external_system` | `DATETIME(3)` | Si | Ultima actualizacion. |

Indices:

- `pk_int_external_system` (`id_external_system`);
- `uq_int_external_system_code_external_system` (`code_external_system`).

## int_user_external_identity

Proposito: relacionar un usuario interno con sus ids en sistemas externos.

Ejemplo:

```txt
sec_user = Maria
external_system = netsuite
external_user_id = 12345

sec_user = Maria
external_system = odoo
external_user_id = 987
```

Maria sigue siendo una sola usuaria del CRM.

Columnas clave:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_user_external_identity` | `BIGINT UNSIGNED` | Si | Identificador interno de la relacion usuario-sistema externo. |
| `user_id_user_external_identity` | `BIGINT UNSIGNED` | Si | Usuario interno del CRM relacionado con el sistema externo. |
| `external_system_id_user_external_identity` | `BIGINT UNSIGNED` | Si | Sistema externo al que pertenece el id externo. |
| `external_user_id_user_external_identity` | `VARCHAR(180)` | Si | Identificador del usuario en el sistema externo. |
| `external_username_user_external_identity` | `VARCHAR(180)` | No | Nombre/correo del usuario en el sistema externo si aplica. |
| `status_user_external_identity` | `VARCHAR(40)` | Si | Estado de la relacion externa: active o inactive. |
| `metadata_user_external_identity` | `JSON` | No | Metadata no critica del sistema externo que no se filtra frecuentemente. |
| `created_at_user_external_identity` | `DATETIME(3)` | Si | Fecha de creacion. |
| `updated_at_user_external_identity` | `DATETIME(3)` | Si | Ultima actualizacion. |
| `deleted_at_user_external_identity` | `DATETIME(3)` | No | Borrado logico. |

Indices:

- `pk_int_user_external_identity` (`id_user_external_identity`);
- `uq_int_user_external_identity_external` (`external_system_id_user_external_identity`, `external_user_id_user_external_identity`);
- `ix_int_user_external_identity_user` (`user_id_user_external_identity`, `status_user_external_identity`);

Regla: migrar de NetSuite a Odoo no cambia `sec_user`; solo agrega o cambia registros en `int_user_external_identity`.

Nota: `int_external_reference` queda para el corte comercial/integraciones de entidades futuras. No entra en el SQL de identidad P0-S1A.

## audit_security_event

Proposito: guardar bitacora de acciones de seguridad.

Es append-only: no se edita ni se borra fisicamente en operacion normal.

Columnas clave:

| Columna | Tipo recomendado | Obligatorio | Comentario esperado |
| --- | --- | --- | --- |
| `id_security_event` | `BIGINT UNSIGNED` | Si | Identificador interno del evento de seguridad. |
| `public_id_security_event` | `CHAR(26)` | Si | Identificador publico del evento para soporte/auditoria. |
| `event_type_security_event` | `VARCHAR(120)` | Si | Tipo de evento: login_success, role_assigned, permission_denied, etc. |
| `actor_user_id_security_event` | `BIGINT UNSIGNED` | No | Usuario que ejecuto la accion. |
| `target_user_id_security_event` | `BIGINT UNSIGNED` | No | Usuario afectado por la accion, si aplica. |
| `summary_security_event` | `VARCHAR(255)` | Si | Resumen legible del evento. |
| `reason_security_event` | `VARCHAR(255)` | No | Motivo indicado por el usuario cuando aplica. |
| `ip_address_security_event` | `VARCHAR(80)` | No | IP desde donde se ejecuto la accion. |
| `user_agent_security_event` | `VARCHAR(500)` | No | User agent del navegador o cliente. |
| `metadata_security_event` | `JSON` | No | Snapshot tecnico no critico del evento. |
| `created_at_security_event` | `DATETIME(3)` | Si | Fecha exacta del evento. |

Indices:

- `pk_audit_security_event` (`id_security_event`);
- `uq_audit_security_event_public_id` (`public_id_security_event`);
- `ix_audit_security_event_actor_date` (`actor_user_id_security_event`, `created_at_security_event`);
- `ix_audit_security_event_target_date` (`target_user_id_security_event`, `created_at_security_event`);
- `ix_audit_security_event_type_date` (`event_type_security_event`, `created_at_security_event`);

## Reglas de integridad

- Las FK usan `ON DELETE RESTRICT` para tablas maestras.
- No borrar usuarios con historico.
- Desactivar antes que borrar.
- Toda revocacion deja fecha, usuario responsable y auditoria.
- `permission_version_user` cambia con:
  - asignacion/revocacion de rol;
  - asignacion/revocacion de area;
  - permiso personal allow/deny;
  - bloqueo/inactivacion del usuario.

## Dudas pendientes

No bloquean el modelo, pero deben responderse antes de migracion ejecutable:

1. Correo del primer `owner`.
2. Usuario inicial `jefe_general`.
3. Areas seed definitivas.
4. Si `gerente` estara activo desde P0-S1 o solo preparado.
5. Si `soporte_sistemas` podra ver usuarios comerciales o solo diagnostico tecnico.
6. Tiempo maximo aceptado para cache de permisos no criticos.

## Criterio de salida

Se puede pasar a migracion SQL cuando:

- este documento este aceptado;
- `30-Identidad-Canonica-y-Referencias-Externas.md` este aceptado;
- el diccionario de identidad este creado;
- `26-Estandar-Nombres-Base-Datos.md` este respetado;
- todas las columnas de la migracion tengan `COMMENT`;
- no exista ningun campo `netsuite`, `odoo` o `manager_user_id` dentro de `sec_user`.
