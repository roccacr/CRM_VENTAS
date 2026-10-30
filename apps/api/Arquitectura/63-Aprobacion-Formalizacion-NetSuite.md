# Aprobacion de Formalizacion confirmada por NetSuite

Actualización de autorización: [65 - Roles y recuperación](65-Formalizacion-Correcciones-Roles-y-Recuperacion.md)
reconoce ambos roles efectivos activos y elimina la restricción por vendedor
cuando existe el permiso de aprobar. El valor por defecto continúa en Jefatura;
las denegaciones, comprobaciones ERP, versiones y auditoría no cambian.

## Alcance autorizado (2026-10-28)

El boton Aprobar Formalizacion llama a POST /formalization/orders/approve. Exige sesion, CSRF, pertenencia efectiva a Formalizacion y permiso independiente `formalizacion.orders.approve`; una denegacion individual prevalece. La migracion045 ya existe: lectura real de sec_permission/sec_role_permission verifico permiso activo asignado a jefe_formalizaciones activo; no se recrea ni amplian otros roles.

La conexion actual es NetSuite Sandbox. El propietario autorizo expresamente que una confirmacion de ese entorno actualice tambien la orden legacy en crmdatabase-api. La razon guardada en bitacora identifica el entorno externo y su ID. No se cambia automaticamente a NetSuite produccion ni se reutiliza el RESTlet1764 como escritor. El nuevo RESTlet sigue limitado a4552704_SB1; habilitar el escritor en NetSuite produccion requerira configurar y desplegar alli el contrato nuevo.

## Flujo

1. Validar sesion, permiso y cuerpo estricto: source, id CRM, expectedSequence y operationId UUID. El actor y la referencia NetSuite se obtienen del servidor.
2. Resolver autoridad nativa primero. Una fila nativa, aun inactiva/eliminada, impide escribir legacy. Sin alias, bloquear el padre legacy y repetir la busqueda nativa con FOR UPDATE. La promocion debe seguir el mismo protocolo de bloqueo antes de insertar un alias.
3. Comprobar orden activa/no caida, aprobaciones Jefe de Ventas y Desarrolladora, alcance del usuario y version actual. Capturar actor para auditoria.
4. PUT al RESTlet con module=salesOrders, action=approveFormalization e ID interno NetSuite. Solo modifica `custbodyid_firma_rc`; nunca las otras aprobaciones ni correo. Si ya estaba marcado, no vuelve a guardarlo. Releer el check para confirmar; HTTP200 por si solo no es aprobacion.
5. Solo tras confirmacion, guardar `aprobacion_forma_ov=1` en legacy o `crm_sales_order_approval` type=formalization/status=approved en nativo. El API nunca escribe ambas ordenes.
6. Registrar entrada a contract_pending_send si corresponde, con actor/responsable y fecha actual, sin inventar fechas anteriores. Aprobacion nativa conserva su historial especializado; legacy conserva sus eventos de etapa. La bitacora central audit_record_event queda en CRM_THINK_V2 con snapshots anterior/nuevo y origen fisico correcto.
7. Responder source,id,approved,state,sequence,replayed. La interfaz confirma antes del envio y revalida el seguimiento, sin volver a cargar todos los datos NetSuite.

## Atomicidad, errores y reintentos

Correccion de diagnostico (2026-10-28): los rechazos de aplicacion 409 `APPROVAL_PREREQUISITES_REQUIRED` y `SALES_ORDER_CANCELLED` del RESTlet se traducen a HTTP409 con codigo y mensaje fijos del API. La vista muestra la causa, bloquea el reintento inmediato y ofrece Actualizar orden. No se reenvian mensajes crudos de NetSuite ni se confunden esos rechazos previos a la escritura con un conflicto de version. Los errores desconocidos, respuestas incompletas y timeouts conservan el tratamiento de resultado incierto. No se modifican aprobaciones ni bases de datos para probar este manejo.

El check local, los eventos de etapa y la bitacora central usan la misma transaccion/conexion MySQL. Las tablas revisadas en ambas BD son InnoDB. La version y el bloqueo del padre serializan comandos que respetan este protocolo. El hash de operationId permite reintentar sin duplicar historial, vinculado a orden, actor y version inicial; conserva el permiso y alcance vigentes.

NetSuite no participa en la transaccion MySQL. El bloqueo del padre se mantiene durante la llamada externa (timeout acotado15s): es un corte simple con costo de contencion, no una transaccion distribuida. Si el proveedor falla o la respuesta es incierta, no se guarda aprobacion local. Si NetSuite confirmo y falla MySQL/bitacora/commit, el API devuelve503 FORMALIZATION_APPROVAL_RECONCILIATION_REQUIRED; no revierte ni desmarca el ERP. Reintentar la misma operacion permite consultar el check ya marcado y sincronizar. No existe worker automatico de reconciliacion ni outbox en este corte.

Si la respuesta se pierde despues del commit, el mismo operationId devuelve el resultado registrado. No inferir exito por un numero2, un flag del navegador o una respuesta sin identidad/confirmacion validas.

## Evidencia y limites

Se comprobo en lectura real el permiso del rol y los motores de almacenamiento; no se ejecutaron aprobaciones reales ni fixtures en ninguna BD. Las pruebas de repositorio usan dobles y verifican orden ERP-antes-de-escritura, rollback, autoridad, scopes e idempotencia. No equivalen a una prueba de concurrencia con MySQL aislado ni certifican triggers, permisos SQL de escritura o workflows de NetSuite.

La funcion y el boton requieren que la revision del RESTlet se suba a Sandbox. La evidencia anterior de GET exitoso no prueba este PUT. La primera aprobacion real debe comprobar check externo, check local, evento y bitacora, sobre una orden elegida por el usuario. No se cambian credenciales ni se ejecutan migraciones en esta entrega.

## Resultado de verificaciones locales

Suite completa API: 6246 pruebas aprobadas y141 omitidas (sin fixtures de MySQL compartido). Typecheck y build API aprobados; lint y formato de los archivos modificados aprobados. GET /health/ready del API local respondio ready. El filtro HTTP conserva exclusivamente la respuesta fija de reconciliacion; la regresion comprobo que SQL/mensaje crudos no salen del servidor. La revision independiente confirmo ese cierre. Frontend:86 pruebas enfocadas reejecutadas por el agente principal, build (incluye typecheck) aprobado; aviso de chunk vendor de Ant Design superior a500kB, sin fallo de build. La confirmacion del POST actualiza solo el check de aprobacion de la proyeccion visible; una recarga real descarta esa actualizacion local. Esta evidencia no sustituye una aprobacion de proveedor real.

## Validaciones y alertas - entrega 2026.10.28.4

El RESTlet acredita existencia mediante record.load antes de lookupFields: no inferir existencia ni ausencia a partir de casillas vacias. Una orden inexistente devuelve404 SALES_ORDER_NOT_FOUND, traducido al codigo publico NETSUITE_SALES_ORDER_NOT_FOUND tambien al aprobar. Una orden caida siempre se rechaza; una aprobacion ya marcada se confirma sin volver a escribir el ERP. Solo una aprobacion nueva exige los otros checks en el proveedor. El CRM mantiene sus propios controles de actividad, previas, version y permisos antes de cualquier comando; no habilita etapas con previas locales incompletas. Tras confirmacion externa conserva la persistencia exclusiva nativa/legacy y auditoria transaccional.

La respuesta de primera ejecucion incluye alreadyApproved para distinguir el check externo previo. Replays antiguos pueden omitirlo; no se inventa ese dato en su historial. La vista valida el metadato booleano cuando existe, muestra alertas Ant Design con icono para errores y una notificacion success con check en la esquina superior derecha para la confirmacion. Solo informa sincronizacion despues de recibir la confirmacion local del API. Los rechazos 404/409 bloquean el reintento inmediato y ofrecen actualizar. Sin fixtures ni aprobaciones reales en esta entrega.

## Reutilizacion y separacion de entorno - 2026.10.28.5

La lectura de existencia y campos se comparte con GET mediante loadRecord y bodyValue. El comando no duplica record.load, no arma el JSON comercial y no ejecuta lookupFields inicial. Conserva una relectura minima tras escribir para verificar persistencia. Reglas de existencia, caida y aprobacion previa son independientes de la cuenta; seleccionar un entorno no cambia esas reglas. Se mantiene el bloqueo explicito de ejecucion fuera de Sandbox hasta habilitar el escritor productivo por separado. No se cambian conexiones ni credenciales en este refactor.

## Confirmacion y permanencia del panel - 2026-10-28

El exito usa notification.success de Ant Design con placement topRight y check verde, sin duplicarlo como texto o alerta dentro de Acciones de la etapa. Tras guardar se cierra solo la confirmacion, no el panel lateral de la orden. El panel conserva la identidad seleccionada aunque salga de la bandeja filtrada y revalida exclusivamente GET /formalization/orders/:source/:id/record; luego actualiza lista y banners. No vuelve a consultar NetSuite. Las versiones y permisos del servidor siguen autorizando cada operacion. La navegacion anterior/siguiente queda deshabilitada si la orden ya no figura en la pagina actual; el pie lo indica. La seleccion no se persiste fuera del componente.
