import React, { useEffect, useRef, useState } from "react";
import $ from "jquery";
import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import "../../../FiltrosTabla/style.css";
import { getDefaultDates } from "../../../FiltrosTabla/dataTableConfig";
import { useSelector } from "react-redux";
import { apiUrlImg, commonRequestData } from "../../../../../api";
import { TABLE_COLUMNS } from "./tableColumns";
import { ModalLeads } from "../../../../pages/modal/modalLeads";


const getDataTableConfig = (tableElement, searchInput, selectedOption) => {   

   console.log(searchInput, selectedOption);
   /** @type {boolean} Determina si el dispositivo es móvil basado en el ancho de la ventana */
   const isMobile = window.innerWidth <= 768;
   return {
      ajax: {
         url: `${apiUrlImg}buscador/getAll`,
         type: "POST",
         data: function (d) {
            return {
               ...commonRequestData,
               searchs: searchInput,
               selectedOption: selectedOption,
               start: d.start,
               length: d.length,
               search: d.searchPanes || undefined, // Evita undefined en la petición
            };
         },
         dataSrc: (response) => response["0"] || [],
      },
      columns: TABLE_COLUMNS,
      searchPanes: {
         layout: isMobile ? "columns-1" : "columns-2",
         initCollapsed: true,
         cascadePanes: true,
         dtOpts: {
            select: { style: "multi" },
            info: false,
            searching: true,
         },
         viewTotal: true,
         columns: [0, 1, 3, 4, 5, 6, 11],
      },
      processing: true,
      dom: "lPBfrtip",
      buttons: [
         {
            extend: "excel",
            text: "Exportar a Excel",
            className: "btn btn-primary",
         },
      ],
      language: {
         searchPanes: {
            title: "Filtros",
            collapse: "Filtros",
            clearMessage: "Limpiar Todo",
            emptyPanes: "No hay datos para filtrar",
            count: "{total}",
            countFiltered: "{shown} ({total})",
            loadMessage: "Cargando paneles de búsqueda...",
         },
      },
      stateSave: true,
      stateDuration: -1, // Mantiene el estado durante la sesión
      stateSaveCallback: function (settings, data) {
         localStorage.setItem("DataTables_state", JSON.stringify(data));
      },
      stateLoadCallback: function () {
         return JSON.parse(localStorage.getItem("DataTables_state")) || null;
      },
      select: {
         style: 'single',    // 'single' para selección única, 'multi' para múltiple
         className: 'selected-row'  // clase CSS que se aplicará a la fila seleccionada
      },
   };
};

/**
 * Componente que renderiza la tabla de leads.
 * @param {Object} props - Propiedades del componente
 * @param {React.RefObject<HTMLTableElement>} props.tableRef - Referencia al elemento de tabla
 * @returns {JSX.Element} Tabla HTML con estructura básica
 */
const LeadsTable = ({ tableRef }) => (
   <div className="table-responsive">
      <style>
         {`
            .selected-row {
               background-color:rgb(20, 20, 20) !important;
               color: white !important;
            }
            .selected-row td {
               color: white !important;
            }
         `}
      </style>
      <table ref={tableRef} className="table table-striped table-bordered">
         <thead></thead>
      </table>
   </div>
);


const useDataTable = (
   tableRef,
   tableInstanceRef,
   searchInput,
   selectedOption,
   setSelectedLead,
   setShowModal,
) => {
   useEffect(() => {
      if (!tableRef.current) return;
      if (tableInstanceRef.current) {
         tableInstanceRef.current.destroy();
         tableInstanceRef.current = null;
      }

      tableInstanceRef.current = $(tableRef.current).DataTable(
         getDataTableConfig(tableRef.current, searchInput, selectedOption),
      );

      // Modificar el manejador del clic
      $(tableRef.current).on("click", "tbody tr", function () {
         const data = tableInstanceRef.current.row(this).data();
         if (data) {
            setSelectedLead(data); // Guardar todos los datos en selectedLead
            setShowModal(true); // Abrir el modal
         }
      });

      return () => {
         if (tableInstanceRef.current) {
            $(tableRef.current).off("click", "tbody tr");
            tableInstanceRef.current.destroy();
            tableInstanceRef.current = null;
         }
      };
   }, [tableRef, searchInput, selectedOption, setSelectedLead, setShowModal]);
};

/**
 * Componente principal que gestiona la vista de leads que requieren atención.
 * Incluye funcionalidades de:
 * - Visualización de datos en tabla
 * - Filtrado por fechas
 * - Modal para detalles de leads
 * - Integración con DataTables
 *
 * @returns {JSX.Element} Contenedor principal con la tabla y modal
 */
const View_buscador = () => {
   /** @type {React.RefObject<HTMLTableElement>} Referencia a la tabla */
   const tableRef = useRef(null);

   /** @type {React.MutableRefObject<DataTable|null>} Referencia a la instancia de DataTables */
   const tableInstanceRef = useRef(null);

   const [searchInput, setSearchInput] = useState('Roberto');
   const [selectedOption, setSelectedOption] = useState('leads');
   const [showModal, setShowModal] = useState(false);
   const [selectedLead, setSelectedLead] = useState(null);


   /**
    * Cierra el modal y limpia el lead seleccionado
    */
   const handleCloseModal = () => {
      setShowModal(false);
      setSelectedLead(null);
   };

   useDataTable(
      tableRef,
      tableInstanceRef,
      searchInput,
      selectedOption,
      setSelectedLead,
      setShowModal,
   );

   return (
      <div className="card" style={{ width: "100%" }}>
         <div className="card-header table-card-header">
            <div role="alert" className="fade alert alert-success show">
               usted esta en la vista de leads nuevos
            </div>
         </div>
         <div className="table-border-style card-body">
            <div className="table-responsive">
               <LeadsTable tableRef={tableRef} />
               {showModal && selectedLead && <ModalLeads leadData={selectedLead} onClose={handleCloseModal} />}
            </div>
         </div>
      </div>
   );
};

export default View_buscador;
