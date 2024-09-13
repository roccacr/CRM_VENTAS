import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { getLeadsAttention } from "../../../../../store/leads/thunksLeads";
import { useDataTable } from "../../../../../hook/useDataTable";
import { useLocation, useNavigate } from "react-router-dom"; // Importamos hooks para manejar la URL

import { ModalLeads } from "../../../../pages/modal/modalLeads";
import { columnsConfig } from "./columnsConfig";

const getDefaultDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    return { firstDay, lastDay };
};

export default function View_list_leads_attention() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();

    // Obtener parámetros de la URL si existen
    const searchParams = new URLSearchParams(location.search);
    const urlStartDate = searchParams.get("startDate");
    const urlEndDate = searchParams.get("endDate");

    // Establecer las fechas por defecto si no existen en la URL
    const { firstDay, lastDay } = getDefaultDates();

    // Estado para controlar las fechas seleccionadas en los inputs
    const [inputStartDate, setInputStartDate] = useState(urlStartDate || firstDay);
    const [inputEndDate, setInputEndDate] = useState(urlEndDate || lastDay);

    // Estado para las fechas que se usan en la consulta (se actualizan solo al hacer clic en el botón)
    const [startDate, setStartDate] = useState(urlStartDate || firstDay);
    const [endDate, setEndDate] = useState(urlEndDate || lastDay);

    const [tableData, setTableData] = useState([]);
    const [selectedLead, setSelectedLead] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [searchColumns, setSearchColumns] = useState([]);
    const [dataExecel, setDataExecel] = useState([]);
    const [disguise, setDisguise] = useState([]);
    const [isLoading, setIsLoading] = useState(false); // Preloader activado/desactivado
    const [filterOption, setFilterOption] = useState(1); // Por defecto: FECHA DE CREACIÓN

    const handleRowClick = (data) => {
        setSelectedLead(data);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
    };

    // Fetch data when the filter is applied (startDate or endDate change)
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true); // Activa el preloader al inicio
            setSearchColumns([0, 1, 3, 4, 5, 6, 7, 9, 11, 12]);
            setDataExecel([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
            setDisguise([0, 2, 5, 6, 7, 8, 9, 12]);

            const result = await dispatch(getLeadsAttention(startDate, endDate, filterOption));
            setTableData(result);
            setIsLoading(false); // Desactiva el preloader una vez se carguen los datos
        };

        fetchData();
    }, [dispatch, startDate, endDate, filterOption]); // Solo se ejecuta cuando los valores de filtro cambian (por el botón)

    const handleFilter = async () => {
        // Activar el preloader antes de recargar la página
        setIsLoading(true);

        // Actualizar las fechas de filtro con los valores de los inputs
        setStartDate(inputStartDate);
        setEndDate(inputEndDate);

        // Actualizar los parámetros de la URL
        navigate(`/leads/lista?data=3&startDate=${inputStartDate}&endDate=${inputEndDate}`);

        // Forzar que el componente se vuelva a montar
        window.location.reload(); // Esto fuerza la recarga completa del componente
    };

    // Inicializar DataTable después de cargar los datos
    useDataTable(tableData, columnsConfig, handleRowClick, searchColumns, dataExecel, disguise);

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>MÓDULO DE LEADS REQUIEREN ATENCIÓN</h5>
            </div>
            <div className="card-header">
                <div className="row">
                    <div className="col-md-6">
                        <div className="mb-3">
                            <label className="form-label">Fecha de inicio</label>
                            <input type="date" className="form-control" value={inputStartDate} onChange={(e) => setInputStartDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="mb-3">
                            <label className="form-label">Fecha final</label>
                            <input type="date" className="form-control" value={inputEndDate} onChange={(e) => setInputEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="form-check">
                            <input className="form-check-input" type="radio" name="filterOption" id="filterCreation" checked={filterOption === 1} onChange={() => setFilterOption(1)} />
                            <label className="form-check-label" htmlFor="filterCreation">
                                FECHA DE CREACIÓN
                            </label>
                        </div>
                    </div>
                </div>
                <br />
                <button type="button" className="btn btn-dark" onClick={handleFilter}>
                    Extraer Clientes
                </button>
            </div>
            <div className="card-body" style={{ width: "100%", padding: "0" }}>
                {isLoading ? (
                    <div style={{ textAlign: "center", padding: "50px" }}>
                        <div className="spinner-border" role="status">
                            <span className="sr-only">Cargando...</span>
                        </div>
                        <p>Cargando datos, por favor espera...</p>
                    </div>
                ) : (
                    <div className="dt-responsive table-responsive" style={{ width: "100%", overflowX: "auto" }}>
                        <table id="tableDinamic" className="table table-striped table dt-responsive w-100 display text-left" style={{ fontSize: "15px", width: "100%", textAlign: "center" }}></table>
                    </div>
                )}
            </div>

            {showModal && selectedLead && <ModalLeads leadData={selectedLead} onClose={handleCloseModal} />}
        </div>
    );
}
