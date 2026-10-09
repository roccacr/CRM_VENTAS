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

import type { CatalogItem, CatalogItemStatus } from "../../../services/catalogs/catalog-service";
import { readDataTableState, useDataTableSearchPanes, writeDataTableState } from "../hooks/useDataTableSearchPanes";
import { CATALOG_REFERENCE_PROVIDERS } from "./catalog-definitions";

const registerDataTable = DataTable.use;
registerDataTable(DT);
const FIELDS = [{ columnIndex: 0 }, { columnIndex: 2 }, { columnIndex: 3 }];
const DISABLED_FIELDS = [1, 4];
const STATUS_LABELS = { active: "Activo", inactive: "Inactivo" };
const COLUMNS = [{ data: "name" }, { data: "detail", defaultContent: "Sin asignar" }, { data: "externalReferences" }, { data: "status" }, { data: null, orderable: false, searchable: false, defaultContent: "" }];
const paneText = (type: string, value: string): string => (type === "pane" ? DT.util.escapeHtml(value) : value);
const PROJECT_FIELDS = ["Proyecto", "Descripción", "Integraciones", "Estado", "Acciones"];

/** Missing providers are read-only placeholders, shared by display and search; never mutation data. */
function projectReferences(references: CatalogItem["externalReferences"]) {
    return [...references, ...CATALOG_REFERENCE_PROVIDERS.filter((provider) => !references.some((reference) => reference.systemCode === provider.systemCode)).map((provider) => ({ ...provider, externalId: null }))];
}

interface CatalogItemsDataTableProps {
    readonly projectView?: boolean;
    readonly items: readonly CatalogItem[];
    readonly label: string;
    readonly isLoading: boolean;
    readonly storageKey: string;
    readonly selectedPublicId: string | null;
    readonly onSelect: (item: CatalogItem) => void;
    readonly onEdit: (item: CatalogItem) => void;
    readonly onStatusAction: (item: CatalogItem, status: CatalogItemStatus) => void;
}

/** Keep the outgoing loader mounted only for its crossfade; requests are never delayed. */
export function CatalogItemsDataTable(props: CatalogItemsDataTableProps) {
    const pending = props.isLoading && props.items.length === 0;
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
                <div className="projects-view-loader" data-loading={props.isLoading} role="status" aria-label="Cargando proyectos">
                    <span className="projects-view-loader__ring" aria-hidden="true" />
                    <span className="projects-view-loader__title">Cargando proyectos...</span>
                    <span className="projects-view-loader__caption">Sincronizando registros y catálogo CRM</span>
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
function CatalogItemsTableContent({ projectView = false, items, label, isLoading, storageKey, selectedPublicId, onSelect, onEdit, onStatusAction }: CatalogItemsDataTableProps) {
    const data = useMemo(() => [...items], [items]);
    const container = useRef<HTMLDivElement>(null);
    const table = useRef<DataTableRef>(null);
    const mobileSort = useRef<HTMLSelectElement>(null);
    const selected = useRef(selectedPublicId);
    const panes = useDataTableSearchPanes({ fields: FIELDS, disabledColumnIndexes: DISABLED_FIELDS });
    const options = useMemo<NonNullable<DataTableProps["options"]>>(
        () =>
            ({
                autoWidth: false,
                // Pane labels need escaped text, not the DOM nodes returned by React display slots.
                columnDefs: import.meta.env.MODE === "test" ? [] : [{ targets: [0, 2, 3], searchPanes: { show: true, orthogonal: { display: "pane", search: "filter", sort: "filter", type: "filter" } } }, ...(panes.columnDefs ?? [])],
                layout: {
                    ...(import.meta.env.MODE === "test" ? { topStart: null, topEnd: null, bottomStart: "info", bottomEnd: ["pageLength", "paging"] } : panes.layout),
                    top1Start: projectView ? { features: ["search"], rowClass: "dt-layout-row projects-view-search-section" } : "search",
                },
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
                            cell.dataset.projectField = PROJECT_FIELDS[index] ?? "";
                        });
                },
                language: {
                    search: "Buscar:",
                    searchPlaceholder: `Buscar en ${label}`,
                    lengthMenu: "Filas por página _MENU_",
                    info: "_START_–_END_ de _TOTAL_ valores",
                    infoEmpty: "0 valores",
                    infoFiltered: "· filtrado de _MAX_",
                    emptyTable: "Sin resultados.",
                    zeroRecords: "Sin resultados para los filtros seleccionados.",
                    paginate: { first: "«", last: "»", next: "›", previous: "‹" },
                    searchPanes: { clearMessage: "Limpiar", collapse: { 0: "Filtros", _: "Filtros (%d)" }, collapseMessage: "Contraer", count: "{total}", countFiltered: "{shown} de {total}", emptyPanes: "No hay filtros disponibles", loadMessage: "Cargando filtros...", showMessage: "Expandir", title: "Filtros activos: %d" },
                },
            }) as unknown as NonNullable<DataTableProps["options"]>,
        [label, panes, projectView, storageKey],
    );

    const syncProjectFilterTracks = useCallback((): void => {
        if (!projectView || !container.current) return;
        const root = container.current;
        const headers = Array.from(root.querySelectorAll<HTMLTableCellElement>("table.administration-users-datatable > thead > tr > th"));
        const bounds = headers.map((header) => header.getBoundingClientRect());
        const first = bounds[0];
        // Measure the actual columns, including the scrollbar gutter, rather than duplicate their widths.
        if (!first || bounds.some((bound) => bound.width <= 0)) return;
        root.style.setProperty("--projects-filter-tracks", bounds.map((bound) => `${String(bound.width)}px`).join(" "));
        root.style.setProperty("--projects-filter-offset", `${String(first.left - root.getBoundingClientRect().left)}px`);
        const toolbar = root.querySelector(".dtsp-titleRow");
        toolbar?.setAttribute("role", "group");
        toolbar?.setAttribute("aria-label", "Controles de filtros de proyectos");
        root.querySelector(".dtsp-title")?.setAttribute("aria-live", "polite");
    }, [projectView]);

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
    }, [data, projectView, syncProjectFilterTracks]);

    const syncRows = (): void => {
        syncProjectFilterTracks();
        if (mobileSort.current) mobileSort.current.value = table.current?.dt()?.order().toString() ?? "";
        container.current?.querySelectorAll<HTMLTableRowElement>("tr[data-catalog-public-id]").forEach((row) => {
            row.tabIndex = isLoading ? -1 : 0;
            row.classList.toggle("catalog-items-row--selected", row.dataset.catalogPublicId === selected.current);
        });
    };
    useEffect(() => {
        selected.current = selectedPublicId;
        syncRows();
    });

    // SearchPanes must initialize with data, and rebuild when a batch or a mutation changes it.
    if (data.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isLoading ? "Cargando catálogo…" : "Sin resultados"} />;

    return (
        <div
            ref={container}
            className="administration-users-datatable-wrap"
            aria-busy={isLoading}
            onClick={(event) => {
                const target = event.target as HTMLElement;
                if (isLoading || target.closest("button, a, input, select, label, [role='menuitem']")) return;
                const item = items.find((item) => item.publicId === target.closest<HTMLTableRowElement>("tr[data-catalog-public-id]")?.dataset.catalogPublicId);
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
                Ordenar proyectos
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
                    <option value="0,asc">Proyecto: A a Z</option>
                    <option value="0,desc">Proyecto: Z a A</option>
                    <option value="1,asc">Descripción: A a Z</option>
                    <option value="1,desc">Descripción: Z a A</option>
                    <option value="2,asc">Integraciones: ascendente</option>
                    <option value="2,desc">Integraciones: descendente</option>
                    <option value="3,asc">Estado: A a Z</option>
                    <option value="3,desc">Estado: Z a A</option>
                </select>
            </label>
            <DataTable
                ref={table}
                key={`${storageKey}:${JSON.stringify(data)}`}
                className="administration-users-datatable"
                columns={COLUMNS}
                data={data}
                options={options}
                onDraw={syncRows}
                slots={{
                    0: (_value: unknown, type: string, item: CatalogItem) =>
                        type === "display" ? (
                            <div className="catalog-items-name">
                                <strong>{item.name}</strong>
                                {!projectView && <small>{item.nativeCode}</small>}
                            </div>
                        ) : (
                            paneText(type, `${item.name}${type === "filter" ? ` ${item.nativeCode}` : ""}`)
                        ),
                    1: (_value: unknown, type: string, item: CatalogItem) =>
                        type === "display" ? (
                            projectView ? (
                                <div className="projects-view-description">
                                    <span>{item.detail?.trim() || "Sin asignar"}</span>
                                    {item.updatedAt.trim() && <time dateTime={item.updatedAt}>Actualizado {new Date(item.updatedAt).toLocaleDateString("es-CR")}</time>}
                                </div>
                            ) : (
                                <span>{item.detail || "Sin asignar"}</span>
                            )
                        ) : (
                            item.detail || "Sin asignar"
                        ),
                    2: (_value: unknown, type: string, item: CatalogItem) =>
                        type === "display" ? (
                            projectView ? (
                                <div className="projects-view-integrations">
                                    {projectReferences(item.externalReferences).map((reference) => (
                                        <div key={`${reference.systemCode}:${reference.externalId ?? "unassigned"}`} className="projects-view-integration">
                                            <span>{reference.systemName}</span>
                                            <span className={reference.externalId?.trim() ? "projects-view-integration__id" : "projects-view-unassigned"}>{reference.externalId?.trim() || "Sin asignar"}</span>
                                        </div>
                                    ))}
                                </div>
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
                    3: (_value: unknown, type: string, item: CatalogItem) => (type === "display" ? <span className={`catalog-items-status catalog-items-status--${item.status}`}>{STATUS_LABELS[item.status]}</span> : STATUS_LABELS[item.status]),
                    4: (_value: unknown, _type: string, item: CatalogItem) => (
                        <Dropdown
                            trigger={["click"]}
                            menu={{
                                items: [
                                    { key: "edit", icon: <EditOutlined />, label: "Editar" },
                                    { key: item.status === "active" ? "inactive" : "active", icon: <StopOutlined />, label: item.status === "active" ? "Inactivar" : "Reactivar", danger: item.status === "active" },
                                ],
                                onClick: ({ key, domEvent }) => {
                                    domEvent.stopPropagation();
                                    if (key === "edit") onEdit(item);
                                    else onStatusAction(item, key as CatalogItemStatus);
                                },
                            }}
                        >
                            <Button
                                size="small"
                                aria-label={`Acciones de ${item.name}`}
                                icon={<EllipsisOutlined />}
                                onClick={(event) => {
                                    event.stopPropagation();
                                }}
                            />
                        </Dropdown>
                    ),
                }}
            >
                {projectView && <caption className="administration-users-visually-hidden">{label}</caption>}
                <thead>
                    <tr>
                        <th>{projectView ? "Proyecto" : "Nombre"}</th>
                        <th>{projectView ? "Descripción" : "Detalle"}</th>
                        <th>{projectView ? "Integraciones" : "Referencias"}</th>
                        <th>Estado</th>
                        <th aria-label="Acciones" />
                    </tr>
                </thead>
            </DataTable>
        </div>
    );
}
