const { executeStoredProcedure, handleDatabaseOperation } = require("../conectionPool/conectionPool");

const partner = {}; // Objeto para agrupar todas las funciones relacionadas con 'partner'.


/**
 * Crea una nueva partner desde la integración de NetSuite.
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros de la partner
 * @returns {Promise<Object>} - Resultado de la creación de la partner
 */
partner.crearpartner = async (dataParams) => {
    return new Promise((resolve, reject) => {
        try {

            executeStoredProcedure(
                "SP_CREAR_CORREDORES_NETSUITE", // Nombre del procedimiento almacenado que crea partners desde NetSuite.
                [
                    dataParams.id, // id_netsuiteCorredor
                    dataParams?.fields?.entitynumber || dataParams.id, // valoridNetsuite
                    dataParams?.companyName || dataParams?.fields?.companyname || "N/A", // nombre_corredor
                    "N/A", // categoria_corredor
                    "N/A", // empresa_corredor
                    "N/A", // telefono_corredor
                    "N/A", // correo__corredor
                ], // Parámetros para crear partner desde NetSuite.
                "produccion", // Nombre de la base de datos a utilizar.
            );
            console.log("result", "Se creo el partner desde NetSuite");
           

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


module.exports = partner; // Exporta el objeto 'partner' que contiene todas las funciones definidas.
