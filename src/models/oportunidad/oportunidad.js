const { executeStoredProcedure } = require("../conectionPool/conectionPool");

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





    

module.exports = oportunidad; // Exporta el objeto 'oportunidad' que agrupa las funciones relacionadas con ubicaciones.
