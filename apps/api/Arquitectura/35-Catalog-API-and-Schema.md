# 35 - Catalog API and Schema

Current consolidation (2026-10-13): [36 - Delivery register](36-Registro-Entrega-Administracion.md), [37 - Audit and conflicts](37-Auditoria-Trazabilidad-y-Conflictos.md), and [frontend 27](../../frontend/Arquitectura/27-Entrega-Administracion-y-QA.md) distinguish implemented behavior, historical evidence and remaining gates. Unit Files owns a dedicated read aggregate; historical generic Files storage below is not its inventory persistence. Secondary standalone selectors were superseded by native SearchPanes.

Implementation reference, 2026-10-09. Source of truth: catalog controller, DTOs, service, repository and migrations. Product scope and Administration acceptance gates remain unchanged.

## Unit Files Migration Plan (2026-10-12)

Owner-approved scope: dedicated Unit Files schema, read API and criteria-first
Administration/operational view. The verified physical source is
`crmdatabase-api.expedientes`, not `expediente_unidad`. No legacy DML or DDL,
credential changes, deletion, deployment or automatic creation of fictitious
projects is authorized by this implementation.

1. Preflight: verify all 30 source columns, existing native project/provider
   ownership, duplicate project provider IDs, missing project links and source
   status values. The migration script defaults to report-only.
2. Apply only the seed-free native unit schema. Preserve every source business
   field as nullable text of its existing capacity; keep source IDs/timestamps
   and project-name snapshot separately. Native project FK is mandatory.
3. Explicit native-only preparation may promote verified unique legacy projects
   with provider links and an Owner audit event. Never overwrite existing native
   names/references or guess mappings by project name/legacy project PK.
   Skip ambiguous/unresolved project groups and retain them in the report.
4. Read API requires one or more canonical project IDs (the former three-project cap was removed). Default 50/max 100 rows, opaque
   filter-bound native/legacy keyset cursor, no per-page total, no growing NOT IN
   exclusion list. Legacy anti-join uses the indexed native legacy identity.
   Source-specific resolution is inside the optional legacy adapter. The single
   ENABLE_LEGACY_FALLBACK switch gates every legacy call.
5. Full detail includes all source business fields and provider references.
   Native reads never depend on the legacy adapter. Unsupported relationships
   cannot be persisted without a verified native project; no orphan reassignment.
6. View: explicit Search, stable loading area, server-side filters, bounded
   short-lived page cache, Back without another query while fresh, and up to
   eight compared records across pages. No unit query on mount.
7. Validate schema parity, criteria rejection, cursor binding, anti-join,
   disabled fallback, authorization, rollback-only native persistence, live
   read-only legacy access and embedded desktop/mobile UI. Real legacy writes
   are not part of testing.

Verified preflight snapshot: 3,358 units; six blocked reference groups (1,332
units): 2 (1), 21 (100), 9 (982), 7 (134), 40 (113), 0 (2).
Reference 40 is duplicated in Projects; the other references are unmatched.
These are reconciliation blockers for the affected groups, not permission to
repair production automatically. No claim of complete inventory migration
may be made while those mappings remain unresolved. Legacy filter indexes
remain a separately approved, measured production optimization.

### Applied Unit Files Scope and Recovery

Migrations `202610120015_unit_files_domain` and
`202610120016_unit_files_naming` were applied only to `CRM_THINK_V2`.
The second is a data-preserving rename to official snake_case/entity-suffix
column names; the first migration remains immutable. Both are seed-free.
Twenty-one verified project identities/provider links were prepared with an
Owner audit event. Two pre-existing native projects were left unchanged;
native projects now total 23. No unit inventory was imported: native unit tables
remain empty after rollback-only integration tests. Legacy writes: zero.

Run `pnpm exec tsx scripts/prepare-unit-files.ts` from `apps/api` for report-only
schema and relationship validation. It checks source column names/types/
capacities/nullability and native provider ownership, including missing or
deleted mappings. `--apply-project-identities` is an explicit native-only,
transactional, idempotent preparation step, not an inventory importer. It fails
on ownership conflicts and never overwrites native records. Recheck the report
before any future import or deprecation. Do not guess unresolved links by name.

Native ownership: `crm_unit_file.project_id_unit_file` references
`crm_project.id_project`; external identifiers belong in
`crm_unit_file_external_reference` with a provider FK and unique
provider/external-ID ownership. Legacy project references are provenance only.
All 27 source business values are preserved losslessly as nullable text;
timestamps become ISO strings, monetary placeholders are not coerced to zero.
The complete mapping is `unit-files.contract.ts` (source) and
`unit-files.columns.ts` (native). The remaining three source columns are the
legacy record ID, unit provider ID and source project reference.

This phase exposes only GET operations. Unit create/edit, lazy promotion,
dual-write and conflict reconciliation are NOT implemented or enabled here.
There is no unit deletion endpoint. Disabling `ENABLE_LEGACY_FALLBACK` makes
the native API independent of the optional adapter; it does not migrate any
unimported records. Do not decommission legacy until inventory reconciliation
and migration are separately completed. Emergency UI rollback restores the
previous route; do not drop tables or reverse project identities automatically.

### Unit Files HTTP Contract

The dedicated view uses `/unit-files`, never generic catalog persistence.
All endpoints require an authenticated session and the current scoped
`{moduleCode}.catalog_file.read` permission (active Owner behavior unchanged).

- `GET /unit-files/projects?moduleCode=administration`: native canonical
  project options only; no inventory scan.
- `GET /unit-files/options?moduleCode=administration&projectIds=<CRM-ID>&kind=housingType&limit=50`:
  authenticated distinct choices, canonical projects required, default 50/max 100.
  `kind` is `housingType` or `code`; optional `search` (substring),
  `after` (last returned value), exact `status`, and `housingType` for
  unit choices. Returns `{items: string[], hasNext, nextAfter: string|null}`.
  Each source returns at most limit+1 distinct values; binary ordering, native
  anti-join and bounded deduplication keep pagination consistent. No source
  pool is touched with the global legacy switch off. SQL remains SELECT-only
  in a read-only transaction with the source timeout guard. Bounded output
  does not imply an indexed source DISTINCT; legacy tuning is still pending.
- `GET /unit-files?moduleCode=administration&projectIds=<CRM-ID>[,<CRM-ID>]&limit=50`:
  canonical projects required; default 50/max 100; optional exact source `status`,
  `housingType`, `code`, code substring `codeMatch`, and opaque `cursor`.
  Secondary SearchPanes selections use JSON arrays `codes`, `housingTypes`,
  `statuses`, and `paneProjectIds`: OR within a pane, AND across panes and primary
  criteria. Arrays are validated (max 500 entries) and included in cursor binding.
  Inventory remains keyset-paginated: no offset or load-all.
- `GET /unit-files/facets?...&kind=code&limit=100`: authenticated aggregate
  choices for `code`, `projectIds`, `housingType`, or `status`.
  Returns `{items:[{value,count}],nextAfter}` with binary seek pagination.
  Counts cover the full primary scope, not the loaded inventory batch. Each pane
  excludes only its own secondary selection, preserving other panes and primary
  constraints. Native counts plus unmigrated legacy counts are merged; legacy
  retains the anti-join, read-only transaction, timeout and global kill-switch.
  Aggregations can scan scoped rows even though their output is bounded; no
  production indexes or schema are modified by this reader.
- `GET /unit-files/:id?moduleCode=administration`: full detail. Unmigrated unit
  routing keys remain internal (`legacy:unit-files:<PK>`); the drawer displays
  pending migration, never a fabricated CRM identity. Native detail wins for a
  promoted legacy link. Unknown/unresolved records return 404.

Explicit DTO query pipes are required: the tsx development runtime does not
emit the decorator metadata necessary for implicit DTO transformation.
Unfiltered, wrong-context or oversized requests return 400 before SQL.
Legacy query failures return 503, not a misleading empty success.

Illustrative list envelope (not live business values):

```json
{
  "items": [{
    "id": "01M4EQAYMCHDJ6RESTS95RQPP5", "nativeCode": "unit_files_01m4eqaymchdj6rests95rqpp5",
    "legacyId": 42, "project": { "id": "01M4RCK911NS2ZNCRYPBD40B9W", "name": "Example" },
    "code": "A-101", "housingType": "A", "status": "available", "sourceStatus": "1. Disponible para Venta",
    "advertisedSalePrice": "100000", "habitableArea": "80",
    "estimatedDelivery": "31/12/2027", "totalArea": "100", "lotArea": "150",
    "approximateParkingArea": null, "updatedAt": "2026-10-12T00:00:00.000Z"
  }],
  "pagination": { "limit": 50, "returned": 1, "hasNext": false, "nextCursor": null }
}
```

Detail extends a summary with `values` (all 27 canonical field keys),
`sourceMetadata: {projectReference: string|null}` and
`externalReferences: [{systemCode, externalId, status}]`. Provider names occur
only as data in references, never in public field names. Missing references
produce an empty array, not an active `"null"` identifier. Native and legacy
use the same mapper. Cursor phase transitions use the final returned row,
not the look-ahead; an indexed native anti-join excludes migrated legacy rows.

Verification: `UNIT_FILES_MYSQL_TESTS=1 pnpm exec vitest run test/unit-files`
passed 22 tests, including scoped dropdown seek queries, live read-only source access, native 27-field/provider
persistence rolled back, HTTP transformation, authorization, cursor boundaries,
schema/mapping safety, SQL anti-join execution and disabled/absent adapter behavior. Native project
filter indexes exist; legacy project/status/type indexes are not added by this
work. Production-scale query plans still require separate measurement/approval.

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

### Live Testing Readiness Audit - 2026-10-12

Direct inspection of the API-configured database confirmed `DATABASE() =
CRM_THINK_V2`. Both `crm_campaign` and `crm_campaign_external_reference`
exist as InnoDB tables, with unique public/native/legacy identities, actor
foreign keys and provider foreign keys. Both contain zero records. NetSuite
and Odoo are active providers. The migration runner reports
`202610120010_campaigns_domain` already applied; no replay is necessary.

The separate legacy source contains 291 campaigns and 36 projects.
`ENABLE_LEGACY_FALLBACK=true`; refreshing the authenticated Campaigns preview
returned 291 campaigns while the native Campaigns tables remained empty.
Reads do not seed or import records. Shared storage is empty and its CHECK
constraints prohibit Projects and Campaigns.

| Domain | Native persistence | Independent schema readiness |
| --- | --- | --- |
| Projects | `crm_project`, `crm_project_external_reference` | Implemented |
| Campaigns | `crm_campaign`, `crm_campaign_external_reference` | Implemented and connected |
| Classes | `crm_class`, `crm_class_external_reference` | Implemented and connected |
| Locations | `crm_location`, `crm_location_external_reference` | Implemented and connected |
| Subsidiaries | `crm_subsidiary`, `crm_subsidiary_external_reference` | Implemented and connected |
| Brokers | `crm_broker`, `crm_broker_external_reference` | Implemented and connected |
| Files | `crm_catalog_item`, `crm_catalog_item_external_reference` | Dedicated cutover not implemented |

Files still uses shared native CRUD and does not participate in legacy merge
or dual-write. Its schema/API/adapter cutover must be implemented and verified
separately before claiming Projects-equivalent readiness.

The initial readiness audit recorded only the Projects and Campaigns
cutovers despite the existing identity baseline. This is not evidence that
older identity migrations are safe to replay. Preserve the ledger and users;
reconcile historical migration state explicitly before a full deployment run.
Use the targeted Campaigns runner for this testing scope.

### Independent Campaigns Domain - 2026-10-12

Campaigns now uses `crm_campaign` and `crm_campaign_external_reference` only,
through its own controller, service, repository, tables, fallback and optional
`CAMPAIGNS_LEGACY_ACCESS` port in `src/modules/crm/campaigns/`.
`/catalogs/campaigns/items` preserves the Projects request/response contract;
the shared repository rejects Campaigns. Permissions, CSRF, audit, validation,
pagination and absence of delete endpoints remain unchanged.

Native pages are read first, then unmigrated legacy rows fill remaining capacity.
All native `id_old_produccion_campaign` values are excluded before legacy filters,
counts and pagination; filtered/fully populated native pages do not disable merge.
The single `legacy-crm-access.ts` gate controls every legacy read/write.
Disabled startup opens no reader pool; disabled access leaves native CRUD working.
Environment changes require restart and do not cancel in-flight transactions.

Enabled create inserts both schemas and retains the generated legacy ID. Editing
a legacy identity promotes it once, then synchronizes the linked row. Native-only
edits do not create legacy rows. Native/provider/audit/legacy changes use the same
server-side InnoDB transaction. The separate SELECT pool remains read-only.
Legacy columns are `id_Campana`, `id_NetsauiteCampana`, `Nombre_Campana`,
`Estado_Campana` in `crmdatabase-api.campanas`; status is 1/0. Unlike Projects,
the external ID is nullable: no assigned NetSuite ID writes NULL, not a made-up ID.
Assigned values must fit signed INT. Detail, Odoo and future providers stay native.

Migration `202610120010_campaigns_domain` requires CRM_THINK_V2 and empty shared
Campaigns rows/references, failing before DDL if data needs an explicit move.
It creates two dedicated tables with column comments, unique native/legacy keys,
provider ownership and actor/provider foreign keys, and blocks Campaigns in shared
storage. It inserts no users, providers or business records. Apply independently:
`pnpm migrate:identity:schema --only=202610120010_campaigns_domain`.
Do not reset the ledger, truncate tables or rerun unrelated identity repairs.

Verification: `CAMPAIGN_MYSQL_TESTS=1` enables native rollback tests in
`test/catalogs/campaigns.repository.mysql.spec.ts`.
`CAMPAIGN_LEGACY_MYSQL_TESTS=1` additionally enables actual same-server
two-schema rollback fixtures (requires existing InnoDB tables and approved access).
Eight tests passed locally, including post-rollback absence of fixture rows in
both schemas. The integrated preview returned 291 legacy campaigns and opened
the populated edit form without saving production records. Other five unsplit
domains remain in shared storage. Legacy deprecation requires removing its
AppModule registration before physically deleting the integration directory.

### Independent Projects Domain - 2026-10-09

Projects now uses only `crm_project` and `crm_project_external_reference`, through its own `ProjectsModule`, controller, service and repository under `src/modules/crm/projects/`. Its explicit `/catalogs/projects/items` routes preserve the existing frontend contract; the generic repository rejects Projects instead of routing its queries. The other five catalog domains remain in shared storage after the Campaigns cutover; dropping their tables is outside this step.

### Mandatory Feature Folder Ownership

- Each implemented dedicated table aggregate owns its controller, service, repository and domain-specific fallback under `src/modules/crm/<entity>/`. Future Leads and Estimates verticals must follow this structure when their dedicated tables are implemented; do not scaffold empty CRUD modules.
- A reference child table stays with its parent aggregate: `crm_project_external_reference` belongs to Projects because reference replacement and project mutations must remain atomic. Shared provider configuration (`int_external_system`) remains infrastructure, not a separate CRUD implementation copied into every feature.
- `src/modules/crm/catalog-policy/catalog-item.operations.ts` contains only reused authorization, validation and audited request orchestration against a structural persistence port. It has no SQL, legacy implementation imports or provider clients. Independent Nest services reuse this plain class without inheriting decorated provider metadata.
- Existing DTOs, response types and catalog metadata remain shared contracts for HTTP compatibility, not a reason to put entity SQL in shared files.
- `src/integrations/legacy-crm/projects/` owns the Projects SELECT reader and pure mapper. `campaigns/` independently owns the Campaigns SELECT reader, mapper and transactional writer. Shared connection/configuration stays at the integration root; `legacy-catalog.reader.ts` is a query-free compatibility bridge only.
- Campaigns now has a dedicated native schema through migration `202610120010_campaigns_domain`; no business seed or data cleanup accompanies the cutover.
- Remove the legacy AppModule registration before deleting the legacy integration directory; disabling the flag alone does not remove compile-time imports.

`crm_project` owns a BIGINT internal key, unique ULID public ID, unique native code and nullable unique `id_old_produccion_project`. It has project-specific names, detail, status, timestamps, soft-delete fields and actor foreign keys. There is no catalog discriminator. `crm_project_external_reference` has real foreign keys to the project and `int_external_system`. UNIQUE `(external_system_id_project_external_reference, external_id_project_external_reference)` reserves provider identity even when archived. Providers remain extensible: NetSuite, Odoo or future providers require configuration, not new project columns. Signed IDs are strings. Legacy fallback does not insert native projects.

Migration `202610090009_projects_domain` requires `CRM_THINK_V2` and empty shared project data; non-empty input is rejected before DDL. It creates the two dedicated tables and CHECK constraints that forbid `projects` in both shared tables. It does not seed projects, users or providers. Run only this migration against the existing emptied baseline using `pnpm migrate:identity:schema --only=202610090009_projects_domain`, with `MIGRATION_CONFIRM_SCHEMA_ONLY=CRM_THINK_V2` supplied securely. Reruns are idempotent. Historical migrations remain for reproducibility and the other domains; no broad identity rebuild is performed.

Real MySQL tests: `PROJECT_MYSQL_TESTS=1 pnpm exec vitest run test/catalogs/projects.repository.mysql.spec.ts`. Fixtures use transaction/savepoint rollback, including their temporary actor/provider; no login users or catalog records remain committed. Generic catalog persistence tests now exercise Files, outside the dedicated aggregates.

### Optional Legacy Access: Projects Synchronization

Owner-authorized change, 2026-10-09: Projects legacy identities are editable and can be activated/inactivated. Authentication, scoped permissions, validation and audit remain mandatory; no delete endpoint exists. Campaigns, Classes, Locations, Subsidiaries and Brokers have the same exception as of 2026-10-12; other legacy domains are not authorized for writes.

Every legacy reader/writer uses the single gate in `integrations/legacy-crm/legacy-crm-access.ts`, backed by `ENABLE_LEGACY_FALLBACK`. Environment changes require an API restart. Disabled access performs no new legacy operations; it does not cancel an already-running transaction. Physical removal also requires removing the integration registration/import from AppModule.

Projects core uses the optional `PROJECTS_LEGACY_ACCESS` port, never concrete legacy SQL imports. The isolated Projects writer executes parameterized SQL through the native transaction on the same MySQL server. Both project tables must use InnoDB: native fields, provider references, legacy changes and audit commit or roll back together. The independent legacy SELECT pool still enforces read-only transactions. Never change shared credentials or grants.

Create with the gate enabled inserts in both databases and retains the generated legacy ID. Editing a legacy-only item first inserts its canonical native record and references, then updates the linked legacy row. Existing linked native items synchronize changes to legacy. Editing a native-only item does not create a legacy counterpart. With the gate disabled, native create/update/status remain operational without legacy calls. The frontend follows the returned canonical ID after promotion.

Legacy mapping is exact: `id_proyecto` is the legacy link, `Nombre_proyecto` the name, `id_ProNetsuite` the NetSuite integer, and `estado_proyecto` is 1 for active / 0 for inactive. The existing NOT NULL NetSuite column requires exactly one valid signed INT NetSuite identifier for mirrored writes; do not invent placeholder IDs. Description and Odoo remain native-only because legacy has no corresponding columns. Legacy duplicate name/NetSuite creation and conflicting reference ownership are rejected.

The following read-only activation notes describe the earlier baseline, superseded for Projects mutations by the rules above.

Verification for the Projects write change: four isolated writer tests compile/record parameterized SQL without executing legacy DML; seven native MySQL rollback tests cover persistence, promotion, synchronization orchestration, disabled access and failure rollback; three existing real legacy MySQL tests verify read-only access, merged listing and disabled fallback. This does not establish a live legacy DML smoke test. Both target project tables were confirmed InnoDB. The initially empty native provider registry was configured with active NetSuite/Odoo definitions only; no business records or additional users were seeded.

`ENABLE_LEGACY_FALLBACK=false` is the distribution default; the approved local runtime enables it. Projects query native storage first, then append unmigrated legacy records, excluding all `id_old_produccion_project` values (including deleted projects) before legacy filtering/counting/pagination. Pages are native-first, then legacy name/ID order; total is the sum of native filtered rows and unmigrated legacy filtered rows. Campaigns now has the same merge, lazy-promotion and dual-write behavior through its own domain module; no data cleanup is performed.

The core depends only on the optional `CATALOG_FALLBACK_READER` port. `integrations/legacy-crm` owns its independent pool, reader and pure mapper. Disabled startup creates no legacy pool. Per the owner's explicit instruction, legacy reuses `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` and `DB_SSL_CA`, changing only the database name. Obsolete `LEGACY_CRM_DB_USER/PASSWORD` values are ignored. The shared account is not privilege-level read-only: mandatory session read-only transactions and SELECT-only adapter functions enforce this boundary in application code. Never alter shared credentials or grants. Apply environment changes by restarting the API. To retire immediately, disable the flag and restart; to delete physically, remove the integration import/registration from `AppModule`, then delete its folder. The optional core port and native persistence remain valid without a legacy provider.

The isolated readers query only the explicitly mapped legacy tables: `crmdatabase-api.proyectos` (`id_proyecto`, `id_ProNetsuite`, `Nombre_proyecto`, `estado_proyecto`), `crmdatabase-api.campanas` (`id_Campana`, `id_NetsauiteCampana`, `Nombre_Campana`, `Estado_Campana`), and Classes/Locations/Subsidiaries sources documented below. Queries bind search, status and pagination values. Count and page use one read-only transaction. Connection or mapping failures return 503, never a misleading empty list.

Existing response keys remain unchanged. Legacy items add numeric `id_old_produccion` and use stable `legacy:projects:<id>` or `legacy:campaigns:<id>` public identities, not fabricated native ULIDs. Their display code is `legacy_<catalog>_<id>`. Missing timestamps return an empty string, rendered as unassigned by the existing UI; no date is invented. Null status is conservatively inactive; unsupported status values fail validation. Signed NetSuite IDs remain exact strings. Absent Odoo references stay absent.

Earlier baseline: legacy rows rejected update/status with 403 and disabled drawer/row actions. This is now superseded for Projects and Campaigns by the synchronization rules above. No single-item endpoint is introduced; lazy promotion occurs only during an authorized mutation.

Shared-credential activation was verified on 2026-10-09: native Projects empty, 36 canonical legacy projects returned, legacy transaction `@@transaction_read_only=1`, and the embedded Projects view displayed all 36 records. Global environment validation now explicitly preserves optional `LEGACY_CRM_DB_NAME`; otherwise `.env` values could be dropped before Nest constructs the pool even though standalone dotenv tests passed. Three opt-in `LEGACY_CATALOG_MYSQL_TESTS=1` tests cover real read-only sessions, rollback-only native migration fixtures with duplicate/filter exclusion, and the kill switch. No legacy writes, account changes or data imports were used. That historical read-only restriction is superseded for Projects and Campaigns; current writes follow the scoped rules above.

Historical `202610030007_crm_catalogs` adds shared catalog storage. It remains compatibility infrastructure, not the dedicated Unit Files inventory aggregate introduced by migrations 015/016:

- `crm_catalog_item`: unsigned BIGINT primary key; unique CHAR(26) public identity; catalog VARCHAR(80); native code VARCHAR(140), unique within catalog; name VARCHAR(180); nullable detail VARCHAR(500); active/inactive status; millisecond timestamps; actor FKs to `sec_user`; soft-delete history.
- `crm_catalog_item_external_reference`: unsigned BIGINT primary key; item/provider FKs; catalog VARCHAR(80); external ID VARCHAR(180); active/inactive status; optional JSON metadata; timestamps and soft-delete history. UNIQUE `(catalog_code_catalog_item_external_reference, external_system_id_catalog_item_external_reference, external_id_catalog_item_external_reference)` reserves archived ownership as well.

Absent Odoo means no reference row, not a placeholder ID. Signed numeric provider IDs can be stored exactly as strings. Uniqueness is per catalog/provider, not across all catalogs. CRM relationships use internal IDs, never vendor IDs.

Mutation and audit share one transaction. Unchanged reference rows remain intact; removed references are soft-deleted; archived references restore only for the same item; new references are inserted. Pre-flight checks and database uniqueness handle ownership/races. Audit failure rolls back the mutation.

`202610080008_administration_owner_repair` separately repairs Administration identity/linkage, Owner permissions/memberships and affected sessions with audit. Exact scope and tests are in document 34. Preserve historical migrations.

## Frontend and Verification

### Classes Dedicated Domain (2026-10-12)

Classes uses `modules/crm/classes` for its controller, service, repository, tables and optional legacy port. Its SQL and mapper are isolated in `integrations/legacy-crm/classes`; core Classes never imports concrete legacy adapters. The canonical response and audited create/update/status routes match Projects and Campaigns. There is no delete route.

Migration `202610120011_classes_domain` targets only `CRM_THINK_V2`, creates `crm_class` and `crm_class_external_reference`, and blocks Classes writes to the shared catalog tables. It refuses a cutover if shared Classes data exists. It inserts no business records, users or providers. Provider ownership is unique per external system/identifier, with separate native ULID and legacy identity.

The verified legacy source is `crmdatabase-api.clases`: `id_clases`, nullable `idNetsuite_clase`, nullable `nombre_clase` (100 characters), and nullable `estado_calase` (the spelling is intentional). Status 1 is active, 0/null inactive; unsupported values fail mapping. Names are limited to 100 characters in native storage, mutations and forms; identifiers support signed INT or null. Description and non-NetSuite providers remain native-only.

The same global `ENABLE_LEGACY_FALLBACK` gate controls every Classes legacy operation. Listings read native first, exclude all migrated legacy IDs, and append only unmigrated legacy rows with bounded pagination/counts. Editing a legacy identity promotes it to a native ULID and updates its linked legacy row atomically; creating mirrors to both when enabled. Native-only edits do not create legacy counterparts. With the gate disabled, native operations remain independent. The separate SELECT pool stays read-only; mirrored mutations use the existing same-server native transaction and require InnoDB tables.

Classes rollback tests: `CLASS_MYSQL_TESTS=1 pnpm exec vitest run test/catalogs/classes.repository.mysql.spec.ts`. Do not enable `CLASS_LEGACY_MYSQL_TESTS` without explicit authorization for actual legacy writes. Writer unit tests record SQL without touching legacy data; this is not a live dual-write smoke test.

### Locations Dedicated Domain (2026-10-12)

Locations owns `modules/crm/locations` and the isolated `integrations/legacy-crm/locations` reader, mapper and writer. Routes remain `/catalogs/locations/items` with the same canonical contract, scoped permissions and audited create/update/status operations as Projects/Campaigns/Classes. There is no delete endpoint.

Migration `202610120012_locations_domain` creates only `CRM_THINK_V2.crm_location` and `crm_location_external_reference`, with unique native/legacy identities, provider ownership and actor foreign keys. Shared-table CHECK constraints reject Locations writes; existing shared Locations data causes migration refusal instead of silent deletion. No business data, users or providers are seeded.

Verified legacy schema: `crmdatabase-api.ubicaciones` with auto-increment `id_ubicaciones`, nullable signed INT `idNetsuite_ubicaciones`, nullable `nombre_ubicaciones` VARCHAR(100), and nullable `estado_ubicaciones`. Status 1 is active and 0/null inactive. Native forms/mutations enforce the same 100-character name limit. Description and other providers remain native-only.

`ENABLE_LEGACY_FALLBACK` is the single gate for all Locations legacy reads/writes. Native-first paginated lists append unmigrated legacy rows, excluding every migrated legacy ID before counting/filtering. Legacy edits promote to a native ULID and update the linked row; create mirrors to both while enabled. Native-only edits never create a legacy counterpart. Disabled mode leaves native operations independent. Legacy SELECT transactions remain read-only; mirrored writes use the existing same-server native transaction and require InnoDB.

Verification commands: `LOCATION_MYSQL_TESTS=1 pnpm exec vitest run test/catalogs/locations.repository.mysql.spec.ts` for rollback-only native persistence; `LEGACY_LOCATIONS_MYSQL_TESTS=1 pnpm exec vitest run test/integrations/legacy-locations.mysql.spec.ts` for real read-only legacy access, merge/exclusion and kill-switch checks. Keep `LOCATION_LEGACY_MYSQL_TESTS` disabled unless explicitly authorized to test actual legacy DML. Unit writer tests only compile/record SQL.

### Subsidiaries Dedicated Domain (2026-10-12)

Subsidiaries owns `modules/crm/subsidiaries` and `integrations/legacy-crm/subsidiaries`, with its own controller, DTOs, repository, optional legacy port, reader, mapper and writer. Routes remain `/catalogs/subsidiaries/items`; canonical response, scoped permissions, audit and no-delete behavior match Locations.

Migration `202610120013_subsidiaries_domain` targets only `CRM_THINK_V2`, creating `crm_subsidiary` and `crm_subsidiary_external_reference`. Unique native/legacy identities, provider ownership and actor foreign keys follow the established domains. Shared-storage CHECK constraints prohibit Subsidiaries writes; existing shared records abort migration rather than being discarded. No users, providers or business records are seeded.

Verified source: `crmdatabase-api.subsidiarias`, with auto-increment `id_subsidaria` (intentional spelling), nullable signed INT `id_NetsuiteSub`, nullable `Nombre_Subsidiaria` VARCHAR(250), and nullable `Estado_Subsidiaria`. Status 1 is active, 0/null inactive; unsupported values fail mapping. Native storage, domain-specific create/update DTOs and forms all support names up to 250 characters. Shared validations remain inherited. Detail and non-NetSuite providers remain native-only.

The single `ENABLE_LEGACY_FALLBACK` gate controls every legacy operation. Native-first listings exclude migrated legacy IDs before legacy count/filter/pagination. Legacy edits promote into native storage and update the linked legacy row; creation mirrors to both while enabled. Native-only edits never invent a legacy counterpart. Disabled access leaves native operations independent. SELECT uses the separate read-only pool; mirrored writes share the native same-server transaction. Both native tables and legacy Subsidiaries were verified InnoDB.

Verification: `SUBSIDIARY_MYSQL_TESTS=1 pnpm exec vitest run test/catalogs/subsidiaries.repository.mysql.spec.ts` uses rollback-only native fixtures; `LEGACY_SUBSIDIARIES_MYSQL_TESTS=1 pnpm exec vitest run test/integrations/legacy-subsidiaries.mysql.spec.ts` checks real read-only access, merge/exclusion and disabled fallback. Keep `SUBSIDIARY_LEGACY_MYSQL_TESTS` disabled unless explicitly authorized for actual legacy DML. Writer unit tests compile/record SQL only, not live writes.

Read-only inspection found 44 legacy rows and two rows sharing NetSuite ID 63. Existing provider ownership/conflict rules intentionally reject this ambiguity during promotion/synchronization rather than silently merging subsidiaries. Resolve legacy ownership through an explicitly authorized data-cleanup workflow; this implementation does not alter legacy data.

### Brokers Dedicated Domain (2026-10-12)

The owner's scoped approval extends the established architecture to Brokers. Brokers owns `modules/crm/brokers`, `integrations/legacy-crm/brokers` and frontend `administration/brokers`. Routes remain `/catalogs/brokers/items`; canonical keys, scoped permissions, audit, pagination and no-delete behavior match the approved domains.

Applied migration `202610120014_brokers_domain` creates only `CRM_THINK_V2.crm_broker` and `crm_broker_external_reference`. It adds unique native/legacy identities, provider ownership and actor foreign keys, blocks generic Brokers storage, and aborts if shared Brokers records exist. It seeds no users, providers or business data.

The verified source is `crmdatabase-api.corredores`. Only `id_corredor`, `id_netsuiteCorredor`, `nombre_corredor` and `estado_corredor` are queried/mapped/written. Obsolete `valoridNetsuite`, category, company, phone and email columns are excluded from the canonical contract and native schema; legacy updates leave them untouched and inserts omit them. Native DTOs, storage and forms support 250-character names. Status 1 is active, 0/null inactive; invalid statuses are rejected. Signed or null NetSuite identifiers are retained exactly in the provider-reference table. Detail and other providers remain native-only.

The single `ENABLE_LEGACY_FALLBACK` gate controls all Brokers legacy reads and mirrored writes. Native-first listing excludes migrated legacy IDs before legacy count/filter/page operations. Legacy edits promote into native storage and update the linked legacy row; enabled creation mirrors to both. Native-only edits do not invent a legacy counterpart. Disabled mode leaves native persistence independent. Separate-pool SELECT transactions are strictly read-only; mirrored writes use the existing same-server native transaction and require InnoDB.

Verification: `BROKER_MYSQL_TESTS=1` enables rollback-only native tests and `LEGACY_BROKERS_MYSQL_TESTS=1` enables read-only legacy/merge/kill-switch tests. These passed alongside generic persistence tests (17 passed). Keep `BROKER_LEGACY_MYSQL_TESTS` disabled without explicit actual-legacy-DML test authorization; that test was skipped. Writer unit tests record SQL, not live writes.

The six editable dedicated catalog routes share `CatalogItemsPage`/`CatalogItemsDataTable`, users CSS and `useDataTableSearchPanes`. Saved state is isolated by module/catalog. Local filters cover loaded rows; revisiting cached server pages avoids another request. Drawer providers remain separate with explicit unassigned values. Unit Files instead owns `UnitFilesPage`/`UnitFilesDataTable`, native SearchPanes with full-scope facets and completeness-checked local filtering; see frontend document 27.

Run `.\check-all.cmd` from the root. From `apps/api`, explicitly enable `CATALOG_MYSQL_TESTS=1` for rollback-only persistence tests and `CATALOG_MYSQL_COVERAGE=1` for repository V8 execution-range evidence. Direct `.env` MySQL is used, never Docker. Document 34 records measured coverage, browser evidence and unresolved ETL gates; test passes do not establish full branch coverage or acceptance.
