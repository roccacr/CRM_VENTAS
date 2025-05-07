import React, { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction"; // Asegúrate de tener instalado este plugin
import esLocale from "@fullcalendar/core/locales/es";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import { get_Calendar, moveEvenOtherDate } from "../../../store/calendar/thunkscalendar";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';

const filterOptions = [
    { value: "categoria1", label: "Contactos" },
    { value: "categoria2", label: "Tareas" },
    { value: "categoria3", label: "Reunion" },
    { value: "categoria4", label: "Seguimientos" },
    { value: "categoria5", label: "Primeras Citas" },
    { value: "categoria6", label: "Outlook" },
];

const getColor = (category) => {
    switch (category) {
        case "categoria1":
            return "#556ee6";
        case "categoria2":
            return "#343a40";
        case "categoria3":
            return "#34c38f";
        case "categoria4":
            return "#f46a6a";
        case "categoria5":
            return "#f1b44c";
        case "categoria6":
            return "#808080"; // Gray color for Outlook events
        default:
            return "#000000";
    }
};

export const View_calendars = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [events, setEvents] = useState([]);
    const [selectedFilters, setSelectedFilters] = useState(filterOptions);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [currentView, setCurrentView] = useState(window.innerWidth < 768 ? "listWeek" : "dayGridMonth");
    const [isLoading, setIsLoading] = useState(true);
    const { instance, accounts } = useMsal();
    const [accessToken, setAccessToken] = useState("");
    const [outlookError, setOutlookError] = useState(null);

    // Obtener token de acceso de Outlook
    useEffect(() => {
        const getAccessToken = async () => {
            if (!accounts || accounts.length === 0) {
                setOutlookError('Usuario no autenticado.');
                return;
            }

            try {
                const response = await instance.acquireTokenSilent({
                    scopes: ['Calendars.Read'],
                    account: accounts[0],
                });
                setAccessToken(response.accessToken);
                setOutlookError(null);
            } catch (err) {
                if (err instanceof InteractionRequiredAuthError) {
                    try {
                        const response = await instance.acquireTokenPopup({
                            scopes: ['Calendars.Read'],
                            account: accounts[0],
                        });
                        setAccessToken(response.accessToken);
                        setOutlookError(null);
                    } catch (popupErr) {
                        setOutlookError('Se requiere permiso para acceder al calendario.');
                    }
                } else {
                    // Si hay un error, intentamos obtener un nuevo token
                    try {
                        const response = await instance.acquireTokenPopup({
                            scopes: ['Calendars.Read'],
                            account: accounts[0],
                        });
                        setAccessToken(response.accessToken);
                        setOutlookError(null);
                    } catch (retryErr) {
                        setOutlookError('No se pudo obtener el token con permisos de calendario.');
                    }
                }
            }
        };

        getAccessToken();
    }, [instance, accounts]);

    // Agregar un efecto para reintentar la obtención del token cuando el componente se monte
    useEffect(() => {
        const checkAndRefreshToken = async () => {
            if (accounts && accounts.length > 0 && !accessToken) {
                try {
                    const response = await instance.acquireTokenSilent({
                        scopes: ['Calendars.Read'],
                        account: accounts[0],
                    });
                    setAccessToken(response.accessToken);
                    setOutlookError(null);
                } catch (err) {
                    // Si falla el token silencioso, intentamos con popup
                    try {
                        const response = await instance.acquireTokenPopup({
                            scopes: ['Calendars.Read'],
                            account: accounts[0],
                        });
                        setAccessToken(response.accessToken);
                        setOutlookError(null);
                    } catch (popupErr) {
                        setOutlookError('No se pudo obtener el token con permisos de calendario.');
                    }
                }
            }
        };

        // Verificar el token cada 5 minutos
        const intervalId = setInterval(checkAndRefreshToken, 5 * 60 * 1000);
        
        // Verificar inmediatamente al montar el componente
        checkAndRefreshToken();

        return () => clearInterval(intervalId);
    }, [instance, accounts, accessToken]);

    const transformEvents = (apiData) => {
        console.log(apiData);
        return apiData.map((item) => {
            return {
                _id: item.id_calendar,
                title: item.nombre_calendar,
                start: item.fechaIni_calendar,
                end: item.fechaFin_calendar,
                start_one: item.fechaIni_calendar,
                end_two: item.fechaFin_calendar,
                timeUno: item.horaInicio_calendar,
                timeDos: item.horaFinal_calendar,
                descs: item.decrip_calendar,
                lead: item.id_lead,
                cita: item.cita_lead,
                category: item.categoria,
                name_admin: item.name_admin,
                className: "evento-especial",
                eventColor: item.color_calendar,
                nombre_lead: item.nombre_lead,
                practicante: '' // Agregamos campo practicante vacío para eventos normales
            };
        });
    };

    // Obtener eventos de Outlook
    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // Primero cargar los eventos del calendario principal
                const result = await dispatch(get_Calendar());
                const transformedEvents = transformEvents(result);
                setEvents(transformedEvents);
                setIsLoading(false);

                // Luego intentar cargar los eventos de Outlook si hay token
                if (accessToken) {
                    const startDate = new Date().toISOString();
                    const endDate = new Date();
                    endDate.setFullYear(endDate.getFullYear() + 1);
                    const endDateISO = endDate.toISOString();

                    const url = `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDate}&endDateTime=${endDateISO}&$orderby=start/dateTime&$top=100`;

                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'outlook.timezone=\"America/Costa_Rica\"',
                        },
                    });

                    if (!response.ok) {
                        throw new Error(`Error HTTP ${response.status}`);
                    }

                    const data = await response.json();
                    if (data && data.value) {
                        const outlookEvents = data.value.map(event => ({
                            _id: event.id,
                            title: event.subject,
                            start: event.start.dateTime,
                            end: event.end.dateTime,
                            start_one: event.start.dateTime,
                            end_two: event.end.dateTime,
                            timeUno: event.start.dateTime.split('T')[1],
                            timeDos: event.end.dateTime.split('T')[1],
                            descs: event.bodyPreview || 'Sin descripción', // Usamos bodyPreview como descripción
                            lead: 'No aplica',
                            cita: false,
                            category: 'categoria6',
                            name_admin: event.organizer?.emailAddress.name || 'No especificado',
                            className: "evento-especial",
                            eventColor: '#808080',
                            nombre_lead: 'No aplica',
                            practicante: event.attendees?.map(a => a.emailAddress.name).join(', ') || 'No hay participantes' // Usamos los asistentes como practicantes
                        }));

                        setEvents(prevEvents => [...prevEvents, ...outlookEvents]);
                        setOutlookError(null);
                    }
                }
            } catch (err) {
                setOutlookError(`Error al obtener eventos de Outlook: ${err.message}`);
            }
        };

        fetchEvents();
    }, [accessToken, dispatch]);

    const handleFilterChange = (selected) => {
        setSelectedFilters(selected || []);
    };

    const filteredEvents = selectedFilters.length > 0 ? events.filter((event) => selectedFilters.some((filter) => filter.value === event.category)) : events;

    const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
        setCurrentView(window.innerWidth < 768 ? "listWeek" : "dayGridMonth");
    };

    useEffect(() => {
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    const handleEventClick = (info) => {
        const eventDetails = info.event.extendedProps;

        // Verifica si el tooltip existe y elimínalo
        if (info.el.tooltip) {
            document.body.removeChild(info.el.tooltip);
            delete info.el.tooltip;
        }

        // Si es un evento de Outlook, mostrar alerta en lugar de navegar
        if (eventDetails.category === 'categoria6') {
            alert(`
                Título: ${info.event.title}
                Inicio: ${info.event.start.toLocaleString()}
                Fin: ${info.event.end.toLocaleString()}
                ${info.event.extendedProps.descs ? `\nParticipantes: ${info.event.extendedProps.descs}` : ''}
                ${info.event.extendedProps.name_admin ? `\nOrganizador: ${info.event.extendedProps.name_admin}` : ''}
            `);
        } else {
            // Redirigir a la página de edición del evento
            navigate(`/events/actions?idCalendar=${eventDetails._id}&idLead=${eventDetails.lead}&idDate=0`);
        }
    };

    const handleDateClick = (arg) => {
        navigate(`/events/actions?idCalendar=0&idLead=0&idDate=${arg.dateStr}`);
    };

    const CreatedEvents = () => {
        const today = new Date().toISOString().split("T")[0];
        navigate(`/events/actions?idCalendar=0&idLead=0&idDate=${today}`);
    };

    const handleEventDrop = async (info) => {
        const eventDetails = info.event.extendedProps;
        
        // Si es un evento de Outlook, no permitir mover
        if (eventDetails.category === 'categoria6') {
            info.revert();
            return;
        }

        const year = info.event.start.getFullYear();
        const month = String(info.event.start.getMonth() + 1).padStart(2, "0");
        const day = String(info.event.start.getDate()).padStart(2, "0");
        const eventDate = `${year}-${month}-${day}`;
        const start = `${eventDate}T${eventDetails.timeUno}`;
        const end = `${eventDate}T${eventDetails.timeDos}`;

        await dispatch(moveEvenOtherDate(eventDetails._id, start, end));
    };

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>CALENDARIO</h5>
            </div>
            {outlookError && (
                <div className="alert alert-danger" role="alert" style={{ margin: '10px' }}>
                    <strong>⚠️ Error de Outlook:</strong> {outlookError}
                    <br />
                    <small>Para ver los eventos de Outlook, por favor inicie sesión con su cuenta de Microsoft.</small>
                    <br />
                    <button 
                        className="btn btn-sm btn-primary mt-2" 
                        onClick={() => {
                            if (accounts && accounts.length > 0) {
                                instance.acquireTokenPopup({
                                    scopes: ['Calendars.Read'],
                                    account: accounts[0],
                                }).then(response => {
                                    setAccessToken(response.accessToken);
                                    setOutlookError(null);
                                }).catch(err => {
                                    setOutlookError('No se pudo obtener el token con permisos de calendario.');
                                });
                            }
                        }}
                    >
                        Reintentar conexión
                    </button>
                </div>
            )}
            <div className="row">
                <div className="col-xxl-2 col-md-6">
                    <div className="price-card card">
                        <div className="price-head bg-light-primary card-body">
                            <h5 className="text-primary">FILTRO</h5>
                            <div className="price-icon bg-light-primary">
                                <i className="ph-duotone ph-rocket text-primary"></i>
                            </div>
                        </div>
                        <div className="card-body">
                            {isMobile ? (
                                <Select
                                    components={makeAnimated()}
                                    isMulti
                                    closeMenuOnSelect={false}
                                    options={filterOptions}
                                    value={selectedFilters}
                                    onChange={handleFilterChange}
                                    placeholder="Selecciona filtros"
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            fontSize: "18px",
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            fontSize: "18px",
                                        }),
                                    }}
                                />
                            ) : (
                                filterOptions.map((option) => (
                                    <div key={option.value} className={`form-check mb-3`} style={{ fontSize: "20px" }}>
                                        <input
                                            className="form-check-input category-checkbox"
                                            type="checkbox"
                                            id={`formCheckcolor${option.value}`}
                                            value={option.value}
                                            checked={selectedFilters.some((filter) => filter.value === option.value)}
                                            onChange={() => {
                                                const isSelected = selectedFilters.some((filter) => filter.value === option.value);
                                                if (isSelected) {
                                                    setSelectedFilters(selectedFilters.filter((filter) => filter.value !== option.value));
                                                } else {
                                                    setSelectedFilters([...selectedFilters, option]);
                                                }
                                            }}
                                            style={{
                                                backgroundColor: getColor(option.value),
                                                borderColor: getColor(option.value),
                                            }}
                                        />
                                        <label className="form-check-label" htmlFor={`formCheckcolor${option.value}`} style={{ color: getColor(option.value) }}>
                                            {option.label}
                                        </label>
                                    </div>
                                ))
                            )}
                            <div className="d-grid">
                                <button className="btn btn-dark" onClick={() => CreatedEvents()}>
                                    Crear evento
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xxl-10 col-md-6">
                    {isLoading ? (
                        <div className="preloader">
                            <p>Cargando eventos...</p>
                        </div>
                    ) : (
                        <FullCalendar
                            plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
                            initialView={currentView}
                            locale={esLocale}
                            headerToolbar={{
                                left: "prev,next today",
                                center: "title",
                                right: currentView === "dayGridMonth" ? "dayGridMonth,listWeek" : "listWeek",
                            }}
                            events={filteredEvents}
                            dateClick={handleDateClick}
                            eventDidMount={(info) => {
                                info.el.style.backgroundColor = info.event.extendedProps.eventColor;
                                info.el.style.borderColor = info.event.extendedProps.eventColor;
                                info.el.style.color = "white";

                                info.el.addEventListener("mouseenter", () => {
                                    info.el.style.backgroundColor = "#d3d3d3";
                                    info.el.style.color = "black";

                                    const tooltip = document.createElement("div");
                                    tooltip.innerHTML = `
                                        <strong>Administrador:</strong> ${info.event.extendedProps.name_admin} <br>
                                        <strong>Evento:</strong> ${info.event.title} <br>
                                        <strong>Descripción:</strong> ${info.event.extendedProps.descs}<br>
                                        ${info.event.extendedProps.nombre_lead !== 'No aplica' ? `<strong>Cliente:</strong> ${info.event.extendedProps.nombre_lead}` : ''}
                                        ${info.event.extendedProps.practicante ? `<br><strong>Practicante:</strong> ${info.event.extendedProps.practicante}` : ''}
                                    `;
                                    tooltip.style.position = "absolute";
                                    tooltip.style.backgroundColor = "white";
                                    tooltip.style.color = "black";
                                    tooltip.style.border = "1px solid #ccc";
                                    tooltip.style.padding = "5px";
                                    tooltip.style.borderRadius = "5px";
                                    tooltip.style.zIndex = 1000;

                                    document.body.appendChild(tooltip);

                                    const rect = info.el.getBoundingClientRect();
                                    tooltip.style.left = `${rect.left + window.scrollX}px`;
                                    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight}px`;

                                    info.el.tooltip = tooltip;
                                });

                                info.el.addEventListener("mouseleave", () => {
                                    info.el.style.backgroundColor = info.event.extendedProps.eventColor;
                                    info.el.style.color = "white";
                                    if (info.el.tooltip) {
                                        document.body.removeChild(info.el.tooltip);
                                        delete info.el.tooltip;
                                    }
                                });
                            }}
                            eventClick={handleEventClick}
                            editable={true}
                            eventDrop={handleEventDrop}
                            style={{ width: "100%" }}
                            eventContent={renderEventContent}
                            height={1000}
                            contentHeight={800}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

function renderEventContent(eventInfo) {
    return (
        <div style={{ 
            whiteSpace: 'normal', 
            wordBreak: 'break-word',
            lineHeight: '1.2',
            fontSize: '0.9em'
        }}>
            <b>{eventInfo.timeText}</b>
            <br />
            <i>{eventInfo.event.title}</i>
        </div>
    );
}
