import { createSlice } from "@reduxjs/toolkit";

// Slice de Redux para gestionar el estado relacionado con los calendar y eventos
export const calendarSlice = createSlice({
    name: "calendar", // Nombre del slice
    initialState: {
        listEvent: [], // Cantidad de calendar nuevos
    },
    reducers: {
        /**
         * Actualiza la lista de calendar nuevos.
         * @param {Object} state - El estado actual del slice.
         * @param {Object} action - La acción que contiene el payload con el nuevo valor.
         */
        setcalendar: (state, action) => {
            state.listEvent = action.payload;
        },

    },
});

// Exportar acciones generadas por el slice
export const { setcalendar } = calendarSlice.actions;

// Exportar el reducer del slice para que pueda ser utilizado en el store de Redux
export default calendarSlice.reducer;
