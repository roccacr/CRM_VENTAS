// Importa las funciones comunes y necesarias para las solicitudes API desde la ruta especificada
import { commonRequestData, fetchData } from "../../api";

/**
 * Función para obtener todos los leads nuevos.
 *
 * @param {Object} params - Parámetros requeridos para la solicitud.
 * @param {number} params.idnetsuite_admin - ID del administrador de Netsuite.
 * @param {string} params.rol_admin - Rol del administrador.
 * @returns {Promise} - Devuelve una promesa que resuelve con los datos de la respuesta de la API.
 */
export const getAllLeadsNew = async ({ idnetsuite_admin, rol_admin }) => {
    // Construcción del objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (ej. tokens, configuraciones generales).
        idnetsuite_admin, // ID del administrador de Netsuite para la autenticación/identificación.
        rol_admin, // Rol del administrador, utilizado para determinar los permisos de acceso.
    };

    // Realiza la solicitud a la API para obtener la lista de todos los leads nuevos.
    // La URL "leads/getAll_LeadsNew" apunta al endpoint que maneja esta petición en el servidor.
    // requestData contiene todos los parámetros necesarios para ejecutar la solicitud.
    return await fetchData("leads/getAll_LeadsNew", requestData); // Extrae toda la lista de clientes nuevos.
};






/**
 * Función para obtener todos los leads que requieren atención.
 *
 * @param {Object} params - Parámetros necesarios para la solicitud.
 * @param {number} params.idnetsuite_admin - ID del administrador en Netsuite, utilizado para la autenticación.
 * @param {string} params.rol_admin - Rol del administrador, necesario para determinar permisos de acceso.
 * @returns {Promise} - Devuelve una promesa que resuelve con los datos de la respuesta de la API.
 */
export const getAllLeadsAttention = async ({ idnetsuite_admin, rol_admin, startDate, endDate, filterOption }) => {
    // Construcción del objeto requestData combinando los datos comunes con los parámetros específicos recibidos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud, como tokens o configuraciones generales.
        idnetsuite_admin, // ID del administrador de Netsuite utilizado para la autenticación e identificación.
        rol_admin, // Rol del administrador utilizado para verificar permisos y accesos.
        startDate,
        endDate,
        filterOption,
    };

    // Realiza la solicitud a la API para obtener la lista de leads que requieren atención.
    // La URL "leads/getAll_LeadsAttention" corresponde al endpoint que maneja esta petición.
    // requestData contiene todos los parámetros necesarios para ejecutar correctamente la solicitud.
    return await fetchData("leads/getAll_LeadsAttention", requestData); // Devuelve la lista de leads que requieren atención.
};





/**
 * Función para obtener la bitácora de un lead específico.
 *
 * @param {Object} params - Parámetros requeridos para la solicitud.
 * @param {number} params.idLeads - ID del lead cuya bitácora se va a obtener.
 * @returns {Promise} - Devuelve una promesa que resuelve con los datos de la respuesta de la API.
 */
export const getBitacora = async ({ idLeads }) => {
    // Construcción del objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (ej. tokens, configuraciones generales).
        idLeads, // ID del lead que se va a utilizar en la solicitud.
    };

    // Realiza la solicitud a la API para obtener la bitácora del lead especificado.
    // La URL "leads/getAll_LeadsNew" apunta al endpoint que maneja esta petición en el servidor.
    // requestData contiene todos los parámetros necesarios para ejecutar la solicitud.
    return await fetchData("leads/getBitacora", requestData); // Extrae la bitácora del lead específico.
};
