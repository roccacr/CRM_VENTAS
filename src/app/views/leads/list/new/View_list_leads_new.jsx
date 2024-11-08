import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import { getLeadsNew } from "../../../../../store/leads/thunksLeads";
import { ModalLeads } from "../../../../pages/modal/modalLeads";
import { columnsConfig } from "./columnsConfig";
import * as XLSX from "xlsx"; // Importamos la librería para generar el archivo Excel
import "./styles.css"; // Importar los estilos responsivos

// Función para obtener valores únicos con sus conteos
const getUniqueValuesWithCounts = (data, key) => {
    const counts = {};
    data.forEach((item) => {
        const value = item[key] || "Sin especificar";
        counts[value] = (counts[value] || 0) + 1;
    });
    return Object.entries(counts).map(([value, count]) => ({ value, label: `${value} (${count})` }));
};

export default function View_list_leads_new() {
    const dispatch = useDispatch();
    const animatedComponents = makeAnimated();

    // Estado para los filtros de búsqueda y select (inicializados vacíos)
    const [searchFilters, setSearchFilters] = useState({
        name_admin: [],
        nombre_lead: "",
        email_lead: "",
        telefono_lead: "",
        proyecto_lead: [],
        campana_lead: [],
        segimineto_lead: [],
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

    // Estado para el ordenamiento
    const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

    // Estados para las opciones dinámicas
    const [projectOptions, setProjectOptions] = useState([]);
    const [campaignOptions, setCampaignOptions] = useState([]);

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

    // Función para traer los datos
    const fetchData = async () => {
        setIsLoading(true); // Activa el preloader al inicio
        const result = await dispatch(getLeadsNew());
        setTableData(result); // Guardamos todos los registros en tableData
        setFilteredData(result); // Inicializamos filteredData con todos los registros al inicio
        setIsLoading(false); // Desactiva el preloader cuando se carguen los datos
    };

    // Obtener datos al montar el componente
    useEffect(() => {
        fetchData();
    }, []);

    // Generar opciones únicas con conteos basadas en tableData
    const uniqueAdmins = getUniqueValuesWithCounts(tableData, "name_admin");

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
    }, [searchFilters.name_admin, tableData]);

    // Generar opciones de campañas basadas en los proyectos seleccionados y filtradas según el asesor
    useEffect(() => {
        let campaignsData = [];

        if (searchFilters.proyecto_lead.length === 0) {
            // Si no hay proyectos seleccionados, mostrar todas las campañas
            campaignsData = tableData;
        } else {
            // Filtrar los datos según los proyectos y asesores seleccionados
            const selectedProjects = searchFilters.proyecto_lead.map((p) => p.value);
            const selectedAdmins = searchFilters.name_admin.map((p) => p.value);

            campaignsData = tableData.filter((item) => selectedProjects.includes(item.proyecto_lead) && (selectedAdmins.length === 0 || selectedAdmins.includes(item.name_admin)));
        }

        const uniqueCampaigns = getUniqueValuesWithCounts(campaignsData, "campana_lead");
        setCampaignOptions(uniqueCampaigns);
    }, [searchFilters.proyecto_lead, searchFilters.name_admin, tableData]);

    // NUEVA FUNCIÓN: Para verificar y actualizar proyectos y campañas seleccionados
    const updateProjectAndCampaignFilters = (selectedAdmins) => {
        // Obtener proyectos válidos basados en los asesores seleccionados
        let projectsData = [];
        if (selectedAdmins.length === 0) {
            projectsData = tableData;
        } else {
            projectsData = tableData.filter((item) => selectedAdmins.includes(item.name_admin));
        }
        const uniqueProjects = getUniqueValuesWithCounts(projectsData, "proyecto_lead");
        const validProjectValues = uniqueProjects.map((p) => p.value);

        // Verificar si los proyectos seleccionados actualmente son válidos
        const currentSelectedProjects = searchFilters.proyecto_lead.map((p) => p.value);
        const newSelectedProjects = currentSelectedProjects.filter((project) => validProjectValues.includes(project));

        // Si algún proyecto seleccionado ya no es válido, lo eliminamos
        const updatedProjectFilters = uniqueProjects.filter((project) => newSelectedProjects.includes(project.value));

        // Actualizar campañas basadas en los proyectos actualizados
        const selectedProjects = updatedProjectFilters.map((p) => p.value);
        let campaignsData = [];
        if (selectedProjects.length === 0) {
            campaignsData = projectsData;
        } else {
            campaignsData = projectsData.filter((item) => selectedProjects.includes(item.proyecto_lead));
        }
        const uniqueCampaigns = getUniqueValuesWithCounts(campaignsData, "campana_lead");
        const validCampaignValues = uniqueCampaigns.map((c) => c.value);

        // Verificar si las campañas seleccionadas actualmente son válidas
        const currentSelectedCampaigns = searchFilters.campana_lead.map((c) => c.value);
        const newSelectedCampaigns = currentSelectedCampaigns.filter((campaign) => validCampaignValues.includes(campaign));

        // Actualizar los filtros en el estado
        setSearchFilters((prevFilters) => ({
            ...prevFilters,
            name_admin: selectedAdmins.map((admin) => ({ value: admin, label: admin })),
            proyecto_lead: updatedProjectFilters,
            campana_lead: uniqueCampaigns.filter((campaign) => newSelectedCampaigns.includes(campaign.value)),
        }));
    };

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
                    (searchFilters.segimineto_lead.length === 0 || searchFilters.segimineto_lead.map((p) => p.value).includes(row.segimineto_lead))
                );
            });

            setFilteredData(filtered);
        };

        // Si hay datos en tableData, aplicamos el filtro
        if (tableData.length > 0) {
            filterData();
        }
    }, [searchFilters, tableData]); // Cuando cambian los filtros o los datos originales

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
            "segimineto_lead", // Estado
            "nombre_caida", // Seguimiento
            "estado_lead", // Estado Lead
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
                <h5>MÓDULO DE LEADS NUEVOS</h5>
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
                            <div className="mb-0">
                                <Select
                                    components={animatedComponents}
                                    isMulti
                                    closeMenuOnSelect={false}
                                    options={uniqueAdmins}
                                    value={searchFilters.name_admin}
                                    onChange={(selected) => {
                                        const selectedAdmins = selected ? selected.map((p) => p.value) : [];

                                        // Actualizar proyectos y campañas basados en los asesores seleccionados
                                        updateProjectAndCampaignFilters(selectedAdmins);
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
                            <div className="mb-0">
                                <Select
                                    components={animatedComponents}
                                    isMulti
                                    closeMenuOnSelect={false}
                                    options={projectOptions}
                                    value={searchFilters.proyecto_lead}
                                    onChange={(selected) => {
                                        const selectedProjects = selected ? selected.map((p) => p.value) : [];

                                        // Obtener campañas válidas basadas en los proyectos seleccionados y asesor
                                        let campaignsData = [];
                                        if (selectedProjects.length === 0) {
                                            campaignsData = tableData.filter((item) => searchFilters.name_admin.length === 0 || searchFilters.name_admin.map((p) => p.value).includes(item.name_admin));
                                        } else {
                                            campaignsData = tableData.filter((item) => selectedProjects.includes(item.proyecto_lead) && (searchFilters.name_admin.length === 0 || searchFilters.name_admin.map((p) => p.value).includes(item.name_admin)));
                                        }
                                        const uniqueCampaigns = getUniqueValuesWithCounts(campaignsData, "campana_lead");
                                        const validCampaignValues = uniqueCampaigns.map((c) => c.value);

                                        // Verificar si las campañas seleccionadas actualmente son válidas
                                        const currentSelectedCampaigns = searchFilters.campana_lead.map((c) => c.value);
                                        const newSelectedCampaigns = currentSelectedCampaigns.filter((campaign) => validCampaignValues.includes(campaign));

                                        setSearchFilters({
                                            ...searchFilters,
                                            proyecto_lead: selected,
                                            campana_lead: uniqueCampaigns.filter((campaign) => newSelectedCampaigns.includes(campaign.value)),
                                        });
                                    }}
                                />
                                <br />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <label className="form-check-label" htmlFor="a1">
                                Filtrar por Campaña
                            </label>
                            <div className="mb-0">
                                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={campaignOptions} value={searchFilters.campana_lead} onChange={(selected) => setSearchFilters({ ...searchFilters, campana_lead: selected })} />
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
                                <select className="form-control" value={rowsPerPage} onChange={handleRowsPerPageChange} style={{ width: "60px" }}>
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
