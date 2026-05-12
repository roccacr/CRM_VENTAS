import React, { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { createNoteFollow_up, getSpecificLead, getoptionLoss } from "../../../../store/leads/thunksLeads";
import { useLocation } from "react-router-dom";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import Swal from "sweetalert2";
import { MODAL_TEXTS } from "../../../pages/modal/constants";

export const View_follow_up = () => {
    const dispatch = useDispatch();
    const [leadData, setLeadData] = useState(null);
    const [leadName, setLeadName] = useState(null);
    const [note, setNote] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isTextareaError, setIsTextareaError] = useState(false);
    const [isSelectError, setIsSelectError] = useState(false);
    const [isDateError, setIsDateError] = useState(false);
    const [isLeadStatusError, setIsLeadStatusError] = useState(false);
    const location = useLocation();
    const [valueStatus, setValueStatus] = useState(null);
    const [leadId, setLeadId] = useState(null);
    const [lossOptions, setLossOptions] = useState([]);
    const [selectedLossOption, setSelectedLossOption] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");
    const [leadStatus, setLeadStatus] = useState("1");

    const getIdFromUrl = useCallback(() => {
        const params = new URLSearchParams(location.search);
        return params.get("id");
    }, [location.search]);

    const fetchLeadData = async (id) => {
        setIsLoading(true);
        const optionsLoss = await dispatch(getoptionLoss(2));
        setLossOptions(optionsLoss);
        const result = await dispatch(getSpecificLead(id));

        setLeadName(result.nombre_lead);
        setValueStatus(result.segimineto_lead);
        setLeadId(result.idinterno_lead);
        setLeadData(result);
        setIsLoading(false);
    };

    const handleNoteChange = (event) => {
        setNote(event.target.value);
        if (event.target.value.trim() !== "") {
            setIsTextareaError(false);
        }
    };

    const handleLossOptionChange = (event) => {
        const selectedOption = lossOptions.find((option) => option.id_caida === parseInt(event.target.value));
        setSelectedLossOption(event.target.value);
        if (selectedOption) {
            setIsSelectError(false);
        }
    };

    const handleDateChange = (event) => {
        setFollowUpDate(event.target.value);
        if (event.target.value !== "") {
            setIsDateError(false);
        }
    };

    const handleLeadStatusChange = (event) => {
        setLeadStatus(event.target.value);
        if (event.target.value !== "") {
            setIsLeadStatusError(false);
        }
    };

    const handleGenerateNote = () => {
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
                title: "Colocar lead en seguimiento",
                html: `
                    <p style="margin-bottom: 10px;">${MODAL_TEXTS.CONFIRM_FOLLOW_UP}</p>
                    <p style="margin: 0; text-align: left; line-height: 1.5;">
                        ${MODAL_TEXTS.CONFIRM_FOLLOW_UP_NOTE}
                    </p>
                `,
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Si, dar seguimiento",
                cancelButtonText: "Cancelar",
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        await dispatch(createNoteFollow_up(note, leadId, selectedLossOption, followUpDate, leadStatus));

                        Swal.fire({
                            title: "Seguimiento generado",
                            text: "¿Que desea hacer a continuacion?",
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
                            text: "No se pudo crear el evento. Intentelo nuevamente.",
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
                            <span className="text-danger">*</span> Esta funcion permite dar seguimiento al cliente. Se generara una nota en el perfil del cliente.
                        </p>
                        <p className="mb-4">
                            <span className="text-danger">*</span> {MODAL_TEXTS.CONFIRM_FOLLOW_UP} {MODAL_TEXTS.CONFIRM_FOLLOW_UP_NOTE}
                        </p>

                        <div className="g-4 row mb-3">
                            <div className="col-12">
                                <label className="form-label mb-2">Seleccionar una fecha de seguimiento:</label>
                                <input type="date" className={`form-control ${isDateError ? "is-invalid" : ""}`} value={followUpDate} onChange={handleDateChange} />
                                {isDateError && <div className="invalid-feedback">Debe seleccionar una fecha.</div>}
                            </div>
                        </div>

                        <div className="g-4 row mb-3">
                            <div className="col-12">
                                <label className="form-label mb-2">Seleccionar el motivo de seguimiento:</label>
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
                                {isSelectError && <div className="invalid-feedback">Debe seleccionar un motivo de seguimiento.</div>}
                            </div>
                        </div>

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

                        <div className="g-4 row mb-3">
                            <div className="col-12">
                                <label className="form-label mb-2" htmlFor="exampleFormControlTextarea1">
                                    Ingresa una nota:
                                </label>
                                <textarea rows="3" id="exampleFormControlTextarea1" className={`form-control ${isTextareaError ? "is-invalid" : ""}`} value={note} onChange={handleNoteChange}></textarea>
                                {isTextareaError && <div className="invalid-feedback">La nota no puede estar vacia.</div>}
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
