# 45 - Creacion de usuarios por correo

## Ampliacion posterior: rol Ventas

Autorizacion posterior del propietario: crear el rol Ventas, sin permisos de
acciones, asociado al modulo Ventas; asignarlo a los 43 usuarios del lote
`01M5NC0Y8293S6NDQGSTRK6J92`. No modificar los otros tres perfiles, estados,
credenciales, overrides ni membresias individuales de modulo. Registrar
creacion de rol y asignaciones en la bitacora nativa, en una transaccion.
La ausencia de roles descrita mas abajo corresponde al momento de importacion.

Resultado confirmado en CRM_THINK_V2: rol `ventas` ID 317 activo, asociado
solo a Ventas, cero permisos y herencias assigned. Run de asignacion:
`01M5NCFF00HMZPHE1N63E9MJRW`. Los 43 perfiles tienen su asignacion activa,
sin asignaciones a personas ajenas al lote. Se mantienen 30 pending y 13
inactive, cero identidades de acceso y cero membresias individuales de modulo.
Bitacora: un evento de creacion de rol, 43 asignaciones y 44 eventos centrales.
Los tres perfiles anteriores conservan su hash de fila. No hubo consultas ni
escrituras a legacy en esta ampliacion. La operacion se ejecuto mediante API
interna de auditoria en una transaccion InnoDB, sin cambios de runtime/esquema.
Verificacion posterior de conteos, destinatarios, permisos, estados y auditoria
por SELECT. Diff check de estos documentos correcto; no se ejecutaron suites
de aplicacion porque esta ampliacion solo cambia datos y documentacion.

Fecha: 2026-10-23. Autorizacion expresa: crear usuarios de `admins` por correo,
solo nombre y correo, como perfiles nuevos. No es una migracion comercial.

## Alcance

- Origen `crmdatabase-api.admins`: SELECT de ID, nombre, correo y estado.
- Destino exclusivo `CRM_THINK_V2.sec_user`: un perfil por correo normalizado.
- Activo anterior queda pending; inactivo queda inactive. No habilitar accesos.
- Usuario existente por correo se omite integramente, sin actualizarlo.
- No copiar contrasenas, tokens, roles, modulos, referencias ERP ni historial.
- Creacion y evento de auditoria se confirman en una transaccion InnoDB.
- Operador Owner actual sin deny de user.create; atribucion CLI explicita.
- No cambia esquema, configuracion, integraciones ni produccion.

## Ejecucion

Script `scripts/import-legacy-users.ts`. Sin argumentos es solo lectura.
Aplicacion requiere --apply, --confirm=CRM_THINK_V2, --actor=<public-id-owner>,
--expected-source=<conteo> y --expected-new=<conteo>. Una discrepancia aborta.
Credenciales se leen de configuracion existente y nunca se imprimen.
Indices unicos nativos impiden duplicacion; repetir previa debe dar cero nuevos.

## Resultado verificado del lote - 2026-10-23

Ejecucion confirmada en CRM_THINK_V2, run ID `01M5NC0Y8293S6NDQGSTRK6J92`:
44 origen, 1 existente omitido, 43 creados (30 pending, 13 inactive).
Total nativo posterior: 46 usuarios. Los 44 correos del origen estan representados.
43 eventos de seguridad y 43 eventos de bitacora de registro persistidos.
En el instante de importacion, los nuevos tenian cero roles, modulos,
identidades de acceso, overrides y referencias externas. La ampliacion descrita
arriba asigno despues `ventas` a los 43, sin grants de acciones, autenticacion
ni membresias individuales. No describirlos actualmente como usuarios sin rol
ni como cuentas habilitadas. Snapshot posterior: [49](49-Estado-Actual-y-Cierre-Documental.md).
Los tres perfiles anteriores conservaron el mismo SHA-256
de sus filas antes/despues; los cuatro campos leidos del origen tambien.
La segunda previa devuelve 44 existentes y cero nuevos: sin duplicacion.

Verificacion local: seis pruebas unitarias, eslint de los dos archivos,
Prettier de los dos archivos, typecheck API, build API y git diff --check pasan.
Revision independiente sin bloqueos. No se ejecutaron fixtures ni pruebas de
concurrencia en MySQL compartido, ni suite completa del proyecto.
