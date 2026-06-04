const { executeStoredProcedure, executeQuery, handleDatabaseOperation } = require("../conectionPool/conectionPool");
const { inactivateLeadOpportunitiesWithTraceability } = require("../oportunidad/opportunityTraceability");

const leads = {}; // Objeto para agrupar todas las funciones relacionadas con 'leads'.



/**
 * Obtiene todos los banners relevantes según el rol del usuario y su ID en la base de datos.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de banners.
 */
leads.getAll_LeadsNew = (dataParams) =>
    executeStoredProcedure(
        "32_OBTENER_TODOS_LOS_LEADS_NUEVOS", // Nombre del procedimiento almacenado que recupera los banners.
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
        "30_OBTENER_BITACORA_LEAD", // Nombre del procedimiento almacenado que recupera la bitácora del lead.
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
leads.getAll_LeadsAttention = (dataParams) => {

    return executeStoredProcedure(
        "34_CONSULTAR_LEADS_PENDIENTES_ATENCION", // Nombre del procedimiento almacenado que recupera los leads que requieren atención.
        [dataParams.rol_admin, dataParams.idnetsuite_admin, dataParams.startDate, dataParams.endDate, dataParams.filterOption], // Parámetros necesarios: rol y ID del administrador.
        dataParams.database // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );
};


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
        "35_OBTENER_LEADS_REZAGADOS", // Nombre del procedimiento almacenado que recupera los leads que requieren atención.
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
        "33_OBTENER_TODOS_LOS_LEADS_COMPLETOS", // Nombre del procedimiento almacenado que recupera los leads.
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
        "19_OBTENER_LEADS_CON_CORREOS_DUPLICADOS", // Nombre del procedimiento almacenado que recupera los leads repetidos.
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
        "18_OBTENER_LEAD_ESPECIFICO", // Nombre del procedimiento almacenado que recupera la información del lead específico.
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
    handleDatabaseOperation(async (connection) => {
        const [timeZoneRows] = await connection.query("SELECT @@session.time_zone AS sessionTimeZone");
        const previousTimeZone = timeZoneRows?.[0]?.sessionTimeZone || "SYSTEM";
        const procedureParams = [
            dataParams.leadId,
            dataParams.idnetsuite_admin,
            dataParams.valorDeCaida,
            dataParams.descripcionEvento,
            dataParams.tipo,
            dataParams.estadoActual,
        ];

        try {
            await connection.query("SET time_zone = '-06:00'");

            const [rows] = await connection.execute(
                `CALL 14_INSERTAR_BITACORA_LEAD(${procedureParams.map(() => "?").join(", ")})`,
                procedureParams,
            );

            return {
                ok: true,
                statusCode: 200,
                ...rows,
            };
        } finally {
            await connection.query("SET time_zone = ?", [previousTimeZone]);
        }
    }, dataParams.database);

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
 * @param {string} dataParams.formattedDate - Fecha y hora de Costa Rica en que se realizó la acción (YYYY-MM-DD HH:mm:ss).
 * @param {string} dataParams.database - Nombre de la base de datos en la que se ejecutará el procedimiento almacenado.
 * @returns {Promise<Object>} - Devuelve una promesa que resuelve con el resultado de la ejecución del procedimiento almacenado.
 */
leads.updateLeadActionApi = (dataParams) =>
    executeStoredProcedure(
        "07_ACTUALIZAR_ACCION_LEAD_API", // Nombre del procedimiento almacenado que gestiona la actualización y registro de la bitácora.
        [
            dataParams.estadoActual, // Estado actual del lead.
            dataParams.valor_segimineto_lead, // Valor del seguimiento asociado al lead.
            dataParams.estado_lead, // Nuevo estado del lead a actualizar.
            dataParams.accion_lead, // Acción realizada sobre el lead.
            dataParams.seguimiento_calendar, // Información de seguimiento en el calendario.
            dataParams.valorDeCaida, // Valor relacionado con la caída del lead, si corresponde.
            dataParams.formattedDate, // Fecha y hora real de la acción realizada en Costa Rica.
            dataParams.leadId, // ID del lead que se está actualizando.
        ],
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );

/**
 * Obtiene las razones de pérdida (caídas) de leads desde la base de datos.
 *
 * Esta función ejecuta un procedimiento almacenado que recupera las razones por las que un lead
 * ha sido clasificado como perdido. El procedimiento utiliza un parámetro de estado específico para filtrar los resultados,
 * lo que permite consultar diferentes tipos de caídas según el valor proporcionado.
 *
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @param {number} dataParams.valueID - Valor que representa el estado específico de las caídas a filtrar.
 * @param {string} dataParams.database - Nombre de la base de datos en la que se ejecutará el procedimiento almacenado.
 * @returns {Promise<Object>} - Devuelve una promesa que resuelve con los resultados obtenidos del procedimiento almacenado.
 */
leads.loss_reasons = (dataParams) =>
    executeStoredProcedure(
        "12_MOTIVOS_PERDIDA", // Nombre del procedimiento almacenado que obtiene las razones de pérdida de leads.
        [
            dataParams.valueID, // Estado específico del lead para filtrar las razones de pérdida.
        ],
        dataParams.database, // Nombre de la base de datos en la que se ejecutará el procedimiento almacenado.
    );

/**
 * Ejecuta el procedimiento almacenado 'loss_transactions' para marcar todas las transacciones de un lead como perdidas.
 *
 * Esta función envía una solicitud para ejecutar el procedimiento almacenado en la base de datos proporcionada,
 * marcando todas las transacciones asociadas al lead como perdidas, utilizando el ID del lead como filtro.
 *
 * @param {Object} dataParams - Contiene los parámetros necesarios para ejecutar el procedimiento almacenado.
 * @param {number} dataParams.leadId - El ID del lead cuyas transacciones serán marcadas como perdidas.
 * @param {string} dataParams.database - El nombre de la base de datos donde se ejecutará el procedimiento almacenado.
 *
 * @returns {Promise<Object>} - Devuelve una promesa que resuelve con los resultados de la operación.
 */
leads.loss_transactions = (dataParams) =>
    executeStoredProcedure(
        "11_TRANSACCIONES_PERDIDAS", // Procedimiento almacenado que marca todas las transacciones de un lead como perdidas.
        [
            dataParams.leadId, // El ID del lead cuyas transacciones serán actualizadas.
            dataParams.descripcionEvento,
        ],
        dataParams.database, // Base de datos donde se ejecutará el procedimiento almacenado.
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
leads.getAllLeadsTotal = (dataParams) =>
    executeStoredProcedure(
        "36_OBTENER_TOTAL_LEADS", // Nombre del procedimiento almacenado que recupera los leads.
        [dataParams.rol_admin, dataParams.idnetsuite_admin, dataParams.startDate, dataParams.endDate, dataParams.filterOption], // Parámetros necesarios: rol, ID del administrador, fechas y opción de filtro.
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );

// Función para obtener la información de campañas desde la base de datos.
leads.getDataSelect_Campaing = (dataParams) =>
    executeStoredProcedure(
        "25_CONSULTAR_DATOS_CAMPAÑA", // Nombre del procedimiento almacenado encargado de recuperar los datos de campañas disponibles.
        [dataParams.p_estado], // Parámetro utilizado para filtrar las campañas según su estado (activo/inactivo).
        dataParams.database, // Nombre de la base de datos específica donde se ejecutará el procedimiento.
    );

// Función para obtener la información de proyectos desde la base de datos.
leads.getDataSelect_Proyect = (dataParams) =>
    executeStoredProcedure(
        "23_CONSULTAR_DATOS_PROYECTO", // Nombre del procedimiento almacenado encargado de recuperar los datos de los proyectos.
        [dataParams.p_estado], // Parámetro utilizado para filtrar los proyectos según su estado (activo/inactivo).
        dataParams.database, // Nombre de la base de datos específica donde se ejecutará el procedimiento.
    );

// Función para obtener la información de subsidiarias desde la base de datos.
leads.getDataSelect_Subsidiaria = (dataParams) =>
    executeStoredProcedure(
        "22_CONSULTAR_DATOS_SUBSIDIARIA", // Nombre del procedimiento almacenado encargado de recuperar los datos de subsidiarias.
        [dataParams.p_estado], // Parámetro utilizado para filtrar las subsidiarias según su estado (activo/inactivo).
        dataParams.database, // Nombre de la base de datos específica donde se ejecutará el procedimiento.
    );

// Función para obtener la información de administradores desde la base de datos.
leads.getDataSelect_Admins = (dataParams) =>
    executeStoredProcedure(
        "26_CONSULTAR_DATOS_ADMINISTRADORES", // Nombre del procedimiento almacenado encargado de recuperar los datos de los administradores.
        [dataParams.p_estado], // Parámetro utilizado para filtrar los administradores según su estado (activo/inactivo).
        dataParams.database, // Nombre de la base de datos específica donde se ejecutará el procedimiento.
    );

// Función para obtener la información de corredores desde la base de datos.
leads.getDataSelect_Corredor = (dataParams) =>
    executeStoredProcedure(
        "24_CONSULTAR_DATOS_CORREDOR", // Nombre del procedimiento almacenado encargado de recuperar los datos de corredores disponibles.
        [dataParams.p_estado], // Parámetro utilizado para filtrar los corredores según su estado (activo/inactivo).
        dataParams.database, // Nombre de la base de datos específica donde se ejecutará el procedimiento.
    );

// Función para insertar información adicional de un lead específico en la base de datos.
leads.insertInfo_extraLead = (idLead, corredor_value, database) => {
    return executeStoredProcedure(
        "13_INSERTAR_INFO_EXTRA_LEAD", // Nombre del procedimiento almacenado encargado de insertar información extra para un lead.
        [idLead, corredor_value], // Parámetros necesarios: id del lead e información del corredor asociada al lead.
        database, // Base de datos donde se ejecutará el procedimiento.
    );
};

// Función para obtener la información completa de un lead específico desde la base de datos.
leads.getDataInformations_Lead = (dataParams) => {
    return executeStoredProcedure(
        "27_OBTENER_INFORMACION_LEAD", // Nombre del procedimiento almacenado encargado de recuperar toda la información de un lead.
        [dataParams.leadId], // Parámetro requerido: id del lead para identificar el registro en la base de datos.
        dataParams.database, // Base de datos donde se ejecutará el procedimiento.
    );
};


leads.SP_OBTENER_LEADS_PERDIDOS_MINIMO_SEGUIMIENTO_API = (dataParams) => {
    return executeStoredProcedure(
        "SP_OBTENER_LEADS_PERDIDOS_MINIMO_SEGUIMIENTO", // Nombre del procedimiento almacenado encargado de recuperar toda la información de un lead.
        [dataParams.startDate, dataParams.endDate], // Parámetro requerido: id del lead para identificar el registro en la base de datos.
        dataParams.database, // Base de datos donde se ejecutará el procedimiento.
    );
};



// Función para obtener eventos de un lead específico
leads.eventos = (dataParams) => {
    const query = "SELECT * FROM calendars WHERE id_lead = ?"; // Consulta SQL para eventos de un lead
    const params = [dataParams.leadDetails]; // Parámetro id del lead

    return executeQuery(
        query, // Consulta SQL
        params, // Parámetros de la consulta
        dataParams.database // Base de datos donde se ejecuta
    );
};


// Función para obtener oportunidades de un lead específico
leads.oportunidades = (dataParams) => {
    const query = "SELECT * FROM oportunidades WHERE entity_oport= ?"; // Consulta SQL para obtener oportunidades de un lead
    const params = [dataParams.leadDetails]; // Parámetro id del lead

    return executeQuery(
        query, // Consulta SQL
        params, // Parámetros de la consulta
        dataParams.database, // Base de datos donde se ejecuta
    );
};

/**
 * Inactiva todas las oportunidades activas asociadas a un lead.
 *
 * @param {Object} dataParams - Parámetros necesarios para la actualización.
 * @param {number} dataParams.leadId - ID del lead cuyas oportunidades se inactivarán.
 * @param {string} dataParams.database - Base de datos donde se ejecutará la consulta.
 * @returns {Promise<Object>} Resultado de la actualización.
 */
leads.inactivateOpportunitiesByLead = (dataParams) =>
    handleDatabaseOperation(async (connection) => {
        await connection.beginTransaction();

        try {
            const results = await inactivateLeadOpportunitiesWithTraceability(connection, {
                leadId: dataParams.leadId,
                reason: dataParams.reason || "SISTEMA_OTRO",
                actorId: dataParams.idnetsuite_admin,
                actorType: dataParams.actorType || (dataParams.idnetsuite_admin ? "USUARIO" : "SISTEMA"),
                source: dataParams.source || "LEAD_FLOW",
                detail: dataParams.detail || null,
            });

            await connection.commit();

            return {
                ok: true,
                statusCode: 200,
                data: results,
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    }, dataParams.database);


// Función `updateOpportunity_Status`:
// Esta función actualiza el estado de un lead (cliente) en la base de datos, basado en los datos proporcionados.
// Recibe un objeto `dataParams` con los siguientes atributos:
// - `estado`: El nuevo estado que se asignará al lead (e.g., "activo", "inactivo").
// - `idCliente`: El ID del cliente cuyo estado se actualizará.
// - `database`: La base de datos objetivo donde se realizará la actualización.

leads.update_LeadStatus = (dataParams) => {
    // Consulta SQL para actualizar el estado del lead en la tabla `leads`.
    const query = "UPDATE leads SET estado_lead = ? WHERE idinterno_lead = ?";

    // Parámetros para la consulta SQL, incluyendo el nuevo estado y el ID del cliente.
    const params = [dataParams.estado, dataParams.idCliente];

    // Ejecuta la consulta con los parámetros especificados y la base de datos proporcionada.
    return executeQuery(
        query, // La consulta SQL a ejecutar.
        params, // Array de parámetros para la consulta SQL.
        dataParams.database, // La base de datos donde se realizará la consulta.
    );
};




module.exports = leads; // Exporta el objeto 'leads' que contiene todas las funciones definidas.
