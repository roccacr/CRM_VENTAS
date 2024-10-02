const mysql = require("mysql2/promise"); // Módulo para manejar conexiones a la base de datos de manera asincrónica.
const config = require("../../config/config"); // Importa la configuración de la base de datos.

const calendars = {}; // Objeto para agrupar todas las funciones relacionadas con 'calendars'.

/**
 * Establece una conexión asincrónica a la base de datos especificada.
 * @async
 * @param {string} database - El nombre de la base de datos a la que se va a conectar.
 * @returns {Promise<mysql.Connection>} - Retorna una conexión a la base de datos.
 * @throws {Error} - Lanza un error si la conexión no se puede establecer.
 */
const createConnection = async (database) => {
    try {
        // Crea una conexión a la base de datos utilizando la configuración definida.
        const connection = await mysql.createConnection(config.database[database]);
        return connection; // Retorna la conexión establecida.
    } catch (error) {
        // Registra el error y lanza una nueva excepción si la conexión falla.
        console.error(`Error al conectar a la base de datos: ${error.message}`);
        throw new Error("No se pudo establecer la conexión a la base de datos");
    }
};

/**
 * Maneja una operación en la base de datos de manera segura, incluyendo la conexión y desconexión.
 * @async
 * @param {Function} operation - Función que define la operación a realizar en la base de datos.
 * @param {string} database - Nombre de la base de datos a utilizar.
 * @returns {Promise<Object>} - El resultado de la operación de base de datos.
 * @throws {Error} - Lanza un error si ocurre un problema durante la operación.
 */
const handleDatabaseOperation = async (operation, database) => {
    let connection;
    try {
        // Establece la conexión a la base de datos y ejecuta la operación.
        connection = await createConnection(database);
        return await operation(connection);
    } catch (error) {
        // Captura cualquier error que ocurra durante la operación de la base de datos.
        console.error(`Error en la operación de base de datos: ${error.message}`);
        return { statusCode: 500, error: "Error interno del servidor" };
    } finally {
        // Asegura que la conexión a la base de datos se cierre si se estableció.
        if (connection) await connection.end();
    }
};

/**
 * Ejecuta un procedimiento almacenado relacionado con eventos del calendario con parámetros proporcionados y retorna el resultado.
 * @async
 * @param {string} procedureName - Nombre del procedimiento almacenado a ejecutar.
 * @param {Array} params - Array de parámetros a pasar al procedimiento almacenado.
 * @param {string} database - Nombre de la base de datos a utilizar.
 * @returns {Promise<Object>} - Resultado de la ejecución del procedimiento almacenado.
 */
const executeStoredProcedure = async (procedureName, params, database) => {
    return handleDatabaseOperation(async (connection) => {
        // Ejecuta el procedimiento almacenado con los parámetros usando placeholders para evitar inyecciones SQL.
        const [rows] = await connection.execute(`CALL ${procedureName}(${params.map(() => "?").join(", ")})`, params);
        return {
            ok: true,
            statusCode: 200,
            ...rows, // Devuelve los resultados del procedimiento almacenado.
        };
    }, database);
};

/**
 * Obtiene todos los eventos del calendario.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de eventos del calendario.
 */
calendars.get_Calendars = (dataParams) =>
    executeStoredProcedure(
        "get_Calendars", // Nombre del procedimiento almacenado que recupera los eventos del calendario.
        [dataParams.rol_admin, dataParams.idnetsuite_admin], // Parámetros que identifican el rol y el ID del administrador.
        dataParams.database, // Nombre de la base de datos a utilizar.
    );



    /**
 * Obtiene todos los eventos del calendario.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de eventos del calendario.
 */
calendars.createEvent = (dataParams) =>
    executeStoredProcedure(
        "create_Event", // Nombre del procedimiento almacenado que recupera los eventos del calendario.
        [
            dataParams.nombreEvento, // Nombre descriptivo del evento
            dataParams.colorEvento, // Color visual que se asigna al evento
            dataParams.leadId, // ID del lead relacionado con el evento
            dataParams.idnetsuite_admin, // ID del administrador que está creando el evento
            dataParams.formatdateIni, // Fecha y hora de inicio en formato ISO
            dataParams.formatdateFin, // Fecha y hora de finalización en formato ISO
            dataParams.horaInicio, // Hora de inicio del evento
            dataParams.horaFinal, // Hora de finalización del evento
            dataParams.descripcionEvento, // Detalle adicional sobre el evento
            dataParams.tipoEvento, // Tipo o categoría del evento (llamada, reunión, etc.)
            dataParams.citaValue, // Color visual que se asigna al evento campo cita_lead
            dataParams.citaValue, // Color visual que se asigna al evento campo citas_chek
            dataParams.citaValue, // Color visual que se asigna al evento campo masDeUnaCita_calendar
        ], // Parámetros que identifican el rol y el ID del administrador.
        dataParams.database, // Nombre de la base de datos a utilizar.
    );


/**
 * Obtiene todos los eventos del calendario desde una base de datos específica.
 * 
 * @function calendars.getDataEevent
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @param {number|string} dataParams.id - El ID del evento que se desea obtener.
 * @param {string} dataParams.database - El nombre de la base de datos en la que se realizará la consulta.
 * @returns {Promise<Object>} - Promesa que se resuelve con el resultado de la consulta de eventos del calendario.
 * 
 * @description
 * Esta función ejecuta un procedimiento almacenado llamado `getDataEevent` para obtener los eventos del calendario,
 * utilizando los parámetros proporcionados, como el ID del evento y el nombre de la base de datos.
 * El resultado de la consulta es retornado como una promesa que puede ser utilizada para manejar los datos en otras
 * partes de la aplicación.
 * 
 * @example
 * const eventData = await calendars.getDataEevent({ id: 123, database: 'production_db' });
 * console.log(eventData);
 */
calendars.getDataEevent = (dataParams) =>
    executeStoredProcedure(
        "getDataEevent", // Nombre del procedimiento almacenado a ejecutar.
        [dataParams.id], // Parámetro que contiene el ID del evento a consultar.
        dataParams.database, // Nombre de la base de datos a utilizar para la consulta.
    );


/**
 * Llama al procedimiento almacenado 'get_event_Citas' para obtener las citas de un lead específico.
 * 
 * @param {object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @param {number} dataParams.id - El ID del evento para el cual se deben obtener las citas.
 * @param {string} dataParams.database - El nombre de la base de datos en la que se ejecutará la consulta.
 * @returns {Promise<object>} - Retorna los resultados de la ejecución del procedimiento almacenado.
 */
calendars.get_event_Citas = (dataParams) =>
    executeStoredProcedure(
        "get_event_Citas", // Nombre del procedimiento almacenado a ejecutar.
        [dataParams.id], // Parámetro que contiene el ID del evento a consultar.
        dataParams.database, // Nombre de la
    );


    /**
 * Editar eventos del calendario.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de eventos del calendario.
 */
calendars.editEvent = (dataParams) =>
    executeStoredProcedure(
        "editEvent", // Nombre del procedimiento almacenado que recupera los eventos del calendario.
        [
            dataParams.id_calendar, // Nombre descriptivo del evento
            dataParams.nombreEvento, // Nombre descriptivo del evento
            dataParams.colorEvento, // Color visual que se asigna al evento
            dataParams.leadId, // ID del lead relacionado con el evento
            dataParams.idnetsuite_admin, // ID del administrador que está creando el evento
            dataParams.formatdateIni, // Fecha y hora de inicio en formato ISO
            dataParams.formatdateFin, // Fecha y hora de finalización en formato ISO
            dataParams.horaInicio, // Hora de inicio del evento
            dataParams.horaFinal, // Hora de finalización del evento
            dataParams.descripcionEvento, // Detalle adicional sobre el evento
            dataParams.tipoEvento, // Tipo o categoría del evento (llamada, reunión, etc.)
            dataParams.citaValue, // Color visual que se asigna al evento campo cita_lead
            dataParams.citaValue, // Color visual que se asigna al evento campo citas_chek
            dataParams.citaValue, // Color visual que se asigna al evento campo masDeUnaCita_calendar
        ], // Parámetros que identifican el rol y el ID del administrador.
        dataParams.database, // Nombre de la base de datos a utilizar.
    );



/**
 * Ejecuta el procedimiento almacenado para actualizar la fecha de un evento en el calendario.
 *
 * @param {object} dataParams - Parámetros necesarios para la ejecución del procedimiento almacenado.
 * @param {number} dataParams.id - ID del evento que se va a mover.
 * @param {string} dataParams.newDateSart - Nueva fecha de inicio para el evento (en formato YYYY-MM-DD).
 * @param {string} dataParams.newDateEnd - Nueva fecha de finalización para el evento (en formato YYYY-MM-DD).
 * @param {string} dataParams.database - Nombre de la base de datos en la que se va a ejecutar el procedimiento.
 *
 * @returns {Promise<object>} - Retorna el resultado de la ejecución del procedimiento almacenado.
 */
calendars.update_event_MoveDate = (dataParams) =>
    executeStoredProcedure(
        "update_event_MoveDate", // Nombre del procedimiento almacenado que se ejecuta en la base de datos.
        [
            dataParams.id, // ID del evento que se va a actualizar.
            dataParams.newDateStart, // Nueva fecha de inicio del evento.
            dataParams.newDateEnd, // Nueva fecha de finalización del evento.
        ],
        dataParams.database, // Nombre de la base de datos en la que se realiza la operación.
    );



module.exports = calendars; // Exporta el objeto 'calendars' que contiene todas las funciones relacionadas con eventos del calendario.
