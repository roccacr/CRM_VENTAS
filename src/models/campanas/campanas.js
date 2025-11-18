const { executeStoredProcedure, handleDatabaseOperation } = require("../conectionPool/conectionPool");

const campana = {}; // Objeto para agrupar todas las funciones relacionadas con 'campana'.

/**
 * Crea una nueva campaña desde la integración de NetSuite.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros de la campaña
 * @param {number} dataParams.id - ID de la campaña
 * @param {string} dataParams.titulo - Título de la campaña
 * @returns {Promise<Object>} - Resultado de la creación de la campaña
 */
campana.crearCampana = async (dataParams) => {
    return new Promise((resolve, reject) => {
        try {
            executeStoredProcedure(
                "SP_CREAR_CAMPANAS_NETSUITE",
                [dataParams.id, dataParams.titulo],
                "produccion",
                (error, result) => {
                    if (error) {
                        console.error("❌ Error al crear campaña:", error);
                        reject({
                            statusCode: 500,
                            message: "Error al crear la campaña",
                            error: error.message
                        });
                    } else {
                        resolve({
                            statusCode: 201,
                            message: "Campaña creada exitosamente",
                            data: result
                        });
                    }
                }
            );
        } catch (error) {
            console.error("❌ Error al crear campaña:", error);
            reject({
                statusCode: 500,
                message: "Error al crear la campaña",
                error: error.message
            });
        }
    });
};

/**
 * Actualiza o crea una campaña (UPSERT).
 * Primero valida si la campaña existe, si existe la actualiza, si no la crea.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros de la campaña
 * @param {number} dataParams.id - ID de la campaña
 * @param {string} dataParams.titulo - Título de la campaña
 * @returns {Promise<Object>} - Resultado de la operación (creación o actualización)
 */
campana.editarCampana = async (dataParams) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Primero validar si la campaña existe
            const campanaExistente = await campana.consultarCampanas({ id: dataParams.id });

            console.log("campanaExistente", campanaExistente);

            if (campanaExistente && campanaExistente.length > 0) {
                // Si existe, actualizar
                executeStoredProcedure(
                    "SP_ACTUALIZAR_NOMBRE_CAMPANA_NETSUITE",
                    [
                        parseInt(dataParams.id),
                        dataParams.titulo || "",
                    ],
                    "produccion",
                    (error, result) => {
                        if (error) {
                            console.error("❌ Error al editar campaña:", error);
                            reject({
                                statusCode: 500,
                                message: "Error al editar la campaña",
                                error: error.message
                            });
                        } else {
                            resolve({
                                statusCode: 200,
                                message: "Campaña actualizada exitosamente",
                                data: result,
                                operacion: "actualizar"
                            });
                        }
                    }
                );
            } else {
                // Si no existe, crear
                campana.crearCampana(dataParams)
                    .then(result => {
                        resolve({
                            ...result,
                            operacion: "crear"
                        });
                    })
                    .catch(error => {
                        reject(error);
                    });
            }
        } catch (error) {
            console.error("❌ Error en editarCampana:", error);
            reject({
                statusCode: 500,
                message: "Error al procesar la campaña",
                error: error.message
            });
        }
    });
};

campana.consultarCampanas = async (dataParams) => {
    return new Promise((resolve, reject) => {
        try {
            handleDatabaseOperation(
                "SP_CONSULTAR_CAMPANAS_NETSUITE",
                [parseInt(dataParams.id)],
                "produccion",
                (error, result) => {

                    console.log("result", result);
                    if (error) {
                        reject({
                            statusCode: 500,
                            message: "Error al consultar la campaña",
                            error: error.message
                        });
                    } else {
                        resolve(result);
                    }
                }
            );
        } catch (error) {
            reject({
                statusCode: 500,
                message: "Error al consultar la campaña",
                error: error.message
            });
        }
    });
};




module.exports = campana; // Exporta el objeto 'campana' que contiene todas las funciones definidas.
