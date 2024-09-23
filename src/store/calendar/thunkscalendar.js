import { get_CalendarFetch } from "./Api_calendar_Providers";

/**
 * Acción asincrónica para obtener la lista de nuevos calendarios.
 *
 * Realiza una solicitud al backend para obtener los calendarios nuevos basados en el ID y rol del administrador,
 * y luego despacha una acción para actualizar el estado de Redux con los datos obtenidos.
 *
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const get_Calendar = () => {
    return async (dispatch, getState) => {
        // Extrae idnetsuite_admin y rol_admin del estado de autenticación en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llama a la API para obtener los calendarios nuevos, basados en el rol y el ID del administrador.
            const result = await get_CalendarFetch({ idnetsuite_admin, rol_admin });


            // Retorna el primer conjunto de datos de la respuesta para su uso posterior.
            return result.data["0"];
        } catch (error) {
            // En caso de error, registra el mensaje en la consola.
            console.error("Error al cargar los nuevos calendarios:", error);
        }
    };
};
