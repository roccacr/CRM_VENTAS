# 07 - Skills Codex Instaladas API

## Registro vigente y snapshot historico - 2026-10-22

El registro versionado actual es [SKILLS.md](../../../SKILLS.md): paquetes locales de raiz bajo `.agents/skills/` y copias globales en `C:/codex-data/skills/`. Las ubicaciones `.codex/skills/` y listas siguientes describen una instalacion historica del API; no acreditan disponibilidad actual ni anulan las reglas raiz/API. Verificar la existencia del entrypoint antes de usarlo. Esta revision no inspecciona ni modifica paquetes instalados.

## Objetivo historico

Este backend debe ser autosuficiente: toda skill y documentacion necesaria para trabajar en API vive dentro de `apps/api`.

## Ubicaciones locales

```txt
apps/api/
├── AGENTS.md
├── skills-lock.json
├── Arquitectura/
└── .codex/
    └── skills/
```

## Regla

Cuando se trabaje en `apps/api`, Codex debe usar primero:

```txt
.codex/skills/
Arquitectura/
```

La antigua autonomia de instalacion no excluye las reglas de la raiz del repositorio ni su registro `SKILLS.md`. Mantener la documentacion de producto dentro de `apps/api/Arquitectura`.

## Skills activas backend

- `00-global-guardrails`
- `clean-architecture`
- `code-documenter`
- `code-review`
- `code-review-excellence`
- `context7-mcp`
- `crm-documentation-standards`
- `crm-security-baseline`
- `domain-driven-design`
- `git-guardrails-claude-code`
- `human-architect-mindset`
- `mysql`
- `mysql-best-practices`
- `nestjs-best-practices`
- `nestjs-testing-expert`
- `nodejs-backend-patterns`
- `nodejs-best-practices`
- `openapi-spec-generation`
- `requesting-code-review`
- `security-review`
- `senior-fullstack`
- `simplify`
- `software-architecture`
- `spec-driven-development`
- `systematic-debugging`
- `test-driven-development`
- `typescript-best-practices`
- `verification-before-completion`

## Skills externas API

| Skill | Fuente | Motivo |
|---|---|---|
| `clean-architecture` | `wondelai/skills` | Refuerzo de arquitectura limpia para boundaries, casos de uso y dependencias. |
| `domain-driven-design` | `wondelai/skills` | Refuerzo de modelado de dominio, lenguaje ubicuo y limites de contexto. |
| `code-review` | `mattpocock/skills` | Revision de cambios con enfoque practico. |
| `git-guardrails-claude-code` | `mattpocock/skills` | Guardrails de Git para evitar operaciones peligrosas o confusas. |
| `nestjs-best-practices` | `kadajett/agent-nestjs-skills` | NestJS enterprise: modulos, DI, guards, validacion, testing y performance. |
| `nestjs-testing-expert` | `shipshitdev/skills` | Testing NestJS: unit, integration y e2e. |
| `typescript-best-practices` | `cursor/plugins` | TypeScript estricto y convenciones de tipado. |
| `code-documenter` | `jeffallan/claude-skills` | Documentacion tecnica, API docs y comentarios utiles. |
| `simplify` | `brianlovin/agent-config` | Simplificacion de codigo luego de implementar. |
| `mysql-best-practices` | `mindrally/skills` | Buenas practicas MySQL para revisar legacy. |
| `mysql` | `planetscale/database-skills` | Skill especializada de MySQL/PlanetScale para consultas e indices. |
| `security-review` | `getsentry/skills` | Revision de seguridad aplicativa. |
| `test-driven-development` | `obra/superpowers` | Disciplina TDD para cambios de comportamiento. |

## Skills propias API

| Skill | Motivo |
|---|---|
| `crm-security-baseline` | Seguridad del CRM: Microsoft Entra ID, RBAC/ABAC, ERP adapters, auditoria, secretos, datos sensibles y migraciones seguras. |
| `crm-documentation-standards` | Documentacion backend: ADRs, OpenAPI, DTOs, schema SQL/Kysely, migraciones, comentarios utiles y contratos de integracion. |

## Skills revisadas y no instaladas en API

| Categoria | Decision |
|---|---|
| OWASP externo | No instalado; el instalador quedo colgado. Cubierto por `security-review` + `crm-security-baseline`. |
| OpenAPI externas pequenas | No instaladas; cubierto por `openapi-spec-generation`. |
| Prisma | Las skills de Prisma pueden existir en disco por instalaciones previas, pero no gobiernan este proyecto. La decision vigente es MySQL + Kysely + mysql2. |
| RabbitMQ/Redis genericas | No instaladas; se usara Context7/documentacion oficial al implementar. |
| `nodejs-best-practices` desde `sickn33/agentic-awesome-skills` | No instalada desde ese repo; el instalador quedo colgado. Se mantiene la skill local existente `nodejs-best-practices`. |
| `nestjs-modular-monolith` desde `tech-leads-club/agent-skills` | No instalada; el instalador quedo colgado. Cubierto por `nestjs-best-practices`, `clean-architecture`, `domain-driven-design` y documentacion propia. |

## Regla de lectura para Codex

Antes de trabajar en API, Codex debe localizar y leer solo los entrypoints relevantes realmente disponibles, segun `AGENTS.md` y el registro vigente.

Para cambios grandes de arquitectura, seguridad, base de datos, integraciones, scaffolding o convenciones globales, Codex debe revisar solo las skills relevantes de este subproyecto antes de modificar codigo.
