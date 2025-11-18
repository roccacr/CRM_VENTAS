const { executeStoredProcedure, handleDatabaseOperation } = require("../conectionPool/conectionPool");

/**
 * Módulo para gestionar corredores (partners) sincronizados desde NetSuite
 */
const partner = {};

/**
 * Crea un nuevo corredor en la base de datos
 * @param {Object} dataParams - Datos del corredor
 * @param {number|string} dataParams.id - ID del corredor en NetSuite
 * @param {string} [dataParams.companyName] - Nombre de la compañía
 * @param {Object} [dataParams.fields] - Campos adicionales del corredor
 * @returns {Promise<Object>} Resultado de la operación
 */
partner.crearpartner = async (dataParams) => {
    try {
        const result = await executeStoredProcedure(
            "SP_CREAR_CORREDORES_NETSUITE",
            [
                dataParams.id,
                dataParams?.fields?.entitynumber || dataParams.id,
                dataParams?.companyName || dataParams?.fields?.companyname || "N/A",
                "N/A",
                "N/A",
                "N/A",
                "N/A",
            ],
            "produccion"
        );

        return {
            status: "ok",
            message: "Corredor creado exitosamente",
            ...result
        };
    } catch (error) {
        throw {
            statusCode: 500,
            message: "Error al crear el corredor",
            error: error.message
        };
    }
};

/**
 * Edita un corredor existente o lo crea si no existe
 * @param {Object} dataParams - Datos del corredor
 * @param {number|string} dataParams.id - ID del corredor en NetSuite
 * @param {string} [dataParams.companyName] - Nombre de la compañía
 * @returns {Promise<Object>} Resultado de la operación
 */
partner.editarpartner = async (dataParams) => {
    try {
        // Consulta si el corredor existe
        const partnerExistente = await partner.consultarPartner(dataParams.id);

        // Verifica si encontró resultados (el array en el índice 0 tiene elementos)
        const existePartner = partnerExistente[0] && 
                             Array.isArray(partnerExistente[0]) && 
                             partnerExistente[0].length > 0;

        if (existePartner) {
            // Si existe, actualiza el nombre
            const result = await executeStoredProcedure(
                "SP_ACTUALIZAR_NOMBRE_CORREDOR_NETSUITE",
                [
                    parseInt(dataParams.id),
                    dataParams?.companyName || "",
                ],
                "produccion"
            );

            return {
                status: "ok",
                message: "Corredor actualizado exitosamente",
                ...result
            };
        } else {
            // Si no existe, crea uno nuevo
            const result = await partner.crearpartner(dataParams);
            
            return {
                status: "ok",
                message: "Corredor creado exitosamente",
                ...result
            };
        }

    } catch (error) {
        throw {
            statusCode: 500,
            message: "Error al editar el corredor",
            error: error.message
        };
    }
};

/**
 * Consulta un corredor por su ID de NetSuite
 * @param {number|string} id - ID del corredor en NetSuite
 * @returns {Promise<Object>} Resultado de la consulta (resultado[0] contiene los registros)
 */
partner.consultarPartner = async (id) => {
    try {
        const result = await executeStoredProcedure(
            "SP_CONSULTAR_CORREDOR_NETSUITE",
            [parseInt(id)],
            "produccion"
        );

        return result; 
    } catch (error) {
        throw {
            statusCode: 500,
            message: "Error al consultar el corredor",
            error: error.message
        };
    }
};

module.exports = partner;
