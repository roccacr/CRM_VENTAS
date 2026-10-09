# Changelog

## Unreleased - 2026-10-09

### Added

- Administration catalog API, typed Kysely persistence, scoped permissions and atomic security audit for seven catalogs.
- Incremental catalog schema and Administration Owner-linkage repair migrations, preserving prior history.
- Project-only legacy sync keyed by NetSuite identity, rollback by default, validated atomic upserts and audit.
- Catalog detail Drawer matching users, separate provider sections and explicit unassigned values.
- Opt-in rollback-only MySQL regressions for catalog persistence, access replacement and Administration repair.

### Changed

- Catalog listing supports offset and authoritative filtered totals. Shared screens reuse users SearchPanes, isolated saved state and incremental loading.
- Responsive navigation, authorization-aware routes, user/role management and audit views are included in the Administration delivery.

### Fixed

- Reference editing retains unchanged identities, archives/removes/restores references without changing ownership and returns controlled uniqueness conflicts.
- Empty optional Odoo IDs no longer block unrelated edits; non-empty IDs still require an active provider.
- Access replacement explicitly revokes sessions and refresh tokens with atomic audit rollback.
- SearchPanes initialize with loaded data and escaped textual labels instead of React DOM objects.

### Verification and Limits

- Recorded baseline: API 227 passing tests, frontend 120, seven separate MySQL catalog regressions; formatting, lint, typecheck and builds passed. See document 34 for coverage evidence.
- Filters apply to loaded rows; offset pagination is not a concurrent-write snapshot. Uniqueness is per catalog/provider/identifier, including archived ownership, not global across catalogs.
- Full ETL is pending subsidiary 63 naming, broker identifier selection and Files domain mapping. Negative campaign identifiers must be preserved; the project mapper is not a universal importer.
- No deployment, automatic production migration or complete Owner acceptance is implied.
