import React, { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction"; // Asegúrate de tener instalado este plugin
import esLocale from "@fullcalendar/core/locales/es";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import { get_Calendar } from "../../../store/calendar/thunkscalendar";
import { useDispatch } from "react-redux";
import { handleEventDrop } from "./eventActions"; // Importa las funciones de eventos
import { useNavigate } from "react-router-dom";

const filterOptions = [
    { value: "categoria1", label: "Contactos" },
    { value: "categoria2", label: "Tareas" },
    { value: "categoria3", label: "Reunion" },
    { value: "categoria4", label: "Seguimientos" },
    { value: "categoria5", label: "Primeras Citas" },
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

    const transformEvents = (apiData) => {
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
            };
        });
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const result = await dispatch(get_Calendar());
            const transformedEvents = transformEvents(result);
            setEvents(transformedEvents);
        } catch (error) {
            console.error("Error al cargar los eventos", error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

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
            delete info.el.tooltip; // Limpiar referencia
        }

        // Redirigir a la página de edición del evento
        navigate(`/events/actions?idCalendar=${eventDetails._id}&idLead=${eventDetails.lead}&idDate=0`);
    };

    const handleDateClick = (arg) => {
        // Redirigir a la página de creación de eventos con la fecha seleccionada
        navigate(`/events/actions?idCalendar=0&idLead=0&idDate=${arg.dateStr}`);
    };

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>CALENDARIO</h5>
            </div>
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
                                <button className="btn btn-dark">crear evento</button>
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
                            plugins={[dayGridPlugin, listPlugin, interactionPlugin]} // Agrega el plugin de interacción
                            initialView={currentView}
                            locale={esLocale}
                            headerToolbar={{
                                left: "prev,next today",
                                center: "title",
                                right: currentView === "dayGridMonth" ? "dayGridMonth,listWeek" : "listWeek",
                            }}
                            events={filteredEvents}
                            dateClick={handleDateClick} // Agrega la función para manejar el click en una fecha
                            eventDidMount={(info) => {
                                info.el.style.backgroundColor = info.event.extendedProps.eventColor;
                                info.el.style.borderColor = info.event.extendedProps.eventColor;
                                info.el.style.color = "white";

                                info.el.addEventListener("mouseenter", () => {
                                    info.el.style.backgroundColor = "#d3d3d3";
                                    info.el.style.color = "black";

                                    // Crear tooltip
                                    const tooltip = document.createElement("div");
                                    tooltip.innerHTML = `
                                        <strong>Administrador:</strong> ${info.event.extendedProps.name_admin} <br>
                                        <strong>Evento:</strong> ${info.event.title} <br>
                                        <strong>Descripción:</strong> ${info.event.extendedProps.descs}<br>
                                        <strong>Cliente:</strong> ${info.event.extendedProps.nombre_lead}
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
                                    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight}px`; // Cambiar la posición para que esté arriba

                                    info.el.tooltip = tooltip; // Guardar referencia del tooltip en el evento
                                });

                                info.el.addEventListener("mouseleave", () => {
                                    info.el.style.backgroundColor = info.event.extendedProps.eventColor;
                                    info.el.style.color = "white";
                                    // Remover tooltip
                                    if (info.el.tooltip) {
                                        document.body.removeChild(info.el.tooltip);
                                        delete info.el.tooltip; // Limpiar referencia
                                    }
                                });
                            }}
                            eventClick={handleEventClick} // Llama la función al hacer clic en un evento
                            editable={true} // Habilitar edición (mover eventos)
                            eventDrop={handleEventDrop} // Llama la función al mover un evento
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
        <>
            <b>{eventInfo.timeText}</b> <i>{eventInfo.event.title}</i>
        </>
    );
}
