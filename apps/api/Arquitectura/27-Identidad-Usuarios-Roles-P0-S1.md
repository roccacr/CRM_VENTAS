# 27 - Identidad, Usuarios y Roles P0-S1

## Veredicto

Antes de modelar leads, contactos, oportunidades o bitacoras comerciales, se debe cerrar la base de identidad.

Regla de orden:

```txt
producto -> identidad/usuarios/roles -> contrato lead -> modelo MySQL minimo -> NestJS
```

Motivo: no se puede definir bien quien crea, ve, edita, audita o supervisa un lead si primero no existe una definicion clara de usuario, autenticacion, rol y permiso.

## Alcance actual

Este documento define solo la base minima para saber:

- quien puede entrar al CRM;
- como se autentica;
- que rol tiene;
- que permisos salen de ese rol;
- como se registra la evidencia de acceso y acciones sensibles;
- que queda fuera hasta que el orden del proyecto lo pida.

No autoriza programar API, crear runtime, migraciones ni endpoints todavia.

La matriz operable de roles, permisos, areas y overrides personales queda definida en `28-Matriz-Roles-Permisos-Areas-P0-S1.md`.

El contrato aprobado de identidad y permisos queda definido en `31-Contrato-Identidad-y-Permisos-P0-S1.md`.

## Regla de avance

Hasta que este documento quede aprobado:

- no crear tabla fisica de lead;
- no crear tabla fisica de contacto;
- no crear bitacora comercial de lead;
- no crear migracion P0-S1 de leads;
- no crear endpoints de lead;
- no crear pantallas de lead.

Primero se define identidad. Luego se vuelve al contrato del lead.

## Conceptos

### Usuario

Un usuario es una persona que puede entrar al CRM.

Ejemplos:

```txt
Jefe
Gerente
Supervisor
Vendedor
Sistemas/soporte
```

El usuario no es un lead, no es contacto comercial y no representa un cliente. Representa una persona interna de la empresa.

El usuario tampoco es un usuario de NetSuite, Odoo o del CRM viejo.

Regla:

```txt
sec_user = persona interna del CRM
int_user_external_identity = ids externos de esa persona
```

Si hoy el sistema viejo identifica vendedores por `idnetsuite_admin`, ese valor no entra en `sec_user`. Se guarda como referencia externa relacionada al usuario interno.

Si manana Odoo usa otro id, se agrega otra referencia externa al mismo `sec_user`.

Para leads, oportunidades, estimaciones, ordenes y contratos se usa `int_external_reference`.

Regla completa: `30-Identidad-Canonica-y-Referencias-Externas.md`.

### Identidad de autenticacion

La identidad de autenticacion define como entra el usuario.

El mismo usuario puede tener:

- acceso principal por Microsoft 365 / Entra ID;
- acceso alternativo local por correo y clave, si negocio lo permite.

Regla:

```txt
usuario = persona interna
identidad de autenticacion = forma en que esa persona inicia sesion
```

### Rol

Un rol representa una funcion de negocio.

Ejemplos:

```txt
owner
gerente
supervisor
vendedor
soporte_sistemas
```

El rol no debe ser hardcodeado en el frontend. El API devuelve permisos efectivos.

### Permiso

Un permiso representa una capacidad puntual.

Ejemplos:

```txt
lead.create
lead.view_assigned
lead.view_team
lead.edit_assigned
lead.change_status
user.manage
role.assign
```

Regla: el rol agrupa permisos, pero el backend decide el permiso efectivo.

### Area organizacional

Un area organizacional representa una parte real de la empresa.

Ejemplos:

```txt
empresa
sistemas
ventas
formalizacion
contabilidad
mercadeo
```

El area no es un rol.

Regla:

```txt
rol = que acciones puede ejecutar
area = sobre que grupo/personas/datos tiene alcance
```

Ejemplo:

```txt
usuario A tiene rol jefe_area
usuario A esta asignado al area formalizacion
resultado: puede ejecutar acciones de jefe solo sobre formalizacion y sus subareas
```

Un mismo usuario puede tener varios vinculos de area al mismo tiempo.

Ejemplo:

```txt
usuario B tiene rol jefe_area
usuario B esta asignado al area mercadeo con alcance own_area_and_children
usuario B esta asignado al area formalizacion con alcance own_area_and_children
resultado: puede ejecutar acciones de jefe sobre mercadeo y formalizacion
```

Esto no significa que el usuario tenga dos roles distintos. Significa que tiene el mismo rol con mas de un alcance organizacional.

### Jerarquia organizacional

La empresa debe poder representarse como arbol.

Ejemplo conceptual:

```txt
sistemas / owner tecnico
└── jefe_general
    ├── jefe_formalizacion
    │   └── empleados_formalizacion
    ├── jefe_contabilidad
    │   └── empleados_contabilidad
    └── jefe_mercadeo
        └── empleados_mercadeo
```

Tambien debe soportar subjefes.

Ejemplo:

```txt
jefe_mercadeo
└── subjefe_mercadeo
    └── empleados_mercadeo
```

Regla de visibilidad:

- jefe general puede ver todas las areas bajo su alcance;
- jefe de area puede ver su area y subareas;
- jefe de area con varias areas asignadas puede ver cada area asignada y sus subareas, segun alcance efectivo;
- subjefe puede ver el area/subarea asignada segun permiso y alcance;
- subjefe con varias areas/subareas asignadas puede operar en cada una solo con los permisos efectivos que conserve;
- empleado normal ve solo lo propio o lo asignado;
- soporte_sistemas no gana acceso comercial por estar en sistemas, salvo permiso explicito.

La jerarquia define alcance. Los permisos definen acciones.

El permiso efectivo final se calcula combinando:

```txt
roles asignados
+ vinculos de area/equipo
+ permisos personales agregados
- permisos personales revocados
= permiso efectivo para una accion exacta
```

Si una persona es jefa de dos areas, el API no debe duplicar usuarios ni inventar roles. Debe registrar dos vinculos en `sec_user_org_unit`.

No se debe resolver esto creando un rol distinto para cada jefe de cada area.

Mal enfoque:

```txt
rol_jefe_mercadeo
rol_jefe_contabilidad
rol_jefe_formalizacion
```

Mejor enfoque:

```txt
rol: jefe_area
areas: mercadeo, formalizacion
alcance: own_area | own_area_and_children | all_areas
```

Asi el sistema escala sin crear roles infinitos.

## Regla obligatoria de autorizacion dinamica

Autenticacion y autorizacion no son lo mismo.

```txt
autenticacion = quien eres
autorizacion = que puedes hacer en esta accion exacta
```

Un usuario puede estar autenticado y aun asi perder un permiso mientras la sesion sigue abierta.

Regla superior:

```txt
Permiso quitado = accion bloqueada en el siguiente request o en pocos segundos como maximo.
```

Ninguna accion sensible puede depender solo de los permisos que existian al momento del login.

Para cada accion protegida, el API debe preguntar si el usuario todavia tiene permiso efectivo para ejecutar esa accion.

Ejemplos de acciones sensibles:

- aprobar;
- cambiar estado;
- mandar a perdido;
- pausar o reactivar;
- reasignar;
- quitar permiso;
- asignar rol;
- modificar usuario;
- ver datos fuera del alcance normal.

Regla de evaluacion:

```txt
permisos efectivos =
roles activos
+ permisos directos vigentes
- denegaciones explicitas vigentes
+ condiciones del recurso
```

El backend puede usar cache corta para rendimiento, pero la cache no puede convertir un permiso revocado en permiso valido.

Cuando cambien roles, permisos directos, denegaciones, areas o estado de un usuario:

1. se incrementa la version de permisos del usuario;
2. se invalida cualquier cache de permisos de ese usuario;
3. se registra auditoria;
4. el siguiente request debe recalcular o rechazar si la version de la sesion esta desactualizada.

Nombre canonico sugerido para el modelo fisico:

```txt
permission_version_user
```

`permission_version_user` vive en `sec_user` y cambia cada vez que cambia el resultado posible de autorizacion del usuario.

La sesion puede recordar con que version fue emitida, pero el guard de autorizacion debe comparar esa version contra la version actual antes de permitir acciones sensibles.

Regla para JWT o payload de sesion:

- no guardar permisos largos como verdad permanente;
- no confiar en un JWT viejo para autorizar acciones sensibles;
- usar la sesion para identificar al usuario;
- usar el backend para decidir permisos efectivos actuales.

## Motor recomendado de permisos

El motor recomendado para evaluar autorizacion dentro del API es:

```txt
NestJS Guards + CASL + MySQL
```

MySQL es la fuente de verdad.

CASL evalua permisos y condiciones en la aplicacion.

NestJS Guards bloquean o permiten endpoints y acciones.

Regla:

```txt
La base manda.
CASL evalua.
El Guard aplica.
El frontend solo muestra.
```

OpenFGA o Cerbos quedan como opciones futuras si el CRM crece hacia autorizacion relacional externa compleja. No son requisito para P0-S1.

## Tablas candidatas minimas

Estas son las tablas que si tiene sentido analizar primero.

| Tabla | Para que sirve | Estado |
| --- | --- | --- |
| `sec_user` | Guarda las personas internas que pueden usar el CRM. | P0-S1 identidad |
| `sec_auth_identity` | Guarda el metodo de autenticacion del usuario: Microsoft o local. | P0-S1 identidad |
| `sec_auth_session` | Guarda sesiones backend activas, expiradas o revocadas. | P0-S1 seguridad |
| `sec_refresh_token` | Guarda refresh tokens rotados como hash, nunca token plano. | P0-S1 seguridad |
| `sec_role` | Catalogo de roles internos. | P0-S1 identidad |
| `sec_permission` | Catalogo de permisos atomicos. | P0-S1 identidad |
| `sec_user_role` | Relacion entre usuarios y roles. Permite varios roles por usuario. | P0-S1 identidad |
| `sec_role_permission` | Relacion entre roles y permisos. | P0-S1 identidad |
| `sec_org_unit` | Arbol de areas/departamentos de la empresa. | P0-S1 alcance |
| `sec_user_org_unit` | Relacion entre usuario, area, funcion dentro del area y alcance. | P0-S1 alcance |
| `sec_user_permission_override` | Agrega o quita permisos puntuales a una persona especifica. | P0-S1 permisos |
| `int_external_system` | Catalogo generico de sistemas externos como netsuite, odoo o legacy_crm. | P0-S1 integracion |
| `int_user_external_identity` | Relaciona un usuario interno con sus ids externos por sistema. | P0-S1 integracion |
| `int_external_reference` | Relaciona entidades internas como lead, oportunidad, estimacion, orden o contrato con ids externos por sistema. | P0-S1 integracion |
| `audit_security_event` | Registra accesos, intentos fallidos, cierres de sesion y cambios sensibles de seguridad, roles, permisos y areas. | P0-S1 seguridad |

P0-S1 si debe dejar modelado:

- permisos directos por usuario;
- denegaciones explicitas por usuario;
- delegaciones temporales quedan previstas fuera de P0-S1A;
- revocacion inmediata mediante `permission_version_user`;
- auditoria de cada cambio de permiso.

La UI puede activarlas por fases, pero el modelo de identidad no debe quedar corto.

## Que no entra todavia

No entra en esta fase:

- `crm_lead`;
- `crm_contact`;
- `audit_lead_timeline`;
- `conf_project`;
- `conf_campaign`;
- `conf_lead_source`;
- calendario;
- notas;
- Kapso;
- NetSuite/Odoo operativo;
- pantallas de lead;
- flujos complejos de aprobacion comercial.

Esto no significa que se eliminen. Significa que vienen despues de cerrar usuarios y roles.

## Roles iniciales propuestos

Estos roles son punto de partida, no implementacion cerrada:

| Rol | Para que sirve |
| --- | --- |
| `owner` | Rol mas alto. Puede supervisar todo el CRM y configurar roles/permisos. |
| `gerente` | Supervisa operacion comercial amplia segun alcance asignado. |
| `supervisor` | Supervisa equipo o grupo de vendedores. |
| `jefe_area` | Supervisa un area especifica y sus subareas segun alcance asignado. |
| `subjefe_area` | Apoya supervision de un area/subarea segun alcance asignado. |
| `vendedor` | Atiende leads asignados y registra acciones comerciales. |
| `soporte_sistemas` | Apoya soporte tecnico, integraciones y diagnostico sin convertirse en vendedor. |

Reglas:

- un usuario puede tener varios roles;
- el rol mas alto no elimina la necesidad de permisos atomicos;
- el backend calcula permisos efectivos;
- el frontend solo muestra lo que el API autoriza;
- el API revalida permiso efectivo en cada accion protegida;
- si se quita un permiso, el usuario autenticado no puede seguir usando esa accion;
- el alcance de jefatura depende de area organizacional, no solo del nombre del rol;
- un jefe o subjefe puede tener permisos de accion, pero solo sobre el area/subarea autorizada;
- si manana se agregan delegaciones temporales, se agregan cuando el negocio lo pida.

## Permisos minimos propuestos

Estos permisos permiten iniciar la discusion sin entrar todavia al modulo de lead completo.

| Permiso | Para que sirve |
| --- | --- |
| `auth.login` | Permite iniciar sesion en el CRM. |
| `auth.logout` | Permite cerrar sesion. |
| `user.view_self` | Permite ver el propio perfil. |
| `user.view_all` | Permite ver usuarios del sistema. |
| `user.manage` | Permite crear, activar, desactivar o modificar usuarios. |
| `role.view` | Permite ver roles y permisos. |
| `role.assign` | Permite asignar roles a usuarios. |
| `permission.view` | Permite ver permisos disponibles. |
| `audit.security.view` | Permite revisar eventos de seguridad. |
| `org.view` | Permite ver la estructura de areas. |
| `org.manage` | Permite crear, editar, activar o desactivar areas. |
| `org.assign_user` | Permite asignar usuarios a areas y definir su alcance. |

Los permisos de lead se definen despues, cuando vuelva el contrato del lead.

## Reglas de autenticacion

La autenticacion debe respetar `24-Seguridad-Autenticacion-BFF-OIDC-Local.md`.

Reglas cerradas:

- Microsoft 365 / Entra ID es el acceso principal;
- correo y clave local es alternativa controlada;
- el frontend no guarda tokens;
- el backend maneja sesion por cookies seguras;
- cada login exitoso, login fallido, logout y cambio sensible de seguridad debe quedar auditado;
- usuario inactivo no puede iniciar sesion;
- usuario sin rol activo no debe poder operar el CRM;
- permisos quitados, roles quitados o denegaciones agregadas deben bloquear la siguiente accion protegida.

## Reglas de base para estas tablas

Toda tabla de identidad debe cumplir:

- prefijo `sec_` para seguridad;
- prefijo `audit_` para auditoria;
- prefijo `int_` para integraciones y referencias externas;
- nombres en singular;
- columnas con sufijo de entidad;
- `COMMENT` obligatorio en todas las columnas;
- normalizacion por defecto;
- nada de nombres NetSuite, Odoo, Kapso o legacy;
- indices para login, busqueda por correo, roles activos y auditoria por fecha;
- version de permisos en `sec_user` para invalidar autorizacion desactualizada.

## Preguntas abiertas

Antes de pasar a modelo fisico, se deben responder:

1. Cual sera el correo oficial del primer usuario `owner`.
2. Cual sera el procedimiento seguro para activar login local sin guardar contrasenas reales en migracion.
3. Si `soporte_sistemas` puede ver datos comerciales o solo datos tecnicos.
4. Si gerente y supervisor se diferencian por permisos o por alcance de equipo.
5. Si un usuario sin rol debe poder entrar a una pantalla bloqueada o no entrar del todo.
6. Cuales usuarios iniciales se cargaran como seed.
7. Cual sera el tiempo maximo permitido de cache de permisos para acciones no criticas.
8. Cuales acciones se consideran criticas y deben revalidar permisos contra datos actuales sin confiar solo en cache.
9. Cuales areas iniciales existen: ventas, formalizacion, contabilidad, mercadeo, sistemas u otras.
10. Quien sera jefe general y que alcance tendra.
11. Si cada area tendra jefe y subjefe desde P0-S1 o solo quedara preparado.
12. Si el alcance `all_areas` sera exclusivo del owner/jefe general.

## Criterio de salida

Se puede volver al contrato de lead cuando:

- roles iniciales esten aceptados;
- permisos minimos esten aceptados;
- tablas minimas de identidad esten aprobadas conceptualmente;
- estructura minima de areas y jerarquia este aprobada conceptualmente;
- reglas de autenticacion esten alineadas con seguridad BFF;
- exista claridad de quien puede crear/asignar/ver usuarios;
- exista regla aprobada de revocacion dinamica de permisos;
- no haya duda de que todo lead futuro tendra actor, rol y permiso auditable.
