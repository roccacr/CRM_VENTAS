# 04 - Integraciones Externas

## Excepciones implementadas y limites - 2026-10-27

La regla de contratos canonicos permanece para el dominio comercial. Existe una
excepcion explicita de inspeccion: `GET /formalization/orders/:source/:id/netsuite`
resuelve identidad/permiso CRM y devuelve `{schemaVersion, order, data}`, donde
`order` identifica la fuente/orden y referencia resuelta; `data` es la respuesta
de lectura del proveedor. No debe usarse como DTO comercial ni poblar tablas o
formularios del CRM. Solo la UI DEV presenta esa inspeccion en consola; la ruta
servidor se protege por permisos y no queda restringida a DEV por ese hecho.

Fuentes: `src/integrations/netsuite/netsuite.module.ts`,
`netsuite-sales-order.service.ts`, `netsuite-order.repository.ts` y
`netsuite-restlet.client.ts`. Se valida sesion, rol efectivo Formalizacion,
el permiso independiente «Ver orden de venta» antes del GET externo, según
[64 - Lectura de una orden](64-Formalizacion-Permiso-Ver-Orden.md). La lectura
no se restringe al vendedor propietario. Alias nativo prevalece incluso si impide
usar la orden; no se permite escoger una referencia externa desde el navegador.
URL/cuenta/script y metodo estan fijados en servidor; sin redirects, reintentos
ni escritura. Credenciales opcionales al arranque; faltantes producen 503 y
fallos externos 502 sanitizado. Plazo 15 s, cuerpo hasta 5 MiB. No se verificaron
credenciales ni se llamo al ERP durante esta revision documental.

Legacy tambien tiene escritores CRM acotados de Formalizacion registrados;
requieren fallback, escritura y auditoria habilitados, destino exacto y controles
transaccionales. Los seis escritores de catalogos conservan adicionalmente
`NODE_ENV=production`. No confundir ambas compuertas. Ver [52](52-Etapas-Responsables-y-Tiempos.md).
Odoo/Kapso, sincronizacion ERP, Graph Calendar y jobs siguen siendo blueprint.

## Objetivo

NetSuite es el ERP inicial. Odoo debe poder entrar despues sin tocar el core CRM.

Kapso, Microsoft 365, legacy CRM y cualquier otro proveedor externo tambien deben integrarse por adapters. El core CRM no debe depender directamente de SDKs, nombres de campos ni payloads de proveedores.

El contrato comercial publico y el JSON comercial enviado por el frontend son contratos estandar del CRM. La inspeccion de diagnostico descrita arriba es una excepcion separada; no autoriza nombres, campos ni estructuras ERP en DTOs/tablas de dominio.

El core CRM conserva identidad interna propia. NetSuite, Odoo u otro proveedor solo agregan referencias externas.

Regla:

```txt
las relaciones internas nunca usan ids del proveedor externo
```

Ver regla transversal en `30-Identidad-Canonica-y-Referencias-Externas.md`.

La carpeta de cada proveedor traduce el contrato CRM hacia el contrato externo:

```txt
CRM JSON canonico -> mapper NetSuite -> payload NetSuite
CRM JSON canonico -> mapper Odoo -> payload Odoo
CRM accion canonica -> mapper Kapso -> payload Kapso
```

Si en el futuro cambia el ERP, no cambia el frontend ni el dominio. Cambia el adapter.

## Puerto comun propuesto (blueprint)

Los puertos, adapters y modos ERP siguientes expresan direccion futura; no acreditan sincronizacion NetSuite/Odoo, mensajeria Kapso ni agenda Graph operativas. El codigo registrado hoy incluye identidad Microsoft/foto Graph y adapters legacy para lecturas autorizadas; el resumen de Mercadeo es lectura, sin copiar datos. Ver [49](49-Estado-Actual-y-Cierre-Documental.md).

```ts
export interface ERPIntegrationPort {
  createOrUpdateLead(input: CrmLeadUpsertInput): Promise<ExternalLeadRef>;
  createOrUpdateCustomer(input: CrmCustomerUpsertInput): Promise<ExternalCustomerRef>;
  createOrUpdateContact(input: CrmContactUpsertInput): Promise<ExternalContactRef>;
  createOrUpdateOpportunity(input: CrmOpportunityUpsertInput): Promise<ExternalOpportunityRef>;
  createQuote(input: CrmQuoteCreateInput): Promise<ExternalQuoteRef>;
  createSalesOrder(input: CrmSalesOrderCreateInput): Promise<ExternalSalesOrderRef>;
  getCustomerByExternalRef(externalRef: string): Promise<ExternalCustomerSnapshot | null>;
  healthCheck(): Promise<ErpHealthStatus>;
}
```

## Puerto comun de comunicaciones

Kapso debe tratarse como proveedor de comunicaciones, no como regla del dominio.

```ts
export interface CommunicationsIntegrationPort {
  sendWhatsappMessage(input: CrmWhatsappMessageInput): Promise<ExternalCommunicationRef>;
  sendEmail(input: CrmEmailMessageInput): Promise<ExternalCommunicationRef>;
  getDeliveryStatus(externalRef: string): Promise<ExternalDeliveryStatus | null>;
  healthCheck(): Promise<CommunicationProviderHealthStatus>;
}
```

Regla:

El modulo CRM emite una intencion canonica como `send_whatsapp_message`, `notify_note_mention` o `send_lead_follow_up`. El adapter activo decide si eso se envia por Kapso, correo, Microsoft 365 u otro proveedor.

## Adapters

```txt
src/integrations/
├── common/
│   └── ports/erp-integration.port.ts
├── netsuite/
│   ├── clients/
│   ├── dto/
│   ├── mappers/
│   └── netsuite.adapter.ts
├── odoo/
│   ├── clients/
│   ├── dto/
│   ├── mappers/
│   └── odoo.adapter.ts
├── kapso/
│   ├── clients/
│   ├── dto/
│   ├── mappers/
│   ├── webhooks/
│   └── kapso.adapter.ts
├── microsoft365/
└── legacy-crm/
```

## Modos ERP propuestos (no modos operativos acreditados)

| Modo | Uso |
|---|---|
| `netsuite` | Operacion inicial. |
| `odoo` | Operacion futura cuando Odoo sea ERP principal. |
| `shadow` | Escribir/validar Odoo sin afectar operacion. |
| `dual-read` | Comparar fuentes. |
| `dual-write` | Ventana controlada de migracion. |

## Reglas

- Crear lead debe existir como flujo de integracion: puede nacer desde CRM y sincronizarse al ERP, o puede entrar desde ERP y normalizarse hacia el CRM.
- El frontend nunca envia payloads con nombres de NetSuite/Odoo.
- El core CRM nunca guarda columnas con nombres de NetSuite/Odoo.
- El core CRM nunca relaciona vendedor, lead, oportunidad, estimacion, orden o contrato por id de NetSuite/Odoo.
- Las referencias externas se guardan en tablas genericas, asociadas a un sistema externo configurable.
- El adapter decide si el proveedor activo es NetSuite, Odoo u otro.
- Integracion externa asincrona cuando sea posible.
- Idempotencia obligatoria.
- Timeouts y retries.
- Logs sanitizados.
- Correlation id.
- Outbox para eventos salientes.
- Inbox para webhooks entrantes.

## Reglas Kapso y comunicaciones

- El frontend nunca importa clientes, SDKs ni payloads de Kapso.
- La base core no debe tener columnas llamadas `kapso_id`.
- Las referencias externas de Kapso viven en tablas `int_`, por ejemplo `int_external_reference`.
- Los webhooks entrantes viven en inbox y se procesan de forma idempotente.
- Un mensaje de WhatsApp enviado por accion de lead, nota, calendario o seguimiento debe generar timeline/auditoria.
- Las plantillas externas se mapean desde codigos canonicos del CRM.
- Si Kapso falla, el registro interno no se borra; queda pendiente, fallido o reintentable.
- Las respuestas del cliente pueden crear acciones canonicas del CRM, por ejemplo `customer_whatsapp_reply_received`.
