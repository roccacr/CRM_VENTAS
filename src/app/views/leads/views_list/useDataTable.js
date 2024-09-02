import { useEffect } from "react";
import $ from "jquery";
import "datatables.net-bs4";
import "datatables.net-select";
import "datatables.net-select-bs4";
import "datatables.net-buttons";
import "datatables.net-buttons-bs4";
import "datatables.net-buttons/js/buttons.html5";
import "datatables.net-buttons/js/buttons.print";
import "datatables.net-searchpanes";
import "datatables.net-searchpanes-bs4";

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
                    order: [[0, "asc"]],
                },
                viewTotal: true,
                collapsed: true,
            },
            dom: 'P<"clear">Bfrtip',
            buttons: [
                {
                    extend: "excel",
                    footer: true,
                    titleAttr: "Exportar a excel",
                    className: "btn btn-success",
                    exportOptions: {
                        columns: [0], // Aquí defines qué columnas se exportan
                    },
                },
            ],
            data: clientData,
            columns: columns,
            columnDefs: [
                {
                    searchPanes: {
                        show: true,
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
            console.log(rowData);
            if (onRowClick) {
                onRowClick(rowData); // Llama a la función callback con los datos de la fila
            }
        });

        return () => {
            table.destroy(); // Destruir la tabla cuando el componente se desmonte
        };
    }, [clientData, columns, onRowClick]);
};
