# AGENTS.md - CRM Enterprise API

## Agent Role

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

Current phase: approved minimal identity runtime. The only runtime authorized is identity P0-S1A: NestJS bootstrap, secure BFF session endpoints, Kysely access to `CRM_THINK_V2`, effective permissions, and security audit. Commercial CRM modules, lead endpoints, ERP operations, calendars, notes, jobs, and integrations remain prohibited until the product law authorizes them.

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
- Runtime scaffolding is approved only for the minimal identity slice described by `Arquitectura/00-Producto-CRM-TINK-y-P0.md`.
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
7. Every external integration must go through a port defined under `src/integrations/common`.
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
import { NetSuiteClient } from '../../integrations/netsuite';
import { OdooClient } from '../../integrations/odoo';
```

Allowed inside CRM core modules:

```ts
import { ERPIntegrationPort } from '../../integrations/common/ports/erp-integration.port';
```

The CRM core only speaks to ERP systems through stable ports.

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
