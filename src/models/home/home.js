const mysql = require("mysql2/promise"); // Módulo para manejar conexiones a la base de datos de manera asincrónica.
const config = require("../../config/config"); // Importa la configuración de la base de datos.

const home = {}; // Objeto para agrupar todas las funciones relacionadas con 'home'.

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
 * Ejecuta un procedimiento almacenado con parámetros proporcionados y retorna el resultado.
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
 * Obtiene todos los banners relevantes según el rol del usuario y su ID en la base de datos.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de banners.
 */
home.getAllBanners = (dataParams) =>
    executeStoredProcedure(
        "getAllBanners", // Nombre del procedimiento almacenado que recupera los banners.
        [dataParams.rol_admin, dataParams.idnetsuite_admin], // Parámetros que identifican el rol y el ID del usuario.
        dataParams.database, // Nombre de la base de datos a utilizar.
    );

/**
 * Obtiene los eventos pendientes del home basados en el rol del usuario y su ID.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de eventos pendientes.
 */
home.getAllEventsHome = (dataParams) =>
    executeStoredProcedure(
        "home_events_pending", // Nombre del procedimiento almacenado que recupera eventos pendientes.
        [dataParams.rol_admin, dataParams.idnetsuite_admin], // Parámetros que identifican el rol y el ID del usuario.
        dataParams.database, // Nombre de la base de datos a utilizar.
    );

/**
 * Actualiza el estado de un evento específico en la base de datos.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros para la actualización.
 * @returns {Promise<Object>} - Resultado de la operación de actualización.
 */
home.updateEventStatus = (dataParams) =>
    handleDatabaseOperation(async (connection) => {
        console.log(dataParams);
        // Ejecuta el procedimiento almacenado para actualizar el estado del evento.
        const [result] = await connection.execute(
            `CALL home_update_event_status(?, ?)`, // Procedimiento almacenado para actualizar el estado del evento.
            [dataParams.newStatus, dataParams.id_calendar], // Parámetros: nuevo estado e ID del evento.
        );
        return {
            statusCode: result.affectedRows > 0 ? 200 : 210, // Si se afectaron filas, retorna 200, sino 210.
            data: result, // Devuelve el resultado de la operación.
        };
    }, dataParams.database);

/**
 * Obtiene los datos mensuales de KPI basados en el rol y el ID del administrador, así como un rango de fechas.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de datos mensuales para KPI.
 */
home.fetchGetMonthlyDataKpi = (dataParams) =>
    executeStoredProcedure(
        "monthly_graphicsKpi", // Procedimiento almacenado para obtener los datos de KPI mensuales.
        [dataParams.rol_admin, dataParams.idnetsuite_admin, dataParams.startDate, dataParams.endDate], // Parámetros para el procedimiento: rol, ID, rango de fechas.
        dataParams.database, // Base de datos a utilizar.
    );

/**
 * Obtiene los datos gráficos mensuales basados en el rol del administrador y un rango de fechas.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de gráficos mensuales.
 */
home.getMonthlyData = (dataParams) =>
    executeStoredProcedure(
        "monthly_graphics", // Procedimiento almacenado para obtener los datos mensuales.
        [dataParams.rol_admin, dataParams.idnetsuite_admin, dataParams.startDate, dataParams.endDate], // Parámetros para el procedimiento: rol, ID, rango de fechas.
        dataParams.database, // Base de datos a utilizar.
    );

/**
 * Actualiza la fecha de un evento específico en la base de datos.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la actualización.
 * @returns {Promise<Object>} - Resultado de la operación de actualización.
 */
home.fetchupdateEventDate = (dataParams) =>
    executeStoredProcedure(
        "home_update_date_event", // Procedimiento almacenado que actualiza la fecha de un evento.
        [dataParams.eventId, dataParams.selectedValue], // Parámetros: fecha de inicio y de fin del evento.
        dataParams.database, // Base de datos a utilizar.
    );

module.exports = home; // Exporta el objeto 'home' que contiene todas las funciones definidas.
