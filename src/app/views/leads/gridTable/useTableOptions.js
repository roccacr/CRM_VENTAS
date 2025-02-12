import { useMemo } from "react";

/**
 * Custom hook para generar las opciones de configuración de la tabla
 * @param {Array} content - Columnas a mostrar en los paneles de búsqueda
 * @returns {Object} Configuración de opciones para DataTables
 */
export const useTableOptions = (content, options = {}) => {
    return useMemo(() => ({
        
        dom: "PBflrtip",
        order: [[8, "asc"]],
        paging: true,
        pageLength: 10,
        lengthMenu: [
            [10, 25, 50, 200, -1],
            [10, 25, 50, 200, "All"],
        ],
        responsive: true,
        buttons: ["excel"],
        stateSave: true,
        processing: true,
        searchPanes: {
            show: true,
            initCollapsed: true,
            cascadePanes: true,
            controls: true,
            collapse: true,
            dtOpts: {
                select: {
                    style: "multi",
                },
                count: {
                    show: false,
                },
            },
            layout: "columns-3",
        },
        columnDefs: [
            { targets: content, searchPanes: { show: true } },
        ],
    }), [content]);
}; 