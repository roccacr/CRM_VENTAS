/********************************************** MODULE IMPORTS ****************************************************/
// import { errorMessages, secretKey } from "../../api";
import { fetchAllEvents, fetchLeadsUnderAttention, fetchNewLeads, fetchOpportunities, updateEventStatus } from "./Api_Home_Providers";
import { setError, setLeadsNew, setLeadsAttention, setEventsAttention, setClearList, setOportunityAttention } from "./HomeSlice";




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
        dispatch(setClearList());

        try {
            // Realizamos múltiples solicitudes asincrónicas en paralelo
            const [newLeads, attentionLeads, events, oportunity] = await Promise.all([
                fetchNewLeads({ idnetsuite_admin, rol_admin }),
                fetchLeadsUnderAttention({ idnetsuite_admin, rol_admin }),
                fetchAllEvents({ idnetsuite_admin, rol_admin }),
                fetchOpportunities({ idnetsuite_admin, rol_admin })]);

            console.log(oportunity.data.data);
            // Actualizamos el estado de Redux con los datos obtenidos
            dispatch(setLeadsNew(newLeads.data.data));
            dispatch(setLeadsAttention(attentionLeads.data.data));
            dispatch(setEventsAttention(events.data.data));
            dispatch(setOportunityAttention(oportunity.data.data));

        } catch (error) {
            // Manejamos cualquier error que ocurra durante las solicitudes
            console.error("Error al cargar los leads:", error);
            dispatch(setError("No se pudo cargar la lista de leads. Por favor, intente nuevamente."));
        }
    };
};



export const updateEventsStatusThunksHome = (id_calendar, newStatus) => {
    return async (dispatch, getState) => {
        // Extraemos el ID del administrador de Netsuite del estado de autenticación
        const { idnetsuite_admin } = getState().auth;

        try {
            // Realizamos la solicitud asincrónica para actualizar los eventos con los datos proporcionados
            await updateEventStatus({ idnetsuite_admin, id_calendar, newStatus });
        } catch (error) {
            // En caso de error durante la solicitud, lo mostramos en la consola
            console.error("Error al cargar los leads:", error);

            // Disparamos una acción para establecer un mensaje de error en el estado de la aplicación
            dispatch(setError("No se pudo cargar la lista de leads. Por favor, intente nuevamente."));
        }
    };
};
