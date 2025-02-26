import { React, useRef, useEffect, DataTable, useTableOptions, DT } from "../Imports/imports";
import { useTableData } from "./useTableData";
import { tableColumns } from "./tableColumns";
import "../Imports/style.css";
import { ModalLeads } from "../../../../pages/modal/modalLeads";
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
 * FilterOptions Component
 * Handles the rendering of date filters and filter options.
 * @param {Object} props - Props for managing date and filter option states.
 */
const FilterOptions = ({ inputStartDate, setInputStartDate, inputEndDate, setInputEndDate, filterOption, handleCheckboxChange }) => (
   <div className="card-body border-top">
      <div className="row g-4">
         <div className="col-md-6">
            <div className="form-floating mb-0">
               <input type="date" className="form-control" value={inputStartDate} onChange={(e) => setInputStartDate(e.target.value)} />
               <label htmlFor="startDate">Fecha de inicio de filtro</label>
            </div>
         </div>
         <div className="col-md-6">
            <div className="form-floating mb-0">
               <input type="date" className="form-control" value={inputEndDate} onChange={(e) => setInputEndDate(e.target.value)} />
               <label htmlFor="endDate">Fecha de final de filtro</label>
            </div>
         </div>
      </div>
      <div className="row g-4 mt-3">
         <div className="col-md-6">
            <div className="form-check">
               <input
                  className="form-check-input"
                  type="checkbox"
                  id="creationDate"
                  checked={filterOption === 1}
                  onChange={() => handleCheckboxChange(1)}
               />
               <label className="form-check-label" htmlFor="creationDate">
                  Filtrar por Fecha de Creación
               </label>
            </div>
            <div className="form-check">
               <input
                  className="form-check-input"
                  type="checkbox"
                  id="lastActionDate"
                  checked={filterOption === 2}
                  onChange={() => handleCheckboxChange(2)}
               />
               <label className="form-check-label" htmlFor="lastActionDate">
                  Filtrar por Última Acción
               </label>
            </div>
         </div>
      </div>
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
 * View_list_leads_attention Component
 * Main component to render the complete leads list with filtering and modal functionality.
 * @component
 * @returns {JSX.Element} A complete leads management component.
 */
const View_list_leads_attention = () => {
   // Default dates for filtering (start and end of the current month)
   const { firstDay, lastDay } = getDefaultDates();

   // State management
   const [inputStartDate, setInputStartDate] = useState(firstDay);
   const [inputEndDate, setInputEndDate] = useState(lastDay);
   const [filterOption, setFilterOption] = useState(1); // 0: none, 1: creation date, 2: last action

   // Use table data hook at the top level
   const [tableData] = useTableData(true, inputStartDate, inputEndDate, filterOption);
   const tableRef = useRef(null);
   const [showModal, setShowModal] = useState(false);
   const [selectedLead, setSelectedLead] = useState(null);

   // Table options with row click handling
   const tableOptions = {
      ...useTableOptions([0, 1, 3, 4, 5, 6, 11]),
      rowCallback: function (row, data) {
         row.addEventListener("click", () => handleOpenModal(data));
      },
   };

   /**
    * Handles opening the modal with selected lead data.
    * @param {Object} lead - Selected lead data.
    */
   const handleOpenModal = (lead) => {
      setSelectedLead(lead);
      setShowModal(true);
   };

   /**
    * Handles closing the modal.
    */
   const handleCloseModal = () => {
      setShowModal(false);
   };

   /**
    * Effect hook to update the DataTable whenever tableData changes.
    * Synchronizes the DataTable with the latest tableData.
    */
   useEffect(() => {
      if (tableRef.current && typeof tableRef.current.DataTable === "function") {
         const table = tableRef.current.DataTable();
         table.clear();
         table.rows.add(tableData);
         table.columns.adjust().draw();
      }
   }, [tableData]);

   return (
      <div className="card" style={{ width: "100%" }}>
         <div className="card-header table-card-header">
            <h5>LISTA COMPLETA DE LEADS QUE REQUIEREN ATENCIÓN</h5>
         </div>
         <FilterOptions
            inputStartDate={inputStartDate}
            setInputStartDate={setInputStartDate}
            inputEndDate={inputEndDate}
            setInputEndDate={setInputEndDate}
            filterOption={filterOption}
            handleCheckboxChange={setFilterOption}
         />
         <div className="card-body" style={{ width: "100%", padding: "0" }}>
            <DataTableComponent tableData={tableData} tableRef={tableRef} tableOptions={tableOptions} />
            {showModal && selectedLead && <ModalLeads leadData={selectedLead} onClose={handleCloseModal} />}
         </div>
      </div>
   );
};

export default React.memo(View_list_leads_attention);
