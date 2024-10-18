const mysql = require("mysql2/promise"); // Módulo para gestionar conexiones a la base de datos de forma asincrónica.
const config = require("../../config/config"); // Configuración de la base de datos.

const oportunidad = {}; // Objeto que agrupa las funciones relacionadas con 'oportunidad'.

/**
 * Crea una conexión asincrónica a la base de datos especificada.
 * @async
 * @param {string} database - El nombre de la base de datos a la que se va a conectar.
 * @returns {Promise<mysql.Connection>} - Retorna una conexión activa a la base de datos.
 * @throws {Error} - Lanza un error si no se puede establecer la conexión.
 */
const createConnection = async (database) => {
    try {
        // Establece una conexión utilizando la configuración definida en el archivo de configuración.
        const connection = await mysql.createConnection(config.database[database]);
        return connection; // Retorna la conexión activa.
    } catch (error) {
        // Registra el error y lanza una excepción con un mensaje claro en caso de fallo.
        console.error(`Error al conectar a la base de datos: ${error.message}`);
        throw new Error("No se pudo establecer la conexión con la base de datos.");
    }
};

/**
 * Realiza una operación en la base de datos asegurando la conexión y su cierre.
 * @async
 * @param {Function} operation - Función que define la operación a realizar con la base de datos.
 * @param {string} database - Nombre de la base de datos que se utilizará.
 * @returns {Promise<Object>} - Resultado de la operación de base de datos.
 * @throws {Error} - Lanza un error si ocurre un problema durante la operación.
 */
const handleDatabaseOperation = async (operation, database) => {
    let connection;
    try {
        // Establece la conexión y ejecuta la operación definida.
        connection = await createConnection(database);
        return await operation(connection);
    } catch (error) {
        // Captura errores durante la operación y retorna un estado de error.
        console.error(`Error en la operación de base de datos: ${error.message}`);
        return { statusCode: 500, error: "Error interno del servidor." };
    } finally {
        // Asegura el cierre de la conexión si esta fue creada.
        if (connection) await connection.end();
    }
};

/**
 * Ejecuta un procedimiento almacenado en la base de datos y devuelve el resultado.
 * @async
 * @param {string} procedureName - Nombre del procedimiento almacenado a ejecutar.
 * @param {Array} params - Parámetros a enviar al procedimiento almacenado.
 * @param {string} database - Nombre de la base de datos que se utilizará.
 * @returns {Promise<Object>} - Resultado de la ejecución del procedimiento almacenado.
 */
const executeStoredProcedure = async (procedureName, params, database) => {
    return handleDatabaseOperation(async (connection) => {
        // Ejecuta el procedimiento almacenado con parámetros seguros para prevenir inyecciones SQL.
        const [rows] = await connection.execute(`CALL ${procedureName}(${params.map(() => "?").join(", ")})`, params);
        return {
            ok: true,
            statusCode: 200,
            ...rows, // Devuelve los resultados obtenidos del procedimiento almacenado.
        };
    }, database);
};

/**
 * Obtiene todas las ubicaciones de la base de datos mediante un procedimiento almacenado.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de ubicaciones.
 */
oportunidad.getUbicaciones = (dataParams) =>
    executeStoredProcedure(
        "getUbicaciones", // Nombre del procedimiento almacenado que recupera las ubicaciones.
        [dataParams.idUbicacion], // Parámetros para identificar la ubicación.
        dataParams.database, // Nombre de la base de datos a utilizar.
    );


/**
 * Obtiene todas las clases de la base de datos mediante un procedimiento almacenado.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de clases.
 */
oportunidad.getClases = (dataParams) =>
    executeStoredProcedure(
        "getClases", // Nombre del procedimiento almacenado que recupera las ubicaciones.
        [dataParams.idClases], // Parámetros para identificar la clases.
        dataParams.database, // Nombre de la base de datos a utilizar.
    );





    

module.exports = oportunidad; // Exporta el objeto 'oportunidad' que agrupa las funciones relacionadas con ubicaciones.
