import { useEffect, useRef } from "react";
import $ from "jquery";
import "datatables.net-bs5";
import "datatables.net-select";
import "datatables.net-select-bs5";
import "datatables.net-buttons";
import "datatables.net-buttons-bs5";
import "datatables.net-buttons/js/buttons.html5";
import "datatables.net-buttons/js/buttons.print";
import "datatables.net-searchpanes-bs5";

export const useDataTable = (data, columns, onRowClick) => {
    const tableRef = useRef(null);

    useEffect(() => {
        if (!tableRef.current) {
            tableRef.current = $("#single-select").DataTable({
                data: data,
                columns: columns,
                processing: true,
                deferRender: true,
                responsive: true,
                searchPanes: {
                    cascadePanes: true,
                    viewTotal: true,
                    collapsed: true,
                    layout: "columns-3",
                    dtOpts: {
                        select: {
                            style: "multi",
                        },
                        count: {
                            show: false,
                        },
                        order: [[0, "asc"]],
                    },
                    columns: [0],
                },
                dom: 'P<"clear">Bfrtip',
                buttons: [
                    {
                        extend: "excel",
                        footer: true,
                        titleAttr: "Exportar a excel",
                        className: "btn btn-success",
                        exportOptions: {
                            columns: [0],
                        },
                    },
                ],
                columnDefs: [
                    {
                        searchPanes: {
                            show: true,
                            initCollapsed: true,
                        },
                        targets: [0],
                    },
                    {
                        targets: "_all",
                        searchable: true,
                    },
                ],
                stateSave: true,
                pageLength: 25,
                lengthMenu: [
                    [10, 25, 50, 200, -1],
                    [10, 25, 50, 200, "All"],
                ],
            });

            $("#single-select tbody").on("click", "tr", function () {
                const rowData = tableRef.current.row(this).data();
                if (onRowClick) {
                    onRowClick(rowData);
                }
            });
        } else {
            // Si la tabla ya existe, actualizamos los datos
            tableRef.current.clear().rows.add(data).draw();
        }

        return () => {
            if (tableRef.current) {
                tableRef.current.destroy();
                tableRef.current = null;
            }
        };
    }, [data, columns, onRowClick]);
};