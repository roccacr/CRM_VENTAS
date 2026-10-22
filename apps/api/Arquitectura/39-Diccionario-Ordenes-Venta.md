# Diccionario fisico de ordenes de venta

Fuente: migracion 202610200021 y ajuste UTC 202610200022.
Detalles y limites: [Documento 38](38-Ordenes-Venta-Estados-Auditoria.md).

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
