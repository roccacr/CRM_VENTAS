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
        citaValue // sabemos si es cita o no
    };

    // Realiza la solicitud al endpoint adecuado en el servidor para crear el evento en el calendario.
    // La URL 'calendars/createEvent' gestiona la creación de nuevos eventos en el calendario.
    return await fetchData("calendars/createEvent", requestData);
};
