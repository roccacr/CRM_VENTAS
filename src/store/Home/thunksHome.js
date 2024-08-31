/********************************************** MODULE IMPORTS ****************************************************/
// import { errorMessages, secretKey } from "../../api";
import { fetchAllEvents, fetchAllOrderSale, fetchLeadsUnderAttention, fetchNewLeads, fetchOpportunities, updateEventStatus } from "./Api_Home_Providers";
import { setError, setLeadsNew, setLeadsAttention, setEventsAttention, setClearList, setOportunityAttention, setOrderSaleAttention } from "./HomeSlice";




/**
 * Inicia la carga asincrónica de todos los leads y eventos relacionados.
 * Esta función utiliza Redux Thunk para manejar operaciones asíncronas.
 *
 * @returns {Function} Una función thunk que puede ser despachada a Redux.
 */
export const startLoadingAllLeads = () => {
    return async (dispatch, getState) => {
        const { idnetsuite_admin, rol_admin } = getState().auth;
        dispatch(setClearList());

        try {
            // Hacemos las solicitudes en paralelo con Promise.all
            const [newLeads, attentionLeads, events, oportunity, orderSale] = await Promise.all([fetchNewLeads({ idnetsuite_admin, rol_admin }), fetchLeadsUnderAttention({ idnetsuite_admin, rol_admin }), fetchAllEvents({ idnetsuite_admin, rol_admin }), fetchOpportunities({ idnetsuite_admin, rol_admin }), fetchAllOrderSale({ idnetsuite_admin, rol_admin })]);

            // Solo actualizamos el estado si hay datos válidos
            if (newLeads?.data?.data) dispatch(setLeadsNew(newLeads.data.data));
            if (attentionLeads?.data?.data) dispatch(setLeadsAttention(attentionLeads.data.data));
            if (events?.data?.data) dispatch(setEventsAttention(events.data.data));
            if (oportunity?.data?.data) dispatch(setOportunityAttention(oportunity.data.data));
            if (orderSale?.data?.data) dispatch(setOrderSaleAttention(orderSale.data.data));
        } catch (error) {
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
