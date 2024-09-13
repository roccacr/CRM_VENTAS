import { useEffect, useRef } from "react";
import $ from "jquery";
import "datatables.net-bs5"; // Estilos para DataTables con Bootstrap 5.
import "datatables.net-select"; // Funcionalidad para seleccionar filas.
import "datatables.net-select-bs5"; // Estilos de selección con Bootstrap 5.
import "datatables.net-buttons"; // Funcionalidad para añadir botones (como exportar).
import "datatables.net-buttons-bs5"; // Estilos de botones con Bootstrap 5.
import "datatables.net-buttons/js/buttons.html5"; // Funcionalidad para exportar a HTML5 (ej. Excel).
import "datatables.net-buttons/js/buttons.print"; // Funcionalidad para imprimir desde la tabla.
import "datatables.net-searchpanes-bs5"; // Añade paneles de búsqueda con estilos de Bootstrap 5.

// Hook personalizado para inicializar y configurar la tabla DataTable.
export const useDataTable = (data, columnsConfig, onRowClick, searchColumns, dataExecel, disguise) => {
    // tableRef se utiliza para mantener una referencia a la instancia de DataTable, permitiendo el acceso a lo largo del ciclo de vida del componente.
    const tableRef = useRef(null);

    useEffect(() => {
        // Si ya existe una instancia de DataTable, la destruimos para evitar la creación de duplicados.
        if (tableRef.current) {
            tableRef.current.destroy(); // Destruir la instancia anterior.
            $("#tableDinamic").empty(); // Limpiar el DOM de la tabla anterior.
        }

        // Limpiar cualquier estado guardado en el almacenamiento local para evitar conflictos de configuración previa.
        localStorage.removeItem("DataTables_tableDinamic_/");

        // Solo crear una nueva instancia de DataTable si no existe.
        if (!tableRef.current) {
            // Inicializamos la tabla con DataTable, configurando las opciones necesarias.
            tableRef.current = $("#tableDinamic").DataTable({
                data: data, // Datos que se mostrarán en la tabla.
                columns: columnsConfig, // Configuración de las columnas.
                processing: true, // Mostrar indicador de carga mientras se procesan los datos.
                deferRender: true, // Renderización diferida para mejorar el rendimiento con grandes volúmenes de datos.
                responsive: true, // Hacer que la tabla sea adaptable a diferentes tamaños de pantalla.
                searchPanes: {
                    // Configuración para los paneles de búsqueda.
                    cascadePanes: true, // Los paneles de búsqueda filtran de forma jerárquica.
                    viewTotal: true, // Mostrar el número total de elementos por cada panel.
                    collapsed: true, // Los paneles estarán colapsados por defecto.
                    layout: "columns-3", // Los paneles se distribuyen en tres columnas.
                    dtOpts: {
                        // Opciones específicas de los paneles de búsqueda.
                        select: {
                            style: "multi", // Permitir selección múltiple en los paneles.
                        },
                        count: {
                            show: false, // No mostrar el conteo total.
                        },
                        order: [[0, "asc"]], // Ordenar las filas por la primera columna de forma ascendente.
                    },
                    columns: searchColumns, // Especificar las columnas que estarán disponibles para la búsqueda.
                },
                dom: 'P<"clear">Bfrtip', // Definir la estructura del DOM para la tabla (P: paneles, B: botones).
                headerCallback: function (thead) {
                    // Alinear los encabezados de la tabla a la izquierda.
                    $(thead).find("th").css("text-align", "left");
                },
                createdCell: function (td) {
                    // Alinear el contenido de las celdas de la tabla a la izquierda.
                    $(td).css("text-align", "left");
                },
                buttons: [
                    {
                        extend: "excel", // Botón para exportar los datos a Excel.
                        footer: true, // Incluir los datos del pie de página en la exportación.
                        titleAttr: "Exportar a Excel", // Tooltip que aparecerá al pasar el mouse sobre el botón.
                        className: "btn btn-success", // Clase de Bootstrap para el estilo del botón.
                        exportOptions: {
                            columns: dataExecel, // Especificar las columnas que se exportarán a Excel.
                        },
                    },
                ],
                columnDefs: [
                    {
                        searchPanes: {
                            show: true, // Mostrar paneles de búsqueda para estas columnas.
                            initCollapsed: true, // Colapsar paneles al iniciar.
                        },
                        targets: searchColumns, // Aplicar a las columnas especificadas para la búsqueda.
                    },
                    {
                        targets: "_all", // Aplicar a todas las columnas.
                        className: "dt-body-left", // Alinear el contenido de todas las celdas a la izquierda.
                    },
                    {
                        targets: "_all", // Permitir la búsqueda en todas las columnas.
                        searchable: true,
                    },
                ],
                stateSave: false, // No guardar el estado de la tabla (paginación, filtros, etc.) en el almacenamiento local.
                pageLength: 25, // Número de filas mostradas por página.
                lengthMenu: [
                    // Opciones para seleccionar cuántas filas mostrar por página.
                    [10, 25, 50, 200, -1],
                    [10, 25, 50, 200, "All"],
                ],
            });

            // Ocultar columnas específicas que no son necesarias mostrar al usuario.
            disguise.forEach((columnIndex) => {
                tableRef.current.column(columnIndex).visible(false);
            });

            // Manejar el clic en las filas para obtener los datos de la fila seleccionada.
            $("#tableDinamic tbody").on("click", "tr", function () {
                const rowData = tableRef.current.row(this).data(); // Obtener los datos de la fila clicada.
                if (onRowClick) {
                    onRowClick(rowData); // Ejecutar la función de callback pasada con los datos de la fila.
                }
            });
        } else {
            // Si la tabla ya existe, simplemente actualizamos los datos.
            tableRef.current.clear().rows.add(data).draw(); // Limpiar la tabla y añadir los nuevos datos.
        }

        // Cleanup: Destruir la instancia de DataTable cuando el componente se desmonte o se actualice.
        return () => {
            if (tableRef.current) {
                tableRef.current.destroy();
                tableRef.current = null;
            }
        };
    }, [data, columnsConfig, onRowClick, searchColumns, dataExecel, disguise]); // El hook se ejecutará cuando cambien los datos o las columnas de búsqueda.
};
