import { useEffect, useState } from "react"; // Hooks de React para manejar el ciclo de vida y el estado del componente
import { useLocation, useNavigate } from "react-router-dom"; // Hook de React Router para obtener la ubicación actual (URL)
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions"; // Componente personalizado para botones de acciones
import { useDispatch } from "react-redux"; // Hook de Redux para despachar acciones
import { getLeadsComplete, getSpecificLead } from "../../../../store/leads/thunksLeads"; // Acción asíncrona para obtener un lead específico
import { createEventForLead, editeEventForLead, getDataEevent, getSpecificLeadCitas, updateStatusEvent } from "../../../../store/calendar/thunkscalendar"; // Acción asíncrona para obtener un evento específico
import Accordion from "@mui/material/Accordion"; // Acordion de Material UI
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import Select from "react-select"; // Librería react-select para dropdown con búsqueda
import Swal from "sweetalert2";

// Función para obtener las fechas y horas actuales por defecto
// Esta función devuelve un objeto con las siguientes propiedades:
// - currentDate: La fecha actual en formato "YYYY-MM-DD".
// - nextDate: La fecha del día siguiente en formato "YYYY-MM-DD".
// - currentTime: La hora actual en formato "HH:MM".
// - nextTime: La hora una hora después de la hora actual en formato "HH:MM".
const getDefaultDateTime = () => {
    const now = new Date(); // Obtiene la fecha y hora actuales.

    // Convierte la fecha actual a formato ISO y toma solo la parte de la fecha (YYYY-MM-DD).
    const currentDate = now.toISOString().slice(0, 10);

    // Calcula la fecha del día siguiente, añade 24 horas a la fecha actual y convierte a formato ISO.
    const nextDate = now.toISOString().slice(0, 10);

    // Obtiene la hora actual en formato "HH:MM".
    const currentTime = now.toTimeString().slice(0, 5);

    // Calcula la hora una hora después de la actual, añade 60 minutos y obtiene el formato "HH:MM".
    const nextTime = new Date(now.getTime() + 60 * 60 * 1000).toTimeString().slice(0, 5);

    // Retorna un objeto con la fecha y hora actuales y la fecha y hora siguientes.
    return { currentDate, nextDate, currentTime, nextTime };
};

// Función auxiliar para generar las opciones de tiempo
const generateTimeOptions = () => {
    const options = [];
    // Empezamos desde 7 (7 AM) hasta 20 (8 PM)
    for (let hour = 7; hour <= 20; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            // Convertir a formato 12 horas
            let displayHour = hour % 12;
            displayHour = displayHour === 0 ? 12 : displayHour; // Convertir 0 a 12
            const ampm = hour < 12 ? 'AM' : 'PM';
            
            const formattedHour = displayHour.toString();
            const formattedMinute = minute.toString().padStart(2, '0');
            const time24 = `${hour.toString().padStart(2, '0')}:${formattedMinute}`; // Formato 24h para el value
            const timeDisplay = `${formattedHour}:${formattedMinute} ${ampm}`; // Formato 12h para mostrar
            
            options.push({
                value: time24,      // Mantener formato 24h para cálculos internos
                label: timeDisplay  // Mostrar en formato 12h
            });
        }
    }
    return options;
};

// Función para validar si una fecha es anterior a la fecha actual
const isDateInPast = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Establece la hora a medianoche para comparar solo fechas
    
    const dateToCheck = new Date(dateString);
    dateToCheck.setHours(0, 0, 0, 0);
    
    return dateToCheck < today;
};

export const View_events_Actions = () => {
    // Inicializa el hook 'useNavigate' para realizar la navegación programática entre rutas.
    const navigate = useNavigate();

    // Obtiene las fechas y horas por defecto para el evento (como la fecha y hora actuales y la siguiente).
    // Estas fechas y horas se inicializan en el estado de 'eventDetails'.
    const { currentDate, nextDate, currentTime, nextTime } = getDefaultDateTime();

    // Inicializa el hook 'useLocation' para obtener la ubicación actual del navegador, incluyendo los parámetros de la URL.
    const location = useLocation();

    // Inicializa el hook 'useDispatch' para permitir el envío de acciones a Redux desde este componente.
    const dispatch = useDispatch();

    // Estados locales para almacenar los detalles del lead y citas relacionadas.
    const [leadDetails, setLeadDetails] = useState({}); // Almacena los detalles generales del lead.
    const [leadDetailsCitas, setLeadDetailsCitas] = useState({}); // Almacena los detalles de citas del lead.

    // Estado local 'eventDetails' que almacena los detalles del evento.
    // Los valores por defecto se inicializan con la fecha y hora actuales y próximas.
    const [eventDetails, setEventDetails] = useState({
        name: "", // Nombre del evento.
        type: "", // Tipo de evento.
        description: "", // Descripción del evento.
        startDate: currentDate, // Fecha de inicio (inicializada con la fecha actual).
        endDate: nextDate, // Fecha de fin (inicializada con la siguiente fecha).
        startTime: currentTime, // Hora de inicio (inicializada con la hora actual).
        endTime: nextTime, // Hora de fin (inicializada con la próxima hora).
        estado: "", // Estado del evento (completado, cancelado, etc.).
    });

    // Estado para manejar si el checkbox está marcado o no.
    const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);

    // Estado para manejar si el Accordion (sección desplegable) está abierto o cerrado.
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);

    // Estado para almacenar la lista de leads obtenidos, que se utilizan como opciones en un selector.
    const [leadsOptions, setLeadsOptions] = useState([]);

    // Estado para manejar el lead seleccionado del selector de leads.
    const [selectedLead, setSelectedLead] = useState(null);

    // Función para obtener los parámetros de la URL.
    // Extrae el valor del parámetro proporcionado desde la URL utilizando 'location.search'.
    // Si el valor es un número válido, lo convierte a número; de lo contrario, retorna el valor tal cual.
    const getQueryParam = (param) => {
        const value = new URLSearchParams(location.search).get(param); // Obtiene el valor del parámetro de la URL.
        if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
            return Number(value); // Si el valor es un número válido, lo retorna como número.
        }
        return value; // Si no es un número, retorna el valor tal cual (cadena de texto).
    };

    // Función para obtener los detalles de un lead específico
    // Esta función asíncrona se encarga de hacer una solicitud para obtener los detalles de un lead basado en el ID del evento.
    // Primero, obtiene los detalles generales del lead y actualiza el estado con la información obtenida.
    // Luego, obtiene los detalles relacionados con las citas del lead y también actualiza el estado correspondiente.
    // Finalmente, activa el checkbox y abre el acordeón de opciones adicionales automáticamente.
    const fetchLeadDetails = async (idEvent) => {
        // Solicita los detalles específicos del lead y actualiza el estado 'leadDetails'.
        const leadData = await dispatch(getSpecificLead(idEvent));
        setLeadDetails(leadData); // Guarda los detalles del lead en el estado.

        // Solicita los detalles específicos de las citas del lead y actualiza el estado 'leadDetailsCitas'.
        const leadDataCitas = await dispatch(getSpecificLeadCitas(idEvent));
        setLeadDetailsCitas(leadDataCitas); // Guarda los detalles de las citas del lead en el estado.

        // Activa el checkbox y abre el acordeón de opciones adicionales.
        setIsCheckboxChecked(true);
        setIsAccordionOpen(true);
    };

    // Función para obtener los detalles de un evento específico
    // Esta función asíncrona se encarga de hacer una solicitud para obtener los detalles de un evento basado en su ID.
    // Luego, formatea y actualiza el estado 'eventDetails' con los detalles obtenidos, incluyendo el nombre, tipo,
    // descripción, fechas y horas de inicio y fin, y el estado del evento.
    const fetchEventDetails = async (eventId) => {
        // Solicita los detalles específicos del evento y guarda los datos en 'eventData'.
        const eventData = await dispatch(getDataEevent(eventId));

        console.log(eventData)

        // Función auxiliar para formatear la hora en el formato HH:MM.
        function formatTime(time) {
            if (!time) return ""; // Retorna una cadena vacía si no hay hora.
            const [hours, minutes] = time.split(":"); // Divide la hora en horas y minutos.
            const formattedHours = hours.length === 1 ? `0${hours}` : hours; // Asegura que las horas tengan 2 dígitos.
            return `${formattedHours}:${minutes}`; // Retorna la hora formateada.
        }

        // Actualiza el estado 'eventDetails' con los detalles obtenidos del evento.
        setEventDetails((prevDetails) => ({
            ...prevDetails, // Mantiene los detalles anteriores y actualiza solo los siguientes campos.
            name: eventData.nombre_calendar, // Actualiza el nombre del evento.
            type: eventData.tipo_calendar, // Actualiza el tipo de evento.
            description: eventData.decrip_calendar, // Actualiza la descripción del evento.
            startDate: eventData.fechaIni_calendar.split("T")[0], // Extrae y actualiza la fecha de inicio.
            endDate: eventData.fechaFin_calendar.split("T")[0], // Extrae y actualiza la fecha de fin.
            startTime: formatTime(eventData.horaInicio_calendar.split(" ")[0].slice(0, 5)), // Formatea y actualiza la hora de inicio.
            endTime: formatTime(eventData.horaFinal_calendar.split(" ")[0].slice(0, 5)), // Formatea y actualiza la hora de fin.
            estado: eventData.accion_calendar, // Actualiza el estado del evento.
        }));
    };

    // Función para obtener la lista de leads y formatearlos
    // Esta función se encarga de hacer una solicitud para obtener la lista completa de leads utilizando la acción 'getLeadsComplete'.
    // Los leads obtenidos son formateados en un arreglo con el formato adecuado para ser utilizados como opciones en un select,
    // donde cada lead tiene un 'value' que corresponde a su 'idinterno_lead' y un 'label' que muestra el 'nombre_lead'.
    const fetchLeadsOptions = async () => {
        // Realiza la solicitud para obtener los leads. Se utilizan fechas de ejemplo, pero no tienen impacto en la obtención de los datos.
        const leads = await dispatch(getLeadsComplete("2024-01-01", "2024-01-01", 0));
        

        // Formatea los leads obtenidos en un arreglo con los campos 'value' y 'label'.
        const formattedLeads = leads.map((lead) => ({
            value: lead.idinterno_lead, // 'value' será el ID interno del lead.
            label: lead.nombre_lead, // 'label' será el nombre del lead.
        }));

        // Actualiza el estado 'leadsOptions' con los leads formateados.
        setLeadsOptions(formattedLeads);
    };

    // Función para manejar el cambio de fecha de inicio
    const handleStartDateChange = (e) => {
        const newStartDate = e.target.value;
        
        // Verificar si la fecha seleccionada es anterior a la fecha actual
        if (isDateInPast(newStartDate)) {
            Swal.fire({
                icon: "error",
                title: "Fecha no válida",
                text: "No se pueden seleccionar fechas que ya han pasado.",
            });
            return;
        }
        
        setEventDetails((prevDetails) => ({
            ...prevDetails,
            startDate: newStartDate,
            endDate: newStartDate, // Actualiza también la fecha de finalización
        }));
    };
    
    // Función para manejar el cambio de fecha de finalización
    const handleEndDateChange = (e) => {
        const newEndDate = e.target.value;
        
        // Verificar si la fecha seleccionada es anterior a la fecha actual
        if (isDateInPast(newEndDate)) {
            Swal.fire({
                icon: "error",
                title: "Fecha no válida",
                text: "No se pueden seleccionar fechas que ya han pasado.",
            });
            return;
        }
        
        setEventDetails({ ...eventDetails, endDate: newEndDate });
    };

    // Hook useEffect para ejecutar lógica cuando cambia la URL o cuando se monta el componente
    // Este hook maneja la lógica inicial cuando el componente se carga o cuando la búsqueda en la URL cambia (location.search).
    useEffect(() => {
        // Obtiene los parámetros de 'idLead', 'idCalendar' y 'idDate' de la URL.
        const leadId = getQueryParam("idLead"); // Obtiene el ID del lead de los parámetros de la URL.
        const calendarId = getQueryParam("idCalendar"); // Obtiene el ID del calendario de los parámetros de la URL.
        const idDate = getQueryParam("idDate"); // Obtiene la fecha del evento de los parámetros de la URL.

        // Si existe un 'leadId' válido, ejecuta la función para obtener los detalles del lead.
        if (leadId && leadId > 0) {
            fetchLeadDetails(leadId); // Obtiene los detalles del lead específico.
        }

        // Si existe un 'calendarId' válido, ejecuta la función para obtener los detalles del evento.
        if (calendarId && calendarId > 0) {
            fetchEventDetails(calendarId); // Obtiene los detalles del evento específico.
        }

        // Si se ha proporcionado un 'idDate' válido, actualiza las fechas de inicio y fin en los detalles del evento.
        if (idDate != 0) {
            // Verificar si la fecha proporcionada es anterior a la fecha actual
            if (isDateInPast(idDate)) {
                // Si es una fecha pasada, usar la fecha actual
                setEventDetails((prevDetails) => ({
                    ...prevDetails,
                    startDate: currentDate,
                    endDate: currentDate,
                }));
            } else {
                setEventDetails((prevDetails) => ({
                    ...prevDetails,
                    startDate: idDate, // Establece la fecha de inicio con 'idDate'.
                    endDate: idDate, // Establece la fecha de fin con 'idDate'.
                }));
            }
        }

        // Llama a la función para obtener y formatear los leads al cargar el componente.
        fetchLeadsOptions();
    }, [location.search]); // Vuelve a ejecutar el efecto cuando 'location.search' cambia.

    // Función para manejar el cambio de tipo de evento
    // Esta función se activa cuando el usuario selecciona un tipo de evento desde un menú desplegable.
    // Actualiza el estado de 'eventDetails' con el tipo de evento seleccionado y, si el tipo seleccionado es "Cita",
    // también ajusta otros estados que controlan la visualización de opciones adicionales.
    const handleEventTypeChange = (e) => {
        const selectedType = e.target.value; // Obtiene el valor seleccionado del evento.

        // Actualiza el estado de 'eventDetails' con el nuevo tipo de evento seleccionado.
        setEventDetails({ ...eventDetails, type: selectedType });

        // Si el tipo seleccionado es "Cita", activa automáticamente el checkbox y abre el acordeón de opciones adicionales.
        if (selectedType === "Cita") {
            setIsCheckboxChecked(true); // Activa el checkbox automáticamente.
            setIsAccordionOpen(true); // Abre el acordeón de opciones adicionales.
        }
    };

    // Función para manejar el cambio del estado del checkbox
    // Esta función se activa cuando el usuario marca o desmarca el checkbox que indica si desea asignar un lead al evento.
    // Actualiza el estado que controla si el checkbox está activado y, en función de si está activado o no,
    // controla la apertura o cierre del acordeón de opciones adicionales.
    const handleCheckboxChange = (e) => {
        const isChecked = e.target.checked; // Obtiene el estado actual del checkbox (marcado o no).

        // Actualiza el estado 'isCheckboxChecked' con el valor del checkbox (true o false).
        setIsCheckboxChecked(isChecked);

        // Si el checkbox está activado, abre el acordeón de opciones adicionales; de lo contrario, lo cierra.
        if (isChecked) {
            setIsAccordionOpen(true); // Abre el acordeón si el checkbox está marcado.
        } else {
            setIsAccordionOpen(false); // Cierra el acordeón si el checkbox está desmarcado.
        }
    };

    // Nueva función para manejar la selección del lead
    const handleLeadSelect = (selectedOption) => {
        const selectedLeadId = selectedOption.value;
        fetchLeadDetails(selectedLeadId);
        setSelectedLead(selectedLeadId); // Actualiza el estado con el lead seleccionado
    };

    // Función para generar o editar un evento
    // Esta función maneja la lógica de validación y creación/edición de eventos en base a los detalles proporcionados.
    // Verifica que todos los campos obligatorios estén completos y, si es necesario, que un lead esté asignado.
    // Luego, muestra una confirmación para proceder con la acción.
    const handleGenerateEvent = () => {

        // Extrae los detalles del evento desde la variable eventDetails.
        const { type, startTime, startDate, name, endTime, endDate, description } = eventDetails;

        // Crea un objeto que contiene los campos obligatorios con sus etiquetas correspondientes.
        const fields = {
            "Tipo de evento": type,
            "Fecha de inicio": startDate,
            "Hora de inicio": startTime,
            "Fecha de fin": endDate,
            "Hora de fin": endTime,
            "Nombre del evento": name,
            Descripción: description,
        };

        // Verifica si algún campo obligatorio está vacío.
        const emptyField = Object.entries(fields).find(([key, value]) => !value);

        // Si hay un campo vacío, muestra una alerta de error indicando el campo que falta y detiene la ejecución.
        if (emptyField) {
            Swal.fire({
                icon: "error",
                title: "Campo obligatorio",
                text: `El campo '${emptyField[0]}' debe estar lleno para continuar.`,
            });
            return;
        }

        // Verifica si es necesario asignar un lead (si el checkbox está marcado o el tipo de evento es "Cita").
        if (isCheckboxChecked || type === "Cita") {
            // Si no hay un lead asignado, muestra una alerta de error y detiene la ejecución.
            if (leadDetails.nombre_lead === undefined) {
                Swal.fire({
                    icon: "error",
                    title: "Lead obligatorio",
                    text: "El campo 'Lead' es necesario para continuar. Si el evento es una 'Cita' o has elegido 'Asignar un lead a este evento', asegúrate de seleccionar un lead.",
                });
                return;
            }
        }

        // Obtiene el ID del calendario desde los parámetros de la URL.
        const calendarId = getQueryParam("idCalendar");

        // Muestra una alerta de confirmación antes de proceder con la acción de crear o editar el evento.
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
            // Si el usuario confirma la acción.
            if (result.isConfirmed) {
                try {
                    // Si no hay un ID de calendario, crea un nuevo evento.
                    if (calendarId === 0) {
                        await dispatch(createEventForLead(name, type, description, startDate, endDate, startTime, endTime, leadDetails.idinterno_lead, leadDetails.segimineto_lead));
                    }

                    // Si existe un ID de calendario, edita el evento existente.
                    if (calendarId > 0) {
                        await dispatch(editeEventForLead(calendarId, name, type, description, startDate, endDate, startTime, endTime, leadDetails.idinterno_lead, leadDetails.segimineto_lead));
                    }

                    // Muestra una alerta de éxito y ofrece opciones al usuario sobre qué hacer a continuación.
                    Swal.fire({
                        title: "¡Acción realizada con éxito!",
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
                    // Si ocurre un error al crear o editar el evento, muestra una alerta de error.
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

    // Función para navegar a la página del calendario
    // Esta función se activa cuando un usuario desea ver o acceder al calendario.
    // Utiliza la función navigate de la librería de enrutamiento para cambiar la URL actual a "/calendar".
    const openCalendar = () => {
        navigate("/calendar"); // Redirige al usuario a la página del calendario.
    };

    // Función para marcar un evento como completado
    // Esta función asíncrona recupera los IDs del evento (idCalendar) y del lead (leadId) de los parámetros de la URL.
    // Luego, despacha la acción 'updateStatusEvent', pasando el ID del evento, un estado de 1 (indicando completado),
    // el ID del lead y los detalles del seguimiento del lead (segimineto_lead).
    // Después de actualizar el estado del evento correctamente, recarga la página para reflejar los cambios.
    const completeEvent = async () => {
        const idCalendar = getQueryParam("idCalendar"); // Extrae el ID del evento de los parámetros de la URL.
        const leadId = getQueryParam("idLead"); // Extrae el ID del lead de los parámetros de la URL.

        // Despacha la acción para actualizar el estado del evento con el estado "1" (completado),
        // pasando también el ID del lead y los detalles de seguimiento del lead.
        await dispatch(updateStatusEvent(idCalendar, 1, leadId, leadDetails.segimineto_lead, 0,2));
        window.location.reload(); // Recarga la página para actualizar la vista después de la actualización.
    };

    // Función para cancelar un evento
    // Similar a completeEvent, esta función asíncrona recupera los IDs del evento (idCalendar) y del lead (leadId)
    // desde los parámetros de la URL. Luego despacha la acción 'updateStatusEvent', pero con un estado de 0 (indicando cancelado).
    // Finalmente, recarga la página para reflejar los cambios.
    const cancelEvent = async () => {
        const idCalendar = getQueryParam("idCalendar"); // Extrae el ID del evento de los parámetros de la URL.
        const leadId = getQueryParam("idLead"); // Extrae el ID del lead de los parámetros de la URL.

        // Despacha la acción para actualizar el estado del evento con el estado "0" (cancelado),
        // pasando también el ID del lead y los detalles de seguimiento del lead.
        await dispatch(updateStatusEvent(idCalendar, 0, leadId, leadDetails.segimineto_lead, 0,3));
        window.location.reload(); // Recarga la página para actualizar la vista después de la actualización.
    };

    const reactivarEvento = async () => {
        const idCalendar = getQueryParam("idCalendar"); // Extrae el ID del evento de los parámetros de la URL.
        const leadId = getQueryParam("idLead"); // Extrae el ID del lead de los parámetros de la URL.

        // Despacha la acción para actualizar el estado del evento con el estado "0" (cancelado),
        // pasando también el ID del lead y los detalles de seguimiento del lead.
        await dispatch(updateStatusEvent(idCalendar, 3, leadId, leadDetails.segimineto_lead, 1, 1));
       window.location.reload(); // Recarga la página para actualizar la vista después de la actualización.
    };

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>Manage Event</h5>
            </div>

            <div className="d-flex flex-wrap gap-2">
                {Object.keys(leadDetails).length > 0 && <ButtonActions leadData={leadDetails} className="mb-4" />}
                {getQueryParam("idCalendar") > 0 && (
                    <>
                        {(eventDetails.estado === "Completado" || eventDetails.estado === "Cancelado") && (
                            <>
                                <button type="button" className="btn btn-outline-danger" onClick={() => reactivarEvento()}>
                                    Reactivar Evento
                                </button>
                            </>
                        )}

                        {eventDetails.estado === "Pendiente" && (
                            <>
                                <button type="button" className="btn btn-outline-danger" onClick={() => cancelEvent()}>
                                    Cancelar Evento
                                </button>
                                <button type="button" className="btn btn-outline-success" onClick={() => completeEvent()}>
                                    Completar Evento
                                </button>
                            </>
                        )}
                    </>
                )}
                <button type="button" className="btn btn-outline-primary" onClick={() => openCalendar()}>
                    Calendario
                </button>
            </div>

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
                                    min={currentDate}
                                    onChange={handleStartDateChange}
                                />
                            </div>

                            <div className="mb-3">
                                <label className="form-label">Fecha de finalización</label>
                                <input 
                                    type="date" 
                                    className="form-control" 
                                    name="endDate" 
                                    value={eventDetails.endDate} 
                                    min={currentDate}
                                    onChange={handleEndDateChange} 
                                />
                            </div>

                            <div className="mb-3">
                                <label className="form-label">Hora de inicio</label>
                                <select
                                    className="form-control"
                                    name="startTime"
                                    value={eventDetails.startTime}
                                    onChange={(e) => {
                                        const newStartTime = e.target.value;
                                        const [hours, minutes] = newStartTime.split(':');
                                        
                                        // Sumar 1 hora a la hora de inicio
                                        let newHours = parseInt(hours) + 1;
                                        if (newHours >= 24) newHours = newHours % 24;
                                        
                                        const newEndTime = `${newHours.toString().padStart(2, '0')}:${minutes}`;
                                        
                                        setEventDetails((prevDetails) => ({
                                            ...prevDetails,
                                            startTime: newStartTime,
                                            endTime: newEndTime,
                                        }));
                                    }}
                                >
                                    {generateTimeOptions().map((timeObj) => (
                                        <option key={timeObj.value} value={timeObj.value}>
                                            {timeObj.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-3">
                                <label className="form-label">Hora Final</label>
                                <select
                                    className="form-control"
                                    name="endTime"
                                    value={eventDetails.endTime}
                                    onChange={(e) => setEventDetails({ ...eventDetails, endTime: e.target.value })}
                                >
                                    {generateTimeOptions().map((timeObj) => (
                                        <option key={timeObj.value} value={timeObj.value}>
                                            {timeObj.label}
                                        </option>
                                    ))}
                                </select>
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
