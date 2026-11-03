# Adéndum manual: nota y permisos independientes (066)

## Contrato posterior: motivo obligatorio y enviado

Prevalece [88](88-Adendum-Motivo-y-Envio.md) para la marcación actual: motivo obligatorio de3..2000 caracteres (también desde un evento nuevo/conversión), conservación de notas históricas y acción «Marcar adéndum como enviado» disponible a quien pueda leer la orden y su adéndum. Enviado no completa el adéndum ni cambia etapas. Los apartados de nota opcional inferiores documentan el comportamiento anterior de066. Los grants manuales efectivos de Owner/Jefe General/Jefe de Formalizaciones se conservan según067.

## Regla vigente después de 067 — 2026-11-03

Default manual: **Owner, Jefe General y Jefe de Formalizaciones** mediante grants reales; **Formalización no lo recibe por defecto**. La excepción al comodín Owner y el deny personal se mantienen. La tabla 066 y la captura donde Owner no mostraba el botón son cortes anteriores a 067, conservados como historia; no describen el default vigente. La aplicación de 065/066 en ambas BDs y 067 en nativa ya estaba documentada antes de esta revisión. No se ejecutan aquí BD, migraciones, pruebas SQL, eventos reales ni despliegues; las cifras inferiores no son resultados de esta reconciliación.

El rollback 066 que desactiva las tres definiciones no se debe ejecutar después de 067 sin revisar su dependencia y el delta de grants. Preferir retirar el escritor conservando esquema/evidencia. Solo una reversión expresamente aprobada y respaldada puede retirar el delta correspondiente; nunca borrar overrides, ledger o auditoría.

Aplicado y verificado en RDS el 2026-11-03 con autorización expresa del usuario,
después de las pruebas. Se ejecutó primero el CLI legacy de nota y luego únicamente
la migración nativa 066. La migración 065 y sus tres columnas base permanecen intactas.

## Esquema concreto

| BD / tabla | Columna nueva | Tipo | NULL | Default |
| --- | --- | --- | --- | --- |
| CRM_THINK_V2.crm_sales_order | addendum_note_sales_order | TEXT | Sí | NULL |
| crmdatabase-api.ordenventa | nota_adendum_ov | TEXT | Sí | NULL |

SQL previsto, solo cuando la columna no existe:

```sql
ALTER TABLE `crm_sales_order`
  ADD COLUMN `addendum_note_sales_order` TEXT NULL DEFAULT NULL, ALGORITHM=INSTANT;
ALTER TABLE `ordenventa`
  ADD COLUMN `nota_adendum_ov` TEXT NULL DEFAULT NULL, ALGORITHM=INSTANT;
```

Cada ALTER se ejecuta exclusivamente en su BD verificada. Sin tablas, índices, valores calculados ni backfill nuevos. Las notas históricas quedan NULL; no se crea un adéndum a partir de ellas. Antes de DDL se comprueba el contrato completo de las tres columnas base de 065, la tabla InnoDB y cualquier nota existente. Si falta 065 o hay diferencias, falla sin agregar nada.

## Permisos y alcance de Owner registrados originalmente por 066

| Código | Etiqueta | Asignación por defecto |
| --- | --- | --- |
| formalizacion.orders.addendum.mark_pending | Marcar adéndum pendiente | Solo jefe_formalizaciones |
| formalizacion.orders.addendum.read | Ver adéndum en la orden | owner, formalizacion, jefe_formalizaciones, jefe_general |
| formalizacion.home.addendum.read | Ver banner de adéndum | owner, formalizacion, jefe_formalizaciones, jefe_general |

La acción `mark_pending` es la única excepción al comodín de permisos activos de Owner: heredar virtualmente el nombre del rol Jefe de Formalizaciones tampoco la concede. Exige un grant activo de un rol realmente asignado al usuario (`sec_user_role` + `sec_role_permission`) o una excepción personal vigente. La denegación individual prevalece. El editor de permisos de Owner aplica el mismo filtro y muestra la capacidad únicamente si su rol tiene un grant real.

El resto de permisos y la política global de Owner no cambian. Quien tenga `role.assign` efectivo puede administrar esta excepción personal aunque no pueda marcar el adéndum; esto no le concede la acción ni habilita delegar otros permisos fuera de su autoridad. Los permisos de lectura son independientes de marcar/completar/cancelar. El permiso `formalizacion.orders.addendum.update` de 065 se conserva.

La 066 solo inserta definiciones y grants faltantes; no reactiva grants inactivos ni modifica excepciones personales. Incrementa una vez la versión de permisos de los usuarios con roles afectados y registra el conjunto antes/después en `audit_security_event`, atribuido a un Owner activo.

## Ejecución después de aprobar

Primero desarrollo/QA, luego el destino expresamente autorizado:

```powershell
$env:MIGRATION_CONFIRM_SCHEMA_ONLY = 'CRM_THINK_V2'
pnpm exec tsx scripts/run-schema-migrations.ts --only=202611030066_formalization_manual_addendum
pnpm exec tsx scripts/migrate-legacy-addendum-note.ts --plan
pnpm exec tsx scripts/migrate-legacy-addendum-note.ts --apply=crmdatabase-api
```

El runner nativo nunca modifica legacy. El CLI rechaza argumentos distintos de esas dos opciones exactas, fija una conexión y conserva un lock exclusivo mientras valida/aplica. Ambos usan un límite de espera de metadata locks de 10 segundos; la 066 restaura el valor previo en la conexión fijada al terminar.

DDL se confirma implícitamente en MySQL. Nota, permisos y auditoría no forman una transacción común. El preflight de las tres definiciones de permiso, roles y actor precede al DDL y se repite dentro del DML auditado. Si falla auditoría, los grants/definiciones/versiones se revierten; la nota puede quedar creada sin ledger de éxito. Un reintento acepta esa nota compatible y continúa sin perder datos ni modificar 065.

## Procedimiento de rollback sujeto a aprobación y respaldo previo

1. Desactivar las escrituras manuales y retirar primero el código que requiere la nota/los nuevos permisos.
2. Exportar de forma segura los IDs y notas desde ambas tablas. Respaldar definiciones y grants de los tres códigos, sus excepciones y el evento de auditoría de 066. No enviar notas a logs.

```sql
SELECT public_id_sales_order, addendum_note_sales_order
FROM CRM_THINK_V2.crm_sales_order WHERE addendum_note_sales_order IS NOT NULL;
SELECT id_ov, nota_adendum_ov
FROM `crmdatabase-api`.ordenventa WHERE nota_adendum_ov IS NOT NULL;
```

3. Retirar únicamente las notas creadas por esta aplicación; si alguna preexistía, conservarla según el inventario anterior:

```sql
ALTER TABLE CRM_THINK_V2.crm_sales_order DROP COLUMN addendum_note_sales_order;
ALTER TABLE `crmdatabase-api`.ordenventa DROP COLUMN nota_adendum_ov;
```

4. Si los tres permisos eran nuevos y nadie cambió sus asignaciones después de 066, desactivarlos conservando evidencia y excepciones. Solo en BD nueva:

```sql
START TRANSACTION;
UPDATE sec_user u SET permission_version_user = permission_version_user + 1
WHERE EXISTS (
  SELECT 1 FROM sec_user_role ur
  JOIN sec_role_permission rp ON rp.role_id_role_permission = ur.role_id_user_role
  JOIN sec_permission p ON p.id_permission = rp.permission_id_role_permission
  WHERE ur.user_id_user_role = u.id_user
    AND ur.status_user_role = 'active' AND ur.revoked_at_user_role IS NULL
    AND p.code_permission IN ('formalizacion.orders.addendum.mark_pending',
      'formalizacion.orders.addendum.read','formalizacion.home.addendum.read')
    AND rp.status_role_permission = 'active'
);
UPDATE sec_role_permission rp
JOIN sec_permission p ON p.id_permission = rp.permission_id_role_permission
SET rp.status_role_permission = 'inactive'
WHERE p.code_permission IN ('formalizacion.orders.addendum.mark_pending',
  'formalizacion.orders.addendum.read','formalizacion.home.addendum.read');
UPDATE sec_permission SET status_permission = 'inactive'
WHERE code_permission IN ('formalizacion.orders.addendum.mark_pending',
  'formalizacion.orders.addendum.read','formalizacion.home.addendum.read');
COMMIT;
```

Registrar la reversión mediante el flujo administrativo auditado con actor real. Si alguna definición/grant preexistía o cambió después, restaurar solo el delta según su respaldo, sin ejecutar la desactivación global. No retirar estados/versiones/fechas de 065, no borrar auditoría ni excepciones individuales. El ledger conserva la aplicación histórica; una reaplicación después de desactivar permisos necesita reconciliación explícita.

## Flujo funcional entregado

- La marca manual no crea un evento. El botón pide una nota opcional (hasta 2000 caracteres); en blanco se guarda NULL. Requiere lectura de la orden y del adéndum, además de `mark_pending` efectivo. Si ya está pendiente, no genera otra marca ni otra bitácora.
- La acción está debajo de «Ver orden completa» en el panel del listado y junto a «Agendar evento» en la ficha completa. La tarjeta de estado está directamente debajo de «Acciones de la etapa» en ambas vistas.
- La nota se conserva al completar o cancelar. Una nueva marca manual toma su propia nota; un nuevo origen por evento reinicia la nota a NULL. Todo cambio usa versión, operación idempotente y bitácora en la BD nueva, también para órdenes legacy.
- El banner «Pendientes de adéndum» está junto a «Pendientes de aprobación», con ayuda accesible y su permiso Home independiente. El contador incluye órdenes activas, sin venta caída y con marca pendiente, independientemente de su aprobación o etapa. No altera los conteos de las otras etapas.
- El permiso de lectura de Adéndum habilita su bandeja y etiqueta. Sin él se ocultan la marca, nota, bandeja y evidencia específica del adéndum; la orden sigue visible con sus permisos habituales. El banner puede mostrar su conteo con el permiso Home sin conceder acceso a la bandeja.
- Marcar, completar o cancelar refresca la tarjeta, el listado y el contador después de confirmar la escritura. Un fallo posterior de recarga no permite repetir como incierta una escritura ya confirmada.
- El acceso de calendario en la barra superior de Formalización usa los permisos existentes de lectura y creación. Abre el formulario sin cliente, orden ni referencia precargados; guardar o cerrar conserva la pantalla y la URL. La regla de orden obligatoria y bloqueo de Adéndum futuro sigue aplicando cuando se elige ese tipo.

## Evidencia de aplicación autorizada

El plan legacy, su aplicación y la ejecución aislada de 066 terminaron con código
0. Se verificaron las columnas `addendum_note_sales_order` y `nota_adendum_ov`
como TEXT NULL DEFAULT NULL. Nativa pasó de 38 a 39 columnas y legacy de 44 a 45.
Se conservaron 0 órdenes nativas y 467 legacy; los conteos de marcas y sus versiones
no cambiaron y ambas columnas de nota quedaron vacías. Se verificaron nueve grants
activos: cuatro para el banner, cuatro para lectura y solo Jefe de Formalizaciones
para marcado manual. El ledger y la auditoría contienen una entrada de 066.
No se marcaron órdenes reales ni se crearon eventos de clientes para verificarlo.

Comprobación visual posterior con sesión renovada: Inicio mostró el banner y su
bandeja con contador 0; el icono superior abrió «Nuevo evento de Formalización»
con Relaciones 0, nombre y referencia vacíos. Al cerrar conservó la pantalla.
En LV208, tanto el panel del listado como la ficha completa mostraron la tarjeta
«Adéndum» directamente bajo «Acciones de la etapa», con «Sin adéndum» y sin el
error de consulta. Owner no mostró el botón de marcado manual, conforme a la
excepción definida. No se guardaron eventos ni marcas reales durante la revisión.

## Corrección 067: defaults vigentes del marcado manual

Una instrucción posterior amplía expresamente el default de `formalizacion.orders.addendum.mark_pending` a **Owner, Jefe General y Jefe de Formalizaciones**. La tabla anterior conserva la historia de 066; después de 067 el default son estos tres roles, no el rol operativo `formalizacion`. La 067 se aplicó el 2026-11-03 tras la confirmación expresa y el reintento solicitado por el usuario. El runner terminó con código 0 y se verificaron los tres grants activos, una entrada de ledger y una de auditoría en CRM_THINK_V2 / MySQL 8.4.8, con TLS activo. Las pruebas focales de migración e identidad aprobaron 50/50 casos; lint y TypeScript también aprobaron.

`202611030067_formalization_manual_addendum_defaults` es exclusivamente DML en CRM_THINK_V2: exige que el permiso de 066 exista activo y con su definición exacta, verifica los tres roles activos y las tablas de seguridad InnoDB, agrega únicamente grants faltantes, incrementa versiones de los usuarios de los roles que cambiaron y registra un evento de auditoría transaccional. No cambia el esquema, las notas, otras capacidades, overrides personales ni la política de herencia. Un grant inactivo existente se conserva y requiere reconciliación expresa; no se reactiva silenciosamente.

Owner sigue fuera del comodín para esta capacidad concreta: la 067 ahora le agrega un **grant real** a su rol, por lo que su perfil y el editor la reconocen mediante la misma regla de asignación explícita. Jefe General también la recibe mediante su propio grant real. Un `deny` personal continúa prevaleciendo sobre ambos. La 066 ya aplicada no se modifica ni se vuelve a ejecutar.

Aplicación dirigida, después de validar el inventario y las pruebas:

```powershell
pnpm exec tsx scripts/run-schema-migrations.ts --only=202611030067_formalization_manual_addendum_defaults
```

Rollback específico de 067: respaldar sus grants antes/después y el evento auditado; solo si Owner y Jefe General eran los grants ausentes que agregó 067, se pueden desactivar esos dos grants con aprobación. No desactivar el permiso, el grant anterior de Jefe de Formalizaciones ni tocar otras capacidades:

```sql
START TRANSACTION;
UPDATE sec_user u SET permission_version_user = permission_version_user + 1
WHERE EXISTS (
  SELECT 1 FROM sec_user_role ur
  JOIN sec_role r ON r.id_role = ur.role_id_user_role
  WHERE ur.user_id_user_role = u.id_user
    AND ur.status_user_role = 'active' AND ur.revoked_at_user_role IS NULL
    AND r.code_role IN ('owner','jefe_general')
);
UPDATE sec_role_permission rp
JOIN sec_permission p ON p.id_permission = rp.permission_id_role_permission
JOIN sec_role r ON r.id_role = rp.role_id_role_permission
SET rp.status_role_permission = 'inactive'
WHERE p.code_permission = 'formalizacion.orders.addendum.mark_pending'
  AND r.code_role IN ('owner','jefe_general');
COMMIT;
```

Si alguno ya tenía un grant antes de 067 o hubo cambios administrativos posteriores, ajustar el rollback exclusivamente al delta respaldado; nunca usar los dos roles por suposición. Registrar la reversión mediante el flujo de seguridad auditado y conservar ledger, auditorías y overrides.
