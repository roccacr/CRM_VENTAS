# 32 - Seeds de Identidad P0-S1

## Veredicto

Este documento define los datos iniciales que la futura migracion de `CRM_THINK_V2` debe insertar para identidad, roles, permisos, areas y sistemas externos.

No es migracion productiva ni runtime.

No autoriza crear runtime NestJS, migraciones productivas, endpoints ni pantallas.

Sirve para que la primera migracion SQL no invente codigos, roles, areas ni permisos.

La ley `00-Producto-CRM-TINK-y-P0.md` version `0.3.5` autorizo validar `SQL/001_identity_schema_p0_s1.sql` como migracion controlada de estructura y ejecutar `SQL/002_identity_seed_p0_s1.sql` solo como seed de catalogos S1A en `CRM_THINK_V2`. La version vigente `0.3.15` mantiene ese resultado, autoriza solo el runtime minimo de identidad y prohibe tocar credenciales productivas compartidas mientras existan servicios vivos dependientes.

## Artefacto SQL controlado

El seed revisable queda en:

```txt
SQL/002_identity_seed_p0_s1.sql
```

Reglas:

- es un artefacto controlado de arquitectura;
- no debe ejecutarse contra produccion sin aprobacion explicita del dueno;
- se ejecuto en `CRM_THINK_V2` bajo la autorizacion del `00` version `0.3.5`;
- no crea el primer owner porque faltan correo y nombre reales aprobados;
- no incluye contrasenas reales;
- no incluye permisos comerciales de lead todavia;
- si este documento y el SQL se contradicen, gana este documento hasta corregir el SQL.

Regla de migracion actual:

```txt
Primero se valido estructura. Luego se autoriza solo el seed de catalogos S1A. Usuarios, credenciales, datos personales y datos de negocio siguen fuera.
```

## Registro de validacion

| Fecha | Motor encontrado | Resultado | Nota |
| --- | --- | --- | --- |
| 2026-09-25 | MariaDB 10.4.32 de XAMPP | Bloqueado, no ejecutado como validacion oficial | La autorizacion exige MySQL local desechable. No se encontro servidor MySQL 8 instalado o activo; no se ejecuto `001` ni `002` contra MariaDB para no registrar una validacion falsa. |
| 2026-09-25 | Runner pnpm/Kysely/mysql2 | Preparado, no ejecutado contra base | Se creo runner schema-only y paso typecheck. La prueba sin `.env` fallo antes de conectar por falta de `DB_NAME`, que es el comportamiento esperado. |
| 2026-09-25 | MySQL 8.0.45 via MCP `mysql_crm_ventas` | Pass schema-only manual | Se valido estructura en `CRM_THINK_V2` con 14 tablas, 27 llaves foraneas, 0 columnas sin comentario y 0 filas insertadas. La aplicacion fue manual por MCP, no por el runner; por eso `conf_schema_migration` no quedo creada ni registrada. No se ejecuto `SQL/002_identity_seed_p0_s1.sql`; no se tocaron tablas equivalentes en `crmdatabase-api`. |
| 2026-09-25 | Diff tecnico MySQL metadata | Pass estructural | `CRM_THINK_V2` tiene 14 tablas InnoDB con `utf8mb4_unicode_ci`; 27 FKs `ON UPDATE CASCADE` / `ON DELETE RESTRICT`; todas las columnas tienen comentario; todos los `DATETIME` usan precision 3; las 4 columnas `active_key_*` quedaron como `STORED GENERATED`; los unicos activos usan esas columnas generadas; las 14 tablas tienen 0 filas; `conf_schema_migration` no existe; `crmdatabase-api` no recibio tablas equivalentes. |
| 2026-09-25 | Marca manual equivalente via MCP `mysql_crm_ventas` | Pass metadata-only | Se creo `CRM_THINK_V2.conf_schema_migration` y se registro una fila para `202609250001_identity_schema`. `conf_schema_migration` existe solo en `CRM_THINK_V2`, no en `crmdatabase-api`. Las 14 tablas de identidad siguen con 0 filas. No se ejecuto el runner por falta de `.env` seguro y para no exponer credenciales en archivos, comandos o logs. |
| 2026-09-25 | Seed `SQL/002_identity_seed_p0_s1.sql` via MCP `mysql_crm_ventas` | Pass catalogos S1A | Autorizado por ley `0.3.5` y ejecutado solo en `CRM_THINK_V2`. El primer bloque multi-statement dejo una desviacion parcial: faltaban 5 areas hijas, 3 sistemas externos y 4 eventos de auditoria. Se completo con sentencias individuales totalmente calificadas contra `CRM_THINK_V2`. Conteos finales: 17 permisos, 8 roles, 80 relaciones rol-permiso, 6 areas, 3 sistemas externos, 4 eventos de auditoria, 0 usuarios, 0 identidades auth, 0 roles de usuario y 0 areas de usuario. `crmdatabase-api` no recibio tablas equivalentes ni inserts. |

Registro pendiente:

```txt
La migracion `202609250001_identity_schema` quedo registrada mediante marca manual equivalente en `CRM_THINK_V2.conf_schema_migration`. El `.env` local ya existe para runtime, pero el runner end-to-end sigue pendiente hasta tener un entorno no productivo o credenciales dedicadas de migracion que no dependan del usuario master compartido. No se debe usar `usuario_master_compartido` para probar runners.
```

## Recuperacion ante fallo parcial de DDL

MySQL confirma cada DDL por separado. Si el runner schema-only falla despues de crear algunas tablas y antes de registrar `conf_schema_migration`, la siguiente ejecucion debe fallar de forma cerrada al detectar tablas objetivo existentes.

Regla:

```txt
No se reintenta encima de tablas parciales sin revision manual.
```

Pasos:

1. confirmar que la base afectada sea exclusivamente `CRM_THINK_V2`;
2. verificar que no existan datos reales, usuarios, credenciales ni datos del CRM viejo;
3. comparar las tablas existentes contra `SQL/001_identity_schema_p0_s1.sql`;
4. si la base era desechable y vacia, solicitar aprobacion explicita del dueno antes de eliminar/recrear solo `CRM_THINK_V2` o retirar manualmente las tablas parciales del esquema de identidad;
5. ejecutar de nuevo el runner y registrar el resultado aqui;
6. nunca tocar `crmdatabase-api` ni otra base para recuperar este fallo.

## Permisos minimos de base de datos

El API y el runner no deben usar el usuario master de RDS/MySQL.

Regla:

```txt
El usuario del API no debe ser master/admin. CRM_THINK_V2 y legacy pueden compartir host MySQL, pero deben usar usuarios distintos: runtime del CRM nuevo para CRM_THINK_V2 y usuario legacy de solo lectura para crmdatabase-api.
```

### Correccion operativa sobre credenciales productivas compartidas

Reporte corregido el `2026-09-25`:

- P1 anterior decia "rotar la contrasena del usuario maestro". Esa accion queda anulada como tarea ejecutable mientras existan servicios productivos usando `usuario_master_compartido`.
- P2 anterior decia "probar que la contrasena vieja ya no conecta". Esa accion tambien queda anulada, porque romper la clave anterior corta servicios vivos que aun dependan de ella.
- El incidente confirmado mostro servicios vivos (`api-kapso` y `AppCrmVentas`) usando `usuario_master_compartido`; por tanto, cualquier rotacion del master queda prohibida hasta inventariar y migrar esos servicios a usuarios dedicados.

Nueva regla:

```txt
No se rota, revoca ni invalida usuario_master_compartido mientras algun servicio productivo dependa de ese usuario.
```

Orden correcto:

1. inventariar servicios que usan `usuario_master_compartido`;
2. crear usuarios dedicados por servicio con privilegios minimos;
3. actualizar cada servicio a su usuario dedicado;
4. reiniciar/verificar cada servicio;
5. solo cuando `usuario_master_compartido` no tenga consumidores vivos, aprobar ventana y rollback para rotarlo;
6. documentar sin guardar secretos.

### Estado actual de `usuario_master_compartido` tras rollback

Estado registrado el `2026-09-25`:

- `usuario_master_compartido` fue restaurado a la clave anterior para recuperar servicios vivos.
- Esa clave anterior debe tratarse como credencial expuesta porque ya estuvo en archivos/env/historiales/adjuntos durante el incidente.
- Por lo anterior, P1/P2 anteriores dejan de estar cerrados: quedan reemplazados por el plan de migrar servicios a usuarios dedicados antes de cualquier rotacion futura.
- Se eliminaron los archivos locales DPAPI `rds-master-password.dpapi` y `rds-master-password.meta.json` para no conservar localmente una credencial master activa y expuesta.
- `apps/api/.env` debe quedarse con el usuario runtime dedicado; no debe volver a usar `usuario_master_compartido`.
- El nombre `usuario_master_compartido` no es secreto por si solo, pero revela media credencial operativa; se conserva aqui por trazabilidad del incidente y no debe repetirse en documentos nuevos salvo necesidad de auditoria.

Riesgo activo:

```txt
Mientras `usuario_master_compartido` siga vigente y expuesto, el control compensatorio urgente es restringir red en RDS: security group con 3306 solo para IPs/hosts conocidos y revisar accesos desconocidos.
```

### Registro del incidente `usuario_master_compartido`

| Punto | Estado |
| --- | --- |
| Fecha | `2026-09-25` |
| Causa | Se roto la clave de `usuario_master_compartido` sin inventario completo previo de consumidores. |
| Servicios afectados reportados | `api-kapso` con Prisma `P1000`; `AppCrmVentas` con `Access denied for user 'usuario_master_compartido'@'servidor-crm-viejo'`. |
| Restauracion | Se devolvio `usuario_master_compartido` a la clave anterior para levantar los servicios dependientes. |
| Datos/tablas | No se tocaron datos de negocio ni tablas para restaurar el acceso; la accion fue sobre credencial MySQL. |
| Duracion exacta | No verificable desde esta maquina sin logs PM2/AWS completos. |
| Confirmacion local posterior | MySQL acepto conexion de `usuario_master_compartido` con la clave anterior y rechazo la clave rotada. |
| Confirmacion de servicios | No confirmada por HTTP/PM2 desde esta maquina. MySQL mostro conexiones vivas desde el host `servidor-crm-viejo` hacia `crmdatabase-api`, lo que indica procesos conectados despues del rollback. |
| Pendiente critico | Revisar RDS security group, Public accessibility y logs de conexion en AWS. |

### Inventario MySQL de consumidores actuales

Consulta de solo lectura ejecutada el `2026-09-25T21:02:29Z`:

```sql
SELECT USER, HOST, DB, COUNT(*)
FROM information_schema.PROCESSLIST
GROUP BY USER, HOST, DB;
```

Resultado resumido sin secretos:

| Usuario | Origen | Base | Conexiones actuales | Lectura |
| --- | --- | --- | ---: | --- |
| `usuario_master_compartido` | `servidor-crm-viejo` | `crmdatabase-api` | 8 | Servicios vivos del CRM viejo/API viejo siguen dependiendo del master. |
| `usuario_master_compartido` | `servidor-crm-hotel` | `crmdatabase-hotel` | 5 | Otro servicio productivo usa el mismo master. |
| `usuario_master_compartido` | `servidor-expodesign` | `expodesign_crm` | 1 | Otro servicio productivo usa el mismo master. |
| `usuario_master_compartido` | `ip-local-de-trabajo` | `CRM_THINK_V2` / sin DB | 3 | Conexiones de revision local; no deben quedar como patron operativo. |
| `rdsadmin` / `event_scheduler` | `localhost` | sistema | 3 | Procesos propios de RDS/MySQL. |

`performance_schema.accounts` no entrego historico porque `performance_schema` aparece deshabilitado (`OFF`) en esta instancia. Este inventario es fotografia del momento; no detecta jobs intermitentes. Debe repetirse en distintos horarios y complementarse con PM2/AWS/logs.

### Pendientes manuales de AWS/OneDrive

No se pudieron cerrar desde esta maquina:

- AWS CLI no esta instalado/configurado (`aws=NOT_FOUND`), por lo que no se pudo revisar security group, Public accessibility ni logs RDS.
- OneDrive/SharePoint requiere revision manual web para papelera, papelera secundaria e historial de versiones.

Acciones manuales obligatorias:

1. limitar el puerto `3306` del security group RDS solo a IPs/hosts conocidos;
2. revisar si RDS esta publico y desactivarlo si no es imprescindible;
3. revisar logs de conexion por accesos de `usuario_master_compartido` desde IPs desconocidas;
4. borrar en OneDrive cualquier copia/version historica de archivos con credenciales.

Usuario runtime:

- permiso de conexion a MySQL;
- `SELECT`, `INSERT` y `UPDATE` solo sobre las tablas operativas de `CRM_THINK_V2` que use el runtime de identidad;
- `audit_security_event` debe ser append-only para el runtime: `INSERT` para registrar eventos y `SELECT` solo si una consulta autorizada necesita leerlos; sin `UPDATE` ni `DELETE`;
- sin `CREATE`, `ALTER`, `DROP`, `GRANT`, `CREATE USER`, `ALTER USER` ni privilegios globales;
- si `LEGACY_CRM_DB_NAME` esta configurado, `LEGACY_CRM_DB_USER` debe tener solo `SELECT` sobre las tablas legacy autorizadas; queda prohibido `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER` o `DROP` sobre legacy;
- el pool legacy debe ejecutar `SET SESSION TRANSACTION READ ONLY` por conexion como defensa adicional; esta regla no reemplaza el usuario MySQL de solo lectura.

Usuario de migracion schema-only, si se separa del runtime:

- permiso de conexion a MySQL;
- `CREATE` y `REFERENCES` solo dentro de `CRM_THINK_V2` para crear tablas aprobadas con llaves foraneas;
- `SELECT`, `INSERT` y `UPDATE` solo sobre `CRM_THINK_V2.conf_schema_migration`;
- sin `DROP`, `GRANT`, `CREATE USER`, `ALTER USER` ni privilegios globales;
- sin permisos sobre legacy; migraciones nunca deben tocar la base vieja.

TLS:

- si la base esta en RDS o fuera de la maquina local, `DB_SSL=true` debe ser la configuracion esperada;
- para RDS se debe configurar `DB_SSL_CA` con el bundle CA oficial de AWS, regional o global;
- queda prohibido resolver errores TLS usando `rejectUnauthorized=false`.

Certificado RDS configurado:

- origen oficial: `https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`;
- archivo local: `apps/api/certs/rds-global-bundle.pem`;
- fecha de descarga inicial: `2026-09-25`;
- naturaleza del archivo: certificado publico de autoridades CA de AWS RDS, sin llaves privadas ni secretos; puede versionarse;
- regla de arranque: `DB_SSL_CA` debe apuntar a una ruta valida desde la carpeta donde se ejecuta el API; se recomienda ruta absoluta en `.env` local para evitar depender del cwd;
- revision minima: revisar el bundle al menos una vez al ano, antes de `2027-09-25`, o antes si AWS anuncia rotacion de CA.

## Regla superior

```txt
Solo se puede seedear lo que este aprobado aqui o confirmado por el dueno del producto.
```

Si falta un dato real, queda como pendiente. No se inventa.

## Orden de seeds

La futura migracion debe insertar en este orden:

1. `sec_permission`
2. `sec_role`
3. `sec_role_permission`
4. `sec_org_unit`
5. `int_external_system`
6. `sec_user` inicial, solo cuando exista correo real aprobado
7. `sec_auth_identity` del usuario inicial, solo cuando exista usuario real aprobado
8. `sec_user_role` del usuario inicial
9. `sec_user_org_unit` del usuario inicial
10. `audit_security_event` de creacion inicial

Motivo: roles y permisos deben existir antes de asignarlos a usuarios.

## Estados iniciales permitidos

Estos codigos se usan como valores iniciales en tablas de identidad:

| Codigo | Uso |
| --- | --- |
| `active` | Registro activo y usable. |
| `inactive` | Registro desactivado sin borrar historico. |
| `blocked` | Usuario o identidad bloqueada por seguridad o negocio. |
| `pending` | Usuario, sistema externo o configuracion creado como previsto, pendiente de activacion operativa. |
| `archived` | Registro historico no operativo. |
| `revoked` | Sesion, token, rol, area u override revocado. |
| `expired` | Sesion o token vencido. |
| `rotated` | Refresh token reemplazado por rotacion. |
| `reused` | Refresh token reutilizado indebidamente. |

Regla:

```txt
No usar estados numericos.
```

## Providers de autenticacion permitidos

No existe tabla separada para providers en P0-S1. Estos codigos son constantes permitidas para `sec_auth_identity.provider_code_auth_identity`.

| Codigo | Uso |
| --- | --- |
| `microsoft` | Login principal con Microsoft 365 / Entra ID. |
| `local` | Login alternativo por correo y clave, controlado por el API. |

Reglas:

- `microsoft` es el flujo principal.
- `local` queda habilitado desde P0-S1 como alternativa controlada.
- un usuario puede tener identidad `microsoft` y tambien identidad `local`.
- `local` no guarda password plano.
- `local` solo usa hash Argon2id o bcrypt con costo minimo 12.
- el frontend no recibe tokens ni hashes.
- ninguna migracion puede incluir contrasenas reales.

## Roles seed

Tabla destino: `sec_role`.

| code_role | name_role | status_role | Proposito |
| --- | --- | --- | --- |
| `owner` | Owner | `active` | Control maximo del CRM. Uso limitado a muy pocas personas. |
| `jefe_general` | Jefe General | `active` | Supervision general de negocio sobre varias o todas las areas segun alcance. |
| `gerente` | Gerente | `active` | Gestion amplia de operacion segun areas asignadas. |
| `jefe_area` | Jefe de Area | `active` | Supervision de una o varias areas especificas. |
| `subjefe_area` | Subjefe de Area | `active` | Apoyo de supervision en una o varias areas/subareas. |
| `supervisor` | Supervisor | `active` | Supervision operativa de equipo o vendedores asignados. |
| `vendedor` | Vendedor | `active` | Atiende registros comerciales asignados. |
| `soporte_sistemas` | Soporte Sistemas | `active` | Soporte tecnico, diagnostico e integraciones sin acceso comercial automatico. |

Reglas:

- no crear roles con nombre de area;
- no crear `jefe_mercadeo`, `jefe_formalizacion` ni equivalentes;
- el alcance se resuelve con `sec_user_org_unit`, no con roles duplicados.

## Permisos seed

Tabla destino: `sec_permission`.

| code_permission | module_code_permission | action_code_permission | status_permission | Proposito |
| --- | --- | --- | --- | --- |
| `auth.login` | `auth` | `login` | `active` | Permite iniciar sesion. |
| `auth.logout` | `auth` | `logout` | `active` | Permite cerrar sesion. |
| `user.view_self` | `user` | `view_self` | `active` | Permite ver el propio perfil. |
| `user.view_list` | `user` | `view_list` | `active` | Permite ver lista de usuarios dentro del alcance. |
| `user.view_detail` | `user` | `view_detail` | `active` | Permite ver detalle de usuario dentro del alcance. |
| `user.create` | `user` | `create` | `active` | Permite crear usuarios. |
| `user.update` | `user` | `update` | `active` | Permite modificar usuarios. |
| `user.activate` | `user` | `activate` | `active` | Permite activar usuarios. |
| `user.deactivate` | `user` | `deactivate` | `active` | Permite desactivar usuarios. |
| `role.view` | `role` | `view` | `active` | Permite ver roles. |
| `role.assign` | `role` | `assign` | `active` | Permite asignar roles dentro del alcance permitido. |
| `permission.view` | `permission` | `view` | `active` | Permite ver permisos. |
| `permission.override` | `permission` | `override` | `active` | Permite agregar o quitar permisos puntuales a un usuario dentro del alcance. |
| `org.view` | `org` | `view` | `active` | Permite ver areas/equipos. |
| `org.manage` | `org` | `manage` | `active` | Permite crear, editar, activar o desactivar areas. |
| `org.assign_user` | `org` | `assign_user` | `active` | Permite asignar usuarios a areas/equipos. |
| `audit.security.view` | `audit` | `security_view` | `active` | Permite ver auditoria de seguridad. |

Regla:

```txt
No seedear permisos comerciales de lead todavia.
```

Los permisos de lead se definen despues de cerrar identidad y volver al contrato canonico del lead.

## Role permissions seed

Tabla destino: `sec_role_permission`.

Esta tabla se inserta usando `code_role` y `code_permission` como referencia logica. La migracion SQL real debe resolver los IDs internos.

Regla operativa: si se agrega un permiso al catalogo P0-S1A, el seed de `owner` y `jefe_general` debe re-ejecutarse o actualizarse en el mismo cambio para que ambos roles reciban el catalogo completo vigente.

### owner

`owner` recibe todos los permisos P0-S1:

```txt
auth.login
auth.logout
user.view_self
user.view_list
user.view_detail
user.create
user.update
user.activate
user.deactivate
role.view
role.assign
permission.view
permission.override
org.view
org.manage
org.assign_user
audit.security.view
```

### jefe_general

`jefe_general` recibe todos los permisos P0-S1 igual que `owner`, pero su uso operativo debe ser gobernado por alcance y auditoria.

Regla: puede tener `all_areas` si negocio lo confirma.

### gerente

Permisos base:

```txt
auth.login
auth.logout
user.view_self
user.view_list
user.view_detail
user.update
role.view
permission.view
org.view
org.assign_user
```

Regla: opera por alcance asignado.

### jefe_area

Permisos base:

```txt
auth.login
auth.logout
user.view_self
user.view_list
user.view_detail
user.update
role.view
permission.view
org.view
org.assign_user
```

Regla: normalmente usa `own_area_and_children`.

### subjefe_area

Permisos base:

```txt
auth.login
auth.logout
user.view_self
user.view_list
user.view_detail
role.view
permission.view
org.view
```

Regla: acciones de escritura quedan por override si negocio lo aprueba.

### supervisor

Permisos base:

```txt
auth.login
auth.logout
user.view_self
user.view_list
user.view_detail
org.view
```

Regla: normalmente usa alcance por equipo o asignados.

### vendedor

Permisos base:

```txt
auth.login
auth.logout
user.view_self
```

Regla: permisos comerciales de lead se agregan despues, no en este seed.

### soporte_sistemas

Permisos base:

```txt
auth.login
auth.logout
user.view_self
user.view_list
user.view_detail
role.view
permission.view
org.view
audit.security.view
```

Regla: soporte tecnico no recibe acceso comercial automatico.

## Areas seed

Tabla destino: `sec_org_unit`.

La jerarquia inicial aprobada es:

```txt
empresa
├── ventas
├── formalizacion
├── contabilidad
├── mercadeo
└── sistemas
```

| code_org_unit | name_org_unit | parent | sort_order_org_unit | status_org_unit | Proposito |
| --- | --- | --- | --- | --- | --- |
| `empresa` | Empresa | null | 10 | `active` | Raiz organizacional. |
| `ventas` | Ventas | `empresa` | 20 | `active` | Operacion comercial principal. |
| `formalizacion` | Formalizacion | `empresa` | 30 | `active` | Proceso posterior al avance comercial aprobado. |
| `contabilidad` | Contabilidad | `empresa` | 40 | `active` | Area financiera/contable. |
| `mercadeo` | Mercadeo | `empresa` | 50 | `active` | Campanas, origenes y gestion comercial de marketing. |
| `sistemas` | Sistemas | `empresa` | 60 | `active` | Soporte tecnico e integraciones. |

Reglas:

- no borrar areas con historico;
- desactivar antes que borrar;
- una persona puede pertenecer a varias areas;
- el jefe general puede ver todo solo si tiene alcance `all_areas`;
- jefes/subjefes se modelan con `sec_user_org_unit`, no con columnas dentro de `sec_user`.

## Alcances seed

No existe tabla separada para alcances en P0-S1A. Estos codigos son valores permitidos para `sec_user_org_unit.scope_code_user_org_unit`.

| Codigo | Uso |
| --- | --- |
| `self` | Solo el propio usuario. |
| `assigned` | Registros asignados directamente al usuario. |
| `own_area` | Datos/personas del area asignada directamente. |
| `own_area_and_children` | Area asignada y subareas. |
| `all_areas` | Todas las areas permitidas del CRM. Uso restringido. |

Regla:

```txt
all_areas queda reservado para owner y jefe_general, salvo aprobacion expresa.
```

## Membership seed

No existe tabla separada para membership en P0-S1. Estos codigos son valores permitidos para `sec_user_org_unit.membership_code_user_org_unit`.

| Codigo | Uso |
| --- | --- |
| `member` | Usuario miembro normal de un area. |
| `leader` | Responsable principal de un area. |
| `assistant_leader` | Subjefe o apoyo de supervision del area. |
| `supervisor` | Supervisor operativo de equipo/personas asignadas. |

## Sistemas externos seed

Tabla destino: `int_external_system`.

| code_external_system | name_external_system | status_external_system | Proposito |
| --- | --- | --- | --- |
| `netsuite` | NetSuite | `active` | ERP actual / sistema externo actual. |
| `odoo` | Odoo | `pending` | ERP futuro o convivencia futura previsto desde P0-S1; no operativo todavia. |
| `legacy_crm` | CRM Legacy | `active` | CRM actual/viejo usado para lectura o migracion controlada. |

Reglas:

- estos codigos son datos, no nombres de tablas core;
- Odoo nunca se ignora: queda registrado desde el inicio como proveedor futuro preparado;
- `pending` en Odoo significa preparado en arquitectura, no activo para sincronizacion operativa;
- ningun modelo interno usa IDs externos como FK;
- usuarios externos viven en `int_user_external_identity`;
- entidades comerciales futuras y calendario quedan fuera de S1A.

## Usuario owner inicial

No se debe crear usuario real sin correo confirmado.

Plantilla pendiente:

| Campo | Valor |
| --- | --- |
| `email_user` | Pendiente: correo oficial del primer `owner`. |
| `display_name_user` | Pendiente: nombre visible del primer `owner`. |
| `status_user` | `active` cuando sea confirmado. |
| rol inicial | `owner`. |
| area inicial | `empresa`. |
| membership inicial | `leader`. |
| scope inicial | `all_areas`. |
| auth inicial | `microsoft`; `local` queda `pending` hasta invitacion/reset seguro. |

Regla:

```txt
No usar correos ficticios en la migracion.
```

## Usuario jefe_general inicial

Decision cerrada:

```txt
owner y jefe_general deben ser responsabilidades separadas.
```

Motivo:

- `owner` es control maximo, configuracion, emergencia y gobierno tecnico/administrativo;
- `jefe_general` es operacion de negocio y supervision diaria;
- separar ambos reduce riesgo de abuso accidental y mantiene auditoria mas clara;
- el rol `owner` no debe usarse como cuenta diaria de trabajo.

Regla principal:

```txt
Crear un usuario real owner y otro usuario real jefe_general.
```

Excepcion controlada:

El primer `owner` solo puede recibir tambien `jefe_general` si el dueno lo aprueba expresamente como emergencia de arranque.

No se aprueba inventar un usuario temporal.

Si la misma persona inicia con ambos roles, debe quedar auditado como bootstrap inicial y revisarse cuando exista la persona de negocio definitiva.

## Login local seed

No se debe seedear password real en texto ni hash manual sin procedimiento aprobado.

Reglas:

- login local nace habilitado como alternativa controlada junto con Microsoft;
- se activa mediante invitacion o reset seguro;
- la migracion no debe contener passwords reales;
- el usuario inicial debe preferir Microsoft;
- cualquier credencial temporal debe obligar cambio inmediato y quedar auditada;
- si todavia no existe flujo de invitacion/reset, la identidad `local` debe quedar `pending` hasta completar ese flujo.

## Auditoria seed

La futura migracion puede registrar eventos iniciales de auditoria solo si el esquema ya existe.

Eventos sugeridos:

| event_type_security_event | summary_security_event |
| --- | --- |
| `seed_permissions_created` | Permisos iniciales de identidad creados. |
| `seed_roles_created` | Roles iniciales de identidad creados. |
| `seed_org_units_created` | Areas iniciales creadas. |
| `seed_external_systems_created` | Sistemas externos iniciales creados. |
| `seed_owner_created` | Usuario owner inicial creado, solo si existe correo confirmado. |

Regla:

```txt
Los eventos seed no sustituyen auditoria futura de acciones reales.
```

## Prohibido en estos seeds

No incluir todavia:

- usuarios vendedores reales sin fuente aprobada;
- usuarios importados desde NetSuite sin reconciliacion;
- permisos comerciales de lead;
- estados de lead;
- proyectos;
- campanas;
- corredores;
- calendarios;
- notas;
- datos de clientes;
- passwords reales;
- tokens;
- IDs externos dentro de `sec_user`.

## Pendientes antes de bootstrap real de usuarios

Antes de crear usuarios reales o credenciales iniciales, el dueno debe confirmar:

1. Correo oficial del primer `owner`.
2. Nombre visible del primer `owner`.
3. Correo oficial del primer `jefe_general`.
4. Nombre visible del primer `jefe_general`.

Regla:

```txt
Sin correo y nombre reales, no se crea seed de usuario.
```

## Criterio de salida

Este documento queda listo para SQL/seed controlado cuando:

- los roles seed esten aceptados;
- los permisos seed esten aceptados;
- la matriz `sec_role_permission` este aceptada;
- las areas seed esten aceptadas;
- los sistemas externos seed esten aceptados;
- no haya correos, passwords ni usuarios inventados.

Queda listo para bootstrap real de usuarios solo cuando existan correos y nombres oficiales de `owner` y `jefe_general`.
