import React, { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { createNote, createNoteLoss, getSpecificLead, getoptionLoss } from "../../../../store/leads/thunksLeads";
import { useLocation } from "react-router-dom";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import Swal from "sweetalert2"; // Asegúrate de tener SweetAlert instalado

export const View_loss_lead = () => {
    const dispatch = useDispatch();
    const [leadData, setLeadData] = useState(null); // Almacena los datos del lead
    const [leadName, setLeadName] = useState(null); // Almacena el nombre del lead
    const [note, setNote] = useState(""); // Almacena el valor del textarea
    const [isLoading, setIsLoading] = useState(true); // Estado para controlar el indicador de carga
    const [isTextareaError, setIsTextareaError] = useState(false); // Para el borde rojo
    const [isSelectError, setIsSelectError] = useState(false); // Para el borde rojo del select
    const location = useLocation(); // Hook para obtener la URL actual y sus parámetros
    const [valueStatus, setValueStatus] = useState(null);
    const [leadId, setLeadId] = useState(null);
    const [lossOptions, setLossOptions] = useState([]); // Lista de opciones de pérdida
    const [selectedLossOption, setSelectedLossOption] = useState(""); // Opción seleccionada

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
        const optionsLoss = await dispatch(getoptionLoss(3)); // Obtener las opciones de pérdida
        setLossOptions(optionsLoss); // Almacenar las opciones de pérdida
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
     * Maneja el cambio en el select de opciones de pérdida.
     */
    const handleLossOptionChange = (event) => {
        const selectedOption = lossOptions.find((option) => option.id_caida === parseInt(event.target.value));
        setSelectedLossOption(event.target.value);
        if (selectedOption) {
            setIsSelectError(false); // Quitar el borde rojo si se selecciona una opción válida
        }
    };

    /**
     * Función para manejar el clic en "Dar como perdido".
     * Valida si el textarea y el select están vacíos y muestra el alert.
     */
    const handleGenerateNote = () => {
        console.log("Dar como perdido clicado"); // Mostrar un mensaje en la consola al hacer clic
        if (note.trim() === "" || selectedLossOption === "") {
            Swal.fire({
                title: "Campos incompletos", // Título del SweetAlert
                text: "Debe llenar todos los campos antes de continuar.", // Mensaje de advertencia
                icon: "warning",
                confirmButtonText: "Aceptar",
            });
            if (note.trim() === "") setIsTextareaError(true);
            if (selectedLossOption === "") setIsSelectError(true);
        } else {
            // Muestra el alert de confirmación
            Swal.fire({
                title: "¿Está seguro que quiere dar como perdido a este cliente?", // Nuevo mensaje de confirmación
                text: "¿Deseas generar la nota?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Sí, dar como perdido",
                cancelButtonText: "Cancelar",
            }).then(async (result) => {
                if (result.isConfirmed) {
                     try {
                         // Llamar a la función para crear el evento con los datos del formulario
                         await dispatch(createNoteLoss(note, leadId, selectedLossOption));

                         // Mostrar mensaje de éxito
                         Swal.fire({
                             title: "¡Cliente Perdido!",
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
                                 window.location.reload();
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
                            <span className="text-danger">*</span> Esta función da como perdido al cliente, toma en cuenta que esta acción no se puede deshacer. Se generará una nota en el perfil del cliente, y todas sus transacciones se marcarán como perdidas.
                        </p>
                        <div className="g-4 row">
                            <label className="form-label">Seleccionar el motivo de pérdida:</label>
                            <select className={`form-select ${isSelectError ? "is-invalid" : ""}`} value={selectedLossOption} onChange={handleLossOptionChange}>
                                <option value="" disabled>
                                    Seleccionar
                                </option>
                                {lossOptions.map((option) => (
                                    <option key={option.id_caida} value={option.id_caida}>
                                        {option.nombre_caida}
                                    </option>
                                ))}
                            </select>
                            {isSelectError && <div className="invalid-feedback">Debe seleccionar un motivo de pérdida.</div>}
                        </div>
                        <div className="g-4 row">
                            <label className="form-label" htmlFor="exampleFormControlTextarea1">
                                Ingresa una nota:
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
                        Dar como perdido
                    </button>
                </>
            )}
        </div>
    );
};
