import { createSlice, createSelector } from "@reduxjs/toolkit";
import { subDays } from "date-fns";

// Slice de Redux para gestionar leads
export const HomeSlice = createSlice({
    name: "Home",
    initialState: {
        listNew: [], // Lista de leads nuevos
        listAttention: [], // Lista de leads que requieren atención
        listEvents: [], // Lista de los eventos pendientes para hoy
        listOportunity: [], // Lista de los eventos pendientes para hoy
        status: "idle", // Estado de la operación (idle, loading, succeeded, failed)
        error: null, // Mensaje de error, si lo hay
        currentLead: null, // Lead actualmente seleccionado
    },
    reducers: {
        setLeadsNew: (state, action) => {
            state.listNew = action.payload; // Actualiza la lista de leads nuevos
            state.status = "succeeded"; // Indica que la operación fue exitosa
        },
        setLeadsAttention: (state, action) => {
            state.listAttention = action.payload; // Actualiza la lista de leads que requieren atención
            state.status = "succeeded"; // Indica que la operación fue exitosa
        },
        setEventsAttention: (state, action) => {
            state.listEvents = action.payload; // Actualiza la lista de eventos pendientes para hoy
            state.status = "succeeded"; // Indica que la operación fue exitosa
        },
        setLoading: (state) => {
            state.status = "loading"; // Indica que la información se está cargando
        },
        setError: (state, action) => {
            state.status = "failed"; // Indica que la operación falló
            state.error = action.payload; // Almacena el mensaje de error
        },
        setClearList: (state) => {
            state.listNew = []; // Lista de leads nuevos
            state.listAttention = []; // Lista de leads que requieren atención
            state.listEvents = []; // Lista de los eventos pendientes para hoy
            state.listOportunity = []; // Lista de los eventos pendientes para hoy
        },

    },
});

// Exportación de acciones
export const { setLeadsNew, setLeadsAttention,setEventsAttention, setLoading, setError,setClearList } = HomeSlice.actions;

// Selectores
const selectLeadsNew = (state) => state.lead.listNew;
const selectLeadsAttention = (state) => state.lead.listAttention;
const selectEvents = (state) => state.lead.listEvents;

// Selector para contar los leads nuevos
export const selectFilteredLeadsCount = createSelector([selectLeadsNew], (leads) => (leads ? leads.length : 0));

// Selector para contar los leads que requieren atención
export const selectFilteredLeadsAttentionCount = createSelector([selectLeadsAttention], (leads) => {
    if (!leads) return 0;

    // Obtener la fecha límite de hace 4 días
    const dateLimit = subDays(new Date(), 4);

    // Filtrar los leads que cumplan con las condiciones especificadas
    const filteredLeads = leads.filter((lead) => {
        // Eliminar el timestamp "T06:00:00.000Z" del campo actualizadaaccion_lead
        const actualizadaaccion_lead = new Date(lead.actualizadaaccion_lead.split("T")[0]);

        // Verificar si el lead cumple con todas las condiciones
        return lead.accion_lead === 3 && lead.estado_lead === 1 && lead.seguimiento_calendar === 0 && actualizadaaccion_lead <= dateLimit && !["02-LEAD-OPORTUNIDAD", "03-LEAD-PRE-RESERVA", "04-LEAD-RESERVA", "05-LEAD-CONTRATO", "06-LEAD-ENTREGADO"].includes(lead.seguimiento_lead);
    });

    // Retornar la cantidad de leads que cumplen con las condiciones
    return filteredLeads.length;
});



// Selector para contar los eventos pendientes para hoy
// Selector para obtener los eventos filtrados por fecha
export const selectFilteredEventsCount = createSelector([selectEvents], (events) => {
    if (!events) return 0;

    // Obtener la fecha de hoy ajustada a la hora de Costa Rica
    const now = new Date();
    now.setHours(now.getHours() - 6); // Ajuste para GMT-6
    const today = now.toISOString().split("T")[0];

    // Filtrar los eventos que coinciden con la fecha de hoy
    const filteredEvents = events.filter((event) => {
        // Extraer solo la fecha de "fechaIni_calendar"
        const eventDate = event.fechaIni_calendar.split("T")[0];

        // Comparar si la fecha del evento es igual a hoy
        return eventDate === today;
    });

    // Retornar la cantidad de eventos filtrados
    return filteredEvents.length;
});


// Selector para obtener los eventos para hoy y mañana
export const selectEventsForTodayAndTomorrow = createSelector([selectEvents], (events) => {
    // Obtener la fecha de hoy ajustada a la hora de Costa Rica
    const now = new Date();
    now.setHours(now.getHours() - 6); // Ajuste para GMT-6

    // Obtener la fecha de mañana ajustada a la hora de Costa Rica
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    // Filtrar los eventos que son anteriores o iguales a mañana
    const filteredEvents = events.filter((event) => {
        // Usar una expresión regular para extraer la fecha, ignorando la parte de la hora si está presente
        const eventDate = event.fechaIni_calendar.match(/^\d{4}-\d{2}-\d{2}/)[0];
        //console.log(eventDate);

        // Comparar si la fecha del evento es menor o igual a mañana
        return eventDate <= tomorrowDate;
    });

    // Retornar los eventos filtrados
    return filteredEvents;
});









// Exportación del reducer del slice
export default HomeSlice.reducer;
