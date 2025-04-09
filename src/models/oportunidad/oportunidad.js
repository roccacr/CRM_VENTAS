const { executeStoredProcedure, executeQuery } = require("../conectionPool/conectionPool");

const oportunidad = {}; // Objeto que agrupa las funciones relacionadas con 'oportunidad'.

/**
 * Obtiene todas las ubicaciones de la base de datos mediante un procedimiento almacenado.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de ubicaciones.
 */
oportunidad.getUbicaciones = (dataParams) =>
    executeStoredProcedure(
        "20_OBTENER_UBICACIONES", // Nombre del procedimiento almacenado que recupera las ubicaciones.
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
        "29_OBTENER_CLASES", // Nombre del procedimiento almacenado que recupera las ubicaciones.
        [dataParams.idClases], // Parámetros para identificar la clases.
        dataParams.database, // Nombre de la base de datos a utilizar.
    );

/**
 * Obtiene todas las clases de la base de datos mediante un procedimiento almacenado.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @returns {Promise<Object>} - Resultado de la consulta de clases.
 */
oportunidad.getSpecificOportunidad = (dataParams) =>
    executeStoredProcedure(
        "38_EXTARER_INOFORMACION_OPORTUINIDAD", // Nombre del procedimiento almacenado que recupera las ubicaciones.
        [dataParams.oportunidad], // Parámetros para identificar la clases.
        dataParams.database, // Nombre de la base de datos a utilizar.
    );

/**
 * Actualiza la probabilidad de una oportunidad en la base de datos.
 *
 * @param {Object} dataParams - Objeto con los parámetros necesarios para la actualización.
 * @param {number} dataParams.probabilidad - Nueva probabilidad de la oportunidad.
 * @param {number} dataParams.idOportunidad - ID de la oportunidad a actualizar.
 * @param {string} dataParams.database - Base de datos donde se ejecuta la consulta.
 * @returns {Promise} Resultado de la ejecución de la consulta.
 */
oportunidad.updateOpportunity_Probability = (dataParams) => {
    // Consulta SQL para actualizar la probabilidad y otro indicador de la oportunidad
    const query = "UPDATE oportunidades SET chek_oport = ?, chek2_oport = ? WHERE id_oportunidad_oport  = ?";
    const params = [dataParams.probabilidad, 1, dataParams.idOportunidad];

    // Ejecuta la consulta con los parámetros y la base de datos especificada
    return executeQuery(
        query, // Consulta SQL a ejecutar
        params, // Parámetros de la consulta
        dataParams.database, // Base de datos donde se ejecuta
    );
};

/**
 * Updates the status of an opportunity in the database.
 *
 * @param {Object} dataParams - Object containing the parameters for the update.
 * @param {number} dataParams.probabilidad - New probability value to update the opportunity with.
 * @param {number} dataParams.idOportunidad - ID of the opportunity to update.
 * @param {string} dataParams.database - Name of the database where the query should be executed.
 * @returns {Promise} - Promise representing the result of the query execution.
 */
oportunidad.updateOpportunity_Status = (dataParams) => {
    // SQL query to update the opportunity status based on the provided probability
    const query = "UPDATE oportunidades SET estatus_oport = ? WHERE id_oportunidad_oport = ?";

    // Parameters for the query, including the new probability and the opportunity ID
    const params = [dataParams.estado, dataParams.idOportunidad];

    // Executes the query with the specified parameters and database
    return executeQuery(
        query, // The SQL query to be executed
        params, // Array of parameters for the query
        dataParams.database, // Target database for the query
    );
};

// Función para obtener oportunidades basadas en parámetros de filtrado
oportunidad.get_Oportunidades = (dataParams) => {

    console.log("datos para obtener oportunidades", dataParams);

    // Determinar filtro adicional basado en BotonesEstados
    const estadoFiltro =
        {
            1: "and p.estatus_oport = 1 AND chek_oport = 1", 
            2: "",
            5: "and estatus_oport = 0",
            6: "and estatus_oport = 1", 
            7: "", 
        }[dataParams.BotonesEstados] || ""; // Si no se encuentra en los casos anteriores, no aplica filtro

    // Seleccionar campo de fecha según el modo
    const dateField = dataParams.isMode === 1 ? "fecha_creada_oport" : "fecha_Condicion";

    // Ajustar el formato de la fecha según el modo
    let startDate = dataParams.startDate;
    let endDate = dataParams.endDate;

    // Verificar si ambas fechas están vacías
    if (startDate === "" && endDate === "") {
        dateFilter = "";
    } else {
        if (dataParams.isMode === 2) {
            startDate += " 00:00:00";
            endDate += " 23:59:59";
        }

        // Verificar el campo de fecha para aplicar el formato correcto
        const dateFormat = dateField === "fecha_Condicion" ? '%Y-%m-%d' : '%Y-%m-%d %H:%i:%s';

        dateFilter = `
            AND ${dateField} >= STR_TO_DATE("${startDate}", '${dateFormat}')
            AND ${dateField} < STR_TO_DATE("${endDate}", '${dateFormat}')
        `;
    }


    // Construir la consulta SQL
    const query = `
        SELECT
            p.chek2_oport,
            p.chek_oport,
            p.entitystatus_oport,
            p.tranid_oport,
            p.entity_oport,
            p.id_oportunidad_oport,
            p.exp_custbody38_oport,
            p.Motico_Condicion,
            p.fecha_Condicion,
            p.fecha_creada_oport,
            l.nombre_lead,
            l.proyecto_lead,
            l.campana_lead,
            exp.precioVentaUncio_exp,
            exp.precioDeVentaMinimo,
            exp.codigo_exp,
            admins.name_admin,
            compras.nombre_motivo_compra,
            pagos.nombre_motivo_pago
        FROM
            oportunidades AS p
        INNER JOIN leads AS l ON l.idinterno_lead = p.entity_oport
        INNER JOIN expedientes AS exp ON exp.ID_interno_expediente = p.exp_custbody38_oport
        INNER JOIN admins ON p.employee_oport = admins.idnetsuite_admin
        INNER JOIN compras ON p.custbody76_oport = compras.id_motivo_compra
        INNER JOIN pagos ON p.custbody75_oport = pagos.id_motivo_pago
        WHERE ${dataParams.leadAsignado !== '0' 
            ? `entity_oport = ${dataParams.leadAsignado} ${estadoFiltro} ${dateFilter}`
            : `employee_oport = ${dataParams.idnetsuite_admin} ${estadoFiltro} ${dateFilter}`}
    `;
    console.log("query", query);

    // Parámetros para la consulta
    const params = [dataParams.idnetsuite_admin];

    // Ejecutar la consulta SQL
    return executeQuery(query, params, dataParams.database);
};


oportunidad.updateEstadoOportunidad = (dataParams) => {
    

    // SQL query to update the opportunity status based on the provided probabilit      
    const query = "UPDATE oportunidades SET Motico_Condicion = ? WHERE id_oportunidad_oport = ?";  

    // Parameters for the query, including the new probability and the opportunity ID
    const params = [dataParams.formValues.motivoCondicion, dataParams.detalleOportunidad.id];

    // Executes the query with the specified parameters and database
    const result = executeQuery(
        query, // The SQL query to be executed
        params, // Array of parameters for the query
        dataParams.database, // Target database for the query
    );

    // Calculate date 3 days before today in Costa Rica timezone
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    
    // Format the date as YYYY-MM-DD HH:mm:ss
    const formattedDate = threeDaysAgo.toISOString().slice(0, 19).replace('T', ' ');

    // SQL query to update the opportunity status based on the provided probability
    const query2 = "UPDATE expedientes SET estado_exp=?, fecha_mod = ? WHERE ID_interno_expediente = ?";  

    // Parameters for the query, including the new probability and the opportunity ID
    const params2 = ["0. No Disponible", formattedDate, dataParams.formValues.expediente];

    // Executes the query with the specified parameters and database
    const result2 = executeQuery(
        query2, // The SQL query to be executed
        params2, // Array of parameters for the query
        dataParams.database, // Target database for the query
    );

    return result;
};


module.exports = oportunidad; // Exporta el objeto 'oportunidad' que agrupa las funciones relacionadas con ubicaciones.
