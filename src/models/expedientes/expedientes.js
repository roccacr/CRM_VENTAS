const { executeStoredProcedure } = require("../conectionPool/conectionPool");

const expedientes = {}; // Objeto para agrupar todas las funciones relacionadas con 'expedientes'.



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
