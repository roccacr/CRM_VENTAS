import moment from 'moment';

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
 * @param {Object} config - Configuración personalizada
 * @param {Array} config.data - Datos para la tabla
 * @param {Array} config.columns - Definición de columnas
 * @param {Array} config.searchableColumns - Índices de columnas para SearchPanes
 * @param {Array} config.customButtons - Botones personalizados adicionales
 * @returns {Object} Configuración completa de DataTables
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
export const getSpanishTranslations = () => ({
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