import { React, useRef, useEffect, DataTable, useTableOptions, DT } from "../../leads/list/Imports/imports";
import { useNavigate } from "react-router-dom";
import { useTableData } from "./useTableData";
import { tableColumns } from "./tableColumns";
import "../../leads/list/Imports/style.css";
import { useState } from "react";

// Initialize DataTables with DT plugin
DataTable.use(DT);

/**
 * Helper function to get default date range (first and last day of the current month).
 * @returns {Object} An object containing firstDay and lastDay in YYYY-MM-DD format.
 */
const getDefaultDates = () => {
   const now = new Date();
   const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
   const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

   return { firstDay, lastDay };
};

/**
 * @interface FilterOptionsProps
 * @property {string} inputStartDate - Start date for filtering
 * @property {Function} setInputStartDate - Setter for start date
 * @property {string} inputEndDate - End date for filtering
 * @property {Function} setInputEndDate - Setter for end date
 * @property {number} filterOption - Current filter option
 * @property {Function} handleCheckboxChange - Handler for checkbox changes
 * @property {Function} setBotonesEstados - Setter for estados
 * @property {Function} setIsMode - Setter for filter mode
 * @property {number} isMode - Current filter mode
 * @property {number} BotonesEstados - Current estados value
 */

/**
 * DateRangeFilter Component - Responsible for date range selection
 * Following Single Responsibility Principle
 */
const DateRangeFilter = ({ inputStartDate, setInputStartDate, inputEndDate, setInputEndDate }) => (
   <div className="row g-4">
      <div className="col-md-6">
         <div className="form-floating mb-0">
            <input
               type="date"
               className="form-control"
               value={inputStartDate}
               onChange={(e) => setInputStartDate(e.target.value)}
               aria-label="Fecha de inicio"
            />
            <label htmlFor="startDate">Fecha de inicio de filtro</label>
         </div>
      </div>
      <div className="col-md-6">
         <div className="form-floating mb-0">
            <input
               type="date"
               className="form-control"
               value={inputEndDate}
               onChange={(e) => setInputEndDate(e.target.value)}
               aria-label="Fecha final"
            />
            <label htmlFor="endDate">Fecha de final de filtro</label>
         </div>
      </div>
   </div>
);

/**
 * ModeSelector Component - Responsible for filter mode selection
 * Following Single Responsibility Principle
 */
const ModeSelector = ({ isMode, setIsMode }) => (
   <div className="row g-4">
      <div className="col-md-6">
         <div className="form-floating mb-0">
            <FilterCheckbox
               id="creationDate"
               label="FECHA DE CREACIÓN"
               checked={isMode === 1}
               onChange={(e) => setIsMode(e.target.checked ? 1 : 0)}
            />
            <FilterCheckbox
               id="lastActionDate"
               label="FECHA DE CIERRE PREVISTO"
               checked={isMode === 2}
               onChange={(e) => setIsMode(e.target.checked ? 2 : 0)}
            />
         </div>
      </div>
   </div>
);

/**
 * FilterCheckbox Component - Reusable checkbox component
 * Following Interface Segregation Principle
 */
const FilterCheckbox = ({ id, label, checked, onChange }) => (
   <div className="form-check">
      <input className="form-check-input" type="checkbox" id={id} checked={checked} onChange={onChange} />
      <label className="form-check-label" htmlFor={id}>
         {label}
      </label>
   </div>
);

/**
 * StatusToggle Component - Responsible for status toggle
 * Following Single Responsibility Principle
 */
const StatusToggle = ({ BotonesEstados, setBotonesEstados }) => (
   <div className="card-header border-bottom-0">
      <div className="d-flex">
         <button
            className={`btn ms-2 ${BotonesEstados === 1 ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => setBotonesEstados(1)}
            aria-label="Ver oportunidades inactivas"
         >
            Oportunidades Inactivas
         </button>
         <button
            className={`btn ms-2 ${BotonesEstados === 2 ? 'btn-success' : 'btn-outline-success'}`}
            onClick={() => setBotonesEstados(2)}
            aria-label="Ver oportunidades activas"
         >
            Oportunidades Activas
         </button>
         <button
            className={`btn ms-2 ${BotonesEstados === 3 ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setBotonesEstados(3)}
            aria-label="Ver todas las oportunidades"
         >
            Todas las Oportunidades
         </button>
      </div>
   </div>
);

// Refactored FilterOptions component using composition
const FilterOptions = (props) => (
   <div className="card-body border-top">
      <StatusToggle {...props} />
      <DateRangeFilter {...props} />
      <ModeSelector {...props} />
      
   </div>
);

/**
 * DataTableComponent
 * Renders the DataTable with leads data and manages row click events.
 * @param {Object} props - Props containing tableData, tableRef, and tableOptions.
 */
const DataTableComponent = ({ tableData, tableRef, tableOptions }) => (
   <div className="table-responsive">
      <div style={{ margin: "0", padding: "0.5rem" }}>
         <DataTable
            data={tableData}
            ref={tableRef}
            className="table table-striped table dt-responsive w-100 display text-left"
            options={tableOptions}
            columns={tableColumns}
         />
      </div>
   </div>
);

/**
 * useTableManager Custom Hook - Extracts table management logic
 * Following Single Responsibility Principle
 */
const useTableManager = (tableRef, tableData) => {
   useEffect(() => {
      if (tableRef.current && typeof tableRef.current.DataTable === "function") {
         const table = tableRef.current.DataTable();
         table.clear();
         table.rows.add(tableData);
         table.columns.adjust().draw();
      }
   }, [tableData]);
};

/**
 * View_oportunidad_listas Component
 * Main component following Open/Closed Principle through composition
 */
const View_oportunidad_listas = () => {
   const navigate = useNavigate();
   // Default dates for filtering (start and end of the current month)
   const { firstDay, lastDay } = getDefaultDates();

   // State management
   const [inputStartDate, setInputStartDate] = useState();
   const [inputEndDate, setInputEndDate] = useState();
   const [filterOption, setFilterOption] = useState(1); // 0: none, 1: creation date, 2: last action
   const [isMode, setIsMode] = useState(2); // Modo de filtrado (0 = por defecto)
   const [botonesEstados, setBotonesEstados] = useState(1);
   const [idOportunidad, setIdOportunidad] = useState(1);

   // Use table data hook at the top level

   const [tableData] = useTableData(true, idOportunidad, inputStartDate, inputEndDate, isMode, botonesEstados);
   const tableRef = useRef(null);

   // Table options with row click handling
   const tableOptions = {
      ...useTableOptions([0, 1, 2, 4, 5, 8, 10, 11]),
      rowCallback: function (row, data) {
         row.addEventListener("click", () => handleOpenModal(data));
      },
   };

   /**
    * Handles opening the modal with selected item data.
    * @param {Object} item - Selected item data.
    */
   const handleOpenModal = (item) => {
      navigate(`/oportunidad/ver?data=${item.entity_oport}&data2=${item.id_oportunidad_oport}`);
   };

   // Use custom hook for table management
   useTableManager(tableRef, tableData);

   return (
      <div className="card" style={{ width: "100%" }}>
         <div className="card-header table-card-header">
            <h5>LISTA COMPLETA DE OPORTUNIDADES</h5>
         </div>
         <FilterOptions
            inputStartDate={inputStartDate}
            setInputStartDate={setInputStartDate}
            inputEndDate={inputEndDate}
            setInputEndDate={setInputEndDate}
            filterOption={filterOption}
            handleCheckboxChange={setFilterOption}
            setBotonesEstados={setBotonesEstados}
            setIsMode={setIsMode}
            isMode={isMode}
            BotonesEstados={botonesEstados}
         />
         <div className="card-body" style={{ width: "100%", padding: "0" }}>
            <DataTableComponent tableData={tableData} tableRef={tableRef} tableOptions={tableOptions} />
         </div>
      </div>
   );
};

export default React.memo(View_oportunidad_listas);
