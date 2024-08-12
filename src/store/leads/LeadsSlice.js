import { createSlice, createSelector } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";


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
const selectAuth = (state) => state.auth;

// Selector para contar los leads filtrados según ciertos criterios
export const selectFilteredLeadsCount = createSelector([selectLeads],(leads) =>leads.filter(
            (lead) =>
                (lead.accion_lead === 0 || lead.accion_lead === 2) && // Verifica si 'accion_lead' es 0 o 2
                lead.estado_lead === 1 && // Verifica si 'estado_lead' es 1
                lead.segimineto_lead === "01-LEAD-INTERESADO", // Verifica si 'segimineto_lead' es '01-LEAD-INTERESADO'
        ).length,
);

// Selector para contar los leads que necesitan atención según criterios de tiempo
export const selectFilteredLeadsAttentionCount = createSelector([selectLeads], (leads) => {
    const fourDaysAgo = new Date(); // Crea una nueva fecha para representar 4 días atrás desde hoy
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4); // Ajusta la fecha para restar 4 días

    const formatDate = (date) => date.toISOString().split("T")[0]; // Función para formatear la fecha en 'YYYY-MM-DD'

    const formattedFourDaysAgo = formatDate(fourDaysAgo); // Formatea la fecha de 4 días atrás

    // Filtra los leads que cumplen con los criterios de atención
    return leads.filter((lead) => {
        const formattedActualizadaAccion = formatDate(new Date(lead.actualizadaaccion_lead)); // Formatea la fecha 'actualizadaaccion_lead'

        // Imprime ambas fechas para validar en la consola
        console.log(`Lead Date: ${formattedActualizadaAccion}, Four Days Ago: ${formattedFourDaysAgo}`);

        // Verifica si el lead cumple con todas las condiciones
        return (
            lead.accion_lead === 3 && // Verifica si 'accion_lead' es igual a 3
            lead.estado_lead === 1 && // Verifica si 'estado_lead' es igual a 1
            lead.seguimiento_calendar === 0 && // Verifica si 'seguimiento_calendar' es igual a 0
            formattedActualizadaAccion <= formattedFourDaysAgo && // Verifica si la fecha 'actualizadaaccion_lead' es anterior o igual a 4 días atrás
            !["02-LEAD-OPORTUNIDAD", "03-LEAD-PRE-RESERVA", "04-LEAD-RESERVA", "05-LEAD-CONTRATO", "06-LEAD-ENTREGADO"].includes(lead.segimineto_lead) // Verifica que 'segimineto_lead' no esté en la lista excluida
        );
    }).length; // Devuelve la cantidad de leads que cumplen con todas las condiciones
});

// ===============================
// Exportación del reducer del slice
// ===============================
export default leadsSlice.reducer;
