import { useEffect, useState } from "react"; // Hooks de React para manejar el ciclo de vida y el estado del componente
import { useLocation } from "react-router-dom"; // Hook de React Router para obtener la ubicación actual (URL)
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions"; // Componente personalizado para botones de acciones
import { useDispatch } from "react-redux"; // Hook de Redux para despachar acciones
import { getLeadsComplete, getSpecificLead } from "../../../../store/leads/thunksLeads"; // Acción asíncrona para obtener un lead específico
import { createEventForLead, editeEventForLead, getDataEevent, getSpecificLeadCitas } from "../../../../store/calendar/thunkscalendar"; // Acción asíncrona para obtener un evento específico
import Accordion from "@mui/material/Accordion"; // Acordion de Material UI
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import Select from "react-select"; // Librería react-select para dropdown con búsqueda
import Swal from "sweetalert2";

const getDefaultDateTime = () => {
    const now = new Date();

    const currentDate = now.toISOString().slice(0, 10);
    const nextDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 5);
    const nextTime = new Date(now.getTime() + 60 * 60 * 1000).toTimeString().slice(0, 5);

    return { currentDate, nextDate, currentTime, nextTime };
};

export const View_events_Actions = () => {
    const { currentDate, nextDate, currentTime, nextTime } = getDefaultDateTime();
    const location = useLocation(); // Obtiene la ubicación actual (incluye los parámetros de la URL)
    const dispatch = useDispatch(); // Inicializa el dispatch para enviar acciones a Redux

    const [leadDetails, setLeadDetails] = useState({});
    const [leadDetailsCitas, setLeadDetailsCitas] = useState({});
    const [eventDetails, setEventDetails] = useState({
        name: "",
        type: "",
        description: "",
        startDate: currentDate,
        endDate: nextDate,
        startTime: currentTime,
        endTime: nextTime,
    });

    const [isCheckboxChecked, setIsCheckboxChecked] = useState(false); // Estado para manejar el checkbox
    const [isAccordionOpen, setIsAccordionOpen] = useState(false); // Estado para manejar el estado del Accordion
    const [leadsOptions, setLeadsOptions] = useState([]); // Estado para almacenar la lista de leads obtenidos
    const [selectedLead, setSelectedLead] = useState(null); // Estado para manejar el lead seleccionado

    const getQueryParam = (param) => {
        const value = new URLSearchParams(location.search).get(param);
        if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
            return Number(value);
        }
        return value;
    };

    const fetchLeadDetails = async (idEvent) => {
        const leadData = await dispatch(getSpecificLead(idEvent));
        setLeadDetails(leadData);

        const leadDataCitas = await dispatch(getSpecificLeadCitas(idEvent));

        setLeadDetailsCitas(leadDataCitas);

        setIsCheckboxChecked(true);
        setIsAccordionOpen(true);
    };

    const fetchEventDetails = async (eventId) => {
        const eventData = await dispatch(getDataEevent(eventId));

        function formatTime(time) {
            if (!time) return "";
            const [hours, minutes] = time.split(":");
            const formattedHours = hours.length === 1 ? `0${hours}` : hours;
            return `${formattedHours}:${minutes}`;
        }

        setEventDetails((prevDetails) => ({
            ...prevDetails,
            name: eventData.nombre_calendar,
            type: eventData.tipo_calendar,
            description: eventData.decrip_calendar,
            startDate: eventData.fechaIni_calendar.split("T")[0],
            endDate: eventData.fechaFin_calendar.split("T")[0],
            startTime: formatTime(eventData.horaInicio_calendar.split(" ")[0].slice(0, 5)),
            endTime: formatTime(eventData.horaFinal_calendar.split(" ")[0].slice(0, 5)),
        }));
    };

    // Nueva función para obtener la lista de leads y formatearlos
    const fetchLeadsOptions = async () => {
        const leads = await dispatch(getLeadsComplete("2024-01-01", "2024-01-01", 0)); // solo enviamos foramto de fecha este no tiene valor a la hora de traer los datos 

        const formattedLeads = leads.map((lead) => ({
            value: lead.idinterno_lead,
            label: lead.nombre_lead,
        }));
        setLeadsOptions(formattedLeads);
    };

    useEffect(() => {
        const leadId = getQueryParam("idLead");
        const calendarId = getQueryParam("idCalendar");
        const idDate = getQueryParam("idDate");

        if (leadId && leadId > 0) {
            fetchLeadDetails(leadId);
        }

        if (calendarId && calendarId > 0) {
            fetchEventDetails(calendarId);
        }

        if (idDate != 0) {
            setEventDetails((prevDetails) => ({
                ...prevDetails,
                startDate: idDate,
                endDate: idDate,
            }));
        }

        // Ejecuta la función para obtener los leads al cargar el componente
        fetchLeadsOptions();
    }, [location.search]);

    const handleEventTypeChange = (e) => {
        const selectedType = e.target.value;
        setEventDetails({ ...eventDetails, type: selectedType });

        if (selectedType === "Cita") {

            setIsCheckboxChecked(true);
            setIsAccordionOpen(true);
        }
    };

    const handleCheckboxChange = (e) => {
        const isChecked = e.target.checked;
        setIsCheckboxChecked(isChecked);

        if (isChecked) {
            setIsAccordionOpen(true);
        } else {
            setIsAccordionOpen(false);
        }
    };

    // Nueva función para manejar la selección del lead
    const handleLeadSelect = (selectedOption) => {
        const selectedLeadId = selectedOption.value;
        fetchLeadDetails(selectedLeadId);
        setSelectedLead(selectedLeadId); // Actualiza el estado con el lead seleccionado
    };

    const handleGenerateEvent = () => {
        const { type, startTime, startDate, name, endTime, endDate, description } = eventDetails;

        const fields = {
            "Tipo de evento": type,
            "Fecha de inicio": startDate,
            "Hora de inicio": startTime,
            "Fecha de fin": endDate,
            "Hora de fin": endTime,
            "Nombre del evento": name,
            Descripción: description,
        };

        const emptyField = Object.entries(fields).find(([key, value]) => !value);

        if (emptyField) {
            Swal.fire({
                icon: "error",
                title: "Campo obligatorio",
                text: `El campo '${emptyField[0]}' debe estar lleno para continuar.`,
            });
            return;
        }

        if (isCheckboxChecked || type === "Cita") {
            if (leadDetails.nombre_lead === undefined) {
                Swal.fire({
                    icon: "error",
                    title: "Lead obligatorio",
                    text: "El campo 'Lead' es necesario para continuar. Si el evento es una 'Cita' o has elegido 'Asignar un lead a este evento', asegúrate de seleccionar un lead.",
                });
                return;
            }
        }

        const calendarId = getQueryParam("idCalendar");


        Swal.fire({
            title: "¿Está seguro?",
            text: "¿Confirma que desea generar esta accion al evento?",
            icon: "warning",
            iconHtml: "؟",
            width: "55em",
            padding: "0 0 1.30em",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Sí, realizar acción",
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    if (calendarId === 0) {

                        await dispatch(createEventForLead(name, type, description, startDate, endDate, startTime, endTime, leadDetails.idinterno_lead, leadDetails.segimineto_lead));
                    }

                    if (calendarId > 0) {
                        await dispatch(editeEventForLead(calendarId,name, type, description, startDate, endDate, startTime, endTime, leadDetails.idinterno_lead, leadDetails.segimineto_lead));
                    }

                    // Mostrar mensaje de éxito
                    Swal.fire({
                        title: "¡Accion realizada con exito!",
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
                            window.location.href = "leads/perfil?data=" + leadDetails.idinterno_lead;
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
    };

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>Manage Event</h5>
            </div>
            {Object.keys(leadDetails).length > 0 && (
                <div className="card-body">
                    <ButtonActions leadData={leadDetails} />
                </div>
            )}

            <div className="card-body">
                <p>
                    <span className="text-danger">*</span> Please manage the event details before proceeding.
                </p>
                <div className="g-8 row">
                    <div className="row">
                        <div className="col-md-6">
                            <div className="mb-3">
                                <label className="form-label">
                                    Nombre de evento<span className="text-danger">*</span>
                                </label>
                                <input type="text" className="form-control" name="eventName" value={eventDetails.name} onChange={(e) => setEventDetails({ ...eventDetails, name: e.target.value })} placeholder="Enter event name" />
                            </div>

                            <div className="mb-3">
                                <label className="form-label">
                                    Tipo de evento<span className="text-danger">*</span>
                                </label>
                                <select className="form-control" name="eventType" value={eventDetails.type} onChange={handleEventTypeChange}>
                                    <option value="">Select an event type...</option>
                                    <option value="Llamada">Llamada</option>
                                    <option value="Tarea">Tarea</option>
                                    <option value="Reunion">Reunión</option>
                                    <option value="Correo">Correo</option>
                                    <option value="Whatsapp">Whatsapp</option>
                                    <option value="Seguimientos">Seguimientos</option>
                                    <option value="Cita">Asignar Cita</option>
                                </select>
                            </div>

                            <div className="mb-3">
                                <label className="form-label">
                                    Descripción del evento <span className="text-danger">*</span>
                                </label>
                                <textarea rows="6" value={eventDetails.description} onChange={(e) => setEventDetails({ ...eventDetails, description: e.target.value })} className="form-control" name="eventDescription" placeholder="Enter event description" />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="mb-3">
                                <label className="form-label">Fecha de inicio</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    name="startDate"
                                    value={eventDetails.startDate}
                                    onChange={(e) => {
                                        const newStartDate = e.target.value;
                                        setEventDetails((prevDetails) => ({
                                            ...prevDetails,
                                            startDate: newStartDate,
                                            endDate: newStartDate, // Actualiza también la fecha de finalización
                                        }));
                                    }}
                                />
                            </div>

                            <div className="mb-3">
                                <label className="form-label">Fecha de finalización</label>
                                <input type="date" className="form-control" name="endDate" value={eventDetails.endDate} onChange={(e) => setEventDetails({ ...eventDetails, endDate: e.target.value })} />
                            </div>

                            <div className="mb-3">
                                <label className="form-label">Hora de inicio</label>
                                <input
                                    type="time"
                                    min="08:00"
                                    max="17:00"
                                    step="1800"
                                    className="form-control"
                                    name="startTime"
                                    value={eventDetails.startTime}
                                    onChange={(e) => {
                                        const newStartTime = e.target.value;
                                        const [hours, minutes] = newStartTime.split(":");

                                        // Sumar 1 hora a la hora de inicio
                                        let newHours = parseInt(hours) + 1;
                                        if (newHours >= 24) newHours = newHours % 24; // Para manejar la hora después de las 23:00

                                        const newEndTime = `${newHours.toString().padStart(2, "0")}:${minutes}`;

                                        setEventDetails((prevDetails) => ({
                                            ...prevDetails,
                                            startTime: newStartTime,
                                            endTime: newEndTime, // Actualiza también la hora de finalización
                                        }));
                                    }}
                                />
                            </div>

                            <div className="mb-3">
                                <label className="form-label">Hora Final</label>
                                <input type="time" className="form-control" name="endTime" value={eventDetails.endTime} onChange={(e) => setEventDetails({ ...eventDetails, endTime: e.target.value })} />
                            </div>
                        </div>
                        {Object.keys(leadDetailsCitas).length > 0 && (
                            <div className="card-body">
                                <label className="form-label">Citas Anteriores</label>

                                {leadDetailsCitas.map((cita, index) => (
                                    <div key={index} className="d-flex align-items-center text-muted">
                                        <div className="avtar avtar-s bg-light-dark flex-shrink-0 me-2">
                                            <i className="material-icons-two-tone text-dark f-20">security</i>
                                        </div>
                                        <span className="text-muted text-sm w-100">
                                            Nombre de cita: {cita.nombre_calendar}
                                            <br />
                                            Fecha de cita: {cita.fechaFin_calendar.split("T")[0]}
                                            <br />
                                            Estado de cita : {cita.accion_calendar}
                                            <br />
                                            _______________________________________________________
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mb-2">
                            <div className="form-check">
                                <input type="checkbox" id="Checkselling1" className="form-check-input" checked={isCheckboxChecked} onChange={handleCheckboxChange} />
                                <label htmlFor="Checkselling1" className="form-check-label">
                                    Asignar un lead a este evento
                                </label>
                            </div>
                        </div>

                        {/* Accordion que se muestra solo cuando el checkbox está marcado o si se selecciona "Cita" */}
                        {isAccordionOpen && (
                            <Accordion>
                                <AccordionSummary expandIcon={<ArrowDownwardIcon />}>
                                    <Typography>Detalles del lead</Typography>
                                </AccordionSummary>
                                <div className="mb-3">
                                    <label className="form-label">
                                        Escoger clientes<span className="text-danger">*</span>
                                    </label>
                                    <Select options={leadsOptions} onChange={handleLeadSelect} placeholder="Buscar y seleccionar cliente..." />
                                </div>
                                <div className="row">
                                    <div className="col-md-6">
                                        <div className="mb-3">
                                            <label className="form-label">Nombre del Cliente</label>
                                            <input type="text" className="form-control" value={leadDetails.nombre_lead || ""} readOnly />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label">Correo Cliente</label>
                                            <input type="text" className="form-control" value={leadDetails.email_lead || ""} readOnly />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label">Teléfono del Lead</label>
                                            <input type="text" className="form-control" value={leadDetails.telefono_lead || ""} readOnly />
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="mb-3">
                                            <label className="form-label">Estado del Lead</label>
                                            <input type="text" className="form-control" value={leadDetails.segimineto_lead || ""} readOnly />
                                        </div>
                                    </div>
                                </div>
                            </Accordion>
                        )}
                    </div>
                </div>
            </div>

            <button className="btn btn-dark" onClick={handleGenerateEvent}>
                Generar Accion
            </button>
        </div>
    );
};
