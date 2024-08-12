/********************************************** MODULE IMPORTS ****************************************************/
// import { errorMessages, secretKey } from "../../api";
import { fetchLeadsAsyncAttention, fetchLeadsAsyncNew } from "./Api_leads_Providers";
import { setError, setLeadsNew, setLeadsAttention } from "./LeadsSlice";




export const startLoadingAllLeads = () => {
    return async (dispatch, getState) => {
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            const [newLeadsResponse, attentionLeadsResponse] = await Promise.all([fetchLeadsAsyncNew({ idnetsuite_admin, rol_admin }), fetchLeadsAsyncAttention({ idnetsuite_admin, rol_admin })]);

            dispatch(setLeadsNew(newLeadsResponse.data.data));
            dispatch(setLeadsAttention(attentionLeadsResponse.data.data));
        } catch (error) {
            console.error("Error al cargar los leads:", error);
            dispatch(setError("Error al cargar la lista de leads"));
        }
    };
};