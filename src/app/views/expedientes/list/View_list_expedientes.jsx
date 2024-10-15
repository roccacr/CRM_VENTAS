import React, { useState, useEffect } from "react";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import * as XLSX from "xlsx"; // Importamos la librería para generar el archivo Excel
import { useDispatch } from "react-redux"; // Importar useDispatch para llamar al thunk
import { getFileList } from "../../../../store/expedientes/thunksExpedientes"; // Asegúrate de que esta función está disponible
import { Modal, Box, Button, Typography } from "@mui/material"; // Importamos Modal de Material UI

const getUniqueValuesWithCounts = (data, key) => {
    const counts = {};
    data.forEach((item) => {
        const value = item[key] || "Sin especificar";
        counts[value] = (counts[value] || 0) + 1;
    });
    return Object.entries(counts).map(([value, count]) => ({
        value,
        label: `${value} (${count})`,
    }));
};

export default function ViewListExpedientes() {
    const animatedComponents = makeAnimated();
    const dispatch = useDispatch(); // Instanciar el dispatch para llamar al thunk

    // Estado para los datos cargados y el estado de carga
    const [expedientes, setExpedientes] = useState([]); // Guardar los expedientes cargados
    const [isLoading, setIsLoading] = useState(true); // Controlar el preloader
    const [modalIsOpen, setModalIsOpen] = useState(false); // Controlar si el modal está abierto o cerrado
    const [selectedExpediente, setSelectedExpediente] = useState(null); // Guardar el expediente seleccionado

    const [searchFilters, setSearchFilters] = useState({
        proyectoPrincipal_exp: [],
        modelo_exp: [],
        estado_exp: [],
    });

    const [filteredData, setFilteredData] = useState([]);
    const [projectOptions, setProjectOptions] = useState([]);
    const [modelOptions, setModelOptions] = useState([]);
    const [stateOptions, setStateOptions] = useState([]);

    // Estado para controlar la ordenación
    const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await dispatch(getFileList());
                setExpedientes(Array.isArray(result) ? result : []);
                setFilteredData(Array.isArray(result) ? result : []);
                const uniqueProjects = getUniqueValuesWithCounts(result, "proyectoPrincipal_exp");
                setProjectOptions(uniqueProjects);
            } catch (error) {
                console.error("Error al cargar los expedientes", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [dispatch]);

    // Filtro dinámico de Modelos basado en el Proyecto seleccionado
    useEffect(() => {
        if (searchFilters.proyectoPrincipal_exp.length > 0) {
            const selectedProjects = searchFilters.proyectoPrincipal_exp.map((p) => p.value);
            const filteredByProject = expedientes.filter((item) => selectedProjects.includes(item.proyectoPrincipal_exp));
            const uniqueModels = getUniqueValuesWithCounts(filteredByProject, "tipoDeVivienda_exp");
            setModelOptions(uniqueModels);
        } else {
            setModelOptions([]);
        }
    }, [searchFilters.proyectoPrincipal_exp, expedientes]);

    // Filtro dinámico de Estados basado en el Proyecto y Modelo seleccionados
    useEffect(() => {
        let filteredByModelAndProject = expedientes;

        if (searchFilters.proyectoPrincipal_exp.length > 0) {
            const selectedProjects = searchFilters.proyectoPrincipal_exp.map((p) => p.value);
            filteredByModelAndProject = filteredByModelAndProject.filter((item) => selectedProjects.includes(item.proyectoPrincipal_exp));
        }

        if (searchFilters.modelo_exp.length > 0) {
            const selectedModels = searchFilters.modelo_exp.map((m) => m.value);
            filteredByModelAndProject = filteredByModelAndProject.filter((item) => selectedModels.includes(item.tipoDeVivienda_exp));
        }

        const uniqueStates = getUniqueValuesWithCounts(filteredByModelAndProject, "estado_exp");
        setStateOptions(uniqueStates);
    }, [searchFilters.modelo_exp, searchFilters.proyectoPrincipal_exp, expedientes]);

    useEffect(() => {
        const filterData = () => {
            let filtered = expedientes.filter((row) => {
                return (searchFilters.proyectoPrincipal_exp.length === 0 || searchFilters.proyectoPrincipal_exp.map((p) => p.value).includes(row.proyectoPrincipal_exp)) && (searchFilters.modelo_exp.length === 0 || searchFilters.modelo_exp.map((m) => m.value).includes(row.tipoDeVivienda_exp)) && (searchFilters.estado_exp.length === 0 || searchFilters.estado_exp.map((e) => e.value).includes(row.estado_exp));
            });
            setFilteredData(filtered);
        };

        filterData();
    }, [searchFilters, expedientes]);

    const handleOpenModal = (expediente) => {
        setSelectedExpediente(expediente); // Guardar el expediente seleccionado
        setModalIsOpen(true); // Abrir el modal
    };

    const handleCloseModal = () => {
        setModalIsOpen(false); // Cerrar el modal
        setSelectedExpediente(null); // Limpiar el expediente seleccionado
    };

    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    const handleRowsPerPageChange = (event) => {
        setRowsPerPage(Number(event.target.value));
        setCurrentPage(1);
    };

    // Función para ordenar los datos
    const handleSort = (key) => {
        let direction = "asc";
        if (sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    // Ordenar los datos en base al estado de ordenación
    const sortedData = [...filteredData].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
    });

    const paginatedData = Array.isArray(sortedData) ? sortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage) : [];

    const handleExportToExcel = () => {
        const dataToExport = filteredData.map((row) => ({
            "ID Interno": row.ID_interno_expediente,
            Código: row.codigo_exp,
            Proyecto: row.proyectoPrincipal_exp,
            Modelo: row.tipoDeVivienda_exp,
            Estado: row.estado_exp,
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Expedientes");
        XLSX.writeFile(wb, "Expedientes.xlsx");
    };

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>LISTADO DE EXPEDIENTES</h5>
            </div>

            <div className="card-header border-bottom-0">
                <div className="d-flex">
                    <button className="btn btn-success ms-2" onClick={handleExportToExcel}>
                        Exportar a Excel
                    </button>
                </div>
            </div>

            <div className="card-body">
                {isLoading ? (
                    <div>Cargando datos...</div>
                ) : filteredData.length === 0 ? (
                    <div>No hay datos para mostrar</div>
                ) : (
                    <>
                        <div className="row">
                            <div className="col-md-4">
                                <label>Filtrar por Proyecto</label>
                                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={projectOptions} value={searchFilters.proyectoPrincipal_exp} onChange={(selected) => setSearchFilters({ ...searchFilters, proyectoPrincipal_exp: selected })} placeholder="Proyecto" />
                            </div>
                            <div className="col-md-4">
                                <label>Filtrar por Modelo</label>
                                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={modelOptions} value={searchFilters.modelo_exp} onChange={(selected) => setSearchFilters({ ...searchFilters, modelo_exp: selected })} placeholder="Modelo" isDisabled={modelOptions.length === 0} />
                            </div>
                            <div className="col-md-4">
                                <label>Filtrar por Estado</label>
                                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={stateOptions} value={searchFilters.estado_exp} onChange={(selected) => setSearchFilters({ ...searchFilters, estado_exp: selected })} placeholder="Estado" isDisabled={stateOptions.length === 0} />
                            </div>
                        </div>

                        <div className="table-responsive">
                            <table className="table table-striped table dt-responsive w-100 display text-left" style={{ fontSize: "15px", width: "100%", textAlign: "left" }}>
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort("codigo_exp")}>NOMBRE</th>
                                        <th onClick={() => handleSort("proyectoPrincipal_exp")}>PROYECTO</th>
                                        <th onClick={() => handleSort("tipoDeVivienda_exp")}>MODELO/ TIPO</th>
                                        <th onClick={() => handleSort("precioVentaUncio_exp")}>PRECIO V-UNICO</th>
                                        <th onClick={() => handleSort("estado_exp")}>ESTADO</th>
                                        <th onClick={() => handleSort("entregaEstimada")}>FECHA ENTREGA</th>
                                        <th onClick={() => handleSort("areaTotalM2_exp")}>TOTAL DE M2</th>
                                        <th onClick={() => handleSort("m2Habitables_exp")}>AREA HABITABLE M2</th>
                                        <th onClick={() => handleSort("loteM2_exp")}>LOTE</th>
                                        <th onClick={() => handleSort("areaDeParqueoAprox")}>AREA PARK M2</th>
                                        <th onClick={() => handleSort("areaDeBodegaM2_exp")}>AREA BODE M2</th>
                                        <th onClick={() => handleSort("areaDeMezzanieM2_exp")}>AREA MEZZA M2</th>
                                        <th onClick={() => handleSort("areacomunLibe_exp")}>ASL ASIGNADA</th>
                                        <th onClick={() => handleSort("precioDeVentaMinimo")}>PRECIO V-MINIMO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((row, rowIndex) => (
                                        <tr key={rowIndex} onClick={() => handleOpenModal(row)}>
                                            <td>{row.codigo_exp}</td>
                                            <td>{row.proyectoPrincipal_exp}</td>
                                            <td>{row.tipoDeVivienda_exp}</td>
                                            <td>{row.precioVentaUncio_exp}</td>
                                            <td>{row.estado_exp}</td>
                                            <td>{row.entregaEstimada}</td>
                                            <td>{row.areaTotalM2_exp}</td>
                                            <td>{row.m2Habitables_exp}</td>
                                            <td>{row.loteM2_exp}</td>
                                            <td>{row.areaDeParqueoAprox}</td>
                                            <td>{row.areaDeBodegaM2_exp}</td>
                                            <td>{row.areaDeMezzanieM2_exp}</td>
                                            <td>{row.areacomunLibe_exp}</td>
                                            <td>{row.precioDeVentaMinimo}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="pagination-controls" style={{ marginTop: "20px", textAlign: "center" }}>
                            <div>
                                <label htmlFor="rowsPerPage">Filas por página:</label>
                                <select id="rowsPerPage" value={rowsPerPage} onChange={handleRowsPerPageChange} style={{ marginLeft: "10px" }}>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="btn btn-light">
                                Anterior
                            </button>
                            <span style={{ margin: "0 10px" }}>
                                Página {currentPage} de {Math.ceil(filteredData.length / rowsPerPage)}
                            </span>
                            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= Math.ceil(filteredData.length / rowsPerPage)} className="btn btn-light">
                                Siguiente
                            </button>
                        </div>

                        {/* Modal para mostrar los detalles del expediente */}
                        <Modal
                            open={modalIsOpen}
                            onClose={handleCloseModal}
                            sx={{
                                display: "flex",
                                alignItems: "flex-start", // Para que aparezca en la parte superior
                                justifyContent: "center",
                            }}
                        >
                            <Box
                                sx={{
                                    position: "absolute",
                                    top: "10px", // Ajustar la distancia desde la parte superior
                                    width: "70%",
                                    height: "95vh",
                                    bgcolor: "background.paper",
                                    boxShadow: 50,
                                    p: 2,
                                    overflowY: "auto", // Para hacer scroll si el contenido es demasiado largo
                                }}
                            >
                                <Typography variant="h6" component="h2">
                                    Detalles del Expediente
                                </Typography>
                                {selectedExpediente && (
                                    <>
                                        {[
                                            [
                                                { label: "Código Expediente", value: selectedExpediente.codigo_exp },
                                                { label: "Proyecto Principal", value: selectedExpediente.proyectoPrincipal_exp },
                                                { label: "Tipo de Vivienda", value: selectedExpediente.tipoDeVivienda_exp },
                                            ],
                                            [
                                                { label: "Precio Venta Único", value: selectedExpediente.precioVentaUncio_exp },
                                                { label: "Estado", value: selectedExpediente.estado_exp },
                                                { label: "Entrega Estimada", value: selectedExpediente.entregaEstimada },
                                            ],
                                            [
                                                { label: "Área Total M²", value: selectedExpediente.areaTotalM2_exp },
                                                { label: "M² Habitables", value: selectedExpediente.m2Habitables_exp },
                                                { label: "Lote M²", value: selectedExpediente.loteM2_exp },
                                            ],
                                            [
                                                { label: "Área de Parqueo Aprox.", value: selectedExpediente.areaDeParqueoAprox },
                                                { label: "Área de Bodega M²", value: selectedExpediente.areaDeBodegaM2_exp },
                                                { label: "Área de Mezzanine M²", value: selectedExpediente.areaDeMezzanieM2_exp },
                                            ],
                                            [
                                                { label: "Área Común Libre", value: selectedExpediente.areacomunLibe_exp },
                                                { label: "Precio de Venta Mínimo", value: selectedExpediente.precioDeVentaMinimo },
                                                {
                                                    label: "Planos de Unidad",
                                                    value: selectedExpediente.planosDeUnidad_exp ? (
                                                        <a href={selectedExpediente.planosDeUnidad_exp} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", fontWeight: "bold" }}>
                                                            Ver Planos
                                                        </a>
                                                    ) : (
                                                        "N/A"
                                                    ),
                                                },
                                            ],
                                            [
                                                { label: "ID Expediente", value: selectedExpediente.id_expediente },
                                                { label: "ID Interno Expediente", value: selectedExpediente.ID_interno_expediente },
                                                { label: "ID Proyecto Principal", value: selectedExpediente.idProyectoPrincipal_exp },
                                            ],
                                            [
                                                { label: "Cuota Mantenimiento Aproximada", value: selectedExpediente.cuotaMantenimientoAprox_exp },
                                                { label: "Área de Balcón M²", value: selectedExpediente.areaDeBalconM2_exp },
                                                { label: "Área de Planta Baja", value: selectedExpediente.areaDePlantaBaja_exp },
                                            ],
                                            [
                                                { label: "Área de Planta Alta", value: selectedExpediente.areaDePlantaAlta_exp },
                                                { label: "Área de Ampliación", value: selectedExpediente.areaDeAmpliacion_exp },
                                                { label: "Área de Terraza", value: selectedExpediente.areaDeTerraza_exp },
                                            ],
                                            [
                                                { label: "Precio por M²", value: selectedExpediente.precioPorM2_exp },
                                                { label: "Tercer Nivel Sótano", value: selectedExpediente.tercerNivelSotano_exp },
                                                { label: "Área Externa Jardín", value: selectedExpediente.areaExternaJardin_exp },
                                            ],
                                            [
                                                { label: "Jardín con Talud", value: selectedExpediente.jardinConTalud_exp },
                                                { label: "Fecha de Modificación", value: selectedExpediente.fecha_mod },
                                            ],
                                        ].map((group, index) => (
                                            <Box
                                                key={index}
                                                sx={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    flexWrap: "wrap",
                                                    borderBottom: "1px solid #ccc",
                                                    pb: 2,
                                                    mb: 2,
                                                    gap: window.innerWidth < 600 ? "16px" : "0",
                                                }}
                                            >
                                                {group.map((item, i) => (
                                                    <Box key={i} sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                        <p>{item.label}</p>
                                                        {typeof item.value === "string" ? <strong>{item.value || "N"}</strong> : item.value}
                                                    </Box>
                                                ))}
                                            </Box>
                                        ))}
                                    </>
                                )}

                                <button className="btn btn-dark">Sincronizar expediente de unidad</button>
                            </Box>
                        </Modal>
                    </>
                )}
            </div>
        </div>
    );
}
