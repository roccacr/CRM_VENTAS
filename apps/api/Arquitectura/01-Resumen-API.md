# 01 - Resumen API

## Veredicto

El backend del CRM debe construirse como monolito modular NestJS con arquitectura hexagonal. Su responsabilidad es proteger el dominio comercial, persistir datos propios, validar permisos, generar auditoria y desacoplar NetSuite, Odoo, Microsoft 365 y legacy CRM mediante adapters.

Estado de fase:

```txt
vision completa del API != alcance autorizado actual
```

`apps/api` no tiene runtime NestJS activo. Solo existe un runner schema-only de migraciones para validar el esquema de identidad aprobado. El alcance autorizado actual es identidad: usuarios, autenticacion, areas/equipos, roles, permisos, referencias externas de usuarios y auditoria de seguridad. Leads y modulos comerciales vienen despues.

## Stack API

- NestJS + TypeScript.
- Fastify como HTTP adapter.
- MySQL como base nueva del CRM.
- Kysely + mysql2 como capa principal de acceso a datos.
- Sin Docker para runtime o base de datos, salvo decision explicita futura.
- Redis como opcion futura para cache operacional cuando exista una necesidad medida.
- RabbitMQ como opcion futura para jobs/eventos cuando el outbox en MySQL ya no sea suficiente.
- Microsoft Entra ID para autenticacion.
- Autenticacion alternativa por correo y clave mediante invitacion/reset seguro.
- RBAC + ABAC para autorizacion.
- Roles multiples por usuario, permisos directos y denegaciones explicitas. Permisos delegados/revocables quedan para fase posterior, fuera de S1A.
- OpenAPI/Swagger para contrato publico cuando el runtime sea aprobado.
- OpenTelemetry/logs JSON para observabilidad.

## Responsabilidades del API

- Gestionar identidad primero; leads, contactos, oportunidades, actividades, ordenes y contratos entran cuando su fase sea aprobada.
- Mantener la base de datos propia del CRM.
- Exponer contratos HTTP versionados.
- Aplicar seguridad y permisos.
- Registrar auditoria tecnica y bitacora comercial.
- Sincronizar sistemas externos por outbox/inbox.
- Leer legacy solo como fuente temporal.

## No responsabilidades

- No renderizar UI.
- No guardar estado visual.
- No depender de componentes frontend.
- No exponer tablas legacy directamente.
- No importar NetSuite/Odoo dentro de `src/modules/crm`.
