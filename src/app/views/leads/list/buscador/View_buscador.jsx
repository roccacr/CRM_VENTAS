import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import $ from "jquery";
import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import "../../../FiltrosTabla/style.css";
import { apiUrlImg, commonRequestData } from "../../../../../api";
import { TABLE_LEADS_BUSCADOR, 
   TABLE_OPORTUNIDADES_BUSCADOR, 
   TABLE_EVENTOS_BUSCADOR, 
   TABLE_ESTIMACIONES_BUSCADOR, 
   TABLE_ORDEN_VENTA_BUSCADOR,
   TABLE_CORREDORES_BUSCADOR,
   TABLE_PROYECTOS_BUSCADOR,
   TABLE_SUBSIDIARIA_BUSCADOR,
   TABLE_UBICACIONES_BUSCADOR,
   TABLE_CAMPANAS_BUSCADOR
} from "./tableColumns";
import { ModalLeads } from "../../../../pages/modal/modalLeads";
import { useSelector } from "react-redux";

// Función para obtener las columnas según la opción
const getColumnsForOption = (option) => {
   switch (option) {
      case "oportunidad":
         return TABLE_OPORTUNIDADES_BUSCADOR;
      case "evento":
         return TABLE_EVENTOS_BUSCADOR;
      case "leads":
      default:
         return TABLE_LEADS_BUSCADOR;
      case "estimaciones":
         return TABLE_ESTIMACIONES_BUSCADOR;
      case "ordenVenta":
         return TABLE_ORDEN_VENTA_BUSCADOR;
      case "leads":
         return TABLE_LEADS_BUSCADOR;
      case "corredores":
         return TABLE_CORREDORES_BUSCADOR;
      case "proyecto":
         return TABLE_PROYECTOS_BUSCADOR;
      case "subsidiaria":  
         return TABLE_SUBSIDIARIA_BUSCADOR;  
      case "ubicaciones":
         return TABLE_UBICACIONES_BUSCADOR;
      case "campana":   
         return TABLE_CAMPANAS_BUSCADOR;
   }
};

const getDataTableConfig = (tableElement, searchInput, selectedOption, idnetsuite_admin, rol_admin) => {
   /** @type {boolean} Determina si el dispositivo es móvil basado en el ancho de la ventana */
   const isMobile = window.innerWidth <= 768;
   const columns = getColumnsForOption(selectedOption);

   const options = {
      leads: [0, 1, 2, 3, 4],
      oportunidad: [0, 1, 2],
      estimaciones: [0, 1, 2],
      ordenVenta: [0, 1, 2],
      evento: [0, 1, 2, 3, 4, 5],
      corredores: [0,1,2],
      proyecto: [0, 1,2],
      subsidiaria: [0,1,2],
      ubicaciones: [0, 1, 2],
      campana: [0, 1, 2],
   };

   // Si searchInput está vacío, retornamos configuración con data vacía
   if (!searchInput.trim()) {
      return {
         data: [],
         columns: columns,
         searchPanes: {
            layout: isMobile ? "columns-1" : "columns-2",
            initCollapsed: true,
         },
         processing: true,
         dom: "lPfrtip",
         language: {
            emptyTable: "Ingrese un término de búsqueda",
            searchPanes: {
               title: "Filtros",
               collapse: "Filtros",
               clearMessage: "Limpiar Todo",
               emptyPanes: "No hay datos para filtrar",
            },
         },
      };
   }

   // Si hay término de búsqueda, retornamos configuración normal con AJAX
   return {
      ajax: {
         url: `${apiUrlImg}buscador/getAll`,
         type: "POST",
         data: function (d) {
            return {
               ...commonRequestData,
               searchs: searchInput,
               selectedOption: selectedOption,
               idnetsuite_admin: idnetsuite_admin,
               rol_admin: rol_admin,
               start: d.start,
               length: d.length,
               search: d.searchPanes || undefined,
            };
         },
         dataSrc: (response) => {
            return response.data || [];
         },
      },
      columns: columns,
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
         columns: options[selectedOption],
      },
      processing: true,
      dom: "lPfrtip",
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
      stateDuration: -1,
      stateSaveCallback: function (settings, data) {
         localStorage.setItem("DataTables_state", JSON.stringify(data));
      },
      stateLoadCallback: function () {
         return JSON.parse(localStorage.getItem("DataTables_state")) || null;
      },
      select: {
         style: "single",
         className: "selected-row",
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

const useDataTable = (tableRef, tableInstanceRef, searchInput, selectedOption, setSelectedLead, setShowModal, idnetsuite_admin, rol_admin) => {
   const navigate = useNavigate();
   
   useEffect(() => {
      if (!tableRef.current) return;
      if (tableInstanceRef.current) {
         tableInstanceRef.current.destroy();
         tableInstanceRef.current = null;
      }

      tableInstanceRef.current = $(tableRef.current).DataTable(getDataTableConfig(tableRef.current, searchInput, selectedOption, idnetsuite_admin, rol_admin));

      // Modificar el manejador del clic
      $(tableRef.current).on("click", "tbody tr", function () {
         const data = tableInstanceRef.current.row(this).data();
         if (data) {
            if (selectedOption === "leads") {
               setSelectedLead(data);
               setShowModal(true);
               return;
            }
            if (selectedOption === "oportunidad") {
               navigate(`/oportunidad/ver?data=${data.entity_oport}&data2=${data.id_oportunidad_oport}`);
               return;
            }
            if (selectedOption === "estimaciones") {
               navigate(`/estimaciones/view?data=${data.idLead_est}&data2=${data.idEstimacion_est}`);
               return;
            }
            if (selectedOption === "ordenVenta") {  
               navigate(`/orden/view?data=${data.id_ov_lead}&data2=${data.id_ov_netsuite}`);
               return;
            }
            if (selectedOption === "evento") {
               navigate(`/events/actions?idCalendar=${data.id_calendar}&idLead=${data.id_lead}&idDate=0`);
               return;
            }
            
         }
      });

      return () => {
         if (tableInstanceRef.current) {
            $(tableRef.current).off("click", "tbody tr");
            tableInstanceRef.current.destroy();
            tableInstanceRef.current = null;
         }
      };
   }, [tableRef, searchInput, selectedOption, setSelectedLead, setShowModal, idnetsuite_admin, rol_admin, navigate]);
};

const STORAGE_KEY = "buscador_state";

const loadStoredState = () => {
   try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
         return JSON.parse(stored);
      }
   } catch (error) {
      console.error("Error loading stored state:", error);
   }
   return null;
};

// Función para obtener parámetros de la URL
const getUrlParams = () => {
   const params = new URLSearchParams(window.location.search);
   return {
      option: params.get("option") || "leads",
   };
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
   const tableRef = useRef(null);
   const tableInstanceRef = useRef(null);

   // Obtener opción de la URL o localStorage
   const urlParams = getUrlParams();
   const storedState = loadStoredState();

   const [searchInput, setSearchInput] = useState(storedState?.searchInput || "");
   const [debouncedSearch, setDebouncedSearch] = useState(storedState?.searchInput || "");
   const [selectedOption, setSelectedOption] = useState(urlParams.option || storedState?.selectedOption || "leads");
   const [showModal, setShowModal] = useState(false);
   const [selectedLead, setSelectedLead] = useState(null);

   const { idnetsuite_admin, rol_admin } = useSelector((state) => state.auth);

   // Efecto para guardar en localStorage cuando cambien los valores
   useEffect(() => {
      const stateToStore = {
         searchInput,
         selectedOption,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToStore));
   }, [searchInput, selectedOption]);

   // Efecto para el debounce
   useEffect(() => {
      if (!searchInput.trim()) {
         setDebouncedSearch("");
         return;
      }

      const timer = setTimeout(() => {
         setDebouncedSearch(searchInput);
      }, 1000);

      return () => {
         clearTimeout(timer);
      };
   }, [searchInput]);

   const handleOptionChange = (e) => {
      localStorage.removeItem(STORAGE_KEY);
      const newOption = e.target.value;
      const newUrl = `${window.location.pathname}?option=${newOption}`;
      window.location.href = newUrl; // Esto recargará la página
   };

   const handleSearchChange = (e) => {
      setSearchInput(e.target.value);
   };

   const handleCloseModal = () => {
      setShowModal(false);
      setSelectedLead(null);
   };

   // Efecto inicial para cargar la búsqueda si hay datos almacenados
   useEffect(() => {
      if (storedState?.searchInput && storedState?.selectedOption) {
         setDebouncedSearch(storedState.searchInput);
      }
   }, []);

   useDataTable(tableRef, tableInstanceRef, debouncedSearch, selectedOption, setSelectedLead, setShowModal, idnetsuite_admin, rol_admin);

   return (
      <div className="card" style={{ width: "100%" }}>
         <div className="card-header table-card-header">
            <div role="alert" className="fade alert alert-success show">
               Buscar transacciones de:
            </div>
            <div className="row mb-3">
               <div className="col-md-6">
                  <select className="form-select" value={selectedOption} onChange={handleOptionChange}>
                     <option value="leads">Leads</option>
                     <option value="oportunidad">Oportunidad</option>
                     <option value="estimaciones">Estimaciones</option>
                     <option value="ordenVenta">Orden de Venta</option>
                     <option value="evento">Evento</option>
                     <option value="corredores">Corredores</option>
                     <option value="proyecto">Proyecto</option>
                     <option value="subsidiaria">Subsidiaria</option>
                     <option value="ubicaciones">Ubicaciones</option>
                     <option value="campana">Campaña</option>
                  </select>
               </div>
               <div className="col-md-6">
                  <input type="text" className="form-control" value={searchInput} onChange={handleSearchChange} placeholder="Buscar..." />
               </div>
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
