/********************************************** MODULE IMPORTS ****************************************************/
// Importación de las funciones necesarias para interactuar con los servicios de API y los slices de Redux.
import { generateLeadBitacora } from "../leads/thunksLeads";
import { fetchGetMonthlyData, fetchGetMonthlyDataKpi, fetchupdateEventDate, getAllBanners, getAllEventsHome, updateEventStatus } from "./Api_Home_Providers";

import { setLeadsNew, setListEvents, setListOportunity, setListOrderSale, setListOrderSalePending, setlistAttentions, setlistEventsPending, setlistGraficoKpi, updateDateCalendar } from "./HomeSlice";

/**
 * Inicia la carga asincrónica de todos los leads y eventos relacionados.
 *
 * Esta función realiza una solicitud al backend para obtener datos agregados
 * como leads, eventos, oportunidades, y más, luego actualiza el estado de Redux
 * con los datos obtenidos.
 *
 * @returns {Function} Thunk - Una función que puede ser despachada por Redux Thunk.
 */
export const startLoadingAllLeads = () => {
    return async (dispatch, getState) => {
        // Extrae el id y rol del administrador desde el estado actual de autenticación en Redux
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Realiza la llamada a la API para obtener los datos de banners
            const result = await getAllBanners({ idnetsuite_admin, rol_admin });
            const data = result.data;

            // Extrae los datos necesarios y maneja los posibles valores nulos
            const resultData = {
                total_new: data["0"]?.[0]?.total_new || 0,
                total_attention: data["1"]?.[0]?.total_attention || 0,
                total_events: data["2"]?.[0]?.total_events || 0,
                total_oport: data["3"]?.[0]?.total_oport || 0,
                total_orders: data["4"]?.[0]?.total_orders || 0,
                total_orders_pending: data["5"]?.[0]?.total_orders_pending || 0,
            };

            // Actualiza el estado de Redux con los datos obtenidos
            dispatch(setLeadsNew(resultData.total_new));
            dispatch(setlistAttentions(resultData.total_attention));
            dispatch(setListEvents(resultData.total_events));
            dispatch(setListOportunity(resultData.total_oport));
            dispatch(setListOrderSale(resultData.total_orders));
            dispatch(setListOrderSalePending(resultData.total_orders_pending));
        } catch (error) {
            // Muestra el error en la consola en caso de fallo en la API
            console.error("Error al cargar los leads y eventos:", error);
        }
    };
};

/**
 * Carga asincrónicamente los eventos pendientes del home.
 *
 * Hace una solicitud al backend para obtener la lista de eventos pendientes y
 * luego actualiza el estado de Redux con los datos obtenidos.
 *
 * @returns {Function} Thunk - Una función que puede ser despachada por Redux Thunk.
 */
export const setGetEventsHome = () => {
    return async (dispatch, getState) => {
        // Extrae el id y rol del administrador desde el estado actual de autenticación en Redux
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llamada a la API para obtener los eventos del home
            const result = await getAllEventsHome({ idnetsuite_admin, rol_admin });

            // Actualiza el estado de Redux con los eventos pendientes
            dispatch(setlistEventsPending(result.data["0"]));
        } catch (error) {
            // Maneja errores de la API y los muestra en la consola
            console.error("Error al cargar los eventos pendientes del home:", error);
        }
    };
};

/**
 * Actualiza el estado de un evento en la tabla `calendars`.
 *
 * Esta función realiza una solicitud asincrónica para actualizar el estado de un evento
 * basado en el `id_calendar` y el nuevo estado proporcionado.
 *
 * @param {Number} id_calendar - El ID del evento en el calendario a actualizar.
 * @param {String} newStatus - El nuevo estado que debe ser asignado al evento.
 * @returns {Function} Thunk - Una función que puede ser despachada por Redux Thunk.
 */
export const updateEventsStatusThunksHome = (id_calendar, newStatus, leadId, valueStatus) => {
    return async (dispatch, getState) => {
        // Extrae el ID del administrador de Netsuite del estado de autenticación
        const { idnetsuite_admin } = getState().auth;

        try {
            // Realiza la solicitud para actualizar el estado del evento
            await updateEventStatus({ idnetsuite_admin, id_calendar, newStatus });

            // Define la descripción del evento, en este caso es la nota proporcionada
            const descripcionEvento = "Se ha realizado un cambio de estado en el evento. : " + newStatus;

            // Valores adicionales que serán enviados al generar la bitácora del lead
            const additionalValues = {
                valorDeCaida: 51,
                tipo: descripcionEvento,
                estado_lead: 1,
                accion_lead: 6,
                seguimiento_calendar: 0,
                valor_segimineto_lead: 3,
            };

            await dispatch(generateLeadBitacora(idnetsuite_admin, leadId, additionalValues, descripcionEvento, valueStatus));
        } catch (error) {
            // Manejo de errores durante la solicitud
            console.error("Error al actualizar el estado del evento:", error);
        }
    };
};

/**
 * Solicita los datos del gráfico mensual de KPIs.
 *
 * Esta función realiza una solicitud asincrónica para obtener los datos del gráfico mensual de KPIs
 * entre un rango de fechas, y actualiza el estado de Redux con los datos obtenidos.
 *
 * @param {String} startDate - La fecha de inicio del rango de búsqueda.
 * @param {String} endDate - La fecha de fin del rango de búsqueda.
 * @returns {Function} Thunk - Una función que puede ser despachada por Redux Thunk.
 */
export const setgetMonthlyDataKpi = (startDate, endDate) => {
    return async (dispatch, getState) => {
        // Extrae el id y rol del administrador desde el estado actual de autenticación en Redux
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
             dispatch(setlistGraficoKpi());
            // Solicita los datos del gráfico mensual de KPIs
            const result = await fetchGetMonthlyDataKpi({ idnetsuite_admin, rol_admin, startDate, endDate });

            console.log("🚀 -------------------------------------------------------🚀");
            console.log("🚀 ~ file: thunksHome.js:136 ~ return ~ result:", result);
            console.log("🚀 -------------------------------------------------------🚀");


            // Actualiza el estado de Redux con los datos obtenidos
            dispatch(setlistGraficoKpi(result.data["0"]));
        } catch (error) {
            // Manejo de errores durante la solicitud
            console.error("Error al cargar los datos del gráfico mensual de KPIs:", error);
        }
    };
};

/**
 * Solicita los datos del gráfico mensual.
 *
 * Esta función realiza una solicitud asincrónica para obtener los datos del gráfico mensual entre
 * un rango de fechas. A diferencia de la función `setgetMonthlyDataKpi`, esta función solo devuelve
 * los datos sin actualizar el estado de Redux.
 *
 * @param {String} startDate - La fecha de inicio del rango de búsqueda.
 * @param {String} endDate - La fecha de fin del rango de búsqueda.
 * @returns {Promise} - Devuelve una promesa con los datos solicitados.
 */
export const setgetMonthlyData = (startDate, endDate) => {
    return async (dispatch, getState) => {
        // Extrae el id y rol del administrador desde el estado actual de autenticación en Redux
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Solicita los datos del gráfico mensual
            const result = await fetchGetMonthlyData({ idnetsuite_admin, rol_admin, startDate, endDate });



            return result;
        } catch (error) {
            // Manejo de errores durante la solicitud
            console.error("Error al cargar los datos del gráfico mensual:", error);
        }
    };
};

/**
 * Actualiza la fecha de un evento en el calendario.
 *
 * Esta función se encarga de actualizar la fecha de un evento, conservando la parte de la hora
 * de la fecha anterior si existe. Se realiza una llamada a la API para persistir este cambio
 * en el servidor. También actualiza el estado en Redux para reflejar el cambio localmente.
 *
 * @param {String} eventId - El ID del evento que se va a actualizar.
 * @param {String} newDate - La nueva fecha para el evento en formato YYYY-MM-DD.
 * @param {String} oldDate - La fecha anterior del evento, de la cual se extraerá la hora (si existe).
 * @returns {Promise<String>} - Devuelve una promesa que resuelve con "ok" si la operación fue exitosa.
 */
export const updateEventDate = (eventId, newDate, oldDate) => {
    return async (dispatch) => {
        try {

            const extractDatePart = (dateString) => (dateString ? (dateString.includes("T") ? "T" + dateString.split("T")[1] : dateString.includes(":") ? dateString.slice(dateString.indexOf(":")) : "") : "");

            // Extraer la parte de la hora de oldDate
            const oldDateResult = extractDatePart(oldDate);

            // Actualizar el estado local en Redux con la nueva fecha y la hora extraída
            dispatch(updateDateCalendar({ id: eventId, selectedValue: newDate + oldDateResult }));

            // Realizar una llamada a la API para actualizar la fecha del evento en el servidor
            const result = await fetchupdateEventDate({ eventId: eventId, selectedValue: newDate + oldDateResult });
            console.log("result", result);

            // Devolver "ok" si la operación fue exitosa
            return "ok";
        } catch (error) {
            // Manejo de errores: registrar cualquier error en la consola
            console.error("Error al actualizar la fecha del evento:", error);
        }
    };
};
