// Importa las funciones comunes necesarias para realizar solicitudes API desde la ruta especificada.
import { commonRequestData, fetchData } from "../../api";

/**
 * Función asincrónica para obtener ubicaciones por medio de un ID específico.
 * @param {object} idUbicacion - El ID de la ubicación que se desea obtener.
 * @returns {Promise} - Retorna los datos de la ubicación obtenidos de la API.
 */
export const get_Ubicaciones = async ({ idUbicacion }) => {
    // Construye el objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (como tokens de autenticación o configuraciones generales).
        idUbicacion, // ID utilizado para identificar y filtrar las ubicaciones solicitadas.
    };

    // Realiza una solicitud a la API para obtener las ubicaciones correspondientes al ID proporcionado.
    // La URL "oportunidad/getUbicaciones" apunta al endpoint que procesa esta petición en el servidor.
    return await fetchData("oportunidad/getUbicaciones", requestData); // Retorna los datos obtenidos de la API sobre la ubicación solicitada.
};

/**
 * Función asincrónica para obtener clases mediante un ID específico.
 * @param {object} idClases - El ID de la clase que se desea obtener.
 * @returns {Promise} - Retorna los datos de la clase obtenidos de la API.
 */
export const get_Clases = async ({ idClases }) => {
    // Construye el objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (como tokens de autenticación o configuraciones generales).
        idClases, // ID utilizado para identificar y filtrar las clases solicitadas.
    };

    // Realiza una solicitud a la API para obtener las clases correspondientes al ID proporcionado.
    // La URL "oportunidad/getClases" apunta al endpoint que procesa esta petición en el servidor.
    return await fetchData("oportunidad/getClases", requestData); // Retorna los datos obtenidos de la API sobre las clases solicitadas.
};

/**
 * Función asincrónica para crear una nueva oportunidad con los valores de un formulario y los datos del cliente.
 * @param {object} formValue - Los valores del formulario para crear la oportunidad.
 * @param {object} clientData - Los datos del cliente asociados con la oportunidad.
 * @returns {Promise} - Retorna el resultado de la creación de la oportunidad desde la API.
 */
export const crear_Oportunidad = async ({ formValue, clientData }) => {
    // Construye el objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (como tokens de autenticación o configuraciones generales).
        formValue, // Valores del formulario que contienen los detalles de la oportunidad a crear.
        clientData, // Información adicional sobre el cliente relacionada con la oportunidad.
    };

    // Realiza una solicitud a la API para crear una nueva oportunidad con los datos proporcionados.
    // La URL "oportunidad/crear_Oportunidad" apunta al endpoint que procesa la creación de la oportunidad en el servidor.
    return await fetchData("oportunidad/crear_Oportunidad", requestData); // Retorna el resultado de la creación de la oportunidad.
};

/**
 * Función asincrónica para obtener oportunidades filtradas por ID de lead, rango de fechas y modo.
 * @param {object} idLead - El ID del lead para el cual se desean obtener las oportunidades.
 * @param {string} startDate - La fecha de inicio para el filtro de oportunidades.
 * @param {string} endDate - La fecha de fin para el filtro de oportunidades.
 * @param {boolean} isMode - Indicador que define si se aplica algún modo especial en la búsqueda de oportunidades.
 * @returns {Promise} - Retorna los datos de las oportunidades obtenidos de la API.
 */
export const get_Oportunidades = async ({ idLead, startDate, endDate, isMode }) => {
    // Construye el objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (como tokens de autenticación o configuraciones generales).
        idLead, // ID del lead que se utiliza para buscar oportunidades asociadas.
        startDate, // Fecha de inicio para filtrar oportunidades en un rango de fechas.
        endDate, // Fecha de fin para filtrar oportunidades en un rango de fechas.
        isMode, // Parámetro adicional que determina el modo de búsqueda.
    };

    // Realiza una solicitud a la API para obtener las oportunidades correspondientes al lead y rango de fechas proporcionados.
    // La URL "oportunidad/get_Oportunidades" apunta al endpoint que procesa esta petición en el servidor.
    return await fetchData("oportunidad/get_Oportunidades", requestData); // Retorna los datos obtenidos de la API sobre las oportunidades solicitadas.
};




/**
 * Función asincrónica para obtener una oportunidad específica mediante un ID proporcionado.
 * @param {object} oportunidad - El objeto que contiene el ID o parámetros necesarios para identificar la oportunidad.
 * @returns {Promise} - Retorna los datos de la oportunidad obtenidos de la API.
 */
export const getSpecific_Oportunidad = async ({ oportunidad }) => {
    // Construye el objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos de la oportunidad.
    const requestData = {
        ...commonRequestData, // Incluye datos comunes para la solicitud, como tokens de autenticación y configuraciones generales.
        oportunidad, // Parámetro específico que identifica la oportunidad solicitada.
    };

    // Realiza una solicitud a la API para obtener los datos de la oportunidad correspondiente al ID proporcionado.
    // La URL "oportunidad/getSpecificOportunidad" apunta al endpoint que procesa esta petición en el servidor.
    return await fetchData("oportunidad/getSpecificOportunidad", requestData); // Retorna los datos obtenidos de la API sobre la oportunidad solicitada.
};
