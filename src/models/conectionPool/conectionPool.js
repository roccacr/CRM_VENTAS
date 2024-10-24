const mysql = require("mysql2/promise"); // Módulo para manejar conexiones a la base de datos de manera asincrónica.
const config = require("../../config/config"); // Importa la configuración de la base de datos.

/**
 * Crea un pool de conexiones para la base de datos especificada.
 * @param {string} database - El nombre de la base de datos a la que se va a conectar.
 * @returns {Promise<mysql.Pool>} - Retorna un pool de conexiones a la base de datos.
 * @throws {Error} - Lanza un error si no se puede crear el pool de conexiones.
 */
const createPool = async (database) => {
    try {
        // Crea un pool de conexiones utilizando la configuración definida.
        const pool = await mysql.createPool(config.database[database]);
        return pool; // Retorna el pool de conexiones.
    } catch (error) {
        // Registra el error y lanza una nueva excepción si la creación del pool falla.
        console.error(`Error al crear el pool de conexiones: ${error.message}`);
        throw new Error("No se pudo crear el pool de conexiones a la base de datos");
    }
};

/**
 * Maneja una operación en la base de datos utilizando un pool de conexiones.
 * @async
 * @param {Function} operation - Función que define la operación a realizar en la base de datos.
 * @param {string} database - Nombre de la base de datos a utilizar.
 * @returns {Promise<Object>} - El resultado de la operación de base de datos.
 * @throws {Error} - Lanza un error si ocurre un problema durante la operación.
 */
const handleDatabaseOperation = async (operation, database) => {
    let connection;
    try {
        // Obtiene el pool de conexiones de la base de datos.
        const pool = await createPool(database);
        // Obtiene una conexión del pool.
        connection = await pool.getConnection();
        return await operation(connection); // Ejecuta la operación de la base de datos.
    } catch (error) {
        // Captura cualquier error que ocurra durante la operación de la base de datos.
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
        // Ejecuta el procedimiento almacenado con los parámetros usando placeholders para evitar inyecciones SQL.
        const [rows] = await connection.execute(`CALL ${procedureName}(${params.map(() => "?").join(", ")})`, params);
        return {
            ok: true,
            statusCode: 200,
            ...rows, // Devuelve los resultados del procedimiento almacenado.
        };
    }, database);
};

// Exportar las funciones
module.exports = {
    createPool,
    handleDatabaseOperation,
    executeStoredProcedure,
};
