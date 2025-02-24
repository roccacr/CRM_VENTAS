const mysql = require("mysql2/promise");
const config = require("../../config/config");

let pools = {};

/**
 * Crea un pool de conexiones y lo almacena en un objeto para reutilización.
 * @param {string} database - El nombre de la base de datos a la que se va a conectar.
 * @returns {mysql.Pool} - Retorna un pool de conexiones a la base de datos.
 */
const getPool = (database) => {
    if (!pools[database]) {
        pools[database] = mysql.createPool(config.database[database]);
    }
    return pools[database];
};

/**
 * Maneja una operación en la base de datos utilizando un pool de conexiones.
 * @async
 * @param {Function} operation - Función que define la operación a realizar en la base de datos.
 * @param {string} database - Nombre de la base de datos a utilizar.
 * @returns {Promise<Object>} - El resultado de la operación de base de datos.
 */
const handleDatabaseOperation = async (operation, database) => {
    let connection;
    try {
        // Obtiene el pool de conexiones de la base de datos.
        const pool = getPool(database);
        // Obtiene una conexión del pool.
        connection = await pool.getConnection();
        return await operation(connection); // Ejecuta la operación de la base de datos.
    } catch (error) {
        console.error(`Error en la operación de base de datos: ${error.message}`);
        return { statusCode: 500, error: "Error interno del servidor" };
    } finally {
        // Libera la conexión de vuelta al pool para que pueda ser reutilizada.
        if (connection) connection.release();
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
        const [rows] = await connection.execute(`CALL ${procedureName}(${params.map(() => "?").join(", ")})`, params);
        return {
            ok: true,
            statusCode: 200,
            ...rows, // Devuelve los resultados del procedimiento almacenado.
        };
    }, database);
};

/**
 * Ejecuta una consulta SQL arbitraria proporcionada y retorna el resultado.
 * @async
 * @param {string} query - Consulta SQL completa a ejecutar.
 * @param {Array} params - Array de parámetros para la consulta (opcional).
 * @param {string} database - Nombre de la base de datos a utilizar.
 * @returns {Promise<Object>} - Resultado de la ejecución de la consulta.
 */
const executeQuery = async (query, params = [], database) => {
    return handleDatabaseOperation(async (connection) => {
        const [rows] = await connection.execute(query, params);

    
        return {
            ok: true,
            statusCode: 200,
            data: rows, // Devuelve los resultados de la consulta SQL.
        };
    }, database);
};

/**
 * Cierra todos los pools de conexiones.
 */
const closePools = async () => {
    try {
        const closePromises = Object.keys(pools).map((database) => pools[database].end());
        await Promise.all(closePromises);
        pools = {}; // Limpia los pools después de cerrarlos
    } catch (error) {
        console.error(`Error cerrando los pools: ${error.message}`);
    }
};

// Exportar las funciones
module.exports = {
    getPool,
    handleDatabaseOperation,
    executeStoredProcedure,
    executeQuery, // Exporta la nueva función para ejecutar consultas arbitrarias
    closePools,
};
