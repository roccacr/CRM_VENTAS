# 06 - ADRs API

## ADR-API-001 - Backend NestJS

Estado: aprobado.

Decision: usar NestJS + TypeScript + Fastify.

Motivo: modularidad, DI, guards, pipes, testing y estructura enterprise.

## ADR-API-002 - MySQL + Kysely

Estado: aprobado.

Decision: usar MySQL como base nueva del CRM y Kysely + mysql2 como capa principal de acceso a datos.

Motivo: el entorno del negocio ya trabaja con MySQL y existen credenciales/operacion alrededor de este motor. El CRM requiere consultas pesadas, joins, filtros dinamicos, reportes, paginacion server-side, transacciones y updates masivos con control fino del SQL. Kysely mantiene tipado fuerte sin ocultar el SQL.

Reglas:

- usar mysql2 como driver;
- usar Kysely en repositories;
- usar SQL raw solo cuando sea mas claro o necesario, siempre parametrizado;
- no usar Prisma como ORM principal;
- no usar Docker para runtime o base de datos salvo decision explicita futura;
- disenar con InnoDB, indices compuestos, columnas fuertes para datos criticos y JSON solo para metadata controlada.

## ADR-API-003 - ERP por adapters

Estado: aprobado.

Decision: NetSuite, Odoo y legacy CRM viven fuera del core y entran por puertos.

Motivo: poder migrar NetSuite -> Odoo sin reescribir dominio.

## ADR-API-004 - Outbox/inbox

Estado: aprobado.

Decision: toda integracion critica usa outbox/inbox.

Motivo: idempotencia, reintentos y trazabilidad.

## ADR-API-005 - Legacy solo temporal

Estado: aprobado.

Decision: la base vieja no sera fuente principal del nuevo CRM.

Motivo: no copiar deuda tecnica al nuevo modelo.

## ADR-API-006 - Permisos efectivos por roles y excepciones directas

Estado: aprobado.

Decision: la autorizacion no sera RBAC simple. Un usuario puede tener multiples roles, permisos directos y denegaciones explicitas.

Motivo: el negocio necesita agregar o quitar permisos puntuales a una persona sin crear roles infinitos ni cambiar el rol completo.

Regla: las denegaciones explicitas del usuario ganan sobre permisos por rol y permisos directos.

Implementacion conceptual aprobada para P0-S1:

- `sec_user.permission_version_user` cambia cuando cambian roles, areas, overrides o estado del usuario;
- `sec_auth_session.permission_version_auth_session` guarda la version al emitir la sesion;
- el guard de autorizacion debe validar la version actual antes de permitir acciones sensibles;
- `sec_user_permission_override` modela permisos personales `allow` y `deny`;
- `audit_security_event` registra cada cambio sensible.

Delegacion temporal avanzada queda prevista para fase posterior y fuera de P0-S1A.

Referencia: `31-Contrato-Identidad-y-Permisos-P0-S1.md`.

## ADR-API-007 - P0 sin legacy en flujo principal

Estado: aprobado.

Decision: en P0 los leads nuevos nacen solo en la base nueva `CRM_THINK_V2` y el flujo principal no consulta el CRM viejo.

Motivo: reducir riesgo y evitar mezclar deuda legacy antes de tener el flujo nuevo estable.

P1 podra agregar lectura del CRM viejo mediante adapter, devolviendo siempre un JSON estandar al frontend.

## ADR-API-008 - Contrato canonico CRM sin nombres de ERP

Estado: aprobado.

Decision: el frontend y el core API usaran un contrato canonico del CRM. No se aceptan nombres NetSuite/Odoo en DTOs publicos, modelos de dominio ni tablas/columnas core.

Motivo: permitir que el CRM funcione con NetSuite hoy y Odoo manana sin cambiar frontend, dominio ni base core.

Reglas:

- el frontend envia un JSON estandar del CRM;
- el API guarda datos normalizados en tablas canonicas;
- `src/integrations/netsuite` mapea del contrato CRM al payload de NetSuite;
- `src/integrations/odoo` mapea del mismo contrato CRM al payload de Odoo;
- referencias externas se modelan con tablas genericas;
- NetSuite/Odoo pueden existir como valores configurables de sistemas externos, pero no como nombres de columnas/tablas core.

## ADR-API-009 - Identidad canonica interna y referencias externas

Estado: aprobado.

Decision: todas las relaciones internas del CRM usan ids propios del CRM. Los ids de NetSuite, Odoo, legacy CRM, Kapso u otros proveedores se guardan solo como referencias externas en tablas `int_`.

Motivo: permitir que un mismo vendedor, lead, oportunidad, estimacion, orden o contrato tenga varios ids externos sin romper relaciones internas ni duplicar datos cuando cambie el proveedor.

Reglas:

- `crm_lead.owner_user_id_lead` apunta a `sec_user.id_user`;
- `crm_opportunity.lead_id_opportunity` apunta a `crm_lead.id_lead`;
- `crm_estimate.opportunity_id_estimate` apunta a `crm_opportunity.id_opportunity`;
- `crm_sales_order.estimate_id_sales_order` apunta a `crm_estimate.id_estimate`;
- `crm_contract.sales_order_id_contract` apunta a `crm_sales_order.id_sales_order`;
- ids externos de usuarios viven en `int_user_external_identity`;
- ids externos de entidades comerciales viven en `int_external_reference`;
- si no hay certeza para reconciliar un registro externo, queda pendiente de relacion y no se mezcla a ciegas.

## ADR-API-010 - Normalizacion obligatoria de base de datos

Estado: aprobado.

Decision: la base nueva debe normalizarse por defecto. El diseno debe priorizar legibilidad, relaciones claras, catalogos, llaves foraneas, indices y nombres de dominio limpios.

Motivo: evitar repetir la deuda del CRM actual, mejorar consultas, joins, filtros, reportes y mantenimiento.

Excepciones: se permite denormalizar solo cuando exista una razon medida o una necesidad clara de performance, documentada en ADR o nota de migracion.

Referencia obligatoria para P0: `12-Modelo-Datos-P0-MySQL-Kysely.md`.
