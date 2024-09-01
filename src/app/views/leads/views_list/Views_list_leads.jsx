import PropTypes from "prop-types";
import { useEffect } from "react";
import $ from "jquery";
import "datatables.net-bs4";
import "datatables.net-select";
import "datatables.net-select-bs4";
import "datatables.net-buttons";
import "datatables.net-buttons-bs4";
import "datatables.net-buttons/js/buttons.html5";
import "datatables.net-buttons/js/buttons.print";
import "datatables.net-searchpanes";
import "datatables.net-searchpanes-bs4";
import { columns } from "./columns";
import clientData from "./clientData.json";

export const Views_list_leads = () => {
    useEffect(() => {
        // Incluye los estilos desde las URLs CDN
        const link1 = document.createElement("link");
        link1.rel = "stylesheet";
        link1.href = "https://cdn.datatables.net/2.1.5/css/dataTables.dataTables.css";
        document.head.appendChild(link1);

        const link2 = document.createElement("link");
        link2.rel = "stylesheet";
        link2.href = "https://cdn.datatables.net/searchpanes/2.3.2/css/searchPanes.dataTables.css";
        document.head.appendChild(link2);

        const link3 = document.createElement("link");
        link3.rel = "stylesheet";
        link3.href = "https://cdn.datatables.net/select/2.0.5/css/select.dataTables.css";
        document.head.appendChild(link3);

        const link4 = document.createElement("link");
        link4.rel = "stylesheet";
        link4.href = "https://cdn.datatables.net/buttons/3.1.2/css/buttons.dataTables.css";
        document.head.appendChild(link4);

        // Inicializar DataTable
        const table = $("#single-select").DataTable({
            processing: true,
            searchPanes: {
                cascadePanes: true,
                dtOpts: {
                    select: {
                        style: "multi",
                    },
                    order: [[0, "asc"]],
                },
                viewTotal: true,
            },
            dom: 'P<"clear">Bfrtip',
            buttons: [
                {
                    extend: "excel",
                    footer: true,
                    titleAttr: "Exportar a excel",
                    className: "btn btn-success",
                    exportOptions: {
                        columns: [0],
                    },
                },
            ],
            data: clientData,
            columns: columns,
            columnDefs: [
                {
                    searchPanes: {
                        show: true,
                    },
                    targets: [0, 1, 2], // Ajusta estos índices según las columnas que deseas mostrar en los searchPanes
                },
            ],
            stateSave: true,
            pageLength: 25,
            lengthMenu: [
                [10, 25, 50, 200, -1],
                [10, 25, 50, 200, "All"],
            ],
            language: {
                decimal: ",",
                thousands: ".",
                lengthMenu: "Mostrar _MENU_ registros",
                zeroRecords: "No se encontraron resultados",
                info: "Mostrando registros del _START_ al _END_ de un total de _TOTAL_ registros",
                infoEmpty: "Mostrando registros del 0 al 0 de un total de 0 registros",
                infoFiltered: "(filtrado de un total de _MAX_ registros)",
                sSearch: "Buscar:",
                oPaginate: {
                    sFirst: "Primero",
                    sLast: "Último",
                    sNext: "Siguiente",
                    sPrevious: "Anterior",
                },
                sProcessing: "Cargando...",
            },
        });

        // Manejo de eventos en la tabla
        $("#single-select tbody").on("click", ".btn-alert", function () {
            const id = $(this).data("id");
            alert(`ID seleccionado: ${id}`);
        });

        return () => {
            table.destroy();
            // Remover los estilos cuando el componente se desmonte
            document.head.removeChild(link1);
            document.head.removeChild(link2);
            document.head.removeChild(link3);
            document.head.removeChild(link4);
        };
    }, []);

    return (
        <div className="card">
            <div className="card-header table-card-header">
                <h5>HTML5 Export Buttons with SearchPanes</h5>
                <small>This example demonstrates the use of DataTables with SearchPanes and export buttons.</small>
            </div>
            <div className="card-body">
                <div className="dt-responsive table-responsive">
                    <div id="searchPanes" className="dtsp-panesContainer"></div>
                    <div id="basic-btn_wrapper" className="dt-container dt-bootstrap5">
                        <table id="single-select" className="table-bordered table dt-responsive w-100 display" style={{ fontSize: "15px", width: "100%" }}>
                            <thead>
                                <tr>
                                    {columns.map((column, index) => (
                                        <th key={index}>{column.title}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody />
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
