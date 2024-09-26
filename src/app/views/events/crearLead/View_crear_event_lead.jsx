import { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import Swal from "sweetalert2"; // Importamos SweetAlert
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import { useLocation } from "react-router-dom";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { createEventForLead } from "../../../../store/calendar/thunkscalendar";

// Este componente se encarga de mostrar el formulario para crear un evento
export const View_crear_event_lead = () => {
    const dispatch = useDispatch();
    const location = useLocation(); // Hook para obtener la ubicación actual

    // Estados locales para manejar los datos del lead y el formulario
    const [leadData, setLeadData] = useState(null);
    const [leadName, setLeadName] = useState(null);
    const [leadEmail, setLeadEmail] = useState(null);
    const [leadPhone, setLeadPhone] = useState(null);
    const [leadStatus, setLeadStatus] = useState(null);
    const [leadId, setLeadId] = useState(null);
    const [valueStatus, setValueStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Función para obtener la fecha actual en formato YYYY-MM-DD
    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    // Función para obtener la hora actual en formato HH:MM
    const getCurrentTime = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        return `${hours}:${minutes}`;
    };

    // Calcula la hora final sumando dos horas a la hora de inicio
    const getEndTime = (startTime) => {
        const [hours, minutes] = startTime.split(":").map(Number);
        const endTime = new Date();
        endTime.setHours(hours + 2, minutes);
        const endHours = String(endTime.getHours()).padStart(2, "0");
        const endMinutes = String(endTime.getMinutes()).padStart(2, "0");
        return `${endHours}:${endMinutes}`;
    };

    // Estado del formulario de creación de eventos
    const [formData, setFormData] = useState({
        nombreEvento: "",
        tipoEvento: "",
        descripcionEvento: "",
        fechaInicio: getTodayDate(),
        fechaFinal: getTodayDate(),
        horaInicio: getCurrentTime(),
        horaFinal: getEndTime(getCurrentTime()), // Hora final calculada con la lógica del rango de dos horas
    });

    // Estado para manejar los errores en los campos del formulario
    const [errors, setErrors] = useState({
        nombreEvento: false,
        tipoEvento: false,
        descripcionEvento: false,
    });

    // Función para obtener el ID del lead desde la URL
    const getIdFromUrl = useCallback(() => {
        const params = new URLSearchParams(location.search);
        return params.get("id");
    }, [location.search]);

    // Función para obtener los datos de un lead específico usando el ID
    const fetchLeadData = async (id) => {
        setIsLoading(true);
        const result = await dispatch(getSpecificLead(id));
        setLeadName(result.nombre_lead);
        setLeadEmail(result.email_lead);
        setLeadPhone(result.telefono_lead);
        setLeadId(result.idinterno_lead);
        setValueStatus(result.segimineto_lead);

        // Limpiar el estado del lead eliminando todo lo que está después del segundo guion
        const cleanLeadStatus = result.segimineto_lead.split("-").slice(2).join("-");
        setLeadStatus(cleanLeadStatus);
        setLeadData(result);
        setIsLoading(false);
    };

    // Hook para obtener el ID de la URL cuando el componente se monta y cargar los datos del lead
    useEffect(() => {
        const id = getIdFromUrl();
        if (id) {
            fetchLeadData(id);
        }
    }, [getIdFromUrl]);

    // Maneja los cambios de los campos en el formulario y actualiza el estado correspondiente
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Actualizar fechas y horas automáticamente para mantener consistencia
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
                horaFinal: getEndTime(value), // Actualizar la hora final automáticamente
            });
        } else {
            setFormData({
                ...formData,
                [name]: value,
            });
        }

        // Limpiar el error del campo si ya tiene un valor
        if (value) {
            setErrors({
                ...errors,
                [name]: false,
            });
        }
    };

    // Función para manejar la generación del evento con validación de campos obligatorios
    const handleGenerateEvent = () => {
        const { nombreEvento, tipoEvento, descripcionEvento } = formData;

        // Validación simple de los campos obligatorios
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

        const { fechaInicio, fechaFinal, horaInicio, horaFinal } = formData;

        // Mostrar un mensaje de confirmación antes de generar el evento
      Swal.fire({
          title: "¿Está seguro?",
          text: "¿Confirma que desea generar este evento?",
          icon: "warning",
          iconHtml: "؟",
          width: "55em",
          padding: "0 0 1.30em",
          showCancelButton: true,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: "Sí, crear",
      }).then(async (result) => {
          if (result.isConfirmed) {
              try {
                  // Llamar a la función para crear el evento con los datos del formulario
                  await dispatch(createEventForLead(nombreEvento, tipoEvento, descripcionEvento, fechaInicio, fechaFinal, horaInicio, horaFinal, leadId, valueStatus));

                  // Mostrar mensaje de éxito
                  Swal.fire({
                      title: "¡Evento creado con éxito!",
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

    };

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>CREAR UN EVENTO </h5>
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
                                    {/* Campo de nombre del evento */}
                                    <div className="mb-3">
                                        <label className="form-label">
                                            Nombre del evento <span className="text-danger">*</span>
                                        </label>
                                        <input type="text" className={`form-control ${errors.nombreEvento ? "is-invalid" : ""}`} name="nombreEvento" value={formData.nombreEvento} onChange={handleInputChange} placeholder="Ingresar el nombre del evento" />
                                    </div>

                                    {/* Selección del tipo de evento */}
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

                                    {/* Campo de descripción del evento */}
                                    <div className="mb-3">
                                        <label className="form-label">
                                            Describa este evento <span className="text-danger">*</span>
                                        </label>
                                        <textarea rows="6" className={`form-control ${errors.descripcionEvento ? "is-invalid" : ""}`} name="descripcionEvento" value={formData.descripcionEvento} onChange={handleInputChange} placeholder="Ingrese una descripción del evento" />
                                    </div>
                                </div>

                                {/* Campos de fecha y hora del evento */}
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

                            {/* Acordeón para mostrar la información completa del lead */}
                            <Accordion>
                                <AccordionSummary expandIcon={<ArrowDownwardIcon />} aria-controls="panel1-content" id="panel1-header">
                                    <Typography>Ver información completa de: {leadName}</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <div className="row">
                                        <div className="col-md-6">
                                            <div className="mb-3">
                                                <label className="form-label">Nombre del Cliente</label>
                                                <input type="text" className="form-control" defaultValue={leadName} />
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label">Correo Cliente</label>
                                                <input type="text" className="form-control" defaultValue={leadEmail} />
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label">Teléfono del Lead</label>
                                                <input type="text" className="form-control" defaultValue={leadPhone} />
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="mb-3">
                                                <label className="form-label">Estado del Lead</label>
                                                <input type="text" className="form-control" defaultValue={leadStatus} />
                                            </div>
                                        </div>
                                    </div>
                                </AccordionDetails>
                            </Accordion>
                        </div>
                    </div>

                    {/* Botón para generar el evento */}
                    <button className="btn btn-dark" onClick={handleGenerateEvent}>
                        Generar Evento
                    </button>
                </>
            )}
        </div>
    );
};
