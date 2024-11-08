import { useEffect, useState } from "react";
import { useDataTable } from "../../../../../hook/useDataTable";
import { useDispatch } from "react-redux";
import { getLeadsNew } from "../../../../../store/leads/thunksLeads";

export default function View_list_leads_new() {
    const [data, setTableData] = useState([]); // Guarda todos los registros
    const dispatch = useDispatch();

    // Función para obtener datos y guardarlos en el estado
    const fetchData = async () => {
        const result = await dispatch(getLeadsNew());
        setTableData(result); // Guardamos todos los registros en tableData
    };

    // Ejecuta fetchData al cargar el componente
    useEffect(() => {
        fetchData();
    }, []); // Sin dependencias, solo se ejecuta en montaje

    // Configuración de las columnas
    // Configuración de las columnas
    const columnsConfig = [
        { title: "Asesor", data: "name_admin" },
        { title: "Nombre Cliente", data: "nombre_lead" },
        { title: "# NETSUITE", data: "idinterno_lead" },
        { title: "Correo Cliente", data: "email_lead" },
        { title: "Teléfono", data: "telefono_lead" },
        { title: "Proyecto", data: "proyecto_lead" },
        { title: "Campaña", data: "campana_lead" },
        { title: "Estado", data: "segimineto_lead" },
        { title: "Creado", data: "creado_lead" },
    ];

    // Columnas para las search panes
    const searchColumns = [0, 1, 2, 3, 4, 5, 6, 7]; // Índices de las columnas a buscar

    // Columnas para exportar a Excel
    const dataExcel = [0, 1, 2, 3]; // Todas las columnas en este caso

    // Columnas a ocultar (si es necesario)
    const disguise = [2]; // Por ejemplo, oculta la columna "Email"

    // Función para manejar el clic en las filas
    const onRowClick = (rowData) => {
        console.log("Datos de la fila seleccionada:", rowData);
    };

    // Llamada al hook personalizado `useDataTable`
    useDataTable(data, columnsConfig, onRowClick, searchColumns, dataExcel, disguise);

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>MÓDULO DE LEADS NUEVOS</h5>
            </div>
            <div className="card-body" style={{ width: "100%", padding: "0" }}>
                <div className="table-responsive">
                    <div className="card-header table-card-header">
                        <table id="tableDinamic" className="table table-striped table dt-responsive w-100 display text-left" style={{ fontSize: "15px", width: "100%", textAlign: "left" }}>
                            <thead>
                                <tr>
                                    <th>Asesor</th>
                                    <th>Nombre Cliente</th>
                                    <th># NETSUITE</th>
                                    <th>Correo Cliente</th>
                                    <th>Teléfono</th>
                                    <th>Proyecto</th>
                                    <th>Campaña</th>
                                    <th>Estado</th>
                                    <th>Creado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((lead) => (
                                    <tr key={lead.idinterno_lead}>
                                        <td>{lead.name_admin}</td> {/* Asesor */}
                                        <td>{lead.nombre_lead}</td> {/* Nombre Cliente */}
                                        <td>{lead.idinterno_lead}</td> {/* # NETSUITE */}
                                        <td>{lead.email_lead}</td> {/* Correo Cliente */}
                                        <td>{lead.telefono_lead}</td> {/* Teléfono */}
                                        <td>{lead.proyecto_lead}</td> {/* Proyecto */}
                                        <td>{lead.campana_lead}</td> {/* Campaña */}
                                        <td>{lead.segimineto_lead}</td> {/* Estado */}
                                        <td>{lead.creado_lead}</td> {/* Creado */}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
