# Sincronizacion manual de una orden desde NetSuite

## Corte local — 2026-11-10

La sincronización de una orden existente conserva su identidad y contrato.
El árbol local añade una operación distinta, `POST /formalization/orders/netsuite/import`,
para la extracción explícita por `tranid`. Valida el número exacto y el
snapshot obtenido por el servidor. Solo esa operación puede crear la orden
nativa. Requiere los permisos efectivos de lectura y actualización de
etapa, sesión, CSRF, configuración de ambiente y el RESTlet compatible.
[90 — Ruta, deduplicación y estado de publicación](90-Reconciliacion-API-20261110.md).

Solicitud: boton junto a refrescar y ambiente visible en la ruta de la orden.

- GET contexto autorizado informa ambiente elegido por configuracion del servidor, no por el navegador.
- POST sincronizar exige sesion, CSRF, lectura y permiso existente formalizacion.orders.stage.update. No recibe payload de NetSuite desde React.
- GET RESTlet action=syncSnapshot reutiliza lectura verificada de eventos: doble lectura, fecha real de modificacion y ventana de observacion. Ausencia de esa capacidad bloquea la sincronizacion sin escribir.
- Reutilizar escritor durable y matriz73-75. Revalidar identidad autorizada dentro de transaccion, prioridad nativa y legacy solo si corresponde. No crear ni importar registros. Auditoria atribuye usuario solicitante.
- Persistencia requiere flags existentes del ambiente. Sandbox local compartido con BD real permanece bloqueado; no activar flags ni cambiar destinos por implementar el boton.
- Campos omitidos se conservan, null explicito sigue contrato, relaciones ambiguas abortan toda transaccion. Mantener reglas de etapas ya existentes.
- Confirmacion muestra ambiente y reemplazo de campos mapeados; exito indica destino y numero de cambios, recarga ficha.
- Pruebas: vitest focalizado API/UI, lint/tipos/build. Dobles de NetSuite y bases; sin escrituras reales durante verificacion. No publicar CRM ni NetSuite sin solicitud de despliegue.

Archivos: netsuite-sales-order.service/module/repository, clienteRESTlet, servicio/repositorioeventos, libreriaSuiteScript; servicio y botonfrontend, cabeceraFormalizationOrderPreview.


## Auditoria y limites de aceptacion

La bitacora central identifica al usuario solicitante y el recibo tecnico indica sincronizacion manual. Los subeventos derivados de aprobaciones/cuotas mantienen su procedencia automatica NetSuite y se correlacionan por eventId; no se convierten en decisiones manuales del usuario.

La identidad del request puede estar cacheada; la garantia transaccional depende de bloquear y consultar las filas actuales de usuario/sesion para verificar estado, expiracion y version de permisos hasta COMMIT. Se conserva tambien la comprobacion declarativa de permisos antes del fetch y del escritor. Cambio de referencia o autoridad produce conflicto, sin sobrescribir otra orden.

Pruebas con dobles: Produccion/Sandbox, permisos y sesion revocados, persistencia bloqueada, ID incoherente, doble lectura cambiada, ventanas, matriz, autoridad cambiada, confirmacion y fallosUI. Builds y tipos de las aplicaciones; navegador con fixture de prueba. No hay prueba de escritura sobre una orden real ni se publican CRM/NetSuite por implementar esta funcion.


## Verificacion local de esta entrega

114 pruebas API focalizadas y5 de UI/layout aprobadas. Lint de archivos tocados, typecheckAPI y buildsAPI/frontend verificados; frontend build incluye tipos. Navegador con datos simulados: breadcrumbNetSuiteProduccion, accion junto al refresco y modal con ambiente/origen y advertencia de avances. No se ejecuto escritura real contra ordenLV208, no se publico CRM y no se cargo la libreria en NetSuite durante este cambio. Actualizacion requerida: libreria2026.11.03.4 en ambos ambientes; wrappers sin cambios. Las suites globales conservan los fallos del despliegue anterior y no se declaran verdes.
