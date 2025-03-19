import { generateLeadBitacora } from "../leads/thunksLeads";
import { createCalendarEvent, editCalendarEvent, get_CalendarFetch, get_dataEvents, get_event_Citas, getAll_ListEvent, obtener_EventosCliente, update_event_MoveDate, update_Status_Event } from "./Api_calendar_Providers";

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
 * Valida si el cliente tiene citas registradas o no.
 * 
 * @param {number} id - El ID del cliente para verificar sus citas.
 * @returns {Promise<object>} - Retorna un objeto con los datos de la primera cita encontrada, o un error en caso de fallo.
 */
export const getSpecificLeadCitas = (id) => {

    return async () => {
        try {
            // Llama a la API para obtener los eventos/citas asociadas al cliente, filtrados por su ID.
            // Se asume que la función `get_event_Citas` realiza una solicitud al backend con el ID del cliente.
            const result = await get_event_Citas({ id });

            // Retorna el primer conjunto de datos de la respuesta de la API.
            // En este caso, se accede directamente al primer índice de los datos devueltos (posición "0").
            return result.data["0"];
        } catch (error) {
            // Si ocurre un error durante la llamada a la API, se captura y se muestra en la consola para facilitar el diagnóstico.
            console.error("Error al extraer los datos del evento:", error);
        }
    };
};




/**
 * Función para editar un evento asociado a un lead.
 * 
 * @param {number} id_calendar - ID del calendario para el evento.
 * @param {string} nombreEvento - Nombre del evento.
 * @param {string} tipoEvento - Tipo de evento (Llamada, Whatsapp, Correo, etc.).
 * @param {string} descripcionEvento - Descripción detallada del evento.
 * @param {string} fechaInicio - Fecha de inicio del evento (en formato YYYY-MM-DD).
 * @param {string} fechaFinal - Fecha de finalización del evento (en formato YYYY-MM-DD).
 * @param {string} horaInicio - Hora de inicio del evento (en formato HH:MM).
 * @param {string} horaFinal - Hora de finalización del evento (en formato HH:MM).
 * @param {number} leadId - ID del lead asociado (opcional, por defecto 0).
 * @param {any} valueStatus - Estado adicional a enviar en la bitácora.
 * 
 * @returns {Promise<string>} - Retorna "ok" si el evento fue editado correctamente.
 */
export const editeEventForLead = (
    id_calendar, nombreEvento, tipoEvento, descripcionEvento, 
    fechaInicio, fechaFinal, horaInicio, horaFinal, 
    leadId = 0, valueStatus
) => {
    return async (dispatch, getState) => {
        // Obtiene el ID del administrador Netsuite desde el estado de autenticación
        const { idnetsuite_admin } = getState().auth; 

        // Mapa de colores asignados según el tipo de evento.
        // Estos colores se usan para diferenciar visualmente los tipos de eventos en la interfaz.
        const eventColors = {
            Llamada: "#556ee6",     // Azul para Llamada, Whatsapp, Correo
            Whatsapp: "#556ee6",
            Correo: "#556ee6",
            Tarea: "#343a40",       // Gris oscuro para Tareas
            Reunion: "#34c38f",     // Verde para Reuniones
            Seguimientos: "#f46a6a",// Rojo para Seguimientos
            Cita: "#f1b44c"         // Amarillo para Citas
        };

        // Construcción de los valores de fecha y hora completos para el inicio y final del evento.
        const fechaHoraInicio = `${fechaInicio}T${horaInicio}`; // Formato ISO para inicio
        const fechaHoraFin = `${fechaFinal}T${horaFinal}`;      // Formato ISO para fin

        // Determina el color del evento basado en su tipo, usa un color por defecto si el tipo no está definido.
        const colorEvento = eventColors[tipoEvento] || "#000000"; // Negro por defecto
        // Si el tipo de evento es "Cita", asigna 1, de lo contrario asigna 0.
        const citaValue = tipoEvento === "Cita" ? 1 : 0;

        // Valores adicionales para asociar el evento con una bitácora o actualizar el lead.
        const additionalValues = {
            valorDeCaida: 51,                  // Valor genérico asignado para la caída de un evento
            tipo: "Se Edito un evento para el cliente", // Descripción del tipo de acción que se realizó
            estado_lead: 1,                    // Estado del lead (1 significa activo)
            accion_lead: 6,                    // Código de acción para el lead
            seguimiento_calendar: 0,           // Valor de seguimiento (0 por defecto)
            valor_segimineto_lead: 3,           // Valor relacionado al seguimiento del lead
        };

        // Parámetros que se envían al backend para editar el evento en el calendario.
        const eventParams = {
            idnetsuite_admin,          // ID del administrador
            id_calendar,               // ID del calendario del evento
            nombreEvento,              // Nombre del evento
            tipoEvento,                // Tipo de evento
            descripcionEvento,         // Descripción del evento
            formatdateIni: fechaHoraInicio, // Fecha y hora de inicio en formato ISO
            formatdateFin: fechaHoraFin,    // Fecha y hora de finalización en formato ISO
            horaInicio,                // Hora de inicio (para visualización)
            horaFinal,                 // Hora de finalización (para visualización)
            leadId: leadId || 0,       // ID del lead asociado (si no hay, usa 0)
            colorEvento,               // Color asignado al evento
            citaValue,                 // Valor si es una cita o no (1 o 0)
        };

        try {
            // Llama al servicio para editar el evento en el calendario.
            await editCalendarEvent(eventParams);

            // Si el evento está asociado a un lead (leadId > 0), genera una entrada en la bitácora del lead.
            if (eventParams.leadId > 0) {
                await dispatch(generateLeadBitacora(
                    idnetsuite_admin, 
                    leadId, 
                    additionalValues, 
                    descripcionEvento, 
                    valueStatus
                ));
            }

            // Retorna "ok" si todo el proceso se completó exitosamente.
            return "ok";
        } catch (error) {
            // En caso de error, se captura y se registra en la consola para el análisis.
            console.error("Error al crear el evento para el lead:", error);
        }
    };
};



/**
 * Función para mover la fecha de un evento a una nueva fecha de inicio y fin.
 *
 * @param {number} id - ID del evento a modificar.
 * @param {string} newDateStart - Nueva fecha de inicio para el evento en formato de fecha (ej. 'YYYY-MM-DD').
 * @param {string} newDateEnd - Nueva fecha de finalización para el evento en formato de fecha (ej. 'YYYY-MM-DD').
 * @returns {function} - Retorna una función asíncrona que realiza la actualización de la fecha.
 */
export const moveEvenOtherDate = (id, newDateStart, newDateEnd) => {
    return async () => {
        try {
            // Llama a la API para actualizar la fecha de un evento específico, basado en el ID del evento y la nueva fecha proporcionada.
            const result = await update_event_MoveDate({ id, newDateStart, newDateEnd });
            // Retorna el primer conjunto de datos de la respuesta de la API, que contiene los datos actualizados del evento.
            return result.data["0"];
        } catch (error) {
            // Si ocurre un error durante la llamada a la API, se captura y se muestra en la consola para facilitar la depuración.
            console.error("Error al mover la fecha del evento:", error);
        }
    };
};



export const updateStatusEvent = (id, NewStatus, idinterno_lead, valueStatus, estadoNew, type) => {
    return async (dispatch, getState) => {
        // Obtiene el ID del administrador Netsuite desde el estado de autenticación
        const { idnetsuite_admin } = getState().auth;
        try {

            

            console.log("estado NewStatus",  NewStatus)
            console.log("estadoNew", estadoNew)
            console.log("type", type)

            const EstadoAccion = type === 1 ? "Pendiente" :  type === 2 ? "completado" : "Cancelado";

            
            // Llama a la API para actualizar la fecha de un evento específico, basado en el ID del evento y la nueva fecha proporcionada.
            const result = await update_Status_Event({ id, NewStatus: estadoNew, EstadoAccion  });
            console.log(result)
            // Retorna el primer conjunto de datos de la respuesta de la API, que contiene los datos actualizados del evento.

            const estadoEvento = NewStatus === 1 ? "Completado" :  NewStatus === 3 ? "Reactivado" : "Cancelado";


            if (idinterno_lead > 0) {
                const descripcionEvento = "Modificaion de evento : " + estadoEvento;
                const additionalValues = {
                    valorDeCaida: 51, // Valor genérico asignado para la caída de un evento
                    tipo: "Se Edito un evento para el cliente", // Descripción del tipo de acción que se realizó
                    estado_lead: 1, // Estado del lead (1 significa activo)
                    accion_lead: 6, // Código de acción para el lead
                    seguimiento_calendar: 0, // Valor de seguimiento (0 por defecto)
                    valor_segimineto_lead: 3, // Valor relacionado al seguimiento del lead
                };

                await dispatch(generateLeadBitacora(idnetsuite_admin, idinterno_lead, additionalValues, descripcionEvento, valueStatus));
            }
            return result.data["0"];
        } catch (error) {
            // Si ocurre un error durante la llamada a la API, se captura y se muestra en la consola para facilitar la depuración.
            console.error("Error al mover la fecha del evento:", error);
        }
    };
};
 


export const getAllListEvent = (dateStart, dateEnd) => {


    return async (dispatch, getState) => {
        // Extrae idnetsuite_admin y rol_admin del estado de autenticación en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llama a la API para obtener los calendarios nuevos, basados en el rol y el ID del administrador.
            const result = await getAll_ListEvent({ idnetsuite_admin, rol_admin, dateStart, dateEnd });


            // Retorna el primer conjunto de datos de la respuesta para su uso posterior.
            return result.data["0"];
        } catch (error) {
            // En caso de error, registra el mensaje en la consola.
            console.error("Error al cargar los nuevos calendarios:", error);
        }
    };
};



export const obtenerEventosCliente = (leadDetails) => {
    return async () => {
        try {
            // Llama a la función `obtener_EventosCliente` para realizar la solicitud a la API.
            // La función recibe el ID del cliente (`idCliente`) y retorna los eventos
            // asociados a dicho cliente según las configuraciones de la API.
            const result = await obtener_EventosCliente({ leadDetails });

            // Devuelve el primer conjunto de datos de la respuesta (`result.data["0"]`)
            // para su uso en la aplicación. Esto asume que el resultado de la API
            // es un array u objeto en el que el primer elemento contiene la información necesaria.
            return result.data.data;
        } catch (error) {
            // En caso de que ocurra un error durante la solicitud, se captura y se imprime el mensaje de error
            // en la consola para facilitar la identificación de problemas.
            console.error("Error al cargar los nuevos calendarios:", error);
        }
    };
};
