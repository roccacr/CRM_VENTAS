import { useEffect } from "react";
import $ from "jquery";
import "datatables.net-bs5";
import "datatables.net-select";
import "datatables.net-select-bs5";
import "datatables.net-buttons";
import "datatables.net-buttons-bs5";
import "datatables.net-buttons/js/buttons.html5";
import "datatables.net-buttons/js/buttons.print";

import "datatables.net-searchpanes-bs5";

export const useDataTable = (clientData, columns, onRowClick) => {
    useEffect(() => {
        const table = $("#single-select").DataTable({
            processing: true,
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
                columns: [0,1,2], // Especifica que solo la primera columna estará disponible en el filtro
            },
            dom: 'P<"clear">Bfrtip',
            buttons: [
                {
                    extend: "excel",
                    footer: true,
                    titleAttr: "Exportar a excel",
                    className: "btn btn-success",
                    exportOptions: {
                        columns: [0], // Especifica que solo la primera columna se exporta
                    },
                },
            ],
            data: clientData,
            columns: columns, // Asegúrate de pasar las columnas aquí
            columnDefs: [
                {
                    searchPanes: {
                        show: true,
                        initCollapsed: true,
                    },
                    targets: [0,1,2], // Especifica que solo la primera columna tendrá el filtro activo
                },
                {
                    targets: "_all",
                    searchable: true, // Deshabilita la búsqueda en todas las demás columnas
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
            const rowData = table.row(this).data();
            if (onRowClick) {
                onRowClick(rowData); // Llama a la función callback con los datos de la fila
            }
        });

        return () => {
            table.destroy();
        };
    }, [clientData, columns, onRowClick]);
};
