import { useEffect } from "react";
import $ from "jquery";
import "datatables.net-bs4";
import "datatables.net-select";
import "datatables.net-select-bs5";
import "datatables.net-buttons";
import "datatables.net-buttons-bs5";
import "datatables.net-buttons/js/buttons.html5";
import "datatables.net-buttons/js/buttons.print";
import "datatables.net-searchpanes";
import "datatables.net-searchpanes-bs5";

export const useDataTable = (clientData, columns, onRowClick) => {
    useEffect(() => {
        const table = $("#single-select").DataTable({
            processing: true,
            searchPanes: {
                cascadePanes: true,
                dtOpts: {
                    select: {
                        style: "multi",
                    },
                    count: {
                        show: false,
                    },
                    order: [[0, "asc"]],
                },
                viewTotal: true,
                collapsed: true,
                layout: "columns-3",
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
            data: clientData,
            columns: columns,
            columnDefs: [
                {
                    searchPanes: {
                        show: true,
                        initCollapsed: true,
                    },
                    targets: [0, 1, 2],
                },
            ],
            stateSave: true,
            pageLength: 25,
            lengthMenu: [
                [10, 25, 50, 200, -1],
                [10, 25, 50, 200, "All"],
            ],
            language: {
                decimal: ",",
                thousands: ".",
                lengthMenu: "Mostrar _MENU_ registros",
                zeroRecords: "No se encontraron resultados",
                info: "Mostrando registros del _START_ al _END_ de un total de _TOTAL_ registros",
                infoEmpty: "Mostrando registros del 0 al 0 de un total de 0 registros",
                infoFiltered: "(filtrado de un total de _MAX_ registros)",
                sSearch: "Buscar:",
                oPaginate: {
                    sFirst: "Primero",
                    sLast: "Último",
                    sNext: "Siguiente",
                    sPrevious: "Anterior",
                },
                sProcessing: "Cargando...",
            },
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
