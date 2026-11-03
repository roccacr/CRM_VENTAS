# 059 — revisión, aplicación autorizada y rollback

Estado actual: aprobada expresamente para QA y, si pasaba, RDS. Aplicada primero en QA aislado y luego exclusivamente en CRM_THINK_V 2 del RDS MySQL 8.4.8 el 2026-11-03 T 03:35:55 Z. Ledger y columna verificados. Sin cambios de esquema legacy. La activación del handler y las pruebas comerciales siguen pendientes. No ejecutar el runner general: podría incluir otras migraciones pendientes. Tras aprobación se debe seleccionar exclusivamente 059 y verificar previamente esquema, ledger y entorno de desarrollo/QA.

## Cambio exacto

BD `CRM_THINK_V2`, tabla `crm_sales_order`: una columna nueva `cancellation_marked_on_sales_order DATE NULL DEFAULT NULL`. Sin índices, tablas adicionales, FK, seeds, backfill ni cambios de datos comerciales. Cero DDL en `crmdatabase-api`.

```sql
ALTER TABLE CRM_THINK_V2.crm_sales_order
  ADD COLUMN cancellation_marked_on_sales_order DATE NULL DEFAULT NULL
    COMMENT 'Fecha calendario Costa Rica del marcado de venta caida; no cambia la etapa ni el lead',
  ALGORITHM=INSTANT;
```

Implementación: `migrations/schema-only/202611020059_sales_order_cancellation_date.ts`. Rechaza una BD distinta de CRM_THINK_V2 y una columna preexistente con tipo, nulabilidad o default incompatibles. Si el servidor rechaza INSTANT, detener: no sustituir automáticamente por COPY ni bloquear tablas sin nueva revisión.

## Impacto y activación

- Filas actuales: la columna queda NULL, incluso en ventas ya caídas. No existe evidencia para reconstruir sus fechas históricas.
- La fecha procede de `event.sourceModifiedAt`, convertida al calendario de Costa Rica, al pasar de no marcada/desconocida a marcada. No es la fecha de recepción HTTP ni de envío de correo.
- No renovar mientras sigue marcada. Desmarcar conserva la fecha; un nuevo marcado registra la nueva fecha. No cambiar etapa, lead, actividad, disponibilidad, comisiones ni cuotas.
- Efectos desactivados por defecto mediante `NETSUITE_ORDER_CANCELLATION_EFFECTS_ENABLED=false`. No habilitar antes de comprobar 059 aplicada. La columna legacy existente `envioReservaCaida` admite la fecha ISO; no requiere ALTER.
- DDL no es transaccional con el ledger. Si se interrumpe tras ALTER y antes del ledger, comprobar tipo/default/nulabilidad y reconciliar mediante el runner; no borrar la columna para reintentar.
- Aun con INSTANT, el ALTER necesita un bloqueo breve de metadatos; ejecutarlo primero en desarrollo/QA sin transacciones largas y con observación.

## Rollback propuesto — no ejecutado

Primero apagar `NETSUITE_ORDER_CANCELLATION_EFFECTS_ENABLED`, retirar el escritor que dependa de la columna y respaldar las fechas existentes. Conservar la columna es la reversión operativa preferida: preserva historia y no cambia las órdenes. Si se exige revertir también el esquema, este SQL elimina definitivamente las fechas nuevas y requiere autorización de esa operación:

```sql
-- Confirmar destino antes de continuar: debe ser CRM_THINK_V2.
SELECT DATABASE();
-- Exportar/respaldar este resultado ANTES del DROP si ya hubo escrituras.
SELECT id_sales_order, cancellation_marked_on_sales_order
FROM CRM_THINK_V2.crm_sales_order
WHERE cancellation_marked_on_sales_order IS NOT NULL;

ALTER TABLE CRM_THINK_V2.crm_sales_order
  DROP COLUMN cancellation_marked_on_sales_order;

-- Conservar el ledger histórico y registrar la reversión auditada por separado.
-- No borrar la entrada059 para forzar una reaplicación.
```

El rollback no modifica `ordenventa.envioReservaCaida` ni revierte automáticamente fechas ya escritas allí: son historia comercial y requieren una operación separada con evidencia previa. No hay migración destructiva automática.

## Aceptación comercial pendiente y corte de QA

La aplicación QA/RDS y el ledger se registran abajo como evidencia histórica, sin revalidación en esta reconciliación. La aceptación comercial debe comprobar marcado/desmarcado/ya marcada/rollback y bitácoras en ambos destinos. La existencia del handler y sus pruebas puras no certifica estos escenarios SQL ni NetSuite real.

## Evidencia de aplicación

QA: 059-qa-applied.json; RDS: 059-rds-before.json y 059-rds-applied.json, bajo el directorio de evidencia sincronizacion-completa. RDS: DATE nullable/default NULL; una entrada059; cero órdenes nativas al verificar; ninguna fecha rellenada. El runner se invocó con una lista de una sola migración, no con el catálogo completo. No se aplicó rollback.
