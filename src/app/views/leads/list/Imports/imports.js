import React, { useRef, useEffect } from "react";
import DataTable from "datatables.net-react";
import DT from "datatables.net-dt";
import "datatables.net-bs5";
import "datatables.net-select-dt";
import "datatables.net-select-bs5";
import "datatables.net-responsive-dt";
import "datatables.net-searchpanes-dt";
import "datatables.net-searchpanes-bs5";
import "datatables.net-buttons";
import "datatables.net-buttons-bs5";
import "datatables.net-buttons/js/buttons.html5";
import "jszip";
import "pdfmake";
import { useTableOptions } from "../../gridTable/useTableOptions";
// Inicializar DataTables
DataTable.use(DT);
// Exportar todo lo que necesitamos
export { React, useRef, useEffect, DataTable, useTableOptions, DT };
