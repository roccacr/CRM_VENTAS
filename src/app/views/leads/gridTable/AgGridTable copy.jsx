import React, { useRef, useState, useMemo } from 'react';
import DataTable from 'datatables.net-react';
import DT from 'datatables.net-dt';
import 'datatables.net-bs5';
import 'datatables.net-select-dt';
import 'datatables.net-select-bs5';
import 'datatables.net-responsive-dt';
import 'datatables.net-searchpanes-dt';
import 'datatables.net-searchpanes-bs5';
import 'datatables.net-buttons';
import 'datatables.net-buttons-bs5';
import 'datatables.net-buttons/js/buttons.html5';
import 'jszip';
import 'pdfmake';
import './style.css';

// Initialize DataTable with DT plugin
DataTable.use(DT);

/**
 * TableHeader Component
 * Memoized component to render table headers
 * @returns {JSX.Element} Table header structure
 */
const TableHeader = React.memo(() => (
  <thead>
    <tr>
      <th scope="col">Nombre</th>
      <th scope="col">Apellido</th>
    </tr>
  </thead>
));

/**
 * useTableData Hook
 * Custom hook to manage table data state
 * @returns {Array} Initial table data
 */
const useTableData = () => {
  return useState([
    { nombre: 'Tiger Nixon', position: 'System Architect', apellido: 'Nixon' },
    { nombre: 'Tiger Nixon', position: 'System Architect', apellido: 'Nixon' },
    { nombre: 'Garrett Winters', position: 'Accountant', apellido: 'Winters' },
    { nombre: 'Ashton Cox', position: 'Junior Technical Author', apellido: 'Cox' },
    { nombre: 'Cedric Kelly', position: 'Senior Javascript Developer', apellido: 'Kelly' },
  ]);
};

/**
 * useTableOptions Hook
 * Memoized hook to generate table configuration
 * @returns {Object} Table options configuration
 */
const useTableOptions = () => {
  return useMemo(() => ({
    dom: 'PBfrtip',
    responsive: true,
    buttons: ['excel'],
    stateSave: true,
    searchPanes: {
      cascadePanes: true,
      controls: true
    },
    columnDefs: [
      { targets: 2, visible: false, searchPanes: { show: false } }, // Oculta la columna "Position" y la quita de searchPanes
      { targets: [0, 1], searchPanes: { show: true } } // Solo aplica SearchPanes a las columnas visibles
    ],
  }), []);
};

/**
 * AgGridTable Component
 * Main component to render the data table
 * @returns {JSX.Element} Table component with all configurations
 */
const AgGridTable = () => {
  const [tableData] = useTableData();
  const tableOptions = useTableOptions();
  const tableRef = useRef();

  return (
    <div role="grid" aria-label="Leads Table">
      <DataTable
        data={tableData}
        ref={tableRef}
        className="table table-striped table dt-responsive w-100 display text-left"
        options={tableOptions}
        columns={[
          { data: 'nombre', title: 'Nombre' },
          { data: 'apellido', title: 'Apellido' },
          { data: 'position', title: 'Position', visible: false }
        ]}
      >
        <TableHeader />
      </DataTable>
    </div>
  );
};

export default React.memo(AgGridTable);
