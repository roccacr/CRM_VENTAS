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
