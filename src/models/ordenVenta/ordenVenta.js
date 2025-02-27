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
    console.log(dataParams);

    const conditions = [];
    const isAdmin = dataParams.rol_admin === "1";

    if (!isAdmin) {
        conditions.push(`o.id_ov_admin = '${dataParams.idnetsuite_admin}'`);
    }

    switch (dataParams.filterOption) {
        case "1":
            conditions.push("o.caida_ov = 0", "o.comision_cancelada_ov = 0", "o.status_ov = 1", "o.contrado_frima_ov = 0", "o.pagadas_ov = 0");
            break;
        case "2":
            conditions.push("o.caida_ov = 0", "o.comision_cancelada_ov = 0", "o.contrado_frima_ov = 1", "o.cierre_firmado_ov = 1", "o.aprobacion_forma_ov = 1", "o.aprobacion__rdr_ov = 1", "o.calculo_comision_asesor_ov = 1", "o.status_ov = 1", "o.pagadas_ov = 0");
            break;
        case "3":
            conditions.push("o.pagadas_ov = 1");
            break;
        case "4":
            // No se agregan condiciones adicionales.
            break;
        default:
            throw new Error("Invalid filter option");
    }

    // Construcción final del WHERE
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT o.status_ov, o.id_ov_tranid, o.id_ov_netsuite, 
               l.nombre_lead, l.idinterno_lead, 
               p.tranid_oport, p.id_oportunidad_oport, 
               e.idEstimacion_est, e.tranid_est, 
               ex.ID_interno_expediente, ex.codigo_exp, 
               o.creado_ov
        FROM ordenventa AS o
        INNER JOIN leads AS l ON l.idinterno_lead = o.id_ov_lead
        INNER JOIN oportunidades AS p ON p.id_oportunidad_oport = o.id_ov_opt
        INNER JOIN estimaciones AS e ON e.idEstimacion_est = o.id_ov_est
        INNER JOIN expedientes AS ex ON ex.ID_interno_expediente = o.idExpediente_ov
        ${whereClause}
    `;

    return await executeQuery(query, [], dataParams.database);
};

module.exports = ordenVenta;
