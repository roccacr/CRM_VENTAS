import "datatables.net-dt/css/dataTables.dataTables.css";
import "datatables.net-select-dt/css/select.dataTables.css";
import "datatables.net-searchpanes-dt/css/searchPanes.dataTables.css";
import "datatables.net-searchpanes-dt";
import "datatables.net-select-dt";
import "../pages/SystemUsersPage.css";

import DT, { type Api } from "datatables.net-dt";
import DataTable, { type DataTableProps, type DataTableRef } from "datatables.net-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useDataTableSearchPanes } from "../hooks/useDataTableSearchPanes";
import type { UnitSummary } from "./unit-files.api";
import { createUnitPaneAjax, type UnitPaneChoices, type UnitPaneSelection } from "./unit-files-search-panes";

// DataTables registers its renderer here; this static API is not a React Hook.
// eslint-disable-next-line react-hooks/rules-of-hooks
DataTable.use(DT);
const labels = ["", "Código", "Proyecto", "Tipo de vivienda", "Precio de venta", "Estado", "Entrega estimada", "Área total (m²)", "Lote (m²)", "Área de parqueo (m²)"];
const keys = [null, "code", "project.name", "housingType", "advertisedSalePrice", "sourceStatus", "estimatedDelivery", "totalArea", "lotArea", "approximateParkingArea"];
const columns = keys.map((data, index) => ({ data, title: labels[index] ?? "", defaultContent: "—", orderable: index !== 0, ...(index > 1 ? { render: (value: string | null, type: string) => (type === "display" || type === "pane" ? DT.util.escapeHtml(value || "—") : (value ?? "")) } : {}) }));
const FIELDS = [{ columnIndex: 1 }, { columnIndex: 2 }, { columnIndex: 3 }, { columnIndex: 5 }];
const DISABLED_FIELDS = [0, 4, 6, 7, 8, 9];

/** Server-owned filters apply before cursor paging; DataTables renders only the returned batch. */
export function UnitFilesDataTable({
    items,
    selected,
    onToggle,
    onOpen,
    selectionBar,
    choices,
    busy,
    onFilterChange,
}: {
    readonly items: UnitSummary[];
    readonly selected: UnitSummary[];
    readonly onToggle: (item: UnitSummary, checked: boolean) => void;
    readonly onOpen: (id: string) => void;
    readonly selectionBar?: ReactNode;
    readonly choices: UnitPaneChoices;
    readonly busy: boolean;
    readonly onFilterChange: (selection: UnitPaneSelection) => Promise<{ items: UnitSummary[]; choices: UnitPaneChoices | undefined } | undefined> | undefined;
}) {
    const table = useRef<DataTableRef>(null);
    const panes = useDataTableSearchPanes({ fields: FIELDS, disabledColumnIndexes: DISABLED_FIELDS, panesPerRow: 2 });
    const callbacks = useRef({ busy, onFilterChange, items, choices });
    const drawnItems = useRef(items);
    useEffect(() => {
        callbacks.current = { busy, onFilterChange, items, choices };
    }, [busy, onFilterChange, items, choices]);
    useEffect(() => {
        if (import.meta.env.MODE !== "test" && drawnItems.current !== items) {
            drawnItems.current = items;
            table.current?.dt()?.ajax.reload(undefined, false);
        }
    }, [items, choices]);
    useEffect(() => {
        if (!busy) return;
        const root = table.current?.dt()?.table().container();
        const controls = Array.from(root?.querySelectorAll<HTMLInputElement | HTMLButtonElement>(".dtsp-panesContainer button, .dtsp-panesContainer input") ?? []);
        const disabled = controls.map((control) => control.disabled);
        controls.forEach((control) => {
            control.disabled = true;
        });
        return () => {
            controls.forEach((control, index) => {
                control.disabled = disabled[index] ?? false;
            });
        };
    }, [busy]);
    // DataTables retains this DOM node: state keeps its identity stable even across hot reloads.
    const [filterHost] = useState(() => {
        const host = document.createElement("div");
        host.className = "unit-files-filter-host";
        return host;
    });
    const selection = useRef(selected);
    useEffect(() => {
        selection.current = selected;
        table.current
            ?.dt()
            ?.rows()
            .nodes()
            .toArray()
            .forEach((row) => {
                row.querySelectorAll<HTMLInputElement>("input[data-unit-id]").forEach((input) => {
                    input.checked = selected.some((item) => item.id === input.dataset.unitId);
                    input.disabled = selected.length >= 8 && !input.checked;
                });
            });
    }, [selected]);
    // The adapter stores these callbacks for DataTables events; it never invokes them during render.

    const options: NonNullable<DataTableProps["options"]> = {
        autoWidth: false,
        paging: false,
        serverSide: import.meta.env.MODE !== "test",
        ajax:
            import.meta.env.MODE === "test"
                ? null
                : createUnitPaneAjax(
                      () => callbacks.current,
                      (rows) => {
                          drawnItems.current = rows;
                      },
                  ),
        order: [[1, "asc"]],
        columnDefs: import.meta.env.MODE === "test" ? [] : [...(panes.columnDefs ?? [])],
        layout: {
            topStart: null,
            topEnd: null,
            top: {
                features: [
                    ...(import.meta.env.MODE === "test"
                        ? []
                        : [
                              {
                                  searchPanes: {
                                      columns: FIELDS.map((field) => field.columnIndex),
                                      cascadePanes: true,
                                      initCollapsed: true,
                                      layout: "columns-2",
                                      viewTotal: true,
                                      orderable: false,
                                      dtOpts: {
                                          initComplete(this: { api: () => Api }) {
                                              this.api().on("user-select.unitFiles", (event: { preventDefault: () => void }) => {
                                                  if (callbacks.current.busy) event.preventDefault();
                                              });
                                          },
                                      },
                                  },
                              },
                          ]),
                    () => filterHost,
                ],
                rowClass: "dt-layout-row projects-view-toolbar",
            },
            bottomStart: null,
            bottomEnd: null,
        },
        language: {
            search: "Buscar",
            searchPlaceholder: "Buscar en expedientes",
            emptyTable: "Sin resultados",
            zeroRecords: "Sin resultados",
            aria: { orderable: ": activar para ordenar", orderableRemove: ": activar para quitar el orden", orderableReverse: ": activar para invertir el orden" },
            searchPanes: { title: { 0: "", _: "Filtros activos: %d" }, buttons: { clearPane: "Limpiar selección", clearSearch: "Limpiar búsqueda", collapse: "Mostrar u ocultar filtro", orderByCount: "Ordenar por cantidad", orderByLabel: "Ordenar por nombre" }, emptyMessage: "Sin asignar", clearMessage: "Limpiar", collapseMessage: "Contraer", showMessage: "Expandir", count: "{total}", countFiltered: "{shown} / {total}", emptyPanes: "Sin filtros disponibles" },
        },
        createdRow: (row) => {
            Array.from(row.cells).forEach((cell, index) => {
                cell.dataset.label = labels[index];
            });
        },
    };

    return (
        <div className="unit-files-datatable" data-filter-engine="searchpanes">
            {createPortal(selectionBar, filterHost)}
            <div className="administration-users-datatable-wrap">
                <DataTable
                    ref={table}
                    {...(import.meta.env.MODE === "test" ? { data: items } : {})}
                    columns={columns}
                    options={options}
                    className="administration-users-datatable unit-files-main-table"
                    slots={{
                        0: (_value: unknown, type: string, row: UnitSummary) => {
                            if (type !== "display") return "";
                            // DataTables owns these nodes; update selection without replacing React roots.
                            const input = document.createElement("input");
                            input.type = "checkbox";
                            input.dataset.unitId = row.id;
                            input.setAttribute("aria-label", `Comparar ${row.code || "Sin asignar"}`);
                            input.checked = selection.current.some((item) => item.id === row.id);
                            input.disabled = selection.current.length >= 8 && !input.checked;
                            input.onchange = () => {
                                onToggle(row, input.checked);
                            };
                            return input;
                        },
                        1: (value: string | null, type: string, row: UnitSummary) =>
                            type === "display" ? (
                                <button
                                    className="unit-files-link"
                                    onClick={() => {
                                        onOpen(row.id);
                                    }}
                                >
                                    {value || "Sin asignar"}
                                </button>
                            ) : type === "pane" ? (
                                DT.util.escapeHtml(value || "Sin asignar")
                            ) : (
                                value || ""
                            ),
                    }}
                />
            </div>
        </div>
    );
}
