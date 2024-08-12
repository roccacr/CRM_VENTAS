import { createSlice, createSelector } from "@reduxjs/toolkit";
import { subDays } from "date-fns";

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
export const selectFilteredLeadsAttentionCount = createSelector([selectLeadsAttention], (leads) => {
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
// Exportación del reducer del slice
export default leadsSlice.reducer;
