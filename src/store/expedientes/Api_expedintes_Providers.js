// Importa las funciones comunes y necesarias para las solicitudes API desde la ruta especificada
import { commonRequestData, fetchData } from "../../api";

/**
 * Función para obtener todos los expedientes nuevos.
 *
 * Esta función construye una solicitud HTTP hacia el servidor para obtener
 * una lista de todos los expedientes nuevos disponibles. Utiliza la función `fetchData`
 * para realizar la solicitud a un endpoint específico y combina los datos comunes de la solicitud.
 *
 * @returns {Promise} - Devuelve una promesa que resuelve con los datos de la respuesta de la API,
 *                      que contiene la lista de expedientes.
 */
export const getAllExpedientes = async () => {
    // Construcción del objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (ej. tokens, configuraciones generales).
    };

    // Realiza la solicitud a la API para obtener la lista de todos los expedientes nuevos.
    // La URL "leads/getAllExpedientes" apunta al endpoint que maneja esta petición en el servidor.
    // requestData contiene todos los parámetros necesarios para ejecutar la solicitud.
    return await fetchData("expedientes/getAllExpedientes", requestData); // Extrae toda la lista de expedientes nuevos.
};
