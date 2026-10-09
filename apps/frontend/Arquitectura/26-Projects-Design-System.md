# 26 - Enterprise UX Rules: Projects Reference and Replication Guide

Effective: 2026-10-09. Owner-directed rule for Projects only.

## How to Use This Single Reference

This document consolidates the current Projects experience: colors, fonts, density,
search, filters, desktop grid, mobile cards, detail drawer, forms, loading states,
interaction, accessibility and verification. It is sufficient as a design brief;
the source inventory at the end identifies the existing implementations to reuse.
No chat history or instruction to "look at Projects" is required.

Copyable implementation brief:

> Apply this document's Enterprise UX Rules to the explicitly requested module.
> Reuse existing components and tokens, adapting only domain labels and fields.
> Preserve authorization, validation, audit, API contracts and data behavior.
> Implement all applicable states, responsive rules and reduced-motion behavior.
> Treat accessibility overrides as mandatory. Verify with tests and integrated
> preview, and report deviations or missing evidence rather than claiming parity.

EN: Rules and implementation guidance are in English; user-facing copy remains
Spanish (Costa Rica). ES: Referencia unica reutilizable del diseno completo;
conservar textos de interfaz en espanol y declarar diferencias verificables.

### Replication Boundary

Reading this guide does not automatically authorize restyling other modules.
For an approved replication, opt the new page and its portals into a local scope;
do not add Projects selectors to unrelated routes or globally override Ant Design.
The reference is an operational CRM surface, not a marketing page: compact,
scan-friendly, restrained and usable with keyboard and touch.

Use the current installed React/TypeScript, Ant Design, DataTables/SearchPanes
and existing Administration primitives. Do not introduce another component or
table framework solely to reproduce this design. Dashboard-design was given
precedence among design skills; product constraints, the rules below and
accessibility take priority over generic examples or defaults from any skill.

### Superseded Directions

- The final primary action is dark neutral, not saturated blue or teal.
- Filters form three contiguous tracks, not table-column-aligned tracks with gaps.
- Initial table loading uses a centered ring, not table/search/filter skeletons.
- Drawer loading retains sparse label/value skeleton pairs, not the table ring.
- Radius is 8px for record cards and panels, not the requested 12px mobile variant.
- Meaningful small labels use 600, not inaccessible shade 400.

## Scope and Precedence

This is the normative color contract for the Projects data grid, search header,
filter toolbar and row, detail drawer, and Create/Edit/status modals. It does not
authorize changes to global navigation, authentication, other catalogs, or APIs.
Product scope and accessibility requirements take precedence over decorative use.
Historical visual documents remain unchanged; this contract supersedes earlier
Projects palette suggestions, not the canonical product rules.

ES: Contrato obligatorio de colores exclusivo de Proyectos. Accesibilidad y alcance
del producto prevalecen sobre decisiones decorativas. No modifica otros modulos.

## Primitive Tokens

Runtime source: `src/modules/administration/catalogs/ProjectsView.css`.
Use `var(--color-neutral-N)` rather than repeating hex values in component styles.
These primitives are scoped to `.catalog-items-page--projects`,
`.catalog-item-detail-drawer--projects`, and `.catalog-items-modal--projects`.
Portal-rendered drawers and modals must retain their Projects scope class.

| Shade / Token Suffix | Exact Value | Functional Role | Accessibility Constraint |
| --- | --- | --- | --- |
| 50 | `#f5f7fa` | Local page canvas and body surfaces | Not a text color. |
| 100 | `#ebeef3` | Row hover, secondary surfaces, skeleton base | Selected state also needs a non-color cue. |
| 200 | `#d2dae5` | Card perimeter, section dividers, subtle cell grid lines; shimmer highlight | Decorative separators only; not the sole essential control boundary. |
| 300 | `#abbbce` | Idle input border treatment and inactive icon treatment | Disabled/decorative icons only; essential input boundaries require a stronger companion or override. |
| 400 | `#7d96b3` | Placeholder treatment, auxiliary and secondary icon treatment | Do not use for meaningful small text on light surfaces; override to 600. |
| 500 | `#5d799a` | Secondary emphasis, metadata/badge styling; stronger control boundaries | Small metadata/badge text on 50/100/white must use 600 or darker. |
| 600 | `#496180` | Interactive icon hover, links, secondary actions; secondary labels | Default accessible muted text on light surfaces. |
| 700 | `#3c4f68` | Primary cell text and table column titles | Use for readable table/toolbar typography. |
| 800 | `#354357` | Section headings and modal panel subheaders | Preserve heading hierarchy through size/weight as well as color. |
| 900 | `#2f3a4b` | Main page titles, prominent drawer/modal headers, top-level text | Use for hierarchy, not broad dark backgrounds. |
| 950 | `#0e1116` | High-emphasis dark accents and primary action backgrounds | Pair with white text/icons. This is not authorization to implement dark mode. |

White `--color-surface: #ffffff` is the record/control surface and the foreground
on dark primary buttons. No replacement blue/teal palette or arbitrary shade is
permitted without an explicit design decision updating this contract and tests.

## Semantic Bindings

Preserve the existing semantic aliases rather than defining another token system:

| Existing Alias | Binding | Purpose |
| --- | --- | --- |
| `--color-canvas` | 50 | Local canvas |
| `--color-hover`, `--color-primary-light` | 100 | Hover/secondary surface |
| `--project-border` | 200 | Structural dividers |
| `--color-control-border` | 500 | Accessible essential control outline override |
| `--project-muted`, `--color-secondary`, `--project-focus` | 600 | Muted text, secondary interaction, visible focus |
| `--color-primary-dark` | 900 | Dark primary hover/active background |
| `--color-primary` | 950 | Primary resting background |

The raw primitive definitions are fixed. When adding aliases, reference primitives
with CSS variables rather than duplicating values; do not rename existing aliases
or introduce a global theme as part of a local Projects change.

## Component Application Matrix

| Surface | Background / Structure | Text / Interaction |
| --- | --- | --- |
| Page and search header | 50 canvas; white search surface; 200 dividers | Page title 900; body 700; auxiliary copy 600 |
| Filter action toolbar | 50 band; 100 counter badge; 200 separator | Counter 700; secondary commands 600; disabled states remain distinguishable |
| Horizontal filters | White controls; 300 idle treatment with accessible boundary override to 500 | Labels 700; meaningful placeholders 600; interactive icons 600 on hover |
| Data grid | White rows; 100 header/hover; 200 perimeter/grid lines | Column titles and cell values 700; metadata 600; hierarchy text 900 |
| Detail drawer | 50 body; white record/provider cards; 200 dividers | Record title 900; section titles 800; labels 600/700; values 700 |
| Create/Edit/status modals | 50 body; white grouped fields; 200 section borders | Modal title 900; subheaders 800; labels 600/700; essential input outline 500 override |
| Primary actions | 950 resting; 900 hover/active | White label and icon; inherit icon color; visible 600 focus ring |
| Secondary actions | White resting; 100 hover; accessible 500 border | 600 resting; 900/950 emphasis; retain visible keyboard focus |
| Table loading | White canvas; 200 border; 100 ring with 600 accent | Centered 34px ring, 400px minimum height; 900 primary message, accessible 600 caption; 400ms crossfade and 4px grid reveal; static under reduced motion |
| Drawer skeleton | White/50 surfaces; slender 100/200 placeholders | Label/value pairs; 2-second opacity pulse (0.15-0.20), no gradient sweep; static under reduced motion; accessible loading announcement |

Provider cards remain separate. Missing references use visible `Sin asignar`, never
blank or invisible fields. Typography stays compact: body 13-14px, metadata 12px,
section headings 14px, drawer/modal title 18px, page title 22px. Do not enlarge type
or change padding to compensate for weak color contrast.

## Filter Grouping Rule

Projects filters form one contiguous three-column grid with equal flexible tracks,
16px gaps and shared 16px side padding inside the neutral-50 filter band. Search
and filter tools remain inline with a shared baseline. Below 768px, the same group
stacks into one column to avoid horizontal page overflow. Expanded value lists
remain attached to their respective control and retain independent scrolling.
The initial table loader replaces filter placeholders with a centered indicator. This supersedes the
earlier five-table-column placement with empty Description/action tracks; filters
must not be scattered across those unused tracks. Preserve the outer 200 dividers
and accessible stronger input outlines described above.

## Accessibility Gate

Normal meaningful text, including placeholders and badge text, must meet 4.5:1.
Large text must meet 3:1; essential control boundaries and meaningful icons must
meet 3:1 against adjacent surfaces. Disabled controls and purely decorative lines
have different requirements, but must never be mistaken for actionable controls.
Never communicate active, selected, error, or loading state through color alone.

Computed WCAG relative-luminance checks (ratios rounded for display):

| Pair | Ratio | Decision |
| --- | --- | --- |
| 300 / white | 1.96:1 | Insufficient as sole input boundary |
| 400 / 50 | 2.84:1 | Insufficient for meaningful text/icon |
| 400 / white | 3.05:1 | Not sufficient for normal text |
| 500 / 50 | 4.19:1 | Suitable boundary, not normal text |
| 500 / 100 | 3.87:1 | Not normal badge text |
| 600 / 50 | 5.92:1 | Normal text permitted |
| 600 / 100 | 5.46:1 | Normal text permitted |
| 700 / white | 8.37:1 | Normal text permitted |

Shade 500 on white rounds to 4.50:1 but is slightly below 4.5 unrounded; it must
not be approved by rounding. Use 600 for normal text. These mandatory contrast
overrides qualify the requested shade roles; they do not change the palette.

Preserve semantic success `#067647` on `#ecfdf3`, warning `#93370d` on `#fffaeb`,
and Ant Design's existing error/danger semantics. The neutral scale must not erase
validation errors or destructive-action cues. Verify every actual foreground,
background and state, including disabled opacity and lazy-loaded CSS overrides.

## Enforcement and Current Conformance

Before accepting a Projects styling change:

1. Use scoped primitives/aliases and the component matrix; no unrelated modules.
2. Verify computed styles for page, drawer and both modal modes, including portals.
3. Run `pnpm exec vitest run test/catalogs/projects-palette.spec.ts test/catalogs/CatalogItemsPage.spec.tsx`
   in `apps/frontend`, followed by the repository `check-all.cmd` when runtime code changes.
4. Verify keyboard focus, hover/selected/disabled/error states, responsive overflow,
   missing values and reduced-motion loading in the integrated Codex preview.
5. Record evidence and exceptions in `25-Continuidad-Administracion.md`.

The existing palette test protects exact primitive values across the three scope
roots and selected contrast pairs; it does not prove every component follows this
matrix. At adoption, runtime still uses 950 for page/drawer titles, 600 for table
headers and 900 for table cell text. Those are readable but differ from the new
hierarchy mapping. Idle input outlines deliberately use 500 for accessibility.
This documentation-only change does not silently restyle components or claim full
conformance. Integrated visual verification remains pending authentication.

ES: Los tokens y sus funciones quedan como regla de desarrollo. Las excepciones
de contraste son obligatorias; las diferencias actuales se registran sin afirmar
cumplimiento visual completo. Nuevos cambios deben aportar pruebas y evidencia.

## Typography and Density

Use `Aptos, "Segoe UI", system-ui, sans-serif` for body and headings. Do not load a
new font or scale typography with viewport width. Base size is 13px, line-height
1.5, letter-spacing 0. Font availability determines the actual fallback face.

| Element | Size / Weight / Line Height | Rule |
| --- | --- | --- |
| Page title | 22px / inherited heading weight / 1.3 | One main entity heading |
| Drawer and modal title | 18px / inherited heading weight / 1.4 | Compact, wrapping panel heading |
| Form section legend | 14px / 650 / 20px | 8px vertical, 16px horizontal padding |
| Drawer card heading | 14px / inherited card weight | Minimum 40px heading band |
| Desktop project name | 14px / 650 / 1.5 | Primary row identity |
| Mobile project name | 16px / 600 / 1.5 | Shade 950, wrap rather than collide |
| Inputs, buttons, drawer values | 13px / component default | Do not enlarge to compensate for contrast |
| Mobile metadata values | 14px / component default | Label above content |
| Table column titles | 12px / 650 | Current runtime uses shade 600 |
| Metadata, timestamps, filter counter | 12px | Readable 600 or darker |
| Status badges | 12px / 600 / 1.5 | Text plus semantic state cue |

Spacing tokens: `--space-1:4px`, `--space-2:8px`, `--space-3:12px`,
`--space-4:16px`, `--space-6:24px`. Default radius `--radius:8px`.
Use 16px panel/form/card padding, 16px section gaps, 8px action gaps.
Documented component exceptions are 6px integration gaps, 10px mobile divider
padding and 24px loader padding. Do not invent per-screen spacing scales.

Administration control height is 36px unless overridden: global table search
minimum 40px, refresh 44px square, mobile controls/targets minimum 44px.
Textarea heights follow configured row counts; not every control is a fixed height.

## Page Structure and Search

Resolved hierarchy, in order:

1. Breadcrumb, entity title and existing supporting caption.
2. Header actions: icon-only refresh and `Nuevo proyecto` with leading plus.
3. Dedicated white search band with 200 dividers and 16px padding.
4. Neutral-50 filter band containing action toolbar and contiguous filter row.
5. Independently bounded data grid with pagination/info band below.
6. Optional loaded-record count and `Cargar más` when the API has another batch.

Page content is centered with maximum width 1440px and shrinkable children.
Do not wrap all bands in an additional decorative floating card. Individual
drawer records/provider groups and form sections are legitimately framed.
Search width is 440px maximum 100%; mobile width is 100%. Placeholder is
`Buscar en Proyectos`. Search remains DataTables' existing search; do not add
a parallel state store or duplicate filtering implementation.

## Filter Toolbar and State

The filter toolbar uses vertically centered flex layout with 8px gaps. Left group:
`Filtros activos: N` and `Limpiar`. Right group: `Expandir` and `Contraer`.
Clear's trailing auto margin separates the groups. Counter is a state badge:
100 fill, 200 border, 999px radius, 12px/600 text, 4px by 12px padding,
24px line-height. Do not center it in otherwise empty space.

Three filters: `Proyecto`, `Integraciones`, `Estado`. Grid:
`repeat(3, minmax(0, 1fr))`, 16px gap, 12px vertical/16px horizontal padding.
Every pane has `min-width:0`, shared baseline and no independent top margin.
Input and tool controls use non-wrapping horizontal flex even in SearchPanes'
narrow mode. Open value lists remain attached and independently scrollable.
Do not revive the unused measured table-track spacing.

Reuse `useDataTableSearchPanes`: collapsed initial panes, cascading options,
visible totals, columns 0/2/3 enabled and Description/actions excluded. The active
counter is SearchPanes' selected-filter count, not a hardcoded number, open-pane
count or necessarily a count of global-search terms. Preserve clear/expand/collapse
semantics and disabled states. Counter announcements use `aria-live="polite"`
where the current toolbar synchronization attaches it.

Use a versioned table preference key per module/catalog/context. Persist table
preferences only; never credentials or authorization. Blocked/full storage and
invalid JSON must not break the view. Increment the key version when state shape
changes. Filter/search scope is the loaded rows, not a claim that all production
records have already been fetched.

## Desktop Grid and Row Interaction

Columns: Project, Description, Integrations, Status, Actions. Current widths are
26%, 29%, 25%, 220px and 64px respectively; DataTables/table layout resolves their
combined allocation. These are not five percentages adding to 100%.
Table minimum width 900px, fixed layout. Local scroll canvas maximum height 640px,
`overflow:auto`, thin scrollbar, 48px scroll padding. Sticky headers use `top:0`
and local `z-index:1`. Align the scroll flex child at `flex-start`: centering an
oversized table previously placed its first rows above the scroll origin.
Do not fix this by escalating global z-index or clipping the page.

Header and cells: 12px vertical/16px horizontal padding; values can wrap anywhere.
Header surface 100; white record surface; 200 dividers. Hover changes cell
background over 140ms; selected row has 100 surface and visible focus treatment.
Focus outline is 2px 600 with -2px inset on table rows. Preserve row selection
identity through public ID, not visible position or project name.

Clicking a non-interactive row area opens the detail drawer. Focusable rows also
open with Enter or Space. Buttons, links, inputs, selects, labels and menu items
must not accidentally trigger row navigation. The ellipsis menu provides Edit
and Inactivate/Reactivate and stops propagation; do not duplicate mutations in
the drawer component. Escape display strings for SearchPanes text output.

Project name is the primary identity. Description falls back to `Sin asignar`;
last-updated metadata uses `es-CR` dates and a semantic `time` element. Integration
rows show provider name and identifier, including explicit unassigned providers.
External IDs use tabular numerals; do not cast to positive numbers or invent IDs.
Status is visible text (`Activo`/`Inactivo`) with a compact badge and existing dot.
Do not rely on color alone or confuse reference status with project status.

Default sort: project ascending. Page size: 10; choices: 10/25/50/100. Preserve
saved order/search/page/panes and empty/filtered counts. Loaded batches and page
size are different concepts; `Cargar más` must not falsely represent all records.

## Responsive Mobile Cards

At widths below 768px, transform the same table rows into cards; do not maintain
a second independently fetched or filtered dataset. Hide headers visually while
retaining the table's existing caption/column semantics. Expose the existing
`Ordenar proyectos` select for sorting, including custom-order state.

- Table minimum width becomes 0; local maximum-height scrolling is removed.
- Body is a grid with 12px gaps and 12px padding on the canvas surface.
- Card: white, 1px 200 border, radius 8px, 16px padding.
- Header: `minmax(0, 1fr) auto auto`, 8px column/12px row gap, top aligned.
- Title occupies column 1, status column 2 and action column 3 of row 1.
- Title and metadata allow `overflow-wrap:anywhere`; never force ellipsis over
  essential identity just to protect a rigid column.
- Description and integrations span all columns, stack label above value with
  8px gap, 100 top divider and 10px padding above the section.
- Integration groups use wrapping flex, 6px gaps, 50 fill, 4px/8px padding and
  4px corners. IDs must wrap without widening the card.
- Mobile action buttons retain 44px minimum targets. Footer controls wrap.

Mobile filter panes stack into one column, not a forced horizontal page scroller.
Toolbar counter/clear and expand/collapse occupy deliberate grid positions;
page header actions become full-width. Modals' provider grid becomes one column.
Verify at 320px, 375px, 390px, 768px, 1024px and 1440px, with long unbroken
identifiers and multi-line names. These are acceptance viewports, not claims of
completed device validation.

## Detail Drawer

Reuse the Administration/Users drawer composition, not a new standalone panel:
right placement, 560px configured size constrained by `max-width:100vw`,
z-index 1300, close at the end of the header, refresh icon with tooltip.
Existing shared mask: black at 25% with 2px backdrop blur; wrapper uses the shared
border/shadow. Do not silently change shared chrome when replicating local tokens.
Body has `min-height:0`, independent vertical scrolling and contained overscroll.
Header/footer remain separate from the scrolling record body; padding is 16px.

Header order: existing 48px entity avatar/icon, wrapping title, catalog label,
status. Section order: `Información del registro` (name/detail), `Registro`
(CRM ID/native code/update time), then a distinct card per provider (NetSuite,
Odoo, other returned providers). Cards are white, radius 8px, 200 border;
40px heading band with 50 fill, 16px body padding and 16px between cards.
Descriptions use one column, horizontal label/value layout and no colon.

Each provider owns its system code, external identifier and reference status.
Never mix providers in one card or infer synchronization success from a missing
reference. NetSuite/Odoo placeholders are read-only display data. Missing/null/
undefined/blank strings display `Sin asignar`; real identifiers are copyable,
unassigned placeholders are not. Do not submit fabricated placeholder references.
IDs use compact code styling on 100 fill. Record timestamps use `es-CR` date/time.

Footer: `Registro X de Y`, adjacent previous/next icon controls, Edit, and
Inactivate/Reactivate. Boundary arrows are disabled; actions disappear while
loading or in error. ArrowUp/ArrowDown navigate records except when focus is
inside an input, textarea, select, dropdown/menu/listbox. Preserve list ordering
and context rather than inventing a new drawer-only ordering.

Loading uses the drawer skeleton defined below. Error/missing record uses an
error Alert and `Reintentar`. Never show failure as an unassigned field or offer
mutation actions against unavailable detail.

## Create, Edit and Status Modals

Reuse the connected Ant Design Form (`form={form}`), vertical labels and optional
markers. Create/Edit modal uses `forceRender` to keep the useForm instance
connected; status confirmation uses `destroyOnHidden`. Do not replace these with
unconnected forms or generic dialogs. Both are centered and use z-index 1400,
above the drawer. No custom modal width is declared here: the installed Ant Design
default applies; verify rather than inventing a fixed width.

Modal shell: radius 8px, 200 perimeter, 50 header/body/footer, 16px padding.
Body maximum height 65dvh, independent vertical scroll and contained overscroll.
Header title 18px; supporting text uses 600. Form has 16px section gaps;
white fieldsets with 200 border, compact 14px section legend and 16px field area.
Desktop provider groups share two columns; mobile uses one. Footer is right-aligned
with 8px button gaps. Preserve visible validation and danger colors.

Sections: record information, isolated NetSuite/Odoo inputs, audit reason.
Name required/minimum 2 characters; detail textarea 3 rows/maximum 500;
external reference inputs optional; audit textarea 4 rows/maximum 255 and required
minimum 5 characters. These describe current UI validation, not authorization to
relax backend rules. Trim submitted text, omit empty external references, preserve
provider identities, and display controlled API conflicts/errors without closing
the form as if successful. Never create provider records from empty fields.

While saving, primary action indicates progress and cancel is disabled. Preserve
existing submit/close lifecycle. Status confirmation shows effective old/new state,
requires trimmed reason of at least 5 characters and marks inactivation dangerous.
UI permissions are not a substitute for server authorization.

Current copy exceptions: header primary is exactly `Nuevo proyecto`; modal titles
still interpolate the catalog label (for example `Nuevo Proyectos`), create submit
is `Crear valor`, and status titles contain `valor`. Document these as existing
copy debt, not desired domain terminology. An exact clone preserves them until
copy cleanup is authorized; a new module brief must explicitly name its entity.

## Buttons, Icons and Interaction States

Primary: 950 fill/border, white text and icon; hover/active 900. Active uses the
existing 1px white inset cue. Align icon/text using inline flex, centered with 8px
gap. Leading plus and action icons are 16px and inherit button color. Do not change
SVG geometry or add custom strokes to icons from the installed Ant Design set.
Refresh is 44px square with accessible label/tooltip; disable during list/batch/
mutation activity. Its spinning icon follows list loading, not an arbitrary delay.

Secondary: white fill, accessible 500 outline, 600 text/icon; hover 100 fill with
stronger 950 text/border. Visible focus: 2px 600 outline, 2px offset. Disabled
controls retain component semantics; never style them as active controls.
SearchPanes' raster tools are an existing vendor exception: 15px background glyph,
grayscale opacity 0.65 idle / 0.85 hover or focus. Essential icons need adequate
contrast regardless of the decorative token suggestion.

Active status: success text/fill defined above. Inactive/unassigned: neutral100
fill/600 text. Pending reference: warning pair. Keep error/danger separate from
neutral styling. Status pills use 4px/8px padding and 8px corners; only the filter
counter uses the fully rounded 999px treatment.

## Table Preloader: Exact Lifecycle

Use the existing `CatalogItemsDataTable` wrapper rather than delaying requests or
building a second table. DOM structure while pending:

```text
projects-view-load-canvas [aria-busy]
  projects-view-loader [role=status, aria-label="Cargando proyectos"]
    projects-view-loader__ring [aria-hidden=true]
    projects-view-loader__title
    projects-view-loader__caption
  projects-view-grid-reveal [resolved data, when available]
```

Visual geometry:

| Part | Exact Rule |
| --- | --- |
| Canvas | Relative positioning; minimum height 400px |
| Loader | Absolute inset 0; local z-index 2; flex column centered both axes |
| Shell | White, 1px 200 border, 8px radius, 24px padding, centered text |
| Ring | 34px square, border-box, 2px 100 border, top border 600, fully round |
| Rotation | 1 second, linear, infinite |
| Primary | `Cargando proyectos...`, 14px/500, 900, 8px top margin |
| Caption | `Sincronizando registros y catálogo CRM`, 12px, accessible 600 |
| Stack gap | 4px |
| Exit | Opacity to 0 over 400ms ease-out; pointer events disabled |
| Grid entrance | 400ms ease-out, opacity 0 to 1, translateY(4px) to 0 |

State algorithm (presentation guidance, not additional business state):

1. Initial pending means request loading AND no rows. Show the centered loader.
2. Once resolved, mount the grid/empty/error result immediately; keep the outgoing
   indicator mounted for its 400ms fade. Do not postpone the response or data.
3. Clear the presentation timeout on unmount or a state change. Retries from an
   empty result must show the loader again; rapid resolves must not leave it stuck.
4. Refresh with existing rows keeps the grid mounted; do not replace usable data
   with the initial ring or reset filters solely for a presentation transition.
5. Empty response is `Sin resultados`; request failure is an explicit alert.
   Never keep animating indefinitely after a settled error.
6. Under `prefers-reduced-motion:reduce`, remove rotation, exit transition and
   entrance animation. The existing presentation cleanup can still run; no motion
   is required to communicate progress.

The 400px minimum prevents a collapsed canvas, not all layout shifts. Final table
height depends on rows/viewport. Do not promise zero CLS or flicker-free rendering
without measured browser evidence. Do not restore search/filter placeholder blocks
or a dense skeleton table alongside this loader.

## Drawer Loading and Other States

Drawer status label: `Cargando detalle`. Render five airy pairs hidden from the
accessibility tree beneath that announcement. Pair: tiny 6px-high label at 24%
width, value 8px-high at 62% width, 12px between, 16px vertical padding and 16px
bottom margin. Reserved detail area minimum height 520px. Rounded-full placeholders
use neutral200 with a 2-second ease-in-out opacity pulse from 0.15 to 0.20; no
high-contrast sweep or dense solid slabs. Reduced-motion is static neutral100.

Do not reuse the initial-table ring for saving, pagination, provider status or
error handling. Save/load-more buttons use their existing loading affordances;
modals do not have an invented full-form preloader. Errors retain actionable copy;
absent values retain `Sin asignar`. A loading field, absent value, failed request
and unconfigured integration are four different states.

## Implementation Recipe and Acceptance Checklist

1. Inspect target module and reuse its existing data and permission lifecycle.
2. Apply scoped primitive/semantic tokens to page, drawer and modal portal roots.
3. Establish typography, spacing and geometry before adding interactive polish.
4. Compose search band, cohesive filter toolbar, contiguous panes and bounded grid.
5. Reuse one row dataset for desktop/mobile, one detail drawer and connected forms.
6. Implement every state above, including empty providers, errors and reduced motion.
7. Add regressions first; verify isolated scope and existing contracts after changes.
8. Run focused tests, then full project checks sequentially; review the complete diff.
9. Inspect in Codex integrated preview with an authenticated account. Do not open
   external browsers to bypass the requested workflow or bypass authentication.

Acceptance must cover: long names/IDs; 200% text zoom; narrow viewports; first row
visible at scroll origin; local rather than page overflow; focused row Enter/Space;
action menu propagation; counter clear/expand/collapse; saved-state restoration;
loaded versus total counts; drawer independent scroll and boundary navigation;
optional providers and copy controls; create/edit/status validation and failures;
retry/rapid-load/refresh behavior; all focus/hover/selected/disabled/error states;
reduced motion and computed foreground/background contrast across portal surfaces.

Use existing focused suites in `apps/frontend`:

```powershell
pnpm exec vitest run test/catalogs/projects-palette.spec.ts test/catalogs/CatalogItemsPage.spec.tsx
```

For runtime changes run `.\check-all.cmd` from the repository root. Do not introduce Docker or database
mutations to validate a documentation/design-only change. Database assertions,
when independently required, follow the existing isolated direct-MySQL workflow.

## Source Inventory and Known Differences

All paths below are relative to `apps/frontend`. They are implementation pointers,
not prerequisites for understanding the visual rules above.

| Source | Responsibility |
| --- | --- |
| `src/modules/administration/catalogs/ProjectsView.css` | Local tokens, responsive geometry, states and animations |
| `src/modules/administration/catalogs/CatalogItemsPage.tsx` | Header, forms, request/mutation lifecycle and error presentation |
| `src/modules/administration/catalogs/CatalogItemsDataTable.tsx` | Preloader, grid, row actions, sorting, preferences and SearchPanes |
| `src/modules/administration/catalogs/CatalogItemDetailDrawer.tsx` | Record/provider sections, fallback values, navigation and detail loading |
| `src/modules/administration/hooks/useDataTableSearchPanes.ts` | Cascading panes and safe table-state storage |
| `src/modules/administration/administration-theme.ts` | Shared controls, drawer size/layers and overlay chrome |
| `src/modules/administration/components/UserDetailDrawer.css` | Inherited drawer composition |
| `src/modules/administration/catalogs/CatalogItemsPage.css` | Shared catalog base and inherited avatar styling |
| `test/catalogs/projects-palette.spec.ts` | Token/contrast/layout regressions, not browser pixel measurements |
| `test/catalogs/CatalogItemsPage.spec.tsx` | Component interaction/loading/modal regression coverage |

Exact current implementation and normative matrix are not identical everywhere:
page/drawer titles and some drawer values use 950; table header 600; cell values
900; drawer card headings 900. These are accessible but not the matrix's intended
700/800/900 hierarchy. Shared avatar/overlay shadows still contain Administration
colors outside the local neutral scale. Do not claim that every rendered pixel is
tokenized or silently repair these differences during documentation work.

Latest preceding runtime verification (2026-10-09, recorded in document 25):
51 focused tests; frontend 152 passed; API 227 passed / 12 opt-in tests skipped;
format/lint/typecheck and both builds passed after a formatting correction.
Existing bundle-size warning remains. Those results are historical evidence,
not a new test run for this document. Authenticated integrated visual verification,
device overflow checks, CLS measurements and full WCAG audit remain unconfirmed.

Update this document whenever approved behavior or design rules change. Record
test/browser evidence separately in `25-Continuidad-Administracion.md`. Do not
replace this single reference with conflicting per-screen palette documents.

ES: Para replicar, usar este documento completo, reutilizar componentes existentes
y adaptar solo el dominio autorizado. No ocultar datos ausentes, no mezclar
proveedores, no cambiar contratos ni declarar validacion visual sin evidencia.
