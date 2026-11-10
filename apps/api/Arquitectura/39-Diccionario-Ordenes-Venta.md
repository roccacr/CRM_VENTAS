# Diccionario fisico de ordenes de venta

## Reglas vigentes de fondos y finalización — 2026-11-03

Las reglas actuales de [78](78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md)
prevalecen sobre los predicados históricos de este documento:

- Contratos exige la aprobación explícita de Formalización, actividad y ausencia
  de caída/borrado; no exige nuevamente las otras dos aprobaciones. Aprobar una
  orden mantiene sus prerrequisitos propios de Jefatura y Desarrolladora.
- Las ocho etapas incluyen `bank_management_in_progress`. Al salir de Contratos,
  con firma confirmada, `own_funds` conduce a `pending_balance` y `bank_financing`
  a `bank_management_in_progress`; sin origen no hay avance. Origen y etapa se
  guardan con la misma transacción y auditoría; el replay compara su elección histórica.
- Traspasos pendientes exige cuotas sí, unidad traspasada no y unidad entregada no.
  Traspaso firmado exige cuotas sí, llaves no y entregada no. El avance automático requiere además Unidad traspasada. El registro manual desde Traspaso pendiente admite confirmación pendiente en NetSuite y muestra una advertencia.
  Unidad entregada sí habilita cierre aunque los otros tres sean desconocidos.
  NULL nunca sustituye un no confirmado. Se conservan firma, permisos y versión.
- El cierre anual exige evidencia `closed` en el año de Costa Rica y unidad
  entregada sí. Una combinación fuera de tabla mantiene la etapa guardada y
  visibilidad autorizada en **Todas**; no se inventa un cambio durante GET.
- `counts.bankingInProgress` distingue banca en proceso del agregado Home
  `banking`; el seguimiento devuelve `counts.bankInProgress` y `bank` reúne
  los dos estados bancarios. Los cuatro indicadores son booleanos/NULL.
- Los eventos NetSuite `edit`/`xedit` pueden avanzar desde saldo/traspaso/firmado
  a un destino posterior confirmado, conservando responsable y actor integración.
  Flags, visita, auditorías y cursor comparten transacción. No revierten etapas
  ni permiten regresar a saldo una vez iniciado el traspaso.

Adéndum es una capacidad independiente: [83](83-Adendum-Migracion-065-y-Rollback.md)
y [84](84-Adendum-Manual-Migracion-066-y-Permisos.md). El permiso de banner solo da
conteo; `formalizacion.orders.addendum.read` controla bandeja, marca y evidencia.
La marca no cambia etapa/aprobaciones. Esta revisión no repite pruebas históricas,
no escribe en BD ni acredita edición real de NetSuite o despliegue.

Revisión documental del 2026-11-02: 057, su registro/CLI y los tipos de tabla
son cambios locales aún sin commit respecto a `fcbf0c2`. La aplicación del30
descrita debajo es evidencia histórica, no una nueva comprobación live ni prueba
de que una release incluya estos archivos. El mapeo de lectura y el escritor de
sincronización de ese corte quedaron ampliados por [73](73-Sincronizacion-Estados-Ordenes-NetSuite.md),
[75](75-Matriz-Campos-Ordenes-NetSuite.md) y las reglas78; el plan70 es antecedente.

Fuente: migración021, ajuste UTC022, relación con lead035, trayectoria036 y
ampliación aditiva057. Los nombres completos están en el runner y sus archivos.
Detalles y limites: [Documento 38](38-Ordenes-Venta-Estados-Auditoria.md).

## Casillas operativas adicionales - 2026-10-30

057 agrega exclusivamente siete columnas a cada tabla existente. No elimina,
renombra ni modifica columnas previas; no importa ni actualiza filas, permisos,
triggers o estados del proceso. El receptor local de NetSuite sigue sin persistir.

| Casilla | CRM_THINK_V2.crm_sales_order | crmdatabase-api.ordenventa |
| --- | --- | --- |
| Unidad entregada | unit_delivered_sales_order | unidad_entregada_ov |
| Unidad traspasada | unit_transferred_sales_order | unidad_traspasada_ov |
| Entrega de llaves | keys_delivered_sales_order | entrega_llaves_ov |
| Validacion fideicomiso/prima | trust_down_payment_validated_sales_order | validacion_fideicomiso_prima_ov |
| Comision aprobada | commission_approved_sales_order | comision_aprobada_ov |
| Calculo comision corredor | broker_commission_calculated_sales_order | calculo_comision_corredor_ov |
| Cuotas pagadas por completo | installments_fully_paid_sales_order | cuotas_pagadas_completo_ov |

Nueva: `ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown'`. Antigua:
`TINYINT UNSIGNED NULL DEFAULT NULL`; 1/0 representaran si/no, y NULL indica
desconocido. No inferir cuotas pagadas a partir de `pagadas_ov` ni de comisiones.
Las columnas existentes de firma, caida, comision pagada y las tres aprobaciones
conservan su significado y almacenamiento. Las casillas no equivalen a etapas CRM.

Aplicacion nativa: `pnpm exec tsx scripts/run-schema-migrations.ts --only=202610300057_sales_order_operational_flags`.
Aplicacion antigua: `pnpm exec tsx scripts/migrate-legacy-sales-order-flags.ts --apply=crmdatabase-api`;
`--plan` solo inspecciona. Ambos comandos reutilizan la validacion TLS y requieren
`MIGRATION_CONFIRM_SCHEMA_ONLY=CRM_THINK_V2`. El runner antiguo confirma ademas su
destino fijo y usa un candado. El runner nativo registra 057 en su ledger.

DDL con `ALGORITHM=INSTANT`, sin reconstruccion silenciosa: falla si el servidor
no lo soporta. MySQL confirma DDL automaticamente; una repeticion verifica tipos,
nulabilidad/defaults y agrega solo columnas pendientes. Ante rollback de aplicacion,
conservar las columnas; no se proporciona un DROP destructivo.

Verificacion real del 30/10/2026: MySQL8.4.8, tablas InnoDB. Nueva: 26 a 33 columnas,
0 ordenes antes/despues. Antigua: 33 a 40 columnas, 465 ordenes antes/despues.
Coincidieron los hashes de todos los valores de columnas originales, las
definiciones previas y los siguientes AUTO_INCREMENT. Las siete columnas antiguas
quedaron NULL en las 465 filas. El preflight posterior devuelve cero ALTER pendientes
en ambas BD. No se ejecutaron fixtures ni modificaciones comerciales.

Lectura documental 2026-10-23: los valores `legacy_import`, `import_snapshot`
y el payload de origen describen capacidad fisica, no un importador activo ni
autorizacion para copiar ordenes antiguas. El estado actual se consulta por
fuente; resumenes no escriben. Snapshot metadata: [49](49-Estado-Actual-y-Cierre-Documental.md).
El ledger acredita una ejecucion fechada, no ausencia de drift ni poblacion
actual; este diccionario no vuelve a verificar MySQL. Send/revert/set-stage y
seguimiento/timing estan registrados desde la ampliacion de52; el listado
contractual independiente permanece fuera del runtime HTTP. Las migraciones
035/036 complementan este baseline con lead y responsabilidad/tiempos; consultar
[52](52-Etapas-Responsables-y-Tiempos.md) para columnas y autoridad actuales.

La bitacora comercial generica posterior, migracion `202610220023_record_audit`, no altera estas nueve tablas. El diccionario de sus dos tablas `audit_record` y `audit_record_event` esta en [38 - Bitacora central](38-Ordenes-Venta-Estados-Auditoria.md#bitacora-central-de-registros---2026-10-22); admite identidad legacy sin FK comercial. No reemplaza ni borra los historiales especializados descritos aqui.

## conf_sales_order_state

| Columna | Tipo y restricciones | Significado |
|---|---|---|
| code_sales_order_state | VARCHAR(48) NOT NULL | Codigo legible de la etapa; no depende de un proveedor |
| name_sales_order_state | VARCHAR(120) NOT NULL | Nombre en espanol de la etapa |
| display_order_sales_order_state | SMALLINT UNSIGNED NOT NULL | Orden de presentacion; no impone transiciones |

## conf_sales_order_approval_type

| Columna | Tipo y restricciones | Significado |
|---|---|---|
| code_sales_order_approval_type | VARCHAR(32) NOT NULL | Tipo de aprobacion independiente |
| name_sales_order_approval_type | VARCHAR(100) NOT NULL | Descripcion visible de la aprobacion |

## crm_sales_order

| Columna | Tipo y restricciones | Significado |
|---|---|---|
| id_sales_order | BIGINT UNSIGNED NOT NULL AUTO_INCREMENT | Identidad interna propia del CRM |
| public_id_sales_order | CHAR(26) NOT NULL | Identidad publica estable para el API |
| native_code_sales_order | VARCHAR(140) NOT NULL | Codigo propio de la orden en CRM |
| id_old_produccion_sales_order | INT NULL | id_ov original; permite reconciliar sin usarlo como PK nueva |
| unit_file_id_sales_order | BIGINT UNSIGNED NULL | Expediente propio de unidad cuando este conciliado |
| lead_id_sales_order | BIGINT UNSIGNED NULL | Lead nativo relacionado por FK, añadido en035; no recibe directamente un ID legacy/ERP |
| subsidiary_id_sales_order | BIGINT UNSIGNED NULL | Subsidiaria propia conciliada |
| owner_user_id_sales_order | BIGINT UNSIGNED NULL | Responsable CRM; nunca un id externo |
| status_sales_order | ENUM('active','inactive','unknown') NOT NULL DEFAULT 'unknown' | Actividad confirmada; unknown no habilita operaciones |
| cancelled_sales_order | ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' | Venta caida; yes no elimina la orden |
| currency_code_sales_order | CHAR(3) NULL | Moneda ISO confirmada; no se asume al importar |
| transaction_date_sales_order | DATE NULL | Fecha comercial confirmada; no es fecha de importacion |
| list_price_sales_order | DECIMAL(19,4) NULL | Precio de lista normalizado; null si no es interpretable |
| net_sale_price_sales_order | DECIMAL(19,4) NULL | Precio neto normalizado |
| sale_price_sales_order | DECIMAL(19,4) NULL | Precio de venta normalizado |
| advisor_commission_sales_order | DECIMAL(19,4) NULL | Importe de comision del asesor, no porcentaje |
| contract_signed_sales_order | ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' | Firma de contrato observada; no equivale a traspaso |
| commercial_closure_signed_sales_order | ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' | Marca cierre_firmado_ov; no se infiere entrega ni traspaso |
| advisor_commission_calculated_sales_order | ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' | Marca de calculo de comision observada |
| advisor_commission_paid_sales_order | ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' | Marca comision_cancelada_ov segun el mapper recibido |
| unit_delivered_sales_order | ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' | 057: unidad entregada, independiente de firma o etapa |
| unit_transferred_sales_order | ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' | 057: unidad traspasada |
| keys_delivered_sales_order | ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' | 057: entrega de llaves |
| trust_down_payment_validated_sales_order | ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' | 057: validación de fideicomiso/prima |
| commission_approved_sales_order | ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' | 057: aprobación de comisión, no prueba de pago |
| broker_commission_calculated_sales_order | ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' | 057: cálculo de comisión del corredor |
| installments_fully_paid_sales_order | ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown' | 057: cuotas completas; no reinterpretar pagadas_ov |
| purchase_funds_origin_sales_order | ENUM('own_funds','bank_financing') NULL DEFAULT NULL | 062: custbody37 confirmado; ID1 own_funds / ID2 bank_financing; vacio NULL |
| cancellation_marked_on_sales_order | DATE NULL DEFAULT NULL | 059: fecha Costa Rica de la transición ERP a venta caída, bajo flag propio |
| addendum_status_sales_order | ENUM('pending','completed','cancelled') NULL DEFAULT NULL | 065: marcador de adéndum independiente de etapa |
| addendum_version_sales_order | INT UNSIGNED NOT NULL DEFAULT 0 | 065: versión optimista del marcador |
| addendum_changed_at_sales_order | DATETIME(3) NULL DEFAULT NULL | 065: fecha UTC del último cambio del marcador |
| addendum_note_sales_order | TEXT NULL DEFAULT NULL | 066: nota opcional del marcado manual, hasta2000 caracteres en API |
| source_created_at_sales_order | DATETIME(3) NULL | creado_ov observado; puede no ser la creacion real en el ERP |
| created_at_sales_order | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Instante de creacion del registro en CRM nuevo; UTC |
| created_by_user_id_sales_order | BIGINT UNSIGNED NULL | Usuario CRM creador si es conocido |
| updated_at_sales_order | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Ultima modificacion local auditada; UTC |
| updated_by_user_id_sales_order | BIGINT UNSIGNED NULL | Usuario responsable de la ultima modificacion local |
| deleted_at_sales_order | DATETIME(3) NULL | Borrado logico sin perder trazabilidad |

## crm_sales_order_external_reference

| Columna | Tipo y restricciones | Significado |
|---|---|---|
| id_sales_order_external_reference | BIGINT UNSIGNED NOT NULL AUTO_INCREMENT | Identidad de referencia de proveedor |
| sales_order_id_sales_order_external_reference | BIGINT UNSIGNED NOT NULL | Orden propia enlazada |
| external_system_id_sales_order_external_reference | BIGINT UNSIGNED NOT NULL | Sistema o cuenta de proveedor registrado; nunca contiene secretos |
| external_id_sales_order_external_reference | VARCHAR(180) NOT NULL | Id de transaccion como texto para cualquier proveedor |
| transaction_number_sales_order_external_reference | VARCHAR(180) NULL | Numero visible de transaccion del proveedor |
| status_sales_order_external_reference | ENUM('active','inactive') NOT NULL DEFAULT 'active' | Vigencia del enlace externo |
| created_at_sales_order_external_reference | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Fecha de registro del enlace; UTC |
| updated_at_sales_order_external_reference | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Ultima conciliacion del enlace; UTC |

## crm_sales_order_approval

| Columna | Tipo y restricciones | Significado |
|---|---|---|
| sales_order_id_sales_order_approval | BIGINT UNSIGNED NOT NULL | Orden propia de la aprobacion |
| type_code_sales_order_approval | VARCHAR(32) NOT NULL | Jefatura, desarrolladora o formalizacion |
| status_sales_order_approval | ENUM('approved','not_approved','unknown') NOT NULL DEFAULT 'unknown' | Resultado legible; unknown no es aprobacion |
| version_sales_order_approval | INT UNSIGNED NOT NULL DEFAULT 0 | Version de la proyeccion; cada cambio agrega un evento |
| updated_at_sales_order_approval | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Registro de ultima observacion o cambio; no fecha historica inferida |
| updated_by_user_id_sales_order_approval | BIGINT UNSIGNED NULL | Usuario CRM del ultimo cambio conocido |

## audit_sales_order_state_event

| Columna | Tipo y restricciones | Significado |
|---|---|---|
| id_sales_order_state_event | BIGINT UNSIGNED NOT NULL AUTO_INCREMENT | Secuencia tecnica del evento inmutable |
| public_id_sales_order_state_event | CHAR(26) NOT NULL | Identidad publica del evento |
| sales_order_id_sales_order_state_event | BIGINT UNSIGNED NOT NULL | Orden propia cuyo recorrido se registra |
| sequence_sales_order_state_event | INT UNSIGNED NOT NULL | Numero de visita o transicion por orden |
| from_state_code_sales_order_state_event | VARCHAR(48) NULL | Estado anterior; null solo en el primer evento |
| to_state_code_sales_order_state_event | VARCHAR(48) NOT NULL | Estado observado o nuevo; permite reingresos |
| event_kind_sales_order_state_event | ENUM('created','transition','import_snapshot') NOT NULL | Snapshot inicial no inventa transiciones previas |
| effective_at_sales_order_state_event | DATETIME(3) NULL | Fecha efectiva confirmada; null para pasado desconocido |
| recorded_at_sales_order_state_event | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Cuando CRM registro la evidencia; UTC |
| actor_user_id_sales_order_state_event | BIGINT UNSIGNED NULL | Usuario autenticado si es conocido |
| actor_snapshot_sales_order_state_event | JSON NULL | Nombre y roles del actor en ese momento; sin secretos |
| responsible_user_id_sales_order_state_event | BIGINT UNSIGNED NULL | 036: responsable nativo de la visita; independiente del autor/vendedor |
| responsible_snapshot_sales_order_state_event | JSON NULL | 036: identidad histórica del responsable, conservada en avances de integración |
| origin_sales_order_state_event | ENUM('crm','integration','legacy_import') NOT NULL | Origen real del cambio o de la observacion |
| reason_sales_order_state_event | VARCHAR(500) NOT NULL | Motivo obligatorio del cambio u observacion |
| operation_id_sales_order_state_event | VARCHAR(100) NOT NULL | Idempotencia por orden; reintentar no agrega otra transicion |
| correlation_id_sales_order_state_event | VARCHAR(100) NOT NULL | Relaciona accion, auditoria y sincronizacion futura |

## audit_sales_order_approval_event

| Columna | Tipo y restricciones | Significado |
|---|---|---|
| id_sales_order_approval_event | BIGINT UNSIGNED NOT NULL AUTO_INCREMENT | Identidad del cambio inmutable de aprobacion |
| sales_order_id_sales_order_approval_event | BIGINT UNSIGNED NOT NULL | Orden propia revisada |
| type_code_sales_order_approval_event | VARCHAR(32) NOT NULL | Aprobacion revisada de forma independiente |
| version_sales_order_approval_event | INT UNSIGNED NOT NULL | Version correlativa por orden y tipo |
| before_status_sales_order_approval_event | ENUM('approved','not_approved','unknown') NULL | Resultado anterior; null si es primera observacion |
| after_status_sales_order_approval_event | ENUM('approved','not_approved','unknown') NOT NULL | Resultado nuevo o observado |
| effective_at_sales_order_approval_event | DATETIME(3) NULL | Fecha real confirmada; null si se importa sin evidencia |
| recorded_at_sales_order_approval_event | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Cuando se registro el evento; UTC |
| actor_user_id_sales_order_approval_event | BIGINT UNSIGNED NULL | Usuario CRM si es conocido |
| actor_snapshot_sales_order_approval_event | JSON NULL | Nombre y roles del actor al momento de la accion |
| origin_sales_order_approval_event | ENUM('crm','integration','legacy_import') NOT NULL | Origen del resultado de aprobacion |
| reason_sales_order_approval_event | VARCHAR(500) NOT NULL | Motivo del resultado u observacion inicial |
| operation_id_sales_order_approval_event | VARCHAR(100) NOT NULL | Idempotencia por orden y tipo |
| correlation_id_sales_order_approval_event | VARCHAR(100) NOT NULL | Traza comun de la operacion |

## int_sales_order_source_snapshot

| Columna | Tipo y restricciones | Significado |
|---|---|---|
| id_sales_order_source_snapshot | BIGINT UNSIGNED NOT NULL AUTO_INCREMENT | Identidad de la observacion externa |
| sales_order_id_sales_order_source_snapshot | BIGINT UNSIGNED NOT NULL | Orden propia relacionada |
| external_system_id_sales_order_source_snapshot | BIGINT UNSIGNED NOT NULL | Origen registrado de la observacion |
| source_record_id_sales_order_source_snapshot | VARCHAR(180) NOT NULL | Id del registro en el sistema de origen |
| payload_sales_order_source_snapshot | JSON NOT NULL | Copia original restringida; conserva campos aun no interpretados |
| observed_at_sales_order_source_snapshot | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Fecha de lectura; no fecha efectiva del pasado |
| operation_id_sales_order_source_snapshot | VARCHAR(100) NOT NULL | Idempotencia de la observacion |

## audit_sales_order_change

| Columna | Tipo y restricciones | Significado |
|---|---|---|
| id_sales_order_change | BIGINT UNSIGNED NOT NULL AUTO_INCREMENT | Identidad de cambio comercial |
| sales_order_id_sales_order_change | BIGINT UNSIGNED NOT NULL | Orden propia modificada |
| action_sales_order_change | ENUM('create','update','import_snapshot') NOT NULL | Accion registrada sin reemplazar eventos de etapa |
| before_sales_order_change | JSON NULL | Campos anteriores; null en alta o snapshot inicial |
| after_sales_order_change | JSON NOT NULL | Campos nuevos o observados |
| actor_user_id_sales_order_change | BIGINT UNSIGNED NULL | Usuario responsable cuando es conocido |
| recorded_at_sales_order_change | DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) | Fecha de registro de la auditoria; UTC |
| origin_sales_order_change | ENUM('crm','integration','legacy_import') NOT NULL | Origen real de la accion |
| reason_sales_order_change | VARCHAR(500) NOT NULL | Motivo obligatorio |
| operation_id_sales_order_change | VARCHAR(100) NOT NULL | Operacion idempotente por orden |
| correlation_id_sales_order_change | VARCHAR(100) NOT NULL | Traza de la accion |
