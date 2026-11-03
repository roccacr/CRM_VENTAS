# Finiquito de venta caída

## Contrato
La rama aplica desde cualquier etapa cuando ambos indicadores están confirmados: `cancelled_sales_order=yes` y `contract_signed_sales_order=yes` en nativo; `caida_ov=1` y `contrado_frima_ov=1` en legacy. No habilita órdenes eliminadas o inactivas. La autoridad nativa prevalece sobre un alias legacy.

El detalle completo y el panel lateral presentan «Gestionar finiquito», seguido de «Registrar envío» y «Registrar firma». La rama recorre `pending_send → sent → signed`; no permite saltos ni retrocesos. Registrar envío no envía correo. Envío y firma requieren confirmación visual.

## Persistencia y permisos
GET `/formalization/orders/finiquito?source=native|legacy&id=...`: permiso vigente de lectura de orden. POST a la misma ruta: además `formalizacion.orders.stage.update`, sesión y CSRF. Body: `source`, `id`, `status`, `expectedVersion`, `operationId` UUID. No acepta actor ni indicadores del cliente.

Reutiliza el diario durable `audit_record_event`, módulo `formalizacion.finiquito`, como fuente de la rama; no requiere DDL, nuevas columnas ni modificar indicadores de NetSuite. Guarda estado, versión y etapa al iniciar la rama, con actor, fecha, correlación y metadatos HTTP. Bloquea la orden y comprueba la versión; reintentos idénticos conservan la operación. La etapa principal y sus visitas no se alteran. No reconstruye una etapa histórica de caída si no existe evidencia: fija la etapa conservada al iniciar el finiquito.

Las ventas caídas con contrato firmado quedan disponibles en «Todas», detalle e historial; se excluyen de las bandejas de ventas activas. Los comandos habituales siguen rechazando órdenes canceladas. La UI oculta sus acciones de etapa.

## Verificación local
API: `pnpm exec vitest run test/sales-orders/finiquito.policy.spec.ts test/sales-orders/finiquito.repository.spec.ts test/sales-orders/finiquito.service.spec.ts`.
Frontend: `pnpm exec vitest run test/home/formalization-finiquito.spec.tsx`.
Compilación: `pnpm build` en cada aplicación. Estos cambios no acreditan publicación ni validación con órdenes reales.
