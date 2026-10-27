# 11 - Contrato Canonico y Normalizacion

## Contratos implementados que complementan el blueprint - 2026-10-27

[22](22-Mapa-de-Implementacion-API.md) inventaria las rutas registradas y sus
archivos de contrato. Captacion devuelve agregados diarios y catalogos canonicos
con IDs estables, fuente y calidad; no serializa contactos de clientes.
Seguimiento devuelve una proyeccion autorizada de orden, no una fila legacy.
`clientEmail` se normaliza a correo valido o null para abrir Outlook web, no para
enviar correo. Etapas aceptan `source`, `id`, version, `operationId` y destino
segun DTO; no aceptan flags ERP de aprobacion/firma ni actor arbitrario.

La inspeccion NetSuite es una excepcion de lectura de diagnostico a la regla
siguiente: su `data` contiene JSON del proveedor y permanece fuera del contrato
comercial canonico. Referencia resuelta por servidor, no relacion interna ni
identidad aportada por el navegador. Limites y seguridad en [04](04-Integraciones-ERP.md).

## Regla principal

El CRM nuevo debe hablar su propio lenguaje de negocio.

No se permite que el dominio, los DTOs comerciales publicos ni las tablas core de la base nueva usen nombres de NetSuite, Odoo o legacy. La inspeccion de diagnostico separada descrita arriba no cambia esa regla comercial.

## Contrato canonico

El frontend envia un JSON estandar del CRM.

Ejemplo conceptual historico, no DTO HTTP vigente ni instruccion de crear Leads. Los nombres y numeros ilustrativos no sustituyen `projectPublicId`, `campaignPublicId` y demas campos del contrato futuro [25](25-Contrato-Canonico-Minimo-Lead-P0-S1.md). Las relaciones API usan identidad publica nativa; un ID ERP no se acepta como PK interna:

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
ids externos = resolucion por adapters + tabla de referencias propia de la entidad
```

Ejemplo:

```txt
ownerUserPublicId -> usuario interno del CRM
externalId -> solo vive en integracion/referencia externa, no en el contrato publico principal
```

La regla completa vive en `30-Identidad-Canonica-y-Referencias-Externas.md`.
Una referencia se resuelve por sistema configurado e ID externo, nunca por el
numero solo. Identidad usa `int_user_external_identity`; Leads usa
`crm_lead_external_reference`. El prefijo `int_` no es obligatorio para todas
las referencias y `int_external_reference` es un concepto del blueprint.

## Flujo futuro de creacion de lead (sin endpoint habilitado)

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
