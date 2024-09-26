import { setLeadsNew } from "./leadSlice"; // Acción para actualizar el estado de leads en Redux.
import { get_Specific_Lead, getAll_LeadsRepit, getAllLeadsAttention, getAllLeadsComplete, getAllLeadsNew, getAllStragglers, getBitacora, insertBitcoraLead, updateLeadActionApi } from "./Api_leads_Providers"; // Función que hace la solicitud API para obtener nuevos leads.


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
 * Acción asincrónica para obtener la lista de leads que requieren atención. y resagados
 *
 * Realiza una solicitud al backend para obtener los leads que requieren atención,
 * basados en el ID y rol del administrador, y luego despacha una acción para
 * actualizar el estado de Redux con los datos obtenidos.
 *
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getLeadStragglers = (startDate, endDate, filterOption) => {
    return async (dispatch, getState) => {
        // Extrae el idnetsuite_admin y rol_admin del estado de autenticación almacenado en Redux.
         const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llama a la función getAllLeadsAttention para obtener los leads que requieren atención
            // basados en el rol y el ID del administrador.
            const result = await getAllStragglers({ idnetsuite_admin, rol_admin, startDate, endDate, filterOption });
            // Si la API responde con éxito, despacha una acción para actualizar el estado de Redux
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
    return async () => {
        try {
            // Llamada a la API para obtener la bitácora del lead basado en su ID.
            const result = await getBitacora({ idLeads });

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



/**
 * Acción asincrónica para obtener la información de un lead específico.
 *
 * Realiza una solicitud al backend para obtener los detalles de un lead
 * basados en su ID, y luego despacha una acción para actualizar el estado 
 * de Redux con los datos obtenidos.
 *
 * @param {number} idLead - ID del lead específico que se desea obtener.
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getSpecificLead = (idLead) => {
    return async () => {
        try {
            // Llama a la función get_Specific_Lead para obtener la información del lead específico.
            const result = await get_Specific_Lead({ idLead });
            return result.data["0"]["0"]; // Devuelve los datos obtenidos para posibles usos adicionales.
        } catch (error) {
            // En caso de error, muestra el error en la consola para diagnóstico.
            console.error("Error al cargar el lead", error);
        }
    };
};



/**
 * Acción asincrónica para generar una bitácora para un lead específico.
 *
 * Esta función realiza una solicitud al backend para registrar una bitácora 
 * de las acciones realizadas sobre un lead basado en su ID, junto con información adicional
 * como el estado actual del lead, su descripción y otros valores relevantes. 
 * El estado del lead se valida y ajusta en base a un conjunto de estados permitidos.
 *
 * @param {number} idnetsuite_admin - ID del administrador de NetSuite que está realizando la acción.
 * @param {number} leadId - ID del lead para el cual se desea generar la bitácora.
 * @param {Object} additionalValues - Valores adicionales que acompañan la bitácora.
 * @param {string} additionalValues.valorDeCaida - Valor que indica la caída del lead.
 * @param {string} additionalValues.tipo - Tipo de evento o acción que se está registrando.
 * @param {string} descripcionEvento - Descripción del evento o acción realizada.
 * @param {string} valueStatus - Estado actual del lead que se está evaluando.
 * @returns {Promise<void>} - Esta función no devuelve un resultado directamente, pero genera una bitácora en el backend.
 */
export const generateLeadBitacora = (idnetsuite_admin, leadId, additionalValues, descripcionEvento, valueStatus) => {
    return async (dispatch) => {
        try {
            // Lista de estados permitidos para validar el estado actual del lead.
            const estadosPermitidos = ["LEAD-OPORTUNIDAD", "LEAD-PRE-RESERVA", "LEAD-RESERVA", "LEAD-CONTRATO", "LEAD-ENTREGADO"];

            // Validación del estado actual: si no coincide con uno de los estados permitidos,
            // se asigna el estado por defecto "08-LEAD-SEGUIMIENTO".
            const estadoActual = estadosPermitidos.includes(valueStatus.substring(3, 53)) ? valueStatus : "08-LEAD-SEGUIMIENTO";

            // Inserción de la bitácora en el sistema.
            // Se pasa el ID del lead, el ID del administrador de NetSuite, el valor de caída,
            // la descripción del evento, el tipo de evento y el estado actual validado.
             await insertBitcoraLead(leadId, idnetsuite_admin, additionalValues.valorDeCaida, descripcionEvento, additionalValues.tipo, estadoActual);

            await dispatch(updateLeadAction(leadId, additionalValues, valueStatus));
        } catch (error) {
            // Manejo de errores: captura cualquier fallo al generar la bitácora.
            console.error("Error al generar la bitácora para el lead", error);
            throw error; // Lanza el error para manejarlo a nivel superior si es necesario.
        }
    };
};

/**
 * Función para actualizar el estado de un lead en el sistema y registrar una bitácora de acciones.
 *
 * Esta función toma el ID de un lead, valores adicionales, y el estado actual para realizar
 * la actualización. Si el estado proporcionado no es válido, se asigna un estado por defecto.
 * Finalmente, se envía la solicitud al backend para registrar los cambios y la bitácora del lead.
 *
 * @param {number} leadId - Identificador único del lead que se está actualizando.
 * @param {Object} additionalValues - Valores adicionales relacionados con el lead, como seguimiento y acciones.
 * @param {string} additionalValues.valor_segimineto_lead - Valor asociado al seguimiento del lead.
 * @param {string} additionalValues.estado_lead - Estado nuevo del lead que se actualizará.
 * @param {string} additionalValues.accion_lead - Acción que se ha realizado sobre el lead, por ejemplo, seguimiento.
 * @param {string} additionalValues.seguimiento_calendar - Información adicional sobre el seguimiento en el calendario.
 * @param {string} additionalValues.valorDeCaida - Motivo o valor relacionado con la caída del lead, si aplica.
 * @param {string} valueStatus - Estado actual del lead que se validará antes de actualizar.
 * @returns {Function} - Devuelve una función asincrónica que actualiza el lead y registra la bitácora.
 */
export const updateLeadAction = (leadId, additionalValues, valueStatus) => {
    return async () => {
        try {
            // Lista de estados permitidos para validar el estado actual del lead.
            const estadosPermitidos = ["LEAD-OPORTUNIDAD", "LEAD-PRE-RESERVA", "LEAD-RESERVA", "LEAD-CONTRATO", "LEAD-ENTREGADO"];

            // Validación del estado actual: si el estado del lead no coincide con uno de los estados permitidos,
            // se asigna el estado por defecto "08-LEAD-SEGUIMIENTO" para mantener la consistencia de datos.
            const estadoActual = estadosPermitidos.includes(valueStatus.substring(3, 53)) ? valueStatus : "08-LEAD-SEGUIMIENTO";

            // Obtener la fecha actual en formato YYYY-MM-DD, para registrar la fecha de actualización.
            const now = new Date();
            const formattedDate = now.toISOString().slice(0, 10); // Extrae los primeros 10 caracteres del formato ISO.

            // Desestructuración de los valores adicionales, que incluyen el seguimiento y la acción realizada sobre el lead.
            const { valor_segimineto_lead, estado_lead, accion_lead, seguimiento_calendar, valorDeCaida } = additionalValues;

            // Llama a la API para actualizar el lead con el estado validado, los valores adicionales,
            // y la fecha actual formateada. La función updateLeadActionApi es responsable de enviar los datos al backend.
            await updateLeadActionApi(estadoActual, valor_segimineto_lead, estado_lead, accion_lead, seguimiento_calendar, valorDeCaida, formattedDate, leadId);

        } catch (error) {
            // Manejo de errores: captura cualquier excepción o fallo ocurrido durante la actualización del lead.
            console.error("Error al generar la bitácora para el lead", error);
            throw error; // Propaga el error para que pueda ser gestionado en niveles superiores.
        }
    };
};



