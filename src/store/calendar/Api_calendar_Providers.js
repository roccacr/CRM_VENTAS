// Importa las funciones comunes y necesarias para las solicitudes API desde la ruta especificada
import { commonRequestData, fetchData } from "../../api";

/**
 * Función para obtener todos los calendarios nuevos.
 *
 * @param {Object} params - Parámetros requeridos para la solicitud.
 * @param {number} params.idnetsuite_admin - ID del administrador de Netsuite.
 * @param {string} params.rol_admin - Rol del administrador.
 * @returns {Promise} - Devuelve una promesa que se resuelve con los datos de la respuesta de la API.
 */
export const get_CalendarFetch = async ({ idnetsuite_admin, rol_admin }) => {
    // Construye el objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (ej. tokens, configuraciones generales).
        idnetsuite_admin, // ID del administrador de Netsuite, necesario para la autenticación/identificación.
        rol_admin, // Rol del administrador, utilizado para verificar permisos de acceso.
    };

    // Realiza la solicitud a la API para obtener la lista de nuevos calendarios.
    // La URL "calendar/get_Calendars" apunta al endpoint que maneja esta petición en el servidor.
    // requestData contiene todos los parámetros necesarios para ejecutar la solicitud.
    return await fetchData("calendars/get_Calendars", requestData); // Retorna la lista de nuevos calendarios desde la API.
};
