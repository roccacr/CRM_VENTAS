## Como leer este archivo

El corte vigente es el del 2026-11-10. Las secciones con fecha anterior
conservan la evidencia de ese momento y no describen el comportamiento actual.
Documentar este archivo no autoriza escrituras, migraciones ni despliegues.

## Implementación local posterior — 2026-11-02

## Corte del BFF y SuiteScript — 2026-11-10

El release de Habita `63139a8` incluye el límite temporal del cursor y el
archivo SuiteScript versionado `2026.11.03.7`. La librería del árbol local
identifica `2026.11.10.4` y amplía la proyección de fecha de entrega y
la consulta de un ID por número de transacción. La extracción manual local
es la única entrada de sincronización que puede crear una orden nativa.
El webhook v2 conserva su función de actualización. La publicación de Habita
y la instalación del paquete NetSuite se comprueban por separado.
[90 — Reconciliación, extracción y migración 074](../../../Arquitectura/90-Reconciliacion-API-20261110.md).

## Estado vigente contrastado — 2026-11-03

El escritor v2, su auditoría, cursor y resolución de autoridad ya están
implementados; v1 mantiene `persisted:false`. El marcador `crm_sync_projection=1`
habilita los campos ampliados confirmados en [75](../../../Arquitectura/75-Matriz-Campos-Ordenes-NetSuite.md):
montos, fecha canónica, número de transacción, cálculo de asesor, aprobaciones y
relaciones existentes. Moneda, cálculo corredor y `createdfrom` quedan preservados,
sin inferir nuevos mapeos. Líneas y aliases permanecen en el snapshot protegido.

El control temporal actual usa doble lectura completa y ventanas UTC no solapadas;
el hash compara contenido y no funciona como reloj. El reintento de transporte
mantiene UUID/cuerpo; el conflicto de observación409 requiere una nueva lectura/UUID.
[73](../../../Arquitectura/73-Sincronizacion-Estados-Ordenes-NetSuite.md) conserva la prueba real acotada
de diez indicadores; no acredita E2E de todos los campos ampliados ni despliegue.
059 fue aplicada con autorización según74/75; esta revisión no cambia su flag.

Existe una excepción posterior a la regla histórica «los indicadores no mueven
etapas»: `netsuite-paid-installments.handler.ts` puede avanzar visitas finales
existentes tras `edit`/`xedit`, con actividad/firma/aprobación de Formalización,
responsable conservado y auditoría atómica, según [78](../../../Arquitectura/78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md).
No retrocede ni crea órdenes/visitas históricas. Origen de fondos y campos de
adéndum pertenecen al CRM y no son sobrescritos por estos snapshots.

El contrato v2 ya implementa los diez checkbox, resolución nativa → legacy, transacción y bitácora central/nativa. v1 conserva persisted:false. 058 se aplicó con aprobación explícita y el túnel fue verificado; la activación y prueba real están pendientes; este bloque sustituye las descripciones de ausencia de escritor de los cortes históricos inferiores. Contrato, archivos, pruebas y límites: [73](../../../Arquitectura/73-Sincronizacion-Estados-Ordenes-NetSuite.md).

## Estado revisado — 2026-11-02

La integración tiene tres flujos distintos; ninguno debe confundirse con los
otros. Los apartados fechados inferiores conservan su evidencia histórica.

| Flujo | Implementación y límite actual |
| --- | --- |
| Lectura de ficha | `GET /formalization/orders/:source/:id/netsuite`, autorización de orden y resolución nativa primero; producción conserva contrato GET anterior y Sandbox el RESTlet modular |
| Aprobación de Formalización | Cliente PUT acotado a Sandbox, confirmación estricta y resultado desconocido ante fallos inciertos; no es una sincronización general |
| Evento entrante de orden | `POST /integrations/netsuite/local/order-events`, solo development y cuenta Sandbox, token de servicio; devuelve v1 `received:true,persisted:false`; v2 confirma persistencia explícita después del commit |

La ficha React mapea capítulos comerciales de la respuesta mediante
`netsuite-primary.ts`; los diagnósticos de consola DEV son adicionales y no
describen todo el consumidor visual. Los snapshots de BD conservan otra ruta
y no requieren credenciales ERP.

El [plan70](../../../Arquitectura/70-Plan-Sincronizacion-Ordenes-NetSuite.md)
describe el futuro escritor durable, deduplicación, autoridad única y auditoría;
esos componentes ya están implementados en73/75; su plan histórico no es el inventario vigente. Un HTTP200 genérico no acredita su efecto comercial.
Los flags057 locales no están todavía expuestos por todos los lectores/mappers.

El código SuiteScript declara versión `2026.11.02.1` al corte03/11. Una inspección estática
del grafo AMD validó18 archivos; no acredita su carga o ejecución en NetSuite.
La prueba GET del28 y el despliegue Habita del29 son evidencias fechadas, no
verificación actual de esta revisión ni aprobación PUT real.

Hay una excepción temporal de credencial directa de Sandbox en el emisor,
documentada en el [README SuiteScript](suitescript/README.md). No reproducir su
valor ni tratar el empaquetado como sanitización de secretos incrustados.
Migrar ese transporte a API Secrets permanece pendiente; no se rotaron claves
ni se modificó configuración compartida en esta revisión documental.

Inventario general y resultados nuevos: [72](../../../Arquitectura/72-Reconciliacion-Documental-20261102.md).

## Lectura Sandbox con CRM_v2 (2026-10-28)

Ausencia confirmada: el GET del RESTlet con `status:404` y `error.code:SALES_ORDER_NOT_FOUND` se traduce a HTTP404 y codigo publico `NETSUITE_SALES_ORDER_NOT_FOUND`. La ficha muestra «La orden de venta no existe en NetSuite en el entorno configurado». El mensaje original del proveedor no se expone. Un fallo de transporte, HTTP404 sin confirmacion de registro o error de lectura no prueba ausencia: conserva el error generico de carga. La orden puede existir en el CRM y no existir en el Sandbox; no se eliminan ni modifican registros por este resultado.

El cliente fija el entorno usando `FRONTEND_ORIGIN` configurado en el servidor: `https://habita.roccacr.com` siempre Produccion; localhost (incluido punto final y subdominios .localhost), direcciones IPv4 127/8 e IPv6 ::1 siempre Sandbox. No usa cabeceras Origin/Host ni parametros del navegador para elegir credenciales. Para otros sitios conserva `NETSUITE_ENVIRONMENT`. Produccion requiere URL explicita `NETSUITE_PRODUCTION_RESTLET_URL`, cuenta 4552704 y claves `NETSUITE_*`; ya no tiene script/deploy por defecto. `NETSUITE_PRODUCTION_READ_MODE=legacy` conserva `rType=salesordersExtraer`; `modules` habilita `module=salesOrders` cuando el script de produccion confirmado use ese contrato. Sandbox usa `module=salesOrders&id=<ID interno NetSuite>`. Los endpoints del CRM, permisos y resolucion nativa primero no cambian. La URL del navegador contiene la identidad CRM, nunca autoriza un ID externo arbitrario.

Sandbox requiere claves `NETSUITE_SANDBOX_*`, realm `4552704_SB1` y URL explicita `NETSUITE_SANDBOX_RESTLET_URL`. La lectura historica se verifico en script 3353, deploy 1; esto no acredita la carga de la revision PUT actual. Sin fallback a produccion ni redirects. La entrada vigente es `suitescript/SS2_1_RL_CRM_Habita.js` con la librería `SS2_1_LIB_CRM_habita.js`; Leads y Estimates siguen sin implementar. PUT implementa exclusivamente la aprobación de Formalización en ambos entornos autorizados.

## Aprobacion de Formalizacion: implementacion local (2026-10-28)

`NetsuiteRestletClient.approveFormalization(id)` devuelve `Promise<{ id: string; approved: true; alreadyApproved: boolean; environment: 'sandbox' | 'production' }>`. Desde la ampliación autorizada del 2026-11-03 permite Sandbox y producción y devuelve el entorno realmente utilizado. Un FRONTEND_ORIGIN local selecciona Sandbox aun si NETSUITE_ENVIRONMENT indica production. La URL configurada del entorno debe tener desplegado el contrato PUT; no se presupone que un RESTlet antiguo de lectura pueda aprobar. La lectura GET conserva su modo independiente.

El ID debe ser una cadena decimal canonica positiva representable como entero seguro. El cliente envia PUT a la URL del entorno configurado con cuerpo JSON exacto `{ module: 'salesOrders', action: 'approveFormalization', id }`. Usa exclusivamente las credenciales del entorno, sin fallback entre cuentas. OAuth TBA HMAC-SHA256 firma el metodo PUT, URL y parametros OAuth; el JSON no se incluye como parametros de formulario OAuth. Se conserva la funcion exportada `netsuiteGetAuthorization` y su vector GET. Plazo de 15 segundos, respuesta hasta 5 MiB, sin redirects ni reintentos automaticos.

Antes de resolver la promesa exige HTTP satisfactorio, status de aplicacion 200, type `salesorder`, ID exacto solicitado, approval `formalization`, approved booleano true y alreadyApproved booleano. Un 200 generico, un numero o un flag del cliente no acreditan aprobacion. Timeout, fallo de red o respuesta no confirmada se comunican como resultado desconocido; no afirman que la orden no fue modificada. Consultar estado antes de reintentar.

El RESTlet exige previamente las aprobaciones booleanas de Jefatura de Ventas y Desarrollador y rechaza orden caída. Desde la versión2026.11.03.7 ejecuta `N/workflow.initiate` con `workflowId: customworkflow219`, sin `stateId` ni `actionId` y sin escritura directa de `custbodyid_firma_rc`. La definición real tiene sus acciones en Entrada; initiate inicia el estado inicial. El workflow corporativo realiza sus acciones. El RESTlet relee las casillas y solo confirma si la aprobación es true, la orden sigue no caída y conserva sus prerrequisitos; recibir un ID de instancia no basta. Si ya estaba aprobada no repite el workflow. No dispara otra acción como fallback ni reintenta automáticamente. Contrato de campos, errores y logging: [README del SuiteScript](suitescript/README.md). Autorización y flujo de dominio: [Arquitectura/63](../../../Arquitectura/63-Aprobacion-Formalizacion-NetSuite.md).

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


## Preparacion de entornos — 2026-11-03

Las URLs aceptan solo HTTPS, host de la cuenta exacta, ruta RESTlet y un script/deploy
cada uno. No admiten credenciales embebidas, redirects ni parametros adicionales.
Falta de URL/credenciales seleccionadas devuelve 503 antes de contactar al proveedor;
no sustituye valores con los del otro ambiente. Las URLs pueden quedar vacias mientras
se confirman los IDs; no habilitar esta revision en Habita hasta configurar la URL de
produccion. El PUT de aprobacion y el receptor local Sandbox conservan sus limites:
este cambio prepara seleccion/lecturas, no habilita escrituras en NetSuite Produccion.
No se actualizaron secretos ni se publico esta revision por documentar la configuracion.


Verificacion local de esta preparacion: 142 pruebas focalizadas de cliente/configuracion
aprobadas con fetch simulado, sin llamadas reales ni escrituras externas. La revision
independiente resolvio cobertura loopback y validacion de configuracion parcial. El
chequeo general se detuvo en format:check por tres pruebas de Calendario ajenas a esta
tarea; estos resultados no acreditan conexion efectiva a los scripts pendientes.


### Extracción en segundo plano

`POST /formalization/orders/netsuite/import` devuelve HTTP 202 cuando la solicitud queda en `int_event_outbox`. El trabajo guarda el número y la identidad interna del solicitante. La campanita consulta sus resultados en `GET /formalization/orders/netsuite/import/notices`.

Se consulta el número de orden en ambas bases antes de leer NetSuite. Los vínculos de cliente, subsidiaria y responsable también se buscan primero por ID exacto en ambas bases. La lectura de datos faltantes requiere el RESTlet con las acciones `importCustomer` e `importRelation`. Si el expediente de custbody38 no está vinculado en Habita, importRelation con kind=unitFile lee su código (name) y el ID interno de su proyecto principal (custrecord_163_csegix_proyectos). El proyecto debe tener una referencia activa de NetSuite en la BD nueva. Una campaña, proyecto u origen comercial ausente impide inventar la atribución del cliente. El trabajador guarda la orden y los vínculos nuevos en una transacción.

La oportunidad y el registro de origen se preservan como referencias de la captura cuando el proveedor devuelve sus IDs. El modelo todavía no crea ni vincula entidades independientes de oportunidad o estimación.
