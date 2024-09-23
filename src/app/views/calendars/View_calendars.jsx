import React, { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid"; // Vista mensual
import listPlugin from "@fullcalendar/list"; // Vista de lista
import esLocale from "@fullcalendar/core/locales/es"; // Localización en español
import Select from "react-select";
import makeAnimated from "react-select/animated"; // Para la animación de selección

// Definir los colores para los diferentes tipos de eventos
const colores = {
    Llamada: "#556ee6",
    Whatsapp: "#556ee6",
    Correo: "#f39c12",
    Tarea: "#343a40",
    Reunion: "#34c38f",
    Seguimientos: "#f46a6a",
};

// Lista inicial de eventos con tipos
const initialEvents = [
    { title: "Llamada con cliente", start: "2024-09-24T10:30:00", end: "2024-09-24T12:30:00", type: "Llamada" },
    { title: "Reunion con equipo", start: "2024-09-25T09:00:00", end: "2024-09-25T11:00:00", type: "Reunion" },
    { title: "Enviar Correo", start: "2024-09-26T12:00:00", end: "2024-09-26T13:00:00", type: "Correo" },
    { title: "Seguimiento", start: "2024-09-27", allDay: true, type: "Seguimientos" },
];

// Filtros iniciales (opciones del select)
const filterOptions = [
    { value: "Llamada", label: "Llamada" },
    { value: "Reunion", label: "Reunion" },
    { value: "Correo", label: "Correo" },
    { value: "Seguimientos", label: "Seguimientos" },
];

// Componente principal
export const View_calendars = () => {
    const [events, setEvents] = useState(initialEvents);
    const [selectedFilters, setSelectedFilters] = useState(filterOptions); // Mantiene las opciones seleccionadas
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768); // Estado para manejar si es móvil
    const [currentView, setCurrentView] = useState(window.innerWidth < 768 ? "listWeek" : "dayGridMonth");

    // Manejar el cambio de selección de filtros
    const handleFilterChange = (selected) => {
        setSelectedFilters(selected || []);
    };

    // Filtrar los eventos basados en los filtros activos
    const filteredEvents = events.filter((event) => selectedFilters.some((filter) => filter.value === event.type));

    // Añadir los colores según el tipo de evento
    const coloredEvents = filteredEvents.map((event) => ({
        ...event,
        backgroundColor: colores[event.type], // Asignar el color según el tipo
        borderColor: colores[event.type], // Asignar el color del borde
    }));

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
                <div className="col-xxl-3 col-md-6">
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
                                        <li key={option.value}>
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
                        events={coloredEvents} // Lista de eventos con colores filtrados
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
