const mysql = require("mysql2/promise"); // Módulo para manejar conexiones a la base de datos de manera asincrónica.
const config = require("../../config/config"); // Importa la configuración de la base de datos.

const leads = {}; // Objeto para agrupar todas las funciones relacionadas con 'leads'.

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
leads.getAll_LeadsNew = (dataParams) =>
    executeStoredProcedure(
        "getAll_LeadsNew", // Nombre del procedimiento almacenado que recupera los banners.
        [dataParams.rol_admin, dataParams.idnetsuite_admin], // Parámetros que identifican el rol y el ID del usuario.
        dataParams.database, // Nombre de la base de datos a utilizar.
    );

/**
 * Obtiene la bitácora de un lead específico desde la base de datos.
 *
 * Esta función ejecuta un procedimiento almacenado para recuperar la bitácora del lead,
 * identificada por el ID proporcionado.
 *
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @param {number} dataParams.idLeads - ID del lead cuya bitácora se desea obtener.
 * @param {string} dataParams.database - Nombre de la base de datos donde se ejecutará la consulta.
 * @returns {Promise<Object>} - Promesa que resuelve con el resultado de la consulta de la bitácora.
 */
leads.getBitacora = (dataParams) =>
    executeStoredProcedure(
        "getBitacoraLead", // Nombre del procedimiento almacenado que recupera la bitácora del lead.
        [dataParams.idLeads], // Parámetro que identifica el ID del lead.
        dataParams.database, // Base de datos donde se ejecutará el procedimiento.
    );


/**
 * Obtiene la lista de leads que requieren atención desde la base de datos.
 *
 * Esta función ejecuta un procedimiento almacenado para recuperar la lista de leads
 * que requieren atención, basada en el rol y el ID del administrador de Netsuite.
 *
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @param {string} dataParams.rol_admin - Rol del administrador, utilizado para filtrar los leads según permisos.
 * @param {number} dataParams.idnetsuite_admin - ID del administrador de Netsuite, utilizado para identificar al solicitante.
 * @param {string} dataParams.database - Nombre de la base de datos donde se ejecutará la consulta.
 * @returns {Promise<Object>} - Promesa que resuelve con el resultado de la consulta de leads que requieren atención.
 */
leads.getAll_LeadsAttention = (dataParams) =>
    executeStoredProcedure(
        "getAll_LeadsAttention", // Nombre del procedimiento almacenado que recupera los leads que requieren atención.
        [dataParams.rol_admin, dataParams.idnetsuite_admin, dataParams.startDate, dataParams.endDate, dataParams.filterOption], // Parámetros necesarios: rol y ID del administrador.
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );


    
/**
 * Obtiene la lista de leads que requieren atención desde la base de datos.
 *
 * Esta función ejecuta un procedimiento almacenado para recuperar la lista de leads
 * que requieren atención, basada en el rol y el ID del administrador de Netsuite.
 *
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @param {string} dataParams.rol_admin - Rol del administrador, utilizado para filtrar los leads según permisos.
 * @param {number} dataParams.idnetsuite_admin - ID del administrador de Netsuite, utilizado para identificar al solicitante.
 * @param {string} dataParams.database - Nombre de la base de datos donde se ejecutará la consulta.
 * @returns {Promise<Object>} - Promesa que resuelve con el resultado de la consulta de leads que requieren atención.
 */
leads.getAllStragglers = (dataParams) =>
    executeStoredProcedure(
        "getAll_LeadStragglers", // Nombre del procedimiento almacenado que recupera los leads que requieren atención.
        [dataParams.rol_admin, dataParams.idnetsuite_admin, dataParams.startDate, dataParams.endDate, dataParams.filterOption], // Parámetros necesarios: rol y ID del administrador.
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );

/**
 * Obtiene la lista completa de leads desde la base de datos, sin importar si son nuevos o requieren atención.
 *
 * Esta función ejecuta un procedimiento almacenado para recuperar la lista de leads
 * basada en el rol y el ID del administrador de Netsuite, junto con un rango de fechas
 * y una opción de filtro específica.
 *
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @param {string} dataParams.rol_admin - Rol del administrador, utilizado para filtrar los leads según permisos.
 * @param {number} dataParams.idnetsuite_admin - ID del administrador de Netsuite, utilizado para identificar al solicitante.
 * @param {string} dataParams.startDate - Fecha de inicio del filtro.
 * @param {string} dataParams.endDate - Fecha de fin del filtro.
 * @param {string} dataParams.filterOption - Opción de filtro aplicada para segmentar los leads.
 * @param {string} dataParams.database - Nombre de la base de datos donde se ejecutará la consulta.
 * @returns {Promise<Object>} - Promesa que resuelve con el resultado de la consulta de leads.
 */
leads.getAll_LeadsComplete = (dataParams) =>
    executeStoredProcedure(
        "getAll_LeadsComplete", // Nombre del procedimiento almacenado que recupera los leads.
        [dataParams.rol_admin, dataParams.idnetsuite_admin, dataParams.startDate, dataParams.endDate, dataParams.filterOption], // Parámetros necesarios: rol, ID del administrador, fechas y opción de filtro.
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );


/**
 * Obtiene la lista completa de leads repetidos desde la base de datos.
 *
 * Esta función ejecuta un procedimiento almacenado para recuperar la lista de leads
 * que tienen correos electrónicos duplicados, basada en el rol y el ID del administrador
 * de Netsuite.
 *
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @param {string} dataParams.rol_admin - Rol del administrador, utilizado para filtrar los leads según permisos.
 * @param {number} dataParams.idnetsuite_admin - ID del administrador de Netsuite, utilizado para identificar al solicitante.
 * @param {string} dataParams.database - Nombre de la base de datos donde se ejecutará la consulta.
 * @returns {Promise<Object>} - Promesa que resuelve con el resultado de la consulta de leads repetidos.
 */
leads.getAll_LeadsRepit = (dataParams) =>
    executeStoredProcedure(
        "get_Leads_With_Duplicate_Emails", // Nombre del procedimiento almacenado que recupera los leads repetidos.
        [dataParams.rol_admin, dataParams.idnetsuite_admin], // Parámetros necesarios: rol y ID del administrador.
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );



/**
 * Obtiene la información de un lead específico desde la base de datos.
 *
 * Esta función ejecuta un procedimiento almacenado para recuperar los detalles 
 * de un lead específico basado en su ID.
 *
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @param {number} dataParams.idLead - ID del lead que se desea recuperar.
 * @param {string} dataParams.database - Nombre de la base de datos donde se ejecutará la consulta.
 * @returns {Promise<Object>} - Promesa que resuelve con el resultado de la consulta del lead específico.
 */
leads.get_Specific_Lead = (dataParams) =>
    executeStoredProcedure(
        "get_Specific_Lead", // Nombre del procedimiento almacenado que recupera la información del lead específico.
        [dataParams.idLead], // Parámetros necesarios: ID del lead.
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );


/**
 * Inserta una bitácora de acciones para un lead específico en la base de datos.
 *
 * Esta función ejecuta un procedimiento almacenado para registrar una bitácora 
 * de las acciones realizadas sobre un lead en la base de datos, proporcionando
 * detalles como el ID del lead, la descripción del evento, el tipo de acción y el estado actual.
 *
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la inserción de la bitácora.
 * @param {number} dataParams.leadId - ID del lead para el cual se está registrando la bitácora.
 * @param {number} dataParams.idnetsuite_admin - ID del administrador de NetSuite que está realizando la acción.
 * @param {string} dataParams.valorDeCaida - Valor relacionado con la caída o progreso del lead.
 * @param {string} dataParams.descripcionEvento - Descripción del evento o acción realizada.
 * @param {string} dataParams.tipo - Tipo de evento o acción que se está registrando (por ejemplo, seguimiento, reserva, etc.).
 * @param {string} dataParams.estadoActual - Estado actual del lead, validado previamente para asegurar su consistencia.
 * @param {string} dataParams.database - Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
 * @returns {Promise<Object>} - Promesa que resuelve con el resultado de la inserción de la bitácora.
 */
leads.insertBitcoraLead = (dataParams) => 
    executeStoredProcedure(
        "insertBitcoraLead", // Nombre del procedimiento almacenado que gestiona la inserción de la bitácora.
        [
            dataParams.leadId,            // ID del lead que se está manejando.
            dataParams.idnetsuite_admin,  // ID del administrador que realiza la acción.
            dataParams.valorDeCaida,      // Valor asociado al progreso o caída del lead.
            dataParams.descripcionEvento, // Descripción del evento o acción realizada.
            dataParams.tipo,              // Tipo de evento (ejemplo: seguimiento, reserva, etc.).
            dataParams.estadoActual       // Estado actual del lead, validado previamente.
        ], 
        dataParams.database // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );


/**
 * Actualiza la información de un lead y registra una bitácora de las acciones realizadas en la base de datos.
 *
 * Esta función ejecuta un procedimiento almacenado para actualizar el estado del lead y registrar una bitácora
 * con los detalles de la acción realizada, como el ID del lead, el estado actual, la acción tomada, el seguimiento
 * en el calendario y otros valores relacionados.
 *
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la actualización y registro de la bitácora.
 * @param {number} dataParams.leadId - ID del lead que se está actualizando y para el cual se registrará la bitácora.
 * @param {string} dataParams.estadoActual - Estado actual del lead, previamente validado para asegurar consistencia de datos.
 * @param {string} dataParams.valor_segimineto_lead - Valor asociado al seguimiento actual del lead.
 * @param {string} dataParams.estado_lead - Estado nuevo del lead que se actualizará en el sistema.
 * @param {string} dataParams.accion_lead - Acción que se ha realizado sobre el lead, como seguimiento, reserva, etc.
 * @param {string} dataParams.seguimiento_calendar - Información de seguimiento relacionada con el calendario del lead.
 * @param {string} dataParams.valorDeCaida - Motivo o valor relacionado con la caída del lead, si aplica.
 * @param {string} dataParams.formattedDate - Fecha formateada en la que se realizó la acción (YYYY-MM-DD).
 * @param {string} dataParams.database - Nombre de la base de datos en la que se ejecutará el procedimiento almacenado.
 * @returns {Promise<Object>} - Devuelve una promesa que resuelve con el resultado de la ejecución del procedimiento almacenado.
 */
leads.updateLeadActionApi = (dataParams) =>
    executeStoredProcedure(
        "updateLeadActionApi", // Nombre del procedimiento almacenado que gestiona la actualización y registro de la bitácora.
        [
            dataParams.estadoActual,            // Estado actual del lead.
            dataParams.valor_segimineto_lead,   // Valor del seguimiento asociado al lead.
            dataParams.estado_lead,             // Nuevo estado del lead a actualizar.
            dataParams.accion_lead,             // Acción realizada sobre el lead.
            dataParams.seguimiento_calendar,    // Información de seguimiento en el calendario.
            dataParams.valorDeCaida,            // Valor relacionado con la caída del lead, si corresponde.
            dataParams.formattedDate,           // Fecha formateada de la acción realizada (YYYY-MM-DD).
            dataParams.leadId                   // ID del lead que se está actualizando.
        ],
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );


module.exports = leads; // Exporta el objeto 'leads' que contiene todas las funciones definidas.
