import { readFileSync, writeFileSync } from "node:fs";

const root = new URL(".", import.meta.url);
const jobs = [
    ["banks/BanksPage.tsx", "// A delayed profile belonging to another account/session cannot authorize this page's draft.", "// Un perfil tardío de otra cuenta o sesión no autoriza el borrador de esta página."],
    ["banks/BanksPage.tsx", "/** Same status pill the other catalogs use. */", "/** La misma pastilla de estado que usan los demás catálogos. */"],
    ["banks/BanksPage.tsx", "/** Dedicated native banks flow. Session/context epochs discard stale reads and prevent delayed preflights from writing. */", "/** Flujo nativo propio de bancos. La época de sesión y de contexto descarta lecturas viejas y evita que un preflight tardío escriba. */"],
    ["banks/BanksPage.tsx", "/** Header with breadcrumb, total and actions, laid out like every other catalog. */", "/** Encabezado con ruta, total y acciones, con la misma disposición que el resto de catálogos. */"],
    ["banks/BanksPage.tsx", "/** Bank and executive workspace retains native identity and exact action grants. */", "/** El espacio de banco y ejecutivo conserva la identidad nativa y el permiso exacto de cada acción. */"],
    ["pages/RolesSecurityPage.tsx", "/** Only the effective API grant authorizes editing; an explicit deny always wins. */", "/** Solo el permiso efectivo del API autoriza la edición. Un deny explícito gana. */"],
    ["pages/RolesSecurityPage.tsx", "/** Fail closed before mounting the editor and after any failed permission revalidation. */", "/** Si el permiso no se confirma, el editor no se monta. Si una revalidación falla, también se cierra. */"],
    ["pages/RolesSecurityPage.tsx", "/** Catalog grants remain authoritative even when the role template is locked. */", "/** El permiso de catálogo sigue mandando aunque la plantilla del rol esté bloqueada. */"],
    ["pages/RolePermissionSection.tsx", "/** Protected template: read-only; granted permissions still come from the API catalog. */", "/** Plantilla protegida: solo lectura. Los permisos concedidos siguen saliendo del catálogo del API. */"],
    ["pages/RolesSecurityPage.tsx", "/** Scoped roles change membership only; legacy menu visibility keeps its existing overrides. */", "/** Un rol con alcance cambia solo la membresía. La visibilidad vieja del menú conserva sus excepciones. */"],
    ["pages/RolesSecurityPage.tsx", "// A scope change is not an employee exception: preserve explicit allows and denies.", "// Cambiar el alcance no es una excepción del empleado. Se conservan los allow y los deny explícitos."],
    ["pages/RolesSecurityPage.tsx", "/** Persists one atomic template and replaces drafts with the canonical response. */", "/** Guarda una sola plantilla atómica y sustituye los borradores por la respuesta canónica. */"],
    ["pages/SystemUsersPage.tsx", "/** Directory-wide counts by status, shown only to people who may read the list. They are counters, not controls. */", "/** Conteos de todo el directorio por estado. Solo los ve quien puede leer la lista. Son cifras, no controles. */"],
    ["catalogs/catalog-summary.ts", "/** One summary card at the top of a catalog page. Values are text so a missing figure can show as a dash, never as zero. */", "/** Una tarjeta de resumen arriba del catálogo. El valor es texto para que una cifra ausente sea una raya y no un cero. */"],
    ["catalogs/catalog-summary.ts", "/** A value counts as integrated when at least one external system holds its identifier. */", "/** Un valor cuenta como integrado cuando al menos un sistema externo tiene su identificador. */"],
    ["catalogs/catalog-summary.ts", "/** Cards for the banks list; `total` covers every bank, the rest is counted over the loaded rows and says so when paged. */", "/** Tarjetas de bancos. `total` cubre todos. El resto se cuenta sobre las filas cargadas y lo dice si hay más páginas. */"],
    ["catalogs/catalog-summary.ts", "/** Cards for the unit-file search, from state the page already holds. */", "/** Tarjetas de la búsqueda de expedientes, con el estado que la página ya tiene. */"],
    ["catalogs/CatalogItemDetailDrawer.tsx", "/** Exact current-context grants. Reactivation requires update (canEdit). */", "/** Permisos exactos del contexto actual. Reactivar exige actualizar. */"],
    ["catalogs/CatalogItemDetailDrawer.tsx", "/** Permission visibility and the existing legacy immutability constraint are independent. */", "/** Mostrar una acción por permiso y el bloqueo de un registro viejo son reglas distintas. */"],
    ["catalogs/CatalogItemDetailDrawer.tsx", "/** Projects uses sparse label/value lines; other catalogs keep their existing loader. */", "/** Proyectos usa líneas sueltas de etiqueta y valor. Los demás catálogos conservan su cargador. */"],
    ["catalogs/catalog-permissions.ts", "/** Owner bypasses only module membership; every action still requires its exact effective grant. */", "/** Un Owner activo se salta solo la membresía del módulo. Cada acción sigue exigiendo su allow efectivo y un deny lo quita. En bancos, sin lectura no quedan las demás acciones. */"],
    ["catalogs/catalog-definitions.ts", "/** Approved opt-ins reuse the Projects design without changing catalog identity or permissions. */", "/** Quienes optaron reutilizan el diseño de Proyectos. La identidad del catálogo y sus permisos no cambian. */"],
    ["catalogs/CatalogSummary.tsx", "/** Same card anatomy as the Home pages. A card only reports a figure: filtering is done with the list's own filters. */", "/** La misma tarjeta que las páginas de inicio. La tarjeta informa una cifra. El filtro lo hace la lista. */"],
    ["catalogs/CatalogSummary.tsx", "/** Summary row shared by every catalog view, whichever area opens it. */", "/** Fila de resumen compartida por cada vista de catálogo, cualquiera que sea el área que la abre. */"],
    ["banks/BankFormDrawer.tsx", "/** Same numbered section as the other catalogs' create/edit panels. */", "/** La misma sección numerada de los paneles de alta y edición de los demás catálogos. */"],
    ["banks/BankFormDrawer.tsx", "/** Name, plus contact data for an executive. */", "/** Nombre, y los datos de contacto cuando el registro es un ejecutivo. */"],
    ["banks/BankFormDrawer.tsx", "/** Audit reasons are entered afresh; contact fields never acquire fabricated defaults. */", "/** El motivo de auditoría se escribe de nuevo. Un campo de contacto no recibe un valor inventado. */"],
    ["user-module-scope.ts", "/** Optional API catalog scope; direct role assignments remain distinct from effective roles. */", "/** Alcance opcional que trae el catálogo del API. La asignación directa del rol no es el rol efectivo. */"],
    ["user-module-scope.ts", "/** Administration and company modules are never granted through module selection. */", "/** Administración y empresa no se conceden eligiendo módulos. */"],
    ["user-module-scope.ts", "/** Owner always keeps full access; any other assigned role flagged `selected_modules` makes permissions follow the chosen modules. */", "/** Owner conserva el acceso completo. Cualquier otro rol asignado con `selected_modules` hace que los permisos sigan los módulos elegidos. */"],
    ["user-module-scope.ts", " * Modules a user may be given. Selected modules are intersected with the ceiling of the assigned roles.\n * Null preserves legacy/Owner behavior; a present empty set means no module access. */", " * Módulos que se le pueden dar a una persona. Los elegidos se cruzan con el techo de los roles asignados.\n * Nulo conserva el comportamiento de Owner y del legado. Un conjunto presente y vacío significa que no hay acceso a módulos. */"],
    ["user-module-scope.ts", "/** Restrict each role's contribution before union, so another role cannot lend it a ceiling. */", "/** El aporte de cada rol se recorta antes de unirlo. Otro rol no le presta su techo. */"],
];

const misses = [];
for (const [file, from, to] of jobs) {
    const target = new URL(file, root);
    const source = readFileSync(target, "utf8");
    const count = source.split(from).length - 1;
    if (count !== 1) misses.push(`${file} x${count}: ${from.slice(0, 100)}`);
    else writeFileSync(target, source.replace(from, to));
}
if (misses.length) {
    console.error(misses.join("\n"));
    process.exit(1);
}
console.log(`updated ${jobs.length}`);
