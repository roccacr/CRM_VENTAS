# SuiteScript unificado de Producción y Sandbox

## Corte local — 2026-11-10

La librería local identifica `2026.11.10.4`. El RESTlet añade
`GET module=salesOrders&action=findByTranId&tranid=<número>` para resolver
el ID interno de una orden con coincidencia exacta. Se incorpora
`custbody_fecha_unidad_entregada` a la proyección.
La biblioteca local fija la URL base de producción en
`https://api-habita.rdghub.com/integrations/netsuite/production`.
El UE añade `/order-events`; el dominio autorizado del secreto en ese
entorno debe corresponder al destino del API. Sandbox conserva sus valores
propios. La URL del bloque histórico inferior describe el corte del 3 de
noviembre. Este inventario no acredita que el archivo local se instaló en
ninguna cuenta. [90 — Reconciliación](../../../../Arquitectura/90-Reconciliacion-API-20261110.md).

## Antecedente de instalación — 2026-11-03

Por indicacion del propietario, esta carpeta contiene la nueva version unificada
para ambos entornos de NetSuite:

- `SS2_1_LIB_CRM_habita.js`: libreria compartida.
- `SS2_1_RL_CRM_Habita.js`: entrada RESTlet.
- `SS2_1_UE_CRM_Habita.js`: entrada User Event.

Ambas entradas importan `/SuiteScripts/SS2_1_LIB_CRM_habita`, sin extension.
Se conserva la capitalizacion exacta de los nombres. La libreria incluye el valor
crudo de `custbody37` y su validacion antes de normalizarlo.

Actualizacion posterior del propietario: Sandbox tambien utiliza ahora los tres
archivos unificados de Habita, conservando cuenta, URL y credenciales propias.
La lectura real en Sandbox script3353/deploy1 se verifico con HTTP200 y status200;
la respuesta observada aun no incluia el ID crudo custbody37, solo FONDOS. Las instrucciones inferiores sobre esa estructura son historicas y
no describen el paquete unificado actual. El empaquetador valida ahora exactamente
estos tres JS, sus dependencias AMD, sintaxis, version y hashes SHA-256.

## Instalacion del paquete unificado en ambos entornos

1. Desde `apps/api`, ejecutar `pnpm netsuite:package:test` y `pnpm netsuite:package`.
   El ZIP queda en `dist/netsuite/`, con `manifest.json` y los tres JS dentro de
   `SuiteScripts/`. Importarlo desde la raiz del Archivador; no usar `CRM TINK/lib`
   ni `modules`. Conservar la capitalizacion exacta. Reemplazar tambien la libreria
   en ambos entornos: actualizar solo RL/UE no incorpora `custbody37` ni el guard.
2. Conservar registros/deployments existentes y comprobar que sus archivos son
   `SS2_1_RL_CRM_Habita.js` y `SS2_1_UE_CRM_Habita.js`. Produccion: RESTlet3739/1,
   UE3740 y libreria9625078. Sandbox: RESTlet3353/1; conservar su User Event.
3. Configurar `custscript_crm_account_id` en **ambos RL y UE** de cada entorno:
   Produccion `4552704`; Sandbox `4552704_SB1` (texto). El valor debe coincidir
   exactamente con la cuenta; el guard admite tambien un entero seguro.
4. En el UE de Produccion, configurar `custscript_crm_event_url` como
   `https://habita.roccacr.com/integrations/netsuite/production` y
   `custscript_crm_event_secret_id` como `custsecret_crm_habita_production`.
   El emisor anade `/order-events`; no incluirlo en la URL base. El valor privado
   del API Secret debe coincidir con el receptor y se entrega por canal privado;
   no incluirlo en JS, ZIP o documentacion. Restringir el API Secret al script UE
   autorizado y al dominio `habita.roccacr.com`. Sandbox conserva su propia URL
   base y referencia de API Secret; no copiar los de Produccion.
5. Verificar primero GET con `module=salesOrders&id=<orden acreditada>` en cada
   RESTlet: comprobar tanto HTTP200 como `status:200`, y `data.fields.custbody37`
   crudo (`1`, `2` o vacio explicito). `FONDOS` es una etiqueta y no sustituye el ID.
   Produccion devolvia `ENVIRONMENT_NOT_AUTHORIZED` y Sandbox omitia ese campo antes
   de esta carga; no se certifica su correccion remota mediante el ZIP local.
6. Una prueba posterior de eventos requiere un guardado expresamente autorizado
   por entorno y revisar recibo, `scriptVersion` y auditoria del receptor. La carga
   del paquete y el estado Liberado no acreditan entrega ni persistencia.

Este procedimiento prepara la instalacion; no ejecuta despliegues ni escrituras.

## Identificadores de Produccion confirmados por el propietario

| Recurso | ID | Archivo / destino |
|---|---|---|
| Libreria del Archivador | 9625078 | SuiteScripts/SS2_1_LIB_CRM_habita.js |
| RESTlet | 3739, deploy1 | SS2_1_RL_CRM_Habita.js |
| User Event | 3740 | SS2_1_UE_CRM_Habita.js; Orden de venta liberado, segun propietario |

RESTlet: `https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=3739&deploy=1`.
El cliente API usa `NETSUITE_PRODUCTION_READ_MODE=modules` y `module=salesOrders`.
El ID del archivo de libreria y el ID del User Event no son parametros de esa URL.
Sandbox conserva su despliegue anterior; no sustituir su URL con el script3739.

Para configuracion explicita, ambos scripts ejecutables usan `custscript_crm_account_id=4552704`
en sus deployments de Produccion. La consulta real de lectura del03/11 alcanzo el
RESTlet y recibio HTTP200 con `status:403`, `ENVIRONMENT_NOT_AUTHORIZED`; no se
confirmo lectura de orden. Revisar ese parametro antes de atribuir el problema
a la autenticacion o cambiar credenciales. No se ejecutaron PUT ni escrituras BD.
El User Event requiere ademas su destino y API Secret configurados; su estado
Liberado por si solo no acredita recepcion/persistencia en la API de Produccion.

## Implementación local posterior — 2026-11-02

## Estado vigente contrastado — 2026-11-03

El escritor v2, su auditoría, cursor y resolución de autoridad ya están
implementados; v1 mantiene `persisted:false`. El marcador `crm_sync_projection=1`
habilita los campos ampliados confirmados en [75](../../../../Arquitectura/75-Matriz-Campos-Ordenes-NetSuite.md):
montos, fecha canónica, número de transacción, cálculo de asesor, aprobaciones y
relaciones existentes. Moneda, cálculo corredor y `createdfrom` quedan preservados,
sin inferir nuevos mapeos. Líneas y aliases permanecen en el snapshot protegido.

El control temporal actual usa doble lectura completa y ventanas UTC no solapadas;
el hash compara contenido y no funciona como reloj. El reintento de transporte
mantiene UUID/cuerpo; el conflicto de observación409 requiere una nueva lectura/UUID.
[73](../../../../Arquitectura/73-Sincronizacion-Estados-Ordenes-NetSuite.md) conserva la prueba real acotada
de diez indicadores; no acredita E2E de todos los campos ampliados ni despliegue.
059 fue aplicada con autorización según74/75; esta revisión no cambia su flag.

Existe una excepción posterior a la regla histórica «los indicadores no mueven
etapas»: `netsuite-paid-installments.handler.ts` puede avanzar visitas finales
existentes tras `edit`/`xedit`, con actividad/firma/aprobación de Formalización,
responsable conservado y auditoría atómica, según [78](../../../../Arquitectura/78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md).
No retrocede ni crea órdenes/visitas históricas. Origen de fondos y campos de
adéndum pertenecen al CRM y no son sobrescritos por estos snapshots.

El contrato v2 ya implementa los diez checkbox, resolución nativa → legacy, transacción y bitácora central/nativa. v1 conserva persisted:false. 058 se aplicó con aprobación explícita y el túnel fue verificado; la activación y prueba real están pendientes; este bloque sustituye las descripciones de ausencia de escritor de los cortes históricos inferiores. Contrato, archivos, pruebas y límites: [73](../../../../Arquitectura/73-Sincronizacion-Estados-Ordenes-NetSuite.md).

# RESTlet CRM TINK - modulos internos

## Convencion de nombres y actualizacion del despliegue

Todos los archivos JavaScript usan `SS2_1_`: `RL` identifica el punto de entrada RESTlet y `LIB` los modulos de apoyo, que no tienen despliegue independiente. El tipo ejecutable sigue definido por `@NScriptType Restlet`, no por el nombre. Se conservan las carpetas existentes.

Esta entrega (historica) renombro los 16 archivos de entonces; hoy hay 18 desplegables y actualiza sus dependencias AMD. Antes de cargar el ZIP, detener las peticiones de la integracion durante la actualizacion. En el Archivador, renombrar el archivo principal existente de `CRM_v2_Global.js` a `SS2_1_RL_CRM_Integracion.js`, conservando su registro. Luego importar el ZIP desde la raiz y sobrescribir los archivos. Verificar en el registro de script que **Archivo de script** apunta a `SuiteScripts/SS2_1_RL_CRM_Integracion.js`; si se cargo como archivo nuevo, seleccionarlo explicitamente en ese mismo registro. Conservar el script 3353 y su despliegue 1 para mantener la URL actual. Comprobar GET antes de reanudar operaciones.

Los archivos auxiliares anteriores pueden quedar sin referencias tras el cambio; retirarlos solamente despues de comprobar que ningun otro script los utiliza. Esta entrega local no cambia archivos ni registros remotos en NetSuite.

`SS2_1_RL_CRM_Integracion.js` es el punto de entrada general CRM -> NetSuite, escrito en SuiteScript 2.1. Una entrada AMD que carga modulos de apoyo, con GET y PUT; sin POST ni DELETE.

## Ubicacion en NetSuite

```text
SuiteScripts/
├── SS2_1_RL_CRM_Integracion.js          <- archivo vinculado al RESTlet existente
└── CRM TINK/
    ├── lib/
    └── modules/
        ├── 01_sales-orders/
        ├── 02_leads/
        └── 03_estimates/
```

La entrada importa los modulos mediante rutas absolutas `/SuiteScripts/CRM TINK/...`, sin extension `.js` en `define`. No depende de estar dentro de CRM TINK. Los modulos conservan sus rutas relativas internas. El nombre y la ubicacion de CRM TINK deben coincidir exactamente.

Subir `SS2_1_RL_CRM_Integracion.js` corregido una vez al archivo vinculado al RESTlet. Para actualizar una accion existente, sobrescribir solamente su archivo dentro de CRM TINK, conservando nombre y subcarpetas. Para agregar una accion a un modulo existente, actualizar tambien el archivo de ensamblaje del modulo. Agregar un modulo principal o cambiar el enrutamiento si requiere modificar la entrada. Las actualizaciones deben incluir todas las dependencias nuevas.

El directorio local mantiene la entrada junto a lib y modules para desarrollo y pruebas; en NetSuite se distribuye como indica el arbol. No subir otra copia de la entrada dentro de CRM TINK. El RESTlet y su despliegue conservan sus IDs.

`lib/SS2_1_LIB_CRM_Registros.js` declara el identificador `salesorder` sin consultar `record.Type` durante `define`; las APIs de NetSuite solo se usan al ejecutar las acciones. Esto evita `SUITESCRIPT_API_UNAVAILABLE_IN_DEFINE` durante la validacion del archivo.

## Corte histórico del paquete — revisión 2026-11-02

La versión declarada por `lib/SS2_1_LIB_CRM_Logs.js` al corte03/11 es `2026.11.02.1`.
La revisión estática del grafo AMD aprobó18 archivos sin ejecutar callbacks,
crear ZIP, subir archivos ni contactar NetSuite. Los ejemplos de versiones
anteriores y las pruebas de Sandbox fechadas más abajo conservan su fecha.

El RESTlet ofrece lectura y la acción acotada de aprobación en Sandbox. El
User Event de órdenes prepara una notificación hacia el receptor local; recibir
su acuse no guarda ni actualiza una orden del CRM. El emisor actual exige
`persisted:false`; una futura respuesta `persisted:true` necesita cambiar y
versionar el contrato, no solo agregar un escritor al backend. Ver
[plan70](../../../../Arquitectura/70-Plan-Sincronizacion-Ordenes-NetSuite.md).

La excepción temporal de credencial directa en `SS2_1_LIB_CRM_EnviarEvento.js`
está presente en el código versionado por `fcbf0c2`. La recomendación histórica
«no publicarlo con credencial» no prueba que el archivo actual carezca de ella.
No copiar ese valor a documentación, ejemplos, capturas, paquetes compartidos ni
logs. Sigue pendiente sustituir la excepción por API Secrets y revisar su
tratamiento con el responsable; esta revisión no cambia o invalida credenciales.
Los filtros de empaquetado/despliegue para `.env` no detectan secretos dentro de JS.

La URL ngrok de ejemplo es una configuración de desarrollo fechada, no un túnel
activo comprobado hoy. No se amplió su allowlist ni se probó recepción externa.
Inventario/evidencia actuales en
[72](../../../../Arquitectura/72-Reconciliacion-Documental-20261102.md).

## Contrato basico

- GET: parametro de URL `module=salesOrders`, `module=leads` o `module=estimates`.
- PUT salesOrders: cuerpo JSON exacto `{ "module": "salesOrders", "action": "approveFormalization", "id": "<ID interno NetSuite>" }`. No admite campos adicionales. Sin action conserva 501; action desconocida devuelve 400 INVALID_ACTION y campos adicionales devuelven 400 INVALID_REQUEST.
- GET salesOrders requiere id interno positivo como cadena decimal canonica y entero seguro; devuelve status 200 con data: { type: "salesorder", id, fields, sublists: { item: { "line 1": {} } } } y aliases de etiquetas al mismo nivel de status/data. PUT exige la misma validacion de ID. No enviar el ID legacy: el API debe resolverlo al ID interno del proveedor.
- Solicitud invalida o modulo desconocido: `status: 400`, `INVALID_MODULE`.
- Sin argumentos conserva `NOT_IMPLEMENTED` de la estructura anterior.
- Cuenta distinta de `4552704_SB1` o entorno distinto de Sandbox: `status: 403`, `SANDBOX_REQUIRED`, antes de distribuir la solicitud.

Los estados anteriores pertenecen al JSON de aplicacion; no representan el codigo HTTP del transporte de NetSuite. La seleccion de modulo no sustituye permisos ni autorizaciones de futuras operaciones. No se ejecutan nombres arbitrarios ni se serializan credenciales.

## Aprobacion de Formalizacion en Sandbox

`approveFormalization(id)` lee las cuatro casillas con una sola `search.lookupFields` (no `record.load`); una ausencia real (`RCRD_DSNT_EXIST`) se devuelve como SALES_ORDER_NOT_FOUND, antes de interpretar casillas. Luego rechaza una orden caida (`custbody43 === true`, 409 SALES_ORDER_CANCELLED). Si Formalizacion aun no esta marcada, exige `custbody_aprueba_jefe_ventas === true` y `custbodyid_firma_rocca === true`; otros valores, incluidos numeros, no acreditan las aprobaciones (409 APPROVAL_PREREQUISITES_REQUIRED).

Si la orden existe, no esta caida y `custbodyid_firma_rc` ya es true, devuelve alreadyApproved:true sin escribir, antes de exigir las aprobaciones previas. El CRM puede sincronizar su aprobacion local con esa confirmacion manteniendo sus validaciones de actividad, aprobaciones previas, permiso y version. En otro caso llama exclusivamente a `record.submitFields` con `values: { custbodyid_firma_rc: true }`, `enableSourcing: false` e `ignoreMandatoryFields: false`. No modifica explicitamente otros campos ni usa N/email; esta limitacion del codigo no garantiza ausencia de efectos de workflows o scripts configurados en la cuenta.

Consulta nuevamente la bandera con `search.lookupFields` y exige `custbodyid_firma_rc === true` antes de devolver `{ status: 200, data: { type: "salesorder", id, approval: "formalization", approved: true, alreadyApproved: boolean } }`. Si no confirma, devuelve 502 FORMALIZATION_APPROVAL_UNCONFIRMED; excepciones de escritura o relectura posterior devuelven 502 FORMALIZATION_APPROVAL_OUTCOME_UNKNOWN. Estos fallos no afirman que la orden quedo sin modificar: consultar su estado antes de reintentar. El control exacto de Sandbox se aplica antes de cualquier lectura o escritura.

Estado de esta revision: implementacion y pruebas locales; pendiente subir el archivo a Sandbox y validar con una orden elegida expresamente. No se ejecuto ningun PUT real de aprobacion en Sandbox ni escritura en BD de produccion. La evidencia GET historica siguiente no valida este PUT ni demuestra que esta revision este desplegada.

Validacion real de solo lectura (2026-10-28): archivo actualizado en Sandbox, script 3353 / deploy 1. El cliente firmado devolvio status 200, ID 12014949, orden BC532, 79 campos y 5 lineas. La ficha CRM legacy:214 cargo la informacion y emitio [NetSuite: orden de venta]. Esto no prueba escrituras, aprobaciones ni datos nativos reales.

## Referencias oficiales

- [Anatomia SuiteScript 2.1](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1510274310.html): cabecera JSDoc, define y exportacion de entradas.
- [Entradas RESTlet](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4557203242.html): metodos disponibles.

Validacion local: `pnpm exec vitest run test/integrations/netsuite-restlet.spec.ts`.

## Lectura comercial

La allowlist explicita corresponde a netsuite-primary.ts. Numeros finitos se convierten a string, strings mantienen su precision y formato, booleanos conservan false; objetos, fechas crudas y otros valores no escalares se devuelven como null. Fechas y porcentajes usan getText; fecha proyectada de item e item_display usan getSublistText. No se serializa el record, ni se enumeran campos, credenciales, sesiones o CSRF. No se registran datos personales ni excepciones del proveedor.

Aliases estandar: cli/entity, Subsidaria/subsidiary, Departamento/department, Clase/class, Ubi/location, Oportunidad/opportunity, CREADO/createdfrom, vendedor/salesrep, socio/partner y CAMPANA/leadsource. METODO_PAGO/custbody75 esta confirmado por el mapper; FONDOS/custbody37 y MOTIVO_CANCE/custbody115 por el tramo legacy autorizado (ordenVenta.js, 500-650). Expediente usa getText de custbody38 y UNIDAD usa getText de custbodyix_exp_ligado_num_unid, confirmados expresamente por el propietario. MOTIVO_COMPRA queda null por falta de fuente confirmada. fields.initialtranid conserva el contrato frontend leyendo el campo real tranid; no se consulta initialtranid al proveedor.

Errores JSON: 404 SALES_ORDER_NOT_FOUND cuando el codigo del proveedor es RCRD_DSNT_EXIST; 400 INVALID_ID antes de cargar; 502 SALES_ORDER_READ_ERROR para fallos de lectura, sin detalle del proveedor ni resultados parciales; 422 ITEM_LINE_LIMIT_EXCEEDED si existen mas de 1000 items. Se admiten exactamente 1000; nunca se trunca. El guard de cuenta y entorno exactos permanece antes de toda carga.

Pruebas locales ejecutan el AMD real con mocks de N/runtime y N/record. No sustituyen validacion del proveedor, permisos del rol o disponibilidad de campos custom en la cuenta.

## Como seguir una peticion

`GET -> execute (logs) -> dispatch -> salesOrders.get -> readById -> getSalesOrderById -> JSON`.

- `dispatch` verifica Sandbox y selecciona un modulo registrado.
- `readById` valida el ID y convierte errores del proveedor en respuestas seguras.
- `getSalesOrderById` carga la orden, lee los campos de `SCHEMA` y arma el JSON que consume el CRM.
- GET/PUT se exportan al final. PUT sigue `execute -> dispatch -> salesOrders.put -> approveFormalization -> JSON`, conservando el unico log final centralizado.

Para agregar una accion de orden de venta, escribir su funcion en `SS2_1_LIB_CRM_OrdenesVenta.js` y registrarla en `put`; leads y estimaciones seguiran el mismo patron en su propio archivo. Los lectores compartidos no deben contener reglas exclusivas de una entidad. El esquema de lectura no concede permisos de escritura.

La reorganizacion local posterior a la prueba de Sandbox requiere volver a subir el archivo para verificarla alli; la evidencia historica de lectura no equivale a un despliegue de esta revision.

## Logs dentro de NetSuite

El modulo N/log emite una sola entrada `CRM_v2_good_flow: resultado` para respuestas controladas o `CRM_v2_bad_flow: resultado` ante excepciones inesperadas al finalizar cada peticion: Debug para resultados menores a 500 y Error para fallos 5xx o inesperados. Incluye `scriptVersion` (declarado en `lib/SS2_1_LIB_CRM_Logs.js`), modulo registrado, accion, ID interno NetSuite validado de la orden (si corresponde), estado de aplicacion, duracion en milisegundos y codigo interno de error cuando existe. No se registran parametros completos, JSON de la orden, datos de clientes, credenciales, mensajes ni stack del proveedor. Un fallo del logger no cambia la respuesta. No hay logs separados de inicio ni de consulta. Si la ejecucion es interrumpida por la plataforma antes de terminar, no se garantiza esta entrada final.

Ejemplo: `{ "scriptVersion": "2026.10.28.5", "module": "salesOrders", "action": "get", "netsuiteId": "12041495", "status": 200, "durationMs": 1330 }`.

Despues de subir esta revision a Sandbox, configurar temporalmente el nivel de registro del despliegue en Debug y consultar su registro de ejecucion. Con nivel Error solo se veran errores. Al terminar el diagnostico, volver a Error para reducir volumen. Estos logs corresponden a cada peticion, no al arranque de NestJS ni a cada carga del modulo. No se ha cambiado el despliegue desde este ajuste local.

## Preparar una entrega reproducible

Desde `apps/api`, ejecutar `pnpm netsuite:package`. El comando inspecciona estaticamente el grafo AMD, valida sintaxis, rechaza dependencias faltantes, circulares, externas o fuera de la carpeta y prepara un ZIP en `dist/netsuite/`. No ejecuta los scripts, no lee `.env` y no conecta con NetSuite. Usa TypeScript ya instalado para inspeccionar el AST y PowerShell de Windows para comprimir; no agrega dependencias.

El ZIP contiene `SuiteScripts/SS2_1_RL_CRM_Integracion.js`, `SuiteScripts/CRM TINK/lib/`, `SuiteScripts/CRM TINK/modules/` y `manifest.json` con version y SHA-256 por archivo. Rechaza archivos que cambien durante su copia. **Importar desde la RAIZ del Archivador**, con descomprimir y sobrescribir activados; no importar este paquete dentro de SuiteScripts ni de CRM TINK porque duplicaria esos niveles. El manifiesto no contiene rutas locales ni secretos. Las validaciones prueban coherencia local, no permisos ni compatibilidad efectiva en la cuenta.

Incrementar `SCRIPT_VERSION` al preparar cada entrega; modificar solamente una accion sin actualizar el logger impide identificar esa entrega de forma completa. Publicar primero los modulos de apoyo y la entrada al final al actualizar por separado. Una importacion ZIP no es atomica: evitar peticiones durante la actualizacion. Conservar el paquete anterior para restaurar los archivos si falla la lectura de comprobacion. Restaurar codigo no revierte cambios de datos.

El comando automatiza validacion y empaquetado, **no la publicacion**. SuiteCloud CLI/SDF sigue pendiente de configurar con autenticacion y destino Sandbox; este trabajo no instala credenciales ni cambia el despliegue remoto. Tras subir, comprobar una lectura y el `scriptVersion` del log antes de probar escrituras. El formato de 120 caracteres aplica a todos los `.js` de suitescript. Los prefijos RL/LIB identifican responsabilidades, no orden de ejecucion; conservar nombres evita romper importaciones.

## Concurrencia de aprobacion

La prueba local intercala dos peticiones que leen la misma aprobacion pendiente antes de escribir. Ambas pueden confirmar exito y ejecutar `submitFields`; el valor final sigue siendo true. Esto no garantiza una unica ejecucion de workflows externos. La comprobacion de requisitos y la escritura tampoco forman una operacion atomica: otro proceso puede cambiar las aprobaciones previas o marcar la orden como caida entre ambos pasos.

No se afirma exclusion mutua ni se agrega un bloqueo en memoria. Las pruebas con dobles documentan el limite; quedan pendientes pruebas reales controladas en Sandbox y una decision sobre coordinacion con los otros escritores antes de prometer atomicidad. El resultado desconocido tras escribir sigue requiriendo consultar NetSuite antes de reintentar.

Verificacion local: `pnpm exec vitest run test/integrations/netsuite-restlet.spec.ts test/integrations/netsuite-order.spec.ts test/integrations/netsuite-package.spec.mjs`. Los fixtures del empaquetador son carpetas temporales, nunca bases de datos.

## Entrega 2026.10.28.4

Actualizar en NetSuite `modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_AprobarFormalizacion.js` y `lib/SS2_1_LIB_CRM_Logs.js`. La entrada no cambia. Esta entrega incorpora comprobacion explicita de existencia antes de las casillas y reconoce el check ya marcado antes de exigir requisitos para una nueva escritura. El API conserva 404 y rechazos seguros; la vista usa alertas Ant Design con icono y notificacion de exito. `alreadyApproved` es metadato opcional de la respuesta CRM confirmada, no reemplaza la bitacora ni acredita por si solo una escritura local. No se ejecutan aprobaciones reales para verificar esta entrega.

## Entrega 2026.10.28.5 - reutilizacion de lectura (reemplazada por la refactorizacion 2026-10-30)

Historico: esta entrega leia las casillas con `loadRecord`. Desde la refactorizacion las lee con `lookupFlags` (`search.lookupFields`), que cuesta una fraccion de `record.load`. No llama al GET comercial completo porque construiria lineas, importes y aliases que el comando no necesita. Si escribe el check, usa lookupFlags solo para confirmar el valor persistido; la aprobacion hace un lookup inicial de las cuatro casillas; si ya estaba aprobada responde sin escribir ni releer, y si escribe, relee solo la casilla de Formalizacion.

Las validaciones comerciales no dependen de Sandbox ni produccion. La cuenta/destino se controla por separado en el enrutador y el cliente; esta refactorizacion conserva el gate Sandbox vigente, no habilita escrituras productivas. Los mensajes publicos mencionan el entorno configurado. Para desplegar esta entrega actualizar el archivo de aprobacion y el logger, sin cambiar la entrada ni la URL.

## Refactorizacion 2026-10-30 (orden, estructura y legibilidad; sin logica nueva salvo B1 y el arreglo de item)

Estructura final (18 archivos desplegables; las pruebas viven en `test/integrations/netsuite-suitescript/`, como exige AGENTS.md):

- Entradas: `SS2_1_RL_CRM_Integracion.js` (RESTlet) y `SS2_1_UE_CRM_CambiosRegistros.js` (User Event).
- `lib/`: Respuestas, Validacion, Campos, Registros, ErroresProveedor, ConsultarPorId, EjecutarAccion, Logs, Eventos, EnviarEvento y **Entorno** (nuevo: candado de Sandbox compartido por RL, Eventos y EnviarEvento).
- `modules/01_sales-orders/`: `OrdenesVenta.js` (GET, PUT approveFormalization y errores de la entidad, antes en 4 archivos), `OrdenesVenta_Campos.js` (esquema) y `OrdenesVenta_NotificarCambio.js` (separado a proposito: depende de N/https y el RESTlet no debe cargarlo).
- `modules/02_leads` y `modules/03_estimates`: reservados (501).

Eventos dinamicos: `EnviarEvento.sendRecordEvent(event, readSnapshot, endpoint)` es generico. El host es administrado (parametro o valor por defecto) y cada modulo declara su endpoint (`order-events` para ordenes; `lead-events`, `estimate-events`... cuando existan), validado con `^[a-z]+(-[a-z]+)*-events$`. Para sincronizar una entidad nueva: (1) lector de snapshot en su modulo, (2) su `NotificarCambio` con su endpoint, (3) registrar `afterSubmit` en el UE, (4) crear la ruta y el esquema en el receptor NestJS (fuera de esta carpeta; hoy solo existe `order-events`).

Contrato emisor-receptor (corregido): el GET entrega `sublists.item` como `{ "line 1": {...} }` (contrato del CRM), pero el receptor `order-events` exige un arreglo. `OrdenesVenta_NotificarCambio` adapta solo el snapshot del evento (`Object.values`, mismo orden); el GET no cambia. `tests/contract.spec.mjs` ejecuta el User Event real y valida el JSON con el controlador REAL de NestJS (solo lectura), y el recibo real vuelve al emisor.

Cambios de comportamiento aprobados:

- **B1 (BREAKING):** una excepcion inesperada en el RESTlet ya no se relanza; responde `{ status: 500, error: { code: "UNEXPECTED_ERROR", message } }` y registra `CRM_v2_bad_flow`. NestJS debe tratar `status: 500` como error de aplicacion en vez de esperar un HTTP 500 de NetSuite.
- La aprobacion usa `search.lookupFields` en lugar de `record.load` para leer las casillas. Pendiente de validar con una orden real de Sandbox.
- `SCRIPT_VERSION` = 2026.10.30.4.
- Se elimina `userEventVersion` de los logs del User Event; `scriptVersion` (Logs) es la unica version. Incrementarla en cada entrega.
- El limite de 500000 de `EnviarEvento` ahora cuenta bytes UTF-8, y un recibo `null` se reporta como `receipt_invalid`.

Pruebas (corren con `pnpm test`): `pnpm exec vitest run test/integrations/netsuite-suitescript test/integrations/netsuite-suitescript-audit.spec.mjs`. Cargan el AMD real con N/* simulados y verifican el numero de llamadas a la API de NetSuite; `contract.spec.mjs` valida el JSON con el controlador real de NestJS. Cobertura: anadir `--coverage --coverage.include="src/integrations/netsuite/suitescript/**/*.js"`. Lint: `eslint.config.mjs` tiene reglas propias para estos JS (AMD, `define` global).

Contratos emisor-receptor alineados (con prueba que ejecuta el receptor real):
- ID: maximo 15 digitos decimales canonicos. Es el contrato de este proyecto (el mismo limite del receptor), no un maximo de NetSuite; un ID mayor se rechaza (400 INVALID_ID) o, en eventos, no se emite.
- Texto: el receptor acepta hasta 16000 caracteres por valor. `EnviarEvento` no trunca informacion de negocio: si algun texto del snapshot lo supera, no envia y reporta `value_too_long` (nivel error en el log del User Event).
- Cuerpo: maximo 500000 bytes UTF-8 (`payload_too_large`).

Aprobacion y concurrencia: NetSuite no ofrece una escritura condicional, asi que leer los requisitos y escribir no puede ser atomico. Tras escribir, `approveFormalization` relee las cuatro casillas (1 unidad) y, si otro escritor marco la orden como caida o retiro un requisito en ese intervalo, responde `409 APPROVAL_STATE_CHANGED` en lugar de confirmar. Esto detecta el conflicto, no lo impide: la casilla ya quedo escrita y hay que revisar la orden en NetSuite. El cliente NestJS trata ese 409 como resultado desconocido. Una garantia estricta requeriria una validacion del lado de NetSuite (workflow o script del registro) fuera de este conjunto de archivos.

## Validacion pendiente en Sandbox (no se puede hacer desde el repositorio)

Antes de usar esta entrega, con el rol de integracion y datos acreditados:
1. GET de una orden existente: 200 con los campos esperados (el GET usa `record.load`; no prueba `lookupFields`).
2. `lookupFields` con un ID inexistente acreditado, sin escritura: PUT `approveFormalization` con ese ID. La lectura de casillas usa `lookupFields` y ocurre antes de cualquier escritura, asi que no puede modificar nada. Debe responder `404 SALES_ORDER_NOT_FOUND` (confirma que `lookupFields` lanza `RCRD_DSNT_EXIST`). Si responde `409 APPROVAL_PREREQUISITES_REQUIRED`, `lookupFields` devolvio campos vacios en vez de lanzar: hay que tratarlo en `OrdenesVenta.js`. Si responde 502, ajustar `ErroresProveedor`. Alternativa sin pasar por el RESTlet: Script Debugger con el rol de integracion ejecutando solo `search.lookupFields({ type: 'salesorder', id: '<ID inexistente>', columns: ['custbody43'] })`.
3. PUT de aprobacion sobre una orden elegida expresamente y revertible: 200; repetirlo debe responder `alreadyApproved: true` sin escribir.
4. PUT sobre una orden caida y otra sin aprobaciones previas: 409 en ambos casos.
5. Guardar una orden y revisar el registro de ejecucion del User Event: `received_local`, `scriptVersion` esperado.

# User Event global: entrega inicial histórica del 30/10/2026

La entrega local descrita al final sustituye el diagnóstico sin HTTP de este apartado.

Entrada nueva e independiente del RESTlet: `SS2_1_UE_CRM_CambiosRegistros.js`.
Ubicación en NetSuite: `/SuiteScripts/SS2_1_UE_CRM_CambiosRegistros.js`.
Nombre sugerido: **CRM_v2 - Cambios de registros hacia el CRM**.
ID sugerido: `customscript_crm_v2_cambios_registros`.

El archivo global solo enruta. `lib/SS2_1_LIB_CRM_Eventos.js` valida cuenta,
entorno, evento e identidad y genera un solo diagnóstico saneado. La acción de
orden de venta vive en `modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_NotificarCambio.js`.
Se reutilizan las librerías existentes de validación y logs. El RESTlet no cambia.

Esta entrega es **estructura y diagnóstico, no sincronización operativa**:
no tiene HTTP, cola, reintentos, endpoint receptor ni escrituras de negocio.
Una orden reconocida registraba `status: pending_api`, `delivered: false` y
`userEventVersion: 2026.10.30.1` (historico; el campo ya no existe, ver refactorizacion). Leads y estimaciones están reservados con
`module_pending`; no se los presenta como implementados. La asociación de
`partner` al catálogo real de corredores debe confirmarse antes de implementar
su acción; clientes/prospectos también requieren confirmar su clasificación.

Solo observa Sandbox `4552704_SB1`; otras cuentas y producción se omiten sin
operaciones. Se contemplan create/edit/xedit/approve/cancel/reject; delete queda
fuera porque necesita un contrato específico de baja. No lee campos del record
ni datos personales. Un error posterior al guardado se registra sin propagarlo.

Subir el paquete desde la raíz del Archivador, conservando las rutas, y crear
un registro de tipo User Event con esta entrada. Hace falta un despliegue por
tipo de registro. Dejar los despliegues desactivados hasta configurar su alcance;
no sustituir la entrada del RESTlet existente. Para observar estos logs en una
prueba posterior, usar nivel Depurar. Las pruebas locales no certifican eventos
reales ni entrega al API.

Pendiente siguiente: receptor autenticado, contrato versionado, campos ERP/CRM,
persistencia duradera y reintentos, deduplicación/orden de eventos, reconciliación
y actualizaciones auditadas en la fuente autoritativa. No serializar sin filtro
todo el registro ni crear columnas automáticamente a partir del payload.

## User Event → API local mediante ngrok (2026-10-30, versión 2026.10.30.2)

El corte actual **envía órdenes de Sandbox y confirma recepción local; no sincroniza BD**.
La entrada `/SuiteScripts/SS2_1_UE_CRM_CambiosRegistros.js` conserva solo `afterSubmit`.
La acción `modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_NotificarCambio.js` reutiliza
`getSalesOrderById`, de modo que `xedit` no envía únicamente sus campos parciales.
El transporte reutilizable vive en `lib/SS2_1_LIB_CRM_EnviarEvento.js`.

### Configuración y prueba

Prueba temporal autorizada 2026-10-30: `lib/SS2_1_LIB_CRM_EnviarEvento.js` usa
directamente la credencial local de Sandbox en la cabecera Authorization.
No requiere crear API Secret para esta prueba. No publicar ese archivo con la
credencial en Git ni usarlo en produccion; el responsable reemplazara esta
excepcion por API Secrets. El receptor sigue devolviendo `persisted:false`.
El paso 3 siguiente corresponde a esa configuracion definitiva.

1. API: `pnpm dev` en `apps/api`. El `.env` local usa `NODE_ENV=development`,
   `NETSUITE_LOCAL_EVENTS_ENABLED=true` y `NETSUITE_LOCAL_EVENTS_SECRET` exclusivo,
   aleatorio y de 64 caracteres hexadecimales. Nunca reutilizar OAuth, cookies o claves de BD.
2. Túnel: `ngrok http 3000`. Mantenerlo abierto. Destino configurado:
   `https://nontransgressively-sequential-leif.ngrok-free.dev/integrations/netsuite/local/order-events`.
3. NetSuite Sandbox: crear un **API Secret** con ID `custsecret_crm_local_events` cuyo
   valor sea el mismo de `NETSUITE_LOCAL_EVENTS_SECRET` del `.env`. Restringirlo al
   script `customscript_crm_v2_cambios_registros` y al dominio exacto del túnel.
   No subir `.env`, no pegar la clave en los JS ni compartirla por chat.
4. Subir el paquete actualizado desde la raíz del Archivador conservando las rutas.
   La entrada está fuera de `CRM TINK`; las dependencias dentro de `CRM TINK/lib` y `CRM TINK/modules`.
5. Mantener despliegue de Orden de venta en Pruebas y Depurar. Guardar manualmente una
   orden de Sandbox para verificar el flujo real, sin cambiar órdenes productivas.

La URL puede sustituirse con un parámetro de script de texto `custscript_crm_event_url`.
Es opcional; si no existe se usa la URL anterior. Solo admite HTTPS en `*.ngrok-free.dev`;
de ella solo se usa el host (una URL completa antigua sigue siendo valida). La ruta la declara cada modulo. Cuando cambie el túnel, actualizar el parámetro y
la restricción del API Secret. No usar este destino en producción.

### Contrato y autenticación

`POST /integrations/netsuite/local/order-events`, header `Authorization: Bearer <secreto>`.
Es una ruta sin sesión de navegador (`RouteSecurity(public)`) con guard propio de servicio;
**no es anónima**. CSRF solo se sustituye por la misma prueba de servicio en este método.
El resto de mutaciones BFF conserva CSRF. Producción no puede activar el receptor local.

Payload: `schemaVersion`, `source` (sistema, cuenta y entorno), `event` (tipo de registro,
ID, evento y fecha UTC de observación), `snapshot` (respuesta mapeada de lectura existente).
No se envía el record crudo ni campos de sesión/CSRF. La fecha es de observación, no un
historial exacto del ERP. Receptor limita estructura/tamaño, cuenta, entidad y coincidencia de ID.

Respuesta HTTP 200: `{ "schemaVersion": 1, "received": true, "persisted": false, "netsuiteId": "..." }`.
Solo esa confirmación con ID coincidente genera `received_local`/`delivered: true` en NetSuite.
Un HTML de ngrok, 4xx/5xx, JSON inválido o ID distinto nunca se toma como éxito.
El API registra ID, tipo, fecha y conteos; nunca el cliente completo ni la credencial.

### Límites

No hay escrituras en CRM_THINK_V2 ni crmdatabase-api, importaciones, outbox, reintentos ni
reconciliación. Un fallo de red se registra sin romper el guardado ya realizado en NetSuite;
puede perderse esa notificación. `https.post` es síncrono y añade latencia al guardado.
Leads y estimaciones siguen reservados. La prueba local con dobles y el túnel no sustituye
una edición real de Sandbox. La futura entrega duradera/productiva necesita su propio corte.

Referencias: [cabeceras con API Secrets](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_0111025229.html),
[ngrok](https://ngrok.com/docs/start).


### Comprobacion de los enlaces actualizados

Produccion: RESTlet3739/1 responde HTTP200/status403 ENVIRONMENT_NOT_AUTHORIZED.
El propietario confirma custscript_crm_account_id=4552704. La libreria local ahora
acepta ese parametro como texto o entero seguro, sin convertir objetos, booleanos
ni cuentas diferentes. Esto corrige una incompatibilidad reproducida con parametro
numerico; no demuestra el tipo real remoto ni la causa definitiva del403.
Sandbox: RESTlet3353/1 responde HTTP200/status200 y devuelve la orden pedida.
Se deben subir las correcciones de la libreria, incluido custbody37 crudo, a ambos
ambientes antes de declarar sincronizacion completa. No se verifico el User Event
mediante escrituras reales. La cuenta autorizada de Sandbox es4552704_SB1.

## Respaldo temporal de Produccion - 2026.11.03.4

Si custscript_crm_account_id falta (null, undefined o texto vacio), se usa la cuenta fija segun runtime.envType: PRODUCTION = 4552704, SANDBOX = 4552704_SB1. Un parametro configurado tiene prioridad y debe coincidir exactamente con runtime.accountId. Otras cuentas y entornos permanecen bloqueados. Las constantes temporales estan centralizadas en DEFAULT_ACCOUNTS y podra retirarse cuando se configure el deployment.


## Sincronizacion manual — version2026.11.03.4

GET `?module=salesOrders&id=<id>&action=syncSnapshot` devuelve la proyeccion completa de eventos, lineas como arreglo y sourceModifiedAt/snapshotReadStartedAt/snapshotReadCompletedAt. Reutiliza doble lectura y validacion de cambios del productor de eventos. GET normal mantiene su contrato de presentacion. Solo cambio la libreria unificada; conservar los mismos RESTlet/UserEvent y deployments.

La API exige la proyeccion verificada antes de escribir. Una libreria anterior devuelve la lectura comun sin metadatos y la API rechaza la sincronizacion sin actualizar la orden. Actualizar SuiteScripts/SS2_1_LIB_CRM_habita.js en el ambiente a probar. No basta desplegar el CRM para instalar esta capacidad en NetSuite.
# Aprobación de Formalización en Sandbox y producción — 2026-11-03

Este contrato vigente sustituye las restricciones históricas a Sandbox de los apartados anteriores.
La API permite ambos entornos, siempre con sesión, CSRF y el permiso efectivo
`formalizacion.orders.approve`; una denegación prevalece. El rol de integración TBA
de NetSuite debe poder editar órdenes de venta. El RESTlet no recibe roles CRM ni
confía en permisos enviados desde el navegador.

## Archivos que actualizar en NetSuite

Subir `SS2_1_LIB_CRM_habita.js` y `SS2_1_RL_CRM_Habita.js` a `/SuiteScripts/`,
conservando sus nombres y la dependencia absoluta de la entrada. La aprobación está
en la librería unificada; no crear los módulos antiguos citados en el historial.
`SS2_1_UE_CRM_Habita.js` no necesita cambios para esta acción.

En cada deployment mantener autenticación TBA, audiencia/rol de integración y
`custscript_crm_account_id` coherentes con la cuenta: `4552704_SB1` en Sandbox,
`4552704` en producción. La API selecciona URL y credenciales por su configuración
de servidor; el navegador no puede elegir el entorno. La URL productiva debe apuntar
a esta entrada compatible con PUT. Mantener el modo GET existente si todavía usa
el contrato histórico; no asumir compatibilidad GET legacy con la entrada nueva.

## Solicitud y modificación del cheque

```http
PUT <URL RESTlet configurada para el entorno>
Content-Type: application/json
Authorization: OAuth <firma TBA HMAC-SHA256>

{"module":"salesOrders","action":"approveFormalization","id":"123"}
```

`id` es el ID interno de NetSuite resuelto por el backend, no el número visible de
orden ni el ID del CRM. Antes de escribir se exige orden no caída (`custbody43`)
y aprobaciones previas `custbody_aprueba_jefe_ventas=true` y
`custbodyid_firma_rocca=true`. Si ya está aprobada y no caída responde sin escribir.
Desde la versión `2026.11.03.7` se inicia el workflow corporativo con sus acciones de Entrada, sin escritura directa del cheque:

Se importa `N/workflow`. La definición real revisada en producción (workflow interno553,
script ID customworkflow219) contiene un único Estado1 con18 acciones en Entrada:
aprobación, correos y creación de cuotas, entre otras. No tiene inicio automático
por Creación ni por Vista/Actualizar. El contexto RESTlet está permitido.
La llamada anterior `trigger` con stateId produjo
`INVALID_WORKFLOW_ACTION_1_IN_WORKFLOW_STATE_2`; no correspondía al inicio del flujo.

```js
workflow.initiate({
    recordType: "salesorder",
    recordId: id,
    workflowId: "customworkflow219",
});
```

No se envía stateId ni actionId: initiate entra al estado inicial definido por
SuiteFlow, donde se ejecutan sus acciones. No se encadena trigger, no hay fallback
a submitFields ni reintento automático. Si ya está aprobada no inicia otra instancia.
Un resultado desconocido requiere revisar el historial antes de repetir, porque el
flujo puede haber enviado correos o creado cuotas aunque no se haya confirmado el cheque.
Referencia: [Oracle workflow.initiate](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4344303916.html).

Después relee las cuatro casillas; solo confirma si el cheque quedó `true`, la orden
sigue no caída y los prerrequisitos siguen aprobados. Los workflows de la cuenta
pueden tener efectos propios; la validación y escritura de NetSuite no son atómicas.

Éxito confirmado (HTTP satisfactorio **y** este cuerpo):

```json
{"status":200,"data":{"type":"salesorder","id":"123","approval":"formalization","approved":true,"alreadyApproved":false}}
```

`alreadyApproved=true` indica que ya estaba marcado. Cuenta/entorno no autorizado:
403; orden inexistente: 404; caída o sin requisitos: 409; cheque no confirmado o
fallo después de escribir: 502 con resultado desconocido. No interpretar un HTTP200
de NetSuite como éxito sin validar el `status` de aplicación y todos los campos.

## Persistencia CRM y recuperación

Solo con confirmación válida, el CRM actualiza la fuente autoritativa: nativa
`crm_sales_order_approval` (`formalization/approved`) o legacy
`ordenventa.aprobacion_forma_ov=1`, nunca ambas. Registra auditoría y paso a
`contract_pending_send` cuando corresponde; conserva una etapa ya avanzada.
Si NetSuite confirmó pero falla el commit local, devuelve
`FORMALIZATION_APPROVAL_RECONCILIATION_REQUIRED`; reintentar la misma operación
permite reconciliar. Un timeout puede haber aprobado en NetSuite: consultar el
estado antes de reintentar. No hay rollback distribuido ni reintento automático.

Esta entrega está validada con dobles locales; requiere subir scripts y desplegar
la API. No acredita una aprobación real ni modifica órdenes por documentarla.

## Diagnóstico de errores del workflow — versión2026.11.03.6

El incidente de la orden NetSuite13320618 con versión2026.11.03.5 devolvió
FORMALIZATION_APPROVAL_OUTCOME_UNKNOWN. Ese log no conserva la excepción original:
no permite atribuir el fallo a permisos, instancia o estado sin evidencia adicional.
No se reejecutó el workflow ni se modificó la orden durante la investigación.

La versión2026.11.03.6 agrega una entrada N/log de nivel error con título fijo
`CRM: diagnostico aprobacion workflow`, fase `trigger` (llamada a N/workflow) o
`verify` (relectura), nombre técnico saneado del error y IDs de orden/workflow/estado.
No registra mensaje, stack, cuerpo de solicitud ni datos del cliente. La respuesta
pública permanece genérica y conserva el resultado desconocido. No se incorpora
fallback a initiate, submitFields ni reintento automático.

Actualizar solamente SS2_1_LIB_CRM_habita.js en NetSuite; RL no cambia. Primero revisar
el estado y el historial de la instancia afectada. Una ejecución posterior debe ser
controlada y autorizada, después de descartar que ya haya ejecutado sus acciones.
El diagnóstico nuevo solo existe desde esta versión; no reconstruye excepciones
que fueron descartadas por versiones anteriores.
