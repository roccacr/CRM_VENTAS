# Completar la conexión de NetSuite

## Corte del 10/11/2026

El release de Habita `20261109185625-63139a8-local` se confirmó el
09/11/2026. Su repositorio incluye SuiteScript `2026.11.03.7`. Publicar
Habita y actualizar archivos o parámetros de NetSuite son operaciones
separadas. El release del API no acredita qué versión está instalada en
el Archivador ni una prueba completa de eventos en Producción.

La biblioteca `2026.11.10.4` y el RESTlet que resuelve
`GET ?module=salesOrders&action=findByTranId&tranid=<numero>` son
cambios del árbol local. El RESTlet rechaza números inválidos, inexistentes
o ambiguos. La biblioteca proyecta `custbody_fecha_unidad_entregada`
cuando el campo está disponible. La persistencia de la proyección requiere
la [migración de esquema 074](../../apps/api/migrations/schema-only/202611100074_netsuite_order_delivery.ts)
en el CRM nativo, que registra el destino `native` o `legacy` sin
alterar el esquema legado. Revisar esa migración por separado antes de
habilitar el código que lee o escribe la proyección. El activador de
Habita no ejecuta migraciones.

## Archivos que debes subir

Desde `apps/api` y sobre el corte aprobado, ejecutar `pnpm netsuite:package:test`
y luego `pnpm netsuite:package`. Usar el ZIP generado en `dist/netsuite/` y
verificar en el manifiesto la versión y los SHA-256. El paquete de una revisión
anterior no acredita compatibilidad con un backend posterior.

El paquete unificado se importa desde la raíz del Archivador. Para la revisión
aprobada de cada entorno, conserva estos destinos dentro de `SuiteScripts/`:

- `SS2_1_LIB_CRM_habita.js`
- `SS2_1_RL_CRM_Habita.js`
- `SS2_1_UE_CRM_Habita.js`

Conserva los registros y deployments existentes. En Producción: librería del
Archivador `9625078`, RESTlet `3739/1` y User Event `3740` para Orden de venta.
La biblioteca corregida acepta el parámetro de cuenta como texto o entero válido
y envía el ID crudo de `custbody37`, además del texto `FONDOS`.

## Cuenta autorizada

En los deployments del **RESTlet y del User Event**, configura:

| Parámetro | Producción | Sandbox |
|---|---|---|
| `custscript_crm_account_id` | `4552704` | `4552704_SB1` |

Usa texto para que Sandbox conserve el sufijo `_SB1`. No uses el ID de una orden.
Si Producción sigue devolviendo `ENVIRONMENT_NOT_AUTHORIZED`, comprueba el
deployment `3739/1`, el archivo al que está enlazado y que la biblioteca recién
subida sea la de `/SuiteScripts/SS2_1_LIB_CRM_habita.js`.

## Envío de eventos de Producción hacia Habita

1. Usa el **API Secret** autorizado `custsecret_crm_habita_production`.
   Si hay que configurarlo, obtén el valor por el canal privado del operador
   y comprueba que corresponda al receptor de Producción. Mantén el valor
   fuera del repositorio, del paquete y de los logs.
2. Concede al User Event de Producción acceso al secreto y al dominio
   `api-habita.rdghub.com`.
3. En el deployment de Orden de venta del User Event `3740`, configura:

| Parámetro | Valor |
|---|---|
| `custscript_crm_account_id` | `4552704` |
| `custscript_crm_event_url` | `https://api-habita.rdghub.com/integrations/netsuite/production` |
| `custscript_crm_event_secret_id` | `custsecret_crm_habita_production` |

El script agrega `/order-events` a la URL base. No lo agregues dos veces.
El deployment debe permanecer liberado y asignado a Orden de venta.

## Sandbox

Su lectura conserva la cuenta `4552704_SB1` y el RESTlet `3353/1`; nunca usa la
URL ni las credenciales de Producción. Conserva su URL de recepción y API Secret
propios, sin copiar el secreto de Producción.

El backend local compartía la BD con Habita. Por eso su persistencia de eventos
Sandbox quedó apagada: `NETSUITE_LOCAL_EVENTS_PERSIST=false`. Las consultas siguen
funcionando. Para probar sincronización con escrituras en Sandbox primero debe
configurarse una base de pruebas aislada; no activar ese flag sobre la BD real.

## Verificación después de subir los archivos

Primero comprobar mediante GET que Producción y Sandbox devuelvan HTTP 200 y
`status:200` de aplicación, la orden y `fields.custbody37` (`1` Propios /
`2` Financiado). En el corte local nuevo, comprobar también la búsqueda por
número visible y la fecha de entrega cuando el campo esté disponible. Para
confirmar el envío del User Event hace falta observar un cambio legítimo en una
orden elegida para esa verificación; una consulta GET no dispara el evento.

El receptor rechaza eventos de otra cuenta/ambiente. Las comprobaciones HTTP con
cuerpo inválido verifican autenticación y disponibilidad, sin escribir órdenes;
no equivalen a una prueba real de sincronización desde NetSuite.


## Antecedente de sincronización manual del 03/11/2026

La biblioteca `2026.11.03.4` incorporó `GET action=syncSnapshot`. La
indicación de reemplazar solo la biblioteca correspondía a ese cambio
puntual. El corte local posterior también cambia el RESTlet. Para probar
persistencia de Sandbox, utilizar una base de pruebas aislada.
