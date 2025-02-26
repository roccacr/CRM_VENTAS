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
import 'moment';
import 'datatables.net-react';
import  'datatables.net-bs5';
import 'datatables.net-autofill-bs5';
import 'datatables.net-buttons-bs5';
import 'datatables.net-buttons/js/buttons.colVis.mjs';
import 'datatables.net-buttons/js/buttons.html5.mjs';
import 'datatables.net-buttons/js/buttons.print.mjs';
import 'datatables.net-colreorder-bs5';
import 'datatables.net-fixedcolumns-bs5';
import 'datatables.net-fixedheader-bs5';
import 'datatables.net-keytable-bs5';
import 'datatables.net-responsive-bs5';
import 'datatables.net-rowgroup-bs5';
import 'datatables.net-rowreorder-bs5';
import 'datatables.net-scroller-bs5';
import 'datatables.net-searchbuilder-bs5';
import 'datatables.net-searchpanes-bs5';
import 'datatables.net-select-bs5';
import 'datatables.net-staterestore-bs5';
 


import { useTableOptions } from "../../gridTable/useTableOptions";
// Inicializar DataTables
DataTable.use(DT);





// Exportar todo lo que necesitamos
export { React, useRef, useEffect, DataTable, useTableOptions, DT };
