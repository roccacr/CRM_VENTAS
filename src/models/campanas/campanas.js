const { executeStoredProcedure, handleDatabaseOperation } = require("../conectionPool/conectionPool");

const campana = {}; // Objeto para agrupar todas las funciones relacionadas con 'campana'.


/**
 * Crea una nueva campaña desde la integración de NetSuite.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros de la campaña
 * @returns {Promise<Object>} - Resultado de la creación de la campaña
 */
campana.crearCampana = async (dataParams) => {
    try {
        const result = await executeStoredProcedure(
            "SP_CREAR_CAMPANAS_NETSUITE", // Nombre del procedimiento almacenado que recupera los banners.
            [dataParams.id, dataParams.titulo], // Parámetros que identifican el rol y el ID del usuario.
            "produccion", // Nombre de la base de datos a utilizar.
        );
        return {
            status: "ok",
            message: "Campaña creada exitosamente",
            ...result
        };
    } catch (error) {
        console.error("❌ Error al crear campaña:", error);
        throw {
            statusCode: 500,
            message: "Error al crear la campaña",
            error: error.message
        };
    }
};
campana.editarCampana = async (dataParams) => {
    try {
        // Validar existencia de la campaña
        const campanaExistente = await campana.consultarCampanas(dataParams.id);

        console.log("campanaExistente", campanaExistente);

        // Verificar si la campaña existe (el resultado está en el índice 0 del array)
        const existeCampana = campanaExistente[0] && Array.isArray(campanaExistente[0]) && campanaExistente[0].length > 0;

        if (existeCampana) {
            // Si existe, actualizar la campaña
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
            // Si no existe, crear la campaña
            console.log("Campaña no encontrada, creando nueva campaña...");
            const result = await campana.crearCampana(dataParams);
            
            return {
                status: "ok",
                message: "Campaña creada exitosamente",
                ...result
            };
        }

    } catch (error) {
        console.error("❌ Error al editar campaña:", error);

        throw {
            statusCode: 500,
            message: "Error al editar la campaña",
            error: error.message
        };
    }
};


campana.consultarCampanas = async (id) => {
    try {
        const result = await executeStoredProcedure(
            "SP_CONSULTAR_CAMPANAS_NETSUITE",
            [
                parseInt(id), // ID Netsuite de la campaña
            ],
            "produccion"
        );

        return result; 
    } catch (error) {
        console.error("❌ Error al consultar campaña:", error);
        throw {
            statusCode: 500,
            message: "Error al consultar la campaña",
            error: error.message
        };
    }
};


module.exports = campana; // Exporta el objeto 'campana' que contiene todas las funciones definidas.
