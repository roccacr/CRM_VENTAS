import React, { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { createNote, getSpecificLead } from "../../../../store/leads/thunksLeads";
import { useLocation } from "react-router-dom";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import Swal from "sweetalert2"; // Asegúrate de tener SweetAlert instalado

export const View_note = () => {
    const dispatch = useDispatch();
    const [leadData, setLeadData] = useState(null); // Almacena los datos del lead
    const [leadName, setLeadName] = useState(null); // Almacena el nombre del lead
    const [note, setNote] = useState(""); // Almacena el valor del textarea
    const [isLoading, setIsLoading] = useState(true); // Estado para controlar el indicador de carga
    const [isTextareaError, setIsTextareaError] = useState(false); // Para el borde rojo
    const location = useLocation(); // Hook para obtener la URL actual y sus parámetros
    const [valueStatus, setValueStatus] = useState(null);
    const [leadId, setLeadId] = useState(null);

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
        setValueStatus(result.segimineto_lead);
        setLeadId(result.idinterno_lead);
        setLeadData(result); // Almacenar los datos completos del lead
        setIsLoading(false); // Ocultar el indicador de carga una vez que los datos están disponibles
    };

    /**
     * Maneja el cambio en el textarea.
     */
    const handleNoteChange = (event) => {
        setNote(event.target.value);
        if (event.target.value.trim() !== "") {
            setIsTextareaError(false); // Si hay texto, quitar el borde rojo
        }
    };

    /**
     * Función para manejar el clic en "Generar Nota".
     * Valida si el textarea está vacío y muestra el alert.
     */
    const handleGenerateNote = () => {
        if (note.trim() === "") {
            // Si la nota está vacía, muestra el borde rojo y no permite continuar
            setIsTextareaError(true);
        } else {
            // Muestra el alert de confirmación
            Swal.fire({
                title: "¿Estás seguro?",
                text: "¿Deseas generar la nota?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Sí, crear nota",
                cancelButtonText: "Cancelar",
            }).then(async (result) => {
                if (result.isConfirmed) {
                    // Si se confirma, loguea la nota en la consol
                     try {
                         // Llamar a la función para crear el evento con los datos del formulario
                          await dispatch(createNote(note, leadId, valueStatus));

                         // Mostrar mensaje de éxito
                         Swal.fire({
                             title: "¡Nota creada con éxito!",
                             text: "¿Qué desea hacer a continuación?",
                             icon: "question",
                             iconHtml: "✔️",
                             width: "40em",
                             padding: "0 0 1.20em",
                             showDenyButton: true,
                             showCancelButton: true,
                             confirmButtonText: "Volver a la vista anterior",
                             denyButtonText: "Ir al perfil del cliente",
                         }).then((result) => {
                             if (result.isConfirmed) {
                                 // Vuelve a la vista anterior en la navegación.
                                 history.go(-1);
                             } else if (result.isDenied) {
                                 // Redirige a la página de perfil del cliente.
                                 window.location.href = "leads/perfil?data=" + leadId; // Reemplazar `id_le` por `leadId` si corresponde
                             } else {
                                 // Recarga la página actual.
                                 location.reload();
                             }
                         });
                     } catch (error) {
                         console.error("Error al crear el evento:", error);
                         Swal.fire({
                             title: "Error",
                             text: "No se pudo crear el evento. Inténtelo nuevamente.",
                             icon: "error",
                             confirmButtonText: "Aceptar",
                         });
                     }
                }
            });
        }
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
                            <textarea
                                rows="3"
                                id="exampleFormControlTextarea1"
                                className={`form-control ${isTextareaError ? "is-invalid" : ""}`} // Agregar borde rojo si hay error
                                value={note}
                                onChange={handleNoteChange}
                            ></textarea>
                            {isTextareaError && <div className="invalid-feedback">La nota no puede estar vacía.</div>}
                        </div>
                    </div>
                    <button className="btn btn-dark" onClick={handleGenerateNote}>
                        Generar Nota
                    </button>
                </>
            )}
        </div>
    );
};
