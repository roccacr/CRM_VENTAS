/**
 * @fileoverview Módulo de búsqueda general para diferentes entidades del CRM
 * @module Buscador
 */

// Importamos las configuraciones necesarias desde el archivo de configuración.
const config = require("../../config/config");

const {executeQuery } = require("../conectionPool/conectionPool");

/**
 * Objeto que contiene las funciones de búsqueda
 * @type {Object}
 */
const buscador = {}; 


/**
 * Realiza búsquedas en diferentes entidades del sistema según los parámetros proporcionados
 * @async
 * @param {Object} dataParams - Parámetros de búsqueda
 * @param {string} dataParams.selectedOption - Tipo de entidad a buscar (leads, oportunidad, evento, etc.)
 * @param {string} dataParams.searchs - Término de búsqueda
 * @param {string} dataParams.idnetsuite_admin - ID del administrador
 * @param {string} dataParams.rol_admin - Rol del administrador
 * @param {string} dataParams.database - Base de datos a utilizar
 * @returns {Promise<Array>} Resultados de la búsqueda
 */
buscador.getAll = async (dataParams) => {
    const { selectedOption, searchs, database } = dataParams;

    // Definición de queries por tipo de entidad
    const queryDefinitions = {
        leads: {
            query: `SELECT l.*, a.name_admin as nombre_admin 
                   FROM leads as l 
                   INNER JOIN admins as a ON a.idnetsuite_admin = l.id_empleado_lead 
                   WHERE l.nombre_lead LIKE ?`
        },
        oportunidad: {
            query: `SELECT p.*, a.name_admin as employee_oport, l.nombre_lead as entity_oport_name
                   FROM oportunidades AS p 
                   INNER JOIN admins as a ON a.idnetsuite_admin = p.employee_oport 
                   INNER JOIN leads as l ON l.idinterno_lead = p.entity_oport 
                   WHERE p.tranid_oport LIKE ?`
        },
        evento: {
            query: `SELECT e.*, a.name_admin AS employee_evento, COALESCE(l.nombre_lead, 'No aplica') AS nombre_lead 
                   FROM calendars AS e 
                   INNER JOIN admins AS a ON a.idnetsuite_admin = e.id_admin 
                   LEFT JOIN leads AS l ON l.idinterno_lead = e.id_lead
                   WHERE e.nombre_calendar LIKE ?`
        },
        estimaciones: {
            query: `SELECT es.*, a.name_admin AS employee_estimacion, l.nombre_lead as entity_estimacion 
                   FROM estimaciones as es
                   INNER JOIN admins AS a ON a.idnetsuite_admin = es.idAdmin_est  
                   LEFT JOIN leads AS l ON l.idinterno_lead = es.idLead_est 
                   WHERE es.tranid_est LIKE ?`
        },
        ordenVenta: {
            query: `SELECT ov.*, a.name_admin AS employee_ordenVenta, l.nombre_lead as entity_ordenVenta 
                   FROM ordenventa as ov
                   INNER JOIN admins AS a ON a.idnetsuite_admin = ov.id_ov_admin   
                   LEFT JOIN leads AS l ON l.idinterno_lead = ov.id_ov_lead  
                   WHERE ov.id_ov_tranid LIKE ?`
        },
        corredores: {
            query: `SELECT * FROM corredores WHERE nombre_corredor LIKE ?`
        },
        proyecto: {
            query: `SELECT * FROM proyectos WHERE Nombre_proyecto LIKE ?`
        },
        subsidiaria: {
            query: `SELECT * FROM subsidiarias WHERE Nombre_Subsidiaria LIKE ?`
        },
        ubicaciones: {
            query: `SELECT * FROM ubicaciones WHERE nombre_ubicaciones LIKE ?`
        },
        campana: {
            query: `SELECT * FROM campanas WHERE Nombre_Campana LIKE ?`
        }
    };

    // Verificar si existe la definición de búsqueda para la opción seleccionada
    if (!queryDefinitions[selectedOption]) {
        throw new Error(`Opción de búsqueda no válida: ${selectedOption}`);
    }

    try {
        const { query } = queryDefinitions[selectedOption];
        const params = [`%${searchs}%`];
        return await executeQuery(query, params, database);
    } catch (error) {
        console.error(`Error en búsqueda de ${selectedOption}:`, error);
        throw error;
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
// };

// Exportamos el módulo para su uso en otras partes del proyecto.
module.exports = buscador;
