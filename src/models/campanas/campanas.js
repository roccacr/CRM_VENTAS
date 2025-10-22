const { executeStoredProcedure, handleDatabaseOperation } = require("../conectionPool/conectionPool");

const campana = {}; // Objeto para agrupar todas las funciones relacionadas con 'campana'.


/**
 * Crea una nueva campaña desde la integración de NetSuite.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros de la campaña
 * @returns {Promise<Object>} - Resultado de la creación de la campaña
 */
campana.crearCampana = async (dataParams) => {
    return new Promise((resolve, reject) => {
        try {
            executeStoredProcedure(
                "SP_CREAR_CAMPANAS_NETSUITE", // Nombre del procedimiento almacenado que recupera los banners.
                [dataParams.id, dataParams.titulo], // Parámetros que identifican el rol y el ID del usuario.
                "produccion", // Nombre de la base de datos a utilizar.
            );
            console.log("result", "Se creo la campaña desde NetSuite");

            return "ok"
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


module.exports = campana; // Exporta el objeto 'campana' que contiene todas las funciones definidas.
