const { executeStoredProcedure } = require("../conectionPool/conectionPool");

const leads = {}; // Objeto para agrupar todas las funciones relacionadas con 'leads'.



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
            dataParams.leadId, // ID del lead que se está manejando.
            dataParams.idnetsuite_admin, // ID del administrador que realiza la acción.
            dataParams.valorDeCaida, // Valor asociado al progreso o caída del lead.
            dataParams.descripcionEvento, // Descripción del evento o acción realizada.
            dataParams.tipo, // Tipo de evento (ejemplo: seguimiento, reserva, etc.).
            dataParams.estadoActual, // Estado actual del lead, validado previamente.
        ],
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
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
            dataParams.estadoActual, // Estado actual del lead.
            dataParams.valor_segimineto_lead, // Valor del seguimiento asociado al lead.
            dataParams.estado_lead, // Nuevo estado del lead a actualizar.
            dataParams.accion_lead, // Acción realizada sobre el lead.
            dataParams.seguimiento_calendar, // Información de seguimiento en el calendario.
            dataParams.valorDeCaida, // Valor relacionado con la caída del lead, si corresponde.
            dataParams.formattedDate, // Fecha formateada de la acción realizada (YYYY-MM-DD).
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
        "loss_reasons", // Nombre del procedimiento almacenado que obtiene las razones de pérdida de leads.
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
        "loss_transactions", // Procedimiento almacenado que marca todas las transacciones de un lead como perdidas.
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
        "getAllLeadsTotal", // Nombre del procedimiento almacenado que recupera los leads.
        [dataParams.rol_admin, dataParams.idnetsuite_admin, dataParams.startDate, dataParams.endDate, dataParams.filterOption], // Parámetros necesarios: rol, ID del administrador, fechas y opción de filtro.
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );

// Función para obtener la información de campañas desde la base de datos.
leads.getDataSelect_Campaing = (dataParams) =>
    executeStoredProcedure(
        "getDataSelect_Campaing", // Nombre del procedimiento almacenado encargado de recuperar los datos de campañas disponibles.
        [dataParams.p_estado], // Parámetro utilizado para filtrar las campañas según su estado (activo/inactivo).
        dataParams.database, // Nombre de la base de datos específica donde se ejecutará el procedimiento.
    );

// Función para obtener la información de proyectos desde la base de datos.
leads.getDataSelect_Proyect = (dataParams) =>
    executeStoredProcedure(
        "getDataSelect_Proyect", // Nombre del procedimiento almacenado encargado de recuperar los datos de los proyectos.
        [dataParams.p_estado], // Parámetro utilizado para filtrar los proyectos según su estado (activo/inactivo).
        dataParams.database, // Nombre de la base de datos específica donde se ejecutará el procedimiento.
    );

// Función para obtener la información de subsidiarias desde la base de datos.
leads.getDataSelect_Subsidiaria = (dataParams) =>
    executeStoredProcedure(
        "getDataSelect_Subsidiaria", // Nombre del procedimiento almacenado encargado de recuperar los datos de subsidiarias.
        [dataParams.p_estado], // Parámetro utilizado para filtrar las subsidiarias según su estado (activo/inactivo).
        dataParams.database, // Nombre de la base de datos específica donde se ejecutará el procedimiento.
    );

// Función para obtener la información de administradores desde la base de datos.
leads.getDataSelect_Admins = (dataParams) =>
    executeStoredProcedure(
        "getDataSelect_Admins", // Nombre del procedimiento almacenado encargado de recuperar los datos de los administradores.
        [dataParams.p_estado], // Parámetro utilizado para filtrar los administradores según su estado (activo/inactivo).
        dataParams.database, // Nombre de la base de datos específica donde se ejecutará el procedimiento.
    );

// Función para obtener la información de corredores desde la base de datos.
leads.getDataSelect_Corredor = (dataParams) =>
    executeStoredProcedure(
        "getDataSelect_Corredor", // Nombre del procedimiento almacenado encargado de recuperar los datos de corredores disponibles.
        [dataParams.p_estado], // Parámetro utilizado para filtrar los corredores según su estado (activo/inactivo).
        dataParams.database, // Nombre de la base de datos específica donde se ejecutará el procedimiento.
    );

// Función para insertar información adicional de un lead específico en la base de datos.
leads.insertInfo_extraLead = (idLead, corredor_value, database) => {
    return executeStoredProcedure(
        "insertInfo_extraLead", // Nombre del procedimiento almacenado encargado de insertar información extra para un lead.
        [idLead, corredor_value], // Parámetros necesarios: id del lead e información del corredor asociada al lead.
        database, // Base de datos donde se ejecutará el procedimiento.
    );
};

// Función para obtener la información completa de un lead específico desde la base de datos.
leads.getDataInformations_Lead = (dataParams) => {
    return executeStoredProcedure(
        "getDataInformations_Lead", // Nombre del procedimiento almacenado encargado de recuperar toda la información de un lead.
        [dataParams.leadId], // Parámetro requerido: id del lead para identificar el registro en la base de datos.
        dataParams.database, // Base de datos donde se ejecutará el procedimiento.
    );
};


module.exports = leads; // Exporta el objeto 'leads' que contiene todas las funciones definidas.
