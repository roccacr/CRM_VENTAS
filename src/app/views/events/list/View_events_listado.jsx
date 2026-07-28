import { useSearchParams } from "react-router-dom";
import { DataTable, DT, React, useEffect, useRef, useTableOptions } from "../../leads/list/Imports/imports";
import { useTableData } from "./useTableData";

import { useState } from "react";
import { LeadOutlookCreateEventModal } from "../../../pages/modal/components/LeadOutlookCreateEventModal";
import "../../leads/list/Imports/style.css";
import { filterTodayPendingEvents, getEventListRequestRange } from "./eventListUtils";
import { tableColumns } from "./tableColumns";

DataTable.use(DT);

/**
 * Obtiene primer y ultimo dia del mes actual.
 *
 * @returns {{ firstDay: string, lastDay: string }} Rango por defecto en formato YYYY-MM-DD.
 */
const getDefaultDates = () => {
   const now = new Date();
   const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
   const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

   return { firstDay, lastDay };
};

/**
 * Renderiza filtros superiores.
 *
 * @param {Object} props - Props de filtros.
 * @returns {JSX.Element} Filtros.
 */
const FilterOptions = ({
   inputStartDate,
   setInputStartDate,
   inputEndDate,
   setInputEndDate,
   filterOption,
   handleCheckboxChange,
   onResetFilters,
}) => (
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
            <button className="btn btn-outline-danger" onClick={onResetFilters} type="button">
               Restablecer fechas por defecto
            </button>
         </div>
      </div>
   </div>
);

/**
 * Renderiza tabla de eventos.
 *
 * @param {Object} props - Props de tabla.
 * @returns {JSX.Element} Tabla.
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
 * Lista completa de eventos con apertura directa de modal edición.
 *
 * @returns {JSX.Element} Vista listado.
 */
const View_events_listado = () => {
   const { firstDay, lastDay } = getDefaultDates();

   const [inputStartDate, setInputStartDate] = useState(localStorage.getItem("inputStartDate") || firstDay);
   const [inputEndDate, setInputEndDate] = useState(localStorage.getItem("inputEndDate") || lastDay);
   const [filterOption, setFilterOption] = useState(1);
   const [selectedEvent, setSelectedEvent] = useState(null);
   const [searchParams] = useSearchParams();
   const todayDate = React.useMemo(() => {
      const today = new Date()
         .toLocaleString("en-US", {
            timeZone: "America/Costa_Rica",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
         })
         .split("/");

      return `${today[2]}-${today[0].padStart(2, "0")}-${today[1].padStart(2, "0")}`;
   }, []);
   const dataParam = searchParams.get("data");
   const requestRange = React.useMemo(() => getEventListRequestRange({
      dataParam,
      defaultStartDate: inputStartDate,
      defaultEndDate: inputEndDate,
      todayDate,
   }), [dataParam, inputEndDate, inputStartDate, todayDate]);
   const [tableData] = useTableData(true, requestRange.dateStart, requestRange.dateEnd);

   const filteredTableData = React.useMemo(
      () => filterTodayPendingEvents(tableData, dataParam, todayDate),
      [dataParam, tableData, todayDate],
   );

   const tableRef = useRef(null);

   /**
    * Persiste fecha inicio.
    *
    * @param {string} value - Fecha seleccionada.
    * @returns {void}
    */
   const handleStartDateChange = (value) => {
      setInputStartDate(value);
      localStorage.setItem("inputStartDate", value);
   };

   /**
    * Persiste fecha fin.
    *
    * @param {string} value - Fecha seleccionada.
    * @returns {void}
    */
   const handleEndDateChange = (value) => {
      setInputEndDate(value);
      localStorage.setItem("inputEndDate", value);
   };

   /**
    * Restablece filtros por defecto.
    *
    * @returns {void}
    */
   const handleResetFilters = () => {
      localStorage.removeItem("inputStartDate");
      localStorage.removeItem("inputEndDate");
      setInputStartDate(firstDay);
      setInputEndDate(lastDay);
   };

   /**
    * Abre modal edición nuevo.
    *
    * @param {Object} eventItem - Evento seleccionado.
    * @returns {void}
    */
   const handleOpenModal = (eventItem) => {
      setSelectedEvent(eventItem);
   };

   /**
    * Cierra modal edición.
    *
    * @returns {void}
    */
   const handleCloseModal = () => {
      setSelectedEvent(null);
   };

   const tableOptions = {
      ...useTableOptions([0, 1, 2, 5, 6, 8, 9]),
      rowCallback: function (row, data) {
         row.addEventListener("click", () => handleOpenModal(data));
         return false;
      },
   };

   useEffect(() => {
      if (tableRef.current && typeof tableRef.current.DataTable === "function") {
         const table = tableRef.current.DataTable();
         table.clear();
         table.rows.add(filteredTableData);
         table.columns.adjust().draw();
         table.off("click", "tr");
         table.on("click", "tr", function (event) {
            event.stopPropagation();
            const data = table.row(this).data();
            handleOpenModal(data);
         });
      }

      return () => {
         if (tableRef.current && typeof tableRef.current.DataTable === "function") {
            tableRef.current.DataTable().off("click", "tr");
         }
      };
   }, [filteredTableData]);

   return (
      <div className="card" style={{ width: "100%" }}>
         <div className="card-header table-card-header">
            <h5>LISTA COMPLETA DE EVENTOS QUE REQUIEREN ATENCION</h5>
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
         {selectedEvent && (
            <LeadOutlookCreateEventModal
               initialLead={selectedEvent}
               initialEventData={selectedEvent}
               initialEventId={selectedEvent.id_calendar}
               isOpen={Boolean(selectedEvent)}
               mode="edit"
               onClose={handleCloseModal}
            />
         )}
      </div>
   );
};

export default React.memo(View_events_listado);
