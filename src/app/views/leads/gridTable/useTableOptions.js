import { useMemo } from "react";

/**
 * Custom hook para generar las opciones de configuración de la tabla
 * @param {Array} content - Columnas a mostrar en los paneles de búsqueda
 * @returns {Object} Configuración de opciones para DataTables
 */
export const useTableOptions = (content, options = {}) => {
    const isMobile = window.innerWidth <= 768; // Ajusta el valor según tus necesidades

    return useMemo(() => ({
        stateSave: true,
        dom: "PBfrtip",
        order: [[8, "asc"]],
        paging: true,
        pageLength: 10,
        lengthMenu: [
            [10, 25, 50, 200, -1],
            [10, 25, 50, 200, "All"],
        ],
        responsive: true,
        buttons: ["excel"],
       
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
            layout: isMobile ? "columns-1" : "columns-2",
        },
        columnDefs: [
            { targets: content, searchPanes: { show: true } },
        ],
    }), [content, isMobile]);
}; 