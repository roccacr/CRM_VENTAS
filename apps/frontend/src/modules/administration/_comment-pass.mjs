import { readFileSync, writeFileSync } from "node:fs";

const root = new URL(".", import.meta.url);
const route = (name) => `/** Ruta propia de ${name}. La vista compartida conserva la interacción y el aspecto de Proyectos. La identidad y los permisos siguen siendo de este catálogo. */`;
const identity = (name, cap) => `/** La identidad de ${name} queda aparte. La presentación reutiliza el diseño de Proyectos. El formulario de esta pantalla corta el nombre en ${cap} caracteres. */`;
const jobs = [
    ["unit-files/UnitFilesDataTable.tsx", "// DataTables registers its renderer here; this static API is not a React Hook.", "// DataTables registra aquí su render. Esta API estática no es un hook de React."],
    ["unit-files/UnitFilesDataTable.tsx", "/** Server-owned filters apply before cursor paging; DataTables renders only the returned batch. */", "/** Los filtros del servidor corren antes de la página por cursor. DataTables pinta solo el lote devuelto. */"],
    ["unit-files/UnitFilesDataTable.tsx", "// DataTables retains this DOM node: state keeps its identity stable even across hot reloads.", "// DataTables conserva este nodo. El estado mantiene su identidad, también tras una recarga en caliente."],
    ["unit-files/UnitFilesDataTable.tsx", "// The adapter stores these callbacks for DataTables events; it never invokes them during render.", "// El adaptador guarda estos callbacks para los eventos de DataTables. No los llama durante el render."],
    ["unit-files/UnitFilesDataTable.tsx", "// DataTables owns these nodes; update selection without replacing React roots.", "// Esos nodos son de DataTables. La selección se actualiza sin reemplazar las raíces de React."],
    ["unit-files/unit-files.api.ts", "/** Counts cover all matching records, independently of the currently loaded inventory page. */", "/** Los conteos cubren todos los registros que coinciden, aparte de la página de inventario cargada. */"],
    ["unit-files/unit-files.api.ts", "/** Searchable choices remain project-scoped and bounded, never a full inventory download. */", "/** Las opciones de búsqueda quedan en los proyectos pedidos y con tope. No descargan el inventario completo. */"],
    ["unit-files/unit-files.api.ts", "/** Unit Files owns its read contract; it never calls generic catalog persistence. */", "/** El expediente tiene su contrato de lectura. No llama a la persistencia genérica de catálogos. */"],
    ["unit-files/unit-files.api.ts", "/** Criteria are transmitted before any inventory query; cursors bind the complete search. */", "/** El criterio viaja antes de cualquier consulta de inventario. El cursor ata la búsqueda completa. */"],
    ["unit-files/unit-files.api.ts", "/** Full business values and provider references are fetched only for requested records. */", "/** Los valores de negocio y las referencias del proveedor se piden solo para los registros abiertos. */"],
    ["brokers/BrokersPage.tsx", "/** Broker-owned route; the shared view guarantees exact Projects interaction and visual parity. */", route("corredores")],
    ["brokers/brokers-definition.ts", "/** Broker identity stays separate; presentation reuses the approved Projects design. */", identity("corredores", "250")],
    ["subsidiaries/SubsidiariesPage.tsx", "/** Subsidiary-owned route; the shared view guarantees exact Projects interaction and visual parity. */", route("subsidiarias")],
    ["subsidiaries/subsidiaries-definition.ts", "/** Subsidiary identity stays separate; presentation reuses the approved Projects design. */", identity("subsidiarias", "250")],
    ["locations/LocationsPage.tsx", "/** Location-owned route; the shared view guarantees exact Projects interaction and visual parity. */", route("ubicaciones")],
    ["locations/locations-definition.ts", "/** Location identity stays separate; presentation reuses the approved Projects design. */", identity("ubicaciones", "100")],
    ["classes/ClassesPage.tsx", "/** Class-owned route; the shared view guarantees exact Projects interaction and visual parity. */", route("clases")],
    ["classes/classes-definition.ts", "/** Class identity stays separate; presentation reuses the approved Projects design. */", identity("clases", "100")],
    ["campaigns/CampaignsPage.tsx", "/** Campaign-owned route; the shared view guarantees exact Projects interaction and visual parity. */", route("campañas")],
    ["campaigns/campaigns-definition.ts", "/** Campaign identity stays separate; presentation reuses the approved Projects design. */", "/** La identidad de campañas queda aparte. La presentación reutiliza el diseño de Proyectos. Este archivo no declara un tope de nombre, así que el formulario compartido no le agrega uno. */"],
];

const misses = [];
for (const [file, from, to] of jobs) {
    const target = new URL(file, root);
    const source = readFileSync(target, "utf8");
    const count = source.split(from).length - 1;
    if (count !== 1) misses.push(`${file} x${count}: ${from.slice(0, 110)}`);
    else writeFileSync(target, source.replace(from, to));
}
if (misses.length) {
    console.error(misses.join("\n"));
    process.exit(1);
}
console.log(`updated ${jobs.length}`);
