/********************************************** MODULE IMPORTS ****************************************************/
// import { errorMessages, secretKey } from "../../api";
import { fetchLeadsAsync } from "./Api_leads_Providers";
import { setError, setLeads } from "./LeadsSlice";




export const startLoadingLeads = () => {
    // Retorna una función asíncrona que recibe dispatch como parámetro
        return async (dispatch, getState) => {
            const { idnetsuite_admin, rol_admin } = getState().auth;



            try {
                const response = await fetchLeadsAsync({ idnetsuite_admin, rol_admin });
                console.log("response", response);
                dispatch(setLeads(response.data.data));
                // dispatch(setLeads(leads));
            } catch (error) {
                console.error("Error al cargar los leads:", error);
                // En caso de error, actualiza el estado con el mensaje de error
                dispatch(setError("Error al cargar la lista de leads"));
            }
        };
};

