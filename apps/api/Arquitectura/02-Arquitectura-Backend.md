# 02 - Arquitectura Backend

## Estado de fase

Esta arquitectura describe el destino del API cuando se apruebe construir runtime.

Estado actual:

```txt
apps/api tiene runtime minimo de identidad autorizado; modulos comerciales e integraciones operativas siguen prohibidos
```

El primer modulo real aprobado es identidad. Los modulos comerciales de leads, oportunidades, estimaciones, ordenes, calendarios, notas e integraciones operativas vienen despues.

Las carpetas de integracion pueden existir como frontera fisica, pero no autorizan clientes, adapters, jobs, DTOs operativos ni sincronizaciones hasta que la ley `00-Producto-CRM-TINK-y-P0.md` apruebe ese corte.

## Patron principal

Monolito modular + DDD + arquitectura hexagonal.

```txt
HTTP Controllers
      |
Application Services / Use Cases
      |
Domain Rules
      |
Ports
      |
Adapters: Kysely/mysql2, NetSuite, Odoo, Microsoft 365, Kapso, Legacy CRM
```

## Estructura esperada futura

```txt
src/
├── modules/
│   └── crm/
│       ├── sales/
│       │   ├── leads/
│       │   ├── opportunities/
│       │   ├── estimates/
│       │   └── sales-orders/
│       ├── formalizations/
│       ├── collections/
│       ├── modifications/
│       ├── management/
│       ├── customer-journey/
│       ├── documents/
│       ├── calendar/
│       ├── notes/
│       ├── communications/
│       ├── reporting/
│       ├── identity/
│       ├── permissions/
│       ├── audit/
│       └── configuration/
├── integrations/
│   ├── common/
│   │   └── ports/
│   ├── netsuite/
│   ├── odoo/
│   ├── microsoft365/
│   ├── kapso/
│   └── legacy-crm/
├── database/
├── config/
├── common/
└── jobs/
```

## Regla de aislamiento

`src/modules/crm` solo puede depender de puertos comunes. No puede importar:

- `src/integrations/netsuite`
- `src/integrations/odoo`
- `src/integrations/legacy-crm`
- `src/integrations/kapso`
- `src/integrations/microsoft365`

Separacion obligatoria:

| Carpeta | Responsabilidad | Regla de desconexion |
|---|---|---|
| `src/database` | Conexion y tipos para `CRM_THINK_V2`. | No conoce CRM viejo, NetSuite, Odoo ni Kapso. |
| `src/modules/crm/**` | Dominio, casos de uso y repositories del CRM nuevo. | Solo habla contratos canonicos y puertos. |
| `src/integrations/legacy-crm` | Extraer datos del CRM viejo y traducirlos a contratos canonicos. | Si el viejo se apaga, se elimina este adapter sin tocar core. |
| `src/integrations/netsuite` | Enviar/recibir payloads NetSuite y mapear errores/respuestas. | Si cambia el ERP, se desconecta aqui. |
| `src/integrations/odoo` | Preparar convivencia/migracion futura hacia Odoo. | Puede activarse sin renombrar core ni frontend. |
| `src/integrations/kapso` | Mensajeria, WhatsApp, templates y webhooks Kapso. | No puede ser llamado directo por React. |
| `src/integrations/microsoft365` | Entra ID, Graph y calendario externo. | No decide reglas CRM; solo adapta proveedor. |
| `src/integrations/common/ports` | Interfaces que el core conoce. | No contiene implementaciones concretas. |

Nueva regla para cualquier proveedor futuro:

```txt
Proveedor nuevo = carpeta nueva en src/integrations/<proveedor> + port comun si aplica + mapper canonico. Nunca se mete dentro del core.
```

Regla de conexion legacy:

```txt
DB_NAME no cambia. CRM_THINK_V2 usa src/database. El CRM viejo usa src/integrations/legacy-crm con LEGACY_CRM_DB_NAME.
```

Cuando el CRM viejo vive en el mismo servidor MySQL, el adapter legacy puede reutilizar `DB_HOST`, `DB_PORT`, `DB_SSL` y `DB_SSL_CA`; las credenciales deben ser `LEGACY_CRM_DB_USER` y `LEGACY_CRM_DB_PASSWORD`, separadas del usuario principal del CRM nuevo. Si `LEGACY_CRM_DB_NAME` queda vacio, la conexion legacy no abre pool. El pool legacy marca cada conexion con `SET SESSION TRANSACTION READ ONLY`, como guardrail adicional al usuario MySQL de solo lectura. Para retirarlo luego: borrar `src/integrations/legacy-crm`, quitar su import en `AppModule` y borrar `LEGACY_CRM_*`.

## Controllers

Solo reciben request, validan DTOs y llaman casos de uso. No contienen queries, mapeos ERP ni reglas comerciales profundas.

## Use cases

Contienen flujo de aplicacion:

- identificar usuario actual;
- validar sesion BFF;
- calcular permisos efectivos;
- registrar auditoria de seguridad;
- crear lead;
- asignar vendedor;
- cambiar estado;
- registrar actividad;
- crear oportunidad;
- solicitar sincronizacion ERP.

Regla de carpeta:

- leads vive en `src/modules/crm/sales/leads`;
- oportunidades vive en `src/modules/crm/sales/opportunities`;
- estimaciones vive en `src/modules/crm/sales/estimates`;
- ordenes de venta vive en `src/modules/crm/sales/sales-orders`;
- formalizaciones no se mezcla con ventas; vive en `src/modules/crm/formalizations`;
- calendario transversal vive en `src/modules/crm/calendar`;
- notas transversales viven en `src/modules/crm/notes`;
- permisos y auditoria viven separados de los modulos de negocio.

## Adapters

Contienen detalles externos:

- Kysely/mysql2.
- NetSuite.
- Odoo.
- Microsoft Graph.
- Kapso.
- MySQL legacy.

Cada adapter debe tener DTOs, cliente, mapper y errores propios cuando sea aprobado. Ningun adapter puede exportar payloads externos como contrato publico del API.
