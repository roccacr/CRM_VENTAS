// Importamos las configuraciones necesarias desde el archivo de configuración.
const config = require("../../config/config");

const {executeQuery } = require("../conectionPool/conectionPool");

//  Buscador general
const buscador = {}; 


// Método para obtener las estimaciones relacionadas a una oportunidad específica
buscador.getAll = async (dataParams) => {

    console.log(dataParams);
    
    const { selectedOption, search } = dataParams;

    if (selectedOption === "leads") {
        const query = "SELECT * FROM leads WHERE nombre_lead LIKE ?";
        const params = [`%${search}%`];
        const result = await executeQuery(query, params, dataParams.database);
        return result;
    }

    if (selectedOption === "oportunidad") {
        const query = "SELECT * FROM oportunidades WHERE tranid_oport LIKE ?";
        const params = [`%${search}%`];
        const result = await executeQuery(query, params, dataParams.database);
        return result;
    }

};

// Exportamos el módulo para su uso en otras partes del proyecto.
module.exports = buscador;
