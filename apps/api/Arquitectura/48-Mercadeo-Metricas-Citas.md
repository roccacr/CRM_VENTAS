# 48 - Marketing appointment metrics (authorized 2026-10-23)

## Current scope clarification - 2026-10-27

This document specifies Marketing Home, not the independent Capture report.
Capture (`GET /marketing/leads/report`) counts unique leads in creation cohorts:
completed takes precedence over scheduled, then no current appointment. It does
not count event volume or certify attendance. Its schema and source-quality
flags are documented in [53](53-Captacion-Leads-Reporte-Federado.md).
Removing the Events and appointments menu/permission in038 does not remove
calendar tables, Calendar navigation or either report's appointment calculations.
Historical SQL/test results below remain dated evidence, not new executions.

Owner authorizes read-only appointment aggregates in existing Marketing Home.
Read native first and optional legacy second; no imports, migration, type seeds,
calendar commands, permissions, Graph or notifications. This supersedes the old
appointment-excluded boundary only for these aggregates.

## Inspected implementation - 2026-10-23

The checkout implements these reads in the existing permission-protected
GET /marketing/home/summary. This is code inspection, not a new runtime, SQL,
test, browser, deployment or CI verification. The coordinator reports a fresh native
SELECT-only snapshot (2026-10-23T23:57:46Z): all eight 034 tables, including
conf_calendar_event_type, have zero rows, and all 106 columns have comments.
The ledger snapshot at 23:56:17Z includes 031/032/034 and excludes 033. That evidence
does not verify legacy values or populated native appointment behavior.
The native classification reader exists; positive-record verification awaits
real configuration/data. An empty catalog does not prove that reader's behavior
with populated native appointments.
There is no calendar command API, Outlook integration, bell runtime or new calendar
permission grant. See [47 - Schema boundary](47-Calendario-Compartido-Esquema.md)
and [49 - Current state](49-Estado-Actual-y-Cierre-Documental.md).

A lead may have no events, non-appointment events, multiple Cita events, or both.
Classify by event type Cita, never the obsolete cita_lead flag, event title or the
lead's commercial stage. A stage change does not establish an appointment or
attendance. The predicates below describe existing code, not approval to seed
new types or invent additional mappings. Count distinct event IDs, not participant,
organizer or supervisor copies; lead conversion and event volume are different.

Identify native appointment event by configured type code cita/appointment or exact
normalized type name Cita, across origin modules. Link through appointment.lead FK
or active event_link entity_type=lead/public ULID. UNION removes repeated linkage.
Ignore organizer/creator/participants for attribution: use the linked lead owner
and project, respecting the existing seller scopes. Soft-deleted events/links do
not count. Inactive type configuration does not erase historical appointments.

Legacy tipo_calendar=Cita is authoritative, not appointment flags used on other
types. The prior 2026-10-23 observations recorded calendars.id_lead pointing to
leads.idinterno_lead, not leads PK; accion_calendar contained
Pendiente/Completado/Cancelado and estado_calendar=0 occurred for completed and
cancelled rows. It cannot be treated as deletion evidence. Those observations
reported progreso_calendar as zero throughout, not attendance evidence.
copiaJefe is a visibility
flag on the event, not an extra event. Count distinct event identity, not people.
Ambiguous legacy provider-to-lead joins are excluded and reported. Ambiguous
native aliases do not establish native precedence; the mapper keeps legacy
identity instead of assigning an arbitrary native lead.

Lead conversion: captured cohort in selected creation dates; at least one linked
noncancelled scheduled/completed appointment at any appointment date. Unique lead
only once even with multiple events. Cancelled-only leads remain without a visit.
Recent follow-up uses the same rule for leads captured in the last seven days.
Completed appointment volume uses event start date within the selected period,
including leads captured earlier. Scheduled/cancelled counts remain separate.
Completed status does not prove attended: use native appointment progress for
verified attendance/misses. Legacy completion alone does not manufacture attendance.

The JSON adds aggregate leads-with-appointment rows and unique appointment events
with seller/project dimension pairs, not lead identities or customer information.
One event linked to multiple leads counts once if any same dimension pair matches
the filters. No Cartesian seller/project matching across different links.
Known native lead external identity takes precedence over the legacy lead when
unambiguous; old appointments can therefore mark a native canonical cohort.
Event IDs are source-scoped: do not merge unrelated events by date/title or by an
external Outlook ID without its account/calendar scope. No imported native events
currently exist. Missing/invalid dates and unresolved links are reported.

The implementation uses the same read-only repeatable snapshot. It bounds raw
internal cohorts/aliases to 100k and event/link rows to 50k; only aggregate cohort
counts are exposed. Expensive cohort/event reads include MAX_EXECUTION_TIME
hints; this is not proof of a global timeout on every statement or connection.
Frontend reuses filters, photos/preload and existing panels; no fictitious fallback.
This documentation review did not rerun acceptance scenarios or application
checks. The implementation verification recorded below includes automated
cohort/filter scenarios, independent legacy count comparisons and browser
checks; it remains separate from inspection of the present documents.

## Exact predicates, availability and evidence limits

The native reader tests LOWER(TRIM(code_calendar_event_type)) IN
('cita','appointment') OR LOWER(TRIM(name_calendar_event_type))='cita'. The legacy
reader tests LOWER(TRIM(tipo_calendar))='cita', not nombre/title. These are the
implemented predicates, not a seeded native catalog or a newly decided mapping.
The old-source field observations above remain prior evidence from 2026-10-23;
this documentation review did not query legacy or reproduce those observations.

Legacy accion_calendar is normalized: pendiente -> scheduled, completado ->
completed, cancelado -> cancelled; other values -> unknown. Its attendance is
always null. Native attendance reads only progress attended/missed. The frontend
counts attendance only among completed events, keeping pending, cancelled and
unverified completion separate; scheduled never proves an attended visit.

The model uses source-prefixed event IDs and a map to deduplicate events and
dimension pairs. A lead qualifies once for conversion with scheduled/completed
evidence, even if its event date is outside reporting coverage; event volume is
bounded by event start date. No event means no conversion; non-Cita events do not
qualify and cancelled-only or unknown-only events do not qualify. This is a linked
appointment metric, not proof of attendance or a commercial stage transition.

With legacy disabled the builder receives empty legacy appointment evidence and
can return native-only available=true. With required evidence absent it returns
available=false; enabled-source query failures fail the summary rather than
publish invented zeros. nativeTypeConfigured=false does not disable valid legacy
metrics. Global scope exposes unresolved/invalid-date diagnostics; restricted
seller scope suppresses those global counts. No new data or access is created.

Code evidence, relative to apps/api: src/modules/crm/marketing/
marketing-appointments.repository.ts, marketing-appointments.model.ts,
marketing-appointments.contract.ts, marketing-home.repository.ts,
marketing-home.model.ts, marketing-home.service.ts and marketing-home.module.ts;
src/integrations/legacy-crm/legacy-marketing-appointments.reader.ts and
legacy-marketing-home.reader.ts. Frontend evidence, relative to apps/frontend:
src/services/marketing/home-summary-service.ts,
src/modules/home/marketing-appointments.model.ts and MarketingHomePage.tsx.

Remaining verification: populated-native classification/link consistency and
positive attendance evidence, CI and deployment are not certified. Legacy
counts and browser observations below belong to the preceding implementation
run; this documentation pass did not refresh them. The recorded 034 constraints
and the earlier 46 test counts do not supply populated-native proof.

## Historical implementation verification - 2026-10-23

The coordinator confirmed these results from the immediately preceding
implementation turn. This document revision did not execute these checks again.

This section records results supplied by the concurrent Marketing implementation
task. The documentation worker did not execute or independently reproduce these
SQL, browser or test runs. They apply to that task's observed checkout/data at
execution time, not a frozen release or a new validation of the shared tree.

Real MySQL SELECTs executed in read-only transactions; native calendar tables and
configured appointment types are currently empty. No native business fixtures
were inserted, so native positive-record behavior is covered by model tests and
schema/query execution, not a persisted native appointment example.

At verification time (Oct 1-23), the combined Home showed 1,064 captured leads,
24 distinct captured leads with a noncancelled appointment (2.3%), and 37 unique
appointment events starting in the period: 26 completed, 3 pending, 8 cancelled.
Independent legacy SQL counts agreed with the 24 leads and 26/3/8 events.
Two historical Cita rows have no lead reference; they are excluded from attributed
metrics and reported through global quality metadata/notice. Restricted scopes
do not disclose those global orphan counts.

All four periods were executed against MySQL. Browser verified month totals,
Dayan+Marlon comparison and their two photos, and BC Lofts filtering. No import,
seed, migration or database mutation was performed for this extension.

API lint/typecheck/build passed; full API suite: 5,455 passed, 118 skipped.
Frontend lint/typecheck/build and Home/App suite passed (392 tests). Later
focused Marketing runs passed 67 tests and 58 connected/preview tests; these
overlapping runs must not be added into a unique-test total. The skipped MySQL suites are not
persistence proof; real native appointment rows remain unverified as stated above.
Frontend build retains the existing large AntD chunk warning.

Final documentation reread, 2026-10-23: the current API contracts/model and legacy
reader still implement the predicates, unique cohorts and source-scoped events
described above. The frontend keeps event-date volume separate from captured-lead
cohorts. test/home/marketing-appointments.spec.ts (relative to apps/frontend)
contains four cases for multi-link counting, same-link dimension matching,
event-date/status/attendance separation and unverified legacy completion; these
cases were read, not run by this worker. Alerts now use readable group labels
and omit blank campaign/ad groups. Concurrent code changes mean this inspection
is a moving-checkout observation, not evidence of a frozen application artifact.

## Presentation wording - 2026-10-26

Authorized UI clarification: the completed-event card now says Citas marcadas
como completadas, explicitly preserving its event-date count and separate
attendance evidence. Lead cards say registros and explain unique-lead conversion
versus people. Comparisons show actual date ranges; source-drop alerts show
absolute difference, both counts and percentage, ordered by absolute lead loss
before the existing three-alert cap. Existing thresholds and all API/DB contracts
remain unchanged. Nonzero quality issues use plain Spanish without zero counters.
The evidence above remains dated implementation evidence, not new executions.
