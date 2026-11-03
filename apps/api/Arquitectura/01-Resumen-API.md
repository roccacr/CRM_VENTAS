# 01 - Resumen API

## Resumen vigente de código - 2026-11-02

El monolito NestJS registra Identidad/BFF, permisos, auditoría, siete catálogos,
resúmenes y comandos acotados de Formalización, dos reportes de Mercadeo,
Calendario compartido y Notas colaborativas. El inventario de rutas/servicios
está en [22](22-Mapa-de-Implementacion-API.md); los cortes inferiores conservan
su fecha, sin retirar ampliaciones posteriores.

Notas agrega vínculos autorizados a lead/orden sobre `crm_note_link` existente
([68 notas](68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md)); Calendario incluye
`GET /calendar/lookup`, participantes internos/correos y vínculos nativos/legacy
([68 calendario](68-Calendario-Participantes-y-Vinculos.md)). Ninguno concede
acceso al registro comercial por recibir una invitación. Mercadeo admite la
capacidad adicional `mercadeo.reports.read_all`, sin sustituir el permiso de vista
([69](69-Mercadeo-Lectura-Global.md)).

La aprobación de Formalización tiene escritura ERP acotada según
[63](63-Aprobacion-Formalizacion-NetSuite.md). Es diferente del receptor local
de eventos NetSuite, que solo valida y responde `persisted:false`; el escritor
de sincronización general del [plan70](70-Plan-Sincronizacion-Ordenes-NetSuite.md)
sigue pendiente. Las columnas locales057 no activan ese flujo. No hay CRUD HTTP
general de Leads/oportunidades/estimaciones, Outlook/Teams operativo ni copia de
notas a legacy. Esta revisión es estática, no aceptación de servicios externos.

## Runtime inspeccionado - 2026-10-27

`src/app.module.ts` registra tambien `ContractTransitionModule` y `NetsuiteModule`.
Existen seguimiento (`GET /formalization/home/follow-up`), trayectoria paginada
(`GET /formalization/orders/:source/:id/timing`), registro/reversion de envio y
selector de etapa (`POST /formalization/contracts/send`, `/revert` y
`POST /formalization/orders/stage`). Son comandos CRM autorizados, no envio de
correo ni escritura ERP. Conservan sesion, CSRF, permisos, alcance, aprobaciones,
version e idempotencia; firma confirmada condiciona etapas posteriores.
La consulta NetSuite es una inspeccion GET autorizada por identidad CRM; no es
sincronizacion. [52](52-Etapas-Responsables-y-Tiempos.md) detalla esos limites.

Mercadeo registra Inicio y Captacion como contratos independientes de solo lectura:
`GET /marketing/home/summary` y `GET /marketing/leads/report`. Ambos consultan
nativo primero y legacy opcional sin copiar registros. El menu Eventos y citas y
su permiso fueron retirados por migracion 038; Calendario y las metricas de citas
se conservan. Ver [53](53-Captacion-Leads-Reporte-Federado.md).
Esta revision acredita codigo y documentacion, no una nueva operacion de BD,
prueba funcional, despliegue o verificacion de credenciales.

## Veredicto

El backend del CRM debe construirse como monolito modular NestJS con arquitectura hexagonal. Su responsabilidad es proteger el dominio comercial, persistir datos propios, validar permisos, generar auditoria y desacoplar NetSuite, Odoo, Microsoft 365 y legacy CRM mediante adapters.

Estado de fase (con ampliaciones posteriores detalladas en este documento):

```txt
vision completa del API != alcance autorizado actual
```

`apps/api` tiene identidad BFF, Administracion, auditoria, catalogos y expedientes de unidades de solo lectura. Al 2026-10-23, `src/app.module.ts` registra los resumenes de aprobaciones, contratos y etapas de Formalizacion, ademas de `GET /marketing/home/summary` para agregados de leads y citas con permiso `mercadeo.home.read`. Existe lectura de timeline nativo por auditoria; no CRUD HTTP general de Leads. Ese corte historico fue ampliado el 2026-10-26 para seguimiento y comandos acotados de Formalizacion descritos abajo. Esquemas nativos de Leads y calendario no equivalen a esas operaciones. Inventario y limites: [49 - Estado actual](49-Estado-Actual-y-Cierre-Documental.md).

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
