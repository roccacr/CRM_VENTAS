import React, { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import { useLocation } from "react-router-dom";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";


export const View_note = () => {
    const dispatch = useDispatch();
    const [leadData, setLeadData] = useState(null); // Almacena los datos del lead
    const [leadName, setLeadName] = useState(null); // Almacena el nombre del lead
    const [isLoading, setIsLoading] = useState(true); // Estado para controlar el indicador de carga
    const location = useLocation(); // Hook para obtener la URL actual y sus parámetros

    /**
     * Extrae el parámetro 'id' de la URL.
     * useCallback asegura que la función no se recree innecesariamente en cada renderizado.
     */
    const getIdFromUrl = useCallback(() => {
        const params = new URLSearchParams(location.search);
        return params.get("id");
    }, [location.search]);

    /**
     * Función asíncrona para obtener los datos de un lead específico basado en su id.
     * Actualiza el estado con los datos recibidos.
     * @param {string} id - El id del lead a buscar.
     */
    const fetchLeadData = async (id) => {
        setIsLoading(true); // Mostrar el indicador de carga mientras se obtienen los datos
        const result = await dispatch(getSpecificLead(id)); // Llamar al thunk para obtener los datos del lead

        setLeadName(result.nombre_lead); // Almacenar el nombre del lead
        setLeadData(result); // Almacenar los datos completos del lead
        setIsLoading(false); // Ocultar el indicador de carga una vez que los datos están disponibles
    };

    /**
     * Hook de efecto que se ejecuta al montar el componente y cuando el parámetro 'id' cambia.
     * Obtiene el id de la URL y carga los datos correspondientes.
     */
    useEffect(() => {
        const id = getIdFromUrl(); // Obtener el id de la URL
        if (id) {
            fetchLeadData(id); // Obtener los datos del lead si el id existe
        }
    }, [getIdFromUrl]); // El efecto depende del id extraído de la URL

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>CREAR UNA NOTA: {leadName}</h5>
            </div>

            {isLoading ? (
                <div className="preloader">
                    {/* Indicador de carga mientras se obtienen los datos */}
                    <p>Cargando datos...</p>
                </div>
            ) : (
                <>
                    <div className="card-header">
                        <ButtonActions leadData={leadData} /> {/* Usar el nuevo componente */}
                    </div>
                    <div className="card-body">
                        <p>
                            <span className="text-danger">*</span> Esta función es clave para llevar un registro exhaustivo de todas las interacciones realizadas con el cliente, asegurando que cada acción tomada quede registrada y sea fácilmente accesible para futuras consultas o revisiones.
                        </p>
                        <div className="g-4 row">
                            <label className="form-label" htmlFor="exampleFormControlTextarea1">
                                Ingresa una nota :
                            </label>
                            <textarea rows="3" id="exampleFormControlTextarea1" className="form-control"></textarea>
                        </div>
                        <button className="btn btn-success">Generar Nota</button>
                    </div>
                </>
            )}
        </div>
    );
};
