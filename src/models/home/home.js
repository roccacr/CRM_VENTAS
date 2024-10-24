const { executeStoredProcedure } = require("../conectionPool/conectionPool");

const home = {}; // Objeto para agrupar todas las funciones relacionadas con 'home'.


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
