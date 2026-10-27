# 51 - Limpieza de datos nativos

## Lectura vigente del registro - 2026-10-27

Este documento conserva evidencia de una operacion puntual del 2026-10-26;
no es inventario de datos actual ni instruccion para repetir una limpieza.
No se abrio MySQL ni se ejecuto el script durante esta revision documental.

La estructura y el ledger conservados no restauran contenido de catalogos:
031 puede seguir aplicada aunque `conf_lead_status` se haya vaciado. 036 tiene
una restauracion explicita y acotada de estados/aprobaciones de ordenes vacios,
no de etapas/motivos de Leads. Ver [52](52-Etapas-Responsables-y-Tiempos.md).
Tambien se aplico posteriormente el retiro puntual del permiso de Eventos y
citas descrito en [53](53-Captacion-Leads-Reporte-Federado.md); por ello 205
permisos del resultado original no debe presentarse como conteo actual.

El script exige inventario fijo: nuevas tablas incorporadas despues pueden
hacer que rechace la operacion. Ese rechazo es una salvaguarda para revisar,
no autorizacion para ampliar automaticamente la lista ni vaciar el ledger.
La excepcion administrativa de esta limpieza no cambia la regla de consultas
federadas sin importar registros viejos.

Fecha: 2026-10-26. Operacion ejecutada y verificada contra CRM_THINK_V2.

## Alcance definitivo

El propietario autorizo eliminar los datos sin respaldo y, antes de ejecutar,
corrigio el alcance: conservar TODOS los usuarios, no solo Owner. Se conservaron
sus identidades, configuracion Microsoft, imagenes, referencias de usuario,
roles, permisos, modulos, asignaciones y excepciones. No se escribio en
crmdatabase-api ni se cambiaron credenciales. El trabajo de seguimiento de 50
fue interrumpido por esta solicitud; no se declara finalizado aqui.

## Resultado observado

- 68 tablas revisadas: 15 preservadas y 53 vaciadas; 547 filas eliminadas.
- Usuarios: 46; roles: 7; permisos: 205; asignaciones usuario-rol: 46.
- Identidades de autenticacion: 4; configuracion Microsoft: 1.
- Proyectos, referencias de proyectos, campanas, leads, contactos, ordenes,
  calendarios e historiales de las tablas limpiadas: cero filas.
- Tambien se vaciaron catalogos auxiliares de etapas/tipos/motivos de negocio.
  Su reactivacion requiere una carga explicita posterior, no seeds automaticos.
- Sesiones CRM y refresh tokens eliminados: hay que iniciar sesion nuevamente.
- Estructura, indices, FK y triggers conservados. Cada FK nativa se valido
  antes/despues y los conteos de las 15 tablas preservadas no cambiaron.
- conf_schema_migration conserva sus 25 entradas preexistentes. No se borro
  el ledger ni se simulo reaplicar migraciones sobre tablas existentes.

Una consulta independiente posterior confirmo proyectos=0, campanas=0, leads=0,
ordenes=0, audit_record_event=0, audit_security_event=0 y sesiones=0; usuarios=46,
roles=7 y permisos=205. Son observaciones al cierre: un nuevo login u operacion
puede crear sesiones y eventos. El API local reiniciado respondio health/ready.

## Procedimiento y limites

[Script manual](../scripts/clear-native-business-data.ts): dry-run por defecto;
--apply=CRM_THINK_V2 exige destino exacto e inventario explicito. Se rechazan
tablas nuevas, FK entre esquemas, eventos habilitados y dependencias desde
configuracion preservada hacia tablas a vaciar. No abre conexiones legacy.

Se detuvo temporalmente solo el API local. Se obtuvo el mutex de migraciones y
bloqueos WRITE sobre tablas calificadas unicamente de CRM_THINK_V2; los conteos
se volvieron a leer bajo bloqueo. FOREIGN_KEY_CHECKS cambio solo en esa conexion
y se restablecio; se liberaron bloqueos al terminar. TRUNCATE conserva estructura
y no dispara triggers DELETE: es una excepcion administrativa expresa, no un
bypass de auditoria disponible en el API. No se creo respaldo; no hay rollback
de los datos eliminados. No ejecutar este script en CI, arranque o pruebas.

Verificacion local: siete pruebas unitarias de salvaguardas y ESLint focalizado
aprobados. Typecheck completo encontro un error previo del trabajo interrumpido
en test/sales-orders/follow-up.spec.ts; no se presenta como validacion global.
Las pruebas de mantenimiento no conectan a ninguna BD ni ejecutan fixtures.

El fallback legacy no cambio: una pantalla puede mostrar datos leidos de
crmdatabase-api aunque la tabla nativa este vacia. No borrar el ledger para
forzar seeds ni importar registros sin autorizacion.
