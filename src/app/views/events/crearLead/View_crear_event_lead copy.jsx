import React, { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import Swal from "sweetalert2"; // Importamos SweetAlert
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import { useLocation } from "react-router-dom";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";

export const View_crear_event_lead = () => {
    const dispatch = useDispatch();
    const [leadData, setLeadData] = useState(null);
    const [leadName, setLeadName] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const location = useLocation();

    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const getCurrentTime = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        return `${hours}:${minutes}`;
    };

    const getEndTime = (startTime) => {
        const [hours, minutes] = startTime.split(":").map(Number);
        const endTime = new Date();
        endTime.setHours(hours + 2, minutes);
        const endHours = String(endTime.getHours()).padStart(2, "0");
        const endMinutes = String(endTime.getMinutes()).padStart(2, "0");
        return `${endHours}:${endMinutes}`;
    };

    const [formData, setFormData] = useState({
        nombreEvento: "",
        tipoEvento: "",
        descripcionEvento: "",
        fechaInicio: getTodayDate(),
        fechaFinal: getTodayDate(),
        horaInicio: getCurrentTime(),
        horaFinal: getEndTime(getCurrentTime()),
    });

    const [errors, setErrors] = useState({
        nombreEvento: false,
        tipoEvento: false,
        descripcionEvento: false,
    });

    const getIdFromUrl = useCallback(() => {
        const params = new URLSearchParams(location.search);
        return params.get("id");
    }, [location.search]);

    const fetchLeadData = async (id) => {
        setIsLoading(true);
        const result = await dispatch(getSpecificLead(id));
        setLeadName(result.nombre_lead);
        setLeadData(result);
        setIsLoading(false);
    };

    useEffect(() => {
        const id = getIdFromUrl();
        if (id) {
            fetchLeadData(id);
        }
    }, [getIdFromUrl]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === "fechaInicio") {
            setFormData({
                ...formData,
                fechaInicio: value,
                fechaFinal: value,
            });
        } else if (name === "horaInicio") {
            setFormData({
                ...formData,
                horaInicio: value,
                horaFinal: getEndTime(value),
            });
        } else {
            setFormData({
                ...formData,
                [name]: value,
            });
        }

        // Limpiar el error si el campo se llena
        if (value) {
            setErrors({
                ...errors,
                [name]: false,
            });
        }
    };

    const handleGenerateEvent = () => {
        const { nombreEvento, tipoEvento, descripcionEvento } = formData;

        // Validación de campos
        if (!nombreEvento || !tipoEvento || !descripcionEvento) {
            setErrors({
                nombreEvento: !nombreEvento,
                tipoEvento: !tipoEvento,
                descripcionEvento: !descripcionEvento,
            });

            Swal.fire({
                icon: "error",
                title: "Campos obligatorios",
                text: "Por favor, complete todos los campos obligatorios.",
            });
            return;
        }

        console.log("Datos del evento generados:", formData);
    };

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>CREAR UN EVENTO: {leadName}</h5>
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
                            <span className="text-danger">*</span> Crear un nuevo evento para el cliente.
                        </p>
                        <div className="g-8 row">
                            <div className="row">
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">
                                            Nombre del evento <span className="text-danger">*</span>
                                        </label>
                                        <input type="text" className={`form-control ${errors.nombreEvento ? "is-invalid" : ""}`} name="nombreEvento" value={formData.nombreEvento} onChange={handleInputChange} placeholder="Ingresar el nombre del evento" />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">
                                            Tipo Evento <span className="text-danger">*</span>
                                        </label>
                                        <select className={`form-select ${errors.tipoEvento ? "is-invalid" : ""}`} name="tipoEvento" value={formData.tipoEvento} onChange={handleInputChange}>
                                            <option value="">Seleccione un evento...</option>
                                            <option value="LLamada">LLamada</option>
                                            <option value="Tarea">Tarea</option>
                                            <option value="Reunion">Reunion</option>
                                            <option value="Correo">Correo</option>
                                            <option value="Whatsapp">Whatsapp</option>
                                            <option value="Seguimientos">Seguimientos</option>
                                            <option value="Cita">Asignar Cita</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">
                                            Describa este evento <span className="text-danger">*</span>
                                        </label>
                                        <textarea rows="6" className={`form-control ${errors.descripcionEvento ? "is-invalid" : ""}`} name="descripcionEvento" value={formData.descripcionEvento} onChange={handleInputChange} placeholder="Ingrese una descripción del evento" />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Fecha Inicio</label>
                                        <input type="date" className="form-control" name="fechaInicio" value={formData.fechaInicio} onChange={handleInputChange} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Fecha Final</label>
                                        <input type="date" className="form-control" name="fechaFinal" value={formData.fechaFinal} onChange={handleInputChange} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Hora Inicio</label>
                                        <input type="time" className="form-control" name="horaInicio" value={formData.horaInicio} onChange={handleInputChange} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Hora Final</label>
                                        <input type="time" className="form-control" name="horaFinal" value={formData.horaFinal} onChange={handleInputChange} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button className="btn btn-success" onClick={handleGenerateEvent}>
                            Generar Evento
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
