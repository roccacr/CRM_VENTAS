import React, { useState, useEffect } from "react";
import { columnsConfig } from "./columnsConfig"; // Configuración de las columnas para la tabla DataTable.
import { useDispatch, useSelector } from "react-redux"; // useDispatch para despachar acciones, useSelector para acceder al store.
import { getLeadsNew } from "../../../../../store/leads/thunksLeads"; // Acción asincrónica para obtener los nuevos leads.
import { useDataTable } from "../../../../../hook/useDataTable"; // Hook personalizado para inicializar la tabla con DataTable.
import { selectListNewLeads } from "../../../../../store/leads/selectorsLeads"; // Selector que obtiene los nuevos leads del store.
import { ModalLeads } from "../../../../pages/modal/modalLeads"; // Componente del modal para mostrar los detalles del lead seleccionado.

// Componente principal para la vista de la lista de nuevos leads.
export default function View_list_leads_new() {
    const dispatch = useDispatch(); // Hook para despachar acciones a Redux.

    // Estado que almacena los datos que se mostrarán en la tabla.
    const [tableData, setTableData] = useState([]);

    // Estado que almacena la fila seleccionada en la tabla.
    const [selectedLead, setSelectedLead] = useState(null);

    // Estado que controla la visibilidad del modal.
    const [showModal, setShowModal] = useState(false);

    // Estado que define las columnas que serán usadas para la búsqueda.
    const [searchColumns, setarchColumns] = useState([]);

    // Estado que define las columnas que serán exportadas a Excel.
    const [dataExecel, setdataExecel] = useState([]);

    // Estado que controla qué columnas se ocultarán en la tabla.
    const [disguise, setDisguise] = useState([]);

    // Estado para manejar la indicación de carga de datos (preload).
    const [isLoading, setIsLoading] = useState(true);

    // Estado para asegurarnos de que solo se haga la petición de leads una vez.
    const [hasFetched, setHasFetched] = useState(false);

    // Obtenemos el estado de los leads nuevos desde el store utilizando el selector.
    const leadsNew = useSelector(selectListNewLeads);

    // Función para manejar el evento cuando se selecciona una fila en la tabla.
    const handleRowClick = (data) => {
        setSelectedLead(data); // Establece la fila seleccionada en el estado.
        setShowModal(true); // Muestra el modal de detalles del lead.
    };

    // Función para cerrar el modal.
    const handleCloseModal = () => {
        setShowModal(false); // Oculta el modal.
    };

    // useEffect para simular la carga de datos desde una API o desde el store.
    useEffect(() => {
        const fetchData = async () => {
            // Configuramos las columnas que serán usadas para la búsqueda y la exportación.
            setarchColumns([0, 1, 3, 4, 5, 8]);
            setdataExecel([0, 1, 2, 3, 4, 5, 6, 7, 8]);
            setDisguise([0, 2, 5, 6, 7, 8]); // Columnas que se ocultarán en la tabla.

            // Si no se han obtenido datos aún, se realiza la llamada a la acción para obtenerlos.
            const result = await dispatch(getLeadsNew());
            setTableData(result); // Actualiza el estado de la tabla con los datos obtenidos.
            setHasFetched(true); // Indica que los datos ya han sido obtenidos para evitar múltiples peticiones.
            setIsLoading(false); // Cambia el estado de carga para indicar que ya se obtuvieron los datos.
        };

        if (!hasFetched) {
            fetchData(); // Llama a la función de carga de datos si aún no se ha hecho.
        }
    }, [dispatch, leadsNew, hasFetched]);

    // Llamada al hook personalizado para inicializar la tabla con DataTable.
    useDataTable(tableData, columnsConfig, handleRowClick, searchColumns, dataExecel, disguise);

    return (
        <div className="card" style={{ width: "100%" }}>
            {/* Encabezado del módulo */}
            <div className="card-header table-card-header">
                <h5>MÓDULO DE LEADS NUEVOS</h5>
            </div>
            <div className="card-body" style={{ width: "100%", padding: "0" }}>
                {/* Muestra un mensaje y spinner de carga mientras los datos están cargando */}
                {isLoading ? (
                    <div style={{ textAlign: "center", padding: "50px" }}>
                        <div className="spinner-border" role="status">
                            <span className="sr-only">Cargando...</span>
                        </div>
                        <p>Cargando datos, por favor espera...</p>
                    </div>
                ) : (
                    // Tabla donde DataTable se inicializa dinámicamente una vez que los datos se cargan.
                    <div className="dt-responsive table-responsive" style={{ width: "100%", overflowX: "auto" }}>
                        <table id="tableDinamic" className="table table-striped table dt-responsive w-100 display text-left" style={{ fontSize: "15px", width: "100%", textAlign: "center" }}></table>
                    </div>
                )}
            </div>

            {/* Modal que muestra los detalles del lead seleccionado */}
            {showModal && selectedLead && (
                <ModalLeads leadData={selectedLead} onClose={handleCloseModal} /> // Muestra el modal si se ha seleccionado un lead y el modal está visible.
            )}
        </div>
    );
}
