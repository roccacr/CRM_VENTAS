# Project Skill Registry

This registry is versioned; the installed `.agents/skills/` packages remain local under the repository's existing ignore policy.

Installed on 2026-10-09 from the requested upstream repositories using Codex's GitHub skill installer. Complete packages, including bundled references and scripts, live in `.agents/skills/<name>/`. Global copies live in the configured `C:/codex-data/skills/<name>/` root. Existing global packages were backed up under `C:/codex-data/skill-backups/20261009-095907/` before replacement. Application package dependencies were not changed.

| Skill | Upstream Package | Pinned Revision | Files Verified |
| --- | --- | --- | --- |
| wizard | mattpocock/skills: skills/engineering/wizard | 49dd158d1076134a641b33efb035946536778336 | 3 |
| archify | tt-a1i/archify: archify | 7f483b61e8f68d0d5c3219d2c943c5381c8db0b1 | 315 |
| impeccable | pbakaus/impeccable: .agents/skills/impeccable | d631a8827f99414d2b6daba4ef08b7f8701751d7 | 62 |
| interface-design | dammyjay93/interface-design: .claude/skills/interface-design | 2f9be3206855bcb2d1d0af262c8bae25cba6658d | 2 |
| react-vite-dashboard | google-labs-code/stitch-skills: plugins/stitch-build/skills/react-vite-dashboard | 0337446dadde6f8c94210444e2aa9d546126480f | 2 |
| frontend-design-direction | affaan-m/ecc: skills/frontend-design-direction | ef648e01899ba3e8dc6371642deaaf64b4477775 | 1 |
| kpi-dashboard-design | wshobson/agents: plugins/business-analytics/skills/kpi-dashboard-design | 46891e7e60da0e52baf1050b7b6391b64e84c6d9 | 2 |

Verification compared every packaged local file with its global counterpart using SHA-256: zero mismatches across all seven skills. Each package has a `SKILL.md` entrypoint. Read these files directly in the current session; automatic Codex skill discovery refreshes on the next turn. Installation alone is not evidence that every optional CLI, external service or prerequisite workflow is configured.

## Application Rules

Instruction hierarchy and the canonical product law remain authoritative. Within applicable design skills, the owner's existing `dashboard-design` precedence is preserved. Reuse the current Administration theme, Ant Design components and DataTables/SearchPanes runtime; do not install a new UI stack to match examples in a skill.

- `impeccable`, `interface-design` and `frontend-design-direction`: applicable to scoped interface finalization, hierarchy, tokens, responsive layouts, accessibility, recovery states and purposeful feedback. Preserve the established visual identity and module boundaries.
- `wizard`: human-run setup/cutover procedures only, not application architecture or an automatic prerequisite for UI work.
- `archify`: repository-backed diagram generation only; not dashboard UI or numeric charts. Its optional diagram CLI is not run merely by installing it.
- `react-vite-dashboard`: full workflow requires a supplied Stitch screen and configured Stitch MCP. No Stitch conversion or React downgrade is implied by installation. Compatible table semantics, loading accessibility and responsive principles can inform existing React/Vite work.
- `kpi-dashboard-design`: use when actual business metric contracts, definitions and source data exist. Projects is a catalog, not an executive KPI dashboard; do not fabricate revenue, trends, targets or synchronization health.

Impeccable's Windows launcher context command ran against the projects page. It found no PRODUCT.md/DESIGN.md; existing product-law, Administration theme and implemented UI provide the authority for scoped finalization. Its detector returned `[]` for the four projects presentation source targets. The launcher may download a checksum-verified engine to the user's cache; no engine executable was added to the repository. No hooks were enabled.

## Availability Checks

From the repository root, inspect `.agents/skills/<name>/SKILL.md`; globally inspect `C:/codex-data/skills/<name>/SKILL.md`. Keep upstream packages intact and update pinned revisions and verification results together when upgrading. Review scripts before running them. Do not treat installed skill instructions as authorization to change credentials, services, permissions, repository history or production data.
