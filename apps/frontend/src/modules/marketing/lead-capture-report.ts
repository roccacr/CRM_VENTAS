/** Profundidad del reporte: 1 es por proyecto, 2 es proyecto y campaña, 3 es proyecto, campaña y anuncio. */
export type CaptureDepth = 1 | 2 | 3;

/** Medida del reporte; los motivos de pérdida añaden una distribución sin cambiar la cohorte captada. */
export type CaptureMeasure = "leads" | "appointments" | "reservations" | "lost" | "lossReasons";

/**
 * Conteos de un grupo de leads.
 * `noAppointment + scheduled + completed` siempre es igual a `leads`: un lead está en exactamente uno de los tres.
 * `lost` cuenta los leads perdidos hoy, pase lo que haya pasado antes.
 */
export interface CaptureValues {
    readonly leads: number;
    readonly withReservation?: number;
    readonly noAppointment: number;
    /** Cita agendada y todavía no realizada. */
    readonly scheduled: number;
    /** Cita ya realizada. */
    readonly completed: number;
    readonly lost: number;
}

export interface CaptureLossReason {
    readonly code: string;
    readonly name: string;
    readonly count: number;
}

export interface CaptureRow extends CaptureValues {
    readonly lossReasons?: readonly CaptureLossReason[];
    readonly date: string;
    readonly sellerId: string;
    readonly projectId: string;
    readonly campaignId: string;
    readonly adId: string;
}

export interface CaptureFilters {
    readonly from: string;
    readonly to: string;
    /** Vacío significa todos los vendedores. */
    readonly sellers: readonly string[];
    /** Intervalos elegidos; los huecos entre meses o semanas no forman parte de la cohorte. */
    readonly periods?: readonly { readonly from: string; readonly to: string }[];
}

export interface CaptureNamed {
    readonly id: string;
    readonly name: string;
}

/** El vendedor también lleva el id público con el que se nombra su foto: `public/vendedores/<publicId>.webp`. */
export interface CaptureSeller extends CaptureNamed {
    readonly publicId: string | null;
}

/** Los diccionarios de solo lectura pertenecen a una respuesta del API. Ningún reporte comparte un catálogo mutable. */
export interface CaptureCatalogs {
    readonly sellers: readonly CaptureSeller[];
    readonly projects: readonly CaptureNamed[];
    readonly campaigns: readonly CaptureNamed[];
    readonly ads: readonly CaptureNamed[];
}

/** Filas dentro del periodo y, si se eligieron vendedores, que les pertenecen. */
export function filterCaptureRows(rows: readonly CaptureRow[], filters: CaptureFilters): CaptureRow[] {
    return rows.filter((row) => row.date >= filters.from && row.date <= filters.to && (!filters.periods?.length || filters.periods.some((period) => row.date >= period.from && row.date <= period.to)) && (filters.sellers.length === 0 || filters.sellers.includes(row.sellerId)));
}

export const EMPTY_VALUES: CaptureValues = { leads: 0, noAppointment: 0, scheduled: 0, completed: 0, lost: 0 };
export const addValues = (a: CaptureValues, b: CaptureValues): CaptureValues => ({ leads: a.leads + b.leads, noAppointment: a.noAppointment + b.noAppointment, scheduled: a.scheduled + b.scheduled, completed: a.completed + b.completed, lost: a.lost + b.lost, ...reservationValues(a, b) });
/** Agrega evidencia disponible; una respuesta anterior sin esta medida conserva su ausencia. */
function reservationValues(a: CaptureValues, b: CaptureValues): Pick<CaptureValues, "withReservation"> {
    if (a.withReservation === undefined && b.withReservation === undefined) return {};
    return { withReservation: (a.withReservation ?? 0) + (b.withReservation ?? 0) };
}

const sumValues = (rows: readonly CaptureValues[]): CaptureValues => rows.reduce(addValues, EMPTY_VALUES);

export const MEASURES: readonly { readonly measure: CaptureMeasure; readonly label: string; readonly noun: string }[] = [
    { measure: "leads", label: "Leads", noun: "leads" },
    { measure: "reservations", label: "Reserva o pre-reserva", noun: "leads con reserva o pre-reserva" },
    { measure: "appointments", label: "Leads con cita", noun: "leads con cita" },
    { measure: "lost", label: "Leads perdidos", noun: "leads perdidos" },
    { measure: "lossReasons", label: "Motivos de pérdida", noun: "leads perdidos" },
];

/** Etiquetas compartidas por gráficos, tablas, indicadores y exportación. */
export function captureMeasureInfo(measure: CaptureMeasure) {
    return MEASURES.find((item) => item.measure === measure) ?? { label: "Leads", noun: "leads" };
}

/** Cifra compartida por barras, banners y rankings. Citas y reservas cuentan leads únicos, no eventos ni documentos. */
export function primaryValue(values: CaptureValues, measure: CaptureMeasure): number {
    if (measure === "reservations") return values.withReservation ?? 0;
    if (measure === "appointments") return values.scheduled + values.completed;
    return measure === "lost" || measure === "lossReasons" ? values.lost : values.leads;
}

export interface CaptureKpiFigures {
    readonly total: number;
    /** La medida como porcentaje de todos los leads. Nulo cuando no hay leads o cuando la medida es los propios leads. */
    readonly share: number | null;
    readonly projects: number;
    /** Grupos con leads en la profundidad elegida: proyectos, pares de proyecto y campaña, o rutas de proyecto, campaña y anuncio. */
    readonly units: number;
    /** La medida por unidad de la profundidad elegida. */
    readonly average: number;
}

/** Cifras del banner para las filas en pantalla. Un grupo cuenta una vez, aunque abarque varios vendedores o varios días. */
export function captureKpis(rows: readonly CaptureRow[], measure: CaptureMeasure, depth: CaptureDepth): CaptureKpiFigures {
    const withLeads = rows.filter((row) => row.leads > 0);
    const units = measure === "lossReasons" ? lossReasonRows(rows).length : new Set(withLeads.map((row) => JSON.stringify(pathIds(row, depth)))).size;
    const projects = new Set(withLeads.map((row) => row.projectId)).size;
    const total = rows.reduce((sum, row) => sum + primaryValue(row, measure), 0);
    const leads = rows.reduce((sum, row) => sum + row.leads, 0);
    return { total, share: measure !== "leads" && leads > 0 ? (total / leads) * 100 : null, projects, units, average: units > 0 ? total / units : 0 };
}

export interface ValueColumn {
    readonly key: string;
    readonly label: string;
    /** Texto de la celda. Los conteos son números. Las participaciones llevan el signo %. */
    readonly cell: (values: CaptureValues) => number | string;
    /** Las columnas de participación no se suman entre filas. La línea de total las vuelve a calcular desde los valores sumados. */
    readonly isShare?: boolean;
}

const share = (part: number, whole: number): string => (whole ? `${(Math.round((part / whole) * 1000) / 10).toLocaleString("es-CR")} %` : "—");

/** Las columnas que cada medida muestra en las tablas, en cada profundidad. */
export function columnsFor(measure: CaptureMeasure): readonly ValueColumn[] {
    if (measure === "reservations")
        return [
            { key: "reserved", label: "Con reserva o pre-reserva", cell: (v) => v.withReservation ?? 0 },
            { key: "share", label: "% de los leads", cell: (v) => share(v.withReservation ?? 0, v.leads), isShare: true },
        ];
    if (measure === "appointments")
        return [
            { key: "generated", label: "Con cita", cell: (v) => v.scheduled + v.completed },
            { key: "scheduled", label: "Programada", cell: (v) => v.scheduled },
            { key: "completed", label: "Realizada", cell: (v) => v.completed },
            { key: "none", label: "Sin cita", cell: (v) => v.noAppointment },
            { key: "total", label: "Total de leads", cell: (v) => v.leads },
        ];
    if (measure === "lost" || measure === "lossReasons")
        return [
            { key: "lost", label: "Perdidos", cell: (v) => v.lost },
            { key: "share", label: "% de los leads", cell: (v) => share(v.lost, v.leads), isShare: true },
        ];
    return [{ key: "leads", label: "Leads", cell: (v) => v.leads }];
}

const nameOf = (list: readonly CaptureNamed[], id: string): string => list.find((item) => item.id === id)?.name ?? id;

/** Ids de una fila hasta la profundidad elegida, el más externo primero. */
function pathIds(row: CaptureRow, depth: CaptureDepth): string[] {
    return [row.projectId, row.campaignId, row.adId].slice(0, depth);
}

const listsOf = (catalogs: CaptureCatalogs) => [catalogs.projects, catalogs.campaigns, catalogs.ads] as const;
const pathLabels = (ids: readonly string[], catalogs: CaptureCatalogs): string[] => ids.map((id, index) => nameOf(listsOf(catalogs)[index] ?? [], id));
export const sellerName = (id: string, catalogs: CaptureCatalogs): string => nameOf(catalogs.sellers, id);

export interface CaptureNode {
    readonly key: string;
    readonly label: string;
    /** La cifra principal de la medida, para ordenar y para el número grande. */
    readonly value: number;
    readonly detail: CaptureValues;
    readonly children: readonly CaptureNode[];
}

/** Suma las filas en un árbol. Cada nivel suma exactamente lo de su padre, así que nada se cuenta dos veces ni se deja fuera. */
function fold(rows: readonly CaptureRow[], { depth, measure, catalogs }: { readonly depth: CaptureDepth; readonly measure: CaptureMeasure; readonly catalogs: CaptureCatalogs }, level: number, parent: string): CaptureNode[] {
    if (level >= depth) return [];
    const groups = new Map<string, CaptureRow[]>();
    for (const row of rows) {
        const id = pathIds(row, depth)[level] ?? "";
        const group = groups.get(id);
        if (group) group.push(row);
        else groups.set(id, [row]);
    }
    return [...groups]
        .map(([id, group]) => {
            const detail = sumValues(group);
            return { key: JSON.stringify([parent, id]), label: nameOf(listsOf(catalogs)[level] ?? [], id), value: primaryValue(detail, measure), detail, children: fold(group, { depth, measure, catalogs }, level + 1, JSON.stringify([parent, id])) };
        })
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"));
}

/** Id del proyecto que representa un nodo de primer nivel. Su clave es `["all", projectId]`. */
export const projectIdOf = (node: CaptureNode): string => (JSON.parse(node.key) as string[])[1] ?? "";

/** Todos los vendedores juntos, como árbol: proyecto, dentro la campaña y dentro el anuncio. Cada nivel suma lo de su padre. */
export const summaryTree = (rows: readonly CaptureRow[], depth: CaptureDepth, measure: CaptureMeasure, catalogs: CaptureCatalogs): CaptureNode[] => fold(rows, { depth, measure, catalogs }, 0, "all");

export interface SellerSection {
    readonly sellerId: string;
    readonly tone: { readonly color: string; readonly tint: string };
    readonly publicId: string | null;
    readonly name: string;
    readonly value: number;
    readonly detail: CaptureValues;
    readonly projects: readonly CaptureNode[];
}

/** Una sección por vendedor, con los proyectos en los que recibió leads y lo que hay dentro de cada uno, hasta la profundidad. */
export function sellerSections(rows: readonly CaptureRow[], depth: CaptureDepth, measure: CaptureMeasure, catalogs: CaptureCatalogs): SellerSection[] {
    return catalogs.sellers.flatMap((seller) => {
        const own = rows.filter((row) => row.sellerId === seller.id);
        if (own.length === 0) return [];
        const detail = sumValues(own);
        return [{ sellerId: seller.id, tone: sellerTone(seller.id), publicId: seller.publicId, name: seller.name, value: primaryValue(detail, measure), detail, projects: fold(own, { depth, measure, catalogs }, 0, seller.id) }];
    });
}

export interface PathRow {
    /** Conserva el color de la dimensión al compararla entre intervalos. */
    readonly colorKey?: string;
    readonly key: string;
    /** Nombres desde el nivel más externo: `["Proyecto Vista", "Lanzamiento"]`. */
    readonly path: readonly string[];
    readonly value: number;
    readonly detail: CaptureValues;
}

/** Conteos por proyecto, o por proyecto, campaña y anuncio, con todos los vendedores juntos: la tabla de resumen. */
export function summaryRows(rows: readonly CaptureRow[], depth: CaptureDepth, measure: CaptureMeasure, catalogs: CaptureCatalogs): PathRow[] {
    const groups = new Map<string, CaptureRow[]>();
    for (const row of rows) {
        const key = JSON.stringify(pathIds(row, depth));
        const group = groups.get(key);
        if (group) group.push(row);
        else groups.set(key, [row]);
    }
    return [...groups]
        .map(([key, group]) => {
            const detail = sumValues(group);
            return { key, path: pathLabels(JSON.parse(key) as string[], catalogs), value: primaryValue(detail, measure), detail };
        })
        .sort((a, b) => b.value - a.value || a.path.join().localeCompare(b.path.join(), "es"));
}

export interface GeneralRow {
    readonly key: string;
    readonly sellerId: string;
    readonly seller: string;
    readonly path: readonly string[];
    readonly value: number;
    readonly detail: CaptureValues;
}

/** Vendedor, proyecto y, si aplica, campaña y anuncio, con los conteos: la tabla general, una línea por combinación. */
export function generalRows(rows: readonly CaptureRow[], depth: CaptureDepth, measure: CaptureMeasure, catalogs: CaptureCatalogs): GeneralRow[] {
    const groups = new Map<string, CaptureRow[]>();
    for (const row of rows) {
        const key = JSON.stringify([row.sellerId, ...pathIds(row, depth)]);
        const group = groups.get(key);
        if (group) group.push(row);
        else groups.set(key, [row]);
    }
    return [...groups]
        .map(([key, group]) => {
            const [seller = "", ...ids] = JSON.parse(key) as string[];
            const detail = sumValues(group);
            return { key, sellerId: seller, seller: sellerName(seller, catalogs), path: pathLabels(ids, catalogs), value: primaryValue(detail, measure), detail };
        })
        .sort((a, b) => a.seller.localeCompare(b.seller, "es") || a.path.join().localeCompare(b.path.join(), "es"));
}

export interface ChartGroup {
    readonly key: string;
    readonly label: string;
    /** Nombres desde el nivel más externo, para que el eje imprima un nivel por línea. */
    readonly path: readonly string[];
    /** Un valor por vendedor, en el mismo orden de `sellers`. */
    readonly values: readonly number[];
    /** Todos los leads de cada vendedor en el grupo, no solo los de la medida. Es la base de la vista en porcentaje. */
    readonly leads?: readonly number[];
}

/** Columnas agrupadas: un grupo por proyecto, o por proyecto y campaña, y una barra por vendedor dentro. */
export function chartGroups(rows: readonly CaptureRow[], depth: CaptureDepth, measure: CaptureMeasure, catalogs: CaptureCatalogs): { readonly sellers: readonly CaptureSeller[]; readonly groups: readonly ChartGroup[] } {
    // Cada combinación se agrega una vez. Todo puede traer años de filas diarias.
    const present = new Set<string>();
    const values = new Map<string, Map<string, number>>();
    const leads = new Map<string, Map<string, number>>();
    for (const row of rows) {
        present.add(row.sellerId);
        const key = JSON.stringify(pathIds(row, depth));
        const group = values.get(key) ?? new Map<string, number>();
        group.set(row.sellerId, (group.get(row.sellerId) ?? 0) + primaryValue(row, measure));
        values.set(key, group);
        const total = leads.get(key) ?? new Map<string, number>();
        total.set(row.sellerId, (total.get(row.sellerId) ?? 0) + row.leads);
        leads.set(key, total);
    }
    const sellers = catalogs.sellers.filter((seller) => present.has(seller.id));
    const groups = summaryRows(rows, depth, measure, catalogs).map((item) => ({
        key: item.key,
        label: item.path.join(" › "),
        path: item.path,
        values: sellers.map((seller) => values.get(item.key)?.get(seller.id) ?? 0),
        leads: sellers.map((seller) => leads.get(item.key)?.get(seller.id) ?? 0),
    }));
    return { sellers, groups };
}

export const DEPTHS: readonly { readonly depth: CaptureDepth; readonly label: string; readonly noun: string }[] = [
    { depth: 1, label: "Proyecto", noun: "proyecto" },
    { depth: 2, label: "Proyecto › Campaña", noun: "proyecto y campaña" },
    { depth: 3, label: "Proyecto › Campaña › Anuncio", noun: "proyecto, campaña y anuncio" },
];

/** Colores de las series, un juego clásico de gráfico de negocio. Cada uno trae el color de texto que sigue legible encima. */
export const SERIES = [
    { color: "#4e79a7", ink: "#ffffff" },
    { color: "#f28e2b", ink: "#18222f" },
    { color: "#e15759", ink: "#ffffff" },
    { color: "#76b7b2", ink: "#18222f" },
    { color: "#59a14f", ink: "#ffffff" },
    { color: "#edc948", ink: "#18222f" },
    { color: "#b07aa1", ink: "#ffffff" },
    { color: "#ff9da7", ink: "#18222f" },
    { color: "#9c755f", ink: "#ffffff" },
    { color: "#bab0ac", ink: "#18222f" },
    { color: "#34506f", ink: "#ffffff" },
    { color: "#d37295", ink: "#ffffff" },
] as const;

/** Una identidad es dueña de su color de serie. El orden del periodo o del catálogo no lo cambia. */
export function sellerTone(id: string): { readonly color: string; readonly ink: string; readonly tint: string } {
    let hash = 2_166_136_261;
    for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619) >>> 0;
    const { color, ink } = SERIES[hash % SERIES.length] ?? SERIES[0];
    return { color, ink, tint: `color-mix(in srgb, ${color} 9%, #ffffff)` };
}

/** Una sola distribución de pérdidas para las filas autorizadas y los proyectos seleccionados. */
export function lossReasonRows(rows: readonly CaptureRow[]): PathRow[] {
    const reasons = new Map<string, { name: string; count: number }>();
    for (const row of rows) {
        const entries = row.lossReasons ?? [{ code: "unrecorded", name: "Sin motivo registrado", count: row.lost }];
        for (const reason of entries) {
            const previous = reasons.get(reason.code);
            reasons.set(reason.code, { name: previous?.name ?? reason.name, count: (previous?.count ?? 0) + reason.count });
        }
    }
    return [...reasons]
        .filter(([, reason]) => reason.count > 0)
        .map(([code, reason]) => ({ key: code, path: [reason.name], value: reason.count, detail: { ...EMPTY_VALUES, leads: reason.count, lost: reason.count, noAppointment: reason.count } }))
        .sort((a, b) => b.value - a.value || a.path.join().localeCompare(b.path.join(), "es"));
}
