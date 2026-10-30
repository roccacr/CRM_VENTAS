## Lectura Sandbox con CRM_v2 (2026-10-28)

Ausencia confirmada: el GET del RESTlet con `status:404` y `error.code:SALES_ORDER_NOT_FOUND` se traduce a HTTP404 y codigo publico `NETSUITE_SALES_ORDER_NOT_FOUND`. La ficha muestra «La orden de venta no existe en NetSuite en el entorno configurado». El mensaje original del proveedor no se expone. Un fallo de transporte, HTTP404 sin confirmacion de registro o error de lectura no prueba ausencia: conserva el error generico de carga. La orden puede existir en el CRM y no existir en el Sandbox; no se eliminan ni modifican registros por este resultado.

El cliente selecciona entorno con `NETSUITE_ENVIRONMENT`. Produccion conserva el contrato anterior `rType=salesordersExtraer`; Sandbox usa el nuevo contrato `module=salesOrders&id=<ID interno NetSuite>`. Los endpoints del CRM, permisos y resolucion nativa primero no cambian. La URL del navegador contiene la identidad CRM, nunca autoriza un ID externo arbitrario.

Sandbox requiere claves `NETSUITE_SANDBOX_*`, realm `4552704_SB1` y URL explicita `NETSUITE_SANDBOX_RESTLET_URL`. La lectura historica se verifico en script 3353, deploy 1; esto no acredita la carga de la revision PUT actual. Sin fallback a produccion ni redirects. El archivo SuiteScript se conserva en `suitescript/SS2_1_RL_CRM_Integracion.js`; Leads y Estimates siguen sin implementar. GET conserva su comportamiento de lectura; PUT implementa exclusivamente la aprobacion de Formalizacion en Sandbox.

## Aprobacion de Formalizacion: implementacion local (2026-10-28)

`NetsuiteRestletClient.approveFormalization(id)` devuelve `Promise<{ id: string; approved: true; alreadyApproved: boolean; environment: 'sandbox' | 'production' }>`. Actualmente solo permite Sandbox y devuelve `environment: 'sandbox'`; produccion, entorno ausente o incompatible fallan antes de enviar la solicitud. No utiliza el script 1764 como escritor. La lectura GET de produccion conserva el contrato legacy existente.

El ID debe ser una cadena decimal canonica positiva representable como entero seguro. El cliente envia PUT al URL Sandbox configurado con cuerpo JSON exacto `{ module: 'salesOrders', action: 'approveFormalization', id }`. OAuth TBA HMAC-SHA256 firma el metodo PUT, URL y parametros OAuth; el JSON no se incluye como parametros de formulario OAuth. Se conserva la funcion exportada `netsuiteGetAuthorization` y su vector GET. Plazo de 15 segundos, respuesta hasta 5 MiB, sin redirects ni reintentos automaticos.

Antes de resolver la promesa exige HTTP satisfactorio, status de aplicacion 200, type `salesorder`, ID exacto solicitado, approval `formalization`, approved booleano true y alreadyApproved booleano. Un 200 generico, un numero o un flag del cliente no acreditan aprobacion. Timeout, fallo de red o respuesta no confirmada se comunican como resultado desconocido; no afirman que la orden no fue modificada. Consultar estado antes de reintentar.

El RESTlet exige previamente las aprobaciones booleanas de Jefatura de Ventas y Desarrollador, rechaza orden caida y solo escribe `custbodyid_firma_rc: true` cuando falta; recarga para confirmar. No hay uso explicito de N/email ni escritura explicita de otros campos; los posibles efectos de workflows o scripts de la cuenta no se descartan por esta limitacion. Contrato de campos, errores y logging: [README del SuiteScript](suitescript/README.md). Autorizacion y flujo de dominio: [Arquitectura/63](../../../Arquitectura/63-Aprobacion-Formalizacion-NetSuite.md).

Pendiente subir esta revision a Sandbox y validar con una orden elegida expresamente. No se ejecuto ningun PUT real en Sandbox ni escritura en BD de produccion. Las pruebas locales usan mocks y no prueban permisos, workflows ni resultado operativo del proveedor.

Caso de prueba autorizado: `legacy:214` no tiene alias nativo observado; la BD legacy devuelve BC532, referencia NetSuite 12014949, activa y no caida. Esta observacion no migra la orden ni cambia su etapa. Antes de actualizar el script, el GET firmado nuevo respondio HTTP 200 y NOT_IMPLEMENTED; eso prueba autenticacion, no extraccion de la orden.

Las secciones fechadas siguientes conservan contexto historico; sus referencias exclusivas a script 1764 corresponden al contrato de produccion anterior.

# NetSuite: lectura de orden para inspeccion

GET /formalization/orders/:source/:id/netsuite acepta native + publicId o legacy + id_ov. La referencia del proveedor nunca autoriza por si sola el acceso.
Primero valida sesion, rol/permisos efectivos, alcance y aprobaciones cuando corresponde. Resuelve autoridad nativa (incluso para alias legacy); un registro nativo inactivo no permite volver a legacy. Sin alias se consulta legacy. En nativo se exige una unica referencia activa de int_external_system='netsuite'; en legacy se usa id_ov_netsuite.
El snapshot de BD termina antes de llamar al proveedor. Solo se ejecuta GET al RESTlet de cuenta 4552704, script 1764, deploy 1, rType=salesordersExtraer. OAuth TBA HMAC-SHA256, nonce por solicitud, plazo 15 segundos y respuesta hasta 5 MiB. Sin redirects, reintentos automaticos, escrituras ni almacenamiento del payload.
Config existente: NETSUITE_CONSUMER_KEY, NETSUITE_CONSUMER_SECRET, NETSUITE_TOKEN_ID, NETSUITE_TOKEN_SECRET, NETSUITE_REALM y OAUTH_NETSUITE_SIGNATURE. Estas claves son opcionales para arrancar el CRM; el cliente rechaza configuracion incompleta antes de enviar solicitudes. No registrar Authorization ni secretos.
React activa esta inspeccion solo en DEV y con permiso de lectura de Formalizacion. Al abrir la ficha, la URL conserva orderSource y orderId; agrega netsuiteId solo despues de resolverlo en servidor. Al recargar, se repite la lectura por identidad CRM, ignorando cualquier netsuiteId manipulado. La consola muestra [NetSuite: orden de venta]; no hay campos ni formularios nuevos, ni se alimentan los existentes.
Documentacion de firma: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1534941088.html

## Limites de operacion - revision documental 2026-10-27

`NetsuiteModule` esta importado por `AppModule`; el endpoint no esta protegido por
un flag DEV del servidor. DEV limita su consumidor visual, no sustituye los
controles del servicio. Se exige rol efectivo Formalizacion y
el permiso independiente `formalizacion.orders.read`, según
[lectura de una orden](../../../Arquitectura/64-Formalizacion-Permiso-Ver-Orden.md).
La lectura no se restringe al vendedor asignado. El JSON de diagnostico es `{schemaVersion:1,order,data}`;
`data` es payload externo y no debe convertirse en DTO comercial ni persistirse.
Faltan credenciales:503; error/respuesta externa no utilizable:502 sanitizado.

Esta revision inspecciona codigo; no prueba credenciales, disponibilidad del
RESTlet ni ejecucion real en NetSuite. No se envio ninguna solicitud externa.
No marcar firma, envio ni etapa por haber consultado este endpoint.

## Snapshot de BD independiente (2026-10-27)

`GET /formalization/orders/:source/:id/database` reutiliza exactamente la autorización y resolución de autoridad de la lectura NetSuite, sin exigir referencia ni credenciales del proveedor. Comprueba native/publicId o la referencia única `id_old_produccion_sales_order`; solo ausencia real permite fallback legacy. Fallo nativo, inactivo o eliminado no habilitan fallback. No escribe ni importa.

El query comercial está en `modules/crm/sales/sales-orders/order-record.query.ts`. Se ejecuta en un snapshot read-only/repeatable-read. Orden, lead/contacto y expediente pertenecen a la fuente seleccionada; las relaciones ausentes o ambiguas devuelven null y warnings, sin escoger una fila al azar. Native usa FKs; legacy usa idinterno_lead e ID_interno_expediente, no sus PK locales. Proyección explícita de columnas comerciales, sin cuentas/passwords/tokens de admins. Referencias externas acotadas y ordenadas.

Envelope: schemaVersion, observedAt, source, order, lead, contact, unitFile, references, warnings. Cada entidad conserva sus sourceFields originales permitidos para inspección: aún no es un diccionario comercial totalmente normalizado ni un mapeo de UI. Legacy conserva sus valores originales, incluidas fechas e importes de texto; no inventar conversiones ni historiales. Esta separación evita confundir IDs legacy/proveedor con publicId.

El consumidor DEV imprime `[Base de datos: orden de venta]` independientemente de `[NetSuite: orden de venta]`; apertura y recarga repiten ambas consultas sin persistir resultados. Fuera de DEV no hay logs ni llamadas desde este consumidor. Los endpoints conservan sus permisos en servidor en todos los entornos. La inspección real de solo lectura de legacy:208 devolvió 33 campos de orden, 36 de lead, 30 de expediente y contacto, sin incidencias; no prueba datos nativos reales ni una migración.

Validacion posterior a la actualizacion (2026-10-28): GET nuevo devolvio status 200, BC532 / 12014949, 79 campos y 5 lineas. Prueba en navegador de legacy:214 completada con console log [NetSuite: orden de venta]. Sin mutaciones en ambas BD ni ERP. MOTIVO_COMPRA permanece null por falta de ID confirmado; no se inventa su relacion.
