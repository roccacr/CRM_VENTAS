import React, { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid"; // Vista mensual
import listPlugin from "@fullcalendar/list"; // Vista de lista
import esLocale from "@fullcalendar/core/locales/es"; // Localización en español
import Select from "react-select";
import makeAnimated from "react-select/animated"; // Para la animación de selección

// Lista inicial de eventos con los campos adicionales y el color
const initialEvents = [
    {
        _id: "1",
        title: "Llamada de Contacto",
        start: "2024-09-24T10:30:00",
        end: "2024-09-24T12:30:00",
        timeUno: "10:30",
        timeDos: "12:30",
        color: "#556ee6",
        descs: "Descripción de la llamada",
        lead: "123",
        cita: "456",
        category: "Contactos",
        name_admin: "Admin 1",
        className: "evento-especial",
        eventColor: "#556ee6",
    },
    {
        _id: "2",
        title: "Reunión con equipo",
        start: "2024-09-25T09:00:00",
        end: "2024-09-25T11:00:00",
        timeUno: "09:00",
        timeDos: "11:00",
        color: "#34c38f",
        descs: "Reunión importante",
        lead: "124",
        cita: "457",
        category: "Reunion",
        name_admin: "Admin 2",
        className: "evento-especial",
        eventColor: "#34c38f",
    },
];

// Filtros iniciales (opciones del select)
const filterOptions = [
    { value: "Contactos", label: "Contactos" },
    { value: "Tareas", label: "Tareas" },
    { value: "Reunion", label: "Reunion" },
    { value: "Seguimientos", label: "Seguimientos" },
    { value: "Primeras Citas", label: "Primeras Citas" },
];

// Componente principal
export const View_calendars = () => {
    const [events, setEvents] = useState(initialEvents);
    const [selectedFilters, setSelectedFilters] = useState([]); // Inicialmente vacío
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768); // Estado para manejar si es móvil
    const [currentView, setCurrentView] = useState(window.innerWidth < 768 ? "listWeek" : "dayGridMonth");

    // Manejar el cambio de selección de filtros
    const handleFilterChange = (selected) => {
        setSelectedFilters(selected || []); // Guardar las selecciones en el estado
    };

    // Filtrar los eventos basados en los filtros activos
    const filteredEvents = selectedFilters.length > 0 ? events.filter((event) => selectedFilters.some((filter) => filter.value === event.category)) : events; // Mostrar todos los eventos si no hay filtros seleccionados

    // Manejar el cambio de vista al cambiar el tamaño de la pantalla y si es móvil
    const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
        setCurrentView(window.innerWidth < 768 ? "listWeek" : "dayGridMonth");
    };

    // Añadir un listener para el evento de redimensionar la ventana
    useEffect(() => {
        window.addEventListener("resize", handleResize);

        // Cleanup el listener cuando el componente se desmonte
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

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
                            {/* Mostrar Select solo en modo móvil */}
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
                                            fontSize: "18px", // Aumenta el tamaño de las opciones
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            fontSize: "18px", // Aumenta el tamaño del menú
                                        }),
                                    }}
                                />
                            ) : (
                                // Mostrar checkboxes solo en modo PC
                                <ul className="list-unstyled product-list">
                                    {filterOptions.map((option) => (
                                        <li key={option.value} style={{ fontSize: "18px", padding: "10px 0" }}>
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFilters.some((filter) => filter.value === option.value)}
                                                    onChange={() => {
                                                        const isSelected = selectedFilters.some((filter) => filter.value === option.value);
                                                        if (isSelected) {
                                                            setSelectedFilters(selectedFilters.filter((filter) => filter.value !== option.value));
                                                        } else {
                                                            setSelectedFilters([...selectedFilters, option]);
                                                        }
                                                    }}
                                                />{" "}
                                                {option.label}
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
                <div className="col-xxl-9 col-md-6">
                    <FullCalendar
                        plugins={[dayGridPlugin, listPlugin]} // Agregar el plugin de vista de lista
                        initialView={currentView} // La vista inicial es dinámica dependiendo del tamaño de la ventana
                        locale={esLocale} // Configurar el calendario en español
                        headerToolbar={{
                            left: "prev,next today",
                            center: "title",
                            right: currentView === "dayGridMonth" ? "dayGridMonth,listWeek" : "listWeek", // Mostrar solo listWeek si es responsive
                        }}
                        events={filteredEvents} // Lista de eventos con colores filtrados
                        eventDidMount={(info) => {
                            // Asegurar que los colores se apliquen también en la vista de mes
                            info.el.style.backgroundColor = info.event.extendedProps.eventColor;
                            info.el.style.borderColor = info.event.extendedProps.eventColor;
                            info.el.style.color = "white"; // Cambiar el color del texto a blanco

                            // Agregar eventos de mouseover y mouseout para cambiar color al pasar el mouse
                            info.el.addEventListener("mouseenter", () => {
                                info.el.style.backgroundColor = "#d3d3d3"; // Color gris
                                info.el.style.color = "black"; // Texto negro
                            });
                            info.el.addEventListener("mouseleave", () => {
                                info.el.style.backgroundColor = info.event.extendedProps.eventColor; // Restaurar color original
                                info.el.style.color = "white"; // Restaurar texto blanco
                            });
                        }}
                        eventContent={renderEventContent} // Renderizado personalizado de eventos
                        height={1000} // Fijar la altura a 1000px
                        contentHeight={800} // Ajusta este valor para hacer el calendario más alto o más bajo
                    />
                </div>
            </div>
        </div>
    );
};

// Render personalizado de los eventos
function renderEventContent(eventInfo) {
    return (
        <>
            <b>{eventInfo.timeText}</b>
            <i>{eventInfo.event.title}</i>
        </>
    );
}
