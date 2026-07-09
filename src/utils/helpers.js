var helpers = {}

/**
 * Funcion para gestionar las respuestas de la API
 * @param {Object} res - El objeto response de express
 * @param {Object} data - La data a retornar
 * @param {Object} error - El error a retornar
 * @returns {Object} - El objeto response de express
 */
helpers.manageResponse = (res, data, error) => {
    /* Si no hay error, retornamos el status 200 y la data
     * @param {Object} res - El objeto response de express
     * @param {Object} data - La data a retornar
     * @returns {Object} - El objeto response de express
     */

    if (error == null) {    
        // Retornamos el status 200 y la data
        return res.status(200).json(data)
    // Si hay error, retornamos el status 500 y el error
    } else {
        // Retornamos el status 500 y el error
        return res.status(500).json(error);
    }
}

// Exportamos el modulo
module.exports = helpers;



