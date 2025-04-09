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
export const get_Oportunidades = async ({ idLead, startDate, endDate, isMode, idnetsuite_admin, BotonesEstados }) => {
    // Construye el objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (como tokens de autenticación o configuraciones generales).
        idLead, // ID del lead que se utiliza para buscar oportunidades asociadas.
        startDate, // Fecha de inicio para filtrar oportunidades en un rango de fechas.
        endDate, // Fecha de fin para filtrar oportunidades en un rango de fechas.
        isMode, // Parámetro adicional que determina el modo de búsqueda.
        idnetsuite_admin,
        BotonesEstados,
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



export const obtener_OportunidadesCliente = async ({ leadDetails }) => {
    // Construye el objeto de datos para la solicitud, combinando los datos comunes requeridos con el ID específico del cliente.
    // commonRequestData contiene información como tokens de autenticación y configuraciones necesarias para todas las solicitudes a la API.
    const requestData = {
        ...commonRequestData, // Datos comunes para todas las solicitudes.
        leadDetails, // Identificador único del cliente cuyas oportunidades se desean obtener.
    };

    // Realiza la solicitud a la API para obtener la lista de oportunidades asociadas al cliente especificado.
    // La URL "leads/oportunidades" representa el endpoint en el servidor donde se procesan las solicitudes de oportunidades.
    // requestData contiene tanto los datos comunes como el ID del cliente, necesarios para ejecutar esta solicitud.
    return await fetchData("leads/oportunidades", requestData); // Retorna la lista de oportunidades obtenida desde la API.
};




export const updateOpportunity_Probability = async ({ probabilidad, idOportunidad }) => {
    // Construye el objeto de datos para la solicitud, incluyendo tanto los datos comunes necesarios
    // como los parámetros específicos para actualizar la probabilidad de una oportunidad.
    // commonRequestData podría contener información como tokens de autenticación y configuraciones
    // necesarias para todas las solicitudes a la API.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos en todas las solicitudes.
        probabilidad, // Nueva probabilidad de la oportunidad.
        idOportunidad, // Identificador único de la oportunidad a actualizar.
    };

    // Realiza la solicitud a la API para actualizar la probabilidad de la oportunidad especificada.
    // La URL "oportunidad/updateOpportunity_Probability" es el endpoint en el servidor para procesar
    // esta actualización. requestData contiene tanto los datos comunes como los parámetros específicos necesarios.
    return await fetchData("oportunidad/updateOpportunity_Probability", requestData); // Retorna el resultado de la actualización desde la API.
};


export const updateOpportunity_Status = async ({ estado, idOportunidad }) => {
    // Build the request data object, including both common data required for all requests
    // and specific parameters to update the status of an opportunity.
    // commonRequestData may contain information such as authentication tokens and
    // configuration settings required for all API requests.
    const requestData = {
        ...commonRequestData, // Common data required for all requests.
        estado, // New status of the opportunity.
        idOportunidad, // Unique identifier of the opportunity to update.
    };

    // Send a request to the API to update the status of the specified opportunity.
    // The endpoint "oportunidad/updateOpportunity_Status" on the server processes
    // this update. requestData contains both common and specific parameters needed.
    return await fetchData("oportunidad/updateOpportunity_Status", requestData); // Returns the result of the API update.
};



export const updateEstadoOportunidad_fetch = async ({ formValues, detalleOportunidad }) => {     
    // Construye el objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (como tokens de autenticación o configuraciones generales).
        formValues, // Valores del formulario que contienen los detalles de la oportunidad a crear.
        detalleOportunidad, // Identificador único de la oportunidad a actualizar.
    };

    // Realiza una solicitud a la API para actualizar el estado de   la oportunidad con los datos proporcionados.
    // La URL "oportunidad/updateEstadoOportunidad" apunta al endpoint que procesa la actualización del estado de la oportunidad en el servidor.
    return await fetchData("oportunidad/updateEstadoOportunidad", requestData); // Retorna el resultado de la actualización del estado de la oportunidad.
};
