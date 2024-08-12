const mysql = require("mysql2/promise");
const config = require("../../config/config");

const home = {};

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

home.fetchLeadsAsyncNew = async (dataParams) => {

    return handleDatabaseOperation(async (connection) => {
        const [result] = await connection.execute(
            `SELECT * FROM leads
             WHERE
             accion_lead in (0, 2)
             and estado_lead = 1
             and segimineto_lead in ('01-LEAD-INTERESADO')
             and id_empleado_lead =? `,
            [dataParams.idnetsuite_admin]);
        return { statusCode: result.length > 0 ? 200 : 210, data: result };
    }, dataParams.database);
};

home.fetchLeadsAsyncattention = async (dataParams) => {

    return handleDatabaseOperation(async (connection) => {
        const [result] = await connection.execute(
            `SELECT * FROM leads
            WHERE
            accion_lead = 3
            and estado_lead=1
            and seguimiento_calendar=0
            and segimineto_lead NOT IN ('02-LEAD-OPORTUNIDAD', '03-LEAD-PRE-RESERVA', '04-LEAD-RESERVA', '05-LEAD-CONTRATO', '06-LEAD-ENTREGADO')
            and  id_empleado_lead=?`,
            [dataParams.idnetsuite_admin]);
        return { statusCode: result.length > 0 ? 200 : 210, data: result };
    }, dataParams.database);
};


home.fetchEventsAsync = async (dataParams) => {

    return handleDatabaseOperation(async (connection) => {
        const [result] = await connection.execute(
            `SELECT
                IFNULL(leads.nombre_lead, '--') AS nombre_lead,
                IFNULL(leads.proyecto_lead, '--') AS proyecto,
                IFNULL(leads.campana_lead, '--') AS campana,
               calendars.*
            FROM calendars
               LEFT JOIN leads ON leads.idinterno_lead = calendars.id_lead
            WHERE
               estado_calendar = 1
               AND accion_calendar = 'Pendiente'
               AND id_admin = ?`,
            
            [dataParams.idnetsuite_admin],
        );
        return { statusCode: result.length > 0 ? 200 : 210, data: result };
    }, dataParams.database);
};

module.exports = home;
