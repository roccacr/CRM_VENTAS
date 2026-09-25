# 01 - Diccionario de Datos: Identidad y Permisos

## Regla del dominio

Identidad se define antes que leads.

Este diccionario documenta las tablas que permiten saber:

- quien es la persona interna;
- como inicia sesion;
- que roles tiene;
- que permisos tiene;
- en que areas puede actuar;
- que ids externos tiene en NetSuite, Odoo, CRM viejo u otros sistemas;
- que cambios de seguridad quedaron auditados.

## Idioma

```txt
nombres fisicos = ingles canonico
comentarios MySQL = espanol
texto de UI = espanol
```

Ejemplo:

```txt
status_user = active
UI = Activo
```

## sec_user

Proposito: persona interna del CRM.

Modulo propietario: identidad y seguridad.

Tipo:
- entidad principal;
- seguridad;
- auditable.

Reglas de negocio:

- no guarda password;
- no guarda id de NetSuite;
- no guarda id de Odoo;
- no guarda supervisor fijo;
- el estado se guarda como palabra, no como numero;
- `permission_version_user` cambia cuando cambian roles, areas, permisos o bloqueo del usuario.

Campos principales:

| Campo | Obligatorio | Sensible | Descripcion |
| --- | --- | --- | --- |
| `id_user` | Si | No | Identificador interno para relaciones. |
| `public_id_user` | Si | No | Identificador publico para API/frontend. |
| `email_user` | Si | Si | Correo principal de la persona interna. |
| `normalized_email_user` | Si | Si | Correo normalizado para unicidad y busqueda. |
| `display_name_user` | Si | No | Nombre visible del usuario. |
| `status_user` | Si | No | Estado: active, inactive, blocked, pending o archived. |
| `permission_version_user` | Si | No | Version de permisos para invalidar autorizacion vieja. |

Relaciones:

| Tabla relacionada | Relacion | Motivo |
| --- | --- | --- |
| `sec_auth_identity` | 1:N | Una persona puede tener Microsoft y login local. |
| `sec_auth_session` | 1:N | Una persona puede tener sesiones backend activas o revocadas. |
| `sec_user_role` | 1:N | Una persona puede tener varios roles. |
| `sec_user_org_unit` | 1:N | Una persona puede estar en varias areas/equipos. |
| `sec_user_permission_override` | 1:N | Una persona puede tener permisos agregados o quitados. |
| `int_user_external_identity` | 1:N | Una persona puede tener ids externos por sistema. |
| `audit_security_event` | 1:N | La persona puede ejecutar o recibir eventos de seguridad. |

## sec_auth_identity

Proposito: forma de inicio de sesion asociada a un usuario.

Reglas:

- Microsoft es el login principal;
- local es alternativa controlada;
- nunca guardar clave en texto plano;
- el hash solo aplica a proveedor `local`;
- no puede existir mas de una identidad con el mismo proveedor y correo normalizado.

Campos principales:

| Campo | Obligatorio | Sensible | Descripcion |
| --- | --- | --- | --- |
| `user_id_auth_identity` | Si | No | Usuario interno asociado. |
| `provider_code_auth_identity` | Si | No | microsoft o local. |
| `provider_subject_auth_identity` | No | Si | Identificador tecnico del proveedor externo. |
| `email_auth_identity` | Si | Si | Correo usado para esta identidad. |
| `normalized_email_auth_identity` | Si | Si | Correo normalizado usado para unicidad por proveedor y login local. |
| `password_hash_auth_identity` | No | Si | Hash de password local. |
| `status_auth_identity` | Si | No | Estado de la identidad de login. |

## sec_auth_session

Proposito: sesion backend del CRM bajo patron BFF.

Reglas:

- la sesion identifica al usuario, no congela permisos;
- las acciones sensibles comparan la version de permisos de la sesion contra `sec_user.permission_version_user`;
- logout, bloqueo de usuario o sospecha de seguridad revocan la sesion;
- el frontend no administra tokens.

Campos principales:

| Campo | Obligatorio | Sensible | Descripcion |
| --- | --- | --- | --- |
| `user_id_auth_session` | Si | No | Usuario interno propietario de la sesion. |
| `auth_identity_id_auth_session` | Si | No | Metodo de login usado para crear la sesion. |
| `permission_version_auth_session` | Si | No | Version de permisos al momento de emitir la sesion. |
| `status_auth_session` | Si | No | Estado: active, expired o revoked. |
| `expires_at_auth_session` | Si | No | Fecha maxima de expiracion de la sesion. |
| `revoked_at_auth_session` | No | No | Fecha de revocacion. |

## sec_refresh_token

Proposito: guardar refresh tokens rotados como hash.

Reglas:

- nunca guardar refresh token plano;
- cada refresh usado se rota;
- reusar un refresh token anterior invalida la familia;
- la cookie de refresh debe tener ruta restringida;
- eventos relevantes se registran en `audit_security_event`.

Campos principales:

| Campo | Obligatorio | Sensible | Descripcion |
| --- | --- | --- | --- |
| `auth_session_id_refresh_token` | Si | No | Sesion backend a la que pertenece el token. |
| `token_family_id_refresh_token` | Si | Si | Familia de tokens para revocacion ante reuso. |
| `token_hash_refresh_token` | Si | Si | Hash del refresh token. |
| `status_refresh_token` | Si | No | Estado: active, rotated, reused, revoked o expired. |
| `expires_at_refresh_token` | Si | No | Fecha de expiracion. |

## sec_role

Proposito: catalogo de roles generales.

Reglas:

- el rol no debe incluir el nombre del area;
- correcto: `jefe_area`;
- incorrecto: `jefe_mercadeo`;
- el rol define acciones base, no alcance geografico/organizacional.

Roles iniciales:

```txt
owner
jefe_general
gerente
jefe_area
subjefe_area
supervisor
vendedor
soporte_sistemas
```

## sec_permission

Proposito: catalogo atomico de permisos.

Ejemplos:

```txt
user.view_list
user.update
role.assign
permission.override
org.assign_user
audit.security.view
```

Regla:

Los permisos de lead no se definen aqui. Vienen despues de cerrar identidad.

## sec_user_role

Proposito: asignar roles a usuarios.

Reglas:

- un usuario puede tener varios roles;
- revocar rol no borra historico;
- asignar o revocar rol incrementa `permission_version_user`;
- todo cambio genera `audit_security_event`.

## sec_role_permission

Proposito: definir permisos incluidos por cada rol.

Reglas:

- no usar esta tabla para excepciones de una persona;
- excepciones personales van en `sec_user_permission_override`;
- cambiar permisos de un rol afecta a todos los usuarios con ese rol.

## sec_org_unit

Proposito: areas/equipos de la empresa.

Ejemplos iniciales:

```txt
empresa
ventas
formalizacion
contabilidad
mercadeo
sistemas
```

Reglas:

- se guarda en forma de arbol;
- un area puede tener subareas;
- desactivar un area no borra historico;
- el area no define permisos por si sola.

## sec_user_org_unit

Proposito: definir donde puede actuar un usuario.

Ejemplo:

```txt
Maria -> mercadeo -> leader -> own_area_and_children
Maria -> formalizacion -> leader -> own_area_and_children
```

Reglas:

- una persona puede estar en varias areas;
- una persona puede ser jefa en un area y miembro normal en otra;
- supervisar depende de area + rol + alcance;
- no se usa `manager_user_id` dentro de `sec_user`.

## sec_user_permission_override

Proposito: agregar o quitar permisos puntuales a una persona.

Reglas:

- `allow` agrega permiso puntual;
- `deny` quita permiso puntual;
- `deny` gana sobre permisos de rol;
- todo cambio requiere motivo;
- todo cambio incrementa `permission_version_user`;
- todo cambio genera `audit_security_event`.

## int_external_system

Proposito: catalogo de sistemas externos.

Ejemplos:

```txt
netsuite
odoo
legacy_crm
```

Regla:

El proveedor se guarda como dato, no como nombre de columna core.

## int_user_external_identity

Proposito: guardar los ids externos de un usuario interno.

Ejemplo:

```txt
sec_user = Maria
external_system = netsuite
external_user_id = 12345

sec_user = Maria
external_system = odoo
external_user_id = 987
```

Reglas:

- no duplicar usuarios por cambiar de ERP;
- no guardar `idnetsuite_admin` en `sec_user`;
- migrar a Odoo significa agregar otra identidad externa, no cambiar la persona interna.

Nota:

Las referencias externas de leads, oportunidades, estimaciones, ordenes y contratos quedan fuera de identidad P0-S1A. Se documentan cuando se abra el corte comercial/integraciones.

## audit_security_event

Proposito: bitacora de seguridad.

Eventos esperados:

```txt
login_success
login_failed
logout
role_assigned
role_revoked
org_unit_assigned
org_unit_revoked
permission_override_added
permission_override_revoked
user_blocked
user_unblocked
```

Reglas:

- append-only;
- no borrar eventos;
- guardar actor, objetivo, fecha, tipo de evento y motivo cuando aplique;
- sirve para explicar quien cambio permisos, areas o roles.
