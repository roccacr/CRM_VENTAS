/********************************************** MODULE IMPORTS ****************************************************/
// import { errorMessages, secretKey } from "../../api";
import { fetchEventsAsync, fetchLeadsAsyncAttention, fetchLeadsAsyncNew } from "./Api_Home_Providers";
import { setError, setLeadsNew, setLeadsAttention, setEventsAttention } from "./HomeSlice";




/**
 * Inicia la carga asincrónica de todos los leads y eventos relacionados.
 * Esta función utiliza Redux Thunk para manejar operaciones asíncronas.
 *
 * @returns {Function} Una función thunk que puede ser despachada a Redux.
 */
export const startLoadingAllLeads = () => {
    return async (dispatch, getState) => {
        // Extraemos los datos necesarios del estado de autenticación
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Realizamos múltiples solicitudes asincrónicas en paralelo
            const [newLeads, attentionLeads, events] = await Promise.all([
                fetchLeadsAsyncNew({ idnetsuite_admin, rol_admin }),
                fetchLeadsAsyncAttention({ idnetsuite_admin, rol_admin }),
                fetchEventsAsync({ idnetsuite_admin, rol_admin })]);

            // Actualizamos el estado de Redux con los datos obtenidos
            dispatch(setLeadsNew(newLeads.data.data));
            dispatch(setLeadsAttention(attentionLeads.data.data));
            dispatch(setEventsAttention(events.data.data));

        } catch (error) {
            // Manejamos cualquier error que ocurra durante las solicitudes
            console.error("Error al cargar los leads:", error);
            dispatch(setError("No se pudo cargar la lista de leads. Por favor, intente nuevamente."));
        }
    };
};