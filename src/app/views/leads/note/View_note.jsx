import React, { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { createNote, getSpecificLead } from "../../../../store/leads/thunksLeads";
import { useLocation, useNavigate } from "react-router-dom";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import Swal from "sweetalert2"; // Asegúrate de tener SweetAlert instalado

export const View_note = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [leadData, setLeadData] = useState(null); // Almacena los datos del lead
    const [leadName, setLeadName] = useState(null); // Almacena el nombre del lead
    const [note, setNote] = useState(""); // Almacena el valor del textarea
    const [isLoading, setIsLoading] = useState(true); // Estado para controlar el indicador de carga
    const [isTextareaError, setIsTextareaError] = useState(false); // Para el borde rojo
    const location = useLocation(); // Hook para obtener la URL actual y sus parámetros
    const [valueStatus, setValueStatus] = useState(null);
    const [leadId, setLeadId] = useState(null);
    const [selectedQuickOption, setSelectedQuickOption] = useState(""); // Para la opción de llenado rápido

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
        const newValue = event.target.value;
        setNote(newValue);
        if (newValue.trim() !== "") {
            setIsTextareaError(false); // Si hay texto, quitar el borde rojo
        }
    };

    /**
     * Maneja la selección de opción rápida y la agrega al textarea
     */
    const handleQuickOptionSelect = (event) => {
        const selectedValue = event.target.value;
        
        if (selectedValue && selectedValue !== "") {
            // Actualizar el estado para que el select muestre la opción seleccionada
            setSelectedQuickOption(selectedValue);
            
            // Si hay texto en el textarea, agregar al final
            if (note.trim() !== "") {
                setNote(prevNote => prevNote + " " + selectedValue);
            } else {
                // Si no hay texto, llenar con la opción seleccionada
                setNote(selectedValue);
            }
            
            // Quitar el borde rojo si había error
            setIsTextareaError(false);
            
            // La opción permanecerá visible hasta que el usuario escriba en el textarea o seleccione otra opción
        } else {
            // Si se selecciona la opción vacía, limpiar
            setSelectedQuickOption("");
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
                                 navigate(-1);
                             } else if (result.isDenied) {
                                 // Redirige a la página de perfil del cliente.
                                 navigate(`/leads/perfil?data=${leadId}`);
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
                            <span className="text-danger">*</span> Esta función es clave para llevar un registro exhaustivo de todas las interacciones realizadas con el cliente, asegurando que cada acción tomada quede registrada y sea fácilmente accesible para futuras consultas o revisiones.
                        </p>
                        <div className="g-4 row">
                            {/* Select de opciones rápidas */}
                            <div className="col-12 mb-3">
                                <label className="form-label">
                                    Opciones de llenado rápido:
                                </label>
                                <select 
                                    className="form-select" 
                                    value={selectedQuickOption}
                                    onChange={handleQuickOptionSelect}
                                >
                                    <option value="">Selecciona una opción rápida...</option>
                                    <option value="Seguimiento inicial">Seguimiento inicial</option>
                                    <option value="Seguimiento Avanzado">Seguimiento Avanzado</option>
                                    <option value="Interés Alto">Interés Alto</option>
                                    <option value="Interés Medio">Interés Medio</option>
                                    <option value="Interés Bajo">Interés Bajo</option>
                                    <option value="Quiere visitar">Quiere visitar</option>
                                    <option value="Interés en otro proyecto">Interés en otro proyecto</option>
                                    <option value="Cliente en análisis bancario">Cliente en análisis bancario</option>
                                    <option value="Se reactivó">Se reactivó</option>
                                    <option value="Interés en:">Interés en:</option>
                                    <option value="Seguimiento 1">Seguimiento 1</option>
                                    <option value="Seguimiento 2">Seguimiento 2</option>
                                    <option value="Cliente potencial alto">Cliente potencial alto</option>
                                    <option value="Cliente potencial medio">Cliente potencial medio</option>
                                    <option value="Cliente potencial bajo">Cliente potencial bajo</option>
                                    <option value="Presupuesto aprobado">Presupuesto aprobado</option>
                                    <option value="Esperando respuesta">Esperando respuesta</option>
                                    <option value="Necesita más información">Necesita más información</option>
                                    <option value="Agendada cita">Agendada cita</option>
                                    <option value="Canceló cita">Canceló cita</option>
                                    <option value="Confirmó asistencia">Confirmó asistencia</option>
                                    <option value="Cliente muy interesado">Cliente muy interesado</option>
                                    <option value="Solicita cotización">Solicita cotización</option>
                                    <option value="Comparando con competencia">Comparando con competencia</option>
                                    <option value="Decisión pendiente">Decisión pendiente</option>
                                    <option value="Cliente frío">Cliente frío</option>
                                    <option value="Cliente caliente">Cliente caliente</option>
                                    <option value="Proyecto en marcha">Proyecto en marcha</option>
                                    <option value="Proyecto pausado">Proyecto pausado</option>
                                    <option value="Cliente perdido">Cliente perdido</option>
                                    <option value="Cliente ganado">Cliente ganado</option>
                                </select>
                            </div>
                            
                            {/* Textarea */}
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
