import { setLeadsNew } from "./leadSlice"; // Acción para actualizar el estado de leads en Redux.
import { createdNewLead_Netsuite, get_optionLoss, get_Specific_Lead, getAll_LeadsRepit, getAllLeadsAttention, getAllLeadsComplete, getAllLeadsNew, getAllLeadsTotal, getAllStragglers, getBitacora, getDataInformations_Lead, getDataLead_Netsuite, getDataSelect_Admins, getDataSelect_Campaing, getDataSelect_Corredor, getDataSelect_Proyect, getDataSelect_Subsidiaria, insertBitcoraLead, setLostStatusForLeadTransactions, update_LeadStatus, updateLeadActionApi } from "./Api_leads_Providers"; // Función que hace la solicitud API para obtener nuevos leads.
import { createCalendarEvent } from "../calendar/Api_calendar_Providers";

/**
 * Acción asincrónica para obtener la lista de nuevos leads.
 *
 * Realiza una solicitud al backend para obtener los leads nuevos basados en el id y rol del administrador
 * y luego despacha una acción para actualizar el estado de Redux con los datos obtenidos.
 *
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getLeadsNew = () => {
    return async (dispatch, getState) => {
        // Extrae el idnetsuite_admin y rol_admin desde el estado de autenticación en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llamada a la API para obtener los nuevos leads basados en el rol y el id del administrador.
            const result = await getAllLeadsNew({ idnetsuite_admin, rol_admin });

            // Si la API devuelve datos correctamente, despacha la acción para actualizar el estado de Redux.
            dispatch(setLeadsNew(result.data["0"])); // Actualiza el estado con la lista de leads nuevos.

            return result.data["0"]; // Devuelve los datos obtenidos para su posible uso.
        } catch (error) {
            // En caso de error, muestra el mensaje de error en la consola.
            console.error("Error al cargar los nuevos leads:", error);
        }
    };
};

/**
 * Acción asincrónica para obtener la lista de leads que requieren atención.
 *
 * Realiza una solicitud al backend para obtener los leads que requieren atención,
 * basados en el ID y rol del administrador, y luego despacha una acción para
 * actualizar el estado de Redux con los datos obtenidos.
 *
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getLeadsAttention = (startDate, endDate, filterOption) => {
    return async (dispatch, getState) => {
        // Extrae el idnetsuite_admin y rol_admin del estado de autenticación almacenado en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llama a la función getAllLeadsAttention para obtener los leads que requieren atención
            // basados en el rol y el ID del administrador.
            const result = await getAllLeadsAttention({ idnetsuite_admin, rol_admin, startDate, endDate, filterOption });
            // Si la API responde con éxito, despacha una acción para actualizar el estado de Redux.
            dispatch(setLeadsNew(result.data["0"])); // Actualiza el estado con la lista de leads obtenida.

            return result.data["0"]; // Devuelve los datos obtenidos para posibles usos adicionales.
        } catch (error) {
            // En caso de error, muestra el error en la consola para diagnóstico.
            console.error("Error al cargar los leads que requieren atención:", error);
        }
    };
};

/**
 * Acción asincrónica para obtener la lista de leads que requieren atención. y resagados
 *
 * Realiza una solicitud al backend para obtener los leads que requieren atención,
 * basados en el ID y rol del administrador, y luego despacha una acción para
 * actualizar el estado de Redux con los datos obtenidos.
 *
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getLeadStragglers = (startDate, endDate, filterOption) => {
    return async (dispatch, getState) => {
        // Extrae el idnetsuite_admin y rol_admin del estado de autenticación almacenado en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llama a la función getAllLeadsAttention para obtener los leads que requieren atención
            // basados en el rol y el ID del administrador.
            const result = await getAllStragglers({ idnetsuite_admin, rol_admin, startDate, endDate, filterOption });
            // Si la API responde con éxito, despacha una acción para actualizar el estado de Redux
            return result.data["0"]; // Devuelve los datos obtenidos para posibles usos adicionales.
        } catch (error) {
            // En caso de error, muestra el error en la consola para diagnóstico.
            console.error("Error al cargar los leads que requieren atención:", error);
        }
    };
};

/**
 * Acción asincrónica para obtener la bitácora de un lead específico.
 *
 * Realiza una solicitud al backend para obtener la bitácora de un lead
 * basado en el id del lead proporcionado, y luego devuelve los datos obtenidos.
 *
 * @param {number} idLeads - ID del lead cuya bitácora se va a obtener.
 * @returns {Promise<Object>} - Promesa que resuelve con los datos de la bitácora.
 */
export const getBitacoraLeads = (idLeads) => {
    return async () => {
        try {
            // Llamada a la API para obtener la bitácora del lead basado en su ID.
            const result = await getBitacora({ idLeads });

            return result.data["0"]; // Devuelve los datos de la bitácora obtenidos.
        } catch (error) {
            // Manejo de errores: muestra el mensaje de error en la consola.
            console.error("Error al cargar la bitácora del lead:", error);
        }
    };
};

/**
 * Acción asincrónica para obtener la lista completa de los leads, sin importar su estado.
 *
 * Realiza una solicitud al backend para obtener la lista completa de los leads
 * basados en el ID y rol del administrador, y luego despacha una acción para
 * actualizar el estado de Redux con los datos obtenidos.
 *
 * @param {string} startDate - Fecha de inicio para el filtro de leads.
 * @param {string} endDate - Fecha de fin para el filtro de leads.
 * @param {string} filterOption - Opción de filtrado para determinar el tipo de leads a obtener.
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getLeadsComplete = (startDate, endDate, filterOption) => {
    return async (dispatch, getState) => {
        // Extrae idnetsuite_admin y rol_admin del estado de autenticación almacenado en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llama a la función getAllLeadsComplete para obtener la lista completa de leads
            // basados en el rol y el ID del administrador, así como en el rango de fechas y la opción de filtro.
            const result = await getAllLeadsComplete({ idnetsuite_admin, rol_admin, startDate, endDate, filterOption });



            // Si la API responde con éxito, despacha una acción para actualizar el estado de Redux.
            // dispatch(setLeadsNew(result.data["0"])); // Actualiza el estado con la lista de leads obtenida.

            return result.data["0"]; // Devuelve los datos obtenidos para posibles usos adicionales.
        } catch (error) {
            // En caso de error, muestra el error en la consola para diagnóstico.
            console.error("Error al cargar la lista completa de leads", error);
        }
    };
};

/**
 * Acción asincrónica para obtener la lista completa de los leads repetidos.
 *
 * Realiza una solicitud al backend para obtener la lista completa de los leads
 * repetidos basados en el ID y rol del administrador, y luego despacha una acción
 * para actualizar el estado de Redux con los datos obtenidos.
 *
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getLeadsRepit = () => {
    return async (dispatch, getState) => {
        // Extrae idnetsuite_admin y rol_admin del estado de autenticación almacenado en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llama a la función getAllLeadsRepit para obtener la lista completa de leads repetidos
            // basados en el rol y el ID del administrador.
            const result = await getAll_LeadsRepit({ idnetsuite_admin, rol_admin });

            // Si la API responde con éxito, despacha una acción para actualizar el estado de Redux.
            // dispatch(setLeadsNew(result.data["0"])); // Actualiza el estado con la lista de leads repetidos obtenida.

            return result.data["0"]; // Devuelve los datos obtenidos para posibles usos adicionales.
        } catch (error) {
            // En caso de error, muestra el error en la consola para diagnóstico.
            console.error("Error al cargar la lista completa de leads repetidos", error);
        }
    };
};

/**
 * Acción asincrónica para obtener la información de un lead específico.
 *
 * Realiza una solicitud al backend para obtener los detalles de un lead
 * basados en su ID, y luego despacha una acción para actualizar el estado
 * de Redux con los datos obtenidos.
 *
 * @param {number} idLead - ID del lead específico que se desea obtener.
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getSpecificLead = (idLead) => {
    return async () => {
        try {
            // Llama a la función get_Specific_Lead para obtener la información del lead específico.
            const result = await get_Specific_Lead({ idLead });
            return result.data["0"]["0"]; // Devuelve los datos obtenidos para posibles usos adicionales.
        } catch (error) {
            // En caso de error, muestra el error en la consola para diagnóstico.
            console.error("Error al cargar el lead", error);
        }
    };
};

/**
 * Acción asincrónica para generar una bitácora para un lead específico.
 *
 * Esta función realiza una solicitud al backend para registrar una bitácora
 * de las acciones realizadas sobre un lead basado en su ID, junto con información adicional
 * como el estado actual del lead, su descripción y otros valores relevantes.
 * El estado del lead se valida y ajusta en base a un conjunto de estados permitidos.
 *
 * @param {number} idnetsuite_admin - ID del administrador de NetSuite que está realizando la acción.
 * @param {number} leadId - ID del lead para el cual se desea generar la bitácora.
 * @param {Object} additionalValues - Valores adicionales que acompañan la bitácora.
 * @param {string} additionalValues.valorDeCaida - Valor que indica la caída del lead.
 * @param {string} additionalValues.tipo - Tipo de evento o acción que se está registrando.
 * @param {string} descripcionEvento - Descripción del evento o acción realizada.
 * @param {string} valueStatus - Estado actual del lead que se está evaluando.
 * @returns {Promise<void>} - Esta función no devuelve un resultado directamente, pero genera una bitácora en el backend.
 */
export const generateLeadBitacora = (idnetsuite_admin, leadId, additionalValues, descripcionEvento, valueStatus) => {
    return async (dispatch) => {
        try {
            let estadoActual;

            // Si el valueStatus es 0, se asigna directamente "07-LEAD-PERDIDO"
            if (valueStatus === 0) {
                estadoActual = "07-LEAD-PERDIDO";
            } else {
                // Lista de estados permitidos para validar el estado actual del lead.
                const estadosPermitidos = ["LEAD-OPORTUNIDAD", "LEAD-PRE-RESERVA", "LEAD-RESERVA", "LEAD-CONTRATO", "LEAD-ENTREGADO"];

                // Validamos que valueStatus no sea 0 y que su valor (después de un substring) esté en la lista de estados permitidos
                // Asumimos que el valueStatus tiene una longitud suficiente para el substring.
                const estadoExtraido = valueStatus.length >= 53 ? valueStatus.substring(3, 53).trim() : "";

                // Si el estado extraído está en la lista de permitidos, se utiliza; de lo contrario, se asigna "08-LEAD-SEGUIMIENTO".
                estadoActual = estadosPermitidos.includes(estadoExtraido) ? valueStatus : "08-LEAD-SEGUIMIENTO";
            }

            // Inserción de la bitácora en el sistema.
            // Se pasa el ID del lead, el ID del administrador de NetSuite, el valor de caída,
            // la descripción del evento, el tipo de evento y el estado actual validado.
            await insertBitcoraLead(leadId, idnetsuite_admin, additionalValues.valorDeCaida, descripcionEvento, additionalValues.tipo, estadoActual);

            await dispatch(updateLeadAction(leadId, additionalValues, valueStatus));
        } catch (error) {
            // Manejo de errores: captura cualquier fallo al generar la bitácora.
            console.error("Error al generar la bitácora para el lead", error);
            throw error; // Lanza el error para manejarlo a nivel superior si es necesario.
        }
    };
};

/**
 * Función para actualizar el estado de un lead en el sistema y registrar una bitácora de acciones.
 *
 * Esta función toma el ID de un lead, valores adicionales, y el estado actual para realizar
 * la actualización. Si el estado proporcionado no es válido, se asigna un estado por defecto.
 * Finalmente, se envía la solicitud al backend para registrar los cambios y la bitácora del lead.
 *
 * @param {number} leadId - Identificador único del lead que se está actualizando.
 * @param {Object} additionalValues - Valores adicionales relacionados con el lead, como seguimiento y acciones.
 * @param {string} additionalValues.valor_segimineto_lead - Valor asociado al seguimiento del lead.
 * @param {string} additionalValues.estado_lead - Estado nuevo del lead que se actualizará.
 * @param {string} additionalValues.accion_lead - Acción que se ha realizado sobre el lead, por ejemplo, seguimiento.
 * @param {string} additionalValues.seguimiento_calendar - Información adicional sobre el seguimiento en el calendario.
 * @param {string} additionalValues.valorDeCaida - Motivo o valor relacionado con la caída del lead, si aplica.
 * @param {string} valueStatus - Estado actual del lead que se validará antes de actualizar.
 * @returns {Function} - Devuelve una función asincrónica que actualiza el lead y registra la bitácora.
 */
export const updateLeadAction = (leadId, additionalValues, valueStatus) => {
    return async () => {
        try {
            let estadoActual;

            // Si el valueStatus es 0, se asigna directamente "07-LEAD-PERDIDO"
            if (valueStatus === 0) {
                estadoActual = "07-LEAD-PERDIDO";
            } else {
                // Lista de estados permitidos para validar el estado actual del lead.
                const estadosPermitidos = ["LEAD-OPORTUNIDAD", "LEAD-PRE-RESERVA", "LEAD-RESERVA", "LEAD-CONTRATO", "LEAD-ENTREGADO"];

                // Validamos que valueStatus no sea 0 y que su valor (después de un substring) esté en la lista de estados permitidos
                // Asumimos que el valueStatus tiene una longitud suficiente para el substring.
                const estadoExtraido = valueStatus.length >= 53 ? valueStatus.substring(3, 53).trim() : "";

                // Si el estado extraído está en la lista de permitidos, se utiliza; de lo contrario, se asigna "08-LEAD-SEGUIMIENTO".
                estadoActual = estadosPermitidos.includes(estadoExtraido) ? valueStatus : "08-LEAD-SEGUIMIENTO";
            }

            // Obtener la fecha actual en formato YYYY-MM-DD, para registrar la fecha de actualización.
            const now = new Date();
            const formattedDate = now.toISOString().slice(0, 10); // Extrae los primeros 10 caracteres del formato ISO.

            // Desestructuración de los valores adicionales, que incluyen el seguimiento y la acción realizada sobre el lead.
            const { valor_segimineto_lead, estado_lead, accion_lead, seguimiento_calendar, valorDeCaida } = additionalValues;

            // Llama a la API para actualizar el lead con el estado validado, los valores adicionales,
            // y la fecha actual formateada. La función updateLeadActionApi es responsable de enviar los datos al backend.
            await updateLeadActionApi(estadoActual, valor_segimineto_lead, estado_lead, accion_lead, seguimiento_calendar, valorDeCaida, formattedDate, leadId);
        } catch (error) {
            // Manejo de errores: captura cualquier excepción o fallo ocurrido durante la actualización del lead.
            console.error("Error al generar la bitácora para el lead", error);
            throw error; // Propaga el error para que pueda ser gestionado en niveles superiores.
        }
    };
};

/**
 * Crea una nota asociada a un lead en la bitácora de eventos.
 *
 * @param {string} nota - La descripción o contenido de la nota que se va a registrar.
 * @param {number} leadId - El ID del lead al que se le asignará la nota.
 * @param {number} valueStatus - El estado actual del lead.
 * @returns {Promise<string>} - Devuelve "ok" si el proceso se completa exitosamente, o lanza un error en caso de fallo.
 */
export const createNote = (nota, leadId, valueStatus) => {
    return async (dispatch, getState) => {
        // Extrae el ID del administrador desde el estado de autenticación
        const { idnetsuite_admin } = getState().auth;

        // Define la descripción del evento, en este caso es la nota proporcionada
        const descripcionEvento = nota;

        // Valores adicionales que serán enviados al generar la bitácora del lead
        const additionalValues = {
            valorDeCaida: 50, // Valor estándar para caídas (causa de la nota)
            tipo: "Se generó una nota", // Tipo de evento
            estado_lead: 1, // Estado del lead (1: activo, por ejemplo)
            accion_lead: 6, // Acción específica relacionada con la nota (6: nota creada)
            seguimiento_calendar: 0, // Indica que no requiere seguimiento en calendario
            valor_segimineto_lead: 3, // Valor de seguimiento del lead (3: seguimiento intermedio)
        };

        try {
            // Despacha la acción para generar la bitácora del lead con los valores adicionales
            await dispatch(generateLeadBitacora(idnetsuite_admin, leadId, additionalValues, descripcionEvento, valueStatus));
            // Retorna "ok" si todo salió correctamente
            return "ok";
        } catch (error) {
            // Manejo de errores: captura y muestra en consola cualquier problema al generar el evento
            console.error("Error al crear el evento para el lead:", error);
        }
    };
};

/**
 * Crea un evento de WhatsApp asociado a un lead en la bitácora de eventos.
 *
 * @param {string} nota - La descripción o contenido del evento para el lead.
 * @param {number} leadId - El ID del lead al que se le asignará el evento.
 * @param {number} valueStatus - El estado actual del lead.
 * @returns {Promise<string>} - Devuelve "ok" si el proceso se completa exitosamente, o lanza un error en caso de fallo.
 */
export const WhatsappAndNote = (nota, leadId, valueStatus) => {
    return async (dispatch, getState) => {
        // Extrae el ID del administrador desde el estado de autenticación
        const { idnetsuite_admin } = getState().auth;

        // Define la descripción del evento, en este caso es la nota proporcionada
        const descripcionEvento = nota;

        // Valores adicionales que serán enviados al generar la bitácora del lead
        const additionalValues = {
            valorDeCaida: 51, // Valor estándar para caídas (causa del evento relacionado con el cliente)
            tipo: "Se generó un evento para el cliente", // Tipo de evento
            estado_lead: 1, // Estado del lead (1: activo, por ejemplo)
            accion_lead: 6, // Acción específica relacionada con el evento (6: evento generado)
            seguimiento_calendar: 0, // Indica que no requiere seguimiento en calendario
            valor_segimineto_lead: 3, // Valor de seguimiento del lead (3: seguimiento intermedio)
        };

        try {
            // Despacha la acción para generar la bitácora del lead con los valores adicionales
            await dispatch(generateLeadBitacora(idnetsuite_admin, leadId, additionalValues, descripcionEvento, valueStatus));
            // Retorna "ok" si todo salió correctamente
            return "ok";
        } catch (error) {
            // Manejo de errores: captura y muestra en consola cualquier problema al generar el evento
            console.error("Error al crear el evento para el lead:", error);
        }
    };
};

/**
 * Acción asincrónica para obtener la lista de opciones de pérdida de leads desde el backend.
 *
 * Esta función realiza una solicitud para recuperar los motivos por los que un lead puede ser clasificado
 * como "perdido". Utiliza una acción Thunk de Redux para manejar la lógica asincrónica. Los datos obtenidos
 * se pueden despachar para actualizar el estado global en Redux o utilizarse en otros procesos.
 *
 * @returns {Function} Thunk - Función compatible con Redux Thunk, que puede ser despachada para ejecutar la acción.
 */
export const getoptionLoss = (valueID) => {
    return async () => {
        try {
            // Llama a la función get_optionLoss para obtener las opciones de pérdida desde el backend.
            const result = await get_optionLoss(valueID);

            // Devuelve los datos obtenidos para su posterior procesamiento.
            return result.data["0"];
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para fines de depuración.
            console.error("Error al cargar la lista de opciones de pérdida", error);
        }
    };
};

/**
 * Crea una nota asociada a un lead perdido
*/
export const createNoteLoss = (nota, leadId, selectedLossOption) => {
    return async (dispatch, getState) => {
        // Extrae el ID del administrador desde el estado de autenticación
        const { idnetsuite_admin } = getState().auth;

        // Define la descripción del    07-LEAD-ACTION evento, en este caso es la nota proporcionada
        const descripcionEvento = nota;
        const valueStatus = 0;

        // Valores adicionales que serán enviados al generar la bitácora del lead
        const additionalValues = {
            valorDeCaida: selectedLossOption,
            tipo: "Se Coloco este cliente como perdido",
            estado_lead: 0,
            accion_lead: 6,
            seguimiento_calendar: 0,
            valor_segimineto_lead: 3,
        };

        try {
            // Despacha la acción para generar la bitácora del lead con los valores adicionales
            await dispatch(generateLeadBitacora(idnetsuite_admin, leadId, additionalValues, descripcionEvento, valueStatus));
            await setLostStatusForLeadTransactions(leadId, descripcionEvento);
            // Retorna "ok" si todo salió correctamente
            return "ok";
        } catch (error) {
            // Manejo de errores: captura y muestra en consola cualquier problema al generar el evento
            console.error("Error al crear el evento para el lead:", error);
        }
    };
};




/**
 * Crea una nota asociada a un lead perdido
*/
export const createNoteFollow_up = (nota, leadId, selectedLossOption, followUpDate, leadStatus) => {
    return async (dispatch, getState) => {
        // Variables comunes
        const { idnetsuite_admin } = getState().auth; // ID del administrador de Netsuite
        const nombreEvento = "Seguimiento programado"; // Nombre del evento
        const tipoEvento = "Seguimientos"; // Tipo de evento
        const descripcionEvento = nota; // Descripción del evento
        const valueStatus = "08-LEAD-SEGUIMIENTO"; // Estado actual del lead

        // Variables de formato de fecha y hora
        const fechaHoraInicio = `${followUpDate}T08:00:00`;
        const fechaHoraFin = `${followUpDate}T11:00:00`;

        const horaInicio = "08:00:00"; // Hora de inicio
        const horaFinal = "08:00:00"; // Hora de finalización

        // Asignación de variables adicionales
        const colorEvento = "#f46a6a"; // Color basado en el tipo de evento
        const citaValue = 0; // Valor específico si es una cita

        // Valores adicionales para la solicitud
        const additionalValues = {
            valorDeCaida: selectedLossOption,
            tipo: "Se generó un seguimiento programado para el dia " + followUpDate,
            estado_lead: leadStatus,
            accion_lead: 6,
            seguimiento_calendar: 0,
            valor_segimineto_lead: 3,
        };

        // Construcción del objeto con los parámetros para enviar a la API
        const eventParams = { idnetsuite_admin, nombreEvento, tipoEvento, descripcionEvento, formatdateIni: fechaHoraInicio, formatdateFin: fechaHoraFin, horaInicio, horaFinal, leadId, colorEvento, citaValue };

        try {
            // Envío de solicitud al backend para crear el evento
            await createCalendarEvent(eventParams);
            await dispatch(generateLeadBitacora(idnetsuite_admin, leadId, additionalValues, descripcionEvento, valueStatus));

            // Retorno de la respuesta de la API si es necesario
            return "ok";
        } catch (error) {
            // Manejo de errores en caso de fallo
            console.error("Error al crear el evento para el lead:", error);
        }
    };
};


/**
 * Acción asincrónica para obtener la lista completa de los leads, sin importar su estado.
 *
 * Realiza una solicitud al backend para obtener la lista completa de los leads
 * basados en el ID y rol del administrador, y luego despacha una acción para
 * actualizar el estado de Redux con los datos obtenidos.
 *
 * @param {string} startDate - Fecha de inicio para el filtro de leads.
 * @param {string} endDate - Fecha de fin para el filtro de leads.
 * @param {string} filterOption - Opción de filtrado para determinar el tipo de leads a obtener.
 * @returns {Function} Thunk - Función que puede ser despachada gracias a Redux Thunk.
 */
export const getLeadsTotal = (startDate, endDate, filterOption) => {
    return async (dispatch, getState) => {
        // Extrae idnetsuite_admin y rol_admin del estado de autenticación almacenado en Redux.
        const { idnetsuite_admin, rol_admin } = getState().auth;

        try {
            // Llama a la función getAllLeadsComplete para obtener la lista completa de leads
            // basados en el rol y el ID del administrador, así como en el rango de fechas y la opción de filtro.
            const result = await getAllLeadsTotal({ idnetsuite_admin, rol_admin, startDate, endDate, filterOption });

            // Si la API responde con éxito, despacha una acción para actualizar el estado de Redux.
            // dispatch(setLeadsNew(result.data["0"])); // Actualiza el estado con la lista de leads obtenida.

            return result.data["0"]; // Devuelve los datos obtenidos para posibles usos adicionales.
        } catch (error) {
            // En caso de error, muestra el error en la consola para diagnóstico.
            console.error("Error al cargar la lista completa de leads", error);
        }
    };
};



export const getDataLeadNetsuite = (idLead) => {
    return async () => {
        try {
            // Llama a la función get_Specific_Lead para obtener la información del lead específico.
            const result = await getDataLead_Netsuite({ idLead });


            return result; // Devuelve los datos obtenidos para posibles usos adicionales.
        } catch (error) {
            // En caso de error, muestra el error en la consola para diagnóstico.
            console.error("Error al cargar el lead", error);
        }
    };
};

export const getDataSelectCampaing = (p_estado) => {
    return async () => {
        try {
            // Llama a la función getDataSelect_Campaing para obtener la lista de campañas desde la base de datos.
            const result = await getDataSelect_Campaing({p_estado});



            return result.data["0"]; // Devuelve los datos de las campañas obtenidos para su uso posterior.
        } catch (error) {
            // En caso de error, muestra un mensaje en la consola y el detalle del error para facilitar el diagnóstico.
            console.error("Error al cargar las campañas", error);
        }
    };
};

export const getDataSelectProyect = (p_estado) => {
    return async () => {
        try {
            // Llama a la función getDataSelect_Proyect para obtener la lista de proyectos desde la base de datos.
            const result = await getDataSelect_Proyect({ p_estado });

            return result.data["0"]; // Devuelve los datos de las campañas obtenidos para su uso posterior.
        } catch (error) {
            // En caso de error, muestra un mensaje en la consola y el detalle del error para facilitar el diagnóstico.
            console.error("Error al cargar los proyectos", error);
        }
    };
};

export const getDataSelectSubsidiaria = (p_estado) => {
    return async () => {
        try {
            // Llama a la función getDataSelect_Subsidiaria para obtener la lista de subsidiarias desde la base de datos.
            const result = await getDataSelect_Subsidiaria({ p_estado });

            return result.data["0"]; // Devuelve los datos de las campañas obtenidos para su uso posterior.
        } catch (error) {
            // En caso de error, muestra un mensaje en la consola y el detalle del error para facilitar el diagnóstico.
            console.error("Error al cargar las subsidiarias", error);
        }
    };
};

export const getDataSelectAdmins = (p_estado) => {
    return async () => {
        try {
            // Llama a la función getDataSelect_Admins para obtener la lista de administradores desde la base de datos.
            const result = await getDataSelect_Admins({ p_estado });

            return result.data["0"]; // Devuelve los datos de las campañas obtenidos para su uso posterior.
        } catch (error) {
            // En caso de error, muestra un mensaje en la consola y el detalle del error para facilitar el diagnóstico.
            console.error("Error al cargar los administradores", error);
        }
    };
};

export const getDataSelectCorredor = (p_estado) => {
    return async () => {
        try {
            // Llama a la función getDataSelect_Admins para obtener la lista de administradores desde la base de datos.
            const result = await getDataSelect_Corredor({ p_estado });

            return result.data["0"]; // Devuelve los datos de las campañas obtenidos para su uso posterior.
        } catch (error) {
            // En caso de error, muestra un mensaje en la consola y el detalle del error para facilitar el diagnóstico.
            console.error("Error al cargar los getDataSelectCorredor", error);
        }
    };
};


export const createdNewLeadNetsuite = (formData) => {

    return async (dispatch, getState) => {
        // Extrae idnetsuite_admin y rol_admin del estado de autenticación almacenado en Redux.
        const { idnetsuite_admin } = getState().auth;
        try {
            // Llama a la función getDataSelect_Admins para obtener la lista de administradores desde la base de datos.
            const result = await createdNewLead_Netsuite({ formData, idnetsuite_admin });

            return result; // Devuelve los datos de las campañas obtenidos para su uso posterior.
        } catch (error) {
            // En caso de error, muestra un mensaje en la consola y el detalle del error para facilitar el diagnóstico.
            console.error("Error al crear el lead", error);
        }
    };
};

export const getDataInformationsLead = (leadId) => {
    return async () => {
        try {
            // Llama a la función getDataSelect_Admins para obtener la lista de administradores desde la base de datos.
            const result = await getDataInformations_Lead({ leadId });

            return result.data["0"]["0"]; // Devuelve los datos de las campañas obtenidos para su uso posterior.
        } catch (error) {
            // En caso de error, muestra un mensaje en la consola y el detalle del error para facilitar el diagnóstico.
            console.error("Extare toda la infromacion del lead", error);
        }
    };
};

/**
 * Action `updateLeadStatus`:
 * This function updates the status of a lead (client) in the database.
 * It receives the updated status (`estado`) and the client ID (`idCliente`) as parameters.
 * 
 * @param {string} estado - The new status to be set for the lead (e.g., "active", "inactive").
 * @param {number} idCliente - The ID of the client whose status will be updated.
 * @returns {function} - An async function that performs the update operation.
 */
export const updateLeadStatus = (estado, idCliente) => {
    return async () => {
        try {
            // Calls the `update_LeadStatus` function to update the status
            // of a lead in the database. This function receives the new status (`estado`)
            // and the client ID (`idCliente`) as parameters.
            const result = await update_LeadStatus({ estado, idCliente });

            // Returns the updated lead data (`result.data.data`) for further processing
            // in the application. This assumes `result.data.data` contains the updated information.
            return result.data.data;
        } catch (error) {
            // Handles any errors that occur during the update request.
            // Logs the error to the console for debugging purposes.
            console.error("Error updating the lead status:", error);
        }
    };
};

