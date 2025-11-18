const { executeStoredProcedure, handleDatabaseOperation } = require("../conectionPool/conectionPool");

/**
 * Módulo para gestionar campañas de marketing sincronizadas desde NetSuite
 */
const campana = {};

/**
 * Crea una nueva campaña en la base de datos
 * @param {Object} dataParams - Datos de la campaña
 * @param {number|string} dataParams.id - ID de la campaña en NetSuite
 * @param {string} dataParams.titulo - Nombre de la campaña
 * @returns {Promise<Object>} Resultado de la operación
 */
campana.crearCampana = async (dataParams) => {
    try {
        const result = await executeStoredProcedure(
            "SP_CREAR_CAMPANAS_NETSUITE",
            [dataParams.id, dataParams.titulo],
            "produccion"
        );

        return {
            status: "ok",
            message: "Campaña creada exitosamente",
            ...result
        };
    } catch (error) {
        throw {
            statusCode: 500,
            message: "Error al crear la campaña",
            error: error.message
        };
    }
};

/**
 * Edita una campaña existente o la crea si no existe
 * @param {Object} dataParams - Datos de la campaña
 * @param {number|string} dataParams.id - ID de la campaña en NetSuite
 * @param {string} [dataParams.titulo=""] - Nombre de la campaña
 * @returns {Promise<Object>} Resultado de la operación
 */
campana.editarCampana = async (dataParams) => {
    try {
        // Consulta si la campaña existe
        const campanaExistente = await campana.consultarCampanas(dataParams.id);

        // Verifica si encontró resultados (el array en el índice 0 tiene elementos)
        const existeCampana = campanaExistente[0] && 
                             Array.isArray(campanaExistente[0]) && 
                             campanaExistente[0].length > 0;

        if (existeCampana) {
            // Si existe, actualiza el nombre
            const result = await executeStoredProcedure(
                "SP_ACTUALIZAR_NOMBRE_CAMPANA_NETSUITE",
                [
                    parseInt(dataParams.id), 
                    dataParams.titulo || "",
                ],
                "produccion"
            );

            return {
                status: "ok",
                message: "Campaña actualizada exitosamente",
                ...result
            };
        } else {
            // Si no existe, crea una nueva
            const result = await campana.crearCampana(dataParams);
            
            return {
                status: "ok",
                message: "Campaña creada exitosamente",
                ...result
            };
        }

    } catch (error) {
        throw {
            statusCode: 500,
            message: "Error al editar la campaña",
            error: error.message
        };
    }
};

/**
 * Consulta una campaña por su ID de NetSuite
 * @param {number|string} id - ID de la campaña en NetSuite
 * @returns {Promise<Object>} Resultado de la consulta (resultado[0] contiene los registros)
 */
campana.consultarCampanas = async (id) => {
    try {
        const result = await executeStoredProcedure(
            "SP_CONSULTAR_CAMPANAS_NETSUITE",
            [parseInt(id)],
            "produccion"
        );

        return result; 
    } catch (error) {
        throw {
            statusCode: 500,
            message: "Error al consultar la campaña",
            error: error.message
        };
    }
};

module.exports = campana;
