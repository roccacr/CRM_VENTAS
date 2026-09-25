# 30 - Identidad Canonica y Referencias Externas

## Veredicto

El CRM nuevo debe tener identidad propia para todas sus entidades.

Regla superior:

```txt
Las relaciones internas del CRM nunca se hacen por id de NetSuite, Odoo, legacy CRM, Kapso u otro proveedor.
```

Las relaciones internas siempre usan IDs internos del CRM:

```txt
sec_user.id_user
crm_lead.id_lead
crm_opportunity.id_opportunity
crm_estimate.id_estimate
crm_sales_order.id_sales_order
crm_contract.id_contract
```

Los IDs externos son aliases o referencias externas. No son llaves de negocio internas.

## Problema que resuelve

Hoy un vendedor, lead, oportunidad, estimacion u orden puede existir con un id de NetSuite.

Manana el mismo objeto puede existir en Odoo con otro id.

Tambien puede existir en un tercer proveedor con otro id distinto.

Si el CRM relaciona entidades por ids externos, queda atrapado al proveedor.

Ejemplo incorrecto:

```txt
crm_lead.owner_user_id = idnetsuite_admin
crm_sales_order.external_id = id de NetSuite como FK interna
```

Problemas:

- al migrar a Odoo cambian los ids;
- se rompe la relacion vendedor-lead;
- se rompe lead-oportunidad-estimacion-orden;
- aparecen duplicados;
- el frontend termina conociendo proveedores;
- la auditoria pierde claridad.

## Modelo correcto

El CRM manda internamente.

Ejemplo:

```txt
sec_user.id_user = 20
crm_lead.id_lead = 500
crm_opportunity.id_opportunity = 700
crm_estimate.id_estimate = 900
crm_sales_order.id_sales_order = 1200
```

Relaciones internas:

```txt
crm_lead.owner_user_id_lead -> sec_user.id_user
crm_opportunity.lead_id_opportunity -> crm_lead.id_lead
crm_estimate.opportunity_id_estimate -> crm_opportunity.id_opportunity
crm_sales_order.estimate_id_sales_order -> crm_estimate.id_estimate
crm_contract.sales_order_id_contract -> crm_sales_order.id_sales_order
```

IDs externos:

```txt
NetSuite lead id = 12345
Odoo lead id = 987
```

Ambos apuntan al mismo lead interno:

```txt
crm_lead.id_lead = 500
```

## Tablas de referencias externas

Las referencias externas genericas viven en:

```txt
int_external_system
int_external_reference
```

Para usuarios existe una tabla especializada:

```txt
int_user_external_identity
```

Motivo: usuarios tienen autenticacion, permisos, roles y trazabilidad de seguridad. Conviene documentar su crosswalk separado.

## int_external_reference

Proposito: relacionar una entidad interna del CRM con un id externo de cualquier proveedor.

Aplica para:

```txt
lead
opportunity
estimate
sales_order
contract
calendar_event
note
broker
campaign
project
```

Modelo logico:

```txt
id_external_reference
external_system_id_external_reference
internal_entity_type_external_reference
internal_entity_id_external_reference
external_entity_type_external_reference
external_id_external_reference
status_external_reference
metadata_external_reference
created_at_external_reference
updated_at_external_reference
```

Ejemplo para lead:

```txt
internal_entity_type = lead
internal_entity_id = 500
external_system = netsuite
external_entity_type = lead
external_id = 12345
```

Ejemplo para el mismo lead en Odoo:

```txt
internal_entity_type = lead
internal_entity_id = 500
external_system = odoo
external_entity_type = lead
external_id = 987
```

Resultado:

```txt
NetSuite 12345 -> crm_lead 500
Odoo 987 -> crm_lead 500
```

## Relacion vendedor-lead

Regla:

```txt
crm_lead.owner_user_id_lead siempre apunta a sec_user.id_user.
```

Nunca apunta a:

```txt
idnetsuite_admin
idodoo_user
external_user_id
```

Si llega un lead desde NetSuite con vendedor externo:

1. El API busca el vendedor en `int_user_external_identity`.
2. Resuelve el `sec_user.id_user`.
3. Guarda `crm_lead.owner_user_id_lead`.
4. Guarda o actualiza la referencia externa del lead en `int_external_reference`.

Si luego llega el mismo lead desde Odoo:

1. El API busca `int_external_reference` por sistema Odoo e id externo.
2. Si existe, actualiza el mismo `crm_lead`.
3. Si no existe, no mezcla a ciegas.
4. Solo vincula si hay una regla aprobada de reconciliacion.

## Regla de reconciliacion

No se debe relacionar automaticamente un registro externo con uno interno solo porque se parece.

Posibles senales para reconciliar:

- referencia externa ya existente;
- public id interno enviado por el CRM al proveedor;
- correo/telefono/documento con regla aprobada;
- match revisado por usuario autorizado;
- proceso de migracion controlado.

Regla:

```txt
Si no hay certeza, crear pendiente de relacion, no mezclar datos.
```

## Flujo de entrada desde proveedor externo

```txt
payload externo
-> adapter del proveedor
-> contrato canonico CRM
-> buscar int_external_reference
-> resolver entidad interna
-> crear/actualizar entidad CRM
-> guardar/actualizar int_external_reference
-> registrar auditoria/timeline si aplica
```

El proveedor externo no decide las FKs internas.

## Flujo de salida hacia proveedor externo

```txt
entidad CRM interna
-> contrato canonico CRM
-> mapper del proveedor activo
-> crear/actualizar en proveedor
-> guardar external_id en int_external_reference
-> no cambiar relaciones internas
```

Si NetSuite devuelve id `12345`, solo se guarda como referencia externa.

Si Odoo devuelve id `987`, solo se guarda como otra referencia externa.

## Reglas por entidad

### Usuario

```txt
sec_user.id_user = identidad interna
int_user_external_identity = ids externos por sistema
```

### Lead

```txt
crm_lead.id_lead = identidad interna
int_external_reference = ids externos del lead
```

### Oportunidad

```txt
crm_opportunity.id_opportunity = identidad interna
int_external_reference = ids externos de oportunidad
```

### Estimacion

```txt
crm_estimate.id_estimate = identidad interna
int_external_reference = ids externos de estimacion
```

### Orden de venta

```txt
crm_sales_order.id_sales_order = identidad interna
int_external_reference = ids externos de orden de venta
```

### Contrato

```txt
crm_contract.id_contract = identidad interna
int_external_reference = ids externos de contrato
```

## Prohibido

Queda prohibido:

- usar ids externos como FK interna;
- guardar `idnetsuite_*`, `idodoo_*`, `idlegacy_*` en tablas core;
- crear columnas core por proveedor;
- decidir permisos, vendedores o relaciones comerciales desde un id externo;
- mezclar dos registros por parecido sin regla aprobada;
- exponer ids internos autoincrementales al frontend;
- exponer nombres de proveedor en contratos publicos del frontend.

## Permitido

Esta permitido:

- guardar proveedores como datos en `int_external_system`;
- guardar ids externos en `int_external_reference`;
- guardar ids externos de usuarios en `int_user_external_identity`;
- tener carpetas `src/integrations/netsuite` y `src/integrations/odoo`;
- mapear proveedor externo a contrato canonico en adapters;
- tener varios ids externos para una misma entidad interna.

## Criterio de salida

Antes de crear cualquier migracion o modulo comercial:

- cada relacion interna debe usar ID interno del CRM;
- cada referencia externa debe ir a tabla `int_`;
- cada documento que mencione NetSuite/Odoo debe aclarar que son proveedores externos;
- ningun modelo nuevo debe depender de un id externo para unir vendedor, lead, oportunidad, estimacion, orden o contrato.
