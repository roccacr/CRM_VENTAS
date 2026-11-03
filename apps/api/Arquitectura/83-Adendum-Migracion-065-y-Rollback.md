# Adéndum: migración 065 y cambio legacy separado

## Contrato posterior: motivo y envío (072)

La ampliación vigente está en [88](88-Adendum-Motivo-y-Envio.md): motivo obligatorio al marcar pendiente y marca «Enviado» separada de «Completado», sin cambiar etapas. Los ENUM de tres valores que siguen describen065;072 agrega `sent` al final y exige aprobación independiente para DDL compartido.

## Precedencia posterior de 066/067 y límite de esta revisión

065 y su CLI legacy constan aplicados en ambos esquemas; 066 agrega la nota y separa lectura/marcado manual; 067 configura el default manual de Owner, Jefe General y Jefe de Formalizaciones mediante grants reales. El rol Formalización conserva lectura/update, sin marcado manual por defecto. Prevalece [84](84-Adendum-Manual-Migracion-066-y-Permisos.md) para esos permisos. La evidencia de aplicación y SQL QA que sigue es histórica: no se reejecutó ni se consultó BD en esta reconciliación.

Antes de retirar las columnas 065, revisar también las dependencias 066/067 y el código actual. Conservarlas es la reversión operativa preferida; el DROP ilustrativo requiere respaldo, retiro del escritor y aprobación específica. La documentación no aprueba ejecutarlo.

Estado: **ambos cambios aplicados y verificados en RDS el 2026-11-03**, con autorización expresa del usuario y después de las pruebas. Se ejecutó primero el CLI legacy y después únicamente la migración nativa 065. No se crearon eventos ni se modificaron marcas de órdenes reales durante esta aplicación.

## Cambios concretos

| BD / tabla | Columna | Tipo | NULL | Default |
| --- | --- | --- | --- | --- |
| CRM_THINK_V2.crm_sales_order | addendum_status_sales_order | ENUM('pending','completed','cancelled') | Sí | NULL |
| CRM_THINK_V2.crm_sales_order | addendum_version_sales_order | INT UNSIGNED | No | 0 |
| CRM_THINK_V2.crm_sales_order | addendum_changed_at_sales_order | DATETIME(3) | Sí | NULL |
| crmdatabase-api.ordenventa | estado_adendum_ov | ENUM('pending','completed','cancelled') | Sí | NULL |
| crmdatabase-api.ordenventa | version_adendum_ov | INT UNSIGNED | No | 0 |
| crmdatabase-api.ordenventa | fecha_adendum_ov | DATETIME(3) | Sí | NULL |

Sin tablas ni índices nuevos, sin backfill y sin actualizar datos comerciales existentes. NULL significa que no se ha registrado un adéndum; no se convierte ninguna orden histórica a pendiente. La versión inicial es 0. Se agrega un único ALTER por BD con las columnas que falten y `ALGORITHM=INSTANT`; si el servidor no lo soporta, falla sin degradar automáticamente a una copia de tabla.

Solo en BD nueva se registra `formalizacion.orders.addendum.update`, «Gestionar estado de adéndum», módulo Formalización / Orden de venta. Asignaciones por defecto: `owner`, `formalizacion`, `jefe_formalizaciones`, `jefe_general`. No se modifican reglas de herencia ni excepciones personales; una asignación inactiva ya existente se conserva. Los usuarios de roles a los que efectivamente se agrega el permiso reciben incremento de `permission_version_user`. La operación se atribuye a un Owner activo y se registra en `audit_security_event`.

## Aplicación después de aprobación

Desde `apps/api`, con las variables de conexión del entorno de destino revisadas:

```powershell
# Solo 065 en la BD nueva; comprobar primero en desarrollo/QA.
$env:MIGRATION_CONFIRM_SCHEMA_ONLY = 'CRM_THINK_V2'
pnpm exec tsx scripts/run-schema-migrations.ts --only=202611030065_formalization_order_addendum

# La BD vieja queda fuera del runner nativo. Plan sin DDL:
pnpm exec tsx scripts/migrate-legacy-addendum.ts --plan
# Solo después de aprobación específica para legacy:
pnpm exec tsx scripts/migrate-legacy-addendum.ts --apply=crmdatabase-api
```

El runner nativo valida `CRM_THINK_V2`; el CLI legacy valida `crmdatabase-api`, usa una conexión fijada y un lock exclusivo. El preflight comprueba tablas InnoDB y las tres definiciones antes del primer ALTER. La 065 además valida todos los roles, la definición del permiso y el actor antes del DDL; vuelve a validarlos dentro de la transacción de permisos para evitar aplicar una fotografía obsoleta. La 065 limita la espera de metadata locks a 10 segundos en una conexión fijada y restaura su valor anterior incluso cuando falla el DDL; el CLI limita la misma espera a 10 segundos y destruye su conexión al terminar.

**MySQL confirma DDL implícitamente.** Las columnas no comparten rollback con permisos/auditoría. Si falla la fase de seguridad, su DML se revierte, pero las columnas pueden quedar creadas y la migración sin ledger de éxito. Se revisan sus metadatos y se reintenta 065: las columnas compatibles se conservan. Una definición incompatible bloquea el reintento; no se corrige ni elimina automáticamente. Las operaciones de permisos y su auditoría sí son atómicas entre ellas.

## Rollback concreto, separado y aprobado

1. Detener las escrituras de adéndum y retirar el código que requiere estas columnas. Revisar que no existan eventos nuevos o acciones de negocio que deban preservarse antes de retirar el esquema.
2. Exportar de forma segura los IDs, estados, versiones y fechas; respaldar también la definición del permiso, asignaciones por rol, excepciones y el evento de auditoría de 065. No usar `INTO OUTFILE` ni copiar datos de contacto a logs.

```sql
SELECT public_id_sales_order, addendum_status_sales_order,
       addendum_version_sales_order, addendum_changed_at_sales_order
FROM CRM_THINK_V2.crm_sales_order
WHERE addendum_status_sales_order IS NOT NULL OR addendum_version_sales_order <> 0;

SELECT id_ov, estado_adendum_ov, version_adendum_ov, fecha_adendum_ov
FROM `crmdatabase-api`.ordenventa
WHERE estado_adendum_ov IS NOT NULL OR version_adendum_ov <> 0;
```

3. Solo después del respaldo y aprobación, retirar las columnas creadas por esta aplicación. Si alguna existía antes de 065, **no retirarla**: usar el inventario previo para ajustar el ALTER. Estos comandos suponen que las tres columnas fueron nuevas:

```sql
ALTER TABLE CRM_THINK_V2.crm_sales_order
  DROP COLUMN addendum_status_sales_order,
  DROP COLUMN addendum_version_sales_order,
  DROP COLUMN addendum_changed_at_sales_order;

ALTER TABLE `crmdatabase-api`.ordenventa
  DROP COLUMN estado_adendum_ov,
  DROP COLUMN version_adendum_ov,
  DROP COLUMN fecha_adendum_ov;
```

4. Si 065 creó el permiso desde cero y no existieron cambios administrativos posteriores sobre él, desactivarlo conservando el historial. La operación siguiente se ejecuta solo en CRM_THINK_V2 y no toca excepciones individuales:

```sql
START TRANSACTION;
UPDATE sec_user u
SET u.permission_version_user = u.permission_version_user + 1
WHERE EXISTS (
  SELECT 1 FROM sec_user_role ur
  JOIN sec_role_permission rp ON rp.role_id_role_permission = ur.role_id_user_role
  JOIN sec_permission p ON p.id_permission = rp.permission_id_role_permission
  WHERE ur.user_id_user_role = u.id_user
    AND ur.status_user_role = 'active' AND ur.revoked_at_user_role IS NULL
    AND p.code_permission = 'formalizacion.orders.addendum.update'
    AND rp.status_role_permission = 'active'
);
UPDATE sec_role_permission rp
JOIN sec_permission p ON p.id_permission = rp.permission_id_role_permission
SET rp.status_role_permission = 'inactive'
WHERE p.code_permission = 'formalizacion.orders.addendum.update';
UPDATE sec_permission
SET status_permission = 'inactive'
WHERE code_permission = 'formalizacion.orders.addendum.update';
COMMIT;
```

Registrar la reversión mediante el flujo administrativo auditado de roles/permisos, con actor real y el respaldo del inventario previo. Si el permiso ya existía antes, restaurar únicamente las asignaciones añadidas por 065 según dicho respaldo; no ejecutar la desactivación global. No borrar auditorías ni excepciones. El ledger de 065 se conserva como evidencia; una futura reaplicación requiere una migración de reconciliación, porque la definición inactiva se detecta como drift.

## Verificación disponible

`test/migrations/formalization-order-addendum.spec.ts` verifica compilación SQL, destino, InnoDB, drift de las tres columnas antes de DDL, roles/permiso, idempotencia, auditoría, recuperación tras fallo DML, CLI estricto y ausencia de backfill. No constituye ejecución contra MySQL 8 real. Las pruebas de funcionamiento contra ambas BDs dependen de aplicar primero el esquema autorizado en desarrollo/QA.

## Regla funcional confirmada por el usuario

- Un evento de Formalización de tipo `adendum` requiere exactamente una orden y su cliente canónico. Elegir la orden incorpora su cliente; elegir un cliente filtra las órdenes disponibles.
- La orden y el cliente quedan fijos después de crear el Adéndum. El bloqueo se conserva como metadato exclusivo del servidor incluso si después se cambia el tipo del evento; no puede eludirse enviando otro payload.
- La marca pertenece a la orden: `pending`, `completed` o `cancelled`. Un nuevo Adéndum o una conversión a ese tipo actualiza la marca a pendiente y aumenta su versión, incluso si ya estaba pendiente. Una edición ordinaria o el reenvío de una operación no la reabre.
- Desde la orden solo se puede completar o cancelar una marca pendiente. Se comprueban permiso, versión y operación idempotente. Esta acción no cambia el estado del evento ni del lead.
- No puede guardarse otro Adéndum si la misma orden tiene uno programado cuyo inicio es posterior al reloj del servidor. Se excluyen el propio evento editado y los eventos eliminados, completados o cancelados; la consulta no depende de la semana visible ni de la fecha elegida para el nuevo evento.
- La comprobación previa informa de la fecha del evento existente cuando el usuario tiene acceso. Si no lo tiene, bloquea sin revelar detalles del evento. Una falla de verificación no se interpreta como ausencia de eventos.
- Al guardar se repite la comprobación con lectura actual y bloqueo de la orden; dos creaciones concurrentes no pueden confirmar dos eventos futuros. Un conflicto o deadlock revierte toda la operación y devuelve 409 para revisar o reintentar.
- Evento, marca nativa o legacy y sus bitácoras nativas comparten una transacción InnoDB. Si falla la auditoría, se revierte la escritura comercial. La publicación externa del calendario conserva su mecanismo posterior a la transacción y no determina la marca de la orden.
- Los tres campos son internos del CRM: no se sincronizan ni sobrescriben desde NetSuite.

El frontend muestra la marca en la ficha completa y en el panel del listado. Las acciones utilizan `GET/POST /formalization/orders/addendum`; la comprobación previa utiliza `GET /formalization/orders/addendum/future`. La validación definitiva también se ejecuta en la API de calendario, independientemente del navegador.

## Verificación de la aplicación autorizada

El plan legacy se consultó antes del DDL y ambos comandos de aplicación terminaron
con código 0. La consulta posterior de `information_schema` confirmó las seis
columnas con los tipos, nulabilidad y defaults de la tabla anterior. Nativa pasó
de 35 a 38 columnas y legacy de 41 a 44; los índices se conservaron en 11 y 6,
respectivamente. El conteo de órdenes siguió en 0 nativas y 467 legacy; ninguna
marca quedó poblada ni versionada por la migración. Se verificaron los cuatro
grants activos y una entrada de 065 en el ledger y en auditoría de seguridad.

La concurrencia y los fallos de auditoría se probaron con repositorios y servicio
reales sobre bases QA aisladas de MariaDB local, usando adaptadores controlados
para auditoría y legacy. Esa prueba valida las transacciones, bloqueos y replay;
no equivale a guardar un evento real de cliente ni a publicar uno en Outlook.

`test/calendar/addendum.local-sql.spec.ts`, activado únicamente con `ADDENDUM_LOCAL_SQL_TESTS=1`, ejecuta el servicio y los dos repositorios reales contra MariaDB 10.4.32 local en el puerto 3309. Antes de cualquier DDL exige el datadir aislado `netsuite-events-mariadb-20261102`, crea dos BDs QA con nombre único y solo elimina esos esquemas que creó. No altera `CRM_THINK_V2` ni `crmdatabase-api` existentes. El puerto legacy apunta al esquema QA y el auditor de fixture escribe evidencia InnoDB en la misma transacción: verifica carreras, replay y rollback, pero no sustituye la validación del auditor, ACL, adaptador legacy ni migraciones en MySQL 8 productivo. Casos ejecutados: dos creadores simultáneos para orden nativa y legacy (un éxito, un 409, un evento y marcador pendiente versión 1); reenvío del ganador sin duplicar evidencias; error de auditoría posterior al marcador con rollback completo en ambos orígenes; edición de un evento pasado a futuro concurrente con la creación de otro, sin dos eventos futuros.
