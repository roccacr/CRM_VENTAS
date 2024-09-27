import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import { getLeadsComplete } from "../../../../../store/leads/thunksLeads";
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

// Función para obtener valores únicos con sus conteos
const getUniqueValuesWithCounts = (data, key) => {
    const counts = {};
    data.forEach((item) => {
        const value = item[key] || "Sin especificar";
        counts[value] = (counts[value] || 0) + 1;
    });
    return Object.entries(counts).map(([value, count]) => ({ value, label: `${value} (${count})` }));
};

export default function View_list_leads_complete() {
    const dispatch = useDispatch();
    const animatedComponents = makeAnimated();

    // Fechas por defecto (inicio y fin del mes)
    const { firstDay, lastDay } = getDefaultDates();

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

    // Estado para el ordenamiento
    const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

    // Estados para las opciones dinámicas
    const [advisorOptions, setAdvisorOptions] = useState([]);
    const [projectOptions, setProjectOptions] = useState([]);
    const [campaignOptions, setCampaignOptions] = useState([]);
    const [statusOptions, setStatusOptions] = useState([]);
    const [subsidiaryOptions, setSubsidiaryOptions] = useState([]);

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
        const result = await dispatch(getLeadsComplete(startDate, endDate, filterOption));
        setTableData(result); // Guardamos todos los registros en tableData
        setFilteredData(result); // Inicializamos filteredData con todos los registros al inicio
        setIsLoading(false); // Desactiva el preloader cuando se carguen los datos
    };

    // Obtener datos cuando se cambian las fechas o el filtro de los checkboxes
    useEffect(() => {
        fetchData(inputStartDate, inputEndDate, filterOption);
    }, [inputStartDate, inputEndDate, filterOption]);

    // Generar opciones de asesores basadas en los proyectos seleccionados
    useEffect(() => {
        let advisorsData = [];

        if (searchFilters.proyecto_lead.length === 0) {
            // Si no hay proyectos seleccionados, mostramos todos los asesores
            advisorsData = tableData;
        } else {
            // Filtrar los datos según los proyectos seleccionados
            const selectedProjects = searchFilters.proyecto_lead.map((p) => p.value);
            advisorsData = tableData.filter((item) => selectedProjects.includes(item.proyecto_lead));
        }

        const uniqueAdvisors = getUniqueValuesWithCounts(advisorsData, "name_admin");
        setAdvisorOptions(uniqueAdvisors);

        // Actualizar asesores seleccionados
        const validAdvisorValues = uniqueAdvisors.map((p) => p.value);
        const updatedAdvisorFilters = searchFilters.name_admin.filter((advisor) => validAdvisorValues.includes(advisor.value));

        // Si algún asesor seleccionado ya no es válido, lo eliminamos
        if (updatedAdvisorFilters.length !== searchFilters.name_admin.length) {
            setSearchFilters((prevFilters) => ({
                ...prevFilters,
                name_admin: updatedAdvisorFilters,
                // También actualizamos proyectos
                proyecto_lead: searchFilters.proyecto_lead.filter((project) => tableData.some((item) => item.proyecto_lead === project.value && validAdvisorValues.includes(item.name_admin))),
                // Resetear campañas
                campana_lead: [],
            }));
        }
    }, [searchFilters.proyecto_lead, tableData]);

    // Generar opciones de proyectos basadas en los asesores seleccionados
    useEffect(() => {
        let projectsData = [];

        if (searchFilters.name_admin.length === 0) {
            // Si no hay asesores seleccionados, mostramos todos los proyectos
            projectsData = tableData;
        } else {
            // Filtrar los datos según los asesores seleccionados
            const selectedAdmins = searchFilters.name_admin.map((p) => p.value);
            projectsData = tableData.filter((item) => selectedAdmins.includes(item.name_admin));
        }

        const uniqueProjects = getUniqueValuesWithCounts(projectsData, "proyecto_lead");
        setProjectOptions(uniqueProjects);

        // Actualizar proyectos seleccionados
        const validProjectValues = uniqueProjects.map((p) => p.value);
        const updatedProjectFilters = searchFilters.proyecto_lead.filter((project) => validProjectValues.includes(project.value));

        // Si algún proyecto seleccionado ya no es válido, lo eliminamos
        if (updatedProjectFilters.length !== searchFilters.proyecto_lead.length) {
            setSearchFilters((prevFilters) => ({
                ...prevFilters,
                proyecto_lead: updatedProjectFilters,
                // También actualizamos campañas
                campana_lead: [],
            }));
        }
    }, [searchFilters.name_admin, tableData]);

    // Generar opciones de campañas basadas en los proyectos seleccionados
    useEffect(() => {
        let campaignsData = [];

        if (searchFilters.proyecto_lead.length === 0) {
            // Si no hay proyectos seleccionados, mostrar todas las campañas
            campaignsData = tableData.filter((item) => searchFilters.name_admin.length === 0 || searchFilters.name_admin.map((p) => p.value).includes(item.name_admin));
        } else {
            // Filtrar los datos según los proyectos seleccionados
            const selectedProjects = searchFilters.proyecto_lead.map((p) => p.value);
            campaignsData = tableData.filter((item) => selectedProjects.includes(item.proyecto_lead));
        }

        const uniqueCampaigns = getUniqueValuesWithCounts(campaignsData, "campana_lead");
        setCampaignOptions(uniqueCampaigns);

        // Actualizar campañas seleccionadas
        const validCampaignValues = uniqueCampaigns.map((c) => c.value);
        const updatedCampaignFilters = searchFilters.campana_lead.filter((campaign) => validCampaignValues.includes(campaign.value));

        // Si alguna campaña seleccionada ya no es válida, la eliminamos
        if (updatedCampaignFilters.length !== searchFilters.campana_lead.length) {
            setSearchFilters((prevFilters) => ({
                ...prevFilters,
                campana_lead: updatedCampaignFilters,
            }));
        }
    }, [searchFilters.proyecto_lead, searchFilters.name_admin, tableData]);

    // Generar opciones de estados basadas en los datos filtrados
    useEffect(() => {
        const uniqueStatuses = getUniqueValuesWithCounts(tableData, "segimineto_lead");
        setStatusOptions(uniqueStatuses);
    }, [tableData]);

    // Generar opciones de subsidiarias basadas en los datos filtrados
    useEffect(() => {
        const uniqueSubsidiaries = getUniqueValuesWithCounts(tableData, "subsidiaria_lead");
        setSubsidiaryOptions(uniqueSubsidiaries);
    }, [tableData]);

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

    // Función para manejar el ordenamiento al hacer clic en los encabezados
    const handleSort = (columnKey) => {
        let direction = "asc";
        if (sortConfig.key === columnKey && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key: columnKey, direction });
    };

    // Ordenar los datos según el estado de sortConfig
    useEffect(() => {
        let sortedData = [...tableData];
        if (sortConfig.key) {
            sortedData.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === "asc" ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === "asc" ? 1 : -1;
                }
                return 0;
            });
        }
        setFilteredData(sortedData);
    }, [sortConfig, tableData]);

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
            // "proyecto_lead", // Proyecto
            // "campana_lead", // Campaña
            // "segimineto_lead", // Estado
            // "nombre_caida", // Seguimiento
            "estado_lead", // Estado Lead
            "creado_lead", // Subsidiarias
            "subsidiaria_lead", // Subsidiarias
        ];

        return (
            <div className="table-responsive">
                <table className="table table-striped table dt-responsive w-100 display text-left" style={{ fontSize: "15px", width: "100%", textAlign: "left" }}>
                    <thead>
                        <tr>
                            {columnsConfig.map((column, index) => {
                                if (!columnsToHide.includes(column.data)) {
                                    return (
                                        <th key={index} className={column.className} onClick={() => handleSort(column.data)}>
                                            {column.title}
                                            {sortConfig.key === column.data ? (sortConfig.direction === "asc" ? " 🔼" : " 🔽") : null}
                                        </th>
                                    );
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
                                        return (
                                            <td key={colIndex} className={column.className}>
                                                {column.render ? column.render(row[column.data]) : row[column.data]}
                                            </td>
                                        );
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
                <h5>MÓDULO DE LEADS : LISTA COMPLETA</h5>
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
                    {/* Filtros */}
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
                                <input type="text" className="form-control" value={searchFilters.nombre_lead} onChange={(e) => setSearchFilters({ ...searchFilters, nombre_lead: e.target.value })} />
                                <label htmlFor="k2">Buscar por nombre de cliente</label>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <input type="text" className="form-control" value={searchFilters.email_lead} onChange={(e) => setSearchFilters({ ...searchFilters, email_lead: e.target.value })} />
                                <label htmlFor="emailInput">Buscar por correo electrónico</label>
                            </div>
                        </div>
                    </div>
                    <div className="row g-4">
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <input type="text" className="form-control" value={searchFilters.telefono_lead} onChange={(e) => setSearchFilters({ ...searchFilters, telefono_lead: e.target.value })} />
                                <label htmlFor="phoneInput">Buscar por teléfono</label>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <label className="form-check-label" htmlFor="a1">
                                Filtrar por Asesor
                            </label>
                            <div className="form-floating mb-0">
                                <Select
                                    components={animatedComponents}
                                    isMulti
                                    closeMenuOnSelect={false}
                                    options={advisorOptions}
                                    value={searchFilters.name_admin}
                                    onChange={(selected) => {
                                        setSearchFilters({ ...searchFilters, name_admin: selected });
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="row g-4">
                        <div className="col-md-6">
                            <label className="form-check-label" htmlFor="a1">
                                Filtrar por Proyecto
                            </label>
                            <div className="form-floating mb-0">
                                <Select
                                    components={animatedComponents}
                                    isMulti
                                    closeMenuOnSelect={false}
                                    options={projectOptions}
                                    value={searchFilters.proyecto_lead}
                                    onChange={(selected) => {
                                        setSearchFilters({ ...searchFilters, proyecto_lead: selected });
                                    }}
                                />
                                <br />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <label className="form-check-label" htmlFor="a1">
                                Filtrar por Campaña
                            </label>
                            <div className="form-floating mb-0">
                                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={campaignOptions} value={searchFilters.campana_lead} onChange={(selected) => setSearchFilters({ ...searchFilters, campana_lead: selected })} />
                            </div>
                        </div>
                    </div>
                    <div className="row g-4">
                        <div className="col-md-6">
                            <label className="form-check-label" htmlFor="a1">
                                Filtrar por Estado
                            </label>
                            <div className="form-floating mb-0">
                                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={statusOptions} value={searchFilters.segimineto_lead} onChange={(selected) => setSearchFilters({ ...searchFilters, segimineto_lead: selected })} />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <label className="form-check-label" htmlFor="a1">
                                Filtrar por Subsidiarias
                            </label>
                            <div className="form-floating mb-0">
                                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={subsidiaryOptions} value={searchFilters.subsidiaria_lead} onChange={(selected) => setSearchFilters({ ...searchFilters, subsidiaria_lead: selected })} />
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
