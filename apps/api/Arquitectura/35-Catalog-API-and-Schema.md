# 35 - Catalog API and Schema

Implementation reference, 2026-10-09. Source of truth: catalog controller, DTOs, service, repository and migrations. Product scope and Administration acceptance gates remain unchanged.

## HTTP Contract

Catalog codes: `projects`, `campaigns`, `classes`, `brokers`, `files`, `subsidiaries`, `locations`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/catalogs/:catalogCode/items` | Filtered batch |
| POST | `/catalogs/:catalogCode/items` | Create item |
| PATCH | `/catalogs/:catalogCode/items/:itemPublicId` | Update item/reference set |
| PATCH | `/catalogs/:catalogCode/items/:itemPublicId/status` | Activate/inactivate |

Session cookies and existing mutation CSRF protections apply. Operations resolve current identity and scoped permission `{moduleCode}.{catalogModuleCode}.{read|create|update|inactivate}`, for example `administration.catalog_project.read`. Catalog permission module codes are `catalog_project`, `catalog_campaign`, `catalog_class`, `catalog_broker`, `catalog_file`, `catalog_subsidiary`, `catalog_location`; these differ from plural route codes. Existing validation, unauthorized, forbidden and conflict responses remain (400/401/403/409).

Current identity resolution treats an active Owner as having all active system permissions, ignoring direct overrides; non-Owners resolve active role mappings and overrides. Module memberships still affect navigation/scoping. Access replacement increments the permission version and explicitly revokes session/refresh credentials in the same audited transaction. Shared role-permission rows remain available to other role holders; revoked user assignments are retained as history, not orphaned grants.

`moduleCode` is required: `ventas`, `mercadeo`, `formalizacion`, `contabilidad` or `administration`. GET accepts optional `search` (max 120), `status` (`active`/`inactive`; omit for all), `limit` (1-200, default 100) and `offset` (0-2147483647, default 0). Response includes `catalog`, `items`, `total`; total counts matching non-deleted items before pagination. Ordering is name then internal ID. Count/list queries and offset pagination do not guarantee a concurrent-write snapshot.

Create/update requires `moduleCode`, trimmed `name` (2-180) and audit `reason` (5-255); optional `detail` is max 500. Optional `externalReferences` accepts at most 12 entries: `systemCode` (1-80) and optional `externalId` (1-180 when non-empty). Omitted/null/empty/whitespace identifiers are unassigned and do not trigger provider lookup. Non-empty IDs require an active provider. Update uses replacement semantics: include every desired reference, not only the edited one. Status changes require `moduleCode`, `status`, `reason`. No hard-delete endpoint is exposed.

OpenAPI is generated from Nest decorators. `OPENAPI_ENABLED` controls exposure at `/openapi/identity`; the historical path also serves the runtime catalog contract. No separate static OpenAPI contract is introduced.

## Schema and Ownership

`202610030007_crm_catalogs` adds:

- `crm_catalog_item`: unsigned BIGINT primary key; unique CHAR(26) public identity; catalog VARCHAR(80); native code VARCHAR(140), unique within catalog; name VARCHAR(180); nullable detail VARCHAR(500); active/inactive status; millisecond timestamps; actor FKs to `sec_user`; soft-delete history.
- `crm_catalog_item_external_reference`: unsigned BIGINT primary key; item/provider FKs; catalog VARCHAR(80); external ID VARCHAR(180); active/inactive status; optional JSON metadata; timestamps and soft-delete history. UNIQUE `(catalog_code_catalog_item_external_reference, external_system_id_catalog_item_external_reference, external_id_catalog_item_external_reference)` reserves archived ownership as well.

Absent Odoo means no reference row, not a placeholder ID. Signed numeric provider IDs can be stored exactly as strings. Uniqueness is per catalog/provider, not across all catalogs. CRM relationships use internal IDs, never vendor IDs.

Mutation and audit share one transaction. Unchanged reference rows remain intact; removed references are soft-deleted; archived references restore only for the same item; new references are inserted. Pre-flight checks and database uniqueness handle ownership/races. Audit failure rolls back the mutation.

`202610080008_administration_owner_repair` separately repairs Administration identity/linkage, Owner permissions/memberships and affected sessions with audit. Exact scope and tests are in document 34. Preserve historical migrations.

## Frontend and Verification

All seven routes share `CatalogItemsPage`/`CatalogItemsDataTable`, users CSS and `useDataTableSearchPanes`. Saved state is isolated by module/catalog. Local filters cover loaded rows; additional batches/retries do not discard loaded records. Drawer providers remain separate with explicit unassigned values.

Run `.\check-all.cmd` from the root. From `apps/api`, explicitly enable `CATALOG_MYSQL_TESTS=1` for rollback-only persistence tests and `CATALOG_MYSQL_COVERAGE=1` for repository V8 execution-range evidence. Direct `.env` MySQL is used, never Docker. Document 34 records measured coverage, browser evidence and unresolved ETL gates; test passes do not establish full branch coverage or acceptance.
