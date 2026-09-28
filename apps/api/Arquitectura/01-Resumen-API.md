# 01 - Resumen API

## Veredicto

El backend del CRM debe construirse como monolito modular NestJS con arquitectura hexagonal. Su responsabilidad es proteger el dominio comercial, persistir datos propios, validar permisos, generar auditoria y desacoplar NetSuite, Odoo, Microsoft 365 y legacy CRM mediante adapters.

Estado de fase:

```txt
vision completa del API != alcance autorizado actual
```

`apps/api` ya tiene runtime NestJS autorizado solo para identidad. El alcance vigente es API de identidad: usuarios, autenticacion BFF, areas/equipos, roles, permisos, referencias externas de usuarios, auditoria de seguridad, login local preparado, refresh rotation y CSRF firmado. Leads y modulos comerciales vienen despues.

No significa login productivo listo. `SQL/003` ya fue aplicado y validado contra `CRM_THINK_V2`, y el primer owner Roberto ya fue creado por bootstrap controlado. Antes de activar login real faltan `jefe_general` real de negocio, Microsoft real con Entra ID y cache MSAL cifrado persistente en servidor, canal aprobado para entregar tokens de activacion/reset y frontend autorizado. Rate limit de refresh, lockout persistente, logger estructurado y decision de reuso ya estan definidos en API.

## Stack API

- NestJS + TypeScript.
- Fastify como HTTP adapter.
- MySQL como base nueva del CRM.
- Kysely + mysql2 como capa principal de acceso a datos.
- BFF con cookies opacas; el frontend no recibe access token JWT en JSON.
- Sin Docker para runtime o base de datos, salvo decision explicita futura.
- Redis como opcion futura para cache operacional cuando exista una necesidad medida.
- RabbitMQ como opcion futura para jobs/eventos cuando el outbox en MySQL ya no sea suficiente.
- Microsoft Entra ID para autenticacion.
- Autenticacion alternativa por correo y clave mediante invitacion/reset seguro.
- RBAC + ABAC para autorizacion.
- Roles multiples por usuario, permisos directos y denegaciones explicitas. Permisos delegados/revocables quedan para fase posterior, fuera de S1A.
- OpenAPI/Swagger solo para contrato de identidad cuando `OPENAPI_ENABLED=true`.
- Logs JSON estructurados con redaccion de secretos/tokens/PII ya estan en API; OpenTelemetry queda como observabilidad futura.

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
