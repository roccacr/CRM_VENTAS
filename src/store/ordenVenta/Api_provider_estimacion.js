// Importa las funciones necesarias para realizar solicitudes a la API desde la ruta especificada.
import { commonRequestData, fetchData } from "../../api";

/**
 * Obtiene la estimación de una orden de venta.
 * 
 * @param {Object} params - Los parámetros para la solicitud.
 * @param {string} params.idTransaccion - El ID de la transacción para la cual se obtiene la estimación.
 * @returns {Promise<Object>} La respuesta de la API para la solicitud realizada.
 */
export const obtenerOrdenVenta = async ({ idTransaccion }) => {

    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (p. ej., tokens de autenticación, configuraciones generales).
        idTransaccion, 
    };

    return await fetchData("ordenVenta/obtenerOrdendeventa", requestData); // Retorna la respuesta de la API para la solicitud realizada.
};

export const updateAplicarComicion = async ({ valor, idTransaccion }) => {

    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (p. ej., tokens de autenticación, configuraciones generales).
        idTransaccion, 
        valor
    };

    return await fetchData("ordenVenta/aplicarComicion", requestData); // Retorna la respuesta de la API para la solicitud realizada.
};


export const insertarOrdenVenta = async ({ idEstimacion, leadId }) => {

    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (p. ej., tokens de autenticación, configuraciones generales).
        idEstimacion, 
        leadId
    };

    return await fetchData("ordenVenta/crearOrdenVenta", requestData); // Retorna la respuesta de la API para la solicitud realizada.
};


export const insertarOrdenVentaBd = async ({ tranid, id_orden, idEstimacion, opportunityInternalId, employeeInternalId, entityInternalId, custbody38Value, subsidiaryInternalId, leadId, custbody17Value }) => {

    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (p. ej., tokens de autenticación, configuraciones generales).
        tranid, 
        id_orden,
        idEstimacion,
        opportunityInternalId,
        employeeInternalId,
        entityInternalId,
        custbody38Value,
        subsidiaryInternalId,
        leadId,
        custbody17Value
    };

    return await fetchData("ordenVenta/insertarOrdenVentaBd", requestData); // Retorna la respuesta de la API para la solicitud realizada.
};

