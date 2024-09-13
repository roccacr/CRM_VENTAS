import { createSlice } from "@reduxjs/toolkit";

// Slice de Redux para gestionar el estado relacionado con los leads y eventos
export const HomeSlice = createSlice({
    name: "Home", // Nombre del slice
    initialState: {
        listNew: 0, // Cantidad de leads nuevos
        listAttention: 0, // Cantidad de leads que requieren atención
        listEvents: 0, // Cantidad de eventos programados
        listOportunity: 0, // Cantidad de oportunidades de lead
        listOrderSale: 0, // Cantidad de ventas cerradas
        listOrderSalePending: 0, // Cantidad de ventas pendientes
        listEventsPending: [], // Lista de eventos pendientes
        listGraficoKpi: [], // Lista de eventos pendientes
    },
    reducers: {
        /**
         * Actualiza la lista de leads nuevos.
         * @param {Object} state - El estado actual del slice.
         * @param {Object} action - La acción que contiene el payload con el nuevo valor.
         */
        setLeadsNew: (state, action) => {
            state.listNew = action.payload;
        },

        /**
         * Actualiza la lista de leads que requieren atención.
         * @param {Object} state - El estado actual del slice.
         * @param {Object} action - La acción que contiene el payload con el nuevo valor.
         */
        setlistAttentions: (state, action) => {
            state.listAttention = action.payload;
        },

        /**
         * Actualiza la lista de eventos programados.
         * @param {Object} state - El estado actual del slice.
         * @param {Object} action - La acción que contiene el payload con el nuevo valor.
         */
        setListEvents: (state, action) => {
            state.listEvents = action.payload;
        },

        /**
         * Actualiza la lista de oportunidades de lead.
         * @param {Object} state - El estado actual del slice.
         * @param {Object} action - La acción que contiene el payload con el nuevo valor.
         */
        setListOportunity: (state, action) => {
            state.listOportunity = action.payload;
        },

        /**
         * Actualiza la lista de ventas cerradas.
         * @param {Object} state - El estado actual del slice.
         * @param {Object} action - La acción que contiene el payload con el nuevo valor.
         */
        setListOrderSale: (state, action) => {
            state.listOrderSale = action.payload;
        },

        /**
         * Actualiza la lista de ventas pendientes.
         * @param {Object} state - El estado actual del slice.
         * @param {Object} action - La acción que contiene el payload con el nuevo valor.
         */
        setListOrderSalePending: (state, action) => {
            state.listOrderSalePending = action.payload;
        },

        /**
         * Actualiza la lista de eventos pendientes.
         * @param {Object} state - El estado actual del slice.
         * @param {Object} action - La acción que contiene el payload con el nuevo valor.
         */
        setlistEventsPending: (state, action) => {
            state.listEventsPending = action.payload;
        },

        /**
         * Actualiza la lista de eventos pendientes.
         * @param {Object} state - El estado actual del slice.
         * @param {Object} action - La acción que contiene el payload con el nuevo valor.
         */
        setlistGraficoKpi: (state, action) => {
            state.listGraficoKpi = action.payload;
        },
        /**
         * Actualiza el valor de la acción en un evento pendiente específico en la lista.
         * @param {Object} state - El estado actual del slice.
         * @param {Object} action - La acción que contiene el id del evento y el nuevo valor de la acción.
         */
        updateActionCalendar: (state, action) => {
            const { id, selectedValue } = action.payload;

            // Busca el índice del evento en la lista de eventos pendientes usando el id del calendario
            const eventIndex = state.listEventsPending.findIndex((event) => event.id_calendar === id);

            // Si se encuentra el evento, actualiza el valor de 'accion_calendar' con el valor seleccionado
            if (eventIndex !== -1) {
                state.listEventsPending[eventIndex].accion_calendar = selectedValue;
            }
        },

        updateDateCalendar: (state, action) => {
            const { id, selectedValue } = action.payload;

            // Busca el índice del evento en la lista de eventos pendientes usando el id del calendario
            const eventIndex = state.listEventsPending.findIndex((event) => event.id_calendar === id);

            // Si se encuentra el evento, actualiza el valor de 'accion_calendar' con el valor seleccionado
            if (eventIndex !== -1) {
                state.listEventsPending[eventIndex].fechaIni_calendar = selectedValue;
                state.listEventsPending[eventIndex].fechaFin_calendar = selectedValue;
            }
        },
    },
});

// Exportar acciones generadas por el slice
export const { setLeadsNew, setlistAttentions, setListEvents, setListOportunity, setListOrderSale, setListOrderSalePending, setlistEventsPending, updateActionCalendar, setlistGraficoKpi, updateDateCalendar } = HomeSlice.actions;

// Exportar el reducer del slice para que pueda ser utilizado en el store de Redux
export default HomeSlice.reducer;
