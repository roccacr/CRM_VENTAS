import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import { getLeadsAttention } from "../../../../../store/leads/thunksLeads";
import { ModalLeads } from "../../../../pages/modal/modalLeads";
import { columnsConfig } from "./columnsConfig";
import * as XLSX from "xlsx"; // Importamos la librería para generar el archivo Excel
import "./styles.css"; // Importar los estilos responsivos

// Función para obtener fechas por defecto (inicio y fin del mes actual)
const getDefaultDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    return { firstDay, lastDay };
};

// Función para obtener valores únicos de una columna
const getUniqueValues = (data, key) => {
    return [...new Set(data.map((item) => item[key]))];
};

// Para crear las opciones del select
const createSelectOptions = (items) => {
    return items.map((item) => ({ label: item, value: item }));
};

export default function View_list_leads_attention() {
    const dispatch = useDispatch();
    const animatedComponents = makeAnimated();

    // Fechas por defecto (inicio y fin del mes)
    const { firstDay, lastDay } = getDefaultDates();

    // Estado para detectar si es móvil
    const [isMobile, setIsMobile] = useState(false);

    // Estado para manejar la apertura del acordeón en modo móvil
    const [accordionOpen, setAccordionOpen] = useState(false);

    // Detectar si el modo es móvil o no
    useEffect(() => {
        const handleResize = () => {
            if (window.matchMedia("(max-width: 768px)").matches) {
                setIsMobile(true);
            } else {
                setIsMobile(false);
            }
        };

        // Comprobar la pantalla en el inicio y cada vez que cambie su tamaño
        handleResize();
        window.addEventListener("resize", handleResize);

        // Cleanup
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    // Estado para los filtros de fecha
    const [inputStartDate, setInputStartDate] = useState(firstDay);
    const [inputEndDate, setInputEndDate] = useState(lastDay);

    // Estado para los filtros de búsqueda y select (inicializados vacíos)
    const [searchFilters, setSearchFilters] = useState({
        name_admin: [],
        nombre_lead: "",
        email_lead: "",
        telefono_lead: "",
        proyecto_lead: [],
        campana_lead: [],
        segimineto_lead: [],
        subsidiaria_lead: [],
    });

    // Estado para los datos de la tabla
    const [tableData, setTableData] = useState([]); // Contiene todos los registros
    const [filteredData, setFilteredData] = useState([]); // Contiene los registros filtrados
    const [selectedLead, setSelectedLead] = useState(null); // Para el modal
    const [showModal, setShowModal] = useState(false); // Mostrar modal
    const [isLoading, setIsLoading] = useState(false); // Preloader activado/desactivado

    // Estado para la paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10); // Estado para el número de filas por página

    // Estado para los checkboxes de filtrado
    const [filterOption, setFilterOption] = useState(0); // 0: ninguno, 1: fecha creación, 2: última acción

    // Función para manejar el clic en una fila de la tabla
    const handleRowClick = (data) => {
        setSelectedLead(data);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
    };

    // Calcular los datos de la tabla con paginación
    const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    // Función para traer los datos de acuerdo a las fechas seleccionadas y el filtro
    const fetchData = async (startDate, endDate, filterOption) => {
        setIsLoading(true); // Activa el preloader al inicio
        const result = await dispatch(getLeadsAttention(startDate, endDate, filterOption));
        setTableData(result); // Guardamos todos los registros en tableData
        setFilteredData(result); // Inicializamos filteredData con todos los registros al inicio
        setIsLoading(false); // Desactiva el preloader cuando se carguen los datos
    };

    // Obtener datos cuando se cambian las fechas o el filtro de los checkboxes
    useEffect(() => {
        fetchData(inputStartDate, inputEndDate, filterOption);
    }, [inputStartDate, inputEndDate, filterOption]);

    const uniqueAdmins = createSelectOptions(getUniqueValues(tableData, "name_admin"));
    const uniqueProjects = createSelectOptions(getUniqueValues(tableData, "proyecto_lead"));
    const uniqueCampaigns = createSelectOptions(getUniqueValues(tableData, "campana_lead"));
    const uniqueStatuses = createSelectOptions(getUniqueValues(tableData, "segimineto_lead"));
    const uniqueSubsidiaries = createSelectOptions(getUniqueValues(tableData, "subsidiaria_lead"));

    // Filtrar datos basados en los filtros de búsqueda y select
    useEffect(() => {
        const filterData = () => {
            let filtered = tableData.filter((row) => {
                return (
                    (searchFilters.name_admin.length === 0 || searchFilters.name_admin.map((p) => p.value).includes(row.name_admin)) &&
                    row.nombre_lead.toLowerCase().includes(searchFilters.nombre_lead.toLowerCase()) &&
                    row.email_lead.toLowerCase().includes(searchFilters.email_lead.toLowerCase()) &&
                    row.telefono_lead.toLowerCase().includes(searchFilters.telefono_lead.toLowerCase()) &&
                    (searchFilters.proyecto_lead.length === 0 || searchFilters.proyecto_lead.map((p) => p.value).includes(row.proyecto_lead)) &&
                    (searchFilters.campana_lead.length === 0 || searchFilters.campana_lead.map((p) => p.value).includes(row.campana_lead)) &&
                    (searchFilters.segimineto_lead.length === 0 || searchFilters.segimineto_lead.map((p) => p.value).includes(row.segimineto_lead)) &&
                    (searchFilters.subsidiaria_lead.length === 0 || searchFilters.subsidiaria_lead.map((p) => p.value).includes(row.subsidiaria_lead))
                );
            });

            setFilteredData(filtered);
        };

        // Si hay datos en tableData, aplicamos el filtro
        if (tableData.length > 0) {
            filterData();
        }
    }, [searchFilters, tableData]); // Cuando cambian los filtros o los datos originales

    // Función para manejar los checkboxes
    const handleCheckboxChange = (option) => {
        setFilterOption(option);
    };

    // Función para exportar los datos a Excel
    const handleExportToExcel = () => {
        const columnsToExport = [
            "name_admin", // ASESOR
            "nombre_lead", // Nombre Cliente
            "idinterno_lead", // # NETSUITE
            "email_lead", // Correo Cliente
            "telefono_lead", // Teléfono
            "proyecto_lead", // Proyecto
            "campana_lead", // Campaña
            "segimineto_lead", // Estado
            "creado_lead", // Creado
            "subsidiaria_lead", // Subsidiarias
            "actualizadaaccion_lead", // Última Acción
            "nombre_caida", // Seguimiento
            "estado_lead", // Estado Lead
        ];

        const dataToExport = filteredData.map((row) => {
            let filteredRow = {};
            columnsToExport.forEach((col) => {
                filteredRow[col] = row[col];
            });
            return filteredRow;
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Leads");
        XLSX.writeFile(wb, "Leads_Attention.xlsx");
    };

    // Función para renderizar la tabla
    const renderTable = () => {
        const columnsToHide = [
            "name_admin", // Asesor
            "idinterno_lead", // # Netsuite
            "proyecto_lead", // Proyecto
            "campana_lead", // Campaña
            "segimineto_lead", // Estado
            "nombre_caida", // Seguimiento
            "estado_lead", // Estado Lead
        ];

        return (
            <div className="table-responsive">
                <table className="table table-striped">
                    <thead>
                        <tr>
                            {columnsConfig.map((column, index) => {
                                if (!columnsToHide.includes(column.data)) {
                                    if ((filterOption === 1 && column.data === "creado_lead") || (filterOption === 2 && column.data === "actualizadaaccion_lead") || (column.data !== "creado_lead" && column.data !== "actualizadaaccion_lead")) {
                                        return (
                                            <th key={index} className={column.className}>
                                                {column.title}
                                            </th>
                                        );
                                    }
                                }
                                return null;
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((row, rowIndex) => (
                            <tr key={rowIndex} onClick={() => handleRowClick(row)}>
                                {columnsConfig.map((column, colIndex) => {
                                    if (!columnsToHide.includes(column.data)) {
                                        if ((filterOption === 1 && column.data === "creado_lead") || (filterOption === 2 && column.data === "actualizadaaccion_lead") || (column.data !== "creado_lead" && column.data !== "actualizadaaccion_lead")) {
                                            return (
                                                <td key={colIndex} className={column.className}>
                                                    {column.render ? column.render(row[column.data]) : row[column.data]}
                                                </td>
                                            );
                                        }
                                    }
                                    return null;
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Manejo de la paginación
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };

    // Función para cambiar el número de filas por página
    const handleRowsPerPageChange = (e) => {
        setRowsPerPage(Number(e.target.value));
        setCurrentPage(1); // Resetear la página actual a la primera al cambiar el número de filas
    };

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>MÓDULO DE LEADS REQUIEREN ATENCIÓN</h5>
            </div>

            <div className="card-header border-bottom-0">
                <div className="d-flex">
                    <a className="btn btn-dark m-t-5" data-bs-toggle="collapse" href="#collapseExample" role="button" aria-expanded="true" aria-controls="collapseExample">
                        Expandir filtros
                    </a>

                    <button className="btn btn-success ms-2" onClick={handleExportToExcel}>
                        Exportar a Excel
                    </button>
                </div>
            </div>
            <div className="collapse" id="collapseExample">
                <div className="card-body border-top">
                    <div className="row g-4">
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <input type="date" className="form-control" value={inputStartDate} onChange={(e) => setInputStartDate(e.target.value)} />
                                <label htmlFor="k1">Fecha de inicio de filtro</label>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <input type="date" className="form-control" value={inputEndDate} onChange={(e) => setInputEndDate(e.target.value)} />
                                <label htmlFor="k2">Fecha de final de filtro</label>
                            </div>
                        </div>
                    </div>

                    <div className="row g-4">
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={uniqueAdmins} value={searchFilters.name_admin} onChange={(selected) => setSearchFilters({ ...searchFilters, name_admin: selected })} />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <input type="text" className="form-control" value={searchFilters.nombre_lead} onChange={(e) => setSearchFilters({ ...searchFilters, nombre_lead: e.target.value })} />
                                <label htmlFor="k2">Buscar por nombre de cliente</label>
                            </div>
                        </div>
                    </div>
                    <div className="row g-4">
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={uniqueProjects} value={searchFilters.proyecto_lead} onChange={(selected) => setSearchFilters({ ...searchFilters, proyecto_lead: selected })} />
                                <br />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={uniqueCampaigns} value={searchFilters.campana_lead} onChange={(selected) => setSearchFilters({ ...searchFilters, campana_lead: selected })} />
                            </div>
                        </div>
                    </div>
                    <div className="row g-4">
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={uniqueStatuses} value={searchFilters.segimineto_lead} onChange={(selected) => setSearchFilters({ ...searchFilters, segimineto_lead: selected })} />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={uniqueSubsidiaries} value={searchFilters.subsidiaria_lead} onChange={(selected) => setSearchFilters({ ...searchFilters, subsidiaria_lead: selected })} />
                            </div>
                        </div>
                    </div>
                    <br />
                    <div className="row g-4">
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <div className="form-check">
                                    <input className="form-check-input" type="checkbox" id="creationDate" checked={filterOption === 1} onChange={() => handleCheckboxChange(1)} />
                                    <label className="form-check-label" htmlFor="creationDate">
                                        Filtrar por Fecha de Creación
                                    </label>
                                </div>
                                <div className="form-check">
                                    <input className="form-check-input" type="checkbox" id="lastActionDate" checked={filterOption === 2} onChange={() => handleCheckboxChange(2)} />
                                    <label className="form-check-label" htmlFor="lastActionDate">
                                        Filtrar por Última Acción
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <br />
                    <div className="row g-4">
                        <div className="col-md-6">
                            <label className="form-check-label" htmlFor="lastActionDate">
                                Cantidad de registros
                            </label>
                            <div className="form-floating mb-0">
                                <select
                                    className="form-control"
                                    value={rowsPerPage}
                                    onChange={handleRowsPerPageChange}
                                    style={{ width: "60px" }} // Ajusta el ancho como necesites
                                >
                                    <option value="10">10</option>
                                    <option value="20">20</option>
                                    <option value="30">30</option>
                                    <option value="40">40</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabla y preloader */}
            <div className="card-body" style={{ width: "100%", padding: "0" }}>
                {isLoading ? (
                    <div style={{ textAlign: "center", padding: "50px" }}>
                        <div className="spinner-border" role="status">
                            <span className="sr-only">Cargando...</span>
                        </div>
                        <p>Cargando datos, por favor espera...</p>
                    </div>
                ) : (
                    <>
                        {renderTable()}

                        {/* Controles de paginación */}
                        <div className="pagination-controls" style={{ textAlign: "center", marginTop: "20px" }}>
                            <button onClick={handlePrevPage} disabled={currentPage === 1} className="btn btn-light">
                                Anterior
                            </button>
                            <span style={{ margin: "0 10px" }}>
                                Página {currentPage} de {totalPages}
                            </span>
                            <button onClick={handleNextPage} disabled={currentPage === totalPages} className="btn btn-light">
                                Siguiente
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Modal que se abre al hacer clic en una fila */}
            {showModal && selectedLead && <ModalLeads leadData={selectedLead} onClose={handleCloseModal} />}
        </div>
    );
}
