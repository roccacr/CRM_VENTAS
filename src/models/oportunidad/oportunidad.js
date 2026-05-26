const { executeStoredProcedure, executeQuery } = require("../conectionPool/conectionPool");
const {
    buildUpdateOpportunityProbabilityParams,
    buildUpdateOpportunityProbabilityQuery,
    buildUpdateOpportunityStatusParams,
    buildUpdateOpportunityStatusQuery,
    supportsInactivationReasonColumn,
    supportsLessProbableTrackingColumn,
} = require("./lessProbableTracking");

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
oportunidad.updateOpportunity_Probability = async (dataParams) => {
    const supportsTrackingColumn = await supportsLessProbableTrackingColumn(dataParams.database);
    const query = buildUpdateOpportunityProbabilityQuery(supportsTrackingColumn);
    const params = buildUpdateOpportunityProbabilityParams(
        dataParams.probabilidad,
        dataParams.idOportunidad,
        supportsTrackingColumn,
    );

    return executeQuery(query, params, dataParams.database);
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
oportunidad.updateOpportunity_Status = async (dataParams) => {
    const supportsReasonColumn = await supportsInactivationReasonColumn(dataParams.database);
    const query = buildUpdateOpportunityStatusQuery(supportsReasonColumn);
    const params = buildUpdateOpportunityStatusParams(
        dataParams.estado,
        dataParams.idOportunidad,
        supportsReasonColumn,
        dataParams.motivoInactivacion || "MANUAL",
    );

    return executeQuery(query, params, dataParams.database);
};

// Función para obtener oportunidades basadas en parámetros de filtrado
oportunidad.get_Oportunidades = (dataParams) => {

    

    // Determinar filtro adicional basado en BotonesEstados
    const estadoFiltro =
        {
            1: "and p.estatus_oport = 1 AND chek_oport = 1", 
            2: "",
            5: "and estatus_oport = 0",
            6: "and estatus_oport = 1", 
            7: "", 
            10: "and p.estatus_oport = 1 AND chek_oport=0",
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
         ${dataParams.leadAsignado !== '0' 
            ? `WHERE entity_oport = ${dataParams.leadAsignado} ${estadoFiltro} ${dateFilter}`
            : dataParams.rol_admin === 2 
                ? `WHERE employee_oport = ${dataParams.idnetsuite_admin} ${estadoFiltro} ${dateFilter}`
                : dataParams.rol_admin === 1
                    ? `WHERE 1=1 ${estadoFiltro} ${dateFilter}`
                    : `WHERE employee_oport = ${dataParams.idnetsuite_admin} ${estadoFiltro} ${dateFilter}`}
    `;



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

    // // Calculate date 3 days before today in Costa Rica timezone
    // const today = new Date();
    // const threeDaysAgo = new Date(today);
    // threeDaysAgo.setDate(today.getDate() - 3);
    
    // // Format the date as YYYY-MM-DD HH:mm:ss
    // const formattedDate = threeDaysAgo.toISOString().slice(0, 19).replace('T', ' ');

    // // SQL query to update the opportunity status based on the provided probability
    // const query2 = "UPDATE expedientes SET estado_exp=?, fecha_mod = ? WHERE ID_interno_expediente = ?";  

    // // Parameters for the query, including the new probability and the opportunity ID
    // const params2 = ["0. No Disponible", formattedDate, dataParams.formValues.expediente];

    // // Executes the query with the specified parameters and database
    // const result2 = executeQuery(
    //     query2, // The SQL query to be executed
    //     params2, // Array of parameters for the query
    //     dataParams.database, // Target database for the query
    // );

    return result;
};

/**
 * Función para editar una oportunidad existente.
 * @async
 * @param {object} dataParams - Objeto que contiene los datos a actualizar y el ID de la oportunidad.
 * @returns {Promise} - Promesa que resuelve con el resultado de la actualización.
 */
oportunidad.editarOportunidad = async (dataParams) => {


    try {
        // Extrae los datos del formulario y el ID de la oportunidad
        // Los datos vienen en dataParams.formData o directamente en dataParams
        const formData = dataParams.formData || {};
        const {
            estado = dataParams.estado,
            probabilidad = dataParams.probabilidad,
            detalles = dataParams.detalles,
            motivoCondicion = dataParams.motivoCondicion,
            motivoCompra = dataParams.motivoCompra,
            metodoPago = dataParams.metodoPago,
        } = formData;

        const idOportunidad = dataParams.idOportunidad;



        // Consulta SQL para actualizar la oportunidad
        const query = `
            UPDATE oportunidades SET
                entitystatus_oport = ?,
                probability_oport = ?,
                memo_oport = ?,
                Motico_Condicion = ?,
                custbody76_oport = ?,
                custbody75_oport = ?,
                update_fecha_oport = NOW()
            WHERE id_oportunidad_oport = ?
        `;

        // Parámetros para la consulta
        const params = [
            estado,
            probabilidad,
            detalles,
            motivoCondicion,
            motivoCompra,
            metodoPago,
            idOportunidad,
        ];


        // Ejecuta la consulta con los parámetros especificados y espera el resultado
        const result = await executeQuery(
            query, // Consulta SQL a ejecutar
            params, // Array de parámetros para la consulta
            dataParams.database, // Base de datos destino para la consulta
        );



        return result;
    } catch (error) {
        console.error("Error en editarOportunidad:", error);
        throw error;
    }
};


/**
 * Valida la disponibilidad de un expediente de unidad consultando:
 * - Oportunidades activas (estatus_oport = 1) separadas por chek_oport (1 y 0)
 * - Estimaciones activas (status = 1)
 * - Órdenes de venta activas (status_ov = 1)
 * 
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @param {number} dataParams.idExpediente - ID del expediente de unidad a validar.
 * @param {string} dataParams.database - Nombre de la base de datos a utilizar.
 * @returns {Promise<Object>} - Objeto con los conteos de oportunidades, estimaciones y órdenes de venta.
 */
oportunidad.validarDisponibilidad = async (dataParams) => {
    try {
        const { idExpediente, database } = dataParams;

        // Consulta 1: Contar oportunidades activas con chek_oport = 1
        const queryOportunidadesChek1 = `
            SELECT COUNT(*) as total 
            FROM oportunidades 
            WHERE exp_custbody38_oport = ? 
            AND estatus_oport = 1 
            AND chek_oport = 1
        `;

        // Consulta 2: Contar oportunidades activas con chek_oport = 0
        const queryOportunidadesChek0 = `
            SELECT COUNT(*) as total 
            FROM oportunidades 
            WHERE exp_custbody38_oport = ? 
            AND estatus_oport = 1 
            AND chek_oport = 0
        `;

        // Consulta 3: Contar estimaciones activas
        const queryEstimaciones = `
            SELECT COUNT(*) as total 
            FROM estimaciones 
            WHERE idExpediente_est = ? 
            AND status = 1
        `;

        // Consulta 4: Contar órdenes de venta activas
        const queryOrdenVenta = `
            SELECT COUNT(*) as total 
            FROM ordenventa 
            WHERE idExpediente_ov = ? 
            AND status_ov = 1
        `;

        // Ejecutar todas las consultas en paralelo
        const [resultOportunidadesChek1, resultOportunidadesChek0, resultEstimaciones, resultOrdenVenta] = await Promise.all([
            executeQuery(queryOportunidadesChek1, [idExpediente], database),
            executeQuery(queryOportunidadesChek0, [idExpediente], database),
            executeQuery(queryEstimaciones, [idExpediente], database),
            executeQuery(queryOrdenVenta, [idExpediente], database),
        ]);

        // Extraer los valores de conteo de cada resultado (executeQuery retorna { ok, statusCode, data })
        const oportunidadesChek1 = resultOportunidadesChek1?.data?.[0]?.total || 0;
        const oportunidadesChek0 = resultOportunidadesChek0?.data?.[0]?.total || 0;
        const estimaciones = resultEstimaciones?.data?.[0]?.total || 0;
        const ordenVenta = resultOrdenVenta?.data?.[0]?.total || 0;

        // Retornar el objeto con todos los conteos
        return {
            oportunidades: {
                total: oportunidadesChek1 + oportunidadesChek0,
                chek1: oportunidadesChek1,
                chek0: oportunidadesChek0,
            },
            estimaciones: {
                total: estimaciones,
            },
            ordenVenta: {
                total: ordenVenta,
            },
        };
    } catch (error) {
        console.error("Error al validar disponibilidad del expediente:", error);
        throw error;
    }
};

module.exports = oportunidad; // Exporta el objeto 'oportunidad' que agrupa las funciones relacionadas con ubicaciones.
