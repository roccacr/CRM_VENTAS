

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
