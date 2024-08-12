import { createSlice, createSelector } from "@reduxjs/toolkit";



// ===============================
// Slice de Redux para gestionar leads
// ===============================
export const leadsSlice = createSlice({
    name: "lead", // El nombre del slice es "lead" para evitar confusión con otros slices
    initialState: {
        listHome: [], // Array para almacenar todos los leads
        status: "idle", // Estado actual de las operaciones sobre leads (idle, loading, succeeded, failed)
        error: null, // Almacena cualquier mensaje de error
        currentLead: null, // Almacena el lead actualmente seleccionado
    },
    reducers: {
        setLeads: (state, action) => {
            state.listHome = action.payload; // Actualiza la lista de leads con los datos proporcionados en la acción
            state.status = "succeeded"; // Cambia el estado a "succeeded" indicando que la operación fue exitosa
        },
        addLead: (state, action) => {
            state.listHome.push(action.payload); // Añade un nuevo lead a la lista
        },
        updateLead: (state, action) => {
            const index = state.listHome.findIndex((lead) => lead.id === action.payload.id); // Busca el índice del lead a actualizar
            if (index !== -1) {
                state.listHome[index] = action.payload; // Actualiza el lead en la posición encontrada
            }
        },
        deleteLead: (state, action) => {
            state.listHome = state.listHome.filter((lead) => lead.id !== action.payload); // Elimina el lead que coincide con el ID proporcionado
        },
        setCurrentLead: (state, action) => {
            state.currentLead = action.payload; // Establece el lead actualmente seleccionado
        },
        clearCurrentLead: (state) => {
            state.currentLead = null; // Limpia el lead actualmente seleccionado
        },
        setLoading: (state) => {
            state.status = "loading"; // Cambia el estado a "loading" para indicar que se está cargando información
        },
        setError: (state, action) => {
            state.status = "failed"; // Cambia el estado a "failed" indicando que la operación falló
            state.error = action.payload; // Guarda el mensaje de error recibido
        },
    },
});

// ===============================
// Exportación de todas las acciones
// ===============================
export const { setLeads, addLead, updateLead, deleteLead, setCurrentLead, clearCurrentLead, setLoading, setError } = leadsSlice.actions;

// ===============================
// Selectores
// ===============================

// Selector para obtener la lista de leads desde el estado
const selectLeads = (state) => state.lead.listHome;



// Selector para contar los leads filtrados según ciertos criterios
export const selectFilteredLeadsCount = createSelector([selectLeads], (leads) => leads.filter((lead) => lead.segimineto_lead === "01-LEAD-INTERESADO").length);


export const selectFilteredLeadsAttentionCount = createSelector([selectLeads], (leads) => leads.filter((lead) => lead.segimineto_lead === "01-LEAD-INTERESADO").length);


// ===============================
// Exportación del reducer del slice
// ===============================
export default leadsSlice.reducer;
