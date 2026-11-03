/** How deep the report goes: 1 = by project, 2 = project › campaign, 3 = project › campaign › ad. */
export type CaptureDepth = 1 | 2 | 3;

/** Medida del reporte; los motivos de pérdida añaden una distribución sin cambiar la cohorte captada. */
export type CaptureMeasure = "leads" | "appointments" | "lost" | "lossReasons";

/**
 * Counts for one group of leads.
 * `noAppointment + scheduled + completed` always equals `leads`: a lead is in exactly one of the three.
 * `lost` counts leads that are lost today, whatever happened before.
 */
export interface CaptureValues {
    readonly leads: number;
    readonly noAppointment: number;
    /** Appointment booked and not yet held. */
    readonly scheduled: number;
    /** Appointment held. */
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
    /** Empty means every seller. */
    readonly sellers: readonly string[];
    /** Intervalos elegidos; los huecos entre meses o semanas no forman parte de la cohorte. */
    readonly periods?: readonly { readonly from: string; readonly to: string }[];
}

export interface CaptureNamed {
    readonly id: string;
    readonly name: string;
}

/** A seller also carries the public id the photo file is named after (`public/vendedores/<publicId>.webp`). */
export interface CaptureSeller extends CaptureNamed {
    readonly publicId: string | null;
}

/** Readonly dictionaries belong to one API response; no report shares mutable catalog state. */
export interface CaptureCatalogs {
    readonly sellers: readonly CaptureSeller[];
    readonly projects: readonly CaptureNamed[];
    readonly campaigns: readonly CaptureNamed[];
    readonly ads: readonly CaptureNamed[];
}

/** Rows inside the period and, when sellers are chosen, belonging to them. */
export function filterCaptureRows(rows: readonly CaptureRow[], filters: CaptureFilters): CaptureRow[] {
    return rows.filter((row) => row.date >= filters.from && row.date <= filters.to && (!filters.periods?.length || filters.periods.some((period) => row.date >= period.from && row.date <= period.to)) && (filters.sellers.length === 0 || filters.sellers.includes(row.sellerId)));
}

export const EMPTY_VALUES: CaptureValues = { leads: 0, noAppointment: 0, scheduled: 0, completed: 0, lost: 0 };
export const addValues = (a: CaptureValues, b: CaptureValues): CaptureValues => ({ leads: a.leads + b.leads, noAppointment: a.noAppointment + b.noAppointment, scheduled: a.scheduled + b.scheduled, completed: a.completed + b.completed, lost: a.lost + b.lost });
const sumValues = (rows: readonly CaptureValues[]): CaptureValues => rows.reduce(addValues, EMPTY_VALUES);

export const MEASURES: readonly { readonly measure: CaptureMeasure; readonly label: string; readonly noun: string }[] = [
    { measure: "leads", label: "Leads", noun: "leads" },
    { measure: "appointments", label: "Leads con cita", noun: "leads con cita" },
    { measure: "lost", label: "Leads perdidos", noun: "leads perdidos" },
    { measure: "lossReasons", label: "Motivos de pérdida", noun: "leads perdidos" },
];

/** The number a bar, a banner or a ranking shows: one figure per measure. Each lead counts once: scheduled or completed. */
export function primaryValue(values: CaptureValues, measure: CaptureMeasure): number {
    if (measure === "appointments") return values.scheduled + values.completed;
    return measure === "lost" || measure === "lossReasons" ? values.lost : values.leads;
}

export interface CaptureKpiFigures {
    readonly total: number;
    /** The measure as a percentage of every lead; null when there are no leads or the measure is the leads themselves. */
    readonly share: number | null;
    readonly projects: number;
    /** Groups at the chosen depth that have leads: projects, project › campaign pairs or project › campaign › ad paths. */
    readonly units: number;
    /** The measure per unit of the chosen depth. */
    readonly average: number;
}

/** Banner figures for the rows on screen. A group counts once, however many sellers or days it spans. */
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
    /** Text for the cell; counts are plain numbers, shares carry their % sign. */
    readonly cell: (values: CaptureValues) => number | string;
    /** Share columns cannot be added up across rows, so the total line recomputes them from the summed values. */
    readonly isShare?: boolean;
}

const share = (part: number, whole: number): string => (whole ? `${(Math.round((part / whole) * 1000) / 10).toLocaleString("es-CR")} %` : "—");

/** The columns each measure shows in the tables: what the boss asked for at every depth. */
export function columnsFor(measure: CaptureMeasure): readonly ValueColumn[] {
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

/** Ids of one row down to the chosen depth, outermost first. */
function pathIds(row: CaptureRow, depth: CaptureDepth): string[] {
    return [row.projectId, row.campaignId, row.adId].slice(0, depth);
}

const listsOf = (catalogs: CaptureCatalogs) => [catalogs.projects, catalogs.campaigns, catalogs.ads] as const;
const pathLabels = (ids: readonly string[], catalogs: CaptureCatalogs): string[] => ids.map((id, index) => nameOf(listsOf(catalogs)[index] ?? [], id));
export const sellerName = (id: string, catalogs: CaptureCatalogs): string => nameOf(catalogs.sellers, id);

export interface CaptureNode {
    readonly key: string;
    readonly label: string;
    /** The measure's main figure, used for ordering and for the big number. */
    readonly value: number;
    readonly detail: CaptureValues;
    readonly children: readonly CaptureNode[];
}

/** Sums rows into a tree: each level adds up exactly to its parent, so nothing is counted twice or dropped. */
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

/** Id of the project a top-level node stands for (its key is ["all", projectId]). */
export const projectIdOf = (node: CaptureNode): string => (JSON.parse(node.key) as string[])[1] ?? "";

/** All sellers together as a tree: project, and inside it campaign, and inside it ad, each level adding up to its parent. */
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

/** One section per seller with the projects that seller received leads for (and what is inside each, down to the depth). */
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
    /** Names from the outermost level down: ["Proyecto Vista", "Lanzamiento"]. */
    readonly path: readonly string[];
    readonly value: number;
    readonly detail: CaptureValues;
}

/** Counts per project (or project › campaign › ad), all sellers together: the summary table. */
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

/** Seller › project (› campaign › ad) with the counts: the general table, one line per combination. */
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
    /** Names from the outermost level down, so the axis can print one level per line. */
    readonly path: readonly string[];
    /** One value per seller, in the same order as `sellers`. */
    readonly values: readonly number[];
    /** Every lead per seller in the group (not only the measured ones): the base of the percent view. */
    readonly leads?: readonly number[];
}

/** Clustered columns: one group per project (or project › campaign…), one bar per seller inside it. */
export function chartGroups(rows: readonly CaptureRow[], depth: CaptureDepth, measure: CaptureMeasure, catalogs: CaptureCatalogs): { readonly sellers: readonly CaptureSeller[]; readonly groups: readonly ChartGroup[] } {
    // Aggregate each combination once; Todo may contain years of daily rows.
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

/** Series colours: a classic business-chart set (blue, orange, red, teal, green, yellow, mauve, pink, brown, grey…), each with the text colour that stays readable on it. */
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

/** An identity owns its series color; period/catalog ordering never changes it. */
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
