import React, { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { createNoteFollow_up, getSpecificLead, getoptionLoss } from "../../../../store/leads/thunksLeads";
import { useLocation } from "react-router-dom";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import Swal from "sweetalert2"; // Asegúrate de tener SweetAlert instalado

export const View_follow_up = () => {
    const dispatch = useDispatch();
    const [leadData, setLeadData] = useState(null); // Almacena los datos del lead
    const [leadName, setLeadName] = useState(null); // Almacena el nombre del lead
    const [note, setNote] = useState(""); // Almacena el valor del textarea
    const [isLoading, setIsLoading] = useState(true); // Estado para controlar el indicador de carga
    const [isTextareaError, setIsTextareaError] = useState(false); // Para el borde rojo
    const [isSelectError, setIsSelectError] = useState(false); // Para el borde rojo del select
    const [isDateError, setIsDateError] = useState(false); // Para el borde rojo del campo de fecha
    const [isLeadStatusError, setIsLeadStatusError] = useState(false); // Para el borde rojo del select de estado de lead
    const location = useLocation(); // Hook para obtener la URL actual y sus parámetros
    const [valueStatus, setValueStatus] = useState(null);
    const [leadId, setLeadId] = useState(null);
    const [lossOptions, setLossOptions] = useState([]); // Lista de opciones de pérdida
    const [selectedLossOption, setSelectedLossOption] = useState(""); // Opción seleccionada
    const [followUpDate, setFollowUpDate] = useState(""); // Almacenar la fecha seleccionada
    const [leadStatus, setLeadStatus] = useState("1"); // Estado del lead (activo o no) - Valor por defecto "1"

    const getIdFromUrl = useCallback(() => {
        const params = new URLSearchParams(location.search);
        return params.get("id");
    }, [location.search]);

    const fetchLeadData = async (id) => {
        setIsLoading(true); // Mostrar el indicador de carga mientras se obtienen los datos
        const optionsLoss = await dispatch(getoptionLoss(2)); // Obtener las opciones de pérdida
        setLossOptions(optionsLoss); // Almacenar las opciones de pérdida
        const result = await dispatch(getSpecificLead(id)); // Llamar al thunk para obtener los datos del lead

        setLeadName(result.nombre_lead); // Almacenar el nombre del lead
        setValueStatus(result.segimineto_lead);
        setLeadId(result.idinterno_lead);
        setLeadData(result); // Almacenar los datos completos del lead
        setIsLoading(false); // Ocultar el indicador de carga una vez que los datos están disponibles
    };

    const handleNoteChange = (event) => {
        setNote(event.target.value);
        if (event.target.value.trim() !== "") {
            setIsTextareaError(false); // Si hay texto, quitar el borde rojo
        }
    };

    const handleLossOptionChange = (event) => {
        const selectedOption = lossOptions.find((option) => option.id_caida === parseInt(event.target.value));
        setSelectedLossOption(event.target.value);
        if (selectedOption) {
            setIsSelectError(false); // Quitar el borde rojo si se selecciona una opción válida
        }
    };

    const handleDateChange = (event) => {
        setFollowUpDate(event.target.value);
        if (event.target.value !== "") {
            setIsDateError(false); // Quitar el borde rojo si se selecciona una fecha válida
        }
    };

    const handleLeadStatusChange = (event) => {
        setLeadStatus(event.target.value);
        if (event.target.value !== "") {
            setIsLeadStatusError(false); // Quitar el borde rojo si se selecciona un estado válido
        }
    };

    const handleGenerateNote = () => {
        console.log("Dar como seguimiento clicado");
        if (note.trim() === "" || selectedLossOption === "" || followUpDate === "" || leadStatus === "") {
            Swal.fire({
                title: "Campos incompletos",
                text: "Debe llenar todos los campos antes de continuar.",
                icon: "warning",
                confirmButtonText: "Aceptar",
            });
            if (note.trim() === "") setIsTextareaError(true);
            if (selectedLossOption === "") setIsSelectError(true);
            if (followUpDate === "") setIsDateError(true);
            if (leadStatus === "") setIsLeadStatusError(true);
        } else {
            Swal.fire({
                title: "¿Está seguro que quiere dar seguimiento a este cliente?",
                text: "¿Deseas generar la nota de seguimiento?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Sí, dar seguimiento",
                cancelButtonText: "Cancelar",
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        await dispatch(createNoteFollow_up(note, leadId, selectedLossOption, followUpDate, leadStatus)); // Pasar el estado del lead al dispatch

                        Swal.fire({
                            title: "¡Seguimiento generado!",
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
                                history.go(-1);
                            } else if (result.isDenied) {
                                window.location.href = "leads/perfil?data=" + leadId;
                            } else {
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

    useEffect(() => {
        const id = getIdFromUrl();
        if (id) {
            fetchLeadData(id);
        }
    }, [getIdFromUrl]);

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>CREAR UNA NOTA DE SEGUIMIENTO: {leadName}</h5>
            </div>

            {isLoading ? (
                <div className="preloader">
                    <p>Cargando datos...</p>
                </div>
            ) : (
                <>
                    <div className="card-header">
                        <ButtonActions leadData={leadData} />
                    </div>
                    <div className="card-body">
                        <p>
                            <span className="text-danger">*</span> Esta función permite dar seguimiento al cliente. Se generará una nota en el perfil del cliente.
                        </p>

                        {/* Campo para seleccionar la fecha */}
                        <div className="g-4 row mb-3">
                            <div className="col-12">
                                <label className="form-label mb-2">Seleccionar una fecha de seguimiento:</label>
                                <input type="date" className={`form-control ${isDateError ? "is-invalid" : ""}`} value={followUpDate} onChange={handleDateChange} />
                                {isDateError && <div className="invalid-feedback">Debe seleccionar una fecha.</div>}
                            </div>
                        </div>

                        {/* Campo para seleccionar el motivo de pérdida */}
                        <div className="g-4 row mb-3">
                            <div className="col-12">
                                <label className="form-label mb-2">Seleccionar el motivo de pérdida:</label>
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
                        </div>

                        {/* Nuevo campo para seleccionar el estado del lead */}
                        <div className="g-4 row mb-3">
                            <div className="col-12">
                                <label className="form-label mb-2">Seleccionar el estado del lead:</label>
                                <select className={`form-select ${isLeadStatusError ? "is-invalid" : ""}`} value={leadStatus} onChange={handleLeadStatusChange}>
                                    <option value="" disabled>
                                        Seleccionar estado
                                    </option>
                                    <option value="1">Activo</option>
                                    <option value="0">Inactivo</option>
                                </select>
                                {isLeadStatusError && <div className="invalid-feedback">Debe seleccionar el estado del lead.</div>}
                            </div>
                        </div>

                        {/* Campo para ingresar una nota */}
                        <div className="g-4 row mb-3">
                            <div className="col-12">
                                <label className="form-label mb-2" htmlFor="exampleFormControlTextarea1">
                                    Ingresa una nota:
                                </label>
                                <textarea rows="3" id="exampleFormControlTextarea1" className={`form-control ${isTextareaError ? "is-invalid" : ""}`} value={note} onChange={handleNoteChange}></textarea>
                                {isTextareaError && <div className="invalid-feedback">La nota no puede estar vacía.</div>}
                            </div>
                        </div>
                    </div>
                    <button className="btn btn-dark" onClick={handleGenerateNote}>
                        Dar como seguimiento
                    </button>
                </>
            )}
        </div>
    );
};
