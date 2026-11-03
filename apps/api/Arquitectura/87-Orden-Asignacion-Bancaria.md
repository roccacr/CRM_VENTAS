# 87 — Banco y ejecutivo asignados a una orden

Estado: implementado localmente, 2026-11-03. Migración069 aplicada al RDS con aprobación explícita del usuario; sin despliegue.

## Alcance y decisiones

### Cambiar o desvincular — implementado, 2026-11-03

071 aplicada en CRM_THINK_V2 con aprobación explícita del usuario. Ledger confirmado: `2026-11-03T18:17:50.566Z`. Ambas FK admiten NULL; CHECK de pareja y de origen están ENFORCED. Comparación completa del esquema final coincide con la variante MySQL permitida.0 vínculos al verificar, sin cambios comerciales ni de catálogo. El primer intento se detuvo antes de ALTER por COLLATE heredado explícito en MySQL8.4; normalizador local071 acepta únicamente esa representación equivalente y los dos órdenes exactos de CHECK MySQL/MariaDB.069 y normalizador global intactos.

Pruebas finales:55 API/esquema/SQL reales (incluye18 SQL aisladas) y23 frontend; lint focal aprobado, typecheck/build de ambas apps aprobados. Verificación independiente de UI/servicio/sección16/16 y revisión final sin bloqueantes. SQL cubre dos fuentes, reasignación, desvincular conservando fila/fecha/versión, concurrencia, rollback de bitácora, banco inactivo, rechazo de media relación y ABA1→2→3 con formulario viejo rechazado. No se probó una desvinculación real en RDS: no había vínculo en la orden y no se crean asignaciones ficticias para QA.

El comando global `check-all.cmd` se detuvo en formato de8 archivos API de NetSuite/Microsoft ajenos a este alcance. No se declara aprobado el chequeo global. Evidencia en `C:/codex-data/tmp/crm-banks-20261103/`: `bank-unlink-all-final.log`, `bank-unlink-ui-final.log`, `bank-unlink-api-types-final.log`, `bank-unlink-api-build-final.log`, `bank-unlink-071-retry.log` y `bank-unlink-check-all.log`.

La sección muestra «Cambiar banco» y «Desvincular banco» al existir asignación y permisos de edición. Cambiar reutiliza el formulario completo; desvincular solicita motivo y confirmación lateral, conserva borrador ante conflicto/resultado incierto y exige recarga antes de repetir. Cancelar no emite el comando. Los nombres «Owner» o «Jefe General» no sustituyen grants/deny, módulo, sesión ni lectura de orden.

- Se reutiliza `FormAssignBank` como «Cambiar banco» en la sección cuando existe vínculo; permite reemplazar banco o ejecutivo y actualizar la sección al confirmar.
- Endpoint `POST /formalization/orders/:source/:id/bank-assignment/unlink`, body `{expectedVersion,reason}` con motivo3..255 y versión1..4294967294. Misma autorización de lectura/edición Bancos y acceso a orden, Owner/Jefe General, deny vigente.
- Desvincular conserva la fila y aumenta versión, deja banco/ejecutivo ambos NULL, usuario/fecha y bitácora transaccional. Evita reiniciar la versión y aceptar un formulario antiguo después de quitar/reasignar. No elimina banco ni ejecutivo del catálogo, ni cambia etapas/órdenes comerciales.
- Migración071 nativa: dos FK existentes pasan a columnas nullable y CHECK exige ambas presentes o ambas NULL. Sin backfill ni cambios legacy/roles/índices; rollback documentado y aplicación RDS autorizada.
- UI: «Cambiar banco» y «Desvincular banco» solo con permisos efectivos de edición; confirmación lateral con motivo, versión del snapshot y revalidación de sesión. Crear ejecutivo conserva permiso propio; cancelar no modifica vínculo; conflicto/error conserva datos y requiere recarga.
- Pruebas cubren reasignación, desvinculación, auditoría y rollback en QA aislada, casos de concurrencia/ABA, payload inválido, permisos y confirmación/cancelación UI. No se usó la orden real para probar escrituras.

### Sección de consulta en la orden — 2026-11-03

La ficha completa incorpora «Banco y ejecutivo» en «Ir a» y el capítulo desplegable «Banco y ejecutivo asignado», después de Autorización de venta. Reutiliza estilos, navegación, observador y expandir/contraer existentes; muestra banco, ejecutivo, correo, teléfono y área desde GET de asignación. Un área vacía presenta «Sin dato»; sin vínculo presenta un estado vacío, nunca datos de ejemplo.

El capítulo y su consulta se omiten sin `formalizacion.catalog_bank.read` efectivo o ante deny. El perfil API ya filtra esos permisos por rol Owner/Jefe General; el endpoint conserva su revalidación de rol/módulo/orden. Error de lectura permite reintentar. Orden, versión visual y reintento forman la clave de la lectura; abort/cleanup evitan mostrar una respuesta tardía de otra orden.

`FormAssignBank.onAssigned` se notifica únicamente tras confirmar el POST de asignación. La sección se recarga inmediatamente sin navegar. Crear un ejecutivo sin guardar la asignación no actualiza el vínculo ni dispara ese callback. No hay cambios de API, esquema ni migraciones para esta sección.

Archivos: frontend `FormalizationBankAssignmentDetails.tsx`, composición/Ir a en `FormalizationRecordSummary.tsx`, callback en `FormAssignBank.tsx`; pruebas `formalization-bank-section.spec.tsx` y `FormAssignBank.spec.tsx`. Verificación:15 pruebas focales aprobadas, lint focal limpio, typecheck/build frontend aprobados y revisión independiente13/13. `check-all.cmd` bloqueado por formato en7 archivos API ajenos a este alcance. Visual real en LV208 legacy78: acceso desde Ir a, capítulo desplegable y estado sin asignación; no se modificó la orden para probarlo.

En el detalle real de una orden, junto a Marcar adéndum pendiente/Agendar evento, mostrar Asignar banco. Abrir panel derecho conservando URL y orden. Elegir banco activo y ejecutivo activo perteneciente a ese banco; ambos obligatorios. Mostrar la asignación guardada al reabrir. No cambiar etapas, origen de fondos, NetSuite ni datos comerciales.

Reutilizar catálogo Bancos y permisos formalizacion.catalog_bank.read/update para asignar; crear ejecutivo requiere create. Conserva restricción de roles Owner/Jefe General y lectura autorizada de la orden. No ampliar roles ni grants en esta tarea.

El vínculo de gestión CRM se almacena centralmente en CRM_THINK_V2.crm_sales_order_bank_assignment para órdenes nativas y legacy, con identidad canónica source/id; no importa órdenes ni altera ordenventa. Una asignación por orden, versión optimista y actor/fecha; claves a banco/ejecutivo nativos. La identidad se resuelve nativa primero y legacy solo si no existe autoridad nativa. Bitácora central de la orden, transaccional con la asignación.

Contrato: GET/POST /formalization/orders/:source/:id/bank-assignment. GET devuelve {source,id,version,bank,advisor,changedAt}; sin vínculo version=0,bank/advisor/changedAt=null. Bank/Advisor usan los contratos existentes de catálogo. POST body {bankPublicId,advisorPublicId,expectedVersion,reason}, reason3..255; devuelve el mismo snapshot. Conflicto409 conserva borrador y exige recarga; no reintentos automáticos de escritura. Crear ejecutivo usa endpoint existente, lo selecciona y requiere Guardar asignación explícito.

## Plan y archivos

1. Revisar BanksRepository/Service/DTO, FollowUpService/Repository, RecordAuditService, FormalizationRecordSummary y BankFormDrawer.
2. Agregar controlador/servicio/repositorio de asignación y migración069 nativa. Reutilizar identidad, permisos, auditoría y listado/creación del catálogo. Sin dependencias nuevas.
3. Agregar FormalizationAssignBank, servicio frontend y botón en resumen real. Drawer con búsqueda/paginación, carga estructurada, errores y cancelación. Restablecer ejecutivo al cambiar banco. Reusar BankFormDrawer para alta.
4. Pruebas focales API/DTO/rol/identidad/estado/pertenencia/versiones/rollback, UI dependencias/alta/errores/URL. Ejecutar lint,typecheck,tests,build y revisar diff completo de este alcance.
5. Preparar DDL/rollback y probar localmente antes de solicitar aprobación de aplicación en RDS, conforme a la restricción del usuario. No modificar esquema legacy ni aplicar migraciones compartidas sin autorización específica.

## Verificación

Comandos desde cada app: pnpm exec vitest run test/banks; pnpm lint; pnpm typecheck; pnpm build. Raíz: .\check-all.cmd. Separar fallos preexistentes/concurrentes. No crear bancos/ejecutivos ficticios en RDS para QA.

## Resultado

- Implementados API (`order-bank-assignment.ts`, repositorio y adaptador legacy), panel `FormAssignBank`, servicio frontend, integración en el resumen real y migración069. Reutiliza catálogo068, `BankFormDrawer`, autorización efectiva y bitácora existente.
- API/DTO/permisos:15 pruebas aprobadas. Migración:6 unitarias y1 SQL real aprobadas; runner/regresiones30 aprobadas en su corrida focal. Repositorio:11 pruebas con SQL y `RecordAuditService` reales en instancia exclusiva127.0.0.1:3311, ambas fuentes, lectura posterior, actor/diff, estados activos, pertenencia, CAS/concurrencia y rollback tras escritura real de bitácora.
- La fixture SQL tiene proyecciones mínimas de autoridad y adapta únicamente `SELECT DATABASE() AS name` para el plegado de nombres Windows/MariaDB. No conecta a RDS, no carga `.env` y limpia solo sus propios IDs. No equivale a una edición comercial en producción.
- Frontend:10 pruebas nuevas aprobadas: selección dependiente, alta de ejecutivo y selección sin asignación automática, guardado explícito, paginación, permisos, deny de lectura y cambio de sesión. Lint focal limpio; typecheck/build frontend aprobados. Typecheck API aprobado en la corrida de cierre; un build posterior quedó bloqueado por cambios concurrentes ajenos en `order-documents.ticket.ts` (tipo ArrayBuffer/CipherKey). Un build API previo había aprobado: no se declara verde global.
- Corrida final ampliada API/SQL069:33/33. Frontend Bancos completo:41/41. Regresión conjunta del resumen de orden:50 aprobadas/1 fallida por reemplazo concurrente del placeholder `AQUI VA EL ONEDRIVE`, ajeno a asignación bancaria. No se modificó esa expectativa ni se declaró aprobado el conjunto global.
- Revisión independiente final sin hallazgos bloqueantes. `check-all.cmd` se detuvo por formato: el archivo propio `order-bank-assignment.ts` se corrigió; quedan archivos ajenos de SuiteScript/NetSuite. Conservar fallos globales separados del alcance.
- Aplicación069: primer intento falló por espera de lock; SELECT confirmó ausencia de tabla y ledger. Segundo intento dirigido autorizado terminó exit0. Ledger confirmado: `2026-11-03T17:11:30.431Z`; tabla InnoDB, tres FK a banco/ejecutivo/usuario y0 asignaciones. No cambió el esquema legacy ni creó contactos u órdenes ficticias.
- Revisión visual con sesión Owner en LV208 legacy78: botón junto a adéndum/evento, Drawer derecho, lectura real del snapshot versión0 y URL conservada. Catálogo vacío: aún se debe crear un banco real para elegirlo. No se guardó ninguna asignación ni contacto de prueba en RDS; la persistencia fue probada en QA aislada.

Evidencia local en `C:/codex-data/tmp/crm-banks-20261103/`: `order-bank-sql.log`, `order-bank-all-final.log`, `order-bank-ui-only-final.log`, `order-bank-ui-final.log`, `order-bank-api-typecheck.log`, `order-bank-focused.log`, `order-bank-root-lint.log`, `order-bank-069-apply.log`, `order-bank-069-retry.log` y `order-bank-check-all.log`.

## Esquema069 aplicado y recuperación

Migración: 202611030069_sales_order_bank_assignment. Destino exclusivo CRM_THINK_V2; no altera tablas legacy ni permisos. Preflight exige padres InnoDB; reintento acepta únicamente SHOW CREATE equivalente completo, incluidos comentarios, índices, FK y CHECK. La pertenencia ejecutivo/banco y estados activos se revalidan con bloqueo transaccional en API; las FK simples evitan alterar el catálogo068.

DDL revisable:

```sql
CREATE TABLE crm_sales_order_bank_assignment (
 source_bank_assignment VARCHAR(6) NOT NULL COMMENT 'Origen canonico nativo o legacy de la orden.',
 order_id_bank_assignment VARCHAR(26) NOT NULL COMMENT 'Identificador canonico de la orden en su origen.',
 bank_id_bank_assignment BIGINT UNSIGNED NOT NULL COMMENT 'Banco nativo asignado a la gestion de la orden.',
 advisor_id_bank_assignment BIGINT UNSIGNED NOT NULL COMMENT 'Ejecutivo nativo cuya pertenencia al banco valida la API.',
 version_bank_assignment INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Version de concurrencia optimista de la asignacion.',
 changed_by_user_id_bank_assignment BIGINT UNSIGNED NOT NULL COMMENT 'Usuario nativo responsable de la ultima asignacion.',
 changed_at_bank_assignment DATETIME(3) NOT NULL COMMENT 'Fecha UTC de la ultima asignacion bancaria.',
 PRIMARY KEY (source_bank_assignment,order_id_bank_assignment),
 KEY ix_crm_order_bank_assignment_bank (bank_id_bank_assignment),
 KEY ix_crm_order_bank_assignment_advisor (advisor_id_bank_assignment),
 KEY ix_crm_order_bank_assignment_actor (changed_by_user_id_bank_assignment),
 CONSTRAINT fk_crm_order_bank_assignment_actor FOREIGN KEY (changed_by_user_id_bank_assignment) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_crm_order_bank_assignment_advisor FOREIGN KEY (advisor_id_bank_assignment) REFERENCES crm_bank_advisor (id_bank_advisor) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_crm_order_bank_assignment_bank FOREIGN KEY (bank_id_bank_assignment) REFERENCES crm_bank (id_bank) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT ck_crm_order_bank_assignment_source CHECK (source_bank_assignment IN ('native','legacy'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Asignacion bancaria central por identidad canonica de orden.';
```

Aplicación dirigida desde apps/api, solamente después de aprobación específica y de verificar DB_NAME=CRM_THINK_V2 y MIGRATION_CONFIRM_SCHEMA_ONLY=CRM_THINK_V2: pnpm exec tsx scripts/run-schema-migrations.ts --only=202611030069_sales_order_bank_assignment. Las demás variables DB_* deben corresponder al destino aprobado. El script migrate:identity:schema existe en package.json y delega al mismo runner. DDL MySQL confirma implícitamente; el runner usa lock nombrado y registra ledger solo al concluir.

Rollback preparado (requiere aprobación, detener escrituras y exportar asignaciones primero; elimina datos de asignación, conserva catálogo/órdenes/bitácora):

```sql
DROP TABLE CRM_THINK_V2.crm_sales_order_bank_assignment;
```

Conservar conf_schema_migration y la auditoría como evidencia histórica. El rollback no borra el ledger; una ejecución posterior del runner omitirá069 registrada. Recrear la tabla o reaplicar después del rollback requiere un procedimiento de recuperación específico revisado y aprobado, sin borrar historia de forma automática.

QA SQL aislada: RUN_BANK_ASSIGNMENT_MYSQL_QA=3311, test/migrations/sales-order-bank-assignment.mysql.spec.ts. Host/puerto/credenciales QA fijos, sin .env; transacción revierte fixtures. No usar3309 ni RDS para esta prueba.


Evidencia069 local: RED inicial por migración ausente; unit + runner30 aprobadas. QA SQL real aislada3311:1 aprobada, aplicación/reintento, PK por fuente, CHECK, tres FK con órdenes distintas, restricción de borrado y rollback sin fixtures persistidos. SHOW CREATE ordena FK alfabéticamente; DDL fuente usa ese orden para validar equivalencia estricta. ESLint focal de migración/tests/runner aprobado. Esto no acredita aplicación RDS ni aceptación HTTP/UI.



## Desvinculación: contrato API y esquema071

`POST /formalization/orders/:source/:id/bank-assignment/unlink` recibe `{expectedVersion,reason}`; versión entera1..4294967294 y motivo recortado3..255. Conserva los permisos de lectura/edición Bancos, Owner/Jefe General, lectura de orden y denies. Responde el snapshot con banco/ejecutivo nulos, versión incrementada y fecha del cambio. Un vínculo inexistente o versión obsoleta devuelve409. La fila persiste: otra asignación usa UPDATE con su versión actual, nunca reinicia a0. La actualización y bitácora central comparten transacción; un error de auditoría revierte ambas.

071 (`202611030071_sales_order_bank_assignment_unlink`) solo permite CRM_THINK_V2 y acepta exclusivamente el SHOW CREATE completo original069 o final071. El segundo caso recupera el fallo entre DDL y ledger. Rechaza formas parciales, cambios de comentarios/FK/índices y demás drift.069 se conserva intacta. DDL único atómico, sin DML:

```sql
ALTER TABLE CRM_THINK_V2.crm_sales_order_bank_assignment
 MODIFY COLUMN bank_id_bank_assignment BIGINT UNSIGNED NULL COMMENT 'Banco nativo asignado a la gestion de la orden.',
 MODIFY COLUMN advisor_id_bank_assignment BIGINT UNSIGNED NULL COMMENT 'Ejecutivo nativo cuya pertenencia al banco valida la API.',
 ADD CONSTRAINT ck_crm_order_bank_assignment_pair CHECK ((bank_id_bank_assignment IS NULL AND advisor_id_bank_assignment IS NULL) OR (bank_id_bank_assignment IS NOT NULL AND advisor_id_bank_assignment IS NOT NULL));
```

Aplicación compartida071 autorizada expresamente y completada; ver evidencia de cierre arriba. El runner dirigido utilizado fue `pnpm exec tsx scripts/run-schema-migrations.ts --only=202611030071_sales_order_bank_assignment_unlink`, con las mismas confirmaciones de destino de069. No se ejecutó la cadena completa ni se aplicó070 por esta autorización.

Rollback exige detener escrituras, respaldo y aprobación. Primero verificar que no existen filas con ambos vínculos nulos; si existen, no se puede volver a NOT NULL sin una decisión de negocio que conserve su historial/versiones. No borrar ni asignar bancos ficticios. Una vez resuelto y verificado:

```sql
ALTER TABLE CRM_THINK_V2.crm_sales_order_bank_assignment
 DROP CHECK ck_crm_order_bank_assignment_pair,
 MODIFY COLUMN bank_id_bank_assignment BIGINT UNSIGNED NOT NULL COMMENT 'Banco nativo asignado a la gestion de la orden.',
 MODIFY COLUMN advisor_id_bank_assignment BIGINT UNSIGNED NOT NULL COMMENT 'Ejecutivo nativo cuya pertenencia al banco valida la API.';
```

Conservar ledger y bitácora; no hay rollback automático ni modificación de legacy/catálogos.
