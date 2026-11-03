## Corte vigente — 2026-11-03

Revisión documental del árbol de trabajo de `temp/crm-tink-api-frontend-inicial`,
con base en HEAD `4d446ed`. Incluye cambios locales; no acredita publicación.

- NetSuite v2 dispone de escritor transaccional nativo primero y legacy solo en
  ausencia de autoridad nativa, recibos/cursor, snapshot y auditoría. v1 mantiene
  `persisted:false`. La ampliación de campos está en [75](Arquitectura/75-Matriz-Campos-Ordenes-NetSuite.md)
  y la evidencia real acotada de diez indicadores en [73](Arquitectura/73-Sincronizacion-Estados-Ordenes-NetSuite.md).
- Contratos usa aprobación de Formalización; la acción que otorga esa aprobación
  conserva sus prerrequisitos independientes. Origen de fondos, ocho etapas y
  combinaciones confirmadas de cierre están en [78](Arquitectura/78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md).
  Eventos NetSuite `edit`/`xedit` pueden avanzar visitas finales existentes según
  esos indicadores; no hay retroceso automático ni etapas inventadas al consultar.
- Microsoft 365 tiene adaptador y endpoints conectados para agenda propia,
  disponibilidad, salas, invitaciones y Teams, condicionados a sesión Microsoft,
  permisos CRM y consentimiento: [64](Arquitectura/64-Calendario-Global-API-y-Contexto.md).
  Implementación no equivale a aceptación externa con cuenta real.
- El adéndum es un marcador independiente de la etapa, con versión y nota manual;
  calendario conserva orden/cliente fijos y bloquea otro adéndum futuro.
  Contratos funcionales/esquema: [83](Arquitectura/83-Adendum-Migracion-065-y-Rollback.md) y
  [84](Arquitectura/84-Adendum-Manual-Migracion-066-y-Permisos.md), incluida la corrección067.

Los cortes inferiores conservan cronología y resultados de su fecha. Este corte
prevalece para inventario actual; no autoriza migraciones, escrituras, cambios de
credenciales, publicación ni despliegue. No se vuelven a ejecutar suites por editar documentación.

## Actualización autorizada posterior — 2026-11-02

La implementación local v2 de sincronización de los diez indicadores está descrita en [73](Arquitectura/73-Sincronizacion-Estados-Ordenes-NetSuite.md). Existe escritor con auditoría central y de recepción; v1 sigue sin persistir. 058 fue aplicada al servidor compartido con aprobación explícita el2026-11-02; ledger y tablas verificados. Persistencia deshabilitada por defecto. Los bloques inferiores conservan el estado anterior a esta implementación. No ejecutar migraciones de producción ni publicar por leer estas notas.

# AGENTS.md - CRM Enterprise API

## Precedencia del inventario - 2026-11-02

Revisión del checkout, incluidos los cambios locales aún sin commit. El runtime
actual incluye Notas con vínculos de negocio ([68](Arquitectura/68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md)),
Calendario con lookup/participantes/vínculos ([68 calendario](Arquitectura/68-Calendario-Participantes-y-Vinculos.md))
y lectura global opcional de Mercadeo ([69](Arquitectura/69-Mercadeo-Lectura-Global.md)).
La autorización por recurso, sesión/CSRF, autoría y deny siguen siendo independientes.

El runner local registra 55 migraciones: 001, 003–025 y 027–057. La 057 y su
CLI legacy son cambios locales, no prueba de publicación; sus siete indicadores
operativos no mueven etapas ni activan una sincronización. El receptor de eventos
NetSuite sigue acusando `persisted:false`; el escritor durable del
[plan70](Arquitectura/70-Plan-Sincronizacion-Ordenes-NetSuite.md) no existe todavía.
No ejecutar el plan, las migraciones ni scripts de limpieza por revisar documentos.

Los alcances y conteos de los cortes inferiores son históricos cuando los
contradicen [22](Arquitectura/22-Mapa-de-Implementacion-API.md) y los contratos
vigentes. Esta revisión no consulta BD, no importa datos, no habilita credenciales
ni certifica despliegue, pruebas SQL o Redis multinodo.

## Corte vigente de notas y QA - 2026-10-29

Notas personales, colaboración por invitación, campana interna y Socket.IO están
registrados en NotesModule; sus trabajadores duraderos están implementados.
Las extensiones052/053 agregan Homes adicionales, responsable, vencimiento y
recordatorios personales. Contrato de seguimiento: [66](Arquitectura/66-Notas-Enterprise-Seguimiento.md).
La autorización de la nota y la del registro comercial son independientes:
compartir no concede acceso a la orden; sin ese acceso no se expone su contexto.
Se admiten invitaciones a cuentas active/inactive/pending, sin activar cuentas ni
conceder roles. La entrega y lectura revalidan ACL/capacidades y denies.

[67 - QA del 29](Arquitectura/67-Plan-QA-Regresiones-20261029.md) registra API6524
aprobadas/151 omitidas, frontend1233 y32 casos SQL/socket separados; son evidencia
del corte, no resultados nuevos por editar Markdown. Redis multinodo, carga/latencia
y aceptación visual con dos cuentas reales siguen pendientes. No importar datos,
activar copia legacy, adjuntos, correo externo ni despliegues por esta documentación.
Los apartados fechados siguientes conservan la cronología de autorizaciones.

Corte histórico de etapas1/2, sustituido en notas por el corte29:039/040, API protegida por modulo,
autoria exclusiva, UTC explicito, versiones/idempotencia y auditoria atomica.
Plan56/contrato57/diccionario12. No importar datos legacy. La interfaz personal esta autorizada en etapa3; no activar
campanita, trabajadores de outbox ni copia legacy. Sin triggers.

Revision documental histórica 2026-10-27: [55](Arquitectura/55-Revision-Documental-Integral-20261027.md).
Los bloques fechados siguientes son cronologia. El runtime actual registra
seguimiento y comandos de Formalizacion (ContractTransitionModule), lectura
NetSuite (NetsuiteModule) y Captacion federada. Cada accion conserva sus permisos
y gates; esta revision no autoriza operarlas. Eventos y citas/permiso
mercadeo.appointments.read fueron retirados por038. Calendario y metricas siguen.

Ampliacion autorizada 2026-10-26: Captacion usa `GET /marketing/leads/report`
con `mercadeo.leads.read`, scopes y deny, nativa primero y legacy opcional de solo
lectura. Ningun importador, migracion ni comando queda autorizado. Contrato,
cohortes y limites: [53](Arquitectura/53-Captacion-Leads-Reporte-Federado.md).

Current documentation/implementation cut 2026-10-23:
Arquitectura/49-Estado-Actual-y-Cierre-Documental.md. Supersedes stale present-tense
summaries below, not explicit permissions or the product law. Marketing summary
is read-only operational code; calendar 034 is empty schema, not calendar commands.

Ampliacion expresa 2026-10-23: esquema vacio de calendario compartido por modulos,
participantes, vinculos, campana individual y referencias externas; migracion 034
solo en CRM_THINK_V2. Sin importar calendars, activar runtime, permisos o Graph.
Ver Arquitectura/47-Calendario-Compartido-Esquema.md.

Excepcion expresa del propietario 2026-10-23: crear un perfil en `sec_user`
por correo unico de `crmdatabase-api.admins`, solo nombre/correo y estado seguro
pending/inactive. Omitir existentes; sin credenciales, roles, modulos ni referencias
ERP. Bitacora atomica nativa; legacy solo lectura. Ver Arquitectura/45-Usuarios-Por-Correo.md.
Esta excepcion no permite importar Leads, historiales ni otros datos comerciales.

Ampliacion posterior autorizada 2026-10-23: crear rol `ventas` asociado al modulo
Ventas sin permisos y asignarlo solo a los 43 perfiles del lote documentado en 45.
No habilitar acceso, cambiar estados ni asignar modulos individuales.

## Agent Role

Correccion expresa del propietario 2026-10-23: NO importar datos viejos a la
BD nueva. Consultar cada origen desde API y adaptar a un JSON comun. La copia
de bitacoras iniciada por interpretacion incorrecta fue detenida y eliminada.
Ver Arquitectura/44-Bitacora-Legacy-y-Timeline.md. No reintroducir importadores.

Ampliacion autorizada 2026-10-23: migracion nativa 031 para el esquema de Leads,
contactos, referencias, etapas, motivos e historial. Solo esquema y siete etapas,
sin importacion ni runtime comercial. Ver `Arquitectura/43-Leads-Esquema-Nativo.md`.

Act as a Staff Backend Engineer specialized in NestJS, TypeScript, hexagonal architecture, DDD, ERP integrations, MySQL, Microsoft Entra ID, auditability, and enterprise CRM systems. Treat Redis and RabbitMQ as future operational options, not first-cut requirements.

This backend project lives in:

```txt
apps/api
```

## Mandatory First Step

Before proposing or modifying backend code, Codex must inspect this file and the architecture index:

```txt
Arquitectura/00-Producto-CRM-TINK-y-P0.md
Arquitectura/00-Indice.md
```

For major work involving architecture, security, database design, integrations, scaffolding, migrations, jobs, or public API contracts, Codex must inspect only the local skills that directly apply to the task. Do not load every installed skill by default.

Backend architecture documentation lives inside this same project:

```txt
Arquitectura/
```

Do not rely on global documentation outside this subproject as the source of truth for backend decisions.

The source of truth for the current build scope is:

```txt
Arquitectura/00-Producto-CRM-TINK-y-P0.md
Arquitectura/00-Indice.md
Arquitectura/27-Identidad-Usuarios-Roles-P0-S1.md
Arquitectura/21-P0-Direccion-Tecnica-Construccion-Pausada.md
Arquitectura/22-Mapa-de-Implementacion-API.md
Arquitectura/23-Alcance-P0-Vertical-Leads.md
```

If `Arquitectura/00-Producto-CRM-TINK-y-P0.md` conflicts with this file, a skill, a data model, a future module map, or any other document, `Arquitectura/00-Producto-CRM-TINK-y-P0.md` wins until the product owner approves a replacement.

Current scope (2026-10-23): identity/BFF, Administration/catalogs, read-only Unit Files, internal sales-order lifecycle persistence/audit, Formalization approval/contract/Home summaries, Marketing Home lead/appointment aggregates and native lead timeline audit reads. General HTTP Lead CRUD, HTTP sales-order lifecycle mutations, federated legacy lead timeline, ERP synchronization, calendar commands, notes and jobs remain pending. Native Leads/calendar schemas and internal history commands do not expose those operations. See `Arquitectura/36-Registro-Entrega-Administracion.md` and `Arquitectura/49-Estado-Actual-y-Cierre-Documental.md` for current boundaries; historical checks remain dated evidence.

Before designing lead tables, lead endpoints, lead DTOs, lead repositories, or lead screens, read and close:

```txt
Arquitectura/27-Identidad-Usuarios-Roles-P0-S1.md
```

Before creating migrations, repositories, SQL queries, or Kysely types for the first lead vertical, read:

```txt
Arquitectura/27-Identidad-Usuarios-Roles-P0-S1.md
Arquitectura/25-Contrato-Canonico-Minimo-Lead-P0-S1.md
Arquitectura/26-Estandar-Nombres-Base-Datos.md
Arquitectura/12-Modelo-Datos-P0-MySQL-Kysely.md
Arquitectura/13-Bitacora-Acciones-y-Timeline-Lead.md
Arquitectura/21-P0-Direccion-Tecnica-Construccion-Pausada.md
Arquitectura/22-Mapa-de-Implementacion-API.md
Arquitectura/23-Alcance-P0-Vertical-Leads.md
```

Read documents `14` through `20` only when the task touches those specific domains.

Before creating or modifying authentication, sessions, cookies, Microsoft OIDC, local login, CORS, CSRF, security headers, validation, or error handling, read and follow:

```txt
Arquitectura/24-Seguridad-Autenticacion-BFF-OIDC-Local.md
```

## Required Local Skills

Use the smallest relevant set for the task. Default backend work normally starts with:

- `00-global-guardrails`
- `nestjs-best-practices`
- `typescript-best-practices`
- `verification-before-completion`

Add database, security, OpenAPI, testing, review, or integration skills only when the current task needs them.

## Required Stack

- NestJS.
- Strict TypeScript.
- Fastify as HTTP adapter.
- MySQL as the primary database for the new CRM.
- Kysely + mysql2 as the main data access layer.
- Do not use Docker for the project runtime or database setup unless the user explicitly changes this decision.
- Use pnpm from this API folder for dependency installation and local scripts.
- Runtime scope is limited to approved slices and dated addenda in `Arquitectura/00-Producto-CRM-TINK-y-P0.md`; future module trees do not authorize scaffolding.
- Never run npm commands, never create `package-lock.json`, and never create a root Node workspace for this CRM.
- If an installed skill or copied reference shows an npm command, translate it to the equivalent pnpm command before using it.
- When runtime scaffolding is approved, the first `package.json` must include local script guards so `dev`, `build`, `typecheck`, and `test` reject non-pnpm execution.
- Redis is a future operational cache option. It is not required for the first P0 lead vertical.
- RabbitMQ is a future job/event broker option. The first P0 lead vertical uses MySQL and may write outbox rows without requiring a broker.
- Microsoft Entra ID for authentication.
- Authentication must follow the BFF pattern documented in `Arquitectura/24-Seguridad-Autenticacion-BFF-OIDC-Local.md`; frontend storage of tokens is forbidden.
- P0 authorization starts simple: assigned user, manager/supervisor scope, and atomic backend permissions.
- RBAC + ABAC, multi-role users, direct grants, and explicit denies are approved for P0-S1A. Temporal delegated permissions are future scope and must not be implemented until the product law authorizes them.
- Authentication never freezes authorization. Backend guards must revalidate effective permission for protected actions, and a removed permission must stop authorizing the next protected request or within the documented short cache window.
- OpenAPI/Swagger for API contracts.
- JSON logs and OpenTelemetry-ready observability are desired, but the first vertical only requires clear errors and traceable audit/timeline records.

## Production Credential Safety Rule

Never rotate, alter, revoke, replace, or invalidate a production/shared database credential while live services still depend on it.

This is mandatory for RDS/MySQL master/admin users such as `usuario_master_compartido`.

Before any shared production credential change:

- inspect and list all live consumers first: CRM viejo, Kapso, PM2 apps, jobs, scripts, Prisma services, Node backends and external processes;
- create and test least-privilege dedicated users per service;
- move services to those dedicated users and verify they start and connect;
- confirm the shared credential has no live consumers left;
- obtain explicit owner approval for a maintenance window and rollback;
- never expose the secret in chat, docs, logs, commands, commits or screenshots.

If any live service still uses the shared credential, the only approved action is to prepare dedicated users and documentation. Do not rotate or disable the shared credential.

## Architecture Rules

1. Use a modular monolith first.
2. Apply clean architecture and hexagonal boundaries.
3. Keep domain, application, infrastructure, and presentation concerns separate.
4. Do not place business rules in controllers.
5. Do not place external API calls in the domain layer.
6. Do not access NetSuite, Odoo, Microsoft 365, Kapso, or the legacy CRM directly from `src/modules/crm`.
7. Every external integration must go through a domain-owned port. Current identity Microsoft ports live under `src/modules/crm/identity/ports`; future ERP ports must be created only when an approved slice needs them.
8. Prefer small vertical slices over broad scaffolding without executable behavior.
9. Normalize the database by default and whenever possible: readable, logical, relational tables with clear foreign keys, lookup tables, and no duplicated data unless an approved ADR justifies denormalization with evidence.
10. Public API DTOs, core domain models, and core database tables/columns must not use vendor-specific names such as NetSuite, Odoo, or Kapso.
11. Vendor-specific fields and naming belong only inside integration adapters and mappers.
12. Physical database table and column names must follow `Arquitectura/26-Estandar-Nombres-Base-Datos.md`: domain prefixes, singular tables, entity-suffixed columns, mandatory MySQL column comments, and provider-neutral naming.
13. Do not design or implement lead functionality before the identity/users/roles gate is closed.

## Code Quality and SOLID Rule

All runtime code in this API must be organized by responsibility.

Rules:

- Every file must have one clear purpose.
- Public functions/classes must be understandable by name and documented when they encode security, business, architecture, or non-obvious behavior.
- Comments explain why a rule exists; they must not repeat obvious code.
- Apply SRP first: one function per concern when a function starts handling unrelated responsibilities.
- `configure*` functions should orchestrate private focused functions instead of owning every detail inline.
- Extract repeated literals, cookie names, headers, paths, statuses, OpenAPI values, and security constants into named constants.
- Reuse a local function, service, guard, repository, DTO, or constant before creating duplicated logic.
- If logic becomes reusable across modules, move it to the nearest shared project folder that matches the domain, not to a vague `utils` dumping ground.
- Fail fast for required security configuration; do not silently default secrets, allowed origins, database names, providers, or token settings to empty strings.
- Keep functions small, readable and testable. Prefer early returns over nested conditionals.
- Do not add abstractions only for decoration. SOLID applies to real responsibilities, not ceremony.
- Prettier `printWidth: 500` is an explicit owner-approved formatting decision for this project. Do not treat it as accidental drift unless the owner changes the standard.
- In this API, the word "hook" means NestJS lifecycle or extension points such as guards, interceptors, pipes, filters, providers, and lifecycle interfaces. Do not create React-style hooks in the API.
- If API behavior is reused, extract it to the nearest domain/shared NestJS provider, guard, pipe, mapper, repository helper, or constant. Do not create frontend-style `use*` functions in backend code.

## NestJS Dependency Injection Rule

Every NestJS controller, provider, repository, guard, service, adapter, factory class, or infrastructure service with constructor dependencies must use explicit `@Inject(...)` on each constructor parameter.

Reason:

- local development uses `tsx watch`;
- tests use Vitest/tsx-style transforms;
- those paths compile with esbuild and must not depend on emitted decorator metadata;
- `tsconfig.json` enables `emitDecoratorMetadata`, but that guarantee belongs to `tsc` builds, not every runtime/test transform.

Required:

```ts
constructor(@Inject(DependencyService) private readonly dependency: DependencyService) {}
```

Forbidden:

```ts
constructor(private readonly dependency: DependencyService) {}
```

If a class has zero constructor dependencies, `@Inject(...)` is not required. Any new provider with dependencies must be covered by an AppModule wiring or metadata regression test under `test/`.

## Strict ERP Isolation Rule

Forbidden inside `src/modules/crm/`:

```ts
import { NetSuiteClient } from "../../integrations/netsuite";
import { OdooClient } from "../../integrations/odoo";
```

Allowed inside CRM core modules when an approved ERP slice exists:

```ts
import { ERPIntegrationPort } from "../ports/erp-integration.port";
```

The CRM core only speaks to external systems through stable domain ports. Do not import adapter clients from `src/integrations/**` into CRM modules.

## Expected Structure

This tree is the approved direction. Do not create future folders or modules until the current slice needs them.

```txt
src/
├── modules/
│   └── crm/
│       ├── sales/
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

## DTOs and Validation

- Every HTTP input uses a DTO.
- Every DTO uses validation decorators.
- Public DTOs must use canonical CRM field names, never ERP-specific field names.
- The frontend sends one standard CRM JSON contract; the API maps that contract to NetSuite, Odoo, or any future ERP inside the integration layer.
- Use transformation only when it improves clarity or correctness.
- Do not accept free-form objects without a contract.
- Do not use `any`.
- Validate dates, money, enums, ids, and pagination.

## Controllers

Controllers only:

- receive requests;
- validate DTOs;
- call application services or use cases;
- return normalized responses.

Controllers must not:

- call Kysely/mysql2 directly;
- call NetSuite, Odoo, Microsoft 365, Kapso, or legacy systems directly;
- build complex queries;
- own business rules.

## Services and Use Cases

Services implement business use cases, for example:

- create lead;
- assign lead;
- change lead status;
- register activity;
- create opportunity when the opportunity slice is approved;
- synchronize with ERP through outbox/adapters when the integration slice is approved.

Each use case must be testable without HTTP.

## Persistence

- Access the database through repositories or persistence services.
- Do not place queries in controllers.
- Use Kysely for typed SQL, joins, filters, pagination, transactions, and bulk updates.
- Use raw SQL only when Kysely cannot express the query clearly, always parameterized.
- Follow `Arquitectura/12-Modelo-Datos-P0-MySQL-Kysely.md` as the initial P0 schema baseline.
- Follow `Arquitectura/26-Estandar-Nombres-Base-Datos.md` before approving any physical table, column, index, constraint, Kysely type, or migration name. No migration is acceptable if any MySQL column lacks a clear `COMMENT` explaining what it records and why it exists.
- Follow `Arquitectura/13-Bitacora-Acciones-y-Timeline-Lead.md` for every lead mutation, timeline, audit, action reason, broker assignment, and extended lead profile decision.
- Follow `Arquitectura/14-Diccionario-de-Datos-y-Modulos.md` before adding any table, migration, module, or CRM action.
- Follow `Arquitectura/16-Alcance-PDFs-y-Modularizacion-Dominios.md` before adding sales, formalizations, collections, modifications, management, documents, calendar, communications, or customer-journey functionality.
- Calendar and notes documents describe approved future direction. Do not implement calendar or notes in the first lead vertical unless the user explicitly changes scope.
- Follow `Arquitectura/19-Reglas-Operativas-Leads-SLA-y-Perdida.md` before adding lead dashboards, new-lead queues, attention queues, pause/reactivation behavior, lead loss logic, SLA jobs, lead counters, or executive reports.
- Follow `Arquitectura/21-P0-Direccion-Tecnica-Construccion-Pausada.md` before changing P0 scope, lead ownership, attention rules, loss rules, migration scope, OpenAPI contracts, or the first vertical slice.
- Follow `Arquitectura/22-Mapa-de-Implementacion-API.md` before adding any module, endpoint, repository, migration, integration adapter, job, or API contract.
- Follow `Arquitectura/23-Alcance-P0-Vertical-Leads.md` before implementing the first lead endpoints, repositories, OpenAPI contract, or tests.
- Core schema names must stay provider-neutral. Use generic tables such as external systems/references instead of columns like `netsuite_id` or `odoo_id`.
- Every large query requires pagination.
- Every critical query must have an index strategy.
- Avoid N+1 query patterns.
- Use transactions for business invariants.

## Integrations

Each integration must include:

- client;
- adapter;
- mapper;
- DTOs;
- integration-specific errors;
- mapper tests;
- timeout handling;
- retries;
- idempotency;
- logging with `correlation_id`.

## Events and Jobs

- For the first lead vertical, persist the lead locally first. If external synchronization is needed, write a MySQL outbox row and do not block the seller on ERP latency.
- Use inbox for incoming webhooks.
- Workers must be idempotent.
- Failed work must move to retryable state or DLQ.
- Do not block the user experience on a slow ERP when the action can be asynchronous.

## Security

- Authenticate with Microsoft Entra ID.
- Authorize with backend guards and services.
- Use the smallest backend permission model that protects the current slice.
- The current model supports RBAC + ABAC, multiple roles, direct grants, explicit denies, and scoped revocation. Temporal delegated permissions remain future scope.
- Do not implement the full IAM target model before the first lead vertical works.
- Never trust frontend-provided permissions.
- Every `RouteSecurity("permission")` handler must declare method-local `RequirePermission` metadata. Reuse the bounded descriptors and preserve conditional, membership, row and transaction checks in services. Missing descriptors fail closed; update the route inventory and behavioral denial tests for new handlers.
- Never authorize sensitive actions only from permissions captured at login time.
- Sanitize logs.
- Never log tokens, secrets, or raw credentials.
- Store secrets only in environment variables or a vault.

## Audit

Application use cases decide which business or security events must be audited. Repositories may write audit rows only when they need to keep the audit event atomic with the data mutation, but they must not invent new audit semantics on their own.

Every sensitive action must record:

- actor;
- entity;
- action;
- previous values when applicable;
- new values when applicable;
- IP/user agent when available;
- correlation id;
- timestamp.

## Testing

Minimum expected coverage:

- unit tests for services and mappers;
- integration tests for critical repositories;
- e2e tests for P0 endpoints;
- permission tests;
- idempotency tests for workers.
- All automated test files must live under `test/`. Do not place `*.test.ts` or `*.spec.ts` inside `src/`; source folders stay for runtime code only.

## Delivery Rule

Before saying the backend work is complete:

1. Review the full diff.
2. Confirm unrelated files were not changed.
3. Run the available lint, typecheck, tests, and build commands when a runtime exists.
4. Report exactly what passed, failed, or could not be run.

## Authorized Marketing Home read extension - 2026-10-23

The owner authorized real lead aggregates for Marketing Home through
`GET /marketing/home/summary?period=day|week|month|year`. Read native leads first,
then the optional legacy adapter, and produce one JSON without copying records.
Count all leads created in the interval regardless of current status. Preserve
permission scopes, canonical seller/project identities and local public-ID photos.
Appointment metrics are now authorized as read-only calendar queries: native events first, then legacy Cita events, attributed through the lead owner/project. No imports or calendar mutations. See `apps/api/Arquitectura/48-Mercadeo-Metricas-Citas.md` (repository-relative).
This scoped authorization supersedes historical mock-only restrictions for this
summary only; it authorizes no imports, business mutations, migrations or deployment.
API contract and verification: `apps/api/Arquitectura/46-Mercadeo-Resumen-Leads.md`
(relative to the repository root).

Etapa3 autorizada2026-10-27: interfaz personal implementada en frontend; IdentityProfileRepository agrega base self para notas activas dentro de modulos efectivos existentes, conservando deny. Sin migracion/grants masivos; contrato58. Compartir y avisos internos implementados en etapa4 (contrato60); entregas externas y copia legacy pendientes.

Correccion de notas vigente: contrato59 amplia creacion personal a cualquier pantalla y relacion opcional con vistas registradas/ordenes native o legacy.041 solo registra origen externo; sin importar registros. Revalidar acceso incluso Home omitido; vincular no cambia ACL ni activa notificaciones/copia.

Etapa4 autorizada2026-10-27: colaboración y campana interna implementadas, contrato60.044 agrega versiones de colaboración, sec_notification y20 definiciones sin grants comerciales. NotesModule activa solo worker note_collaboration/notification con autorización vigente; no consumir histórico etapa2 ni legacy_projection. No correo ni copia legacy.

Notas: estado vigente y precedencia en Arquitectura/62-Notas-Tiempo-Real-Implementacion.md. No volver a exigir acceso al registro para leer una nota explícitamente compartida; redactar context=null cuando corresponda. El transporte nunca reemplaza REST ni ACL.
