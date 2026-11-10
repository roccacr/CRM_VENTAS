import "datatables.net-dt/css/dataTables.dataTables.css";
import "datatables.net-select-dt/css/select.dataTables.css";
import "datatables.net-searchpanes-dt/css/searchPanes.dataTables.css";
import "datatables.net-searchpanes-dt";
import "datatables.net-select-dt";
import "../pages/SystemUsersPage.css";

import EditOutlined from "@ant-design/icons/EditOutlined";
import EllipsisOutlined from "@ant-design/icons/EllipsisOutlined";
import StopOutlined from "@ant-design/icons/StopOutlined";
import Button from "antd/es/button";
import Dropdown from "antd/es/dropdown";
import Empty from "antd/es/empty";
import Tag from "antd/es/tag";
import DT from "datatables.net-dt";
import DataTable, { type DataTableProps, type DataTableRef } from "datatables.net-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { CatalogItem, CatalogItemStatus } from "../../../services/catalogs/catalog-service";
import { type DataTableSearchPanesConfig, readDataTableState, useDataTableSearchPanes, writeDataTableState } from "../hooks/useDataTableSearchPanes";
import { CATALOG_REFERENCE_PROVIDERS } from "./catalog-definitions";

const registerDataTable = DataTable.use;
registerDataTable(DT);
const FIELDS = [{ columnIndex: 0 }, { columnIndex: 2 }, { columnIndex: 3 }];
const DISABLED_FIELDS = [1, 4];
const STATUS_LABELS = { active: "Activo", inactive: "Inactivo" };
const COLUMNS = [{ data: "name" }, { data: "detail", defaultContent: "Sin asignar" }, { data: "externalReferences" }, { data: "status" }, { data: null, orderable: false, searchable: false, defaultContent: "" }];
const paneText = (type: string, value: string): string => (type === "pane" ? DT.util.escapeHtml(value) : value);

const FILTER_TITLE = "Filtros activos: %d";
const TEST_LAYOUT = { topStart: null, topEnd: null, bottomStart: "info", bottomEnd: ["pageLength", "paging"] };
const PROJECT_TOOLBAR_ROW_CLASS = "dt-layout-row projects-view-toolbar";

/**
 * Catalog panes filter the loaded API page. Static facet counts avoid
 * rebuilding the nested pane tables after each main-table draw.
 */
const getTableLayout = (layout: DataTableSearchPanesConfig["layout"], projectView: boolean, enablePanes: boolean) => {
    const top = (layout as { readonly top?: { readonly searchPanes?: Record<string, unknown> } }).top;
    const searchPanes = { ...top?.searchPanes, cascadePanes: false, viewTotal: false };
    if (!projectView) return { ...(enablePanes ? { ...layout, top: { searchPanes } } : TEST_LAYOUT), top1Start: "search" };
    if (!enablePanes) return { ...TEST_LAYOUT, top: { features: ["search"], rowClass: PROJECT_TOOLBAR_ROW_CLASS } };
    return { ...layout, top1Start: null, top: { features: ["search", { searchPanes: { ...searchPanes, orderable: false } }], rowClass: PROJECT_TOOLBAR_ROW_CLASS } };
};

/** An empty title lets Projects hide the counter until a filter is active. */
const getFilterTitle = (projectView: boolean) => (projectView ? { 0: "", _: FILTER_TITLE } : FILTER_TITLE);

/** Screen-reader and tooltip strings that DataTables and SearchPanes otherwise announce in English. */
const PROJECT_ARIA_LANGUAGE = {
    aria: {
        orderable: ": activar para ordenar",
        orderableRemove: ": activar para quitar el orden",
        orderableReverse: ": activar para invertir el orden",
        paginate: { first: "Primera página", last: "Última página", next: "Página siguiente", previous: "Página anterior" },
    },
};
const PROJECT_PANE_LANGUAGE = {
    buttons: { clearPane: "Limpiar selección", clearSearch: "Limpiar búsqueda", collapse: "Mostrar u ocultar filtro", orderByCount: "Ordenar por cantidad", orderByLabel: "Ordenar por nombre" },
    emptyMessage: "Sin asignar",
};
const getAriaLanguage = (projectView: boolean) => (projectView ? PROJECT_ARIA_LANGUAGE : {});
const getPaneLanguage = (projectView: boolean) => (projectView ? PROJECT_PANE_LANGUAGE : {});
const shouldDeferPanes = (rowCount: number, requested: boolean): boolean => rowCount > 200 && !requested;
const canMountPanes = (deferred: boolean): boolean => import.meta.env.MODE !== "test" && !deferred;

/** Compact grid placeholder; screen readers and search still receive "Sin asignar". */
const PROJECT_EMPTY_VALUE = '<span class="projects-view-empty" title="Sin asignar"><span aria-hidden="true">—</span><span class="administration-users-visually-hidden">Sin asignar</span></span>';

// DataTables inserts display strings as HTML, so escape all catalog values at this boundary.
const escapeCell = (value: string): string => DT.util.escapeHtml(value);

type TableApi = NonNullable<ReturnType<DataTableRef["dt"]>>;
type CatalogActionTarget = { item: CatalogItem; anchor: HTMLElement; data: CatalogItem[] };
type LoadedRows = { api: TableApi; data: CatalogItem[]; filtersStale: boolean };
const getSearchPanes = (api: TableApi) => (api as unknown as { searchPanes?: { rebuildPane(index?: number, maintainSelect?: boolean): unknown } }).searchPanes;

function redrawCatalogRows(api: TableApi, root: HTMLElement | null): boolean {
    const toolbar = root?.querySelector(".dtsp-panesContainer");
    const searchPanes = toolbar ? getSearchPanes(api) : undefined;
    const filtersInUse = toolbar?.querySelector(".dtsp-collapseAll:not(:disabled), .dtsp-clearAll:not(:disabled)");
    if (searchPanes && filtersInUse) {
        searchPanes.rebuildPane(undefined, true);
        return false;
    }
    api.draw(false);
    // Closed, unused panes can wait until the next interaction with the filter toolbar.
    return Boolean(searchPanes);
}

/**
 * Reemplaza las filas cuando llega un lote nuevo sobre la misma tabla.
 *
 * Una tabla recién creada ya inicializa filas y paneles desde `options.data`;
 * solo un cambio de datos sobre la misma instancia necesita redibujar y
 * reconstruir los valores de los paneles de búsqueda.
 */
function refreshLoadedRows(loaded: { current: LoadedRows | null }, api: TableApi, data: CatalogItem[], root: HTMLElement | null): void {
    const previous = loaded.current;
    if (previous?.api === api && previous.data === data) return;
    const current = { api, data, filtersStale: false };
    loaded.current = current;
    if (previous?.api !== api) return;
    const start = performance.now();
    api.clear().rows.add(data);
    const rowsReady = performance.now();
    current.filtersStale = redrawCatalogRows(api, root);
    if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
        const timing = performance.measure("habita:catalog:draw", { start, detail: { rows: data.length } });
        console.info("[Habita Catálogos] redibujado", JSON.stringify({ rows: data.length, filtersDeferred: current.filtersStale, replaceRowsMs: Math.round(rowsReady - start), filtersAndDrawMs: Math.round(timing.duration - (rowsReady - start)), durationMs: Math.round(timing.duration) }));
    }
}

/** Missing providers are read-only placeholders, shared by display and search; never mutation data. */
function projectReferences(references: CatalogItem["externalReferences"]) {
    return [...references, ...CATALOG_REFERENCE_PROVIDERS.filter((provider) => !references.some((reference) => reference.systemCode === provider.systemCode)).map((provider) => ({ ...provider, externalId: null }))];
}

interface CatalogItemsDataTableProps {
    /** Exact current-context update/inactivate grants; omitted grants fail closed. */
    readonly canEdit?: boolean;
    readonly canInactivate?: boolean;
    readonly entityLabel: string;
    readonly projectView?: boolean;
    readonly items: readonly CatalogItem[];
    readonly label: string;
    readonly isLoading: boolean;
    readonly storageKey: string;
    readonly selectedPublicId: string | null;
    readonly onSelect: (item: CatalogItem) => void;
    readonly onEdit: (item: CatalogItem) => void;
    readonly onStatusAction: (item: CatalogItem, status: CatalogItemStatus) => void;
    /** Ids en el orden y filtro aplicados, para que el detalle recorra lo mismo que se ve. */
    readonly onVisibleOrderChange?: (publicIds: readonly string[]) => void;
}

/** Keep the outgoing loader mounted only for its crossfade; requests are never delayed. */
export function CatalogItemsDataTable(props: CatalogItemsDataTableProps) {
    const pending = props.isLoading;
    const [showLoader, setShowLoader] = useState(pending);
    useEffect(() => {
        if (!props.projectView || (!pending && !showLoader)) return;
        const timer = window.setTimeout(
            () => {
                setShowLoader(pending);
            },
            pending ? 0 : 400,
        );
        return () => {
            window.clearTimeout(timer);
        };
    }, [props.projectView, pending, showLoader]);
    if (!props.projectView) return <CatalogItemsTableContent {...props} />;
    return (
        <div className="projects-view-load-canvas" aria-busy={props.isLoading}>
            {(showLoader || pending) && (
                <div className="projects-view-loader" data-loading={props.isLoading} role="status" aria-label={`Cargando ${props.label.toLocaleLowerCase("es-CR")}`}>
                    <span className="projects-view-loader__ring" aria-hidden="true" />
                    <span className="projects-view-loader__title">Cargando {props.label.toLocaleLowerCase("es-CR")}...</span>
                    <span className="projects-view-loader__caption">Sincronizando registros y catálogo Habita</span>
                </div>
            )}
            {(!props.isLoading || props.items.length > 0) && (
                <div className="projects-view-grid-reveal">
                    <CatalogItemsTableContent {...props} />
                </div>
            )}
        </div>
    );
}

/** Uses the users table's SearchPanes, layout and persistence without sharing catalog state. */
function CatalogItemsTableContent({ canEdit: editPermission, canInactivate: inactivatePermission, projectView = false, entityLabel, items, label, isLoading, storageKey, selectedPublicId, onSelect, onEdit, onStatusAction, onVisibleOrderChange }: CatalogItemsDataTableProps) {
    const canEdit = editPermission === true;
    const canInactivate = inactivatePermission === true;
    const data = useMemo(() => [...items], [items]);
    const [filtersRequested, setFiltersRequested] = useState(() => {
        const saved = readDataTableState(storageKey)?.searchPanes as { selectionList?: unknown[] } | undefined;
        return Boolean(saved?.selectionList?.length);
    });
    // Building hidden SearchPanes on a large first page can block the main thread.
    const filtersDeferred = shouldDeferPanes(data.length, filtersRequested);
    const enablePanes = canMountPanes(filtersDeferred);
    const container = useRef<HTMLDivElement>(null);
    const table = useRef<DataTableRef>(null);
    const loaded = useRef<LoadedRows | null>(null);
    const mobileSort = useRef<HTMLSelectElement>(null);
    const selected = useRef(selectedPublicId);
    const [actionTarget, setActionTarget] = useState<CatalogActionTarget | null>(null);
    const panes = useDataTableSearchPanes({ fields: FIELDS, disabledColumnIndexes: DISABLED_FIELDS });
    useEffect(() => {
        const api = table.current?.dt();
        if (api) refreshLoadedRows(loaded, api, data, container.current);
    }, [canEdit, canInactivate, data, enablePanes, storageKey]);
    const options = useMemo<NonNullable<DataTableProps["options"]>>(
        () =>
            ({
                autoWidth: false,
                data,
                // Pane labels need escaped text, not the DOM nodes returned by React display slots.
                columnDefs: enablePanes ? [{ targets: [0, 2, 3], searchPanes: { show: true, orthogonal: { display: "pane", search: "filter", sort: "filter", type: "filter" } } }, ...(panes.columnDefs ?? [])] : [],
                layout: { ...getTableLayout(panes.layout, projectView, enablePanes), bottomStart: null, bottomEnd: null },
                // The page owns API pagination; never paginate this batch a second time.
                paging: false,
                lengthMenu: [10, 25, 50, 100],
                pageLength: 10,
                order: [[0, "asc"]],
                stateSave: true,
                stateDuration: -1,
                stateLoadCallback: () => readDataTableState(storageKey),
                stateSaveCallback: (_settings: unknown, state: Record<string, unknown>) => {
                    writeDataTableState(storageKey, state);
                },
                createdRow: (row: HTMLTableRowElement, item: CatalogItem) => {
                    row.dataset.catalogPublicId = item.publicId;
                    row.setAttribute("aria-label", `Ver detalle de ${item.name}`);
                    row.classList.add("catalog-items-row");
                    if (projectView)
                        Array.from(row.cells).forEach((cell, index) => {
                            cell.dataset.projectField = [entityLabel, "Descripción", "Integraciones", "Estado", "Acciones"][index] ?? "";
                        });
                },
                language: {
                    ...getAriaLanguage(projectView),
                    search: "Buscar:",
                    searchPlaceholder: `Buscar en ${label}`,
                    lengthMenu: "Filas por página _MENU_",
                    info: "_START_–_END_ de _TOTAL_ valores",
                    infoEmpty: "0 valores",
                    infoFiltered: "· filtrado de _MAX_",
                    emptyTable: "Sin resultados.",
                    zeroRecords: "Sin resultados para los filtros seleccionados.",
                    paginate: { first: "«", last: "»", next: "›", previous: "‹" },
                    searchPanes: { clearMessage: "Limpiar", collapse: { 0: "Filtros", _: "Filtros (%d)" }, collapseMessage: "Contraer", count: "{total}", countFiltered: "{shown} de {total}", emptyPanes: "No hay filtros disponibles", loadMessage: "Cargando filtros...", showMessage: "Expandir", title: getFilterTitle(projectView), ...getPaneLanguage(projectView) },
                },
            }) as unknown as NonNullable<DataTableProps["options"]>,
        [data, enablePanes, entityLabel, label, panes, projectView, storageKey],
    );

    const syncProjectFilterTracks = useCallback((): void => {
        if (!projectView || !container.current) return;
        const root = container.current;
        const headers = Array.from(root.querySelectorAll<HTMLTableCellElement>("table.administration-users-datatable > thead > tr > th"));
        const bounds = headers.map((header) => header.getBoundingClientRect());
        const first = bounds[0];
        // Measure the actual columns, including the scrollbar gutter, rather than duplicate their widths.
        if (!first || bounds.some((bound) => bound.width <= 0)) return;
        const updateTrack = (property: string, value: string): void => {
            if (root.style.getPropertyValue(property) !== value) root.style.setProperty(property, value);
        };
        updateTrack("--projects-filter-tracks", bounds.map((bound) => `${String(bound.width)}px`).join(" "));
        updateTrack("--projects-filter-offset", `${String(first.left - root.getBoundingClientRect().left)}px`);
        const toolbar = root.querySelector(".dtsp-titleRow");
        toolbar?.setAttribute("role", "group");
        toolbar?.setAttribute("aria-label", `Controles de filtros de ${label.toLocaleLowerCase("es-CR")}`);
        root.querySelector(".dtsp-title")?.setAttribute("aria-live", "polite");
    }, [label, projectView]);

    useEffect(() => {
        if (!projectView || !container.current) return;
        syncProjectFilterTracks();
        const observer = new ResizeObserver(syncProjectFilterTracks);
        observer.observe(container.current);
        const element = container.current.querySelector("table.administration-users-datatable");
        if (element) observer.observe(element);
        return () => {
            observer.disconnect();
        };
    }, [data, enablePanes, projectView, syncProjectFilterTracks]);

    const syncRows = (): void => {
        if (mobileSort.current) mobileSort.current.value = table.current?.dt()?.order().toString() ?? "";
        container.current?.querySelectorAll<HTMLTableRowElement>("tr[data-catalog-public-id]").forEach((row) => {
            row.tabIndex = isLoading ? -1 : 0;
            row.classList.toggle("catalog-items-row--selected", row.dataset.catalogPublicId === selected.current);
        });
    };
    const reportedOrder = useRef("");
    const reportVisibleOrder = (): void => {
        const rows = table.current?.dt()?.rows({ search: "applied", order: "applied" });
        if (!onVisibleOrderChange || !rows) return;
        const publicIds = (rows.data().toArray() as CatalogItem[]).map((item) => item.publicId);
        const signature = publicIds.join("|");
        if (signature === reportedOrder.current) return;
        reportedOrder.current = signature;
        onVisibleOrderChange(publicIds);
    };
    useEffect(() => {
        selected.current = selectedPublicId;
        syncRows();
        // The initial draw runs before the wrapper exposes its DataTables API.
        reportVisibleOrder();
    });
    const refreshStaleFilters = (target: EventTarget): void => {
        if (!(target instanceof Element) || !target.closest(".dtsp-showAll, .dtsp-topRow")) return;
        setFiltersRequested(true);
        const current = loaded.current;
        if (!current?.filtersStale) return;
        current.filtersStale = false;
        getSearchPanes(current.api)?.rebuildPane(undefined, true);
    };

    // SearchPanes initializes with data; later batches update the same mounted table.
    if (data.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isLoading ? "Cargando catálogo…" : "Sin resultados"} />;

    return (
        <div
            ref={container}
            className="administration-users-datatable-wrap"
            aria-busy={isLoading}
            onClickCapture={(event) => {
                refreshStaleFilters(event.target);
            }}
            onKeyDownCapture={(event) => {
                refreshStaleFilters(event.target);
            }}
            onClick={(event) => {
                const target = event.target as HTMLElement;
                if (isLoading) return;
                const publicId = target.closest<HTMLTableRowElement>("tr[data-catalog-public-id]")?.dataset.catalogPublicId;
                const item = items.find((item) => item.publicId === publicId);
                const anchor = target.closest("[data-catalog-actions]")?.parentElement;
                if (item && anchor) {
                    setActionTarget({ item, anchor, data });
                    return;
                }
                if (target.closest("button, a, input, select, label, [role='menuitem']")) return;
                if (item) onSelect(item);
            }}
            onKeyDown={(event) => {
                const target = event.target as HTMLElement;
                if (isLoading || !target.matches("tr[data-catalog-public-id]") || !["Enter", " "].includes(event.key)) return;
                const item = items.find((item) => item.publicId === target.dataset.catalogPublicId);
                if (item) {
                    event.preventDefault();
                    onSelect(item);
                }
            }}
        >
            <label className="projects-view-mobile-sort" hidden={!projectView}>
                Ordenar {label.toLocaleLowerCase("es-CR")}
                <select
                    ref={mobileSort}
                    disabled={isLoading}
                    defaultValue="0,asc"
                    onChange={(event) => {
                        const [column, direction] = event.currentTarget.value.split(",");
                        table.current
                            ?.dt()
                            ?.order([Number(column), direction === "desc" ? "desc" : "asc"])
                            .draw();
                    }}
                >
                    <option value="" disabled>
                        Orden personalizado
                    </option>
                    <option value="0,asc">{entityLabel}: A a Z</option>
                    <option value="0,desc">{entityLabel}: Z a A</option>
                    <option value="1,asc">Descripción: A a Z</option>
                    <option value="1,desc">Descripción: Z a A</option>
                    <option value="2,asc">Integraciones: ascendente</option>
                    <option value="2,desc">Integraciones: descendente</option>
                    <option value="3,asc">Estado: A a Z</option>
                    <option value="3,desc">Estado: Z a A</option>
                </select>
            </label>
            <div hidden={!filtersDeferred}>
                <Button
                    onClick={() => {
                        setFiltersRequested(true);
                    }}
                >
                    Cargar filtros
                </Button>
            </div>
            <DataTable
                ref={table}
                key={`${storageKey}:${String(canEdit)}:${String(canInactivate)}:${String(enablePanes)}`}
                className="administration-users-datatable"
                columns={COLUMNS}
                options={options}
                onDraw={() => {
                    syncRows();
                    reportVisibleOrder();
                }}
                slots={{
                    0: (_value: unknown, type: string, item: CatalogItem) => {
                        if (type !== "display") return paneText(type, `${item.name}${type === "filter" ? ` ${item.nativeCode}` : ""}`);
                        const code = projectView ? "" : `<small>${escapeCell(item.nativeCode)}</small>`;
                        const updated = projectView && item.updatedAt.trim() ? `<time datetime="${escapeCell(item.updatedAt)}">Actualizado ${new Date(item.updatedAt).toLocaleDateString("es-CR")}</time>` : "";
                        return `<div class="catalog-items-name"><strong>${escapeCell(item.name)}</strong>${code}${updated}</div>`;
                    },
                    1: (_value: unknown, type: string, item: CatalogItem) => {
                        if (type !== "display") return item.detail || "Sin asignar";
                        if (!projectView) return `<span>${escapeCell(item.detail || "Sin asignar")}</span>`;
                        const detail = item.detail?.trim();
                        return `<div class="projects-view-description">${detail ? `<span>${escapeCell(detail)}</span>` : PROJECT_EMPTY_VALUE}</div>`;
                    },
                    2: (_value: unknown, type: string, item: CatalogItem) =>
                        type === "display" ? (
                            projectView ? (
                                `<div class="projects-view-integrations">${projectReferences(item.externalReferences)
                                    .map((reference) => {
                                        const id = reference.externalId?.trim();
                                        const value = id ? `<span class="projects-view-integration__id">${escapeCell(id)}</span>` : PROJECT_EMPTY_VALUE;
                                        return `<div class="projects-view-integration"><span>${escapeCell(reference.systemName)}</span>${value}</div>`;
                                    })
                                    .join("")}</div>`
                            ) : (
                                <div className="catalog-items-reference-list">
                                    {item.externalReferences.length
                                        ? item.externalReferences.map((reference) => (
                                              <Tag key={`${reference.systemCode}:${reference.externalId}`}>
                                                  {reference.systemName}: {reference.externalId}
                                              </Tag>
                                          ))
                                        : "Sin asignar"}
                                </div>
                            )
                        ) : (
                            paneText(type, (projectView && type === "filter" ? projectReferences(item.externalReferences) : item.externalReferences).map((reference) => `${reference.systemName}: ${reference.externalId ?? "Sin asignar"}`).join(", ") || "Sin asignar")
                        ),
                    3: (_value: unknown, type: string, item: CatalogItem) => (type === "display" ? `<span class="catalog-items-status catalog-items-status--${escapeCell(item.status)}">${STATUS_LABELS[item.status]}</span>` : STATUS_LABELS[item.status]),
                    4: (_value: unknown, type: string, item: CatalogItem) => (type === "display" && (canEdit || (canInactivate && item.status === "active")) ? `<span class="catalog-row-actions"><button type="button" class="ant-btn ant-btn-default ant-btn-sm ant-btn-icon-only" data-catalog-actions aria-haspopup="menu" aria-label="Acciones de ${escapeCell(item.name)}">⋯</button></span>` : ""),
                }}
            >
                {projectView && <caption className="administration-users-visually-hidden">{label}</caption>}
                <thead>
                    <tr>
                        <th>{projectView ? entityLabel : "Nombre"}</th>
                        <th>{projectView ? "Descripción" : "Detalle"}</th>
                        <th>{projectView ? "Integraciones" : "Referencias"}</th>
                        <th>Estado</th>
                        <th aria-label="Acciones" />
                    </tr>
                </thead>
            </DataTable>
            <ActiveCatalogActions
                target={actionTarget}
                data={data}
                isLoading={isLoading}
                projectView={projectView}
                canEdit={canEdit}
                canInactivate={canInactivate}
                onEdit={onEdit}
                onStatusAction={onStatusAction}
                close={() => {
                    setActionTarget(null);
                }}
            />
        </div>
    );
}

/** Only authorized actions enter the menu; reactivation uses update, never inactivate. */
function ActiveCatalogActions({ target, data, isLoading, close, ...props }: Pick<CatalogItemsDataTableProps, "projectView" | "canEdit" | "canInactivate" | "onEdit" | "onStatusAction" | "isLoading"> & { readonly target: CatalogActionTarget | null; readonly data: CatalogItem[]; readonly close: () => void }) {
    if (!target || target.data !== data || isLoading) return null;
    return createPortal(<CatalogRowActions {...props} item={target.item} close={close} />, target.anchor);
}

function CatalogRowActions({ item, projectView, canEdit: editPermission, canInactivate: inactivatePermission, onEdit, onStatusAction, close }: Pick<CatalogItemsDataTableProps, "projectView" | "canEdit" | "canInactivate" | "onEdit" | "onStatusAction"> & { readonly item: CatalogItem; readonly close: () => void }) {
    const canEdit = editPermission === true;
    const canInactivate = inactivatePermission === true;
    const active = item.status === "active";
    const canChangeStatus = active ? canInactivate : canEdit;
    const nextStatus: CatalogItemStatus = ({ active: "inactive", inactive: "active" } as const)[item.status];
    const immutable = item.publicId.startsWith("legacy:") && !/^legacy:(projects|campaigns|classes|locations|subsidiaries|brokers):[1-9]\d*$/.test(item.publicId);
    if (!canEdit && !canChangeStatus) return null;
    return (
        <Dropdown
            trigger={["click"]}
            open
            autoFocus
            onOpenChange={(open) => {
                if (!open) close();
            }}
            {...(projectView ? { rootClassName: "catalog-items-dropdown--projects" } : {})}
            menu={{
                items: [...(canEdit ? [{ key: "edit", icon: <EditOutlined />, label: "Editar", disabled: immutable }] : []), ...(canChangeStatus ? [{ key: nextStatus, icon: <StopOutlined />, label: { active: "Inactivar", inactive: "Reactivar" }[item.status], danger: active, disabled: immutable }] : [])],
                onClick: ({ key, domEvent }) => {
                    domEvent.stopPropagation();
                    close();
                    if (immutable) return;
                    if (key === "edit") {
                        if (canEdit) onEdit(item);
                        return;
                    }
                    if (key === nextStatus && canChangeStatus) onStatusAction(item, nextStatus);
                },
            }}
        >
            <Button
                className="catalog-row-actions__active"
                size="small"
                aria-label={`Acciones de ${item.name}`}
                icon={<EllipsisOutlined />}
                onClick={(event) => {
                    event.stopPropagation();
                }}
            />
        </Dropdown>
    );
}
