import { createSlice } from "@reduxjs/toolkit";

// Slice de Redux para gestionar el estado relacionado con los leads y eventos
export const LeadSlice = createSlice({
    name: "leads", // Nombre del slice
    initialState: {
        listNew: [], // Cantidad de leads nuevos
        leadActive: [],
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
        setleadActive: (state, action) => {
            state.leadActive = action.payload;
        },
    },
});

// Exportar acciones generadas por el slice
export const { setLeadsNew, setleadActive } = LeadSlice.actions;

// Exportar el reducer del slice para que pueda ser utilizado en el store de Redux
export default LeadSlice.reducer;
