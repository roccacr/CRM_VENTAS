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

## Responsable exclusivo de Habita — 11/11/2026

La consulta del snapshot usa únicamente module=salesOrders, action=syncSnapshot e id de NetSuite. No envía responsable ni datos internos de Habita. El campo recibido crm_owner_employee se ignora, incluso si está vacío, malformado o sin vínculo. Importación manual/automática y edición conservan owner_user_id_sales_order e id_ov_admin; no buscan empleados en NetSuite ni crean int_user_external_identity. Cliente, expediente y subsidiaria mantienen su conciliación y validación ERP. No requiere migración ni cambios de credencial o SuiteScript por esta regla.

## Recuperación de eventos fallidos — 12/11/2026

`scripts/retry-netsuite-order-events.ts` lee la exportación JSON de NetSuite, selecciona únicamente órdenes con `delivered:false` y deduplica sus IDs. Por defecto muestra el plan sin conectar; `--apply --output <informe.json>` autoriza la recuperación en producción. Requiere la credencial vigente en `NETSUITE_PRODUCTION_EVENTS_SECRET` del proceso: no la imprime, rota ni escribe en archivos de configuración.

Cada orden se consulta de nuevo por ID mediante el cliente RESTlet existente. Comparte `verifiedOrderEventFromSnapshot` con la sincronización manual: exige identidad, proyección y ventana verificadas. Entrega el evento al receptor oficial; este conserva la resolución nueva → vieja y encola las ausentes para importarlas en la BD nueva. Un recibo debe coincidir con ID y UUID; `import_queued` no se considera creación terminada. No hay escrituras SQL directas ni altas de usuarios desde el script.

La recuperación real del JSON proporcionado seleccionó 13 IDs: 10 actualizados, 2 sin cambios y BC568 (`12766013`) encolada y posteriormente importada. Se verificaron las 13 órdenes y sus últimas bitácoras en ambas BDs, sin errores. La fuente histórica no permite reconstruir la excepción original de cada `delivery_failed`.

La librería local `2026.11.12.1` deja de leer/enviar `crm_owner_employee` y registra códigos cerrados de timeout, conexión, certificado o DNS tras agotar el reintento. Nunca registra mensajes crudos ni credenciales. Requiere actualización del archivo en NetSuite; no se afirma que esté instalada por editar la copia local. La credencial fija permanece intacta.

La grilla y el detalle de Formalización muestran **Sistema** si la orden no tiene responsable asignado. No se inventa una cuenta ni se reemplaza un responsable existente: la ausencia sigue siendo NULL y la autoría automática queda bajo el actor de servicio de la integración.


## Importación automática también al crear — 2026-11-13

Los webhooks autenticados `create`, `edit` y `xedit` con resultado `not_found`
encolan la importación mediante `NetsuiteOrderImportQueue.enqueueMissingEvent`.
Antes se excluía `create`, lo que producía `receipt_invalid` en NetSuite al
recibir `persisted=false` sin `importQueued=true`. Caso observado: BC590,
ID NetSuite 13474495; sus ediciones posteriores actualizaron legacy correctamente.

Se conserva la búsqueda nueva → vieja antes de encolar. Si ya existe, se actualiza
y no se importa. Si falta, la creación va a la BD nueva y usa el flujo existente
de dependencias. La clave cuenta/ambiente/ID de orden se comparte entre alta y
edición, sin cambiar credenciales, SuiteScript, esquema ni eventos approve/cancel/reject.
La respuesta `import_queued` confirma la cola durable, no que la orden ya se creó;
el resultado final lo resuelve el trabajador existente.

Regresiones preparadas: aceptación create/edit/xedit, clave compartida entre tipos,
rechazo de otros eventos y de fallo al guardar la cola. No se ejecutaron pruebas
por restricción del usuario. Publicación y validación real pendientes.
