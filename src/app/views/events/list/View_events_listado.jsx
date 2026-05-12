import { useNavigate, useSearchParams } from 'react-router-dom';
import { DataTable, DT, React, useEffect, useRef, useTableOptions } from "../../leads/list/Imports/imports";
import { useTableData } from "./useTableData";

import { useState } from "react";
import Swal from "sweetalert2";
import { ModalLeads } from "../../../pages/modal/modalLeads";
import "../../leads/list/Imports/style.css";
import { tableColumns } from "./tableColumns";

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
const FilterOptions = ({ inputStartDate, setInputStartDate, inputEndDate, setInputEndDate, filterOption, handleCheckboxChange, onResetFilters }) => (
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
            <button
               className="btn btn-outline-danger"
               onClick={onResetFilters}
               type="button"
            >
               Restablecer fechas por defecto
            </button>
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
const View_events_listado = () => {
   // Default dates for filtering (start and end of the current month)
   const { firstDay, lastDay } = getDefaultDates();

   // State management - recuperar de localStorage si existe
   const [inputStartDate, setInputStartDate] = useState(
      localStorage.getItem('inputStartDate') || firstDay
   );
   const [inputEndDate, setInputEndDate] = useState(
      localStorage.getItem('inputEndDate') || lastDay
   );
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

      if (dataParam === '1' || dataParam === 1) {

         filtered = filtered.filter(item => {
            const itemDate = item.fechaIni_calendar.split('T')[0];
            return itemDate === formattedToday && item.accion_calendar === "Pendiente";
         });
      }



      return filtered;
   }, [tableData, searchParams]);

   const tableRef = useRef(null);

   // State to manage modal visibility and selected lead data
   const [selectedLead, setSelectedLead] = useState(null);

   // State to prevent multiple modal openings
   const [isModalOpen, setIsModalOpen] = useState(false);

   const navigate = useNavigate();

   /**
    * Actualiza la fecha de inicio y la guarda en localStorage
    * @param {string} value - Nueva fecha de inicio
    */
   const handleStartDateChange = (value) => {
      setInputStartDate(value);
      localStorage.setItem('inputStartDate', value);
   };

   /**
    * Actualiza la fecha final y la guarda en localStorage
    * @param {string} value - Nueva fecha final
    */
   const handleEndDateChange = (value) => {
      setInputEndDate(value);
      localStorage.setItem('inputEndDate', value);
   };

   /**
    * Reinicia los filtros de fecha a los valores por defecto y elimina datos en localStorage
    */
   const handleResetFilters = () => {
      // Eliminar valores del localStorage
      localStorage.removeItem('inputStartDate');
      localStorage.removeItem('inputEndDate');

      // Restaurar valores predeterminados
      setInputStartDate(firstDay);
      setInputEndDate(lastDay);
   };

   const handleOpenModal = (lead) => {
      Swal.fire({
         title: "¿Qué desea hacer?",
         text: "Quieres ir a este evento?",
         icon: "warning",
         showCancelButton: true,
         confirmButtonColor: "#3085d6",
         cancelButtonColor: "#d33",
         confirmButtonText: "Ir al evento",
         cancelButtonText: "Cancelar",
      }).then((result) => {
         if (result.isConfirmed) {

            navigate(`/events/actions?idCalendar=${lead.id_calendar}&idLead=${lead.idinterno_lead}&idDate=0`);
         }
      });
   };

   const handleCloseModal = () => {
      setSelectedLead(null);
   };

   // Table options with row click handling
   const tableOptions = {
      ...useTableOptions([0, 1, 2, 5, 6, 8, 9]),
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
            <h5>LISTA COMPLETA DE EVENTOS QUE REQUIEREN ATENCIÓN</h5>
         </div>
         <FilterOptions
            inputStartDate={inputStartDate}
            setInputStartDate={handleStartDateChange}
            inputEndDate={inputEndDate}
            setInputEndDate={handleEndDateChange}
            filterOption={filterOption}
            handleCheckboxChange={setFilterOption}
            onResetFilters={handleResetFilters}
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
