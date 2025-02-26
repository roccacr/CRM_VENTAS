import { React, useRef, useEffect, DataTable, useTableOptions, DT } from "../../leads/list/Imports/imports";
import { useTableData } from "./useTableData";
import { useNavigate, useSearchParams } from 'react-router-dom';

import "../../leads/list/Imports/style.css";
import { useState } from "react";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { tableColumns } from "./tableColumns";
import { ModalLeads } from "../../../pages/modal/modalLeads";
import Swal from "sweetalert2";

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
 * View_events_listado  Component
 * Main component to render the complete leads list with filtering and modal functionality.
 * @component
 * @returns {JSX.Element} A complete leads management component.
 */
const View_events_listado  = () => {
   // Default dates for filtering (start and end of the current month)
   const { firstDay, lastDay } = getDefaultDates();

   // State management
   const [inputStartDate, setInputStartDate] = useState(firstDay);
   const [inputEndDate, setInputEndDate] = useState(lastDay);
   const [filterOption, setFilterOption] = useState(1); // 0: none, 1: creation date, 2: last action

   // Añadir useSearchParams para leer parámetros de URL
   const [searchParams] = useSearchParams();

   // Use table data hook at the top level
   const [tableData] = useTableData(true, inputStartDate, inputEndDate);
   
   // Filtrar los datos según el parámetro URL y la fecha actual
   const filteredTableData = React.useMemo(() => {
      if (!tableData) return [];
      
      const dataParam = searchParams.get('data');
      
      // Obtener fecha actual en zona horaria de Costa Rica
      const today = new Date().toLocaleString('en-US', { 
         timeZone: 'America/Costa_Rica',
         year: 'numeric',
         month: '2-digit',
         day: '2-digit'
      }).split('/');
      
      // Formatear a YYYY-MM-DD (corregido el orden)
      const formattedToday = `${today[2]}-${today[0].padStart(2, '0')}-${today[1].padStart(2, '0')}`;

      let filtered = tableData;
      
      if (dataParam === '1') {
         filtered = filtered.filter(item => item.cita_lead === 1);
         
         // Filtrar por fecha actual, comparando solo la parte YYYY-MM-DD
         filtered = filtered.filter(item => {
            const itemDate = item.fechaIni_calendar.split('T')[0];
            return itemDate === formattedToday;
         });
      }
      
      return filtered;
   }, [tableData, searchParams]);

   console.log("tableData", tableData);
   const tableRef = useRef(null);

   // State to manage modal visibility and selected lead data
   const [selectedLead, setSelectedLead] = useState(null);

   // State to prevent multiple modal openings
   const [isModalOpen, setIsModalOpen] = useState(false);

   const navigate = useNavigate();

   const handleOpenModal = (lead) => {
      if (lead.idinterno_lead > "0") {
         Swal.fire({
            title: "¿Qué desea hacer?",
            text: "Este evento tiene un lead asignado",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Ir al evento",
            cancelButtonText: "Abrir información del cliente",
         }).then((result) => {
            if (result.isConfirmed) {
               setSelectedLead(null);
               navigate(`/events/actions?idCalendar=${lead.id_calendar}&idLead=${lead.idinterno_lead}&idDate=0`);
            } else if (result.dismiss === Swal.DismissReason.cancel) {
               setSelectedLead(lead);
            }
            setIsModalOpen(false); // Reset modal open state
         });
         return false;
      } else {
         Swal.fire({
            title: "No se puede abrir el modal",
            text: "Este evento no tiene un lead asignado",
            icon: "error",
         }).finally(() => {
            setIsModalOpen(false); // Reset modal open state
         });
         return false;
      }

      return false;
   };

   const handleCloseModal = () => {
      setSelectedLead(null);
   };

   // Table options with row click handling
   const tableOptions = {
      ...useTableOptions([0,1,2,5,6,7,8,9]),
      rowCallback: function (row, data) {
         row.addEventListener("click", () => handleOpenModal(data));
         return false;
      },
   };

   /**
    * Effect hook to update the DataTable whenever tableData changes.
    * Synchronizes the DataTable with the latest tableData.
    */
   useEffect(() => {
      if (tableRef.current && typeof tableRef.current.DataTable === "function") {
         const table = tableRef.current.DataTable();
         table.clear();
         table.rows.add(filteredTableData);
         table.columns.adjust().draw();

         // Remove previous event listeners to prevent multiple triggers
         table.off('click', 'tr');

         // Add new event listener for row clicks
         table.on('click', 'tr', function (event) {
            event.stopPropagation(); // Stop further propagation of the click event
            const data = table.row(this).data();
            handleOpenModal(data);
         });
      }

      // Cleanup function to remove event listeners when component unmounts or before re-running effect
      return () => {
         if (tableRef.current && typeof tableRef.current.DataTable === "function") {
            const table = tableRef.current.DataTable();
            table.off('click', 'tr');
         }
      };
   }, [filteredTableData]);

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
            <DataTableComponent 
               tableData={filteredTableData}
               tableRef={tableRef} 
               tableOptions={tableOptions} 
            />
         </div>
         {selectedLead && (
            <ModalLeads leadData={selectedLead} onClose={handleCloseModal} />
         )}
      </div>
   );
};

export default React.memo(View_events_listado);
