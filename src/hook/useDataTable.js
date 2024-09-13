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

// Hook personalizado para inicializar y configurar la tabla DataTable.
export const useDataTable = (data, columnsConfig, onRowClick, searchColumns, dataExecel, disguise) => {
    const tableRef = useRef(null);

    useEffect(() => {
        // Si ya existe una instancia de DataTable, la destruimos y limpiamos el contenido.
        if (tableRef.current) {
            tableRef.current.destroy(); // Destruir la instancia de DataTable.
            $("#tableDinamic").empty(); // Limpiar el DOM de la tabla anterior.
        }

        // Limpiar cualquier estado guardado en el almacenamiento local para evitar conflictos de configuración previa.
        localStorage.removeItem("DataTables_tableDinamic_/");

        // Crear una nueva instancia de DataTable.
        tableRef.current = $("#tableDinamic").DataTable({
            data: data,
            columns: columnsConfig,
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
                columns: searchColumns,
            },
            dom: 'P<"clear">Bfrtip',
            headerCallback: function (thead) {
                $(thead).find("th").css("text-align", "left");
            },
            createdCell: function (td) {
                $(td).css("text-align", "left");
            },
            buttons: [
                {
                    extend: "excel",
                    footer: true,
                    titleAttr: "Exportar a Excel",
                    className: "btn btn-success",
                    exportOptions: {
                        columns: dataExecel,
                    },
                },
            ],
            columnDefs: [
                {
                    searchPanes: {
                        show: true,
                        initCollapsed: true,
                    },
                    targets: searchColumns,
                },
                {
                    targets: "_all",
                    className: "dt-body-left",
                },
                {
                    targets: "_all",
                    searchable: true,
                },
            ],
            stateSave: false,
            pageLength: 25,
            lengthMenu: [
                [10, 25, 50, 200, -1],
                [10, 25, 50, 200, "All"],
            ],
        });

        // Ocultar columnas específicas.
        disguise.forEach((columnIndex) => {
            tableRef.current.column(columnIndex).visible(false);
        });

        // Manejar el clic en las filas.
        $("#tableDinamic tbody").on("click", "tr", function () {
            const rowData = tableRef.current.row(this).data();
            if (onRowClick) {
                onRowClick(rowData);
            }
        });

        // Cleanup: Destruir la instancia de DataTable cuando el componente se desmonte o se actualice.
        return () => {
            if (tableRef.current) {
                tableRef.current.destroy();
                tableRef.current = null;
            }
        };
    }, [data, columnsConfig, onRowClick, searchColumns, dataExecel, disguise]);
};
