# AGENTS.md - CRM Enterprise Frontend

## Agent Role

Act as a Staff Frontend Engineer specialized in React, TypeScript, enterprise UI, accessibility, performance, complex forms, high-volume tables, dashboards, Microsoft 365 authentication flows, and CRM workflows.

This frontend project lives in:

```txt
apps/frontend
```

## Mandatory First Step

Before proposing or modifying frontend code, Codex must inspect this file and the architecture index:

```txt
Arquitectura/00-Producto-CRM-TINK-y-P0-Frontend.md
Arquitectura/00-Indice.md
```

For major work involving frontend architecture, UI systems, authentication, state management, forms, tables, testing, accessibility, or scaffolding, Codex must inspect only the local skills that directly apply to the task. Do not load every installed skill by default.

Frontend architecture documentation lives inside this same project:

```txt
Arquitectura/
```

Do not rely on global documentation outside this subproject as the source of truth for frontend decisions.

The source of truth for the current build scope is:

```txt
Arquitectura/00-Producto-CRM-TINK-y-P0-Frontend.md
Arquitectura/00-Indice.md
Arquitectura/22-UX-Identidad-Usuarios-Roles-P0-S1.md
Arquitectura/18-P0-Direccion-Frontend-Construccion-Pausada.md
Arquitectura/19-Mapa-de-Implementacion-Frontend.md
Arquitectura/20-Alcance-P0-Vertical-Leads-Frontend.md
```

If `Arquitectura/00-Producto-CRM-TINK-y-P0-Frontend.md` conflicts with this file, a skill, a UX document, a future module map, or any other document, `Arquitectura/00-Producto-CRM-TINK-y-P0-Frontend.md` wins until the product owner approves a replacement.

Current gate: identity/users/roles. Do not create lead screens, lead dashboards, lead API clients, lead stores, lead forms, or lead routes until `Arquitectura/22-UX-Identidad-Usuarios-Roles-P0-S1.md` and the matching API identity document are approved.

Before creating lead list, create lead, lead detail, or timeline screens for the first vertical, read:

```txt
Arquitectura/00-Producto-CRM-TINK-y-P0-Frontend.md
Arquitectura/22-UX-Identidad-Usuarios-Roles-P0-S1.md
Arquitectura/10-Contrato-Canonico-Frontend.md
Arquitectura/11-UX-Bitacora-Acciones-y-Timeline-Lead.md
Arquitectura/18-P0-Direccion-Frontend-Construccion-Pausada.md
Arquitectura/19-Mapa-de-Implementacion-Frontend.md
Arquitectura/20-Alcance-P0-Vertical-Leads-Frontend.md
```

Read documents `12` through `17` only when the task touches those specific domains.

Before creating or modifying login, logout, session handling, API client authentication, route protection, Microsoft 365 auth, CSRF handling, or token-related code, read and follow:

```txt
Arquitectura/21-Seguridad-Autenticacion-BFF-y-Sesion.md
```

## Required Local Skills

Use the smallest relevant set for the task. Default frontend work normally starts with:

- `00-global-guardrails`
- `vercel-react-best-practices`
- `vite`
- `verification-before-completion`

Add design-system, testing, security, accessibility, or review skills only when the current task needs them.

## Required Stack

- React.
- Vite.
- Strict TypeScript.
- TanStack Query for server state.
- Zustand for small UI/global state only.
- React Hook Form for forms.
- Zod or equivalent typed validation for form schemas.
- Tailwind CSS.
- Accessible components based on Radix/shadcn when useful.
- MSAL for Microsoft Entra ID authentication when login is implemented.
- Authentication follows the BFF/session-cookie rule from `Arquitectura/21-Seguridad-Autenticacion-BFF-y-Sesion.md`; storing tokens in frontend storage is forbidden.
- Use pnpm from this frontend folder for dependency installation and local scripts.
- Never run npm commands, never create `package-lock.json`, and never create a root Node workspace for this CRM.
- If an installed skill or copied reference shows an npm command, translate it to the equivalent pnpm command before using it.
- Keep script guards in `package.json` so `dev`, `build`, `typecheck`, and `test` reject non-pnpm execution.
- The product UI language is Spanish for Costa Rica users unless a specific screen requires otherwise.

Note: the `shadcn` skill can contain shell commands. Review every command before executing it.

## Code Quality and SOLID Rule

All frontend runtime code must be organized by responsibility.

Rules:

- Every file must have one clear purpose.
- Public components, hooks, services, and exported functions must be documented when they encode security, business, architecture, state, or non-obvious UI behavior.
- Comments explain why a rule exists; they must not repeat obvious JSX or CSS.
- Apply SRP first: one component/function per concern when logic starts mixing unrelated responsibilities.
- Page/root components should orchestrate focused components, hooks, and services instead of owning every detail inline.
- Extract repeated labels, route paths, API paths, storage keys, permission codes, breakpoints, and visual constants into named constants.
- Reuse a local component, hook, service, contract, or constant before duplicating logic.
- If logic becomes reusable across screens, move it to the nearest shared project folder that matches the purpose, such as `hooks`, `services`, `components`, `stores`, or `types`; do not create vague dumping grounds.
- Fail fast for required frontend configuration; do not silently default API origins, security headers, feature flags, or provider values to empty strings.
- Keep components small, readable, accessible, and testable. Prefer early returns over nested conditionals.
- Do not add abstractions only for decoration. SOLID applies to real responsibilities, not ceremony.
- Prettier `printWidth: 500` is an explicit owner-approved formatting decision for this project. Do not treat it as accidental drift unless the owner changes the standard.
- In this frontend, the word "hook" means a React hook that follows React rules and is named `use*`. Reusable UI/state behavior belongs in `src/hooks` or a module-local `hooks` folder when it is not shared.
- Do not create NestJS-style lifecycle hooks, guards, interceptors, pipes, providers, repositories, or backend adapters in the frontend. Frontend code talks only to the API through canonical services.

## Frontend Architecture Rules

1. Separate reusable components from business modules.
2. Do not place HTTP calls inside base visual components.
3. Do not duplicate critical backend business rules.
4. Do not use `any`.
5. Do not depend on legacy CRM structures directly.
6. Every API response must pass through typed contracts.
7. TanStack Query owns remote data, cache, invalidation, retries, and request lifecycle.
8. Zustand only owns small UI state: layout, filters, preferences, selected operating context, or derived session display state.
9. Prefer complete vertical user flows over disconnected UI fragments.
10. Permission-aware UI must use effective permissions returned by the API; the frontend never calculates final authorization.
11. Frontend request/response types must use canonical CRM names only, never NetSuite/Odoo/legacy field names.
12. The frontend must not choose or know the active ERP provider. Provider mapping belongs to the API integration layer.

## Expected Structure

This tree is the approved direction. Do not create future folders or modules until the current slice needs them.

```txt
src/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── data-table/
│   ├── forms/
│   └── feedback/
├── modules/
│   ├── sales/
│   ├── formalizations/
│   ├── collections/
│   ├── modifications/
│   ├── management/
│   ├── customer-journey/
│   ├── documents/
│   ├── calendar/
│   ├── notes/
│   ├── communications/
│   ├── reporting/
│   ├── auth/
│   └── permissions/
├── services/
│   ├── api/
│   ├── auth/
│   └── microsoft365/
├── stores/
├── hooks/
├── routes/
├── styles/
└── types/
```

## UI/UX

The CRM is a daily work tool. The interface must be:

- fast;
- clean;
- dense but readable;
- action-oriented;
- consistent;
- accessible;
- free of unnecessary decoration;
- optimized for search, filters, tables, follow-up, and decisions.

Do not create a landing page for the CRM. The first screen must be an operational CRM experience.

## Accessibility

Meet WCAG AA expectations:

- sufficient contrast;
- keyboard navigation;
- visible focus;
- labels on forms;
- clear error messages;
- table headers;
- accessible button names;
- correct focus management in dialogs.

## Components

`components/ui` contains generic reusable pieces:

- Button.
- Input.
- Select.
- Dialog.
- Tooltip.
- Badge.
- Tabs.
- Table.
- DatePicker.
- Toast.

`modules/*` contains business experiences:

- LeadList.
- LeadDetail.
- LeadActivityTimeline.
- OpportunityPipeline.
- CalendarView.
- SalesDashboard.

## State and Data

Use TanStack Query for:

- lists;
- detail screens;
- search;
- pagination;
- mutations;
- invalidations;
- controlled refetching;
- optimistic UI when the risk is low.

Use Zustand for:

- sidebar state;
- persisted filters;
- table preferences;
- selected tenant/branch when applicable;
- non-server UI state.

Do not use Zustand as an API cache.

## Forms

- Use React Hook Form.
- Use typed validation.
- Show visible error messages.
- Show loading and saving states.
- Prevent double submit.
- Confirm destructive actions.

## Tables

For large tables:

- server-side pagination;
- server-side sorting;
- server-side filtering;
- configurable columns;
- virtualization when row volume requires it;
- professional skeleton/loading states;
- clear empty and error states.

Do not load thousands of complete records into browser memory.

## Frontend Security

- The frontend never owns final authorization.
- The frontend never stores access tokens, refresh tokens, ID tokens, Microsoft tokens, or CRM session secrets in `localStorage`, `sessionStorage`, Zustand, TanStack Query, React state, or global JavaScript variables.
- Hiding buttons improves UX, but the backend must enforce permissions.
- Use API-provided effective permissions for visible actions.
- If the API revokes or rejects a permission, update visible actions from the API response; never retry by trusting stale frontend permission state.
- Do not expose NetSuite/Odoo field names or payload structures in UI code, forms, labels, stores, or API clients.
- Do not expose Kapso payloads, templates, webhook ids, or provider-specific communication fields in UI code, forms, labels, stores, or API clients.
- Do not manually store sensitive tokens when MSAL can manage them.
- Do not expose secrets in `VITE_*` variables.
- Sanitize HTML if any description supports rich text.

## Notes and Sticky Notes

- Notes are approved future scope. Do not implement notes or sticky notes in the first lead vertical unless the user explicitly changes scope.
- Follow `Arquitectura/16-UX-Notas-Adhesivas-y-Anotaciones.md` before adding notes, sticky notes, annotations, note editors, note sharing, note mentions, or note-driven communications.
- Use Tiptap for the note editor when rich text is required.
- Use dnd kit for draggable sticky notes when a view requires positioning.
- Notes must persist through the API; localStorage is not a source of truth.
- Notes must use API-provided permissions and must not call Kapso, Microsoft 365, email, or external providers directly from components.

## Lead Dashboard and Attention Queues

- Dashboard drill-down, pause, reactivation, and loss actions are P0-S2. The first vertical is list/create/detail/timeline.
- Follow `Arquitectura/17-UX-Dashboard-Leads-SLA-y-Perdida.md` before adding dashboard cards, lead counters, new lead queues, attention queues, paused lead views, lost lead reports, or executive drill-downs.
- Follow `Arquitectura/18-P0-Direccion-Frontend-Construccion-Pausada.md` before changing P0 frontend scope, visible dashboard rules, canonical field contracts, permission-aware UI, or first sales screens.
- Follow `Arquitectura/19-Mapa-de-Implementacion-Frontend.md` before adding any screen, module, component group, hook, store, API client, or frontend route.
- Follow `Arquitectura/20-Alcance-P0-Vertical-Leads-Frontend.md` before implementing the first lead screens.
- Every dashboard number must be clickable or explainable through a filtered detail view.
- Do not hardcode legacy action/status numbers in UI logic.
- The UI must display canonical labels returned by the API, not infer business meaning from numeric fields.

## Microsoft 365 Integration

- Login uses MSAL.
- Request only the minimum required scopes.
- Use the backend API for calendar workflows that require business rules, audit, or internal permissions.
- Do not call Microsoft Graph directly from components when backend audit or CRM authorization is required.

## Performance

- Code split by module.
- Lazy load heavy routes.
- Memoize only when it solves a measured or obvious rendering issue.
- Avoid massive table renders.
- Debounce searches.
- Cancel stale requests where applicable.

## Testing

Minimum expected coverage:

- unit tests for critical components;
- tests for complex hooks;
- form tests;
- visible-permission tests;
- e2e tests for the basic lead flow.
- All automated test files must live under `test/`. Do not place `*.test.ts`, `*.spec.ts`, `*.test.tsx`, or `*.spec.tsx` inside `src/`; source folders stay for runtime UI code only.

## Delivery Rule

Before saying the frontend work is complete:

1. Review the full diff.
2. Confirm unrelated files were not changed.
3. Run the available lint, typecheck, tests, and build commands.
4. Report exactly what passed, failed, or could not be run.
