// Importa las funciones comunes y de API necesarias desde la ruta especificada
import { commonRequestData, fetchData } from "../../api";
/******************  neew version banners get information */
export const getAllBanners = async ({ idnetsuite_admin, rol_admin }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
    };
    return await fetchData("home/getAllBanners", requestData);
};

export const getAllEventsHome = async ({ idnetsuite_admin, rol_admin }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
    };
    return await fetchData("home/getAllEventsHome", requestData);
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
    return await fetchData("home/updateEventStatus", requestData); // Llama a la API para actualizar el estado del evento.
};




/**
 * Función para obtener los datos del gráfico mensual de KPIs.
 * @param {Object} params - Los parámetros de la función.
 * @param {number} params.idnetsuite_admin - El ID del administrador de Netsuite que realiza la solicitud.
 * @param {number} params.rol_admin - El rol del administrador para validar permisos.
 * @param {string} params.startDate - Fecha de inicio para filtrar los datos del gráfico de KPIs.
 * @param {string} params.endDate - Fecha de fin para filtrar los datos del gráfico de KPIs.
 * @param {Array} params.campaigns - Lista de campañas para filtrar los datos del gráfico.
 * @param {Array} params.projects - Lista de proyectos para filtrar los datos del gráfico.
 * @returns {Promise<Object>} - Retorna una promesa con los datos del gráfico mensual de KPIs, incluyendo el total de leads y oportunidades.
 */
export const fetchGetMonthlyDataKpi = async ({ idnetsuite_admin, rol_admin, startDate, endDate, campaigns, projects }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
        startDate,
        endDate,
        campaigns,
        projects,
    };
    return await fetchData("home/getMonthlyDatakpi", requestData); // Llama a la API para obtener los datos del gráfico mensual de KPIs.
};

/**
 * Función para obtener los datos del gráfico mensual.
 * @param {Object} params - Los parámetros de la función.
 * @param {number} params.idnetsuite_admin - El ID del administrador de Netsuite que realiza la solicitud.
 * @param {number} params.rol_admin - El rol del administrador para validar permisos.
 * @param {string} params.startDate - Fecha de inicio para filtrar los datos del gráfico.
 * @param {string} params.endDate - Fecha de fin para filtrar los datos del gráfico.
 * @returns {Promise<Object>} - Retorna una promesa con los datos del gráfico mensual, incluyendo el total de leads y oportunidades.
 */
export const fetchGetMonthlyData = async ({ idnetsuite_admin, rol_admin, startDate, endDate }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
        startDate,
        endDate
    };
    return await fetchData("home/getMonthlyData", requestData); // Llama a la API para obtener los datos del gráfico mensual.
};





/**
 * modifcar la fecha del evento 
 * @param {Object} params - Los parámetros de la función.
 * @param {number} params.idnetsuite_admin - El ID del administrador de Netsuite que realiza la solicitud.
 * @param {number} params.rol_admin - El rol del administrador para validar permisos.
 * @param {string} params.startDate - Fecha de inicio para filtrar los datos del gráfico.
 * @param {string} params.endDate - Fecha de fin para filtrar los datos del gráfico.
 * @returns {Promise<Object>} - Retorna una promesa con los datos del gráfico mensual, incluyendo el total de leads y oportunidades.
 */
export const fetchupdateEventDate = async ({ eventId, selectedValue }) => {
    console.log("eventId", eventId);
    console.log("selectedValue", selectedValue);
    const requestData = {
        ...commonRequestData,
        eventId,
        selectedValue,
    };
    return await fetchData("home/fetchupdateEventDate", requestData); // Llama a la API para obtener los datos del gráfico mensual.
};













