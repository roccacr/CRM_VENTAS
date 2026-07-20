import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DataTable, DT, React, useEffect, useRef, useTableOptions } from "../../leads/list/Imports/imports";
import "../../leads/list/Imports/style.css";
import "./View_oportunidad_listas.css";
import { PROFILE_PANEL_STYLES, PROFILE_THEME_STYLES } from "../../leads/perfil/profileTheme";
import { tableColumns } from "./tableColumns";
import { useTableData } from "./useTableData";

DataTable.use(DT);

const OPPORTUNITY_LIST_THEME = `
    ${PROFILE_THEME_STYLES}

    .opportunity-list-shell .lead-profile-panel {
        padding: 18px;
    }

    .opportunity-list-mode-copy,
    .lead-profile-section-copy,
    .lead-profile-page-copy {
        display: none;
    }
`;

const LOCAL_STORAGE_START = "oportunidad_inputStartDate";
const LOCAL_STORAGE_END = "oportunidad_inputEndDate";

const getDefaultDates = () => {
   const now = new Date();
   const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
   const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

   return { firstDay, lastDay };
};

const FilterCheckbox = ({ id, label, checked, onChange }) => (
   <label className="opportunity-list-checkbox" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
   </label>
);

const StatusToggle = ({ botonesEstados, setBotonesEstados }) => (
   <div className="opportunity-list-status-group">
      <button
         type="button"
         className={`opportunity-list-status-btn ${botonesEstados === 6 ? "is-active" : ""}`}
         onClick={() => setBotonesEstados(6)}
      >
         Oportunidades activas
      </button>

      <button
         type="button"
         className={`opportunity-list-status-btn ${botonesEstados === 5 ? "is-active" : ""}`}
         onClick={() => setBotonesEstados(5)}
      >
         Oportunidades inactivas
      </button>

      <button
         type="button"
         className={`opportunity-list-status-btn ${botonesEstados === 7 ? "is-active" : ""}`}
         onClick={() => setBotonesEstados(7)}
      >
         Todas las oportunidades
      </button>
   </div>
);

const DateRangeFilter = ({ inputStartDate, setInputStartDate, inputEndDate, setInputEndDate }) => (
   <div className="opportunity-list-date-grid">
      <div className="opportunity-list-field">
         <label>Fecha inicial</label>
         <input type="date" className="form-control" value={inputStartDate || ""} onChange={(event) => setInputStartDate(event.target.value)} />
      </div>

      <div className="opportunity-list-field">
         <label>Fecha final</label>
         <input type="date" className="form-control" value={inputEndDate || ""} onChange={(event) => setInputEndDate(event.target.value)} />
      </div>
   </div>
);

const ModeSelector = ({ isMode, setIsMode, onClearDates }) => (
   <div className="opportunity-list-mode-panel">
      <div className="opportunity-list-mode-head">
         <span className="opportunity-list-mode-kicker">Criterio de búsqueda</span>
         <p className="opportunity-list-mode-copy">
            Defina si el rango de fechas debe aplicarse sobre la creación o sobre el cierre previsto de la oportunidad.
         </p>
      </div>

      <div className="opportunity-list-checkbox-group">
         <FilterCheckbox
            id="creationDate"
            label="Fecha de creación"
            checked={isMode === 1}
            onChange={(event) => setIsMode(event.target.checked ? 1 : 0)}
         />

         <FilterCheckbox
            id="expectedCloseDate"
            label="Fecha de cierre previsto"
            checked={isMode === 2}
            onChange={(event) => setIsMode(event.target.checked ? 2 : 0)}
         />
      </div>

      <button type="button" className="opportunity-list-clear-btn" onClick={onClearDates}>
         Limpiar filtro de fecha
      </button>
   </div>
);

const FilterOptions = ({
   inputStartDate,
   setInputStartDate,
   inputEndDate,
   setInputEndDate,
   botonesEstados,
   setBotonesEstados,
   isMode,
   setIsMode,
   onClearDates,
}) => (
   <section className="lead-profile-section">
      <div className="lead-profile-section-head">
         <span className="lead-profile-kicker">Filtros</span>
         <h5 className="lead-profile-section-title">Consulta</h5>
         <p className="lead-profile-section-copy">
            Filtre por estado y rango de fechas para revisar solo las oportunidades relevantes del período.
         </p>
      </div>

      <div className="opportunity-list-filter-layout">
         <div className="opportunity-list-filter-block">
            <label className="opportunity-list-block-label">Estado de la oportunidad</label>
            <StatusToggle botonesEstados={botonesEstados} setBotonesEstados={setBotonesEstados} />
         </div>

         <div className="opportunity-list-filter-block">
            <label className="opportunity-list-block-label">Rango de fechas</label>
            <DateRangeFilter
               inputStartDate={inputStartDate}
               setInputStartDate={setInputStartDate}
               inputEndDate={inputEndDate}
               setInputEndDate={setInputEndDate}
            />
         </div>

         <div className="opportunity-list-filter-block">
            <ModeSelector isMode={isMode} setIsMode={setIsMode} onClearDates={onClearDates} />
         </div>
      </div>
   </section>
);

const DataTableComponent = ({ tableData, tableRef, tableOptions }) => (
   <section className="lead-profile-section">
      <div className="lead-profile-section-head">
         <span className="lead-profile-kicker">Resultado</span>
         <h5 className="lead-profile-section-title">Oportunidades</h5>
         <p className="lead-profile-section-copy">Seleccione una fila para abrir el detalle comercial de la oportunidad correspondiente.</p>
      </div>

      <div className="opportunity-list-table-shell">
         <div className="table-responsive opportunity-list-table-wrap">
            <DataTable
               data={tableData}
               ref={tableRef}
               className="table table-striped table dt-responsive w-100 display text-left"
               options={tableOptions}
               columns={tableColumns}
            />
         </div>
      </div>
   </section>
);

const useTableManager = (tableRef, tableData) => {
   useEffect(() => {
      if (tableRef.current && typeof tableRef.current.DataTable === "function") {
         const table = tableRef.current.DataTable();
         table.clear();
         table.rows.add(tableData);
         table.columns.adjust().draw();
      }
   }, [tableData, tableRef]);
};

const View_oportunidad_listas = () => {
   const navigate = useNavigate();
   const { firstDay, lastDay } = getDefaultDates();
   const search = window.location.search;
   const searchParams = useMemo(() => new URLSearchParams(search), [search]);
   const oportunidadParam = searchParams.get("oportuinidad") || "7";
   const leadAsignado = searchParams.get("idLead");
   const shouldStartWithoutDateFilters = leadAsignado === "0" && ["1", "10"].includes(oportunidadParam);
   const [inputStartDateState, setInputStartDateState] = useState(() => shouldStartWithoutDateFilters ? "" : localStorage.getItem(LOCAL_STORAGE_START) || firstDay);
   const [inputEndDateState, setInputEndDateState] = useState(() => shouldStartWithoutDateFilters ? "" : localStorage.getItem(LOCAL_STORAGE_END) || lastDay);
   const [isMode, setIsMode] = useState(1);
   const [botonesEstados, setBotonesEstados] = useState(Number.parseInt(oportunidadParam, 10) || 7);
   const [idOportunidad] = useState(1);
   const tableRef = useRef(null);

   useEffect(() => {
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      localStorage.removeItem("previousUrl");
      localStorage.setItem("previousUrl", currentUrl);
   }, []);

   const setInputStartDate = (value) => {
      setInputStartDateState(value);

      if (value) {
         localStorage.setItem(LOCAL_STORAGE_START, value);
         return;
      }

      localStorage.removeItem(LOCAL_STORAGE_START);
   };

   const setInputEndDate = (value) => {
      setInputEndDateState(value);

      if (value) {
         localStorage.setItem(LOCAL_STORAGE_END, value);
         return;
      }

      localStorage.removeItem(LOCAL_STORAGE_END);
   };

   useEffect(() => {
      if (!shouldStartWithoutDateFilters) return;

      setInputStartDateState("");
      setInputEndDateState("");
   }, [shouldStartWithoutDateFilters, oportunidadParam, leadAsignado]);

   const handleClearDates = () => {
      setInputStartDate("");
      setInputEndDate("");
   };

   const [tableData] = useTableData(true, idOportunidad, inputStartDateState, inputEndDateState, isMode, botonesEstados, leadAsignado);

   const filteredTableData = useMemo(() => {
      if (oportunidadParam === "1") {
         return tableData.filter((item) => item.chek_oport === 1);
      }

      return tableData;
   }, [oportunidadParam, tableData]);

   const handleOpenModal = (item) => {
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      localStorage.removeItem("previousUrl");
      localStorage.setItem("previousUrl", currentUrl);
      navigate(`/oportunidad/ver?data=${item.entity_oport}&data2=${item.id_oportunidad_oport}`);
   };

   const tableOptions = {
      ...useTableOptions([0, 1, 2, 4, 7, 10, 12, 13, 14, 11]),
      rowCallback: (row, data) => {
         row.onclick = () => handleOpenModal(data);
         row.style.cursor = "pointer";
      },
   };

   useTableManager(tableRef, filteredTableData);

   return (
      <>
         <style>{OPPORTUNITY_LIST_THEME}</style>

         <div className="lead-profile-shell opportunity-list-shell">
            <div style={PROFILE_PANEL_STYLES}>
               <div className="lead-profile-panel">
                  <div className="lead-profile-hero">
                     <div>
                        <span className="lead-profile-eyebrow">Gestión comercial</span>
                        <h1 className="lead-profile-page-title">Oportunidades</h1>
                        <p className="lead-profile-page-copy">
                           Consulte en una sola vista las oportunidades activas, inactivas o totales, con filtros por fecha y acceso rápido al
                           detalle de cada registro.
                        </p>
                     </div>
                  </div>

                  <FilterOptions
                     inputStartDate={inputStartDateState}
                     setInputStartDate={setInputStartDate}
                     inputEndDate={inputEndDateState}
                     setInputEndDate={setInputEndDate}
                     botonesEstados={botonesEstados}
                     setBotonesEstados={setBotonesEstados}
                     isMode={isMode}
                     setIsMode={setIsMode}
                     onClearDates={handleClearDates}
                  />

                  <DataTableComponent tableData={filteredTableData} tableRef={tableRef} tableOptions={tableOptions} />
               </div>
            </div>
         </div>
      </>
   );
};

export default React.memo(View_oportunidad_listas);
