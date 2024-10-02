import { generateLeadBitacora } from "../leads/thunksLeads";
import { createCalendarEvent, editCalendarEvent, get_CalendarFetch, get_dataEvents, get_event_Citas } from "./Api_calendar_Providers";

/**
 * Acción asincrónica para obtener la lista de nuevos calendarios.
 *
 * Realiza una solicitud al backend para obtener los calendarios nuevos basados en el ID y rol del administrador,
 * y luego despacha una acción para actualizar el estado de Redux con los datos obtenidos.
 *
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const get_Calendar = () => {
    return async (dispatch, getState) => {
        // Extrae idnetsuite_admin y rol_admin del estado de autenticación en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llama a la API para obtener los calendarios nuevos, basados en el rol y el ID del administrador.
            const result = await get_CalendarFetch({ idnetsuite_admin, rol_admin });

            // Retorna el primer conjunto de datos de la respuesta para su uso posterior.
            return result.data["0"];
        } catch (error) {
            // En caso de error, registra el mensaje en la consola.
            console.error("Error al cargar los nuevos calendarios:", error);
        }
    };
};

/**
 * Acción asincrónica para crear un nuevo evento asociado a un lead.
 *
 * Esta función envía una solicitud al backend para registrar un nuevo evento en el calendario,
 * utilizando la información proporcionada como nombre, tipo, fechas y detalles adicionales del evento.
 * Además, asigna un color basado en el tipo de evento y maneja posibles errores que puedan surgir
 * durante la solicitud.
 *
 * @param {string} nombreEvento - Nombre descriptivo del evento.
 * @param {string} tipoEvento - Tipo de evento (ej. Llamada, Tarea, Reunión, etc.).
 * @param {string} descripcionEvento - Breve descripción del evento.
 * @param {string} fechaInicio - Fecha de inicio del evento en formato YYYY-MM-DD.
 * @param {string} fechaFinal - Fecha de finalización del evento en formato YYYY-MM-DD.
 * @param {string} horaInicio - Hora de inicio del evento en formato HH:MM.
 * @param {string} horaFinal - Hora de finalización del evento en formato HH:MM.
 * @param {number} leadId - Identificador único del lead al cual está asociado el evento.
 * @param {string} valueStatus - Estado adicional para el evento, utilizado para acciones de seguimiento.
 * @returns {Function} Thunk - Función que puede ser ejecutada gracias a Redux Thunk.
 */
export const createEventForLead = (nombreEvento, tipoEvento, descripcionEvento, fechaInicio, fechaFinal, horaInicio, horaFinal, leadId=0, valueStatus) => {
    return async (dispatch, getState) => {
        // Variables comunes
        const { idnetsuite_admin } = getState().auth; // ID del administrador de Netsuite

        // Definición de colores por tipo de evento
        const eventColors = {
            Llamada: "#556ee6",
            Whatsapp: "#556ee6",
            Correo: "#556ee6",
            Tarea: "#343a40",
            Reunion: "#34c38f",
            Seguimientos: "#f46a6a",
            Cita: "#f1b44c", // Color específico para el tipo de evento 'Cita'
        };

        // Variables de formato de fecha y hora
        const fechaHoraInicio = `${fechaInicio}T${horaInicio}`;
        const fechaHoraFin = `${fechaFinal}T${horaFinal}`;

        // Asignación de variables adicionales
        const colorEvento = eventColors[tipoEvento] || "#000000"; // Color basado en el tipo de evento
        const citaValue = tipoEvento === "Cita" ? 1 : 0; // Valor específico si es una cita

        // Valores adicionales para la solicitud
        const additionalValues = {
            valorDeCaida: 51,
            tipo: "Se generó un evento para el cliente",
            estado_lead: 1,
            accion_lead: 6,
            seguimiento_calendar: 0,
            valor_segimineto_lead: 3,
        };

        // Construcción del objeto con los parámetros para enviar a la API
       const eventParams = {
           idnetsuite_admin,
           nombreEvento,
           tipoEvento,
           descripcionEvento,
           formatdateIni: fechaHoraInicio,
           formatdateFin: fechaHoraFin,
           horaInicio,
           horaFinal,
           leadId: leadId || 0, // Si leadId es vacío, se asigna 0
           colorEvento,
           citaValue,
       };

        try {
            // Envío de solicitud al backend para crear el evento
            await createCalendarEvent(eventParams);

            if (eventParams.leadId> 0) {
                 await dispatch(generateLeadBitacora(idnetsuite_admin, leadId, additionalValues, descripcionEvento, valueStatus));
            }

            // Retorno de la respuesta de la API si es necesario
            return "ok";
        } catch (error) {
            // Manejo de errores en caso de fallo
            console.error("Error al crear el evento para el lead:", error);
        }
    };
};



/**
 * Acción asincrónica para obtener la lista de nuevos calendarios.
 *
 * Realiza una solicitud al backend para obtener los calendarios nuevos basados en el ID y rol del administrador,
 * y luego despacha una acción para actualizar el estado de Redux con los datos obtenidos.
 *
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getDataEevent = (id) => {


    return async () => {

        try {
            // Llama a la API para obtener los calendarios nuevos, basados en el rol y el ID del administrador.
            const result = await get_dataEvents({ id });


            // Retorna el primer conjunto de datos de la respuesta para su uso posterior.
            return result.data["0"]["0"];
        } catch (error) {
            // En caso de error, registra el mensaje en la consola.
            console.error("Error al extarer los datos del evento:", error);
        }
    };
};



/**
 * Valida si el cliente tiene otras citas o no.
 * 
 * @param {number} id - El ID del cliente para verificar sus citas.
 * @returns {Promise<object>} - Retorna un objeto con los datos de la primera cita encontrada, o un error en caso de fallo.
 */
export const getSpecificLeadCitas = (id) => {


    return async () => {
        try {
            // Llama a la API para obtener los eventos/citas, filtrados por el ID del cliente.
            const result = await get_event_Citas({ id });


            // Retorna el primer conjunto de datos de la respuesta para su uso posterior.
            return result.data["0"];
        } catch (error) {
            // En caso de error, registra el mensaje en la consola.
            console.error("Error al extraer los datos del evento:", error);
        }
    };
};



export const editeEventForLead = (id_calendar, nombreEvento, tipoEvento, descripcionEvento, fechaInicio, fechaFinal, horaInicio, horaFinal, leadId = 0, valueStatus) => {
    return async (dispatch, getState) => {
        // Variables comunes
        const { idnetsuite_admin } = getState().auth; // ID del administrador de Netsuite

        // Definición de colores por tipo de evento
        const eventColors = {
            Llamada: "#556ee6",
            Whatsapp: "#556ee6",
            Correo: "#556ee6",
            Tarea: "#343a40",
            Reunion: "#34c38f",
            Seguimientos: "#f46a6a",
            Cita: "#f1b44c", // Color específico para el tipo de evento 'Cita'
        };

        // Variables de formato de fecha y hora
        const fechaHoraInicio = `${fechaInicio}T${horaInicio}`;
        const fechaHoraFin = `${fechaFinal}T${horaFinal}`;

        // Asignación de variables adicionales
        const colorEvento = eventColors[tipoEvento] || "#000000"; // Color basado en el tipo de evento
        const citaValue = tipoEvento === "Cita" ? 1 : 0; // Valor específico si es una cita

        // Valores adicionales para la solicitud
        const additionalValues = {
            valorDeCaida: 51,
            tipo: "Se Edito un evento para el cliente",
            estado_lead: 1,
            accion_lead: 6,
            seguimiento_calendar: 0,
            valor_segimineto_lead: 3,
        };

        // Construcción del objeto con los parámetros para enviar a la API
        const eventParams = {
            idnetsuite_admin,
            id_calendar,
            nombreEvento,
            tipoEvento,
            descripcionEvento,
            formatdateIni: fechaHoraInicio,
            formatdateFin: fechaHoraFin,
            horaInicio,
            horaFinal,
            leadId: leadId || 0, // Si leadId es vacío, se asigna 0
            colorEvento,
            citaValue,
        };

        try {
            // Envío de solicitud al backend para crear el evento
            await editCalendarEvent(eventParams);

            if (eventParams.leadId > 0) {
                await dispatch(generateLeadBitacora(idnetsuite_admin, leadId, additionalValues, descripcionEvento, valueStatus));
            }

            // Retorno de la respuesta de la API si es necesario
            return "ok";
        } catch (error) {
            // Manejo de errores en caso de fallo
            console.error("Error al crear el evento para el lead:", error);
        }
    };
};