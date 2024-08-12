import { createSlice, createSelector } from "@reduxjs/toolkit";

// Slice de Redux para gestionar leads
export const leadsSlice = createSlice({
    name: "lead",
    initialState: {
        listNew: [], // Lista de leads nuevos
        listAttention: [], // Lista de leads que requieren atención
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
        setLoading: (state) => {
            state.status = "loading"; // Indica que la información se está cargando
        },
        setError: (state, action) => {
            state.status = "failed"; // Indica que la operación falló
            state.error = action.payload; // Almacena el mensaje de error
        },
    },
});

// Exportación de acciones
export const { setLeadsNew, setLeadsAttention, setLoading, setError } = leadsSlice.actions;

// Selectores
const selectLeadsNew = (state) => state.lead.listNew;
const selectLeadsAttention = (state) => state.lead.listAttention;

// Selector para contar los leads nuevos
export const selectFilteredLeadsCount = createSelector([selectLeadsNew], (leads) => leads.length);

// Selector para contar los leads que requieren atención
export const selectFilteredLeadsAttentionCount = createSelector([selectLeadsAttention], (leads) => leads.length);

// Exportación del reducer del slice
export default leadsSlice.reducer;
