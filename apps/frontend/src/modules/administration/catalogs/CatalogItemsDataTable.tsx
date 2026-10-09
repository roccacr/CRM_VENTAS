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
import DataTable, { type DataTableProps } from "datatables.net-react";
import { useEffect, useMemo, useRef } from "react";

import type { CatalogItem, CatalogItemStatus } from "../../../services/catalogs/catalog-service";
import { readDataTableState, useDataTableSearchPanes, writeDataTableState } from "../hooks/useDataTableSearchPanes";

const registerDataTable = DataTable.use;
registerDataTable(DT);
const FIELDS = [{ columnIndex: 0 }, { columnIndex: 2 }, { columnIndex: 3 }];
const DISABLED_FIELDS = [1, 4];
const STATUS_LABELS = { active: "Activo", inactive: "Inactivo" };
const COLUMNS = [{ data: "name" }, { data: "detail", defaultContent: "Sin asignar" }, { data: "externalReferences" }, { data: "status" }, { data: null, orderable: false, searchable: false, defaultContent: "" }];
const paneText = (type: string, value: string): string => (type === "pane" ? DT.util.escapeHtml(value) : value);

interface CatalogItemsDataTableProps {
    readonly items: readonly CatalogItem[];
    readonly label: string;
    readonly isLoading: boolean;
    readonly storageKey: string;
    readonly selectedPublicId: string | null;
    readonly onSelect: (item: CatalogItem) => void;
    readonly onEdit: (item: CatalogItem) => void;
    readonly onStatusAction: (item: CatalogItem, status: CatalogItemStatus) => void;
}

/** Uses the users table's SearchPanes, layout and persistence without sharing catalog state. */
export function CatalogItemsDataTable({ items, label, isLoading, storageKey, selectedPublicId, onSelect, onEdit, onStatusAction }: CatalogItemsDataTableProps) {
    const data = useMemo(() => [...items], [items]);
    const container = useRef<HTMLDivElement>(null);
    const selected = useRef(selectedPublicId);
    const panes = useDataTableSearchPanes({ fields: FIELDS, disabledColumnIndexes: DISABLED_FIELDS });
    const options = useMemo<NonNullable<DataTableProps["options"]>>(
        () =>
            ({
                autoWidth: false,
                // Pane labels need escaped text, not the DOM nodes returned by React display slots.
                columnDefs: import.meta.env.MODE === "test" ? [] : [{ targets: [0, 2, 3], searchPanes: { show: true, orthogonal: { display: "pane", search: "filter", sort: "filter", type: "filter" } } }, ...(panes.columnDefs ?? [])],
                layout: import.meta.env.MODE === "test" ? { top1Start: "search", topStart: null, topEnd: null, bottomStart: "info", bottomEnd: ["pageLength", "paging"] } : panes.layout,
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
        [label, panes, storageKey],
    );

    const syncRows = (): void => {
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
            <DataTable
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
                                <small>{item.nativeCode}</small>
                            </div>
                        ) : (
                            paneText(type, `${item.name}${type === "filter" ? ` ${item.nativeCode}` : ""}`)
                        ),
                    1: (_value: unknown, type: string, item: CatalogItem) => (type === "display" ? <span>{item.detail || "Sin asignar"}</span> : item.detail || "Sin asignar"),
                    2: (_value: unknown, type: string, item: CatalogItem) =>
                        type === "display" ? (
                            <div className="catalog-items-reference-list">
                                {item.externalReferences.length
                                    ? item.externalReferences.map((reference) => (
                                          <Tag key={`${reference.systemCode}:${reference.externalId}`}>
                                              {reference.systemName}: {reference.externalId}
                                          </Tag>
                                      ))
                                    : "Sin asignar"}
                            </div>
                        ) : (
                            paneText(type, item.externalReferences.map((reference) => `${reference.systemName}: ${reference.externalId}`).join(", ") || "Sin asignar")
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
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Detalle</th>
                        <th>Referencias</th>
                        <th>Estado</th>
                        <th aria-label="Acciones" />
                    </tr>
                </thead>
            </DataTable>
        </div>
    );
}
