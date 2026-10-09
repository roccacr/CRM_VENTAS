# 23 - Alcance Futuro Vertical Leads

## Veredicto

Este documento no autoriza construir leads mientras identidad, usuarios, roles, permisos, contrato canonico y modelo MySQL minimo no esten cerrados.

El primer desarrollo real actual del API es identidad.

Este documento conserva el alcance comercial de leads para la fase posterior.

Cuando identidad este cerrada y se apruebe runtime, este documento manda sobre documentos de vision para el primer corte comercial de leads.

## Decision vigente despues de Administracion

Leads no se construye todavia.

Antes de crear pantalla, tabla runtime nueva o endpoint operativo de leads, Administracion debe quedar validada con evidencia: usuarios, roles, permisos scoped, catalogos y auditoria.

Cuando Administracion quede cerrada, el primer trabajo de Leads sera contrato de integracion NetSuite -> API. Ese contrato debe responder:

- que evento de NetSuite dispara el envio;
- que payload llega al API nuevo;
- que campos son obligatorios;
- como se normalizan contacto, proyecto, campana, origen y responsable;
- como se manejan reintentos y fallos;
- como se evita o marca un duplicado;
- que auditoria/timeline queda cuando el actor es una integracion.

El CRM viejo solo puede consultarse en lectura para evidencia de campos, conteos y conceptos. Este documento no autoriza migracion historica ni escritura sobre datos reales.

## Objetivo

Construir el minimo flujo comercial que demuestra que la arquitectura funciona despues de identidad:

```txt
crear lead -> guardar contacto -> guardar lead -> crear estado operativo -> crear timeline -> auditar -> listar -> ver detalle
```

## Entra en slice comercial 1

1. Crear lead canonico desde el API.
2. Crear o reutilizar contacto basico.
3. Asignar responsable cuando venga informado o dejar pendiente si no existe.
4. Guardar estado comercial inicial.
5. Guardar estado operativo inicial: nuevo, sin requerir atencion.
6. Crear timeline `lead_created`.
7. Crear auditoria basica de creacion.
8. Listar leads con paginacion server-side.
9. Ver detalle basico del lead.
10. Responder siempre con JSON canonico.
11. Aplicar permiso minimo: usuario asignado ve lo suyo; jefatura/supervisor ve por alcance permitido.

## Entra en slice comercial 2

Slice comercial 2 se construye despues de que Slice comercial 1 funcione:

1. Motivos minimos de pausa y perdida.
2. Pausar lead con motivo y fecha futura.
3. Reactivar lead por fecha o accion autorizada.
4. Marcar lead perdido con motivo y explicacion.
5. Dashboard de leads nuevos y requieren atencion.
6. Drill-down de tarjetas del dashboard.

## Fuera de P0

No implementar en el primer corte:

- sincronizacion completa con ERP;
- worker real de NetSuite/Odoo;
- lectura dual del CRM viejo;
- migracion historica completa;
- formalizaciones;
- cobros;
- modificaciones;
- calendarios por dominio;
- notas adhesivas;
- delegaciones de permisos;
- denegaciones explicitas en UI;
- motor completo ABAC;
- RabbitMQ;
- Redis;
- reporteria ejecutiva avanzada.

## ERP en create lead

Esta seccion es futura y no habilita sincronizacion ni runtime ahora.

La decision P0 para el slice comercial, cuando se apruebe construirlo, es:

```txt
El lead se guarda primero en CRM_THINK_V2.
El vendedor no espera a NetSuite, Odoo ni otro ERP.
Si se requiere sincronizacion externa, se registra un evento outbox en MySQL.
Si el proveedor externo falla, el lead sigue creado y queda pendiente de sincronizacion.
```

Esto evita que un error externo bloquee la venta.

## Base de datos comercial minima futura

Para el slice comercial 1, las tablas realmente necesarias serian:

```txt
sec_user
sec_role
sec_permission
sec_user_role
sec_role_permission
crm_contacts
crm_projects
crm_campaigns
crm_lead_statuses
crm_leads
crm_lead_operational_state
crm_lead_action_types
crm_lead_action_reasons
crm_lead_timeline_entries
crm_lead_field_changes
crm_audit_logs
```

Opcional si se decide dejar preparado el camino de integracion:

```txt
int_external_system
int_external_reference
int_outbox_event
int_inbox_event
```

Tablas de calendarios, notas, brokers, delegaciones avanzadas y SLA policies pertenecen a fases posteriores aunque esten descritas como vision.

## Permisos comerciales minimos futuros

No construir leads antes de cerrar identidad.

El corte comercial de leads requiere como minimo:

| Accion | Quien |
| --- | --- |
| Crear lead | vendedor, supervisor, gerente, owner |
| Ver lead asignado | usuario asignado |
| Ver leads de equipo | supervisor, gerente, owner por alcance |
| Ver timeline | usuario con visibilidad del lead |
| Cambiar datos basicos del lead | usuario asignado o jefatura con permiso |

Grants directos, denials y delegaciones quedan como modelo aprobado para P1.

## Contrato canonico

La ley P0 es:

- OpenAPI manda.
- Frontend no inventa campos.
- API no devuelve estructuras legacy.
- API no expone nombres de proveedores externos.
- El mapper de proveedores vive en `src/integrations/*`, no en `src/modules/crm`.

## Criterio de listo

El slice comercial 1 esta listo cuando:

1. `POST /leads` crea lead, contacto, timeline y auditoria.
2. `GET /leads` lista con paginacion.
3. `GET /leads/{id}` devuelve detalle canonico.
4. No hay nombres de proveedor externo en DTOs publicos.
5. Typecheck y build pasan con pnpm desde `apps/api`.
