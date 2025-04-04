// Importamos las configuraciones necesarias desde el archivo de configuración.
const config = require("../../config/config");

const {executeQuery } = require("../conectionPool/conectionPool");

//  Buscador general
const buscador = {}; 


// Método para obtener las estimaciones relacionadas a una oportunidad específica
buscador.getAll = async (dataParams) => {

    console.log(dataParams);
    
    const { selectedOption, searchs, idnetsuite_admin, rol_admin } = dataParams;

    if (selectedOption === "leads") {
        const query = `SELECT l.*, a.name_admin as nombre_admin FROM leads as l 
        INNER JOIN admins as a ON a.idnetsuite_admin = l.id_empleado_lead 
        WHERE l.nombre_lead LIKE ?`;
        const params = [`%${searchs }%`];
        const result = await executeQuery(query, params, dataParams.database);
        return result;
    }

    if (selectedOption === "oportunidad") {
        const query = `SELECT p.*,a.name_admin as employee_oport, l.nombre_lead as entity_oport  FROM oportunidades AS p 
        INNER JOIN admins as a ON a.idnetsuite_admin = p.employee_oport 
        INNER JOIN leads as l ON l.idinterno_lead  = p.entity_oport 
        WHERE p.tranid_oport LIKE ?`;
        const params = [`%${searchs}%`];
        const result = await executeQuery(query, params, dataParams.database);
        return result;
    }

    if (selectedOption === "evento") {
        const query = `SELECT e.*, a.name_admin AS employee_evento, COALESCE(l.nombre_lead, 'No aplica') AS nombre_lead FROM calendars AS e 
        INNER JOIN admins AS a ON a.idnetsuite_admin = e.id_admin 
        LEFT JOIN leads AS l ON l.idinterno_lead = e.id_lead
        WHERE e.nombre_calendar LIKE ?`;
        const params = [`%${searchs}%`];
        const result = await executeQuery(query, params, dataParams.database);
        return result;
    }

};

// buscador.getAll = async (dataParams) => {

//     console.log(dataParams);
    
//     const { selectedOption, searchs, idnetsuite_admin, rol_admin } = dataParams; 

//     if (selectedOption === "leads") {
//         const query = `SELECT l.*, a.name_admin as nombre_admin FROM leads as l 
//         INNER JOIN admins as a ON a.idnetsuite_admin = l.id_empleado_lead 
//         WHERE l.nombre_lead LIKE ? ${rol_admin === '2' ? 'AND l.id_empleado_lead= ?' : ''}`;
//         const params = [`%${searchs}%`];
//         if (rol_admin === '2') {
//             params.push(idnetsuite_admin);
//         }
//         const result = await executeQuery(query, params, dataParams.database);
//         return result;
//     }

//     if (selectedOption === "oportunidad") {
//         const query = `SELECT p.*,a.name_admin as employee_oport, l.nombre_lead as entity_oport  FROM oportunidades AS p 
//         INNER JOIN admins as a ON a.idnetsuite_admin = p.employee_oport 
//         INNER JOIN leads as l ON l.idinterno_lead  = p.entity_oport 
//         WHERE p.tranid_oport LIKE ? ${rol_admin === '2' ? 'AND p.employee_oport  = ?' : ''}`;
//         const params = [`%${searchs}%`];
//         if (rol_admin === '2') {
//             params.push(idnetsuite_admin);
//         }
//         const result = await executeQuery(query, params, dataParams.database);
//         return result;
//     }

//     if (selectedOption === "evento") {
//         const query = `SELECT e.*, a.name_admin AS employee_evento, COALESCE(l.nombre_lead, 'No aplica') AS nombre_lead FROM calendars AS e 
//         INNER JOIN admins AS a ON a.idnetsuite_admin = e.id_admin 
//         LEFT JOIN leads AS l ON l.idinterno_lead = e.id_lead
//         WHERE e.nombre_calendar LIKE ? ${rol_admin === '2' ? 'AND e.id_admin  = ?' : ''}`;
//         const params = [`%${searchs}%`];
//         if (rol_admin === '2') {
//             params.push(idnetsuite_admin);
//         }
//         const result = await executeQuery(query, params, dataParams.database);
//         return result;
//     }

// };

// Exportamos el módulo para su uso en otras partes del proyecto.
module.exports = buscador;
