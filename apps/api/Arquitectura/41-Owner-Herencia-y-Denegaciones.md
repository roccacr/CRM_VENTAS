# 41 - Owner: herencia efectiva y denegaciones

Actualizacion posterior: [42 - Jefaturas](42-Jefaturas-Modulos-y-Permisos.md)
agrega la resolucion virtual de modulos activos Owner, manteniendo denies y
asignaciones fisicas. Los resultados de 027 de este documento son su corte
fechado, no los conteos posteriores a crear roles/permisos adicionales.

## Decision confirmada - 2026-10-23

Owner activo hereda todos los roles activos y todos los permisos activos por
defecto. Un permiso denegado directamente a la persona prevalece. No se omiten
validaciones de negocio, de recurso o de sesion. Los otros roles mantienen sus
controles de asignacion/permisos habituales.

La herencia es efectiva, no una insercion de cada rol en `sec_user_role`.
Retirar/inactivar/revocar Owner elimina el acceso heredado en la siguiente
resolucion del perfil. Las asignaciones directas legitimas permanecen.
Roles inactivos/eliminados no se heredan; roles activos futuros se resuelven
dinamicamente. El directorio y el editor de asignaciones conservan roles directos.

## Plan y alcance

1. Migracion nativa aditiva `202610230027_owner_role_inheritance`: columna de
   politica en `sec_role`, modo Owner `all_active_roles`, permiso
   `formalizacion.home.stages.read` concedido a Owner y Formalizacion.
2. Resolver roles efectivos en el perfil, sin modificar las relaciones de usuarios.
   Owner conserva su base de permisos activos, pero ya no descarta overrides.
3. Banners de etapas requieren rol efectivo Formalizacion y permiso de lectura
   efectivo; guard, servicio y frontend deben coincidir. Aprobaciones conserva su
   permiso separado. No habilitar listados ni acciones preparadas.
4. Catalogo de seguridad muestra la base real completa de permisos Owner para
   poder editar excepciones por empleado sin una matriz historica incompleta.
5. Probar herencia, retirada/revocacion, denies, no-Owner, idempotencia, conflictos
   y rollback de DML mediante dobles. Ejecutar checks completos sin fixtures en BD.
6. Aplicar exclusivamente 027 con el runner y sus candados a `CRM_THINK_V2`.
   Verificar columna, politica, grants, ledger y evento. No tocar legacy ni crear
   usuarios/ordenes ficticios, credenciales o privilegios SQL.

## Limites de migracion y rollback

El DDL MySQL confirma fuera de la transaccion de datos. La columna nueva tiene
default `assigned`: por si sola no concede herencia. Se valida esquema destino,
tipo/default de columna y motores InnoDB de las siete tablas de identidad/audit.
La politica, grants nuevos, versiones de permisos y evento se confirman juntos.
Un fallo de audit revierte ese DML, no elimina la columna aditiva; reintentar es
idempotente. Un grant previamente revocado/conflictivo no se reactiva en silencio.

La migracion requiere un Owner activo sin deny vigente de `role.assign`; no borra
denegaciones para inventar un administrador recuperable. Cambios de versiones
pueden exigir recuperar/renovar sesion o iniciar sesion de nuevo.

Rollback operativo: desactivar la herencia Owner mediante un cambio auditado del
modo a `assigned` y coordinar el rollback de codigo/grants si se retira esta
entrega. No borrar columna, historial ni overrides. La base de permisos globales
Owner ya existia: el modo nuevo controla herencia de roles, no justifica omitir
denies ni convierte al resto de usuarios en administradores.

No ejecutar fixtures, pruebas de escritura/concurrencia o restauraciones sobre
las BD compartidas. Un doble no demuestra persistencia/concurrencia MySQL.

## Evidencia

Preflight real de solo lectura: destino `CRM_THINK_V2`, MySQL 8.0.45, Owner y
Formalizacion activos, ledger hasta 025, columna nueva ausente y sin denies
vigentes sobre los titulares de Owner.

027 aplicada mediante el runner oficial exclusivamente en `CRM_THINK_V2`.
Verificacion real de solo lectura: ledger registrado; Owner en `all_active_roles`,
Formalizacion en `assigned`; ambos grants nuevos activos y un evento
`owner_role_inheritance_enabled`. El resolver real devuelve roles efectivos
`owner`, `formalizacion`, `jefe_formalizaciones`, 200 permisos y lectura de banners
autorizada. No existe actualmente un rol activo Jefe de Ventas que heredar.

No se modificaron asignaciones directas, overrides, ordenes ni la BD legacy.
La denegacion individual se verifica con dobles, sin editar un usuario real.
Esto no acredita una sesion HTTP autenticada ni concurrencia MySQL.

La excepcion preexistente de lectura de auditoria sigue compartida por guard y
servicio: Owner activo puede sustituir el grant `role.assign`, pero nunca su deny.
Es una politica distinta de la lectura de banners, no una omision del deny.

Validacion final: `check-all.cmd` completo con salida 0; formato, lint, tipos y
builds de ambos proyectos aprobados. API: 5243 pruebas aprobadas, 113 MySQL
omitidas; frontend: 598 aprobadas. La primera corrida detecto la expectativa
desactualizada del registro de migraciones; se agrego 027 a la lista esperada y
la corrida completa posterior aprobo. No se ocultaron fallos ni se ejecutaron
fixtures MySQL. Log local: `C:/codex-data/audit-reports/CRM-TINK-Owner-2026-10-23-check-all-rerun.log`.

Comprobacion HTTP local sin sesion: `/health/live` 200, resumen Home 401 y listado
de contratos no registrado 404. Persisten avisos no bloqueantes de pseudo-elementos
JSDOM y tamanio del chunk Ant Design. No es una prueba autenticada de navegador
ni una certificacion de despliegue/CI. No se hicieron commits ni push.
