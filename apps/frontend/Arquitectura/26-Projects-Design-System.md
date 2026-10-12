# 26 - Enterprise UX Rules: Projects Reference and Replication Guide

Effective: 2026-10-09. Last updated: 2026-10-12 (owner-approved final state, rated
10/10). Owner-directed rule for Projects only.

## How to Use This Single Reference

This document consolidates the current Projects experience: colors, fonts, density,
search, filters, desktop grid, mobile cards, detail drawer, forms, loading states,
interaction, accessibility and verification. It is sufficient as a design brief;
"Library Integration Notes" lists the DataTables/SearchPanes/Ant Design quirks the
design depends on, "Replicating in Another Module" is the step-by-step recipe, and
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

Approved Campaigns adoption (2026-10-09): `/home/administration/catalogs/campaigns`
reuses the existing Projects presentation classes and shared catalog components,
including their portal scopes. These class names identify reusable presentation,
not API routing or record identity. The campaign code, authorization context and
table storage key remain campaign-specific. Use `Campaña`, `Nueva campaña`,
`Crear campaña`, `Editar campaña`, `Actualizar campañas` and `Cargando campañas...`.
The same three filters, row drawer, provider cards, optional references, audited
forms, mobile cards and reduced-motion transitions apply. Other catalogs retain
their existing presentation. No new styling copy or separate token scale is needed.

ES: Campañas reutiliza el diseno de Proyectos con sus propios datos y etiquetas.
No cambia permisos, contratos, auditoria ni referencias externas firmadas.

Approved navigation adoption (2026-10-09): the owner authorized the same visual
language for the desktop header/menu/workspace selector and mobile navigation.
`GlobalHomeShell.css` overrides existing shell aliases only at those navigation
roots: 50 canvas, 100 hover/selection, 200 separators, 500 control boundaries,
600 secondary text/focus, 900 text/hover, 800 dark active and 950 dark menu.
Typography is Aptos/Segoe UI/system, 13px, line-height 1.5; menu/popover corners
are 8px. Existing route, permission, dropdown positioning, responsive drawer and
keyboard behavior remain authoritative. This exception does not apply the palette
to every module's content or introduce Projects-only loaders into navigation.

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

Do not reintroduce any of these; each was tried and rejected by the owner.

- The final primary action is dark neutral, not saturated blue or teal.
- Filters are not aligned to table columns with empty Description/action tracks.
- Initial table loading uses a centered ring, not table/search/filter skeletons.
- Drawer loading retains sparse label/value skeleton pairs, not the table ring.
- Radius is 8px for record cards and panels, not the requested 12px mobile variant.
- Meaningful small labels use 600, not inaccessible shade 400.
- Search is not a separate white band above the filters; it shares the toolbar row.
- The filter toolbar is not a separate band with left (counter/clear) and right
  (expand/collapse) groups; those commands live in the toolbar's last track.
- Open filter lists never float over the grid (absolute dropdowns covered rows and
  paging when several were open). They expand the toolbar in flow.
- Expanded filter lists do not leave an empty area under search (see
  "Unified Toolbar and Filter Panel").
- `Expandir` and `Contraer` are never visible together.
- No vendor `^`/`v` text carets, sort buttons or magnifier glyphs in filters.
- No native browser focus ring on the inner pane input (it drew a second black box).
- No horizontal scrollbar inside a filter list.
- No `Actualizado …` line under the description; it belongs under the name.
- No plural entity copy in modals (`Editar Proyectos`).
- No repeated visible `Sin asignar` across the grid; use the quiet dash.
- Drawer labels are never as heavy as their values (the shared 650/600 pairing).
- No `Estado de referencia` row inside a single-reference provider card; the
  status pill lives in the card header.
- No 10.2px ID chips (AntD `code` default inside 12px text).
- No `Registro X de Y` counted over the loaded list while the table is filtered
  or re-sorted.
- No horizontal scrollbar in the grid at a ~930px viewport (900px minimum width).
- No create/edit modal scroll on desktop (`max-height: 65dvh` body); scroll is
  only for mobile or genuinely short windows.

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
`.catalog-item-detail-drawer--projects`, `.catalog-items-modal--projects` and
`.catalog-items-dropdown--projects` (row action menu). Portal-rendered drawers,
modals and menus must retain their Projects scope class. Ant Design cannot read
CSS variables for derived tokens, so the same values are repeated once in
`projects-theme.ts` (`PROJECTS_NEUTRAL`/`PROJECTS_THEME`); a test asserts both
scales are identical.

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
| Page header | 50 canvas; white 200-bordered total pill beside the title | Page title 900; caption/breadcrumb 600 (last crumb 900); total pill 600 |
| Unified toolbar (search + filters + commands) | 50 band inside the 200 table frame; white 40px controls with 500 boundary | Typed text 900; search placeholder 600; filter labels 700/600 weight; commands 600, hover 950 on 100 |
| Open filter lists | White, 200 border, 8px radius, no shadow; 100 count pills | Values 700; selected row 100/200; count 600 11px |
| Data grid | White rows; 100 header/hover; 200 perimeter/grid lines | Column titles and cell values 700; name 900; metadata 600; empty dash 500 |
| Detail drawer | 50 body; white record/provider cards; 200 dividers; 100 code chips | Record title 900; card titles 900 weight 600; labels 600 weight 500; values 900 weight 500; empty values 600 weight 400; status pill as grid; provider status pill in the card header |
| Create/Edit/status modals | 50 body; white grouped fields; 200 section borders | Modal title 900; legends 800; labels 700 weight 600; inputs 900; placeholders 600; outline 500 |
| Primary actions | 950 resting; 900 hover/active | White label and icon; inherit icon color; visible 600 focus ring |
| Secondary actions | White resting; 100 hover; accessible 500 border | 600 resting; 900/950 emphasis; retain visible keyboard focus |
| Table loading | White canvas; 200 border; 100 ring with 600 accent | Centered 34px ring, 400px minimum height; 900 primary message, accessible 600 caption; 400ms crossfade and 4px grid reveal; static under reduced motion |
| Drawer skeleton | White/50 surfaces; slender 100/200 placeholders | Label/value pairs; 2-second opacity pulse (0.15-0.20), no gradient sweep; static under reduced motion; accessible loading announcement |

Provider cards remain separate. Missing references use visible `Sin asignar`, never
blank or invisible fields. Typography stays compact: body 13-14px, metadata 12px,
section headings 14px, drawer/modal title 18px, page title 22px. Do not enlarge type
or change padding to compensate for weak color contrast.

## Unified Toolbar and Filter Panel

Search, filters, grid and paging form one framed work surface: the DataTables
container has a 1px 200 border and 8px radius (no overflow clip, so nothing inside
is cut), the toolbar row has top radius and the paging row bottom radius.

Toolbar row (`projects-view-toolbar`, created through DataTables `layout.top` with
`rowClass`): neutral-50 band, 12px vertical / 16px horizontal padding, 200 bottom
divider. Its cell is a CSS grid:

| Width | Grid columns | Row 1 | Row 2 (open lists) |
| --- | --- | --- | --- |
| >= 1100px | `minmax(220px, 1.4fr) repeat(3, minmax(0, 1fr)) auto`, 12px gap | search col 1; triggers cols 2/3/4; commands col 5 | list 1 `1 / 3`; list 2 `3`; list 3 `4 / -1` |
| 768-1099px | `repeat(3, minmax(0, 1fr)) auto` | search `1 / 4`; commands col 4 | triggers row 2 cols 1/2/3; lists row 3: `1`, `2`, `3 / -1` |
| < 768px | one column | search, commands, then trigger/list pairs in DOM order | lists shrink to content, 4px above / 8px below |

`dtsp-panesContainer`, `dtsp-searchPanes` and every `dtsp-searchPane` are
`display: contents`, so each pane's trigger (`dtsp-topRow`) and list (`dt-container`)
become direct grid items. The first list extends under search and the last under
the commands, so the expanded panel spans the full width with no empty area, while
each list still starts or ends under its own trigger. Open lists are in flow: the
toolbar grows and pushes the grid down; they never overlay rows or paging.

Controls: search input, pane triggers and toolbar commands are exactly 40px high,
1px 500 border, 8px radius, white. Focus is on the box only: 600 border plus
`0 0 0 3px rgba(73, 97, 128, 0.16)`; the inner pane input has no outline, border
or shadow. Trigger label is the pane placeholder (700, weight 600). The collapse
caret is a 7px stroke chevron (1.5px 600 borders, 950 on hover).

Lists: white, 200 border, 8px radius, no shadow, SearchPanes' 200px body on
desktop so the three columns align. No horizontal overflow: the inner table is
`table-layout: fixed` at 100%, values truncate with an ellipsis and the count pill
(100 fill, 600 text, 11px/600, tabular numerals, 999px radius) never shrinks.
Thin 300 scrollbar.

Commands (last track): `Filtros activos: N` counter (hidden at zero), `Limpiar`,
and a single `Expandir`/`Contraer` (whichever applies; `Expandir` hides while
`Contraer` is enabled). Disabled commands and pane clear buttons are hidden, not
shown greyed. Buttons: 40px (44px on mobile), 500 border, 600 text, 13px/600;
hover 950 border and text on 100.

The initial table loader replaces the whole surface with the centered ring; do not
render toolbar placeholders.

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
   in `apps/frontend`, then `pnpm check` there, then the repository `check-all.cmd`
   when runtime code changes.
4. Verify keyboard focus, hover/selected/disabled/error states, responsive overflow,
   missing values and reduced-motion loading in the integrated browser with an
   authenticated session, at 1440px, ~930px and 390px, with all filters expanded.
5. Record evidence and exceptions in `25-Continuidad-Administracion.md`.

The palette test protects exact primitive values across the scope roots, the AntD
theme scale, selected contrast pairs and the toolbar/filter geometry; it does not
prove pixel output. Idle input outlines deliberately use 500 for accessibility.
Integrated visual verification was completed on 2026-10-12 (page, open filters,
drawer and edit modal at 1440/929/390px; see document 25).

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
| Drawer card heading | 14px / 600 | Shade 900, minimum 40px heading band |
| Drawer label | 12px / 500 | Shade 600; never heavier than its value |
| Drawer value | 13px / 500 | Shade 900; empty values (`Sin asignar`, `Pendiente de migración`) 600 / 400 |
| Drawer ID and system-code chip | 12px / 500 / 20px, monospace, tabular numerals | 100 fill, 200 border, 4px radius, 1px 6px padding |
| Page total pill | 12px / 600 | `37 proyectos`, 600 text, tabular numerals |
| Desktop project name | 14px / 650 / 1.5 | Shade 900, primary row identity |
| `Actualizado …` under the name | 12px / regular | Shade 600, semantic `time` |
| Mobile project name | 16px / 600 / 1.5 | Shade 950, wrap rather than collide |
| Inputs, buttons, drawer values | 13px / component default | Do not enlarge to compensate for contrast |
| Form labels | 13px / 600 | `(opcional)` stays 400 |
| Filter trigger label | 13px / 600 | Shade 700 (pane placeholder) |
| Mobile metadata values | 14px / component default | Label above content |
| Table column titles | 12px / 650 | Shade 700 |
| Metadata, timestamps, filter counter | 12px | Readable 600 or darker |
| Filter count pill | 11px / 600 | Shade 600 on 100 |
| Status badges | 12px / 600 / 1.5 | Text plus semantic state cue |

Spacing tokens: `--space-1:4px`, `--space-2:8px`, `--space-3:12px`,
`--space-4:16px`, `--space-6:24px`. Default radius `--radius:8px`.
Use 16px panel/form/card padding, 16px section gaps, 8px action gaps.
Documented component exceptions are 6px integration gaps, 10px mobile divider
padding and 24px loader padding. Do not invent per-screen spacing scales.

Administration control height is 36px unless overridden: toolbar search, filter
triggers and filter commands exactly 40px, refresh 44px square, mobile
controls/targets minimum 44px.
Textarea heights follow configured row counts; not every control is a fixed height.

## Page Structure and Search

Resolved hierarchy, in order:

1. Breadcrumb, entity title with the API total pill (`37 proyectos`; singular
   uses the entity name), and the existing supporting caption.
2. Header actions: icon-only refresh and `Nuevo proyecto` with leading plus.
3. One framed work surface: unified toolbar (search + three filters + commands),
   then the independently bounded grid, then the pagination/info row.
4. Optional loaded-record count and `Cargar más` when the API has another batch.

Page content is centered with maximum width 1440px and shrinkable children.
Do not add another decorative card around the work surface. Individual drawer
records/provider groups and form sections are legitimately framed.
The search is the toolbar's first track (full row width below 1100px). Placeholder
is `Buscar en Proyectos`. Search remains DataTables' existing search; do not add a
parallel state store or duplicate filtering implementation.

## Filter Toolbar and State

Geometry lives in "Unified Toolbar and Filter Panel". The commands track is a
non-wrapping flex row with 8px gaps: counter, `Limpiar`, then the single
expand/collapse command. Counter is a state badge: 100 fill, 200 border, 999px
radius, 12px/600 text, 4px by 12px padding, 24px line-height; its plural title
`{0: "", _: "Filtros activos: %d"}` leaves it empty (hidden) at zero.

Three filters: `Proyecto`, `Integraciones`, `Estado`. SearchPanes options:
`orderable: false` (no sort buttons) plus the shared defaults. Every trigger has
`min-width:0`, a shared baseline and no independent top margin; the vendor
magnifier is hidden and the pane clear `×` appears only while a value is selected.

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
Table minimum width 840px, fixed layout (900px overflowed the 887px frame at a
929px viewport and showed a horizontal scrollbar). Local scroll canvas maximum height 640px,
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

Project name is the primary identity (900); directly under it,
`Actualizado DD/MM/AAAA` in a semantic `time` element (`es-CR`, 600, 12px). The
description column shows only the detail. Integration rows show each provider
label (600) with its identifier immediately beside it, left aligned (900, tabular
numerals), including explicit unassigned providers. Do not cast IDs to numbers or
invent IDs.

Missing grid values (description, provider ID) render a quiet 500 em dash with
`title="Sin asignar"` and a visually hidden `Sin asignar` for screen readers; pane
options and search still use the text `Sin asignar`. The drawer keeps the visible
text `Sin asignar`. Status is visible text (`Activo`/`Inactivo`) in a compact pill
with the existing dot (success / 500). Do not rely on color alone or confuse
reference status with project status.

Row actions (`⋯`) are borderless ghost buttons on desktop until the row is hovered,
focused or selected (or the button itself is hovered); below 768px they keep the
500 outline and 44px target. The row action menu is a portal: it opts into the
scale with `rootClassName="catalog-items-dropdown--projects"`.

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
status. The header status uses the same `catalog-items-status` pill as the grid
(not the shared Users badge), so the record reads identically in both places.
Section order: `Información del registro` (name/detail), `Registro`
(CRM ID/native code/update time), then a distinct card per provider (NetSuite,
Odoo, other returned providers). Cards are white, radius 8px, 200 border;
40px heading band with 50 fill, 16px body padding and 16px between cards.
Descriptions use one column, horizontal label/value layout and no colon.

Hierarchy mirrors the grid: the value is the data, the label is metadata. Labels
are 600 at weight 500, values 900 at weight 500 (the shared Users drawer uses
650/600, which made both compete). Empty values render through
`Typography.Text type="secondary"` and are styled 600 at weight 400, so
`Sin asignar` never reads like real data. Do not use shade 500 for that text: it
measures 4.49:1 on white, below AA.

Each provider owns its system code, external identifier and reference status.
Never mix providers in one card or infer synchronization success from a missing
reference. When a provider has exactly one reference, its status pill
(`projects-view-reference-status`, including the neutral `Sin asignar` state) sits
in the card header (`Card extra`) with visually hidden `Estado de referencia: `
text; the body keeps `Identificador` first, then `Código del sistema` as a
non-copyable code chip (`projects-view-system-code`). A provider with several
references keeps the status row inside each reference. NetSuite/Odoo placeholders
are read-only display data. Missing/null/undefined/blank strings display
`Sin asignar`; real identifiers are copyable, unassigned placeholders are not. Do
not submit fabricated placeholder references. ID and code chips share one style
(12px monospace, 100 fill, 200 border); the default AntD `code` renders at 85% of
12px (10.2px) and must be overridden. `Última actualización` uses `es-CR`
`DD/MM/AAAA, h:mm a. m.` without seconds.

Footer: `Registro X de Y`, adjacent previous/next icon controls, Edit, and
Inactivate/Reactivate. Boundary arrows are disabled; actions disappear while
loading or in error. ArrowUp/ArrowDown navigate records except when focus is
inside an input, textarea, select, dropdown/menu/listbox. Position, total and
arrows follow the table's visible order: the table reports the public IDs of
`rows({ search: "applied", order: "applied" })` on each draw
(`onVisibleOrderChange`, only when the sequence changes) and the page navigates
that list (`getNavigationItems`). A filtered table showing 1 row therefore reads
`Registro 1 de 1`, never `1 de 37` with arrows jumping to hidden records. If the
open record is no longer visible, navigation falls back to the loaded list.

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
Header title 18px; supporting text uses 600. Form has 16px section gaps;
white fieldsets with 200 border, compact 14px section legend and 16px field area.
Desktop provider groups share two columns; mobile uses one. Footer is right-aligned
with 8px button gaps. Preserve visible validation and danger colors.

No scroll on desktop; scroll only on mobile. The owner rejected the earlier
`max-height: 65dvh` body: at a 906px window it capped the body at 589px for a
658px form. Rules:

- Body `max-height: calc(100dvh - 200px)` (header, footer and centered margins),
  with independent vertical scroll and contained overscroll as a fallback only.
- Projects textareas use `autoSize` (detail 2-6 rows, audit reason 2-4 rows)
  through `getTextAreaSizes`; other catalogs keep fixed 3/4 rows.
- Short desktop windows, `@media (min-width: 768px) and (max-height: 820px)`:
  12px header/body/footer/section padding and form gaps, 6px legend padding,
  12px field gaps, 2px label padding, 32px fields (`padding-block: 4px` and
  `.ant-form-item-control-input` min-height 32px, which AntD otherwise keeps at
  36px), character counters moved to the label row (`top: -22px`) and body
  `max-height: calc(100dvh - 150px)`.
- Measured result: 929x906 modal 746px with body 595/595 (no overflow);
  1366x657 (1366x768 laptop) modal 633px at 12px from both edges, body 497/497;
  390x844 mobile keeps the internal body scroll inside the screen.
- Do not grow content (new sections, fixed tall textareas) without re-measuring at
  1366x657.

Field styling: labels 700 at weight 600, `(opcional)` 400 in 600; inputs and
textareas type in 900 (the textarea wrapper must be set too, it otherwise inherits
700); placeholders, character counters and optional markers 600. The page wraps
the modal and drawer in `ConfigProvider` with `PROJECTS_THEME` and the `esES`
locale, which is what turns AntD's `(optional)` into `(opcional)`.

Copy is singular and entity-specific, resolved by one helper: titles
`Nuevo proyecto` / `Editar proyecto`, submit `Crear proyecto`, name placeholder
`Ej. Proyecto principal` (Campaigns: `Nueva campaña` / `Editar campaña` /
`Crear campaña`).

Sections: record information, isolated NetSuite/Odoo inputs, audit reason.
Name required/minimum 2 characters; detail textarea 2-6 rows (autoSize)/maximum
500; external reference inputs optional; audit textarea 2-4 rows (autoSize)/maximum
255 and required minimum 5 characters. These describe current UI validation, not authorization to
relax backend rules. Trim submitted text, omit empty external references, preserve
provider identities, and display controlled API conflicts/errors without closing
the form as if successful. Never create provider records from empty fields.

While saving, primary action indicates progress and cancel is disabled. Preserve
existing submit/close lifecycle. Status confirmation shows effective old/new state,
requires trimmed reason of at least 5 characters and marks inactivation dangerous.
UI permissions are not a substitute for server authorization.

Current copy exceptions: header primary is exactly `Nuevo proyecto`; Projects
modal titles/submit are now singular (`Nuevo proyecto`, `Editar proyecto`,
`Crear proyecto`), while other catalogs still interpolate the catalog label and
submit `Crear valor`; status titles contain `valor`. Document the remaining ones as
existing copy debt, not desired domain terminology. An exact clone preserves them until
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
Text inputs inside a bordered box (search, filter triggers) show focus on the box
(600 border + soft ring), never as a native ring on the inner input.
SearchPanes' raster tools (sort and magnifier glyphs) are removed or hidden in
Projects; if a replicated module must keep one, use a 15px glyph at grayscale
opacity 0.65 idle / 0.85 hover or focus. Essential icons need adequate contrast
regardless of the decorative token suggestion.

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

Legacy-only records have no assigned native CRM ID/code yet. In the Registro section,
display `Pendiente de migración` for both fields, without copy buttons. Never present
`legacy:projects:<id>` or `legacy_projects_<id>` routing keys as native identity;
retain those keys internally for edit/status requests. After promotion, display and
allow copying the canonical ID/code returned by the API. Edit and status buttons
must remain separate controls with an explicit 8px gap and wrap on narrow screens.

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
4. Compose the framed work surface: unified toolbar (search, filters, commands),
   in-flow filter panel and bounded grid.
5. Reuse one row dataset for desktop/mobile, one detail drawer and connected forms.
6. Implement every state above, including empty providers, errors and reduced motion.
7. Add regressions first; verify isolated scope and existing contracts after changes.
8. Run focused tests, then full project checks sequentially; review the complete diff.
9. Inspect in the integrated browser with an authenticated account. Do not open
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

## Library Integration Notes (Read Before Replicating)

These are verified behaviors of the installed versions (React 19, Ant Design 6,
DataTables 2.3.8, SearchPanes 2.3.5) that the design depends on. Each one cost a
correction round; reuse the solution instead of rediscovering it.

| Problem | Cause | Solution in Projects |
| --- | --- | --- |
| Search and filters in one row | Default layout puts them in separate rows | `layout.top = { features: ["search", { searchPanes: {...} }], rowClass: "dt-layout-row projects-view-toolbar" }`, `top1Start: null`; CSS grid on the row's cell |
| Pane parts must join the toolbar grid | SearchPanes nests panes in wrappers | `display: contents` on `dtsp-panesContainer`, `dtsp-searchPanes` and `dtsp-searchPane`; place `dtsp-topRow`/`dt-container` with `:nth-child` |
| Sort buttons inside each filter | SearchPanes default | `orderable: false` in the pane options |
| Counter `Filtros activos: 0` always visible | Fixed title string | Plural title `{ 0: "", _: "Filtros activos: %d" }` and hide `.dtsp-title:empty` |
| Disabled commands clutter the toolbar | SearchPanes toggles the `disabled` attribute | Hide `button:disabled`; hide `.dtsp-showAll` with `:has(> .dtsp-collapseAll:not(:disabled))` |
| `^`/`v` text caret | Vendor markup `<span class="dtsp-caret">^</span>`, button rotated 180deg when collapsed | Hide the glyph (`font-size: 0`) and draw borders rotated -135deg; the vendor rotation still flips it |
| Black double border on filter focus | Native focus ring on the inner pane input | `outline/border/box-shadow: none` on the input; focus ring on `dtsp-topRow:focus-within` |
| Horizontal scrollbar in a list | DataTables writes inline `col`/table widths measured before the vertical scrollbar | `table { width: 100% !important; table-layout: fixed }`, `col { width: auto !important }`, `overflow-x: hidden !important`, ellipsis on `.dtsp-name` |
| List height | SearchPanes writes inline `height: 200px` on `dt-scroll-body` | Keep it on desktop (equal columns); `height: auto !important` below 768px |
| Shared Users styles leak in | `SystemUsersPage.css` styles `.administration-users-datatable-wrap .dt-container` (also the pane lists) and 28px titleRow buttons | Scope the frame to `.dt-container:has(> .projects-view-toolbar)`; override buttons to 40px under the Projects scope |
| English ARIA / tooltips | DataTables and SearchPanes defaults | `language.aria.{orderable, orderableReverse, orderableRemove, paginate}` and `language.searchPanes.buttons.{clearPane, clearSearch, collapse, orderByCount, orderByLabel}`, `emptyMessage: "Sin asignar"` |
| Language changes not visible | DataTables reads `language` only at initialization | Reload the page when verifying |
| Cell components ignore the AntD theme | `datatables.net-react` renders slots with separate `createRoot` | Style cells with scoped CSS; portals (Dropdown) need `rootClassName` |
| AntD shows `(optional)` | Missing locale | `ConfigProvider locale={esES}` with the module theme |
| Tests see `var(--…)` not colors | jsdom does not resolve custom properties | Assert the `var(--color-neutral-N)` strings |
| SearchPanes absent in tests | jsdom cannot run it | Test layout keeps the toolbar row with search only; CSS geometry is tested by injecting the stylesheet and fixture markup |
| Mobile CSS test reads the wrong block | Tests slice from the first `@media (max-width: 767px)` | Keep all mobile rules in the main 767px block |
| ESLint `complexity` 8 | Inline ternaries in components | Extract small helpers (`getModalCopy`, `getTableLayout`, `getAriaLanguage`, `getNavigationItems`, `referenceItems`) |
| Drawer overrides ignored | `UserDetailDrawer.css` is imported by the drawer and can load after `ProjectsView.css` with equal specificity (labels 650, values 600, card title 760) | Prefix overrides with `.catalog-item-detail-drawer--projects.user-detail-drawer` |
| Modal fields stay 36px after reducing padding | AntD sets `min-height: 36px` on `.ant-form-item-control-input` | Lower that min-height together with the input padding |
| Drawer navigation disagrees with the table | The page navigated the loaded array, ignoring DataTables filter and sort | Report visible IDs from `onDraw` and navigate that list |

## Replicating in Another Module

1. Get explicit owner approval for the target module; this guide alone does not
   authorize restyling.
2. Presentation opt-in: add the module to `getCatalogPresentation` in
   `catalog-definitions.ts` (or the module's equivalent) with `enhanced: true`, its
   entity name, `create` and `refresh` labels. Catalogs reuse the Projects scope
   classes as-is (Campaigns does); a non-catalog module copies `ProjectsView.css`
   selectors under its own scope root and portal classes instead of adding its
   routes to Projects selectors.
3. Theme: wrap the page, drawer and modals in `ConfigProvider` with the module
   theme (start from `PROJECTS_THEME`) and `esES`. Give every portal (drawer,
   modal, dropdown) its scope class via `rootClassName`/`className`.
4. Table: reuse `useDataTableSearchPanes` and the `getTableLayout` pattern
   (toolbar row class, `orderable: false`, plural counter title, Spanish ARIA).
   Choose the filter columns; with a different number of filters, update the grid
   track count and the `:nth-child` placements (first list spans under search, last
   under the commands) for all three breakpoints.
5. Cells: name 900 with `Actualizado` under it, quiet dash for missing values,
   provider ID beside its label, status pill, ghost row actions.
6. Drawer and form: same sections and provider cards, header status pill,
   provider status in the card header, label/value hierarchy, muted empty values,
   12px ID chips, date without seconds, navigation in the table's visible order,
   singular copy through a `getModalCopy`-style helper, field styling from this
   document, auto-sized textareas and the short-window compact density so the
   form never scrolls on desktop.
7. Tests: copy the palette tests (scale parity, toolbar grid, open-list placement,
   hidden idle controls, single expand/collapse) and the page tests (total pill,
   empty dash, singular copy, drawer pill, Spanish ARIA) for the new scope.
8. Verify live with an authenticated session at 1440px, ~930px and 390px: all
   filters expanded, a filter selected, focus on a filter, drawer, create and edit
   modals. Measure (control heights, list placement, no horizontal overflow),
   not only screenshots. Record evidence in document 25 and update this document
   with any new decision.

## Source Inventory and Known Differences

All paths below are relative to `apps/frontend`. They are implementation pointers,
not prerequisites for understanding the visual rules above.

| Source | Responsibility |
| --- | --- |
| `src/modules/administration/catalogs/ProjectsView.css` | Local tokens, toolbar/filter panel geometry, responsive rules, states and animations |
| `src/modules/administration/catalogs/projects-theme.ts` | `PROJECTS_NEUTRAL` and the AntD `PROJECTS_THEME` for page and portals |
| `src/modules/administration/catalogs/catalog-definitions.ts` | `getCatalogPresentation`: opt-in, scope class, entity and action labels |
| `src/modules/administration/catalogs/CatalogItemsPage.tsx` | Header and total pill, theme/locale provider, forms and `getModalCopy`, request/mutation lifecycle |
| `src/modules/administration/catalogs/CatalogItemsDataTable.tsx` | Preloader, toolbar layout, Spanish ARIA, cells (dash, date, integrations), row actions, preferences and SearchPanes |
| `src/modules/administration/catalogs/CatalogItemDetailDrawer.tsx` | Record/provider sections, header status pill, fallback values, navigation and detail loading |
| `src/modules/administration/hooks/useDataTableSearchPanes.ts` | Cascading panes and safe table-state storage |
| `src/modules/administration/administration-theme.ts` | Shared controls, drawer size/layers and overlay chrome |
| `src/modules/administration/components/UserDetailDrawer.css` | Inherited drawer composition |
| `src/modules/administration/catalogs/CatalogItemsPage.css` | Shared catalog base and inherited avatar styling |
| `test/catalogs/projects-palette.spec.ts` | Token/contrast/layout regressions, not browser pixel measurements |
| `test/catalogs/CatalogItemsPage.spec.tsx` | Component interaction/loading/modal regression coverage |

Runtime alignment (2026-10-12): page/drawer titles 900, table headers and cell
values 700, project name 900, form legends 800, drawer card headings 900/600,
drawer labels 600/500, drawer values 900/500, drawer chips 12px, breadcrumb/caption/position 600, refresh icon 600, avatar 100/200/800,
mobile select boundary 500. Inputs type in 900 with 600 placeholders, optional
markers and counters. Projects wraps its AntD portals in `PROJECTS_THEME`
(`projects-theme.ts`, values asserted equal to the CSS scale) plus `esES` locale.
DataTables cell slots mount separate React roots, so the row action menu opts into
the scale through `catalog-items-dropdown--projects`. Remaining exception: the
shared drawer/modal overlay shadows keep Administration rgba values.

Latest runtime verification (2026-10-12, recorded in document 25): frontend
format/lint/typecheck, 168 tests and build passed (existing bundle-size warning);
authenticated integrated browser check of page, expanded filters, filter focus,
drawer and edit modal at 1440px, 929px and 390px with measured geometry. Drawer
pass: computed label 12px/500/600, value 13px/500/900, filtered table opens
`Registro 1 de 1` with both arrows disabled, unfiltered order Administrativo edit
then Amara (`Registro 2 de 37`), no horizontal overflow at 929px. Root
`check-all.cmd` stops at pre-existing API `jsdoc/require-jsdoc` errors outside this
work. CLS measurements and a full WCAG audit remain unconfirmed.

### Roles and Security Adoption

EN: The approved `/home/administration/roles-security` adaptation uses the same
neutral 50-950 scale, Aptos/Segoe UI typography, 13px body, 22px page title,
8px panel corners, restrained dark primary actions and visible keyboard focus.
Tokens are scoped to `.roles-security-page` and `.roles-security-modal-backdrop`
in `RolesSecurityPage.css`. Preserve the role workbench and permission accordions;
do not replace them with a catalog table. The page fills the available content
width without a desktop max-width cap, retaining its responsive side padding.
Module cards use four columns on wide
screens, two at 1280px and below, and one at 900px and below. Mobile controls
retain 44px touch targets. Audit dialogs use matching surfaces and spacing,
with an overlay above navigation. The existing access-loading ring is 34px,
neutral 100/600, and stops animating for reduced-motion preferences.

ES: Roles y seguridad adopta la paleta y densidad de Proyectos sin modificar
asignaciones, permisos, validaciones ni guardado auditado. Conservar colores
semanticos de advertencia y el flujo propio del editor de permisos.

Update this document whenever approved behavior or design rules change. Record
test/browser evidence separately in `25-Continuidad-Administracion.md`. Do not
replace this single reference with conflicting per-screen palette documents.

ES: Para replicar, usar este documento completo, reutilizar componentes existentes
y adaptar solo el dominio autorizado. No ocultar datos ausentes, no mezclar
proveedores, no cambiar contratos ni declarar validacion visual sin evidencia.
