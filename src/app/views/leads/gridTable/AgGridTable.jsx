import React, { useRef, useState } from 'react';
import DataTable from 'datatables.net-react';

import DT from 'datatables.net-dt';
import 'datatables.net-bs5';
import 'datatables.net-select-dt';
import 'datatables.net-select-bs5';
import 'datatables.net-responsive-dt';
import 'datatables.net-searchpanes-dt';
import 'datatables.net-searchpanes-bs5';

DataTable.use(DT);

const AgGridTable = () => {
  const [tableData, setTableData] = useState([
    ['Tiger Nixon', 'System Architect'],
    ['Garrett Winters', 'Accountant'],
    ['Ashton Cox', 'Junior Technical Author'],
    ['Cedric Kelly', 'Senior Javascript Developer'],
  ]);

  const table = useRef();

  return (
    <DataTable
      data={tableData}
      ref={table}
      className=""
      options={{
        dom: 'Pfrtip', // SearchPanes incluido
        responsive: true, // Opcional para mejor diseño
        searchPanes: {
          cascadePanes: true,
          viewTotal: true,
        },
        columnDefs: [
          { targets: '_all', searchPanes: { show: true } }, // Habilita SearchPanes en todas las columnas
        ],
      }}
    >
      <thead>
        <tr>
          <th>Name</th>
          <th>Position</th>
        </tr>
      </thead>
    </DataTable>
  );
};

export default AgGridTable;
