# CRM TINK Root Rules

This root folder only orchestrates the separated projects under `apps/`.

## Official Validation Command

Run this command from the repository root:

```cmd
.\check-all.cmd
```

`.\check-all.cmd` is the only `.cmd` entrypoint. It delegates to `scripts/check-all.ps1` and runs each project check from its own folder.

The command currently accepts no arguments. If arguments are needed later, add explicit parameters to `scripts/check-all.ps1` first and document them here.

Do not create another `check-all.cmd` under `scripts/` or inside an app. API and frontend remain separate projects with their own `pnpm-lock.yaml`, package scripts, and local rules.

## Project Skills

Project-local skills are installed under `.agents/skills/`. Source revisions, installation verification, applicability and design precedence are recorded in [SKILLS.md](SKILLS.md). Consult relevant entrypoints before using them; installing a skill does not authorize unrelated workflows, dependency changes, production actions or fabricated business data.

## Scope

Current documentation reconciliation (2026-11-02): [72 — Commit and implementation coverage](apps/api/Arquitectura/72-Reconciliacion-Documental-20261102.md)
is the current inventory and evidence boundary. It covers reachable CRM commits
through `fcbf0c2` plus explicitly identified local changes. Read the canonical
API/frontend maps and current contracts before older dated snapshots. A commit
named `docs` may contain implementation; inspect its files rather than its title.
NetSuite v2 local events now have an explicitly gated durable writer for the ten audited flags; v1 remains receipt-only. Migration058 was applied with explicit approval. See [73](apps/api/Arquitectura/73-Sincronizacion-Estados-Ordenes-NetSuite.md) for verification and pending Sandbox acceptance. Deployment29 is historical evidence, not proof that HEAD/local
changes are deployed. Documentation never authorizes migrations or external writes.

Current documentation reconciliation (2026-10-29): [66 - Notes delivery](apps/api/Arquitectura/66-Notas-Enterprise-Seguimiento.md) and [67 - QA plan and results](apps/api/Arquitectura/67-Plan-QA-Regresiones-20261029.md), together with the dated implementation history below. [55 - Revision integral](apps/api/Arquitectura/55-Revision-Documental-Integral-20261027.md) remains the historical October 27 audit. Documentation records wiring and evidence; it does not authorize business operations.

Current implementation/documentation history: [49 - Estado actual](apps/api/Arquitectura/49-Estado-Actual-y-Cierre-Documental.md).
Historical pauses and future blueprints do not override explicit scoped approvals.
An applied schema or visible menu is not an operational feature; preserve evidence limits.

- API rules live in `apps/api/AGENTS.md`.
- Frontend rules live in `apps/frontend/AGENTS.md`.
- Product scope law lives in `apps/api/Arquitectura/00-Producto-CRM-TINK-y-P0.md`.

If a root rule conflicts with the product law, the product law wins.
