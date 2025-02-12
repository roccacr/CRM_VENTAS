import { React, useRef, useEffect, DataTable, useTableOptions, DT } from "../../leads/list/Imports/imports";
import { useTableData } from "./useTableData";
import { tableColumns } from "./tableColumns";
import "../../leads/list/Imports/style.css";
import { useState } from "react";
import ExpedienteModal from "./ExpedienteModal";

// Initialize DataTables with DT plugin
DataTable.use(DT);

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
 * ViewListExpedientes Component
 * Main component to render the complete leads list with filtering and modal functionality.
 * @component
 * @returns {JSX.Element} A complete leads management component.
 */
const ViewListExpedientes = () => {
   // State management

   // Use table data hook at the top level
   const [tableData] = useTableData(true);
   const tableRef = useRef(null);

   // Añadir estado para el modal y el expediente seleccionado
   const [modalIsOpen, setModalIsOpen] = useState(false);
   const [selectedExpediente, setSelectedExpediente] = useState(null);

   // Función para abrir el modal
   const handleOpenModal = (expediente) => {
      setSelectedExpediente(expediente);
      setModalIsOpen(true);
   };

   // Función para cerrar el modal
   const handleCloseModal = () => {
      setModalIsOpen(false);
      setSelectedExpediente(null);
   };

   // Table options with row click handling
   const tableOptions = {
      ...useTableOptions([1, 2, 3, 5]),
      rowCallback: function (row, data) {
         row.addEventListener("click", () => handleOpenModal(data));
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
         table.rows.add(tableData);
         table.columns.adjust().draw();
      }
   }, [tableData]);

   return (
      <div className="card" style={{ width: "100%" }}>
         <div className="card-header table-card-header">
            <h5>EXPEDIENTES DE UNIDADES DISPONIBLES</h5>
         </div>

         <div className="card-body" style={{ width: "100%", padding: "0" }}>
            <DataTableComponent tableData={tableData} tableRef={tableRef} tableOptions={tableOptions} />
            <ExpedienteModal isOpen={modalIsOpen} onClose={handleCloseModal} expediente={selectedExpediente}  />
         </div>
      </div>
   );
};

export default React.memo(ViewListExpedientes);
