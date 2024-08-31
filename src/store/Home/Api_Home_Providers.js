// Importa las funciones comunes y de API necesarias desde la ruta especificada
import { commonRequestData, fetchData } from "../../api";

/**
 * Función para obtener los nuevos leads disponibles.
 * @param {Object} params - Los parámetros de la función.
 * @param {number} params.idnetsuite_admin - El ID del administrador de Netsuite que realiza la solicitud.
 * @param {number} params.rol_admin - El rol del administrador para validar permisos.
 * @returns {Promise<Object>} - Retorna una promesa con los datos de los nuevos leads.
 */
export const fetchNewLeads = async ({ idnetsuite_admin, rol_admin }) => {
    const requestData = {
        ...commonRequestData, // Datos comunes que se envían en cada petición, definidos en otro lugar.
        idnetsuite_admin, // ID del administrador que está solicitando los leads.
        rol_admin, // Rol del administrador para verificar los permisos y accesos.
    };
    return await fetchData("home/new", requestData); // Realiza la llamada a la API para obtener los nuevos leads.
};

/**
 * Función para obtener los leads que están bajo atención.
 * @param {Object} params - Los parámetros de la función.
 * @param {number} params.idnetsuite_admin - El ID del administrador de Netsuite que realiza la solicitud.
 * @param {number} params.rol_admin - El rol del administrador para validar permisos.
 * @returns {Promise<Object>} - Retorna una promesa con los datos de los leads bajo atención.
 */
export const fetchLeadsUnderAttention = async ({ idnetsuite_admin, rol_admin }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
    };
    return await fetchData("home/attention", requestData); // Llama a la API para obtener los leads que están siendo atendidos.
};

/**
 * Función para obtener todos los eventos disponibles.
 * @param {Object} params - Los parámetros de la función.
 * @param {number} params.idnetsuite_admin - El ID del administrador de Netsuite que realiza la solicitud.
 * @param {number} params.rol_admin - El rol del administrador para validar permisos.
 * @returns {Promise<Object>} - Retorna una promesa con los datos de todos los eventos.
 */
export const fetchAllEvents = async ({ idnetsuite_admin, rol_admin }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
    };
    return await fetchData("events/home/events", requestData); // Realiza la llamada a la API para obtener todos los eventos.
};

/**
 * Función para actualizar el estado de un evento específico.
 * @param {Object} params - Los parámetros de la función.
 * @param {number} params.idnetsuite_admin - El ID del administrador de Netsuite que realiza la solicitud.
 * @param {number} params.id_calendar - El ID del evento que se quiere actualizar.
 * @param {string} params.newStatus - El nuevo estado que se quiere asignar al evento.
 * @returns {Promise<Object>} - Retorna una promesa con la respuesta de la actualización.
 */
export const updateEventStatus = async ({ idnetsuite_admin, id_calendar, newStatus }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        id_calendar, // ID del evento en el calendario que se desea actualizar.
        newStatus, // Nuevo estado que se asignará al evento.
    };
    return await fetchData("events/home/updateEventsStatusAsync", requestData); // Llama a la API para actualizar el estado del evento.
};

/**
 * Función para obtener todas las oportunidades disponibles.
 * @param {Object} params - Los parámetros de la función.
 * @param {number} params.idnetsuite_admin - El ID del administrador de Netsuite que realiza la solicitud.
 * @param {number} params.rol_admin - El rol del administrador para validar permisos.
 * @returns {Promise<Object>} - Retorna una promesa con los datos de todas las oportunidades.
 */
export const fetchOpportunities = async ({ idnetsuite_admin, rol_admin }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
    };
    return await fetchData("home/fetchOportunityAsync", requestData); // Realiza la llamada a la API para obtener todas las oportunidades.
};

/**
 * Función para obtener todas las órdenes de venta disponibles.
 * @param {Object} params - Los parámetros de la función.
 * @param {number} params.idnetsuite_admin - El ID del administrador de Netsuite que realiza la solicitud.
 * @param {number} params.rol_admin - El rol del administrador para validar permisos.
 * @returns {Promise<Object>} - Retorna una promesa con los datos de todas las órdenes de venta.
 */
export const fetchAllOrderSale = async ({ idnetsuite_admin, rol_admin }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
    };
    return await fetchData("home/fetchAllOrderSale", requestData); // Llama a la API para obtener todas las órdenes de venta.
};
