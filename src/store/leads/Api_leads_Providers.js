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
 * Función para obtener todos los leads que requieren atención.
 *
 * @param {Object} params - Parámetros necesarios para la solicitud.
 * @param {number} params.idnetsuite_admin - ID del administrador en Netsuite, utilizado para la autenticación.
 * @param {string} params.rol_admin - Rol del administrador, necesario para determinar permisos de acceso.
 * @returns {Promise} - Devuelve una promesa que resuelve con los datos de la respuesta de la API.
 */
export const getAllStragglers = async ({ idnetsuite_admin, rol_admin, startDate, endDate, filterOption }) => {
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
    return await fetchData("leads/getAllStragglers", requestData); // Devuelve la lista de leads que requieren atención.
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

/**
 * Función para obtener todos los leads, sin importar si son nuevos o requieren atención.
 *
 * @param {Object} params - Parámetros necesarios para la solicitud.
 * @param {number} params.idnetsuite_admin - ID del administrador en Netsuite, utilizado para la autenticación.
 * @param {string} params.rol_admin - Rol del administrador, necesario para determinar permisos de acceso.
 * @param {string} params.startDate - Fecha de inicio para filtrar los leads.
 * @param {string} params.endDate - Fecha de fin para filtrar los leads.
 * @param {string} params.filterOption - Opción de filtrado para determinar el tipo de leads a obtener.
 * @returns {Promise} - Devuelve una promesa que resuelve con los datos de la respuesta de la API.
 */
export const getAllLeadsComplete = async ({ idnetsuite_admin, rol_admin, startDate, endDate, filterOption }) => {
    // Construcción del objeto requestData combinando los datos comunes con los parámetros específicos recibidos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud, como tokens o configuraciones generales.
        idnetsuite_admin, // ID del administrador de Netsuite utilizado para la autenticación e identificación.
        rol_admin, // Rol del administrador utilizado para verificar permisos y accesos.
        startDate, // Fecha de inicio del filtro.
        endDate, // Fecha de fin del filtro.
        filterOption, // Opción de filtro aplicada a los leads.
    };

    // Realiza la solicitud a la API para obtener la lista completa de leads.
    // La URL "leads/getAll_LeadsComplete" corresponde al endpoint que maneja esta petición.
    return await fetchData("leads/getAll_LeadsComplete", requestData); // Devuelve la lista completa de leads.
};

/**
 * Función para obtener todos los leads repetidos.
 *
 * Esta función realiza una solicitud al backend para obtener la lista de leads
 * repetidos, basados en el ID y rol del administrador.
 *
 * @param {Object} params - Parámetros necesarios para la solicitud.
 * @param {number} params.idnetsuite_admin - ID del administrador en Netsuite, utilizado para la autenticación.
 * @param {string} params.rol_admin - Rol del administrador, necesario para determinar permisos de acceso.
 * @returns {Promise} - Devuelve una promesa que resuelve con los datos de la respuesta de la API.
 */
export const getAll_LeadsRepit = async ({ idnetsuite_admin, rol_admin }) => {
    // Construcción del objeto requestData combinando los datos comunes con los parámetros específicos recibidos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud, como tokens o configuraciones generales.
        idnetsuite_admin, // ID del administrador de Netsuite utilizado para la autenticación e identificación.
        rol_admin, // Rol del administrador utilizado para verificar permisos y acceso.
    };

    // Realiza la solicitud a la API para obtener la lista de leads repetidos.
    // La URL "leads/getAll_LeadsRepit" corresponde al endpoint que maneja esta petición.
    return await fetchData("leads/getAll_LeadsRepit", requestData); // Devuelve la lista de leads repetidos.
};

/**
 * Función para obtener la información de un lead específico.
 *
 * Esta función realiza una solicitud al backend para obtener los detalles
 * de un lead basado en su ID.
 *
 * @param {Object} params - Parámetros necesarios para la solicitud.
 * @param {number} params.idLead - ID del lead específico que se desea obtener.
 * @returns {Promise} - Devuelve una promesa que resuelve con los datos del lead obtenido desde la API.
 */
export const get_Specific_Lead = async ({ idLead }) => {
    // Construcción del objeto requestData combinando los datos comunes con los parámetros específicos recibidos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud, como tokens o configuraciones generales.
        idLead, // ID del lead específico que se quiere obtener.
    };

    // Realiza la solicitud a la API para obtener la información del lead específico.
    // La URL "leads/get_Specific_Lead" corresponde al endpoint que maneja esta petición.
    return await fetchData("leads/get_Specific_Lead", requestData); // Devuelve la información del lead específico.
};

/**
 * Función asincrónica para insertar una bitácora de acciones para un lead específico.
 *
 * Esta función construye una solicitud con los detalles necesarios y los envía al backend
 * para registrar una bitácora de las acciones realizadas sobre un lead. Incluye datos como
 * el ID del lead, la descripción del evento, el tipo de acción y el estado actual del lead.
 *
 * @param {Object} params - Parámetros necesarios para la solicitud.
 * @param {number} params.leadId - ID del lead específico para el cual se está generando la bitácora.
 * @param {number} params.idnetsuite_admin - ID del administrador de NetSuite que está realizando la acción.
 * @param {string} params.valorDeCaida - Valor relacionado con la caída o progreso del lead.
 * @param {string} params.descripcionEvento - Descripción del evento o acción que se está registrando.
 * @param {string} params.tipo - Tipo de evento o acción que se está registrando (por ejemplo, seguimiento, reserva, etc.).
 * @param {string} params.estadoActual - Estado actual del lead después de la acción (validado previamente).
 * @returns {Promise<Object>} - Devuelve una promesa que resuelve con los datos de la respuesta del backend.
 */
export const insertBitcoraLead = async (leadId, idnetsuite_admin, valorDeCaida, descripcionEvento, tipo, estadoActual) => {
    // Construcción del objeto requestData, que incluye los parámetros recibidos junto con los datos comunes.
    // Estos datos comunes pueden incluir tokens de autenticación, configuraciones globales o cualquier otro
    // dato necesario para todas las solicitudes a la API.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud, como tokens o configuraciones generales.
        leadId, // ID del lead para el cual se va a registrar la bitácora.
        idnetsuite_admin, // ID del administrador que está realizando la acción.
        valorDeCaida, // Valor relacionado con el progreso o caída del lead.
        descripcionEvento, // Descripción del evento o acción realizada sobre el lead.
        tipo, // Tipo de evento o acción que se está registrando (por ejemplo, seguimiento, reserva, etc.).
        estadoActual, // Estado actual del lead, validado previamente para asegurar su consistencia.
    };

    // Realiza la solicitud a la API enviando los datos del lead y la bitácora a registrar.
    // La URL "leads/insertBitcoraLead" corresponde al endpoint del backend que maneja esta operación.
    // fetchData es la función que realiza la solicitud HTTP (POST/PUT) al servidor con los datos construidos.
    // Esta llamada devuelve la respuesta del servidor, que generalmente es un objeto con los resultados de la operación.
    return await fetchData("leads/insertBitcoraLead", requestData);
};

/**
 * Función asincrónica para actualizar la información de un lead en el sistema.
 *
 * Esta función construye una solicitud con los detalles necesarios para actualizar
 * el estado y seguimiento de un lead. Los parámetros incluyen el estado actual,
 * la acción tomada, el seguimiento en el calendario, y más. Luego, se envía esta
 * información al backend para procesarla.
 *
 * @param {string} estadoActual - Estado actual del lead antes de realizar la actualización.
 * @param {string} valor_segimineto_lead - Valor asociado al seguimiento del lead, relacionado al historial de contactos.
 * @param {string} estado_lead - Estado nuevo del lead que se actualizará en el sistema.
 * @param {string} accion_lead - Acción que se ha realizado sobre el lead, por ejemplo, "contactado", "cerrado", etc.
 * @param {string} seguimiento_calendar - Información de seguimiento relacionada con el calendario del lead.
 * @param {string} valorDeCaida - Valor relacionado con la caída del lead, si es aplicable.
 * @param {string} formattedDate - Fecha formateada en la que se realizó la acción.
 * @param {number} leadId - Identificador único del lead que se está actualizando.
 * @returns {Promise<Object>} - Devuelve una promesa que resuelve con la respuesta del backend, indicando el resultado de la operación.
 */
export const updateLeadActionApi = async (estadoActual, valor_segimineto_lead, estado_lead, accion_lead, seguimiento_calendar, valorDeCaida, formattedDate, leadId) => {
    // Construcción del objeto requestData, que incluye los parámetros específicos de la operación
    // y los datos comunes, como tokens de autenticación o configuraciones globales necesarias para la solicitud a la API.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes, como tokens o configuración de API.
        estadoActual, // Estado actual del lead antes de realizar la actualización.
        valor_segimineto_lead, // Valor relacionado al seguimiento actual del lead.
        estado_lead, // Estado nuevo del lead que se está actualizando.
        accion_lead, // Acción realizada sobre el lead (por ejemplo, seguimiento, contacto, cierre, etc.).
        seguimiento_calendar, // Información adicional de seguimiento relacionada con el calendario del lead.
        valorDeCaida, // Motivo o valor relacionado con la caída del lead, si aplica.
        formattedDate, // Fecha de la acción, en formato adecuado para ser procesada en el backend.
        leadId, // Identificador único del lead que se actualizará en el sistema.
    };

    // Realiza la solicitud al backend utilizando la función fetchData, pasando los datos
    // construidos en requestData y enviándolos al endpoint específico para actualizar la información del lead.
    // La URL "leads/updateLeadActionApi" es el endpoint donde se procesará esta actualización.
    return await fetchData("leads/updateLeadActionApi", requestData);
};






/**
 * Obtiene la lista de opciones de pérdida de leads (motivos por los que un lead fue perdido) desde el backend.
 *
 * Esta función construye una solicitud utilizando datos comunes necesarios para todas las operaciones,
 * como tokens de autenticación o configuraciones específicas de la API. Luego envía la solicitud al
 * endpoint correspondiente para obtener las opciones disponibles para la clasificación de leads perdidos.
 *
 * @returns {Promise<Object>} - Devuelve una promesa que resuelve con los datos de las opciones de pérdida
 * una vez que la solicitud es procesada por el backend.
 */
export const get_optionLoss = async (valueID) => {
    // Preparación del objeto requestData con los parámetros de autenticación y configuración global necesarios.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes, como tokens o configuración de API.
        valueID,
    };

    // Envía la solicitud al endpoint específico para obtener las opciones de pérdida de leads.
    return await fetchData("leads/loss_reasons", requestData);
};




/**
 * Marca un lead como perdido y envía la transacción al backend.
 *
 * Esta función construye una solicitud con datos comunes necesarios para la autenticación y configuración de la API,
 * y luego envía la solicitud al endpoint correspondiente para actualizar el estado de un lead como perdido.
 *
 * @param {number} leadId - El ID del lead que se marcará como perdido.
 * @returns {Promise<Object>} - Devuelve una promesa que resuelve con los datos de la transacción procesada por el backend.
 */
export const setLostStatusForLeadTransactions = async (leadId, descripcionEvento) => {
    // Prepara el objeto requestData con los datos comunes de autenticación y configuración global necesarios.
    const requestData = {
        ...commonRequestData, // Datos comunes como tokens de autenticación o configuraciones de API.
        leadId, // ID del lead a marcar como perdido.
        descripcionEvento,
    };

    // Envía la solicitud al endpoint específico para marcar el lead como perdido.
    return await fetchData("leads/setLostStatusForLeadTransactions", requestData);
};



/**
 * Función para obtener todos los leads, sin importar si son nuevos o requieren atención.
 *
 * @param {Object} params - Parámetros necesarios para la solicitud.
 * @param {number} params.idnetsuite_admin - ID del administrador en Netsuite, utilizado para la autenticación.
 * @param {string} params.rol_admin - Rol del administrador, necesario para determinar permisos de acceso.
 * @param {string} params.startDate - Fecha de inicio para filtrar los leads.
 * @param {string} params.endDate - Fecha de fin para filtrar los leads.
 * @param {string} params.filterOption - Opción de filtrado para determinar el tipo de leads a obtener.
 * @returns {Promise} - Devuelve una promesa que resuelve con los datos de la respuesta de la API.
 */
export const getAllLeadsTotal = async ({ idnetsuite_admin, rol_admin, startDate, endDate, filterOption }) => {
    // Construcción del objeto requestData combinando los datos comunes con los parámetros específicos recibidos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud, como tokens o configuraciones generales.
        idnetsuite_admin, // ID del administrador de Netsuite utilizado para la autenticación e identificación.
        rol_admin, // Rol del administrador utilizado para verificar permisos y accesos.
        startDate, // Fecha de inicio del filtro.
        endDate, // Fecha de fin del filtro.
        filterOption, // Opción de filtro aplicada a los leads.
    };

    // Realiza la solicitud a la API para obtener la lista completa de leads.
    // La URL "leads/getAll_LeadsComplete" corresponde al endpoint que maneja esta petición.
    return await fetchData("leads/getAllLeadsTotal", requestData); // Devuelve la lista completa de leads.
};