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

/**
 * Lista las órdenes de venta según los filtros especificados.
 * @param {Object} dataParams - Parámetros para filtrar las órdenes de venta
 * @param {string} dataParams.rol_admin - Rol del administrador ("1" para admin, otro valor para no admin)
 * @param {string} dataParams.idnetsuite_admin - ID de NetSuite del administrador
 * @param {string} dataParams.filterOption - Opción de filtrado:
 *   - "1": Órdenes pendientes sin contrato firmado
 *   - "2": Órdenes pendientes con contrato firmado y aprobaciones
 *   - "3": Órdenes pagadas (requiere rango de fechas)
 *   - "4": Filtro por rango de fechas
 * @param {string} [dataParams.startDate] - Fecha inicial para filtrar (formato: YYYY-MM-DD)
 * @param {string} [dataParams.endDate] - Fecha final para filtrar (formato: YYYY-MM-DD)
 * @param {string} dataParams.database - Nombre de la base de datos a consultar
 * @returns {Promise<Array>} Array de órdenes de venta que cumplen con los criterios
 * @throws {Error} Si la opción de filtrado no es válida
 */
ordenVenta.enlistarOrdenesVenta = async (dataParams) => {
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
            if (dataParams.startDate && dataParams.endDate) {
                conditions.push(`DATE(o.creado_ov) BETWEEN '${dataParams.startDate}' AND '${dataParams.endDate}'`);
            }
            break;
        case "4":
            if (dataParams.startDate && dataParams.endDate) {
                conditions.push(`DATE(o.creado_ov) BETWEEN '${dataParams.startDate}' AND '${dataParams.endDate}'`);
            }
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
               o.creado_ov, 
               a.name_admin
        FROM ordenventa AS o
        INNER JOIN leads AS l ON l.idinterno_lead = o.id_ov_lead
        INNER JOIN oportunidades AS p ON p.id_oportunidad_oport = o.id_ov_opt
        INNER JOIN estimaciones AS e ON e.idEstimacion_est = o.id_ov_est
        INNER JOIN expedientes AS ex ON ex.ID_interno_expediente = o.idExpediente_ov
        INNER JOIN admins AS a ON a.idnetsuite_admin = o.id_ov_admin
        ${whereClause}
    `;

    return await executeQuery(query, [], dataParams.database);
};


ordenVenta.obtenerOrdendeventa = async ({idTransaccion}) => {
    console.log("idTransaccion", idTransaccion);
    const urlSettings = {
        url: 'https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1764&deploy=1',
    };
    try {
        const rest = nsrestlet.createLink(accountSettings, urlSettings);

        const body = await rest.get({ rType: "salesordersExtraer", id: idTransaccion });

        return {
            msg: "Crear estimacion ",
            Detalle: body,
            status: 200,
        };
    } catch (error) {
        console.error("Error al obtener oportuindad:", error);
        throw error;
    }
};

module.exports = ordenVenta;
