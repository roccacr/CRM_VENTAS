# Completar la conexión de NetSuite

## Archivos que debes subir

Paquete: [tres scripts unificados](../../apps/api/dist/netsuite/CRM_v2_2026.11.03.4_1793729769815.zip).

En **Producción y Sandbox**, sobrescribe estos tres archivos en `SuiteScripts/`:

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

1. Crea en NetSuite un **API Secret** con ID `custsecret_crm_habita_production`.
   Como valor utiliza el contenido de este
   [archivo privado](C:/codex-data/private/habita-netsuite-20261103/production-event-secret.txt).
   No envíes ese contenido por chat ni lo guardes en un archivo del proyecto.
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

Avísame cuando termines. Primero comprobaré mediante GET que Producción y Sandbox
devuelvan la orden y `fields.custbody37` (`1` Propios / `2` Financiado). Para
confirmar el envío del User Event hace falta observar un cambio legítimo en una
orden elegida para esa verificación; una consulta GET no dispara el evento.

El receptor rechaza eventos de otra cuenta/ambiente. Las comprobaciones HTTP con
cuerpo inválido verifican autenticación y disponibilidad, sin escribir órdenes;
no equivalen a una prueba real de sincronización desde NetSuite.


## Boton de sincronizacion manual (cambio local posterior)

La libreria2026.11.03.4 incorpora GET action=syncSnapshot; para esta ampliacion solo se reemplaza la libreria, no los wrappers RESTlet/UserEvent. El boton requiere tambien publicar el backend/frontend actuales. El despliegue del sistema anterior no incluia esta nueva funcion. No habilitar persistenciaSandbox contra una BD productiva compartida para probar el boton.
