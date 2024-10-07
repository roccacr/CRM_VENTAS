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

    const paginatedData = Array.isArray(filteredData) ? filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage) : [];

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    const handleRowsPerPageChange = (event) => {
        setRowsPerPage(Number(event.target.value));
        setCurrentPage(1);
    };

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
                            <table className="table table-striped">
                                <thead>
                                    <tr>
                                        <th>NOMBRE</th>
                                        <th>PROYECTO</th>
                                        <th>MODELO/ TIPO</th>
                                        <th>PRECIO V-UNICO</th>
                                        <th>ESTADO</th>
                                        <th>FECHA ENTREGA</th>
                                        <th>TOTAL DE M2</th>
                                        <th>LOTE</th>
                                        <th>AREA PARK M2</th>
                                        <th>AREA BODE M2</th>
                                        <th>AREA MEZZA M2</th>
                                        <th>ASL ASIGNADA</th>
                                        <th>PRRECIO V-MINIMO</th>
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
                                        {/* First Group */}
                                        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", borderBottom: "1px solid #ccc", pb: 2, mb: 2, gap: window.innerWidth < 600 ? "16px" : "0" }}>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>ID Expediente</p>
                                                <strong>{selectedExpediente.id_expediente || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>ID Interno Expediente</p>
                                                <strong>{selectedExpediente.ID_interno_expediente || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Código Expediente</p>
                                                <strong>{selectedExpediente.codigo_exp || "N"}</strong>
                                            </Box>
                                        </Box>

                                        {/* Second Group */}
                                        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", borderBottom: "1px solid #ccc", pb: 2, mb: 2, gap: window.innerWidth < 600 ? "16px" : "0" }}>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Proyecto Principal</p>
                                                <strong>{selectedExpediente.proyectoPrincipal_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>ID Proyecto Principal</p>
                                                <strong>{selectedExpediente.idProyectoPrincipal_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Tipo de Vivienda</p>
                                                <strong>{selectedExpediente.tipoDeVivienda_exp || "N"}</strong>
                                            </Box>
                                        </Box>

                                        {/* Third Group */}
                                        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", borderBottom: "1px solid #ccc", pb: 2, mb: 2, gap: window.innerWidth < 600 ? "16px" : "0" }}>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Lote M²</p>
                                                <strong>{selectedExpediente.loteM2_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Estado</p>
                                                <strong>{selectedExpediente.estado_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Precio Venta Único</p>
                                                <strong>{selectedExpediente.precioVentaUncio_exp || "N"}</strong>
                                            </Box>
                                        </Box>

                                        {/* Fourth Group */}
                                        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", borderBottom: "1px solid #ccc", pb: 2, mb: 2, gap: window.innerWidth < 600 ? "16px" : "0" }}>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>M² Habitables</p>
                                                <strong>{selectedExpediente.m2Habitables_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Área Total M²</p>
                                                <strong>{selectedExpediente.areaTotalM2_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Cuota Mantenimiento Aproximada</p>
                                                <strong>{selectedExpediente.cuotaMantenimientoAprox_exp || "N"}</strong>
                                            </Box>
                                        </Box>

                                        {/* Fifth Group */}
                                        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", borderBottom: "1px solid #ccc", pb: 2, mb: 2, gap: window.innerWidth < 600 ? "16px" : "0" }}>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Planos de Unidad</p>
                                                {selectedExpediente.planosDeUnidad_exp ? (
                                                    <a href={selectedExpediente.planosDeUnidad_exp} target="_blank" rel="noopener noreferrer">
                                                        Ver Planos
                                                    </a>
                                                ) : (
                                                    <strong>N</strong>
                                                )}
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Entrega Estimada</p>
                                                <strong>{selectedExpediente.entregaEstimada || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Área de Bodega M²</p>
                                                <strong>{selectedExpediente.areaDeBodegaM2_exp || "N"}</strong>
                                            </Box>
                                        </Box>

                                        {/* Sixth Group */}
                                        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", borderBottom: "1px solid #ccc", pb: 2, mb: 2, gap: window.innerWidth < 600 ? "16px" : "0" }}>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Área de Mezzanine M²</p>
                                                <strong>{selectedExpediente.areaDeMezzanieM2_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Área de Balcón M²</p>
                                                <strong>{selectedExpediente.areaDeBalconM2_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Área de Planta Baja</p>
                                                <strong>{selectedExpediente.areaDePlantaBaja_exp || "N"}</strong>
                                            </Box>
                                        </Box>

                                        {/* Seventh Group */}
                                        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", borderBottom: "1px solid #ccc", pb: 2, mb: 2, gap: window.innerWidth < 600 ? "16px" : "0" }}>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Área de Planta Alta</p>
                                                <strong>{selectedExpediente.areaDePlantaAlta_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Área de Ampliación</p>
                                                <strong>{selectedExpediente.areaDeAmpliacion_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Área de Terraza</p>
                                                <strong>{selectedExpediente.areaDeTerraza_exp || "N"}</strong>
                                            </Box>
                                        </Box>

                                        {/* Eighth Group */}
                                        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", borderBottom: "1px solid #ccc", pb: 2, mb: 2, gap: window.innerWidth < 600 ? "16px" : "0" }}>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Precio por M²</p>
                                                <strong>{selectedExpediente.precioPorM2_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Tercer Nivel Sótano</p>
                                                <strong>{selectedExpediente.tercerNivelSotano_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Área de Parqueo Aproximada</p>
                                                <strong>{selectedExpediente.areaDeParqueoAprox || "N"}</strong>
                                            </Box>
                                        </Box>

                                        {/* Ninth Group */}
                                        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", borderBottom: "1px solid #ccc", pb: 2, mb: 2, gap: window.innerWidth < 600 ? "16px" : "0" }}>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Área Externa Jardín</p>
                                                <strong>{selectedExpediente.areaExternaJardin_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Jardín con Talud</p>
                                                <strong>{selectedExpediente.jardinConTalud_exp || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Área Común Libre</p>
                                                <strong>{selectedExpediente.areacomunLibe_exp || "N"}</strong>
                                            </Box>
                                        </Box>

                                        {/* Tenth Group */}
                                        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", pb: 2, mb: 2, gap: window.innerWidth < 600 ? "16px" : "0" }}>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Precio de Venta Mínimo</p>
                                                <strong>{selectedExpediente.precioDeVentaMinimo || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Fecha de Modificación</p>
                                                <strong>{selectedExpediente.fecha_mod || "N"}</strong>
                                            </Box>
                                            <Box sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                                                <p>Valor Cron</p>
                                                <strong>{selectedExpediente.cron_value || "N"}</strong>
                                            </Box>
                                        </Box>
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
