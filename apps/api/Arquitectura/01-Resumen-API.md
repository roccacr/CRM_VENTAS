# 01 - Resumen API

## Veredicto

El backend del CRM debe construirse como monolito modular NestJS con arquitectura hexagonal. Su responsabilidad es proteger el dominio comercial, persistir datos propios, validar permisos, generar auditoria y desacoplar NetSuite, Odoo, Microsoft 365 y legacy CRM mediante adapters.

Estado de fase:

```txt
vision completa del API != alcance autorizado actual
```

`apps/api` tiene identidad BFF, Administracion, auditoria, seis catalogos editables y expedientes de unidades de solo lectura. Formalizacion incorpora persistencia interna de ordenes/historial y `GET /formalization/approvals/summary`, protegido por permiso efectivo. No hay API de mutaciones del ciclo de vida ni implementacion comercial completa de Leads/contratos. Corte documental: 2026-10-22; ver [registro de remediacion](Reauditoria-54-Plan-y-Resultados.md).

No significa login productivo listo. `SQL/003` ya fue aplicado y validado contra `CRM_THINK_V2`, `SQL/004` existe para Microsoft/cache/foto, y el primer owner Roberto ya fue creado por bootstrap controlado. El flujo local fue verificado con frontend y API levantados; para produccion siguen pendientes la aprobacion operacional de Entra ID/redirect URI oficial, el `jefe_general` real de negocio, el canal aprobado para entregar tokens de activacion/reset y la politica final de despliegue. Rate limit de refresh, lockout persistente, logger estructurado, decision de reuso y selector de cuenta Microsoft ya estan definidos.

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
- Login local por correo y clave; solicitud de recuperacion deshabilitada con 503 uniforme hasta configurar correo. Finalizacion con tokens existentes conserva su contrato.
- RBAC + ABAC para autorizacion.
- Roles multiples por usuario, permisos directos y denegaciones explicitas. Permisos delegados/revocables quedan para fase posterior, fuera de S1A.
- OpenAPI/Swagger opcional con `OPENAPI_ENABLED=true`, deshabilitado por default; el documento se genera desde los controladores registrados, no mediante una lista exclusiva de identidad.
- Logs JSON estructurados con redaccion de secretos/tokens/PII ya estan en API; OpenTelemetry queda como observabilidad futura.

## Responsabilidades del API

- Gestionar los dominios implementados indicados arriba, sin inferir autorizacion para completar verticales comerciales futuras.
- Mantener la base de datos propia del CRM.
- Exponer contratos HTTP versionados.
- Aplicar seguridad y permisos.
- Registrar auditoria tecnica y bitacora comercial.
- Outbox/inbox y reconciliacion automatica son direccion futura, no sincronizacion implementada.
- Leer legacy como fuente temporal bajo flag; escrituras de catalogos requieren compuerta independiente, entorno productivo, destino exacto y autorizacion. No se habilitan en desarrollo/pruebas.

## No responsabilidades

- No renderizar UI.
- No guardar estado visual.
- No depender de componentes frontend.
- No exponer tablas legacy directamente.
- No importar NetSuite/Odoo dentro de `src/modules/crm`.
