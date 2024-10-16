const mysql = require("mysql2/promise"); // Módulo para manejar conexiones a la base de datos de manera asincrónica.
const config = require("../../config/config"); // Importa la configuración de la base de datos.

const expedientes = {}; // Objeto para agrupar todas las funciones relacionadas con 'expedientes'.

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
 * Obtiene todos los archivos o expedientes.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de archivos o expedientes.
 */
expedientes.getFileList = (dataParams) =>
    executeStoredProcedure(
        "getFileList", // Nombre del procedimiento almacenado que recupera los expedientes.
        [], // Parámetros que identifican el rol y el ID del administrador.
        dataParams.database, // Nombre de la base de datos a utilizar.
    );

/**
 * Obtiene todos los archivos o expedientes.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de archivos o expedientes.
 */
const updateFile = async (dataParams, database, id_expediente) => {
    return executeStoredProcedure(
        "updateExpediente_unidad", // Nombre del procedimiento almacenado que recupera los expedientes.
        [
            dataParams.codigo,
            dataParams.proyecto_Principal,
            dataParams.id_proyecto_Principal,
            dataParams.tipo_De_Vivienda,
            dataParams.lote_M2,
            dataParams.estado,
            dataParams.Precio_Venta_Unico,
            dataParams.MetrosHabitables,
            dataParams.Area_Total_M2,
            dataParams.Cuota_Manten_Apox,
            dataParams.Planos_Unidad,
            dataParams.Entrega_Estimada,
            dataParams.AREA_DE_BODEGA_M2,
            dataParams.AREA_DE_MEZZANINE_M2,
            dataParams.AREA_DE_BALCON_M2,
            dataParams.AREA_DE_PLANTA_BAJA_M2,
            dataParams.AREA_DE_PLANTA_ALTA_M2,
            dataParams.AREA_DE_AMPLIACION_M2,
            dataParams.AREA_DE_TERRAZA_M2,
            dataParams.PRECIOPOR_M2,
            dataParams.TERCER_NIVEL_SOTANO_M2,
            dataParams.AREA_DE_PARQUEO_APROXM2,
            dataParams.AREA_EXTERNA_JARDIN_M2,
            dataParams.AREA_COMUNLIBRE_ASIGNADO,
            dataParams.JARDI_CON_TALUD,
            dataParams.PRECIO_DE_VENTA_MINIMO,
            id_expediente,
        ],
        database, // Nombre de la base de datos a utilizar.
    );
};



module.exports = {
    ...expedientes, // Desglosa las funciones del objeto expedientes.
    updateFile, // Exporta la función updateFile.
};
