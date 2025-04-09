import { generateLeadBitacora } from "../leads/thunksLeads";
import { get_Ubicaciones, get_Clases, get_Oportunidades, crear_Oportunidad, getSpecific_Oportunidad, obtener_OportunidadesCliente, updateOpportunity_Probability, updateOpportunity_Status, updateEstadoOportunidad_fetch } from "./Api_provider_oportunidad";

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
export const getOportunidades = (idLead, startDate, endDate, isMode, BotonesEstados, leadAsignado) => {
  
    
    return async (dispatch, getState) => {
        const { idnetsuite_admin , rol_admin } = getState().auth;

        try {
            // Validar las fechas y permitir que se envíen vacías
            const start = startDate instanceof Date ? startDate.toISOString().split("T")[0] : startDate || "";
            const end = endDate instanceof Date ? endDate.toISOString().split("T")[0] : endDate || "";

            // Realizar la llamada a la API
            const response = await get_Oportunidades({
                idLead,
                startDate: start,
                endDate: end,
                isMode,
                idnetsuite_admin,
                BotonesEstados,
                leadAsignado,
                rol_admin,
            });

            // Verificar si hay datos en la respuesta
            if (response?.data?.data) {
                return response.data.data;
            } else {
                throw new Error("No se encontraron datos de oportunidades.");
            }
        } catch (error) {
            console.error("Error al cargar las oportunidades:", error);
            // Lanzar el error para manejarlo en niveles superiores
            throw error;
        }
    };
};

/**
 * Función que crea un reporte de bitácora para un lead relacionado con la creación de una oportunidad.
 * @param {object} leadData - Los datos del lead que será actualizado en la bitácora.
 * @returns {function} - Una función asíncrona que despacha la acción para generar la bitácora y retorna un valor de éxito.
 */
export const crearReoporteLead = (leadData) => {
    return async (dispatch) => {
        // Obtiene el ID del administrador Netsuite desde el estado de autenticación actual.

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

export const obtenerOportunidadesCliente = (leadDetails) => {
    return async () => {
        try {
            // Llama a la función `obtener_OportunidadesCliente` para realizar la solicitud a la API.
            // La función recibe el ID del cliente (`idCliente`) y retorna las oportunidades
            // asociadas a dicho cliente según las configuraciones de la API.
            const result = await obtener_OportunidadesCliente({ leadDetails });

            // Devuelve el conjunto de datos de la respuesta (`result.data.data`)
            // para su uso en la aplicación. Esto asume que el resultado de la API
            // es un array u objeto en el que el primer elemento contiene la información necesaria.
            return result.data.data;
        } catch (error) {
            // En caso de que ocurra un error durante la solicitud, se captura y se imprime el mensaje de error
            // en la consola para facilitar la identificación de problemas.
            console.error("Error al cargar las oportunidades del cliente:", error);
        }
    };
};

export const updateOpportunityProbability = (probabilidad, idOportunidad) => {
    return async () => {
        try {
            // Llama a la función `updateOpportunity_Probability` para realizar la actualización de probabilidad
            // de una oportunidad en la base de datos. La función recibe la probabilidad actualizada (`probabilidad`)
            // y el ID de la oportunidad (`idOportunidad`) como parámetros.
            const result = await updateOpportunity_Probability({ probabilidad, idOportunidad });

            // Retorna los datos actualizados (`result.data.data`) para que puedan ser utilizados
            // en la aplicación. Este resultado asume que `result.data.data` contiene la información
            // relevante después de la actualización.
            return result.data.data;
        } catch (error) {
            // Captura cualquier error que ocurra durante la solicitud y lo muestra en la consola.
            // Esto facilita la identificación de problemas al intentar actualizar la probabilidad de la oportunidad.
            console.error("Error al actualizar la probabilidad de la oportunidad:", error);
        }
    };
};

export const updateOpportunityStatus = (estado, idOportunidad) => {

    return async () => {
        try {
            // Calls the `updateOpportunity_Status` function to update the status
            // of an opportunity in the database. This function receives the updated
            // status (`estado`) and the opportunity ID (`idOportunidad`) as parameters.
            const result = await updateOpportunity_Status({ estado, idOportunidad });

            // Returns the updated data (`result.data.data`) to be used in the application.
            // This assumes `result.data.data` contains the relevant information after the update.
            return result.data.data;
        } catch (error) {
            // Catches any error that occurs during the request and logs it to the console.
            // This helps in identifying issues when trying to update the status of the opportunity.
            console.error("Error updating the opportunity status:", error);
        }
    };
};


export const updateEstadoOportunidad = (formValues, detalleOportunidad) => {
    return async () => {
        try {
            // Calls the `updateOpportunity_Status` function to update the status
            // of an opportunity in the database. This function receives the updated
            // status (`estado`) and the opportunity ID (`idOportunidad`) as parameters.
            const result = await updateEstadoOportunidad_fetch({ formValues, detalleOportunidad });

            // Returns the updated data (`result.data.data`) to be used in the application.
            // This assumes `result.data.data` contains the relevant information after the update.
            return result.data.data;
        } catch (error) {
            // Catches any error that occurs during the request and logs it to the console.
            // This helps in identifying issues when trying to update the status of the opportunity.
            console.error("Error updating the opportunity status:", error); 
        }
    };
};