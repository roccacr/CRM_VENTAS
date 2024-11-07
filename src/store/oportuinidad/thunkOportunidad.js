import { generateLeadBitacora } from "../leads/thunksLeads";
import { get_Ubicaciones, get_Clases, get_Oportunidades, crear_Oportunidad, getSpecific_Oportunidad } from "./Api_provider_oportunidad";

/**
 * Función que retorna una función asíncrona para obtener ubicaciones por ID.
 * @param {number} idUbicacion - El ID de la ubicación a obtener.
 * @returns {function} - Una función asíncrona que retorna los datos de la ubicación.
 */
export const getfetch_Ubicaciones = (idUbicacion) => {
    return async () => {
        try {
            // Llama a la API para obtener las ubicaciones según el ID proporcionado.
            const result = await get_Ubicaciones({ idUbicacion });

            // Retorna el primer elemento de los datos obtenidos, ya que se espera que sea la ubicación requerida.
            return result.data["0"];
        } catch (error) {
            // Captura cualquier error que ocurra durante la obtención de las ubicaciones y lo muestra en la consola para facilitar la depuración.
            console.error("Error al cargar las ubicaciones:", error);
        }
    };
};

/**
 * Función que retorna una función asíncrona para obtener clases por ID.
 * @param {number} idClases - El ID de la clase a obtener.
 * @returns {function} - Una función asíncrona que retorna los datos de la clase.
 */
export const getfetch_Clases = (idClases) => {
    return async () => {
        try {
            // Llama a la API para obtener las clases según el ID proporcionado.
            const result = await get_Clases({ idClases });

            // Retorna el primer elemento de los datos obtenidos, ya que se espera que sea la clase requerida.
            return result.data["0"];
        } catch (error) {
            // Captura cualquier error que ocurra durante la obtención de las clases y lo muestra en la consola para facilitar la depuración.
            console.error("Error al cargar las clases:", error);
        }
    };
};

/**
 * Función que crea una nueva oportunidad basada en los valores del formulario y datos del cliente.
 * @param {object} formValue - Los valores del formulario para crear la oportunidad.
 * @param {object} clientData - Los datos del cliente asociados con la oportunidad.
 * @returns {function} - Una función asíncrona que retorna el resultado de la creación de la oportunidad.
 */
export const crearOportunidad = (formValue, clientData) => {
    return async () => {
        try {
            // Llama a la API para crear una nueva oportunidad con los datos proporcionados.
            const result = await crear_Oportunidad({ formValue, clientData });

            // Retorna el resultado de la operación, que puede incluir un estado o mensaje de éxito.
            return result;
        } catch (error) {
            // Captura cualquier error que ocurra durante la creación de la oportunidad y lo muestra en la consola para facilitar la depuración.
            console.error("Error al crear la oportunidad:", error);
        }
    };
};

/**
 * Función que retorna una función asíncrona para obtener oportunidades por ID de lead, rango de fechas y modo.
 * @param {number} idLead - El ID del lead para el que se buscan las oportunidades.
 * @param {string} startDate - La fecha de inicio para filtrar las oportunidades.
 * @param {string} endDate - La fecha de fin para filtrar las oportunidades.
 * @param {boolean} isMode - Un valor que indica si se debe aplicar algún modo especial en la búsqueda.
 * @returns {function} - Una función asíncrona que retorna los datos de las oportunidades.
 */
export const getOportunidades = (idLead, startDate, endDate, isMode) => {
    return async () => {
        try {
            // Llama a la API para obtener las oportunidades filtradas por ID de lead, rango de fechas y modo.
            const result = await get_Oportunidades({ idLead, startDate, endDate, isMode });

            // Retorna el primer elemento de los datos obtenidos, ya que se espera que sea la oportunidad requerida.
            return result.data["0"];
        } catch (error) {
            // Captura cualquier error que ocurra durante la obtención de las oportunidades y lo muestra en la consola para facilitar la depuración.
            console.error("Error al cargar las oportunidades:", error);
        }
    };
};

/**
 * Función que crea un reporte de bitácora para un lead relacionado con la creación de una oportunidad.
 * @param {object} leadData - Los datos del lead que será actualizado en la bitácora.
 * @returns {function} - Una función asíncrona que despacha la acción para generar la bitácora y retorna un valor de éxito.
 */
export const crearReoporteLead = (leadData) => {
    return async (dispatch, getState) => {
        // Obtiene el ID del administrador Netsuite desde el estado de autenticación actual.
        const { idnetsuite_admin } = getState().auth;

        try {
            // Define la descripción del evento que será registrada en la bitácora.
            const descripcionEvento = "Se creó una oportunidad";

            // Valores adicionales que se incluyen en la bitácora del lead.
            const additionalValues = {
                valorDeCaida: 53,
                tipo: "Se creó una oportunidad",
                estado_lead: 1,
                accion_lead: 6,
                seguimiento_calendar: 1,
                valor_segimineto_lead: 3,
            };

            // Despacha la acción para generar la bitácora del lead, incluyendo la descripción del evento y los valores adicionales.
            await dispatch(generateLeadBitacora(leadData.id_empleado_lead, leadData.idinterno_lead, additionalValues, descripcionEvento, leadData.segimineto_lead));

            // Retorna un valor verdadero para indicar que la operación fue exitosa.
            return true;
        } catch (error) {
            // Captura cualquier error que ocurra durante la generación de la bitácora y lo muestra en la consola para facilitar la depuración.
            console.error("Error al generar la bitácora del lead:", error);
        }
    };
};





/**
 * Función que obtiene una oportunidad específica basada en el identificador proporcionado.
 * @param {object} oportunidad - El objeto que contiene el identificador o información necesaria para obtener la oportunidad específica.
 * @returns {function} - Una función asíncrona que retorna el resultado de la consulta de la oportunidad específica.
 */
export const getSpecificOportunidad = (oportunidad) => {
    return async () => {
        try {
            // Llama a la API para obtener una oportunidad específica con los datos proporcionados.
            const result = await getSpecific_Oportunidad({ oportunidad });

            // Retorna el resultado de la operación, que puede incluir el estado o detalles de la oportunidad.
            return result.data["0"]["0"];
        } catch (error) {
            // Captura cualquier error que ocurra durante la obtención de la oportunidad y lo muestra en la consola para facilitar la depuración.
            console.error("Error al obtener la oportunidad específica:", error);
        }
    };
};