import DT, { type AjaxData } from "datatables.net-dt";

import { listUnitFacets, type UnitFilter, type UnitProject, type UnitSummary } from "./unit-files.api";

export type UnitPaneKey = "code" | "projectIds" | "housingType" | "status";
export type UnitPaneSelection = Record<UnitPaneKey, string[]>;
export interface UnitPaneOption {
    label: string;
    value: string;
    total: number;
    count: number;
}
export type UnitPaneChoices = Record<UnitPaneKey, UnitPaneOption[]>;
const fields = ["code", "projectIds", "housingType", "status"] as const;
/** Only filter locally when aggregate totals prove the required inventory is complete. */
export function localUnitPaneData(items: UnitSummary[], base: UnitPaneChoices | undefined, selection: UnitPaneSelection): UnitTableData | undefined {
    if (!base) return undefined;
    const value = (item: UnitSummary, key: UnitPaneKey) => ({ code: item.code, projectIds: item.project.id, housingType: item.housingType, status: item.sourceStatus })[key] ?? "";
    const matches = (item: UnitSummary, criteria: UnitPaneSelection) => fields.every((key) => !criteria[key].length || criteria[key].includes(value(item, key)));
    const complete = (criteria: UnitPaneSelection) => {
        const all = base.projectIds.reduce((sum, option) => sum + option.total, 0);
        if (items.length === all) return true;
        return fields.some((key) => {
            if (!criteria[key].length) return false;
            const expected = base[key].filter((option) => criteria[key].includes(option.value)).reduce((sum, option) => sum + option.total, 0);
            return items.filter((item) => criteria[key].includes(value(item, key))).length === expected;
        });
    };
    if (!complete(selection)) return undefined;
    const choices = {} as UnitPaneChoices;
    for (const key of fields) {
        const criteria = { ...selection, [key]: [] };
        if (fields.every((field) => !criteria[field].length)) {
            choices[key] = base[key].map((option) => ({ ...option, count: option.total }));
            continue;
        }
        if (!complete(criteria)) return undefined;
        const counts = new Map<string, number>();
        for (const item of items.filter((row) => matches(row, criteria))) {
            const label = value(item, key);
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        choices[key] = base[key].map((option) => ({ ...option, count: counts.get(option.value) ?? 0 }));
    }
    return { items: items.filter((item) => matches(item, selection)), choices };
}
export interface UnitTableData {
    items: UnitSummary[];
    choices: UnitPaneChoices | undefined;
}
type PaneRequest = { draw?: number; order?: AjaxData["order"]; searchPanes?: Record<string, Record<string, string> | string[]> };
export interface UnitPaneAjaxResponse {
    draw: number;
    data: UnitSummary[];
    recordsTotal: number;
    recordsFiltered: number;
    searchPanes: ReturnType<typeof unitPaneResponse>;
}

/** Preserve existing page-local header sorting without issuing another database query. */
function orderUnitPage(items: UnitSummary[], order: AjaxData["order"]) {
    const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
    const rows = items.map((item) => ({ item, values: ["", item.code, item.project.name, item.housingType, item.advertisedSalePrice, item.sourceStatus, item.estimatedDelivery, item.totalArea, item.lotArea, item.approximateParkingArea] }));
    // Null values, numeric/text comparison and direction are independent presentation states.
    // eslint-disable-next-line complexity
    rows.sort((a, b) => {
        for (const sort of order) {
            const left = a.values[sort.column] ?? "";
            const right = b.values[sort.column] ?? "";
            const numeric = [4, 7, 8, 9].includes(sort.column) && left !== "" && right !== "";
            const amount = numeric ? Number(left.replaceAll(",", "")) - Number(right.replaceAll(",", "")) : NaN;
            const compared = Number.isFinite(amount) ? amount : collator.compare(left, right);
            if (compared) return sort.dir === "desc" ? -compared : compared;
        }
        return 0;
    });
    return rows.map((row) => row.item);
}

function paneTableResponse(result: UnitTableData | undefined, current: UnitTableData & { choices: UnitPaneChoices }, request: PaneRequest, selection: UnitPaneSelection): UnitPaneAjaxResponse {
    const data = result ?? { items: [], choices: current.choices };
    const choices = data.choices ?? current.choices;
    const filtered = choices.projectIds.filter((option) => !selection.projectIds.length || selection.projectIds.includes(option.value)).reduce((sum, option) => sum + option.count, 0);
    return { draw: request.draw ?? 0, data: orderUnitPage(data.items, request.order ?? []), recordsTotal: choices.projectIds.reduce((sum, option) => sum + option.total, 0), recordsFiltered: result ? filtered : 0, searchPanes: unitPaneResponse(choices) };
}

/** Coalesce native clear-all redraws and share in-flight requests with sorting/redraw events. */
export function createUnitPaneAjax(getCurrent: () => UnitTableData & { choices: UnitPaneChoices; onFilterChange: (selection: UnitPaneSelection) => Promise<UnitTableData | undefined> | undefined }, onDraw: (items: UnitSummary[]) => void) {
    let accepted = JSON.stringify(unitPaneSelection());
    let pending: { signature: string; promise: Promise<UnitTableData | undefined> } | undefined;
    let generation = 0;
    return (request: PaneRequest, done: (response: UnitPaneAjaxResponse) => void) => {
        const draw = ++generation;
        const selection = unitPaneSelection(request.searchPanes);
        const signature = JSON.stringify(selection);
        // SearchPanes may draw once per cleared pane. Query only the final synchronous state.
        // Stale draws, accepted selections and shared in-flight work are independent protocol states.
        // eslint-disable-next-line complexity
        async function respond() {
            if (draw !== generation) return;
            const current = getCurrent();
            let result: UnitTableData | undefined = current;
            if (pending?.signature === signature) result = await pending.promise;
            else if (signature !== accepted || pending) {
                pending = {
                    signature,
                    promise: Promise.resolve()
                        .then(() => current.onFilterChange(selection))
                        .catch(() => undefined),
                };
                result = await pending.promise;
            }
            if (draw !== generation) return;
            pending = undefined;
            if (result) accepted = signature;
            onDraw(result?.items ?? []);
            done(paneTableResponse(result, current, request, selection));
        }
        queueMicrotask(() => {
            void respond();
        });
    };
}

/** Server-side SearchPanes uses OR within each pane and AND across panes. */
export function unitPaneSelection(searchPanes: Record<string, Record<string, string> | string[]> = {}): UnitPaneSelection {
    return Object.fromEntries(fields.map((key) => [key, [...new Set(Object.values(searchPanes[key === "projectIds" ? "project.name" : key === "status" ? "sourceStatus" : key] ?? {}))].sort()])) as UnitPaneSelection;
}

/** Read bounded aggregate pages only; base totals remain stable while cascaded counts change. */
export async function loadUnitFilePaneChoices(filter: UnitFilter, moduleCode: string, projects: UnitProject[] = [], base?: UnitPaneChoices): Promise<UnitPaneChoices> {
    async function read(kind: UnitPaneKey): Promise<Map<string, number>> {
        const counts = new Map<string, number>();
        const cursors = new Set<string>();
        let after: string | undefined;
        do {
            const page = await listUnitFacets(filter, kind, after, moduleCode);
            page.items.forEach((item) => counts.set(item.value, item.count));
            after = page.nextAfter ?? undefined;
            if (after !== undefined && cursors.has(after)) throw new Error("Repeated unit option cursor");
            if (after !== undefined) cursors.add(after);
        } while (after !== undefined);
        return counts;
    }
    const values = await Promise.all(fields.map(read));
    return Object.fromEntries(
        fields.map((kind, index) => {
            const counts = values[index] ?? new Map<string, number>();
            const original = base?.[kind];
            const totals = new Map(original?.map((option) => [option.value, option.total]));
            const options = (original?.map((option) => option.value) ?? [...counts.keys()]).map((value) => {
                const count = counts.get(value) ?? 0;
                const total = totals.get(value) ?? count;
                const label = kind === "projectIds" ? (projects.find((project) => project.id === value)?.name ?? value) : value || "Sin asignar";
                return { label: DT.util.escapeHtml(label), value, total, count };
            });
            return [kind, options];
        }),
    ) as UnitPaneChoices;
}

/** DataTables keys pane options by the column's data source, not its visible title. */
export function unitPaneResponse(choices: UnitPaneChoices) {
    return { options: { code: choices.code, "project.name": choices.projectIds, housingType: choices.housingType, sourceStatus: choices.status } };
}
