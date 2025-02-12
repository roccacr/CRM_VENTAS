import React, { useRef, useState, useMemo, useEffect } from "react";
import { useDispatch } from "react-redux";
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
import "./style.css";
import { getLeadsNew } from "../../../../store/leads/thunksLeads";
import shadows from "@mui/material/styles/shadows";

// Inicializa DataTables con el plugin DT
DataTable.use(DT);

/**
 * Hook personalizado para manejar el estado de los datos de la tabla
 * @returns {Array} Estado de los datos iniciales y función para actualizar
 */
const useTableData = () => {
    const dispatch = useDispatch();
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            const result = await dispatch(getLeadsNew());
            console.log(result);
            setData(result);
        };
        fetchData();
    }, [dispatch]);

    return [data, setData];
};

/**
 * Hook personalizado para generar las opciones de configuración de la tabla
 * @returns {Object} Configuración de opciones para la tabla
 */
const useTableOptions = () => {
    return useMemo(
        () => ({
            dom: "PBflrtip",
            order: [[8, "asc"]],
            paging: true, // Activa la paginación
            pageLength: 10, // Número de filas por página por defecto
            lengthMenu: [
                [10, 25, 50, 200, -1],
                [10, 25, 50, 200, "All"],
            ],
            responsive: true, // Asegura que sea responsiva
            buttons: ["excel"], // Botón de exportación
            stateSave: false, // Desactiva el guardado de estado
            processing: true,
            searchPanes: {
                show: true,
                initCollapsed: true,
                cascadePanes: true,
                controls: true,
                collapse: true, // Add this line to collapse all panes by default
                dtOpts: {
                    select: {
                        style: "multi",
                    },
                    count: {
                        show: false,
                    },
                },
                layout: "columns-3",
            },
            columnDefs: [
                // { targets: 0, visible: false, searchPanes: { show: false } },
                { targets: [0, 1, 2, 3, 4], searchPanes: { show: true } },
            ],
        }),
        [],
    );
};

/**
 * Componente AgGridTable
 * Componente principal que renderiza la tabla con todos los datos y configuraciones
 * @returns {JSX.Element} Componente de tabla con DataTables
 */
const AgGridTable = () => {
    const [tableData] = useTableData();
    const tableOptions = useTableOptions();
    const tableRef = useRef(null);

    useEffect(() => {
        if (tableRef.current && typeof tableRef.current.DataTable === "function") {
            const table = tableRef.current.DataTable();
            table.clear();
            table.rows.add(tableData);
            table.columns.adjust().draw();
        }
    }, [tableData]);

    return (
        <div style={{ margin: "0", padding: "0.5rem" }}>
            <DataTable
                data={tableData}
                ref={tableRef}
                className="table table-striped table dt-responsive w-100 display text-left"
                options={tableOptions}
                columns={[
                    { data: "nombre_lead", title: "Nombre Cliente", visible: false, defaultContent: "" },
                    { data: "idinterno_lead", title: "# NETSUITE", defaultContent: "" },
                    { data: "email_lead", title: "Correo Cliente", defaultContent: "" },
                    { data: "telefono_lead", title: "Teléfono", defaultContent: "" },
                    { data: "proyecto_lead", title: "Proyecto", defaultContent: "" },
                    { data: "campana_lead", title: "Campaña", defaultContent: "" },
                    { data: "segimineto_lead", title: "Estado", defaultContent: "" },
                    { data: "creado_lead", title: "Creado", defaultContent: "" },
                ]}
            />
        </div>
    );
};

export default React.memo(AgGridTable);
