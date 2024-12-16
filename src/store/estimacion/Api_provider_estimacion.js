// Importa las funciones necesarias para realizar solicitudes a la API desde la ruta especificada.
import { commonRequestData, fetchData } from "../../api";

/**
 * Función asincrónica para crear una estimación utilizando datos proporcionados en un formulario.
 * @param {object} formulario - Los datos del formulario utilizados para la creación de la estimación.
 * @returns {Promise} - Retorna la respuesta de la API tras intentar crear la estimación.
 */
export const crearEstimacion = async ({ formulario }) => {
    // Construye el objeto de datos para la solicitud, combinando datos comunes y los específicos del formulario.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (p. ej., tokens de autenticación, configuraciones generales).
        formulario, // Datos específicos del formulario necesarios para la creación de la estimación.
    };

    // Realiza una solicitud a la API para crear la estimación con los datos proporcionados.
    // La URL "estimacion/CrearEstimacion" corresponde al endpoint en el servidor que gestiona esta operación.
    return await fetchData("estimacion/CrearEstimacion", requestData); // Retorna la respuesta de la API para la solicitud realizada.
};



export const obtenerEstimacionesOportunidad = async ({ idOportunidad }) => {
    // Construye el objeto de datos para la solicitud, incluyendo información común y el ID de la oportunidad específica.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (p. ej., autenticación, configuraciones generales).
        idOportunidad, // Identificador único de la oportunidad para obtener sus estimaciones.
    };

    // Realiza la solicitud a la API para obtener las estimaciones asociadas a la oportunidad especificada.
    // La URL "estimacion/ObtenerEstimaciones" corresponde al endpoint que gestiona esta operación en el servidor.
    return await fetchData("estimacion/ObtenerEstimacionesOportunidad", requestData); // Retorna la respuesta de la API.
};


export const extraerEstimacionNetsuite = async ({ idEstimacion }) => {
    // Construye el objeto de datos para la solicitud, incluyendo información común y el ID de la estimación específica.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (p. ej., autenticación, configuraciones generales).
        idEstimacion, // Identificador único de la estimación para obtener sus datos asociados.
    };

    return await fetchData("estimacion/extraerEstimacion", requestData); // Retorna la respuesta de la API.
   
};
