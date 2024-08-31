import { createSlice, createSelector } from "@reduxjs/toolkit";
import { subDays } from "date-fns";

// Slice de Redux para gestionar el estado de los leads
export const HomeSlice = createSlice({
    name: "Home", // Nombre del slice
    initialState: {
        listNew: [], // Lista de leads nuevos
        listAttention: [], // Lista de leads que requieren atención
        listEvents: [], // Lista de eventos programados para hoy
        listOportunity: [], // Lista de oportunidades de lead
        listOrderSale: [], // Lista de oportunidades de lead
        listOrderSalePending: [], // Lista de oportunidades de lead
        status: "idle", // Estado de la operación: puede ser 'idle', 'loading', 'succeeded', o 'failed'
        error: null, // Mensaje de error en caso de fallo
        currentLead: null, // Lead actualmente seleccionado
    },
    reducers: {
        // Acción para actualizar la lista de leads nuevos
        setLeadsNew: (state, action) => {
            state.listNew = action.payload; // Establece los leads nuevos
            state.status = "succeeded"; // Indica que la operación fue exitosa
        },
        // Acción para actualizar la lista de leads que requieren atención
        setLeadsAttention: (state, action) => {
            state.listAttention = action.payload; // Establece los leads que requieren atención
            state.status = "succeeded"; // Indica que la operación fue exitosa
        },
        // Acción para actualizar la lista de eventos programados
        setEventsAttention: (state, action) => {
            state.listEvents = action.payload; // Establece los eventos programados para hoy
            state.status = "succeeded"; // Indica que la operación fue exitosa
        },
        // Acción para actualizar la lista de oportunidades
        setOportunityAttention: (state, action) => {
            state.listOportunity = action.payload; // Establece la lista de oportunidades
            state.status = "succeeded"; // Indica que la operación fue exitosa
        },
        setOrderSaleAttention: (state, action) => {
            state.listOrderSale = action.payload; // Establece la lista de oportunidades
            state.status = "succeeded"; // Indica que la operación fue exitosa
        },
        setOrderSalePendingAttention: (state, action) => {
            state.listOrderSalePending = action.payload; // Establece la lista de oportunidades
            state.status = "succeeded"; // Indica que la operación fue exitosa
        },
        // Acción para establecer el estado de carga
        setLoading: (state) => {
            state.status = "loading"; // Establece el estado como 'loading'
        },
        // Acción para manejar errores
        setError: (state, action) => {
            state.status = "failed"; // Establece el estado como 'failed'
            state.error = action.payload; // Almacena el mensaje de error
        },
        // Acción para limpiar todas las listas de leads y eventos
        setClearList: (state) => {
            state.listNew = []; // Limpia la lista de leads nuevos
            state.listAttention = []; // Limpia la lista de leads que requieren atención
            state.listEvents = []; // Limpia la lista de eventos
            state.listOportunity = []; // Limpia la lista de oportunidades
        },
        // Acción para actualizar el estado de un evento específico
        updateEventStatus: (state, action) => {
            const { id_calendar, accion_calendar } = action.payload; // Extrae id y acción del payload
            const eventIndex = state.listEvents.findIndex((event) => event.id_calendar === id_calendar); // Busca el índice del evento en la lista
            if (eventIndex !== -1) {
                state.listEvents[eventIndex].accion_calendar = accion_calendar; // Actualiza la acción del evento
            }
        },
    },
});

// Exportación de las acciones para ser usadas en el componente
export const { setLeadsNew, setLeadsAttention, setEventsAttention, setOportunityAttention, setOrderSaleAttention, setOrderSalePendingAttention, setLoading, setError, setClearList, updateEventStatus } = HomeSlice.actions;

// Selectores para acceder a partes específicas del estado

// Selector para obtener la lista de leads nuevos
const selectLeadsNew = (state) => state.lead.listNew;

// Selector para obtener la lista de leads que requieren atención
const selectLeadsAttention = (state) => state.lead.listAttention;

// Selector para obtener la lista de eventos
const selectEvents = (state) => state.lead.listEvents;

// Selector para obtener la lista de oportunidades de leads
const selectLeadOpportunities = (state) => state.lead.listOportunity;


// Selector para obtener la lista de Ordenes de venta de leads
const selectLeadOrderSale = (state) => state.lead.listOrderSale;

// Selector para obtener la lista de Ordenes de venta pendientes de cheks de leads
const selectLeadOrderSale_pending = (state) => state.lead.listOrderSalePending;

// Selector para contar el número de leads nuevos
export const selectFilteredLeadsCount = createSelector(
    [selectLeadsNew],
    (leads) => (leads ? leads.length : 0), // Retorna la cantidad de leads nuevos, o 0 si no hay
);

// Selector para contar los leads que requieren atención y filtrar según ciertas condiciones
export const selectFilteredLeadsAttentionCount = createSelector([selectLeadsAttention], (leads) => {
    if (!leads) return 0; // Si no hay leads, retorna 0

    // Fecha límite de hace 4 días
    const dateLimit = subDays(new Date(), 4);

    // Filtrar los leads que cumplen las condiciones
    const filteredLeads = leads.filter((lead) => {
        const actualizadaAccionLead = new Date(lead.actualizadaaccion_lead.split("T")[0]); // Quitar el timestamp
        return (
            lead.accion_lead === 3 && // Condición de acción del lead
            lead.estado_lead === 1 && // Condición de estado del lead
            lead.seguimiento_calendar === 0 && // Sin seguimiento en calendario
            actualizadaAccionLead <= dateLimit && // Fecha de última acción dentro del límite
            !["02-LEAD-OPORTUNIDAD", "03-LEAD-PRE-RESERVA", "04-LEAD-RESERVA", "05-LEAD-CONTRATO", "06-LEAD-ENTREGADO"].includes(lead.seguimiento_lead) // Excluir ciertos tipos de seguimiento
        );
    });

    // Retorna la cantidad de leads filtrados
    return filteredLeads.length;
});

// Selector para contar los eventos pendientes para hoy
export const selectFilteredEventsCount = createSelector([selectEvents], (events) => {
    if (!events) return 0; // Si no hay eventos, retorna 0

    // Fecha de hoy ajustada a GMT-6 (Costa Rica)
    const now = new Date();
    now.setHours(now.getHours() - 6); // Ajuste para la zona horaria GMT-6
    const today = now.toISOString().split("T")[0]; // Obtener solo la fecha

    // Filtrar los eventos que coinciden con la fecha de hoy
    const filteredEvents = events.filter((event) => {
        const eventDate = event.fechaIni_calendar.split("T")[0]; // Extraer solo la fecha del evento
        return eventDate === today; // Verificar si el evento es hoy
    });

    // Retorna la cantidad de eventos filtrados
    return filteredEvents.length;
});

// Selector para obtener los eventos programados para hoy y mañana con acción pendiente
export const selectEventsForTodayAndTomorrow = createSelector([selectEvents], (events) => {
    // Fecha actual ajustada a GMT-6
    const now = new Date();
    now.setHours(now.getHours() - 6);

    // Fecha de mañana ajustada a GMT-6
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0]; // Obtener solo la fecha de mañana

    // Filtrar eventos con acción pendiente para hoy y mañana
    const filteredEvents = events.filter((event) => {
        const eventDate = event.fechaIni_calendar.match(/^\d{4}-\d{2}-\d{2}/)[0]; // Extraer solo la fecha
        return eventDate <= tomorrowDate && event.accion_calendar === "Pendiente"; // Comparar fechas y acción pendiente
    });

    // Retornar los eventos filtrados
    return filteredEvents;
});

// Selector para contar las oportunidades de leads
export const selectFilteredOpportunityCount = createSelector(
    [selectLeadOpportunities],
    (opportunities) => (opportunities ? opportunities.length : 0), // Retorna la cantidad de oportunidades o 0 si no hay
);


// Selector para contar las ordenes de venta de leads
export const selectFilteredOrderSaleCount = createSelector(
    [selectLeadOrderSale],
    (orderSale) => (orderSale ? orderSale.length : 0), // Retorna la cantidad de oportunidades o 0 si no hay
);

// Selector para contar las ordenes de venta pendeinte de chek de leads
export const selectLeadOrderSale_pendingCount = createSelector(
    [selectLeadOrderSale_pending],
    (orderSal) => (orderSal ? orderSal.length : 0), // Retorna la cantidad de oportunidades o 0 si no hay
);


// Exportación del reducer del slice para usar en el store
export default HomeSlice.reducer;
