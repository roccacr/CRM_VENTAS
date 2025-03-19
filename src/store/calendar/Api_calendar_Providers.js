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

/**
 * Función asincrónica para crear un nuevo evento en el calendario.
 *
 * Envía una solicitud al backend para registrar un nuevo evento basado en los parámetros proporcionados,
 * como el nombre del evento, tipo, fechas, ID del administrador y otros detalles específicos del evento.
 *
 * @param {Object} params - Parámetros necesarios para la solicitud.
 * @param {number} params.idnetsuite_admin - ID del administrador de Netsuite, quien crea el evento.
 * @param {string} params.nombreEvento - Nombre del evento, que lo describe brevemente.
 * @param {string} params.tipoEvento - Tipo de evento (ej. Llamada, Reunión, etc.), que define su naturaleza.
 * @param {string} params.descripcionEvento - Descripción detallada del evento.
 * @param {string} params.formatdateIni - Fecha y hora de inicio del evento en formato ISO (ej. 'YYYY-MM-DDTHH:MM').
 * @param {string} params.formatdateFin - Fecha y hora de finalización del evento en formato ISO (ej. 'YYYY-MM-DDTHH:MM').
 * @param {string} params.horaInicio - Hora específica de inicio del evento (formato 'HH:MM').
 * @param {string} params.horaFinal - Hora específica de finalización del evento (formato 'HH:MM').
 * @param {number} params.leadId - ID del lead al cual se asocia el evento.
 * @param {string} params.colorEvento - Color asignado al evento, según su tipo o categoría.
 * @returns {Promise} - Devuelve una promesa que se resuelve con los datos de la respuesta de la API.
 */
export const createCalendarEvent = async ({ idnetsuite_admin, nombreEvento, tipoEvento, descripcionEvento, formatdateIni, formatdateFin, horaInicio, horaFinal, leadId, colorEvento, citaValue }) => {
    // Construye el objeto de datos para la solicitud, combinando datos comunes y específicos del evento
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (ej. tokens de autenticación).
        idnetsuite_admin, // ID del administrador que está creando el evento
        nombreEvento, // Nombre descriptivo del evento
        tipoEvento, // Tipo o categoría del evento (llamada, reunión, etc.)
        descripcionEvento, // Detalle adicional sobre el evento
        formatdateIni, // Fecha y hora de inicio en formato ISO
        formatdateFin, // Fecha y hora de finalización en formato ISO
        horaInicio, // Hora de inicio del evento
        horaFinal, // Hora de finalización del evento
        leadId, // ID del lead relacionado con el evento
        colorEvento, // Color visual que se asigna al evento
        citaValue, // sabemos si es cita o no
    };

    // Realiza la solicitud al endpoint adecuado en el servidor para crear el evento en el calendario.
    // La URL 'calendars/createEvent' gestiona la creación de nuevos eventos en el calendario.
    return await fetchData("calendars/createEvent", requestData);
};

/**
 * Función asíncrona para obtener los datos de eventos específicos.
 *
 * @function get_dataEvents
 * @param {Object} params - Objeto que contiene los parámetros requeridos para la solicitud.
 * @param {number|string} params.id - El ID del evento que se desea obtener.
 * @returns {Promise<Object>} - Retorna una promesa que se resuelve con los datos del evento obtenidos.
 *
 * @description
 * Esta función construye un objeto de solicitud `requestData` combinando los datos comunes (como autenticación y otros metadatos generales)
 * con el `id` específico del evento, que se pasa como parámetro. Luego utiliza la función `fetchData` para enviar la solicitud al endpoint
 * `calendars/getEvents` y obtener los datos del evento desde el servidor.
 *
 * @example
 * const eventData = await get_dataEvents({ id: 123 });
 * console.log(eventData);
 */

export const get_dataEvents = async ({ id }) => {
    // Construye el objeto de datos para la solicitud, combinando datos comunes y específicos del evento
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (ej. tokens de autenticación, claves de API, etc.).
        id, // ID del evento a obtener, pasado como parámetro
    };

    // Llama a la función fetchData para enviar la solicitud al backend con el endpoint y los datos correspondientes
    return await fetchData("calendars/getDataEevent", requestData);
};

/**
 * Obtiene las citas de un evento específico en base al ID proporcionado.
 *
 * @param {object} param0 - Objeto que contiene el ID del evento a consultar.
 * @param {number} param0.id - El ID del evento para el cual se deben obtener las citas.
 * @returns {Promise<object>} - Retorna los datos de las citas obtenidas desde el backend.
 */
export const get_event_Citas = async ({ id }) => {
    // Construye el objeto de datos para la solicitud, combinando datos comunes y específicos del evento.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (ej. tokens de autenticación, claves de API, etc.).
        id, // ID del evento a obtener, pasado como parámetro.
    };

    // Envía la solicitud al backend utilizando la función fetchData con el endpoint y los datos correspondientes.
    return await fetchData("calendars/get_event_Citas", requestData);
};

/**
 * Edita un evento existente en el calendario.
 *
 * @param {object} eventParams - Objeto con los parámetros necesarios para editar el evento.
 * @param {number} eventParams.idnetsuite_admin - ID del administrador de Netsuite que realiza la edición.
 * @param {number} eventParams.id_calendar - ID del evento en el calendario que se va a editar.
 * @param {string} eventParams.nombreEvento - Nombre descriptivo del evento.
 * @param {string} eventParams.tipoEvento - Tipo o categoría del evento (llamada, reunión, cita, etc.).
 * @param {string} eventParams.descripcionEvento - Descripción o detalle adicional del evento.
 * @param {string} eventParams.formatdateIni - Fecha y hora de inicio del evento en formato ISO (YYYY-MM-DDTHH:mm).
 * @param {string} eventParams.formatdateFin - Fecha y hora de finalización del evento en formato ISO (YYYY-MM-DDTHH:mm).
 * @param {string} eventParams.horaInicio - Hora de inicio del evento (solo hora).
 * @param {string} eventParams.horaFinal - Hora de finalización del evento (solo hora).
 * @param {number} eventParams.leadId - ID del lead relacionado con el evento (opcional).
 * @param {string} eventParams.colorEvento - Color visual asignado al evento en el calendario.
 * @param {number} eventParams.citaValue - Indicador booleano (0 o 1) que señala si el evento es una cita.
 *
 * @returns {Promise<object>} - Retorna una promesa con la respuesta del servidor al intentar editar el evento.
 */
export const editCalendarEvent = async ({ idnetsuite_admin, id_calendar, nombreEvento, tipoEvento, descripcionEvento, formatdateIni, formatdateFin, horaInicio, horaFinal, leadId, colorEvento, citaValue }) => {
    // Construye el objeto de datos para la solicitud al backend,
    // combinando los datos comunes con los específicos del evento.
    const requestData = {
        ...commonRequestData, // Se extienden los datos comunes (ejemplo: tokens de autenticación, headers, etc.)
        idnetsuite_admin, // ID del administrador de Netsuite que realiza la edición.
        id_calendar, // ID del evento en el calendario a editar.
        nombreEvento, // Nombre descriptivo del evento.
        tipoEvento, // Categoría o tipo de evento (Llamada, Reunión, etc.).
        descripcionEvento, // Detalles adicionales que describen el evento.
        formatdateIni, // Fecha y hora de inicio del evento en formato ISO.
        formatdateFin, // Fecha y hora de finalización del evento en formato ISO.
        horaInicio, // Hora de inicio del evento (para visualización).
        horaFinal, // Hora de finalización del evento (para visualización).
        leadId, // ID del lead relacionado con este evento, si existe.
        colorEvento, // Color que se usará para identificar el evento visualmente.
        citaValue, // Valor booleano (1 o 0) para indicar si es una cita.
    };

    // Realiza una solicitud POST al servidor para editar el evento en el calendario.
    // Se utiliza la ruta 'calendars/editEvent' para realizar la actualización del evento.
    return await fetchData("calendars/editEvent", requestData);
};



/**
 * Actualiza la fecha de un evento en el calendario, moviéndolo a una nueva fecha.
 * 
 * @param {object} params - Parámetros necesarios para la solicitud.
 * @param {number} params.id - El ID del evento que se desea mover.
 * @param {string} params.newDate - La nueva fecha a la que se desea mover el evento (en formato YYYY-MM-DD).
 * 
 * @returns {Promise<object>} - Retorna la respuesta del servidor tras mover el evento.
 */
export const update_event_MoveDate = async ({ id, newDateStart, newDateEnd }) => {
    // Construye el objeto que contiene todos los datos necesarios para la solicitud, mezclando
    // la información común con los detalles específicos del evento.
    const requestData = {
        ...commonRequestData, // Incluye datos comunes como tokens de autenticación o claves API.
        id, // ID del evento a modificar.
        newDateStart, // Nueva fecha asignada para el evento.
        newDateEnd, // Nueva fecha de finalización del evento
    };

    // Realiza la solicitud al backend, enviando los datos a la ruta correspondiente
    // que maneja la actualización de eventos en el calendario.
    return await fetchData("calendars/update_event_MoveDate", requestData);
};



/**
 * Actualiza el estado de un evento en el calendario.
 * @param {Object} params - Parámetros necesarios para la actualización.
 * @param {number} params.id - El ID del evento que se va a actualizar.
 * @param {string} params.NewStatus - El nuevo estado que se asignará al evento.
 * @returns {Promise<Object>} - Promesa que resuelve los datos de la respuesta del backend.
 */
export const update_Status_Event = async ({ id, NewStatus,EstadoAccion }) => {
    // Mezcla los datos comunes del sistema con los parámetros específicos del evento.
    // Esto puede incluir tokens de autenticación, claves API, entre otros valores globales.
    const requestData = {
        ...commonRequestData, // Datos comunes para todas las solicitudes del sistema.
        id, // ID del evento a actualizar.
        NewStatus, // Nuevo estado para el evento.
        EstadoAccion
    };

    // Envía la solicitud al backend a través de la función `fetchData`, que está encargada
    // de manejar la lógica de las solicitudes HTTP (GET, POST, etc.). La ruta del backend
    // se encarga de procesar la actualización de estado.
    return await fetchData("calendars/update_Status_Event", requestData);
};


export const getAll_ListEvent = async ({ idnetsuite_admin, rol_admin, dateStart, dateEnd }) => {
    // Construye el objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (ej. tokens, configuraciones generales).
        idnetsuite_admin, // ID del administrador de Netsuite, necesario para la autenticación/identificación.
        rol_admin, // Rol del administrador, utilizado para verificar permisos de acceso.
        dateStart,
        dateEnd,
    };

    // Realiza la solicitud a la API para obtener la lista de nuevos calendarios.
    // La URL "calendar/get_Calendars" apunta al endpoint que maneja esta petición en el servidor.
    // requestData contiene todos los parámetros necesarios para ejecutar la solicitud.
    return await fetchData("calendars/getAll_ListEvent", requestData); // Retorna la lista de nuevos calendarios desde la API.
};


export const obtener_EventosCliente = async ({ leadDetails }) => {
    // Construye el objeto de datos para la solicitud, combinando los datos comunes requeridos con el ID específico del cliente.
    // commonRequestData contiene información como tokens de autenticación y configuraciones necesarias para todas las solicitudes a la API.
    const requestData = {
        ...commonRequestData, // Datos comunes para todas las solicitudes.
        leadDetails, // Identificador único del cliente cuyos eventos se desean obtener.
    };

    // Realiza la solicitud a la API para obtener la lista de eventos asociados al cliente especificado.
    // La URL "leads/eventos" representa el endpoint en el servidor donde se procesan las solicitudes de eventos.
    // requestData contiene tanto los datos comunes como el ID del cliente, necesarios para ejecutar esta solicitud.
    return await fetchData("leads/eventos", requestData); // Retorna la lista de eventos obtenida desde la API.
};





