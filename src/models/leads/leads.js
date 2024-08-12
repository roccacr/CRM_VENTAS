const mysql = require("mysql2/promise");
const config = require("../../config/config");

/**
 * @module leads
 * @description Módulo para manejar operaciones relacionadas con leads en la base de datos.
 */

/**
 * Crea una conexión a la base de datos especificada.
 * @async
 * @param {string} database - Nombre de la base de datos a conectar.
 * @returns {Promise<mysql.Connection>} Conexión a la base de datos.
 */
const createConnection = async (database) => {
    return await mysql.createConnection(config.database[database]);
};

/**
 * Maneja operaciones de base de datos de forma segura.
 * @async
 * @param {Function} operation - Función que realiza la operación de base de datos.
 * @param {string} database - Nombre de la base de datos a utilizar.
 * @returns {Promise<Object>} Resultado de la operación.
 */
const handleDatabaseOperation = async (operation, database) => {
    let connection;
    try {
        connection = await createConnection(database);
        return await operation(connection);
    } catch (error) {
        console.error(`Error en la operación de base de datos: ${error.message}`);
        return { statusCode: 500, error: "Error interno del servidor" };
    } finally {
        if (connection) await connection.end();
    }
};

const leads = {
    /**
     * Obtiene información de leads desde la base de datos.
     * @async
     * @param {Object} dataParams - Parámetros para la consulta.
     * @param {string} dataParams.database - Nombre de la base de datos a consultar.
     * @returns {Promise<Object>} Resultado de la consulta.
     */
    fetchLeadsAsync: async (dataParams) => {
        return handleDatabaseOperation(async (connection) => {
            const [result] = await connection.execute("SELECT * FROM leads WHERE id_lead != ?", ["29931"]);
            return { statusCode: result.length > 0 ? 200 : 210, data: result };
        }, dataParams.database);
    },
};

module.exports = leads;
