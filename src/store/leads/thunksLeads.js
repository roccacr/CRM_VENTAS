/********************************************** MODULE IMPORTS ****************************************************/
// import { errorMessages, secretKey } from "../../api";
import { fetchLeadsAsyncAttention, fetchLeadsAsyncNew } from "./Api_leads_Providers";
import { setError, setLeadsNew, setLeadsAttention } from "./LeadsSlice";




export const startLoadingLeadsNew = () => {
    // Retorna una función asíncrona que recibe dispatch como parámetro
        return async (dispatch, getState) => {
            const { idnetsuite_admin, rol_admin } = getState().auth;
            try {
                const response = await fetchLeadsAsyncNew({ idnetsuite_admin, rol_admin });
                console.log("response.data.data", response);
                dispatch(setLeadsNew(response.data.data));
                // dispatch(setLeads(leads));
            } catch (error) {
                console.error("Error al cargar los leads:", error);
                // En caso de error, actualiza el estado con el mensaje de error
                dispatch(setError("Error al cargar la lista de leads"));
            }
        };
};


export const startLoadingAttentionCount = () => {
    // Retorna una función asíncrona que recibe dispatch como parámetro
    return async (dispatch, getState) => {
        const { idnetsuite_admin, rol_admin } = getState().auth;
        try {
            const response = await fetchLeadsAsyncAttention({ idnetsuite_admin, rol_admin });

            dispatch(setLeadsAttention(response.data.data));
            // dispatch(setLeads(leads));
        } catch (error) {
            console.error("Error al cargar los leads:", error);
            // En caso de error, actualiza el estado con el mensaje de error
            dispatch(setError("Error al cargar la lista de leads"));
        }
    };
};