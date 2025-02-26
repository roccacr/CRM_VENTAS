import moment from 'moment';
import jQuery from "jquery";
import DataTable from "datatables.net-react";

// DataTables imports
import "datatables.net-bs5";
import "datatables.net-select-bs5";
import "datatables.net-responsive-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-buttons-bs5";
import "datatables.net-buttons/js/buttons.html5.mjs";
import "datatables.net-buttons/js/buttons.print.mjs";
import "jszip";
import "pdfmake";

/**
 * @typedef {Object} Lead
 * @property {number} id - Identificador único del lead
 * @property {string} nombre - Nombre completo del lead
 * @property {string} email - Correo electrónico del lead
 * @property {string} telefono - Número de teléfono del lead
 * @property {string} estado - Estado actual del lead
 * @property {string} fecha - Fecha de registro del lead
 */

export const COLUMN_DEFINITIONS = [
   { data: "id", title: "ID" },
   { data: "nombre", title: "Nombre" },
   { data: "email", title: "Email" },
   { data: "telefono", title: "Teléfono" },
   { data: "estado", title: "Estado" },
   { data: "fecha", title: "Fecha" },
];

/**
 * Configuración base de los botones de exportación
 */
export const getExportButtons = () => [
   {
      extend: 'excel',
      text: 'Descargar Excel',
      className: 'btn btn-success',
      exportOptions: {
         columns: ':visible'
      }
   },
];

/**
 * Configuración base de los paneles de búsqueda
 */
export const SEARCH_PANES_CONFIG = {
   show: true,
   initCollapsed: true,
   cascadePanes: true,
   controls: true,
   collapse: true,
   persist: true,
   dtOpts: {
      select: { style: "multi" },
      count: { show: false },
      stateSave: true,
   },
   layout: "columns-2",
};

/**
 * Obtiene la configuración de las definiciones de columnas para SearchPanes
 * @param {number[]} searchableColumns - Índices de las columnas que tendrán panel de búsqueda
 * @returns {Object[]} Configuración de columnDefs
 */
export const getColumnDefinitions = (searchableColumns = []) => {
   return searchableColumns.map(target => ({
      targets: [target],
      searchPanes: {
         show: true,
         viewTotal: true,
      },
   }));
};

/**
 * Inicializa la configuración de DataTables
 */
export const initializeDataTableConfig = ({
   data,
   columns,
   searchableColumns = [],
   customButtons = []
}) => ({
   stateSave: true,
   data,
   dom: 'lPBfrtip',
   columns,
   searchPanes: SEARCH_PANES_CONFIG,
   columnDefs: getColumnDefinitions(searchableColumns),
   buttons: [...getExportButtons(), ...customButtons],
   language: getSpanishTranslations(),
   responsive: true,
});

/**
 * Traducciones al español para DataTables
 */
const getSpanishTranslations = () => ({
   sProcessing: "Procesando...",
   sLengthMenu: "Mostrar _MENU_ registros",
   sZeroRecords: "No se encontraron resultados",
   sEmptyTable: "Ningún dato disponible en esta tabla",
   sInfo: "Mostrando registros del _START_ al _END_ de un total de _TOTAL_ registros",
   sInfoEmpty: "Mostrando registros del 0 al 0 de un total de 0 registros",
   sInfoFiltered: "(filtrado de un total de _MAX_ registros)",
   sInfoPostFix: "",
   sSearch: "Buscar:",
   sUrl: "",
   sInfoThousands: ",",
   sLoadingRecords: "Cargando...",
   oPaginate: {
      sFirst: "Primero",
      sLast: "Último",
      sNext: "Siguiente",
      sPrevious: "Anterior",
   },
   oAria: {
      sSortAscending: ": Activar para ordenar la columna de manera ascendente",
      sSortDescending: ": Activar para ordenar la columna de manera descendente",
   },
   buttons: {
      copy: "Copiar",
      colvis: "Visibilidad",
      collection: "Colección",
      colvisRestore: "Restaurar visibilidad",
      copyKeys: "Presione ctrl o u2318 + C para copiar los datos de la tabla al portapapeles del sistema. <br /> <br /> Para cancelar, haga clic en este mensaje o presione escape.",
      copySuccess: {
         1: "Copiada 1 fila al portapapeles",
         _: "Copiadas %ds fila al portapapeles",
      },
      copyTitle: "Copiar al portapapeles",
      csv: "CSV",
      excel: "Excel",
      pageLength: {
         "-1": "Mostrar todas las filas",
         _: "Mostrar %d filas",
      },
      pdf: "PDF",
      print: "Imprimir",
      renameState: "Cambiar nombre",
      updateState: "Actualizar",
      createState: "Crear Estado",
      removeAllStates: "Remover Estados",
      removeState: "Remover",
      savedStates: "Estados Guardados",
      stateRestore: "Estado %d",
   },
   searchPanes: {
      title: "Filtros",
      collapse: "Filtros",
      clearMessage: "Limpiar Filtros",
      showMessage: "Mostrar Filtros",
      collapseMessage: "Colapsar Filtros",
      emptyPanes: "No hay datos para filtrar",
      loadMessage: "Cargando Filtros...",
      count: "{total}",
      countFiltered: "{shown} ({total})",
      emptyMessage: "No hay datos disponibles",
   },
});

/**
 * Helper function to get default date range (first and last day of the current month).
 * @returns {Object} An object containing firstDay and lastDay in YYYY-MM-DD format.
 */
export const getDefaultDates = () => {
   const now = new Date();
   const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
   const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
   return { firstDay, lastDay };
};



// Exportamos jQuery y DataTable para que estén disponibles
export { jQuery, DataTable };