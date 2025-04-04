/**
 * Módulo ApiProvider - Encargado de manejar las solicitudes a la API
 * 
 * Este módulo proporciona una interfaz limpia y modular para realizar solicitudes
 * a la API, separando las responsabilidades en funciones específicas y mejorando
 * la legibilidad y mantenibilidad del código.
 */

import { fetchData, commonRequestData } from "../../api/api";

/**
 * Construye el objeto de datos para la solicitud a la API
 * @param {Object} transaccion - Datos específicos de la transacción
 * @returns {Object} Objeto de datos completo para la solicitud
 */
const construirDatosSolicitud = (transaccion) => {
    return {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes
        transaccion,          // Datos específicos de la transacción
    };
};

/**
 * Realiza la solicitud a la API
 * @param {string} endpoint - Endpoint de la API a consultar
 * @param {Object} datosSolicitud - Datos completos para la solicitud
 * @returns {Promise} Promesa con la respuesta de la API
 */
const realizarSolicitudApi = async (endpoint, datosSolicitud) => {
    return await fetchData(endpoint, datosSolicitud);
};

/**
 * Proveedor principal de la API
 * 
 * Esta función actúa como el punto de entrada principal para realizar solicitudes
 * a la API, coordinando el proceso completo de construcción de la solicitud
 * y ejecución de la misma.
 * 
 * @param {Object} params - Parámetros de la solicitud
 * @param {Object} params.transaccion - Datos específicos de la transacción
 * @param {string} params.endpoint - Endpoint de la API a consultar
 * @returns {Promise} Promesa con la respuesta de la API
 */
export const ApiProvider = async ({ transaccion, endpoint }) => {
    const datosSolicitud = construirDatosSolicitud(transaccion);
    return await realizarSolicitudApi(endpoint, datosSolicitud);
};
