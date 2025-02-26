import React, { useEffect, useRef } from "react";
import jQuery from "jquery";
import DataTable from "datatables.net-react";


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


const View_list_leads_attention = () => {
   const tableRef = useRef();

   const data = [
      {
         id: 1,
         nombre: "Juan Pérez",
         email: "juan@ejemplo.com",
         telefono: "123456789",
         estado: "Activo",
         fecha: "2024-03-20",
      },
      {
         id: 2,
         nombre: "María García",
         email: "maria@ejemplo.com",
         telefono: "987654321",
         estado: "Pendiente",
         fecha: "2024-03-19",
      },
      {
         id: 3,
         nombre: "Carlos López",
         email: "carlos@ejemplo.com",
         telefono: "456789123",
         estado: "Activo",
         fecha: "2024-03-18",
      },
      {
         id: 4,
         nombre: "Ana Martínez",
         email: "ana@ejemplo.com",
         telefono: "789123456",
         estado: "Inactivo",
         fecha: "2024-03-17",
      },
   ];

   useEffect(() => {
      if (!tableRef.current || jQuery.fn.DataTable.isDataTable(tableRef.current)) return;
   
      const table = jQuery(tableRef.current).DataTable({
         stateSave: true,
         data: data,
         dom: 'lPBfrtip',
         buttons: [
            {
               extend: 'excel',
               text: 'Exportar a Excel',
               className: 'btn btn-success',
               exportOptions: {
                  columns: ':visible'
               }
            }
         ],
         searchPanes: {
            layout: 'columns-3',
            initCollapsed: true,
            cascadePanes: true,
            controls: true,
            dtOpts: {
               select: {
                  style: 'multi'
               }
            }
         },
         columns: [
            { data: "id", title: "ID" },
            { data: "nombre", title: "Nombre" },
            { data: "email", title: "Email" },
            { data: "telefono", title: "Teléfono" },
            { data: "estado", title: "Estado" },
            { data: "fecha", title: "Fecha" }
         ],
         responsive: true
      });
   
      return () => {
         if (jQuery.fn.DataTable.isDataTable(tableRef.current)) {
            table.destroy();
         }
      };
   }, []);
   
   

   return (
      <div className="container mt-4">
         <h2>Lista de Leads</h2>
         <table ref={tableRef} className="table table-striped table-bordered display responsive nowrap" style={{ width: "100%" }}>
            <thead>
               <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Fecha</th>
               </tr>
            </thead>
            <tbody></tbody>
         </table>
      </div>
   );
};

export default View_list_leads_attention;
