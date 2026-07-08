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
   TABLE_CAMPANAS_BUSCADOR,
   TABLE_CORREDORES_BUSCADOR,
   TABLE_ESTIMACIONES_BUSCADOR,
   TABLE_EVENTOS_BUSCADOR,
   TABLE_LEADS_BUSCADOR,
   TABLE_OPORTUNIDADES_BUSCADOR,
   TABLE_ORDEN_VENTA_BUSCADOR,
   TABLE_PROYECTOS_BUSCADOR,
   TABLE_SUBSIDIARIA_BUSCADOR,
   TABLE_UBICACIONES_BUSCADOR,
} from "./tableColumns";
import { ModalLeads } from "../../../../pages/modal/modalLeads";
import {
   PROFILE_PANEL_STYLES,
   PROFILE_THEME_STYLES,
} from "../../perfil/profileTheme";

const STORAGE_KEY = "buscador_state";
const MOBILE_BREAKPOINT = 768;

const SEARCH_VIEW_STYLES = `
${PROFILE_THEME_STYLES}

.search-view-shell .lead-profile-panel {
   padding: 18px;
}

.search-view-hint-copy,
.lead-profile-section-copy,
.lead-profile-page-copy {
   display: none;
}

.search-view-toolbar {
   display: grid;
   gap: 12px;
}

.search-view-grid {
   display: grid;
   grid-template-columns: repeat(2, minmax(0, 1fr));
   gap: 12px;
}

.search-view-field {
   display: grid;
   gap: 6px;
}

.search-view-label {
   margin: 0;
   font-size: 11px;
   font-weight: 700;
   letter-spacing: 0.04em;
   text-transform: uppercase;
   color: #4b5563;
}

.search-view-select,
.search-view-input {
   min-height: 46px;
   border: 1px solid #d1d5db;
   border-radius: 12px;
   background: #ffffff;
   color: #111827;
   font-size: 13px;
   transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.search-view-select:focus,
.search-view-input:focus {
   border-color: #111827;
   box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
}

.search-view-hint {
   display: flex;
   flex-wrap: wrap;
   align-items: center;
   justify-content: space-between;
   gap: 10px;
   padding: 12px 14px;
   border: 1px solid #e5e7eb;
   border-radius: 12px;
   background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
}

.search-view-hint-copy {
   margin: 0;
   font-size: 12px;
   line-height: 1.5;
   color: #4b5563;
}

.search-view-status {
   display: inline-flex;
   align-items: center;
   gap: 6px;
   padding: 6px 10px;
   border-radius: 999px;
   border: 1px solid #d1d5db;
   background: #ffffff;
   font-size: 11px;
   font-weight: 700;
   letter-spacing: 0.04em;
   text-transform: uppercase;
   color: #374151;
}

.search-view-status.is-loading {
   border-color: #cfd6de;
   background: #f9fafb;
   color: #111827;
}

.search-view-table-shell {
   border: 1px solid #e5e7eb;
   border-radius: 14px;
   background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
   overflow: hidden;
}

.search-view-table-wrap {
   padding: 14px;
}

.search-view-table-wrap .table {
   margin-bottom: 0;
}

.search-view-table-wrap .table > :not(caption) > * > * {
   padding: 10px 12px;
   font-size: 12px;
   vertical-align: middle;
}

.search-view-table-wrap .table thead th {
   border-bottom-width: 1px;
   background: #f8fafc;
   color: #374151;
   font-size: 11px;
   font-weight: 700;
   letter-spacing: 0.05em;
   text-transform: uppercase;
}

.search-view-table-wrap .dataTables_length,
.search-view-table-wrap .dataTables_filter {
   margin-bottom: 12px;
}

.search-view-table-wrap .dataTables_filter input,
.search-view-table-wrap .dataTables_length select {
   min-height: 38px;
   border: 1px solid #d1d5db;
   border-radius: 10px;
   background: #ffffff;
   font-size: 12px;
}

.search-view-table-wrap .dtsp-searchPanes {
   margin-bottom: 12px;
}

.search-view-table-wrap .dtsp-searchPanes .dtsp-titleRow,
.search-view-table-wrap .dtsp-searchPanes .dtsp-searchPane {
   border-radius: 12px;
}

.search-view-table-wrap .selected-row {
   background: #111827 !important;
   color: #ffffff !important;
}

.search-view-table-wrap .selected-row td {
   color: #ffffff !important;
}

@media (max-width: 768px) {
   .search-view-grid {
      grid-template-columns: 1fr;
   }

   .search-view-hint {
      align-items: flex-start;
   }

   .search-view-status {
      width: 100%;
      justify-content: center;
   }
}
`;

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
   campana: [0, 1, 2],
};

const SEARCH_OPTIONS = [
   { value: "leads", label: "Leads" },
   { value: "oportunidad", label: "Oportunidad" },
   { value: "estimaciones", label: "Estimaciones" },
   { value: "ordenVenta", label: "Orden de venta" },
   { value: "evento", label: "Evento" },
   { value: "corredores", label: "Corredores" },
   { value: "proyecto", label: "Proyecto" },
   { value: "subsidiaria", label: "Subsidiaria" },
   { value: "ubicaciones", label: "Ubicaciones" },
   { value: "campana", label: "Campaña" },
];

const NAVIGATION_ROUTES = {
   leads: null,
   oportunidad: (data) =>
      `/oportunidad/ver?data=${data.entity_oport}&data2=${data.id_oportunidad_oport}`,
   estimaciones: (data) =>
      `/estimaciones/view?data=${data.idLead_est}&data2=${data.idEstimacion_est}`,
   ordenVenta: (data) =>
      `/orden/view?data=${data.id_ov_lead}&data2=${data.id_ov_netsuite}`,
   evento: (data) =>
      `/events/actions?idCalendar=${data.id_calendar}&idLead=${data.id_lead}&idDate=0`,
};

const getColumnsForOption = (option) => {
   const columnMappings = {
      campana: TABLE_CAMPANAS_BUSCADOR,
      corredores: TABLE_CORREDORES_BUSCADOR,
      estimaciones: TABLE_ESTIMACIONES_BUSCADOR,
      evento: TABLE_EVENTOS_BUSCADOR,
      leads: TABLE_LEADS_BUSCADOR,
      oportunidad: TABLE_OPORTUNIDADES_BUSCADOR,
      ordenVenta: TABLE_ORDEN_VENTA_BUSCADOR,
      proyecto: TABLE_PROYECTOS_BUSCADOR,
      subsidiaria: TABLE_SUBSIDIARIA_BUSCADOR,
      ubicaciones: TABLE_UBICACIONES_BUSCADOR,
   };

   return columnMappings[option] || TABLE_LEADS_BUSCADOR;
};

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
      initialSelectedOption:
         urlParams.option || storedState?.selectedOption || "leads",
   };
};

const getDataTableConfig = (
   searchInput,
   selectedOption,
   idnetsuite_admin,
   rol_admin
) => {
   const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
   const columns = getColumnsForOption(selectedOption);
   const baseConfig = {
      columns,
      searchPanes: {
         layout: isMobile ? "columns-1" : "columns-2",
         initCollapsed: true,
         columns: SEARCH_PANE_OPTIONS[selectedOption],
      },
      processing: true,
      dom: "lPfrtip",
      language: {
         emptyTable: "Ingrese un término de búsqueda",
         searchPanes: {
            title: "Filtros",
            collapse: "Filtros",
            clearMessage: "Limpiar todo",
            emptyPanes: "No hay datos para filtrar",
         },
      },
   };

   if (!searchInput.trim()) {
      return { ...baseConfig, data: [] };
   }

   return {
      ...baseConfig,
      ajax: {
         url: `${apiUrlImg}buscador/getAll`,
         type: "POST",
         data: (dataTableRequest) => ({
            ...commonRequestData,
            searchs: searchInput,
            selectedOption,
            idnetsuite_admin,
            rol_admin,
            start: dataTableRequest.start,
            length: dataTableRequest.length,
            search: dataTableRequest.searchPanes,
         }),
         dataSrc: (response) => response.data || [],
      },
      select: {
         style: "single",
         className: "selected-row",
      },
   };
};

const useDataTable = (
   tableRef,
   tableInstanceRef,
   searchInput,
   selectedOption,
   setSelectedLead,
   setShowModal,
   idnetsuite_admin,
   rol_admin
) => {
   const navigate = useNavigate();

   useEffect(() => {
      if (!tableRef.current) {
         return undefined;
      }

      if (tableInstanceRef.current) {
         tableInstanceRef.current.destroy();
         tableInstanceRef.current = null;
      }

      tableInstanceRef.current = $(tableRef.current).DataTable(
         getDataTableConfig(
            searchInput,
            selectedOption,
            idnetsuite_admin,
            rol_admin
         )
      );

      const handleRowClick = function () {
         const data = tableInstanceRef.current.row(this).data();

         if (!data) {
            return;
         }

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
         if (tableRef.current) {
            $(tableRef.current).off("click", "tbody tr", handleRowClick);
         }

         if (tableInstanceRef.current) {
            tableInstanceRef.current.destroy();
            tableInstanceRef.current = null;
         }
      };
   }, [
      tableRef,
      tableInstanceRef,
      searchInput,
      selectedOption,
      setSelectedLead,
      setShowModal,
      idnetsuite_admin,
      rol_admin,
      navigate,
   ]);
};

const SearchResultsTable = React.memo(({ tableRef }) => (
   <div className="table-responsive search-view-table-wrap">
      <table
         ref={tableRef}
         className="table table-striped table-bordered w-100"
      >
         <thead></thead>
      </table>
   </div>
));

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

   useEffect(() => {
      localStorage.setItem(
         STORAGE_KEY,
         JSON.stringify({ searchInput, selectedOption })
      );
   }, [searchInput, selectedOption]);

   useEffect(() => {
      if (!searchInput.trim()) {
         setDebouncedSearch("");
         return undefined;
      }

      const timer = setTimeout(() => {
         setDebouncedSearch(searchInput);
      }, 1000);

      return () => clearTimeout(timer);
   }, [searchInput]);

   const handleOptionChange = (event) => {
      const newOption = event.target.value;

      setSelectedOption(newOption);
      localStorage.removeItem(STORAGE_KEY);
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

   const selectedOptionLabel =
      SEARCH_OPTIONS.find((option) => option.value === selectedOption)?.label ||
      "Leads";
   const isSearching =
      searchInput.trim() !== "" && searchInput.trim() !== debouncedSearch.trim();

   return (
      <div className="lead-profile-shell search-view-shell">
         <style>{SEARCH_VIEW_STYLES}</style>

         <div className="lead-profile-sidebar" style={PROFILE_PANEL_STYLES}>
            <div className="lead-profile-panel">
               <div className="lead-profile-hero">
                  <div>
                     <span className="lead-profile-eyebrow">
                        Resumen
                     </span>
                     <h1 className="lead-profile-page-title">
                        Buscador
                     </h1>
                     <p className="lead-profile-page-copy">
                        Consulte leads, oportunidades, eventos y catálogos
                        comerciales desde una sola vista, con filtros rápidos y
                        acceso directo al detalle de cada registro.
                     </p>
                  </div>
               </div>

               <section className="lead-profile-section">
                  <div className="lead-profile-section-head">
                     <span className="lead-profile-kicker">Controles</span>
                     <h5 className="lead-profile-section-title">
                        Parámetros de búsqueda
                     </h5>
                     <p className="lead-profile-section-copy">
                        Defina el tipo de transacción y el término de consulta
                        para visualizar resultados relacionados en tiempo real.
                     </p>
                  </div>

                  <div className="search-view-toolbar">
                     <div className="search-view-grid">
                        <div className="search-view-field">
                           <label
                              htmlFor="search-view-option"
                              className="search-view-label"
                           >
                              Tipo de registro
                           </label>
                           <select
                              id="search-view-option"
                              className="form-select search-view-select"
                              value={selectedOption}
                              onChange={handleOptionChange}
                           >
                              {SEARCH_OPTIONS.map((option) => (
                                 <option
                                    key={option.value}
                                    value={option.value}
                                 >
                                    {option.label}
                                 </option>
                              ))}
                           </select>
                        </div>

                        <div className="search-view-field">
                           <label
                              htmlFor="search-view-input"
                              className="search-view-label"
                           >
                              Término de búsqueda
                           </label>
                           <input
                              id="search-view-input"
                              type="text"
                              className="form-control search-view-input"
                              value={searchInput}
                              onChange={(event) =>
                                 setSearchInput(event.target.value)
                              }
                              placeholder="Escriba nombre, correo, teléfono, ID o referencia"
                           />
                        </div>
                     </div>

                     <div className="search-view-hint">
                        <p className="search-view-hint-copy">
                           La consulta actual está enfocada en{" "}
                           <strong>{selectedOptionLabel}</strong>. Al hacer clic
                           en una fila se abrirá el detalle disponible para ese
                           tipo de registro.
                        </p>
                        <span
                           className={`search-view-status ${
                              isSearching ? "is-loading" : ""
                           }`}
                        >
                           {isSearching
                              ? "Actualizando resultados"
                              : "Vista lista para consultar"}
                        </span>
                     </div>
                  </div>
               </section>

               <section className="lead-profile-section">
                  <div className="lead-profile-section-head">
                     <span className="lead-profile-kicker">Resultado</span>
                     <h5 className="lead-profile-section-title">
                        Registros
                     </h5>
                     <p className="lead-profile-section-copy">
                        Utilice los paneles de filtro para refinar la consulta y
                        revisar únicamente la información relevante.
                     </p>
                  </div>

                  <div className="search-view-table-shell">
                     <SearchResultsTable tableRef={tableRef} />
                  </div>
               </section>

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
      </div>
   );
};

export default View_buscador;
