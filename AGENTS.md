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

## Scope

- API rules live in `apps/api/AGENTS.md`.
- Frontend rules live in `apps/frontend/AGENTS.md`.
- Product scope law lives in `apps/api/Arquitectura/00-Producto-CRM-TINK-y-P0.md`.

If a root rule conflicts with the product law, the product law wins.
