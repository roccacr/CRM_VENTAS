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
`formalizacion.home.stages.read`, alcance por orden y permiso de aprobaciones
cuando corresponde. El JSON de diagnostico es `{schemaVersion:1,order,data}`;
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
