const mysql = require("mysql2/promise"); // Importa el módulo 'mysql2/promise' para manejar conexiones a la base de datos de manera asincrónica.
const config = require("../../config/config"); // Importa la configuración de la base de datos desde un archivo externo.

const home = {}; // Define un objeto vacío que contendrá todas las funciones relacionadas con 'home'.

/**
 * @module home
 * @description Módulo para manejar operaciones relacionadas con home en la base de datos.
 */

/**
 * Crea una conexión a la base de datos especificada.
 * @async
 * @param {string} database - Nombre de la base de datos a conectar.
 * @returns {Promise<mysql.Connection>} Conexión a la base de datos.
 */
const createConnection = async (database) => {
    try {
        // Intenta establecer una conexión con la base de datos especificada.
        const connection = await mysql.createConnection(config.database[database]);
        return connection; // Retorna la conexión si se establece correctamente.
    } catch (error) {
        // Manejo de errores en caso de que falle la conexión.
        console.error(`Error al crear la conexión a la base de datos: ${error.message}`);
        throw new Error("No se pudo establecer la conexión a la base de datos"); // Lanza un nuevo error si la conexión falla.
    }
};

/**
 * Maneja operaciones de base de datos de forma segura.
 * @async
 * @param {Function} operation - Función que realiza la operación de base de datos.
 * @param {string} database - Nombre de la base de datos a utilizar.
 * @returns {Promise<Object>} Resultado de la operación.
 */
const handleDatabaseOperation = async (operation, database) => {
    let connection; // Declaración de la variable que contendrá la conexión a la base de datos.
    try {
        connection = await createConnection(database); // Establece la conexión utilizando la función 'createConnection'.
        return await operation(connection); // Ejecuta la operación de base de datos pasada como argumento.
    } catch (error) {
        // Manejo de errores durante la operación de la base de datos.
        console.error(`Error en la operación de base de datos: ${error.message}`);
        return { statusCode: 500, error: "Error interno del servidor" }; // Retorna un código de error 500 si algo sale mal.
    } finally {
        // Cierra la conexión a la base de datos si se ha establecido.
        if (connection) await connection.end();
    }
};

/**
 * Ejecuta un procedimiento almacenado y maneja la respuesta.
 * @async
 * @param {string} procedureName - Nombre del procedimiento almacenado.
 * @param {Array} params - Parámetros para el procedimiento almacenado.
 * @param {string} database - Nombre de la base de datos a utilizar.
 * @returns {Promise<Object>} Resultado de la operación.
 */
const executeStoredProcedure = async (procedureName, params, database) => {
    return handleDatabaseOperation(async (connection) => {
        // Ajusta la consulta para asegurarte de que todos los parámetros están en sus posiciones correctas.
        const [rows] = await connection.execute(`CALL ${procedureName}(${params.map(() => "?").join(", ")})`, params);

        // Retorna el resultado con un código de estado dependiendo si se encontraron datos.
        return {
            statusCode: rows.length > 0 && rows[0].length > 0 ? 200 : 210, // 200 si hay resultados, 210 si no.
            data: rows[0], // Los datos obtenidos del procedimiento almacenado.
        };
    }, database);
};

/**
 * Obtiene los leads basados en el rol del usuario y su ID.
 * @async
 * @param {Object} dataParams - Parámetros para la consulta.
 * @returns {Promise<Object>} Resultado de la operación.
 */
home.fetchLeadsAsyncNew = (dataParams) =>
    executeStoredProcedure(
        "banner_home_leadsNew", // Nombre del procedimiento almacenado.
        [dataParams.rol_admin, dataParams.idnetsuite_admin], // Parámetros para el procedimiento.
        dataParams.database, // Base de datos a utilizar.
    );

/**
 * Obtiene los leads que requieren atención.
 * @async
 * @param {Object} dataParams - Parámetros para la consulta.
 * @returns {Promise<Object>} Resultado de la operación.
 */
home.fetchLeadsAsyncattention = (dataParams) =>
    executeStoredProcedure(
        "banner_home_leadsAttention", // Nombre del procedimiento almacenado.
        [dataParams.rol_admin, dataParams.idnetsuite_admin], // Parámetros para el procedimiento.
        dataParams.database, // Base de datos a utilizar.
    );

/**
 * Obtiene los eventos basados en el rol del usuario y su ID.
 * @async
 * @param {Object} dataParams - Parámetros para la consulta.
 * @returns {Promise<Object>} Resultado de la operación.
 */
home.fetchEventsAsync = (dataParams) =>
    executeStoredProcedure(
        "banner_home_events", // Nombre del procedimiento almacenado.
        [dataParams.rol_admin, dataParams.idnetsuite_admin], // Parámetros para el procedimiento.
        dataParams.database, // Base de datos a utilizar.
    );

/**
 * Obtiene todas las oportunidades basadas en el rol del usuario y su ID.
 * @async
 * @param {Object} dataParams - Parámetros para la consulta.
 * @returns {Promise<Object>} Resultado de la operación.
 */
home.fetchOportunityAsync = (dataParams) =>
    executeStoredProcedure(
        "banner_home_count_opportunities", // Nombre del procedimiento almacenado.
        [dataParams.rol_admin, dataParams.idnetsuite_admin], // Parámetros para el procedimiento.
        dataParams.database, // Base de datos a utilizar.
    );

/**
 * Obtiene todas las ordenes De venta basadas en el rol del usuario y su ID.
 * @async
 * @param {Object} dataParams - Parámetros para la consulta.
 * @returns {Promise<Object>} Resultado de la operación.
 */
home.fetchAllOrderSale = (dataParams) =>
    executeStoredProcedure(
        "banner_Home_OrdenSale", // Nombre del procedimiento almacenado.
        [dataParams.rol_admin, dataParams.idnetsuite_admin], // Parámetros para el procedimiento.
        dataParams.database, // Base de datos a utilizar.
    );


    /**
 * Obtiene todas las ordenes De venta con pago pendiente al endedot basadas en el rol del usuario y su ID.
 * @async
 * @param {Object} dataParams - Parámetros para la consulta.
 * @returns {Promise<Object>} Resultado de la operación.
 */
home.fetchAllOrderSale_pending = (dataParams) =>
    executeStoredProcedure(
        "banner_Home_OrdenSale_complete", // Nombre del procedimiento almacenado.
        [dataParams.rol_admin, dataParams.idnetsuite_admin], // Parámetros para el procedimiento.
        dataParams.database, // Base de datos a utilizar.
    );


/**
 * Actualiza el estado de un evento en la tabla de calendarios.
 * @async
 * @param {Object} dataParams - Parámetros para la actualización.
 * @returns {Promise<Object>} Resultado de la operación.
 */
home.updateEventsStatusAsync = (dataParams) =>
    handleDatabaseOperation(async (connection) => {
        // Ejecuta el procedimiento almacenado para actualizar el estado de un evento.
        const [result] = await connection.execute(
            `CALL update_event_status(?, ?)`, // Llamada al procedimiento almacenado.
            [dataParams.newStatus, dataParams.id_calendar], // Parámetros para la actualización: nuevo estado e ID del calendario.
        );

        // Retorna el resultado con un código de estado dependiendo si se afectó alguna fila.
        return {
            statusCode: result.affectedRows > 0 ? 200 : 210, // 200 si se actualizó el evento, 210 si no.
            data: result, // Resultado de la operación de actualización.
        };
    }, dataParams.database);


/**
 * Extrae los resultados del gráfico mensual basado en el rol del usuario y actualiza el estado de un evento.
 * @async
 * @param {Object} dataParams - Parámetros para la actualización y filtro de datos.
 * @param {number} dataParams.typeRol - Tipo de rol del usuario (1 para administrador).
 * @param {number} dataParams.idAdmin - ID del administrador para filtrar los eventos.
 * @param {string} dataParams.dateStart - Fecha de inicio para el filtrado.
 * @param {string} dataParams.dateEnd - Fecha de fin para el filtrado.
 * @param {string} [dataParams.database] - Nombre de la base de datos (opcional).
 * @returns {Promise<Object>} Resultado de la operación.
 */
home.getMonthlyData = async (dataParams) =>
    handleDatabaseOperation(async (connection) => {
        console.log(dataParams);
        // Ejecuta el procedimiento almacenado para obtener los datos del gráfico mensual.
        const [results] = await connection.query(
            `CALL monthly_graphics(?, ?, ?, ?)`, // Llamada al procedimiento almacenado.
            [dataParams.rol_admin, dataParams.idAdmin, dataParams.startDate, dataParams.endDate], // Parámetros para la consulta.
        );
        console.log(results);

        // Aplanar los resultados en un solo objeto.
        const formattedResults = {
            total_lead: results[0][0]?.total_lead || 0,
            total_oport: results[1][0]?.total_oport || 0,
            total_calendars: results[2][0]?.total_calendars || 0,
        };

        // Retorna el resultado combinado con un código de estado 200.
        return {
            statusCode: 200,
            data: formattedResults, // Resultado de la consulta del gráfico mensual aplanado.
        };
    }, dataParams.database);



    /**
 * Extrae los resultados del gráfico mensual de KPIs basado en el rol del usuario y los filtros proporcionados.
 * @async
 * @param {Object} dataParams - Parámetros para la actualización y filtrado de datos.
 * @param {number} dataParams.idnetsuite_admin - ID del administrador de Netsuite que realiza la solicitud.
 * @param {number} dataParams.rol_admin - Tipo de rol del usuario (1 para administrador).
 * @param {string} dataParams.startDate - Fecha de inicio para el filtrado.
 * @param {string} dataParams.endDate - Fecha de fin para el filtrado.
 * @param {Array} dataParams.campaigns - Lista de campañas para filtrar los datos del gráfico.
 * @param {Array} dataParams.projects - Lista de proyectos para filtrar los datos del gráfico.
 * @param {string} [dataParams.database] - Nombre de la base de datos (opcional).
 * @returns {Promise<Object>} Resultado de la operación con los datos del gráfico mensual de KPIs.
 */
home.fetchGetMonthlyDataKpi = async (dataParams) =>
    handleDatabaseOperation(async (connection) => {
        // Ejecuta el procedimiento almacenado para obtener los datos del gráfico mensual de KPIs.
        const [results] = await connection.query(
            `CALL monthly_graphicsKpi(?, ?, ?, ?, ?, ?)`, // Llamada al procedimiento almacenado para obtener los datos de KPIs.
            [dataParams.idnetsuite_admin, dataParams.rol_admin, dataParams.startDate, dataParams.endDate, dataParams.campaigns, dataParams.projects], // Parámetros para la consulta.
        );

        console.log(results);

        // Aplanar los resultados en un solo objeto.
        const formattedResults = {
            total_complete: results[0][0]?.total_lead || 0,
            total_pending: results[1][0]?.total_oport || 0,
            total_cancel: results[2][0]?.total_calendars || 0,
        };

        // Retorna el resultado combinado con un código de estado 200.
        return {
            statusCode: 200,
            data: formattedResults, // Resultado de la consulta del gráfico mensual de KPIs aplanado.
        };
    }, dataParams.database);




module.exports = home; // Exporta el módulo 'home' para que pueda ser utilizado en otros archivos.
