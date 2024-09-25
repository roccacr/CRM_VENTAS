export const handleEventClick = (info) => {
    const eventDetails = info.event.extendedProps;

    // Función para formatear la hora en formato 24 horas
    const formatHour = (timeString) => {
        const [time, modifier] = timeString.split(" ");
        let [hours, minutes] = time.split(":");

        if (modifier === "PM" && hours !== "12") hours = parseInt(hours, 10) + 12;
        if (modifier === "AM" && hours === "12") hours = "00";

        return `${hours.padStart(2, "0")}:${minutes}`;
    };

    // Concatenar la fecha y hora de inicio
    const startDateTime = `${info.event.start.toISOString().slice(0, 10)}T${formatHour(eventDetails.timeUno)}`;

    // Si no hay fecha de fin, usar la fecha de inicio
    const endDateTime = `${(info.event.end || info.event.start).toISOString().slice(0, 10)}T${formatHour(eventDetails.timeDos)}`;

    console.log("🚀 Evento seleccionado:", info.event.title);
    console.log("🚀 Fecha y Hora de inicio:", startDateTime);
    console.log("🚀 Fecha y Hora de fin:", endDateTime);

    

        console.log("🚀 ~ start one:", eventDetails._id);
    console.log("🚀 ~  start two:", eventDetails.end_two);
    
        console.log("🚀 ~ Hora de inicio:", eventDetails.timeUno);
        console.log("🚀 ~ Hora de fin:", eventDetails.timeDos);
};

export const handleEventDrop = (info) => {
    const eventDetails = info.event.extendedProps;

    console.log("🚀 ------------------------------------------------------------🚀");
    console.log("🚀 ~ Evento seleccionado:", info.event.title);
    console.log("🚀 ~ ID del evento:", eventDetails._id);
    console.log("🚀 ~ Descripción:", eventDetails.descs);
    console.log("🚀 ~ Fecha de inicio:", info.event.start);
    console.log("🚀 ~ Fecha de fin:", info.event.end);

        console.log("🚀 ~ start one:", eventDetails.start_one);
        console.log("🚀 ~  start two:", eventDetails.end_two);
    console.log("🚀 ~ Hora de inicio:", eventDetails.timeUno);
    console.log("🚀 ~ Hora de fin:", eventDetails.timeDos);
    console.log("🚀 ~ Lead:", eventDetails.lead);
    console.log("🚀 ~ Cita:", eventDetails.cita);
    console.log("🚀 ~ Categoría:", eventDetails.category);
    console.log("🚀 ~ Administrador:", eventDetails.name_admin);
    console.log("🚀 ~ Color del evento:", eventDetails.eventColor);
    console.log("🚀 ------------------------------------------------------------🚀");

    // Opcional: Puedes seguir mostrando el alert si es necesario

    // Muestra un mensaje con la nueva fecha del evento cuando es movido
    alert(`El evento "${eventDetails.timeUno}" se ha movido a ${info.event.start.toISOString().slice(0, 10)}`);
};
