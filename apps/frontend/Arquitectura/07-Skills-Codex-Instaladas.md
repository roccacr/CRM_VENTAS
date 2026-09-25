# 07 - Skills Codex Instaladas Frontend

## Objetivo

Este frontend debe ser autosuficiente: toda skill y documentacion necesaria para trabajar en React/Vite vive dentro de `apps/frontend`.

## Ubicaciones locales

```txt
apps/frontend/
├── AGENTS.md
├── skills-lock.json
├── Arquitectura/
└── .codex/
    └── skills/
```

## Regla

Cuando se trabaje en `apps/frontend`, Codex debe usar primero:

```txt
.codex/skills/
Arquitectura/
```

No debe depender de `.codex`, `.agents`, `AGENTS.md` ni `Arquitectura` en una raiz externa al frontend.

## Skills activas frontend

- `00-global-guardrails`
- `agent-browser`
- `code-documenter`
- `code-review`
- `code-review-excellence`
- `context7-mcp`
- `crm-documentation-standards`
- `crm-security-baseline`
- `frontend-design`
- `git-guardrails-claude-code`
- `human-architect-mindset`
- `openapi-spec-generation`
- `playwright-generate-test`
- `qa-test-planner`
- `react-testing`
- `refactoring-ui`
- `requesting-code-review`
- `security-review`
- `senior-fullstack`
- `shadcn`
- `simplify`
- `software-architecture`
- `spec-driven-development`
- `systematic-debugging`
- `tailwind-design-system`
- `tanstack-query`
- `test-driven-development`
- `typescript-best-practices`
- `vercel-react-best-practices`
- `verification-before-completion`
- `vite`
- `web-design-guidelines`

## Skills externas frontend

| Skill | Fuente | Motivo |
|---|---|---|
| `agent-browser` | `vercel-labs/agent-browser` | Apoyo para pruebas/inspeccion de UI en navegador. |
| `code-documenter` | `jeffallan/claude-skills` | Documentacion de componentes, props, guias y comentarios utiles. |
| `code-review` | `mattpocock/skills` | Revision de cambios frontend. |
| `git-guardrails-claude-code` | `mattpocock/skills` | Guardrails de Git para evitar operaciones peligrosas o confusas. |
| `security-review` | `getsentry/skills` | Revision de seguridad frontend, datos sensibles y exposicion accidental. |
| `simplify` | `brianlovin/agent-config` | Simplificacion de codigo luego de implementar. |
| `test-driven-development` | `obra/superpowers` | Disciplina TDD para componentes y flujos. |
| `typescript-best-practices` | `cursor/plugins` | TypeScript estricto y convenciones de tipado. |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` | Performance y patrones React. |
| `tanstack-query` | `tanstack-skills/tanstack-skills` | Server state, cache, invalidacion, mutaciones y optimistic UI. |
| `react-testing` | `affaan-m/ecc` | Testing React con enfoque en comportamiento, hooks, accesibilidad y mocks. |
| `shadcn` | `shadcn-ui/ui` | Guia shadcn/ui, Radix y componentes source-code. Usar con cautela porque incluye comandos de shell. |

## Skills propias frontend

| Skill | Motivo |
|---|---|
| `crm-security-baseline` | Seguridad frontend: permisos visibles, tokens, datos sensibles, exports y Microsoft 365. |
| `crm-documentation-standards` | Documentacion frontend: componentes, formularios, tablas, API clients, rutas y comportamiento UI. |

## Skills revisadas y no instaladas en frontend

| Categoria | Decision |
|---|---|
| React/Vite genericas de bajo uso | No instaladas; cubierto por `vercel-react-best-practices`, `vite`, `tanstack-query`, `frontend-design` y `react-testing`. |
| UI/UX genericas | No instaladas; cubierto por `frontend-design`, `web-design-guidelines`, `refactoring-ui`, `tailwind-design-system` y `shadcn`. |
| Documentacion/comentarios externas pequenas | No instaladas; cubierto por `code-documenter` + `crm-documentation-standards`. |
| OWASP externo | No instalado; cubierto por `security-review` + `crm-security-baseline`. |

## Regla de lectura para Codex

Antes de trabajar en frontend, Codex debe leer las skills relevantes de `.codex/skills/`.

Para cambios grandes de UI, arquitectura frontend, seguridad, testing, estado, componentes o scaffolding, Codex debe revisar solo las skills relevantes de este subproyecto antes de modificar codigo.
