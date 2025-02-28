// Importa las funciones necesarias para realizar solicitudes a la API desde la ruta especificada.
import { commonRequestData, fetchData } from "../../api";

/**
 * Función asincrónica para crear una estimación utilizando datos proporcionados en un formulario.
 * @param {object} formulario - Los datos del formulario utilizados para la creación de la estimación.
 * @returns {Promise} - Retorna la respuesta de la API tras intentar crear la estimación.
 */
export const crearEstimacion = async ({ formulario }) => {
    // Construye el objeto de datos para la solicitud, combinando datos comunes y los específicos del formulario.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (p. ej., tokens de autenticación, configuraciones generales).
        formulario, // Datos específicos del formulario necesarios para la creación de la estimación.
    };

    // Realiza una solicitud a la API para crear la estimación con los datos proporcionados.
    // La URL "estimacion/CrearEstimacion" corresponde al endpoint en el servidor que gestiona esta operación.
    return await fetchData("estimacion/CrearEstimacion", requestData); // Retorna la respuesta de la API para la solicitud realizada.
};



/**
 * Función asincrónica para editar una estimación utilizando datos proporcionados en un formulario.
 * @param {object} formulario - Los datos del formulario utilizados para la edición de la estimación.
 * @returns {Promise} - Retorna la respuesta de la API tras intentar editar la estimación.
 */
export const editarEstimacion = async ({ formulario }) => {
    // Construye el objeto de datos para la solicitud, combinando datos comunes y los específicos del formulario.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (p. ej., tokens de autenticación, configuraciones generales).
        formulario, // Datos específicos del formulario necesarios para la creación de la estimación.
    };

    // Realiza una solicitud a la API para crear la estimación con los datos proporcionados.
    // La URL "estimacion/CrearEstimacion" corresponde al endpoint en el servidor que gestiona esta operación.
    return await fetchData("estimacion/editarEstimacion", requestData); // Retorna la respuesta de la API para la solicitud realizada.
};




/**
 * Función asincrónica para obtener las estimaciones asociadas a una oportunidad específica.
 * @param {object} dataParams - Parámetros necesarios para la obtención de las estimaciones.
 * @param {number} dataParams.idOportunidad - ID de la oportunidad para obtener sus estimaciones.
 * @returns {Promise} - Retorna la respuesta de la API tras intentar obtener las estimaciones.
 */
            
export const obtenerEstimacionesOportunidad = async ({ idOportunidad }) => {
    // Construye el objeto de datos para la solicitud, incluyendo información común y el ID de la oportunidad específica.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (p. ej., autenticación, configuraciones generales).
        idOportunidad, // Identificador único de la oportunidad para obtener sus estimaciones.
    };

    // Realiza la solicitud a la API para obtener las estimaciones asociadas a la oportunidad especificada.
    // La URL "estimacion/ObtenerEstimaciones" corresponde al endpoint que gestiona esta operación en el servidor.
    return await fetchData("estimacion/ObtenerEstimacionesOportunidad", requestData); // Retorna la respuesta de la API.
};


/**
 * Función asincrónica para extraer una estimación de NetSuite.
 * @param {object} dataParams - Parámetros necesarios para la extracción de la estimación.
 * @param {number} dataParams.idEstimacion - ID de la estimación a extraer.
 * @returns {Promise} - Retorna la respuesta de la API tras intentar extraer la estimación.
 */

export const extraerEstimacionNetsuite = async ({ idEstimacion }) => {
    // Construye el objeto de datos para la solicitud, incluyendo información común y el ID de la estimación específica.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (p. ej., autenticación, configuraciones generales).
        idEstimacion, // Identificador único de la estimación para obtener sus datos asociados.
    };

    return await fetchData("estimacion/extraerEstimacion", requestData); // Retorna la respuesta de la API.
   
};


/**
 * Función asincrónica para enviar una estimación como Pre-reserva a NetSuite.
 * @param {object} dataParams - Parámetros necesarios para la envío de la estimación como Pre-reserva.
 * @param {number} dataParams.idEstimacion - ID de la estimación a enviar como Pre-reserva.
 * @param {number} dataParams.idCliente - ID del cliente asociado a la estimación.
 * @returns {Promise} - Retorna la respuesta de la API tras intentar enviar la estimación como Pre-reserva.
 */

export const enviarEstimacionComoPreReservaNetsuite = async ({ idEstimacion, idCliente }) => {
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (p. ej., autenticación, configuraciones generales).
        idEstimacion, // Identificador único de la estimación para obtener sus datos asociados.
        idCliente, // Identificador único del cliente para enviar la estimación como Pre-reserva.
    };

    return await fetchData("estimacion/enviarEstimacionComoPreReserva", requestData); // Retorna la respuesta de la API.
};


/**
 * Función asincrónica para actualizar la estimación como Pre-reserva.
 * @param {object} dataParams - Parámetros necesarios para la actualización.
 * @param {number} dataParams.idEstimacion - ID de la estimación a modificar.
 * @param {string} dataParams.fecha_prereserva - Nueva fecha para la estimación.
 * @returns {Promise} - Retorna la respuesta de la API tras intentar actualizar la estimación como Pre-reserva.
 */

export const actualizarEstimacionPreReserva = async ({ idEstimacion, fecha_prereserva }) => {
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (p. ej., autenticación, configuraciones generales).
        idEstimacion, // Identificador único de la estimación para obtener sus datos asociados.
        fecha_prereserva, // Identificador único de la estimación para obtener sus datos asociados.
    };

    return await fetchData("estimacion/actualizarEstimacionPreReserva", requestData); // Retorna la respuesta de la API.
};


/**
 * Función asincrónica para actualizar la estimación como Pre-reserva.
 * @param {object} dataParams - Parámetros necesarios para la actualización.
 * @param {number} dataParams.idEstimacion - ID de la estimación a modificar.
 * @param {string} dataParams.fecha_prereserva - Nueva fecha para la estimación.
 * @returns {Promise} - Retorna la respuesta de la API tras intentar actualizar la estimación como Pre-reserva.
 */
export const updatecaidaReserva = async ({ id, motivo, comentario }) => {
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (p. ej., autenticación, configuraciones generales).
        id, // Identificador único de la estimación para obtener sus datos asociados.
        motivo, // Identificador único de la estimación para obtener sus datos asociados.
        comentario, // Identificador único de la estimación para obtener sus datos asociados.
    };

    return await fetchData("estimacion/caidaReserva", requestData); // Retorna la respuesta de la API.
};  


/**
 * Función asincrónica para modificar la estimación de un cliente.
 * @param {object} dataParams - Parámetros necesarios para la modificación.
 * @param {number} dataParams.idEstimacion - ID de la estimación a modificar.
 * @param {number} dataParams.IdCliente - ID del cliente asociado.
 * @param {number} dataParams.status - Nuevo estado para la estimación. 
 * @returns {Promise} - Retorna la respuesta de la API tras intentar modificar la estimación.
 */
export const ModificarEstimacionCliente = async ({ idEstimacion, IdCliente, status }) => {
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para todas las solicitudes (p. ej., autenticación, configuraciones generales).
        idEstimacion, // Identificador único de la estimación para obtener sus datos asociados.
        IdCliente, // Identificador único de la estimación para obtener sus datos asociados.
        status, // Identificador único de la estimación para obtener sus datos asociados.
    };

    return await fetchData("estimacion/ModificarEstimacionCliente", requestData); // Retorna la respuesta de la API.
};


