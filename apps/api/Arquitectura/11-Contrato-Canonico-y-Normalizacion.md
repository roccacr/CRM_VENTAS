# 11 - Contrato Canonico y Normalizacion

## Regla principal

El CRM nuevo debe hablar su propio lenguaje de negocio.

No se permite que el frontend, el dominio, los DTOs publicos ni las tablas core de la base nueva usen nombres de NetSuite, Odoo o legacy.

## Contrato canonico

El frontend envia un JSON estandar del CRM.

Ejemplo conceptual:

```json
{
  "nombre": "Cliente Ejemplo",
  "correo": "cliente@empresa.com",
  "telefono": "88888888",
  "proyectoId": 10,
  "campanaId": 25,
  "subsidiariaId": 3,
  "comentario": "Interesado en informacion",
  "origen": "web",
  "estadoInicial": "interesado"
}
```

Ese JSON no cambia si el proveedor externo es NetSuite, Odoo u otro.

El contrato canonico no usa ids externos para representar relaciones internas.

Regla:

```txt
relaciones internas = public_id o id interno canonico del CRM
ids externos = resolucion por adapters + tablas int_
```

Ejemplo:

```txt
ownerUserPublicId -> usuario interno del CRM
externalId -> solo vive en integracion/referencia externa, no en el contrato publico principal
```

La regla completa vive en `30-Identidad-Canonica-y-Referencias-Externas.md`.

## Flujo de creacion de lead

El lead puede nacer de dos formas:

1. Desde el CRM:
   - frontend envia JSON canonico;
   - API valida DTO;
   - API guarda lead normalizado en MySQL;
   - API registra auditoria/bitacora;
   - API sincroniza con ERP por adapter.

2. Desde ERP:
   - adapter recibe payload externo;
   - mapper convierte payload externo a contrato canonico CRM;
   - API valida/normaliza;
   - API guarda en MySQL;
   - API registra referencia externa.

## Donde vive cada cosa

```txt
Frontend
└── JSON canonico CRM

src/modules/crm
└── dominio canonico CRM

src/database
└── tablas normalizadas canonicas

src/integrations/netsuite
└── mapeo CRM -> NetSuite / NetSuite -> CRM

src/integrations/odoo
└── mapeo CRM -> Odoo / Odoo -> CRM
```

## Base de datos

La base de datos debe estar normalizada por defecto.

Reglas:

- nombres de tablas y columnas en lenguaje CRM;
- tablas catalogo para estados, tipos y origenes;
- relaciones con llaves claras;
- indices compuestos para filtros frecuentes;
- no repetir strings legacy como fuente de verdad;
- no crear columnas `netsuite_*`, `odoo_*` o equivalentes en tablas core;
- referencias externas mediante tablas genericas.

Ejemplo correcto:

```txt
int_external_system
int_external_reference
```

Uso correcto:

```txt
crm_lead.id_lead = identidad interna
int_external_reference = ids NetSuite/Odoo/terceros del lead
```

Ejemplo incorrecto:

```txt
crm_leads.netsuite_id
crm_leads.odoo_id
```

## Integraciones

El proveedor activo se decide por configuracion del backend, no por el frontend.

El core CRM invoca un puerto:

```txt
ERPIntegrationPort
```

El adapter activo traduce:

```txt
CRM -> NetSuite
CRM -> Odoo
NetSuite -> CRM
Odoo -> CRM
```

## Regla de mantenibilidad

Si una palabra de NetSuite/Odoo aparece en:

- frontend;
- DTO publico;
- tabla core;
- columna core;
- modulo `src/modules/crm`;

entonces el diseno esta mal.

Solo puede aparecer dentro de:

- `src/integrations/netsuite`;
- `src/integrations/odoo`;
- documentacion de integraciones;
- valores configurables de sistemas externos.
