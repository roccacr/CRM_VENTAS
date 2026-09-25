# 31 - Contrato de Identidad y Permisos P0-S1A

## Veredicto

P0-S1 empieza por identidad, no por leads.

Este documento define la base aprobada para construir despues:

```txt
usuario -> login -> roles -> areas -> permisos efectivos -> auditoria
```

No autoriza crear runtime NestJS, migraciones ejecutables ni endpoints. Autoriza el modelo conceptual y fisico minimo que debe respetar la futura migracion MySQL.

P0-S1A no intenta construir un IAM empresarial completo. Cierra una regla operable:

```txt
usuario + rol + area/jerarquia + override directo = permiso efectivo minimo
```

Las delegaciones temporales quedan previstas para una fase posterior, pero no son parte obligatoria ni construible de P0-S1A.

## Artefactos SQL controlados

Existen dos archivos SQL derivados de este contrato:

```txt
SQL/001_identity_schema_p0_s1.sql
SQL/002_identity_seed_p0_s1.sql
```

Reglas:

- son artefactos de arquitectura para revisar el modelo fisico;
- no son migraciones aplicadas;
- no autorizan ejecutar cambios en base de datos productiva;
- no crean runtime NestJS;
- no crean usuarios reales hasta confirmar correo y nombre del owner;
- cualquier cambio en esos SQL debe respetar este contrato, el diccionario y el estandar de nombres.

## Contrato API derivado

El contrato conceptual de endpoints y JSON de identidad vive en:

```txt
33-Contrato-API-Identidad-P0-S1.md
```

Reglas:

- no es OpenAPI ejecutable;
- no autoriza runtime NestJS;
- debe respetar este contrato de identidad;
- debe usarse antes de crear endpoints de sesion, usuario actual o permisos efectivos.

## Regla superior

```txt
Ninguna accion del CRM existe sin usuario interno, permiso efectivo y auditoria cuando aplique.
```

El CRM debe poder explicar:

- quien es la persona;
- como entro al sistema;
- que rol tenia;
- en que area podia actuar;
- que permiso exacto permitio o bloqueo la accion;
- quien cambio sus permisos;
- cuando se hizo el cambio;
- que motivo se registro.

## Decisiones cerradas

| Decision | Regla |
| --- | --- |
| Base nueva | `CRM_THINK_V2`. |
| Idioma fisico BD | Ingles canonico. |
| Comentarios y diccionario | Espanol claro. |
| Login principal | Microsoft 365 / Entra ID. |
| Login alternativo | Correo y clave local habilitado como alternativa controlada. |
| Patron de sesion | BFF con cookies seguras. |
| Tokens en frontend | Prohibido. |
| IDs externos | Solo en tablas `int_`. |
| Relaciones internas | Siempre por IDs internos del CRM. |
| Estados | Palabras, no numeros magicos. |
| Permisos | Atomicos y evaluados por el backend. |
| Permiso revocado | Bloquea la siguiente accion protegida o en pocos segundos como maximo. |
| Jefaturas | Rol generico + area + alcance; no roles por cada area. |
| Override directo | Entra en P0-S1A: permite agregar o negar un permiso puntual a una persona. |
| Delegacion temporal | Prevista para futuro; no entra como flujo obligatorio en P0-S1A. |
| Owner y jefe general | Responsabilidades separadas; `owner` no es cuenta diaria de negocio. |
| Activacion login local | Invitacion/reset seguro; prohibido seedear passwords o hashes manuales. |
| Borrado | Logico en tablas maestras; auditoria append-only. |
| Normalizacion | Obligatoria por defecto. |

## Modelo minimo aprobado

Tablas de identidad y seguridad:

| Tabla | Responsabilidad |
| --- | --- |
| `sec_user` | Persona interna del CRM. |
| `sec_auth_identity` | Forma de autenticacion: Microsoft o local. |
| `sec_auth_session` | Sesion backend activa o revocada. |
| `sec_refresh_token` | Refresh tokens rotados, guardados como hash. |
| `sec_role` | Catalogo de roles generales. |
| `sec_permission` | Catalogo de permisos atomicos. |
| `sec_user_role` | Roles asignados a usuarios. |
| `sec_role_permission` | Permisos incluidos por rol. |
| `sec_org_unit` | Areas/equipos en arbol. |
| `sec_user_org_unit` | Usuario asignado a area, funcion y alcance. |
| `sec_user_permission_override` | Permisos puntuales agregados o denegados a una persona. |
| `audit_security_event` | Bitacora de seguridad, accesos, roles, permisos y areas. |

Tablas de integracion necesarias para identidad:

| Tabla | Responsabilidad |
| --- | --- |
| `int_external_system` | Catalogo generico de sistemas externos. |
| `int_user_external_identity` | IDs externos de un usuario interno por sistema. |

Tabla transversal futura, fuera de P0-S1A:

| Tabla | Responsabilidad |
| --- | --- |
| `int_external_reference` | IDs externos de leads, oportunidades, estimaciones, ordenes, contratos, eventos u otras entidades internas. Se define cuando se abra el corte comercial/integraciones. |

## Reglas de usuario

`sec_user` representa una persona interna.

No representa:

- lead;
- cliente;
- contacto comercial;
- usuario de NetSuite;
- usuario de Odoo;
- usuario del CRM viejo.

Regla:

```txt
sec_user.id_user = identidad interna
int_user_external_identity = aliases externos del usuario
```

Ejemplo:

```txt
Maria tiene sec_user.id_user = 20
NetSuite la conoce como 12345
Odoo la conoce como 987
```

Maria sigue siendo una sola persona interna. NetSuite y Odoo son referencias externas.

## Reglas de roles, areas y jerarquia

El CRM no crea roles como `jefe_mercadeo` o `jefe_formalizacion`.

`owner` y `jefe_general` no son el mismo concepto:

- `owner` gobierna configuracion, emergencia, administracion maxima y control tecnico/administrativo;
- `jefe_general` supervisa operacion de negocio;
- un usuario `owner` no debe usarse como cuenta diaria de ventas o supervision;
- el primer `owner` y el primer `jefe_general` deben ser usuarios reales separados cuando existan los correos oficiales;
- si por emergencia la misma persona recibe ambos roles, debe quedar auditado como excepcion temporal y no como modelo normal.

Modelo correcto:

```txt
rol = que puede hacer
area = donde puede hacerlo
alcance = hasta donde llega
override = ajuste puntual personal
```

Una persona puede ser jefa de varias areas.

Ejemplo:

```txt
usuario: Maria
rol: jefe_area
area 1: mercadeo
area 2: formalizacion
alcance: own_area_and_children
```

Resultado: Maria puede operar como jefa en mercadeo y formalizacion, si conserva los permisos efectivos necesarios.

## Permiso efectivo

El backend calcula permisos asi:

```txt
roles activos
+ permisos del rol
+ areas y alcances activos
+ permisos personales allow vigentes
- permisos personales deny vigentes
= permiso efectivo
```

Regla:

```txt
deny gana sobre allow.
```

Un usuario puede estar autenticado y perder permiso durante la sesion. La siguiente accion protegida debe validar la version actual de permisos.

## Version de permisos

`sec_user.permission_version_user` cambia cuando ocurre cualquiera de estos eventos:

- se asigna rol;
- se revoca rol;
- se asigna area;
- se revoca area;
- se agrega permiso personal;
- se deniega permiso personal;
- se revoca override;
- se bloquea el usuario;
- se reactiva el usuario.

Regla:

```txt
La sesion identifica al usuario; no congela sus permisos.
```

## Delegaciones futuras

Una delegacion permite que una persona reciba temporalmente un permiso que normalmente no tiene.

No entra como flujo obligatorio de P0-S1A.

P0-S1A resuelve el caso actual de negocio con `sec_user_permission_override`:

- agregar permiso puntual directo a una persona;
- negar permiso puntual directo a una persona;
- auditar quien lo hizo, cuando y por que;
- incrementar `permission_version_user`;
- validar el cambio en la siguiente accion protegida.

Ejemplo:

```txt
Gerente delega aprobacion a un vendedor por 2 dias.
```

Reglas futuras, no obligatorias en P0-S1A:

- debe tener fecha de inicio;
- puede tener fecha de fin;
- debe tener motivo;
- debe registrar quien delega;
- debe registrar quien recibe;
- debe incrementar `permission_version_user` del usuario que recibe;
- debe generar `audit_security_event`;
- no debe cambiar el rol base del usuario;
- al vencerse o revocarse, el permiso deja de aplicar.

## Reglas de login

Microsoft 365 es el login principal.

Login local es alternativa controlada y queda previsto desde P0-S1 junto con Microsoft.

Reglas:

- no guardar tokens en frontend;
- no guardar password plano;
- hash local con Argon2id o bcrypt costo minimo 12;
- no incluir contrasenas reales en migraciones ni seeds;
- activar login local por invitacion o reset seguro;
- si el flujo de invitacion/reset no existe todavia, la identidad local queda `pending`;
- una credencial temporal, si llegara a existir por decision posterior, debe obligar cambio inmediato y quedar auditada;
- crear flujo seguro de alta/reset antes de permitir uso real de clave local;
- refresh token siempre guardado como hash;
- refresh token con rotacion;
- reuso de refresh token invalida la familia;
- login fallido se audita;
- usuario inactivo, bloqueado o archivado no opera el CRM.

## Reglas de MySQL

La futura migracion debe cumplir:

- motor InnoDB;
- charset `utf8mb4`;
- collation compatible con MySQL 8;
- PK `BIGINT UNSIGNED AUTO_INCREMENT`;
- `public_id_* CHAR(26)` para API/frontend;
- todas las columnas con `COMMENT`;
- FK internas con `ON DELETE RESTRICT`;
- borrado logico en maestras;
- auditoria append-only;
- indices para login, correo normalizado, estado, permisos, roles, areas y fechas de auditoria.

## Borrado logico

No se borra fisicamente:

- usuario con historico;
- rol usado;
- permiso usado;
- area usada;
- identidad externa usada;
- evento de auditoria.

Se desactiva o archiva.

Regla:

```txt
El sistema conserva historia aunque cambie la estructura organizacional.
```

## Pendientes reales antes de bootstrap de usuarios

Estas preguntas no cambian la arquitectura, pero se deben responder antes de crear usuarios reales:

1. Correo oficial del primer `owner`.
2. Nombre visible del primer `owner`.
3. Correo oficial del primer `jefe_general`.
4. Nombre visible del primer `jefe_general`.

Reglas ya cerradas:

- `owner` y `jefe_general` deben ser responsabilidades separadas;
- login local se activa por invitacion/reset seguro;
- `local` queda `pending` si el flujo seguro aun no existe;
- no se seedearan passwords ni hashes manuales;
- no se inventan correos, nombres ni usuarios temporales.

Los seeds propuestos y pendientes viven en `32-Seeds-Identidad-P0-S1.md`.

## Criterio de salida

Este contrato queda listo para SQL controlado cuando:

- el dueno confirma `32-Seeds-Identidad-P0-S1.md`;
- el SQL respeta `29-Modelo-Fisico-MySQL-Identidad-P0-S1.md`;
- el diccionario respeta `Diccionario-Datos/01-Identidad-y-Permisos.md`;
- ninguna tabla core usa nombres de NetSuite, Odoo, Kapso o legacy;
- ninguna relacion interna depende de un id externo;
- no se crean usuarios reales sin correo y nombre confirmados.
