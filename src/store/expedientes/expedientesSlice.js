import { createSlice } from "@reduxjs/toolkit";

// Slice de Redux para gestionar el estado relacionado con los Expedientess y eventos
export const ExpedientesSlice = createSlice({
    name: "Expedientess", // Nombre del slice
    initialState: {
        listNew: [], // Cantidad de Expedientess nuevos
        ExpedientesActive: [],
    },
    reducers: {
        /**
         * Actualiza la lista de Expedientess nuevos.
         * @param {Object} state - El estado actual del slice.
         * @param {Object} action - La acción que contiene el payload con el nuevo valor.
         */
        setExpedientessNew: (state, action) => {
            state.listNew = action.payload;
        },
        setExpedientesActive: (state, action) => {
            state.ExpedientesActive = action.payload;
        },
    },
});

// Exportar acciones generadas por el slice
export const { setExpedientessNew, setExpedientesActive } = ExpedientesSlice.actions;

// Exportar el reducer del slice para que pueda ser utilizado en el store de Redux
export default ExpedientesSlice.reducer;
