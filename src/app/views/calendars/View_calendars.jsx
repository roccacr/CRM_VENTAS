import React, { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid"; // Vista mensual
import listPlugin from "@fullcalendar/list"; // Vista de lista
import esLocale from "@fullcalendar/core/locales/es"; // Localización en español

// Definir los colores para los diferentes tipos de eventos
const colores = {
    Llamada: "#556ee6",
    Whatsapp: "#556ee6",
    Correo: "#556ee6",
    Tarea: "#343a40",
    Reunion: "#34c38f",
    Seguimientos: "#f46a6a",
};

// Lista de eventos con tipos
const initialEvents = [
    { title: "Llamada con cliente", start: "2024-09-24T10:30:00", end: "2024-09-24T12:30:00", type: "Llamada" },
    { title: "Reunion con equipo", start: "2024-09-25T09:00:00", end: "2024-09-25T11:00:00", type: "Reunion" },
    { title: "Enviar Correo", start: "2024-09-26T12:00:00", end: "2024-09-26T13:00:00", type: "Correo" },
    { title: "Seguimiento", start: "2024-09-27", allDay: true, type: "Seguimientos" },
];

export const View_calendars = () => {
    const [events, setEvents] = useState(initialEvents);
    const [currentView, setCurrentView] = useState(window.innerWidth < 768 ? "listWeek" : "dayGridMonth");

    // Añadir los colores según el tipo de evento
    const coloredEvents = events.map((event) => ({
        ...event,
        backgroundColor: colores[event.type], // Asignar el color según el tipo
        borderColor: colores[event.type], // Asignar el color del borde
    }));

    // Manejar el cambio de vista al cambiar el tamaño de la pantalla
    const handleResize = () => {
        if (window.innerWidth < 768) {
            setCurrentView("listWeek");
        } else {
            setCurrentView("dayGridMonth");
        }
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
                <h5>CALENADRIO</h5>
            </div>

            <FullCalendar
                plugins={[dayGridPlugin, listPlugin]} // Agregar el plugin de vista de lista
                initialView={currentView} // La vista inicial es dinámica dependiendo del tamaño de la ventana
                locale={esLocale} // Configurar el calendario en español
                headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: currentView === "dayGridMonth" ? "dayGridMonth,listWeek" : "listWeek", // Mostrar solo listWeek si es responsive
                }}
                events={coloredEvents} // Lista de eventos con colores
                eventContent={renderEventContent} // Renderizado personalizado de eventos
                height={1000} // Fijar la altura a 1500px
                contentHeight={800} // Ajusta este valor para hacer el calendario más alto o más bajo
            />
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
