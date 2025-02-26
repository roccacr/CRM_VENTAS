// Importamos las configuraciones necesarias desde el archivo de configuración.
const config = require("../../config/config");
// Importamos el módulo 'nsrestlet' para realizar llamadas a la API de NetSuite Restlet.
const nsrestlet = require("nsrestlet");

const { executeStoredProcedure, executeQuery } = require("../conectionPool/conectionPool");

const ordenVenta = {};

// Configuración de credenciales para acceder a NetSuite.
var accountSettings = {
    accountId: config.oauthNetsuite.realm,
    tokenKey: config.oauthNetsuite.token.id,
    tokenSecret: config.oauthNetsuite.token.secret,
    consumerKey: config.oauthNetsuite.consumer.key,
    consumerSecret: config.oauthNetsuite.consumer.secret,
};




ordenVenta.enlistarOrdenesVenta = async (dataParams) => {
    let whereClause = 'WHERE ';
    
    whereClause += dataParams.filterOption === '2'
        ? 'o.caida_ov = 0 AND o.comision_cancelada_ov = 0 AND o.contrado_frima_ov = 1 AND o.cierre_firmado_ov = 1 AND o.aprobacion_forma_ov = 1 AND o.aprobacion__rdr_ov = 1 AND o.calculo_comision_asesor_ov = 1 AND o.status_ov = 1'
        : 'o.caida_ov = 0 AND o.comision_cancelada_ov = 0 AND o.status_ov = 1 AND o.contrado_frima_ov = 0';

    if (dataParams.rol_admin === '2') {
        whereClause += ` AND o.id_ov_admin = '${dataParams.idnetsuite_admin}'`;
    }
    
    const query = `SELECT o.status_ov,o.id_ov_tranid, o.id_ov_netsuite, l.nombre_lead,l.idinterno_lead, p.tranid_oport,p.id_oportunidad_oport,e.idEstimacion_est,e.tranid_est,ex.ID_interno_expediente,ex.codigo_exp,o.creado_ov
    FROM ordenventa as o INNER JOIN leads as l ON l.idinterno_lead = o.id_ov_lead INNER JOIN oportunidades as p ON p.id_oportunidad_oport = o.id_ov_opt INNER JOIN estimaciones as e ON e.idEstimacion_est = o.id_ov_est INNER JOIN expedientes as ex ON ex.ID_interno_expediente = o.idExpediente_ov ${whereClause}`;


    return await executeQuery(query, [],  dataParams.database);

    
};

// Exportamos el módulo para su uso en otras partes del proyecto.
module.exports = ordenVenta;
