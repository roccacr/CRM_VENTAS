export const handleEventClick = (info) => {
    // Muestra el nombre del evento al hacer clic
    alert(`Evento seleccionado: ${info.event.title}`);
};

export const handleEventDrop = (info) => {
    // Muestra la nueva fecha del evento cuando es movido
    // alert(`El evento "${info.event.title}" se ha movido a ${info.event.start.toISOString().slice(0, 10)}`);
};
