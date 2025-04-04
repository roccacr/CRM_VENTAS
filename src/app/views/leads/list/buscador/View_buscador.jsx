import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import $ from "jquery";
import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import "../../../FiltrosTabla/style.css";
import { apiUrlImg, commonRequestData } from "../../../../../api";
import { 
   TABLE_LEADS_BUSCADOR,
   TABLE_OPORTUNIDADES_BUSCADOR,
   TABLE_EVENTOS_BUSCADOR,
   TABLE_ESTIMACIONES_BUSCADOR,
   TABLE_ORDEN_VENTA_BUSCADOR,
   TABLE_CORREDORES_BUSCADOR,
   TABLE_PROYECTOS_BUSCADOR,
   TABLE_SUBSIDIARIA_BUSCADOR,
   TABLE_UBICACIONES_BUSCADOR,
   TABLE_CAMPANAS_BUSCADORES
} from "./tableColumns";
import { ModalLeads } from "../../../../pages/modal/modalLeads";

// Constantes
const STORAGE_KEY = "buscador_state";
const MOBILE_BREAKPOINT = 768;

/**
 * Configuración de columnas por tipo de búsqueda
 */
const SEARCH_PANE_OPTIONS = {
   leads: [0, 1, 2, 3, 4],
   oportunidad: [0, 1, 2],
   estimaciones: [0, 1, 2],
   ordenVenta: [0, 1, 2],
   evento: [0, 1, 2, 3, 4, 5],
   corredores: [0, 1, 2],
   proyecto: [0, 1, 2],
   subsidiaria: [0, 1, 2],
   ubicaciones: [0, 1, 2],
   campana: [0, 1, 2]
};

/**
 * Mapeo de rutas de navegación por tipo de búsqueda
 */
const NAVIGATION_ROUTES = {
   leads: null, // Maneja modal en lugar de navegación
   oportunidad: (data) => `/oportunidad/ver?data=${data.entity_oport}&data2=${data.id_oportunidad_oport}`,
   estimaciones: (data) => `/estimaciones/view?data=${data.idLead_est}&data2=${data.idEstimacion_est}`,
   ordenVenta: (data) => `/orden/view?data=${data.id_ov_lead}&data2=${data.id_ov_netsuite}`,
   evento: (data) => `/events/actions?idCalendar=${data.id_calendar}&idLead=${data.id_lead}&idDate=0`
};

/**
 * Obtiene las columnas según el tipo de búsqueda
 * @param {string} option - Tipo de búsqueda
 * @returns {Array} Configuración de columnas
 */
const getColumnsForOption = (option) => {
   const columnMappings = {
      oportunidad: TABLE_OPORTUNIDADES_BUSCADOR,
      evento: TABLE_EVENTOS_BUSCADOR,
      estimaciones: TABLE_ESTIMACIONES_BUSCADOR,
      ordenVenta: TABLE_ORDEN_VENTA_BUSCADOR,
      corredores: TABLE_CORREDORES_BUSCADOR,
      proyecto: TABLE_PROYECTOS_BUSCADOR,
      subsidiaria: TABLE_SUBSIDIARIA_BUSCADOR,
      ubicaciones: TABLE_UBICACIONES_BUSCADOR,
      campana: TABLE_CAMPANAS_BUSCADORES,
      leads: TABLE_LEADS_BUSCADOR
   };
   return columnMappings[option] || TABLE_LEADS_BUSCADOR;
};

/**
 * Hook personalizado para gestionar el estado persistente
 * @returns {Object} Estado almacenado
 */
const useStoredState = () => {
   const getUrlParams = () => {
      const params = new URLSearchParams(window.location.search);
      return { option: params.get("option") || "leads" };
   };

   const loadStoredState = () => {
      try {
         const stored = localStorage.getItem(STORAGE_KEY);
         return stored ? JSON.parse(stored) : null;
      } catch (error) {
         console.error("Error loading stored state:", error);
         return null;
      }
   };

   const urlParams = getUrlParams();
   const storedState = loadStoredState();

   return {
      initialSearchInput: storedState?.searchInput || "",
      initialSelectedOption: urlParams.option || storedState?.selectedOption || "leads"
   };
};

/**
 * Configuración de DataTables según los parámetros proporcionados
 */
const getDataTableConfig = (searchInput, selectedOption, idnetsuite_admin, rol_admin) => {
   const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
   const columns = getColumnsForOption(selectedOption);

   const baseConfig = {
      columns,
      searchPanes: {
         layout: isMobile ? "columns-1" : "columns-2",
         initCollapsed: true,
         columns: SEARCH_PANE_OPTIONS[selectedOption]
      },
      processing: true,
      dom: "lPfrtip",
      language: {
         emptyTable: "Ingrese un término de búsqueda",
         searchPanes: {
            title: "Filtros",
            collapse: "Filtros",
            clearMessage: "Limpiar Todo",
            emptyPanes: "No hay datos para filtrar"
         }
      }
   };

   if (!searchInput.trim()) {
      return { ...baseConfig, data: [] };
   }

   return {
      ...baseConfig,
      ajax: {
         url: `${apiUrlImg}buscador/getAll`,
         type: "POST",
         data: (d) => ({
            ...commonRequestData,
            searchs: searchInput,
            selectedOption,
            idnetsuite_admin,
            rol_admin,
            start: d.start,
            length: d.length,
            search: d.searchPanes
         }),
         dataSrc: (response) => response.data || []
      },
      select: {
         style: "single",
         className: "selected-row"
      }
   };
};

/**
 * Hook personalizado para gestionar la tabla de datos
 */
const useDataTable = (tableRef, tableInstanceRef, searchInput, selectedOption, setSelectedLead, setShowModal, idnetsuite_admin, rol_admin) => {
   const navigate = useNavigate();

   useEffect(() => {
      if (!tableRef.current) return;

      if (tableInstanceRef.current) {
         tableInstanceRef.current.destroy();
         tableInstanceRef.current = null;
      }

      tableInstanceRef.current = $(tableRef.current).DataTable(
         getDataTableConfig(searchInput, selectedOption, idnetsuite_admin, rol_admin)
      );

      const handleRowClick = function() {
         const data = tableInstanceRef.current.row(this).data();
         if (!data) return;

         if (selectedOption === "leads") {
            setSelectedLead(data);
            setShowModal(true);
            return;
         }

         const navigationRoute = NAVIGATION_ROUTES[selectedOption];
         if (navigationRoute) {
            navigate(navigationRoute(data));
         }
      };

      $(tableRef.current).on("click", "tbody tr", handleRowClick);

      return () => {
         if (tableInstanceRef.current) {
            $(tableRef.current).off("click", "tbody tr");
            tableInstanceRef.current.destroy();
            tableInstanceRef.current = null;
         }
      };
   }, [tableRef, searchInput, selectedOption, setSelectedLead, setShowModal, idnetsuite_admin, rol_admin, navigate]);
};

/**
 * Componente de tabla responsiva
 */
const LeadsTable = React.memo(({ tableRef }) => (
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
));

/**
 * Componente principal del buscador
 * Gestiona la búsqueda y visualización de diferentes tipos de datos
 */
const View_buscador = () => {
   const tableRef = useRef(null);
   const tableInstanceRef = useRef(null);
   const { initialSearchInput, initialSelectedOption } = useStoredState();

   const [searchInput, setSearchInput] = useState(initialSearchInput);
   const [debouncedSearch, setDebouncedSearch] = useState(initialSearchInput);
   const [selectedOption, setSelectedOption] = useState(initialSelectedOption);
   const [showModal, setShowModal] = useState(false);
   const [selectedLead, setSelectedLead] = useState(null);

   const { idnetsuite_admin, rol_admin } = useSelector((state) => state.auth);

   // Persistencia del estado
   useEffect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ searchInput, selectedOption }));
   }, [searchInput, selectedOption]);

   // Debounce para la búsqueda
   useEffect(() => {
      if (!searchInput.trim()) {
         setDebouncedSearch("");
         return;
      }

      const timer = setTimeout(() => setDebouncedSearch(searchInput), 1000);
      return () => clearTimeout(timer);
   }, [searchInput]);

   const handleOptionChange = (e) => {
      localStorage.removeItem(STORAGE_KEY);
      const newOption = e.target.value;
      window.location.href = `${window.location.pathname}?option=${newOption}`;
   };

   useDataTable(
      tableRef,
      tableInstanceRef,
      debouncedSearch,
      selectedOption,
      setSelectedLead,
      setShowModal,
      idnetsuite_admin,
      rol_admin
   );

   return (
      <div className="card" style={{ width: "100%" }}>
         <div className="card-header table-card-header">
            <div role="alert" className="fade alert alert-success show">
               Buscar transacciones de:
            </div>
            <div className="row mb-3">
               <div className="col-md-6">
                  <select 
                     className="form-select" 
                     value={selectedOption} 
                     onChange={handleOptionChange}
                  >
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
                  <input 
                     type="text" 
                     className="form-control" 
                     value={searchInput} 
                     onChange={(e) => setSearchInput(e.target.value)} 
                     placeholder="Buscar..." 
                  />
               </div>
            </div>
         </div>
         <div className="table-border-style card-body">
            <LeadsTable tableRef={tableRef} />
            {showModal && selectedLead && (
               <ModalLeads 
                  leadData={selectedLead} 
                  onClose={() => {
                     setShowModal(false);
                     setSelectedLead(null);
                  }} 
               />
            )}
         </div>
      </div>
   );
};

export default View_buscador;
