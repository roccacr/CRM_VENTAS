import { setLeadsNew } from "./leadSlice"; // Acción para actualizar el estado de leads en Redux.
import { getAll_LeadsRepit, getAllLeadsAttention, getAllLeadsComplete, getAllLeadsNew, getBitacora } from "./Api_leads_Providers"; // Función que hace la solicitud API para obtener nuevos leads.

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



/**
 * Acción asincrónica para obtener la lista de leads que requieren atención.
 *
 * Realiza una solicitud al backend para obtener los leads que requieren atención,
 * basados en el ID y rol del administrador, y luego despacha una acción para
 * actualizar el estado de Redux con los datos obtenidos.
 *
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getLeadsAttention = (startDate, endDate, filterOption) => {



    return async (dispatch, getState) => {
        // Extrae el idnetsuite_admin y rol_admin del estado de autenticación almacenado en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llama a la función getAllLeadsAttention para obtener los leads que requieren atención
            // basados en el rol y el ID del administrador.
            const result = await getAllLeadsAttention({ idnetsuite_admin, rol_admin, startDate, endDate, filterOption });
            // Si la API responde con éxito, despacha una acción para actualizar el estado de Redux.
            dispatch(setLeadsNew(result.data["0"])); // Actualiza el estado con la lista de leads obtenida.

            return result.data["0"]; // Devuelve los datos obtenidos para posibles usos adicionales.
        } catch (error) {
            // En caso de error, muestra el error en la consola para diagnóstico.
            console.error("Error al cargar los leads que requieren atención:", error);
        }
    };
};




/**
 * Acción asincrónica para obtener la bitácora de un lead específico.
 *
 * Realiza una solicitud al backend para obtener la bitácora de un lead 
 * basado en el id del lead proporcionado, y luego devuelve los datos obtenidos.
 *
 * @param {number} idLeads - ID del lead cuya bitácora se va a obtener.
 * @returns {Promise<Object>} - Promesa que resuelve con los datos de la bitácora.
 */
export const getBitacoraLeads = (idLeads) => {
    return async (dispatch, getState) => {
        try {
            // Llamada a la API para obtener la bitácora del lead basado en su ID.
            const result = await getBitacora({ idLeads });
            console.log(result)

            return result.data["0"]; // Devuelve los datos de la bitácora obtenidos.
        } catch (error) {
            // Manejo de errores: muestra el mensaje de error en la consola.
            console.error("Error al cargar la bitácora del lead:", error);
        }
    };
};




/**
 * Acción asincrónica para obtener la lista completa de los leads, sin importar su estado.
 *
 * Realiza una solicitud al backend para obtener la lista completa de los leads
 * basados en el ID y rol del administrador, y luego despacha una acción para
 * actualizar el estado de Redux con los datos obtenidos.
 *
 * @param {string} startDate - Fecha de inicio para el filtro de leads.
 * @param {string} endDate - Fecha de fin para el filtro de leads.
 * @param {string} filterOption - Opción de filtrado para determinar el tipo de leads a obtener.
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getLeadsComplete = (startDate, endDate, filterOption) => {
    return async (dispatch, getState) => {
        // Extrae idnetsuite_admin y rol_admin del estado de autenticación almacenado en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llama a la función getAllLeadsComplete para obtener la lista completa de leads
            // basados en el rol y el ID del administrador, así como en el rango de fechas y la opción de filtro.
            const result = await getAllLeadsComplete({ idnetsuite_admin, rol_admin, startDate, endDate, filterOption });

            // Si la API responde con éxito, despacha una acción para actualizar el estado de Redux.
            // dispatch(setLeadsNew(result.data["0"])); // Actualiza el estado con la lista de leads obtenida.

            return result.data["0"]; // Devuelve los datos obtenidos para posibles usos adicionales.
        } catch (error) {
            // En caso de error, muestra el error en la consola para diagnóstico.
            console.error("Error al cargar la lista completa de leads", error);
        }
    };
};



/**
 * Acción asincrónica para obtener la lista completa de los leads repetidos.
 *
 * Realiza una solicitud al backend para obtener la lista completa de los leads 
 * repetidos basados en el ID y rol del administrador, y luego despacha una acción
 * para actualizar el estado de Redux con los datos obtenidos.
 *
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getLeadsRepit = () => {
    return async (dispatch, getState) => {
        // Extrae idnetsuite_admin y rol_admin del estado de autenticación almacenado en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llama a la función getAllLeadsRepit para obtener la lista completa de leads repetidos
            // basados en el rol y el ID del administrador.
            const result = await getAll_LeadsRepit({ idnetsuite_admin, rol_admin });


            // Si la API responde con éxito, despacha una acción para actualizar el estado de Redux.
            // dispatch(setLeadsNew(result.data["0"])); // Actualiza el estado con la lista de leads repetidos obtenida.

            return result.data["0"]; // Devuelve los datos obtenidos para posibles usos adicionales.
        } catch (error) {
            // En caso de error, muestra el error en la consola para diagnóstico.
            console.error("Error al cargar la lista completa de leads repetidos", error);
        }
    };
};

