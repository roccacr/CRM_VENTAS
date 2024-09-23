import React, { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid"; // Vista mensual
import listPlugin from "@fullcalendar/list"; // Vista de lista
import esLocale from "@fullcalendar/core/locales/es"; // Localización en español
import "./calendario.css"; // Asegúrate de crear y enlazar este archivo CSS

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

    // Añadir los colores según el tipo de evento
    const coloredEvents = events.map((event) => ({
        ...event,
        backgroundColor: colores[event.type], // Asignar el color según el tipo
        borderColor: colores[event.type], // Asignar el color del borde
    }));

    return (
        <div className="card calendar-card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>MÓDULO DE LEADS NUEVOS</h5>
            </div>

            <FullCalendar
                plugins={[dayGridPlugin, listPlugin]} // Agregar el plugin de vista de lista
                initialView="dayGridMonth" // La vista por defecto es la mensual
                locale={esLocale} // Configurar el calendario en español
                headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,listWeek", // Habilitar cambio entre mes y lista semanal
                }}
                events={coloredEvents} // Lista de eventos con colores
                eventContent={renderEventContent} // Renderizado personalizado de eventos
                height="auto" // Hacer que el calendario se ajuste automáticamente
                dayMaxEventRows={true} // Limitar la cantidad de eventos visibles por día en la vista mensual
                moreLinkText="más" // Cambiar el texto para los eventos adicionales
                eventDisplay="block" // Mostrar eventos como bloques en dispositivos móviles
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
