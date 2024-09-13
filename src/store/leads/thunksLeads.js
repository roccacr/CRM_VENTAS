import { setLeadsNew } from "./leadSlice"; // Acción para actualizar el estado de leads en Redux.
import { getAllLeadsNew } from "./Api_leads_Providers"; // Función que hace la solicitud API para obtener nuevos leads.

/**
 * Acción asincrónica para obtener la lista de nuevos leads.
 *
 * Realiza una solicitud al backend para obtener los leads nuevos basados en el id y rol del administrador
 * y luego despacha una acción para actualizar el estado de Redux con los datos obtenidos.
 *
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getLeadsNew = () => {
    return async (dispatch, getState) => {
        // Extrae el idnetsuite_admin y rol_admin desde el estado de autenticación en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llamada a la API para obtener los nuevos leads basados en el rol y el id del administrador.
            const result = await getAllLeadsNew({ idnetsuite_admin, rol_admin });

            // Si la API devuelve datos correctamente, despacha la acción para actualizar el estado de Redux.
            dispatch(setLeadsNew(result.data["0"])); // Actualiza el estado con la lista de leads nuevos.

            return result.data["0"]; // Devuelve los datos obtenidos para su posible uso.
        } catch (error) {
            // En caso de error, muestra el mensaje de error en la consola.
            console.error("Error al cargar los nuevos leads:", error);
        }
    };
};
