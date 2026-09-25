# 28 - Matriz de Roles, Permisos y Areas P0-S1

## Veredicto

La forma correcta de manejar permisos en el CRM no es crear un rol distinto por cada area.

La decision aprobada para P0-S1 es:

```txt
usuario + rol + area/equipo + alcance + excepciones personales = permiso efectivo
```

Motivo: el sistema debe ser facil de gestionar por jefatura, pero internamente debe quedar normalizado, auditable y preparado para crecer.

Un jefe no debe aprender tablas. El jefe debe poder hacer acciones simples:

- asignar un usuario a un area;
- darle un rol;
- agregar un permiso puntual;
- quitar un permiso puntual;
- ver que permisos efectivos tiene una persona;
- ver quien hizo el cambio y cuando.

El API y la base de datos resuelven la complejidad.

## Que problema resuelve

La empresa puede tener esta realidad:

```txt
jefe_general
+-- jefe_mercadeo
|   +-- empleados_mercadeo
+-- jefe_formalizacion
|   +-- empleados_formalizacion
+-- jefe_contabilidad
    +-- empleados_contabilidad
```

Pero tambien puede pasar esto:

```txt
Maria
rol: jefe_area
areas: mercadeo, formalizacion
```

Maria es una sola usuaria. No se duplica. No se crean roles `jefe_mercadeo` y `jefe_formalizacion`.

Se crean dos vinculos de area para la misma persona.

## Regla mental obligatoria

```txt
rol = que puede hacer
area/equipo = donde puede hacerlo
permiso personal = ajuste puntual sobre esa persona
```

Ejemplo:

```txt
usuario: Maria
rol: jefe_area
areas: mercadeo, formalizacion
alcance: own_area_and_children
```

Resultado:

Maria puede ejecutar acciones de jefe en Mercadeo y Formalizacion, siempre que el permiso exista y no haya una denegacion personal.

## Por que asi y no de otra forma

### Opcion descartada: roles por cada area

Ejemplo malo:

```txt
jefe_mercadeo
jefe_formalizacion
jefe_contabilidad
subjefe_mercadeo
subjefe_formalizacion
```

Problemas:

- crece demasiado rapido;
- mezcla cargo con area;
- obliga a crear roles nuevos cada vez que cambia la empresa;
- complica reportes;
- dificulta quitar un permiso puntual sin tocar a todos los usuarios del rol.

### Opcion aprobada: rol generico + area

Ejemplo correcto:

```txt
rol: jefe_area
area: mercadeo
alcance: own_area_and_children
```

Ventajas:

- una persona puede liderar varias areas;
- un area puede tener jefe y subjefe;
- se puede mover una persona de area sin cambiar el rol;
- se puede quitar un permiso puntual sin crear otro rol;
- la base queda normalizada;
- jefatura puede gestionarlo desde una UI simple.

## Roles iniciales P0-S1

Estos roles son de referencia inicial. No significan pantallas completas todavia.

| Rol | Para que sirve | Puede tener areas asignadas |
| --- | --- | --- |
| `owner` | Control maximo del CRM. Debe ser limitado a muy pocas personas. | Si, normalmente `all_areas`. |
| `jefe_general` | Supervision general de negocio. Puede ver varias o todas las areas segun alcance. | Si. |
| `gerente` | Gestion amplia de operacion segun areas asignadas. | Si. |
| `jefe_area` | Supervision de una o varias areas especificas. | Si. |
| `subjefe_area` | Apoyo de supervision en una o varias areas/subareas. | Si. |
| `supervisor` | Supervision operativa de equipo o vendedores asignados. | Si. |
| `vendedor` | Atiende registros comerciales asignados. | Si, pero normalmente como miembro, no como jefe. |
| `soporte_sistemas` | Soporte tecnico, diagnostico e integraciones. No implica acceso comercial automatico. | Si, si negocio lo autoriza. |

Reglas:

- un usuario puede tener varios roles;
- un usuario puede tener varias areas;
- un rol no debe tener nombre de area;
- un area no debe definir por si sola que acciones puede hacer la persona;
- `soporte_sistemas` no ve datos comerciales solo por ser sistemas;
- `owner` no debe usarse como rol operativo diario;
- las acciones finales siempre se autorizan por permiso efectivo.

## Areas iniciales P0-S1

Areas conceptuales iniciales:

| Codigo | Nombre visible | Proposito |
| --- | --- | --- |
| `empresa` | Empresa | Raiz organizacional. |
| `ventas` | Ventas | Operacion comercial principal. |
| `formalizacion` | Formalizacion | Proceso posterior al avance comercial aprobado. |
| `contabilidad` | Contabilidad | Area financiera/contable. |
| `mercadeo` | Mercadeo | Campanas, origenes y gestion comercial de marketing. |
| `sistemas` | Sistemas | Soporte tecnico e integraciones. |

Reglas:

- las areas se guardan en arbol;
- un area puede tener subareas;
- un usuario puede estar en una o varias areas;
- una persona puede ser jefa en un area y miembro normal en otra;
- desactivar un area no debe borrar historico;
- cambiar un jefe de area debe dejar auditoria.

## Alcances permitidos

| Alcance | Significado |
| --- | --- |
| `self` | Solo el propio usuario. |
| `assigned` | Registros asignados directamente al usuario. |
| `own_area` | Datos/personas de las areas asignadas directamente. |
| `own_area_and_children` | Area asignada y sus subareas. |
| `all_areas` | Todas las areas permitidas del CRM. Uso restringido. |

Reglas:

- `all_areas` queda reservado para `owner` y `jefe_general`, salvo aprobacion expresa;
- `jefe_area` normalmente usa `own_area_and_children`;
- `subjefe_area` normalmente usa `own_area` o `own_area_and_children` segun decision de jefatura;
- `vendedor` normalmente usa `assigned`;
- el frontend no decide el alcance, solo muestra lo que el API devuelve.

## Permisos minimos P0-S1

Estos permisos son atomicos. La UI puede mostrarlos agrupados para que jefatura no vea una lista incomoda.

| Permiso | Para que sirve |
| --- | --- |
| `auth.login` | Permite iniciar sesion. |
| `auth.logout` | Permite cerrar sesion. |
| `user.view_self` | Permite ver el propio perfil. |
| `user.view_list` | Permite ver lista de usuarios dentro del alcance. |
| `user.view_detail` | Permite ver detalle de usuario dentro del alcance. |
| `user.create` | Permite crear usuarios. |
| `user.update` | Permite modificar usuarios. |
| `user.activate` | Permite activar usuarios. |
| `user.deactivate` | Permite desactivar usuarios. |
| `role.view` | Permite ver roles. |
| `role.assign` | Permite asignar roles dentro del alcance permitido. |
| `permission.view` | Permite ver permisos. |
| `permission.override` | Permite agregar o quitar permisos puntuales a un usuario dentro del alcance. |
| `org.view` | Permite ver areas/equipos. |
| `org.manage` | Permite crear, editar, activar o desactivar areas. |
| `org.assign_user` | Permite asignar usuarios a areas/equipos. |
| `audit.security.view` | Permite ver auditoria de seguridad. |

No se aprueban aqui permisos comerciales de lead. Esos se cierran cuando vuelva el contrato canonico del lead.

## Matriz base

Esta matriz es el punto de partida para P0-S1. No reemplaza la validacion del API.

| Permiso | owner | jefe_general | gerente | jefe_area | subjefe_area | supervisor | vendedor | soporte_sistemas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auth.login` | Si | Si | Si | Si | Si | Si | Si | Si |
| `auth.logout` | Si | Si | Si | Si | Si | Si | Si | Si |
| `user.view_self` | Si | Si | Si | Si | Si | Si | Si | Si |
| `user.view_list` | Si | Si | Si | Si, por area | Si, por area | Si, por equipo | No | Si, tecnico |
| `user.view_detail` | Si | Si | Si | Si, por area | Si, por area | Si, por equipo | No | Si, tecnico |
| `user.create` | Si | Si | No por defecto | No por defecto | No | No | No | No por defecto |
| `user.update` | Si | Si | Si, por alcance | Si, por area | No por defecto | No | No | No por defecto |
| `user.activate` | Si | Si | No por defecto | No por defecto | No | No | No | No por defecto |
| `user.deactivate` | Si | Si | No por defecto | No por defecto | No | No | No | No por defecto |
| `role.view` | Si | Si | Si | Si | Si | No | No | Si, tecnico |
| `role.assign` | Si | Si | No por defecto | No por defecto | No | No | No | No |
| `permission.view` | Si | Si | Si | Si | Si | No | No | Si, tecnico |
| `permission.override` | Si | Si | No por defecto | No por defecto | No | No | No | No |
| `org.view` | Si | Si | Si | Si | Si | Si | No | Si, tecnico |
| `org.manage` | Si | Si | No | No | No | No | No | No por defecto |
| `org.assign_user` | Si | Si | Si, por alcance | Si, por area | No por defecto | No | No | No |
| `audit.security.view` | Si | Si | No por defecto | No por defecto | No | No | No | Si, tecnico |

Reglas de lectura:

- "Si, por area" significa que aplica solo a las areas asignadas al usuario;
- "Si, por equipo" significa que aplica solo a usuarios/equipo asignado;
- "tecnico" significa soporte sin acceso comercial automatico;
- "No por defecto" significa que puede agregarse con `permission.override` si negocio lo aprueba.

## Como debe verse para jefatura

Jefatura no debe administrar esto editando tablas ni leyendo codigos tecnicos.

La UI futura debe mostrar algo parecido a:

```txt
Usuario: Maria
Roles: jefe_area
Areas: mercadeo, formalizacion
Alcance: area y subareas

Permisos agregados:
- user.update

Permisos quitados:
- permission.override
```

Acciones simples:

- agregar rol;
- quitar rol;
- agregar area;
- quitar area;
- agregar permiso puntual;
- quitar permiso puntual;
- ver resumen efectivo;
- guardar motivo del cambio.

Regla: cada cambio debe pedir motivo corto cuando afecte acceso, rol, permiso o alcance.

## Modelo logico de base de datos

No es SQL final. Es la estructura logica que debe respetar la futura migracion MySQL.

| Tabla | Responsabilidad |
| --- | --- |
| `sec_user` | Persona interna que puede usar el CRM. |
| `sec_auth_identity` | Metodo de autenticacion del usuario: Microsoft o local. |
| `sec_role` | Catalogo de roles. |
| `sec_permission` | Catalogo de permisos atomicos. |
| `sec_user_role` | Relacion muchos-a-muchos entre usuario y rol. |
| `sec_role_permission` | Permisos incluidos por cada rol. |
| `sec_org_unit` | Arbol de areas/equipos. |
| `sec_user_org_unit` | Areas/equipos asignados a un usuario y alcance de ese vinculo. |
| `sec_user_permission_override` | Permisos agregados o quitados a una persona especifica. |
| `int_external_system` | Catalogo generico de sistemas externos. |
| `int_user_external_identity` | Relacion entre usuario interno e ids externos como NetSuite, Odoo o CRM viejo. |
| `int_external_reference` | Relacion entre entidades internas e ids externos como NetSuite, Odoo o CRM viejo. |
| `audit_security_event` | Auditoria de login, cambios de rol, permisos, areas y seguridad. |

Reglas fisicas obligatorias cuando se cree SQL:

- toda columna debe llevar `COMMENT`;
- columnas con sufijo de entidad;
- tablas en singular;
- prefijo `sec_` para identidad/seguridad;
- prefijo `audit_` para auditoria;
- prefijo `int_` para integraciones y referencias externas;
- normalizacion por defecto;
- nada de NetSuite, Odoo, Kapso ni nombres legacy;
- `sec_user` no puede tener `idnetsuite_admin`, `idodoo_user`, `manager_user_id` ni campos equivalentes;
- los ids externos de usuarios viven en `int_user_external_identity`;
- los ids externos de entidades comerciales viven en `int_external_reference`;
- `sec_user_permission_override` debe permitir `allow` y `deny`;
- los cambios de permisos deben incrementar `permission_version_user` en `sec_user`;
- ninguna eliminacion fisica de rol, permiso o area si ya existe historico.

## Calculo de permiso efectivo

El API debe calcular asi:

```txt
1. identificar usuario autenticado
2. leer roles activos
3. leer permisos de roles activos
4. leer areas/equipos activos del usuario
5. aplicar permisos personales agregados
6. aplicar permisos personales denegados
7. validar alcance contra el recurso solicitado
8. permitir o rechazar la accion
9. registrar auditoria si la accion es sensible
```

Regla superior:

```txt
Una denegacion personal gana sobre un permiso de rol.
```

Ejemplo:

```txt
Maria tiene rol jefe_area.
El rol jefe_area permite user.update por area.
Pero Maria tiene deny user.update.
Resultado: Maria no puede modificar usuarios, aunque conserve el rol.
```

## Reglas para que sea facil de manejar

- Los jefes gestionan usuarios desde opciones simples, no desde permisos crudos.
- El sistema debe mostrar "que puede hacer" en lenguaje humano.
- El sistema debe mostrar "por que tiene ese permiso": rol, area, permiso agregado o permiso denegado.
- Quitar un permiso puntual no debe obligar a crear otro rol.
- Agregar un permiso puntual no debe cambiar el rol base.
- Cambiar de area no debe borrar usuario ni historico.
- Una persona puede tener multiples areas.
- Una persona puede tener multiples roles.
- Todo cambio debe quedar en `audit_security_event`.

## Lo que queda fuera ahora

No entra en P0-S1 de identidad:

- flujos complejos de aprobacion por varias personas;
- aprobaciones por flujo;
- calendario;
- leads;
- reglas comerciales de perdida o pausa;
- permisos de NetSuite/Odoo;
- sincronizacion externa;
- motor externo tipo OpenFGA o Cerbos;
- pantallas completas de administracion.

Esto queda preparado, pero no autorizado todavia.

## Preguntas que quedan para aprobar

Antes de convertir esto a SQL final:

1. Cual usuario sera `owner` inicial.
2. Quien sera `jefe_general` inicial.
3. Si `gerente` queda activo desde P0-S1 o preparado.
4. Si `jefe_area` podra crear usuarios o solo asignar usuarios existentes.
5. Si `jefe_area` podra quitar permisos puntuales o eso queda solo para `jefe_general`.
6. Si `soporte_sistemas` puede ver usuarios comerciales o solo diagnostico tecnico.
7. Cuales areas iniciales se cargan como seed.
8. Cual sera el motivo obligatorio minimo al cambiar permisos.

## Criterio de salida

Este documento queda listo cuando:

- roles iniciales esten aceptados;
- areas iniciales esten aceptadas;
- alcances esten aceptados;
- matriz base este aceptada;
- reglas de override personal esten aceptadas;
- jefatura confirme que la gestion propuesta es entendible;
- el siguiente paso sea modelo fisico MySQL, no leads.
