import React, { useEffect, useRef } from "react";
import $ from "jquery";
import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import "../../../FiltrosTabla/style.css";
import { TABLE_COLUMNS } from "./tableColumns";


/**
 * Datos de ejemplo para la tabla de leads.
 * Cada objeto representa un lead con sus propiedades básicas.
 * @typedef {Object} Lead
 * @property {string} nombre - Nombre completo del lead
 * @property {string} email - Dirección de correo electrónico
 * @property {string} telefono - Número de teléfono
 * @property {string} estado - Estado actual del lead (Pendiente, Contactado, Rechazado)
 *
 * @type {Array<Lead>}
 */
const MOCK_DATA = [
   {
      name_admin: "Admin Test",
      nombre_lead: "Juan Pérez",
      idinterno_lead: "NS123456",
      email_lead: "juan@ejemplo.com",
      telefono_lead: "123-456-7890",
      proyecto_lead: "Proyecto A",
      campana_lead: "Campaña 2024",
      segimineto_lead: "Estado-Seguimiento-Pendiente",
      creado_lead: "2024-03-20T10:30:00",
      subsidiaria_lead: "Subsidiaria 1",
      actualizadaaccion_lead: "2024-03-21T15:45:00",
      estado_lead: 1,
      nombre_caida: "Seguimiento 1"
   },
   {
      name_admin: "ASASAS Test",
      nombre_lead: "Juan Pérez",
      idinterno_lead: "NS123456",
      email_lead: "juan@ejemplo.com",
      telefono_lead: "123-456-7890",
      proyecto_lead: "Proyecto A",
      campana_lead: "Campaña 2024",
      segimineto_lead: "Estado-Seguimiento-Pendiente",
      creado_lead: "2024-03-20T10:30:00",
      subsidiaria_lead: "Subsidiaria 1",
      actualizadaaccion_lead: "2024-03-21T15:45:00",
      estado_lead: 1,
      nombre_caida: "Seguimiento 1"
   }
];



/**
 * Obtiene la configuración completa para inicializar DataTables.
 * @param {HTMLElement} tableElement - Referencia al elemento DOM de la tabla
 * @returns {Object} Configuración completa de DataTables con las siguientes propiedades:
 * @property {boolean} stateSave - Habilita el guardado del estado de la tabla
 * @property {string} dom - Configuración del layout de los controles
 * @property {Object} searchPanes - Configuración de los paneles de búsqueda
 * @property {Array<Lead>} data - Datos a mostrar en la tabla
 * @property {Array<ColumnConfig>} columns - Configuración de columnas
 * @property {Array<Object>} columnDefs - Definiciones adicionales de columnas
 * @property {Object} language - Configuración de idioma
 */
const getDataTableConfig = (tableElement) => ({
   stateSave: true,
   dom: "lPBfrtip",
   searchPanes: {
      layout: "columns-2",
      initCollapsed: false,
      viewTotal: true,
   },
   data: MOCK_DATA,
   columns: TABLE_COLUMNS,
   columnDefs: [
      {
         searchPanes: {
            show: true,
         },
         targets: [0, 1, 2, 3],
      },
   ],
   order: [[1, "asc"]],
   paging: true,
   pageLength: 10,
   lengthMenu: [
      [10, 25, 50, 200, -1],
      [10, 25, 50, 200, "All"],
   ],
   responsive: true,
   buttons: ["excel"],
   language: {
      url: "//cdn.datatables.net/plug-ins/1.13.7/i18n/es-ES.json",
   },
});

/**
 * Componente que representa la tabla de leads.
 * @param {Object} props - Propiedades del componente
 * @param {React.RefObject<HTMLTableElement>} props.tableRef - Referencia al elemento de tabla
 * @returns {JSX.Element} Tabla HTML con estructura básica
 */
const LeadsTable = ({ tableRef }) => (
   <div className="table-responsive">
      <div style={{ margin: "0", padding: "0.5rem" }}>
         <table ref={tableRef} className="table table-striped">
            <thead>
               <tr>
                  <th>ASESOR</th>
                  <th>Nombre Cliente</th>
                  <th># NETSUITE</th>
                  <th>Correo Cliente</th>
                  <th>Teléfono</th>
                  <th>Proyecto</th>
                  <th>Campaña</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Subsidiarias</th>
                  <th>Última Acción</th>
                  <th>Estado Lead</th>
                  <th>Seguimiento</th>
               </tr>
            </thead>
         </table>
      </div>
   </div>
);

/**
 * Hook personalizado para manejar el ciclo de vida de DataTables.
 * @param {React.RefObject<HTMLTableElement>} tableRef - Referencia al elemento de tabla
 * @param {React.MutableRefObject<DataTable|null>} tableInstanceRef - Referencia para almacenar la instancia de DataTables
 * @returns {void}
 */
const useDataTable = (tableRef, tableInstanceRef) => {
   useEffect(() => {
      /**
       * Inicializa DataTables con la configuración proporcionada.
       * @returns {DataTable} Instancia de DataTables creada
       */
      const initializeDataTable = () => {
         const table = $(tableRef.current).DataTable(getDataTableConfig(tableRef.current));
         tableInstanceRef.current = table;
         return table;
      };

      const tableInstance = initializeDataTable();

      return () => {
         /**
          * Limpia y destruye la instancia de DataTables al desmontar el componente.
          */
         if (tableInstance) {
            tableInstance.destroy();
         }
      };
   }, [tableRef, tableInstanceRef]);
};

/**
 * Componente principal que muestra la lista de leads que requieren atención.
 * Maneja la inicialización de la tabla y provee funcionalidad para limpiar su estado.
 * @returns {JSX.Element} Contenedor principal con la tabla y controles
 */
const View_list_leads_attention = () => {
   const tableRef = useRef(null);
   const tableInstanceRef = useRef(null);

   useDataTable(tableRef, tableInstanceRef);

   return (
      <div className="card" style={{ width: "100%" }}>
         <div className="card-header table-card-header">
            <h5>LISTA COMPLETA DE LEADS QUE REQUIEREN ATENCIÓN</h5>
         </div>
         <LeadsTable tableRef={tableRef} />
      </div>
   );
};

export default View_list_leads_attention;
