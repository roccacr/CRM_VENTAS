// Importa la función createSelector de Reselect, que se utiliza para crear selectores memoizados.
import { createSelector } from "reselect";

// Selector base para obtener el estado general de leads desde el store.
const selectLeadState = (state) => state.leads;

/**
 * Selector para obtener la lista de nuevos leads.
 *
 * Este selector usa `createSelector` para memoizar los datos, asegurando que solo se recalcule cuando
 * el estado de `leads` cambie, mejorando el rendimiento.
 *
 * @returns {Array} - Retorna la lista de nuevos leads desde el estado de `leads`.
 */
export const selectListNewLeads = createSelector(
    [selectLeadState], // Fuente de datos: el estado de `leads` en el store.
    (leadState) => leadState.listNew, // Extrae específicamente la lista de nuevos leads desde el estado.
);
