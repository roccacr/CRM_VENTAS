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

### Independent Projects Domain - 2026-10-09

Projects now uses only `crm_project` and `crm_project_external_reference`, through its own `ProjectsModule`, controller, service and repository under `src/modules/crm/projects/`. Its explicit `/catalogs/projects/items` routes preserve the existing frontend contract; the generic repository rejects Projects instead of routing its queries. The other six catalog domains remain in shared storage until individually migrated; dropping their tables is outside this step.

### Mandatory Feature Folder Ownership

- Each implemented dedicated table aggregate owns its controller, service, repository and domain-specific fallback under `src/modules/crm/<entity>/`. Future Campaigns, Leads and Estimates verticals must follow this structure when their dedicated tables are implemented; do not scaffold empty CRUD modules.
- A reference child table stays with its parent aggregate: `crm_project_external_reference` belongs to Projects because reference replacement and project mutations must remain atomic. Shared provider configuration (`int_external_system`) remains infrastructure, not a separate CRUD implementation copied into every feature.
- `src/modules/crm/catalog-policy/catalog-item.operations.ts` contains only reused authorization, validation and audited request orchestration against a structural persistence port. It has no SQL, legacy implementation imports or provider clients. Independent Nest services reuse this plain class without inheriting decorated provider metadata.
- Existing DTOs, response types and catalog metadata remain shared contracts for HTTP compatibility, not a reason to put entity SQL in shared files.
- `src/integrations/legacy-crm/projects/` owns the Projects SELECT reader and pure mapper. `campaigns/` independently owns the Campaigns SELECT reader and mapper. Shared connection/configuration stays at the integration root; `legacy-catalog.reader.ts` is a query-free compatibility bridge only.
- No new schema, migration, seed or data cleanup is part of this folder refactor. Campaigns still uses shared native storage; moving its legacy reader does not imply a dedicated native Campaigns table already exists.
- Remove the legacy AppModule registration before deleting the legacy integration directory; disabling the flag alone does not remove compile-time imports.

`crm_project` owns a BIGINT internal key, unique ULID public ID, unique native code and nullable unique `id_old_produccion_project`. It has project-specific names, detail, status, timestamps, soft-delete fields and actor foreign keys. There is no catalog discriminator. `crm_project_external_reference` has real foreign keys to the project and `int_external_system`. UNIQUE `(external_system_id_project_external_reference, external_id_project_external_reference)` reserves provider identity even when archived. Providers remain extensible: NetSuite, Odoo or future providers require configuration, not new project columns. Signed IDs are strings. Legacy fallback does not insert native projects.

Migration `202610090009_projects_domain` requires `CRM_THINK_V2` and empty shared project data; non-empty input is rejected before DDL. It creates the two dedicated tables and CHECK constraints that forbid `projects` in both shared tables. It does not seed projects, users or providers. Run only this migration against the existing emptied baseline using `pnpm migrate:identity:schema --only=202610090009_projects_domain`, with `MIGRATION_CONFIRM_SCHEMA_ONLY=CRM_THINK_V2` supplied securely. Reruns are idempotent. Historical migrations remain for reproducibility and the other domains; no broad identity rebuild is performed.

Real MySQL tests: `PROJECT_MYSQL_TESTS=1 pnpm exec vitest run test/catalogs/projects.repository.mysql.spec.ts`. Fixtures use transaction/savepoint rollback, including their temporary actor/provider; no login users or catalog records remain committed. Generic catalog persistence tests now exercise Campaigns instead of Projects.

### Optional Legacy Access: Projects Synchronization

Owner-authorized change, 2026-10-09: Projects legacy identities are editable and can be activated/inactivated. Authentication, scoped permissions, validation and audit remain mandatory; no delete endpoint exists. Campaigns and other legacy catalogs remain read-only.

Every legacy reader/writer uses the single gate in `integrations/legacy-crm/legacy-crm-access.ts`, backed by `ENABLE_LEGACY_FALLBACK`. Environment changes require an API restart. Disabled access performs no new legacy operations; it does not cancel an already-running transaction. Physical removal also requires removing the integration registration/import from AppModule.

Projects core uses the optional `PROJECTS_LEGACY_ACCESS` port, never concrete legacy SQL imports. The isolated Projects writer executes parameterized SQL through the native transaction on the same MySQL server. Both project tables must use InnoDB: native fields, provider references, legacy changes and audit commit or roll back together. The independent legacy SELECT pool still enforces read-only transactions. Never change shared credentials or grants.

Create with the gate enabled inserts in both databases and retains the generated legacy ID. Editing a legacy-only item first inserts its canonical native record and references, then updates the linked legacy row. Existing linked native items synchronize changes to legacy. Editing a native-only item does not create a legacy counterpart. With the gate disabled, native create/update/status remain operational without legacy calls. The frontend follows the returned canonical ID after promotion.

Legacy mapping is exact: `id_proyecto` is the legacy link, `Nombre_proyecto` the name, `id_ProNetsuite` the NetSuite integer, and `estado_proyecto` is 1 for active / 0 for inactive. The existing NOT NULL NetSuite column requires exactly one valid signed INT NetSuite identifier for mirrored writes; do not invent placeholder IDs. Description and Odoo remain native-only because legacy has no corresponding columns. Legacy duplicate name/NetSuite creation and conflicting reference ownership are rejected.

The following read-only activation notes describe the earlier baseline, superseded for Projects mutations by the rules above.

Verification for the Projects write change: four isolated writer tests compile/record parameterized SQL without executing legacy DML; seven native MySQL rollback tests cover persistence, promotion, synchronization orchestration, disabled access and failure rollback; three existing real legacy MySQL tests verify read-only access, merged listing and disabled fallback. This does not establish a live legacy DML smoke test. Both target project tables were confirmed InnoDB. The initially empty native provider registry was configured with active NetSuite/Odoo definitions only; no business records or additional users were seeded.

`ENABLE_LEGACY_FALLBACK=false` is the distribution default; the approved local runtime enables it. Projects query native storage first, then append unmigrated legacy records, excluding all `id_old_produccion_project` values (including deleted projects) before legacy filtering/counting/pagination. Pages are native-first, then legacy name/ID order; total is the sum of native filtered rows and unmigrated legacy filtered rows. Campaigns retain empty-native-catalog fallback. No lazy migration, dual-write, schema changes or data cleanup are performed.

The core depends only on the optional `CATALOG_FALLBACK_READER` port. `integrations/legacy-crm` owns its independent pool, reader and pure mapper. Disabled startup creates no legacy pool. Per the owner's explicit instruction, legacy reuses `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` and `DB_SSL_CA`, changing only the database name. Obsolete `LEGACY_CRM_DB_USER/PASSWORD` values are ignored. The shared account is not privilege-level read-only: mandatory session read-only transactions and SELECT-only adapter functions enforce this boundary in application code. Never alter shared credentials or grants. Apply environment changes by restarting the API. To retire immediately, disable the flag and restart; to delete physically, remove the integration import/registration from `AppModule`, then delete its folder. The optional core port and native persistence remain valid without a legacy provider.

The adapter reads only `crmdatabase-api.proyectos` (`id_proyecto`, `id_ProNetsuite`, `Nombre_proyecto`, `estado_proyecto`) and `crmdatabase-api.campanas` (`id_Campana`, `id_NetsauiteCampana`, `Nombre_Campana`, `Estado_Campana`). Queries bind search, status and pagination values. Count and page use one read-only transaction. Connection or mapping failures return 503, never a misleading empty list.

Existing response keys remain unchanged. Legacy items add numeric `id_old_produccion` and use stable `legacy:projects:<id>` or `legacy:campaigns:<id>` public identities, not fabricated native ULIDs. Their display code is `legacy_<catalog>_<id>`. Missing timestamps return an empty string, rendered as unassigned by the existing UI; no date is invented. Null status is conservatively inactive; unsupported status values fail validation. Signed NetSuite IDs remain exact strings. Absent Odoo references stay absent.

Earlier baseline: legacy rows rejected update/status with 403 and disabled drawer/row actions. This is now superseded for Projects only by the synchronization rules above. No single-item endpoint is introduced; lazy promotion occurs only during an authorized mutation.

Shared-credential activation was verified on 2026-10-09: native Projects empty, 36 canonical legacy projects returned, legacy transaction `@@transaction_read_only=1`, and the embedded Projects view displayed all 36 records. Global environment validation now explicitly preserves optional `LEGACY_CRM_DB_NAME`; otherwise `.env` values could be dropped before Nest constructs the pool even though standalone dotenv tests passed. Three opt-in `LEGACY_CATALOG_MYSQL_TESTS=1` tests cover real read-only sessions, rollback-only native migration fixtures with duplicate/filter exclusion, and the kill switch. No legacy writes, account changes or data imports were used. Legacy identities remain read-only in the API/UI; native identities remain writable.

Historical `202610030007_crm_catalogs` adds the shared storage retained for non-project domains:

- `crm_catalog_item`: unsigned BIGINT primary key; unique CHAR(26) public identity; catalog VARCHAR(80); native code VARCHAR(140), unique within catalog; name VARCHAR(180); nullable detail VARCHAR(500); active/inactive status; millisecond timestamps; actor FKs to `sec_user`; soft-delete history.
- `crm_catalog_item_external_reference`: unsigned BIGINT primary key; item/provider FKs; catalog VARCHAR(80); external ID VARCHAR(180); active/inactive status; optional JSON metadata; timestamps and soft-delete history. UNIQUE `(catalog_code_catalog_item_external_reference, external_system_id_catalog_item_external_reference, external_id_catalog_item_external_reference)` reserves archived ownership as well.

Absent Odoo means no reference row, not a placeholder ID. Signed numeric provider IDs can be stored exactly as strings. Uniqueness is per catalog/provider, not across all catalogs. CRM relationships use internal IDs, never vendor IDs.

Mutation and audit share one transaction. Unchanged reference rows remain intact; removed references are soft-deleted; archived references restore only for the same item; new references are inserted. Pre-flight checks and database uniqueness handle ownership/races. Audit failure rolls back the mutation.

`202610080008_administration_owner_repair` separately repairs Administration identity/linkage, Owner permissions/memberships and affected sessions with audit. Exact scope and tests are in document 34. Preserve historical migrations.

## Frontend and Verification

All seven routes share `CatalogItemsPage`/`CatalogItemsDataTable`, users CSS and `useDataTableSearchPanes`. Saved state is isolated by module/catalog. Local filters cover loaded rows; additional batches/retries do not discard loaded records. Drawer providers remain separate with explicit unassigned values.

Run `.\check-all.cmd` from the root. From `apps/api`, explicitly enable `CATALOG_MYSQL_TESTS=1` for rollback-only persistence tests and `CATALOG_MYSQL_COVERAGE=1` for repository V8 execution-range evidence. Direct `.env` MySQL is used, never Docker. Document 34 records measured coverage, browser evidence and unresolved ETL gates; test passes do not establish full branch coverage or acceptance.
