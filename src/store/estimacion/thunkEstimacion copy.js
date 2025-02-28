import { generateLeadBitacora } from "../leads/thunksLeads";
import { crearEstimacion, editarEstimacion, extraerEstimacionNetsuite, obtenerEstimacionesOportunidad, enviarEstimacionComoPreReservaNetsuite, actualizarEstimacionPreReserva } from "./Api_provider_estimacion";

/**
 * Función para manejar la creación de una estimación a partir de los datos proporcionados en un formulario.
 * @param {object} formulario - Los datos del formulario utilizados para la creación de la estimación.
 * @returns {Function} - Una función asincrónica que realiza la solicitud y maneja los resultados.
 */
export const crearEstimacionFormulario = (formulario) => {

    return async () => {
        try {
            // Llama a la API para crear la estimación utilizando los datos del formulario.
            const result = await crearEstimacion({ formulario });

            // Retorna el primer elemento de los datos obtenidos, asumiendo que contiene la información principal requerida.
            return result;
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para facilitar la depuración.
            console.error("Error al crear la estimación:", error);
        }
    };
};


/**
 * Función para manejar la edición de una estimación a partir de los datos proporcionados en un formulario.
 * @param {object} formulario - Los datos del formulario utilizados para la edición de la estimación.
 * @returns {Function} - Una función asincrónica que realiza la solicitud y maneja los resultados.
*/
export const editarEstimacionFormulario = (formulario) => {

   return async () => {
       try {
           // Llama a la API para editar la estimación utilizando los datos del formulario.
           const result = await editarEstimacion({ formulario });

           // Retorna el primer elemento de los datos obtenidos, asumiendo que contiene la información principal requerida.
           return result;
       } catch (error) {
           // Captura y registra cualquier error que ocurra durante la solicitud para facilitar la depuración.
           console.error("Error al editar la estimación:", error);
       }
   };
};

// Función para obtener la lista de estimaciones relacionadas con una oportunidad específica, identificada por su ID de transacción.
export const obtenerEstimacionesPorOportunidad = (idOportunidad) => {
    return async () => {
        try {
            // Realiza la llamada a la API para obtener las estimaciones relacionadas con la oportunidad especificada.
            const respuesta = await obtenerEstimacionesOportunidad({ idOportunidad });


            // Retorna el primer elemento de los datos obtenidos, que contiene la información principal de la estimación.
            return respuesta.data.data;
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para facilitar su depuración.
            console.error("Error al obtener las estimaciones de la oportunidad:", error);
        }
    };
};


export const extarerEstimacion = (idEstimacion) => {
    console.log(idEstimacion);
    return async () => {
        try {
            // Realiza la llamada a la API para obtener las estimaciones relacionadas con la estimación especificada.
            const respuesta = await extraerEstimacionNetsuite({ idEstimacion });


            // Retorna el primer elemento de los datos obtenidos, que contiene la información principal de la estimación.
            return respuesta?.data || null; // Devuelve null si los datos están indefinidos.
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para facilitar su depuración.
            console.error("Error al obtener los datos de la estimación:", error);
            throw error; // Re-lanza el error para permitir que sea manejado por el contexto externo.
        }
    };
};


// hacer un thunk para enviar la estimacion como pre-reserva
export const enviarEstimacionComoPreReserva = (idEstimacion, idCliente, fecha_prereserva) => {

    return async (dispatch) => {
        try {
            // Realiza la llamada a la API para obtener las estimaciones relacionadas con la estimación especificada.
            const respuesta = await enviarEstimacionComoPreReservaNetsuite({ idEstimacion });


            // Despacha la acción para generar la bitácora de la estimación
            await dispatch(crearBitacoraEstimacion(idCliente));
            await dispatch(actulizarEstimacionPreReserva(idEstimacion, fecha_prereserva));



            // Retorna el primer elemento de los datos obtenidos, que contiene la información principal de la estimación.
            return respuesta?.data || null; // Devuelve null si los datos están indefinidos.
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para facilitar su depuración.
            console.log(error);
            throw error; // Re-lanza el error para permitir que sea manejado por el contexto externo.
        }
    };
};


export const crearBitacoraEstimacion = (leadId) => {
    return async (dispatch, getState) => {
        // Extrae el ID del administrador desde el estado de autenticación
        const { idnetsuite_admin } = getState().auth;

        // Define la descripción del evento, en este caso es la nota proporcionada
        const descripcionEvento = "Se envio la estimacion como pre-reserva";

        const valueStatus = "03-LEAD-PRE-RESERVA"

        // Valores adicionales que serán enviados al generar la bitácora del lead
        const additionalValues = {
            valorDeCaida: 51, // Valor estándar para caídas (causa de la nota)
            tipo: "Se Envio la Estimacion como Pre-Reserva", // Tipo de evento
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


// Función para obtener la lista de estimaciones relacionadas con una oportunidad específica, identificada por su ID de transacción.
export const actulizarEstimacionPreReserva = (idEstimacion, fecha_prereserva) => {
    return async () => {
        try {
            // Realiza la llamada a la API para obtener las estimaciones relacionadas con la oportunidad especificada.
            const respuesta = await actualizarEstimacionPreReserva({ idEstimacion, fecha_prereserva });

            // Retorna el primer elemento de los datos obtenidos, que contiene la información principal de la estimación.
            return respuesta;
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para facilitar su depuración.
            console.error("Error al actualizar la estimacion como pre-reserva:", error);
        }
    };
};
