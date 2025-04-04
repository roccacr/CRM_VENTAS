// Importamos las configuraciones necesarias desde el archivo de configuración.
const config = require("../../config/config");

const {executeQuery } = require("../conectionPool/conectionPool");

//  Buscador general
const buscador = {}; 


// Método para obtener las estimaciones relacionadas a una oportunidad específica
buscador.getAll = async (dataParams) => {

    console.log(dataParams);
    
    const { selectedOption, searchs } = dataParams;

    if (selectedOption === "leads") {
        const query = `SELECT l.*, a.name_admin as nombre_admin FROM leads as l 
        INNER JOIN admins as a ON a.idnetsuite_admin = l.id_empleado_lead 
        WHERE l.nombre_lead LIKE ?`;
        const params = [`%${searchs }%`];
        const result = await executeQuery(query, params, dataParams.database);
        return result;
    }

    if (selectedOption === "oportunidad") {
        const query = `SELECT p.*,a.name_admin as employee_oport  FROM oportunidades AS p 
        INNER JOIN admins as a ON a.idnetsuite_admin = p.employee_oport 
        WHERE p.tranid_oport LIKE ?`;
        const params = [`%${searchs}%`];
        const result = await executeQuery(query, params, dataParams.database);
        return result;
    }

};

// Exportamos el módulo para su uso en otras partes del proyecto.
module.exports = buscador;
