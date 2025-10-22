const { executeStoredProcedure, handleDatabaseOperation } = require("../conectionPool/conectionPool");

const partner = {}; // Objeto para agrupar todas las funciones relacionadas con 'partner'.


/**
 * Crea un nuevo corredor desde la integración de NetSuite.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros del corredor
 * @returns {Promise<Object>} - Resultado de la creación del corredor
 */
partner.crearpartner = async (dataParams) => {
    return new Promise((resolve, reject) => {
        try {

            executeStoredProcedure(
                "SP_CREAR_CORREDORES_NETSUITE", // Nombre del procedimiento almacenado que crea corredores desde NetSuite
                [
                    dataParams.id, // id_netsuiteCorredor - ID del corredor en NetSuite
                    dataParams?.fields?.entitynumber || dataParams.id, // valoridNetsuite - Número de entidad en NetSuite
                    dataParams?.companyName || dataParams?.fields?.companyname || "N/A", // nombre_corredor - Nombre del corredor
                    "N/A", // categoria_corredor - Categoría del corredor (no disponible)
                    "N/A", // empresa_corredor - Empresa del corredor (no disponible)
                    "N/A", // telefono_corredor - Teléfono del corredor (no disponible)
                    "N/A", // correo__corredor - Correo del corredor (no disponible)
                ], // Parámetros para crear corredor desde NetSuite
                "produccion" // Nombre de la base de datos a utilizar
            );

            return "ok"

        } catch (error) {
            console.error("❌ Error al crear partner:", error);
            reject({
                statusCode: 500,
                message: "Error al crear la partner",
                error: error.message
            });
        }
    });
};


/**
 * Actualiza un corredor existente desde la integración de NetSuite.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros del corredor a actualizar
 * @returns {Promise<Object>} - Resultado de la actualización del corredor
 */
partner.editarpartner = async (dataParams) => {
    return new Promise((resolve, reject) => {
        try {
            executeStoredProcedure(
                "SP_ACTUALIZAR_NOMBRE_CORREDOR_NETSUITE",
                [
                    parseInt(dataParams.id),        // 🟢 ID del corredor (primer parámetro)
                    dataParams?.companyName || "",  // 🟢 Nuevo nombre (segundo parámetro)
                ],
                "produccion"
            );
             return "ok"
           
        } catch (error) {
            console.error("❌ Error al editar partner:", error);
            reject({
                statusCode: 500,
                message: "Error al editar la partner",
                error: error.message
            });
        }
    });
};

module.exports = partner; // Exporta el objeto 'partner' que contiene todas las funciones definidas.
