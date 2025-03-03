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

ordenVenta.obtenerOrdendeventa = async ({ idTransaccion }) => {
    const urlSettings = {
        url: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1764&deploy=1",
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

ordenVenta.aplicarComicio = async (dataParams) => {
    // Fixed the UPDATE query syntax by adding table name and proper SET clause
    const query = "UPDATE ordenventa SET pagadas_ov = ? WHERE id_ov_netsuite = ?";

    // Parameter that contains the transaction ID to filter results
    const params = [dataParams.valor, dataParams.idTransaccion];

    try {
        const result = await executeQuery(query, params, dataParams.database);
        console.log("result", result);

        if (result.affectedRows === 0) {
            throw new Error("No records were updated");
        }

        return result;
    } catch (error) {
        console.error("Error updating order:", error);
        throw error;
    }
};

ordenVenta.crearOrdenVenta = async (dataParams) => {
    const urlSettings = {
        url: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1763&deploy=1",
    };
    try {
        const rest = nsrestlet.createLink(accountSettings, urlSettings);

        const body = await rest.post({
            rType: "salesorder",
            estimate: dataParams.idEstimacion,
        });

        return {
            msg: "Crear orden de venta",
            Detalle: body,
            status: 200,
        };
    } catch (error) {
        console.error("Error al crear la orden de venta:", error);
        throw error;
    }
};

ordenVenta.insertarOrdenVentaBd = async (dataParams) => {
    console.log("dataParams", dataParams);

    // Fixed the UPDATE query syntax by adding table name and proper SET clause
    const query = "INSERT INTO ordenventa( id_ov_tranid, id_ov_netsuite, id_ov_est, id_ov_opt, id_ov_admin, id_ov_lead, idExpediente_ov, idsubsidiaria_ov ) VALUES (?,?,?,?,?,?,?,?)";

    // Parameter that contains the transaction ID to filter results
    const params = [dataParams.tranid, dataParams.id_orden, dataParams.idEstimacion, dataParams.opportunityInternalId, dataParams.employeeInternalId, dataParams.entityInternalId, dataParams.custbody38Value, dataParams.subsidiaryInternalId];

    try {
        const result = await executeQuery(query, params, dataParams.database);
        console.log("result", result);

        if (result.affectedRows === 0) {
            throw new Error("No records were updated");
        }

        return result;
    } catch (error) {
        console.error("Error updating order:", error);
        throw error;
    }
};



ordenVenta.editarOrdenVenta = async (dataParams) => {

    function transformarFecha(fecha, campo) {
        // Validar si la fecha es vacía o no válida
        if (!fecha || typeof fecha !== "string" || !fecha.includes("-")) {
            console.warn("⚠️ Fecha vacía o formato inválido. No se realiza la transformación.");
            return null; // Retorna null o un valor predeterminado según tu necesidad
        }

        var partesFecha = fecha.split("-");
        var dia = partesFecha[2];
        var mes = partesFecha[1];
        var anio = partesFecha[0];

        return dia + "/" + mes + "/" + anio;
    }

    const cleanAndParseInteger = (value) => {
        // Si el valor es nulo o indefinido, retorna 0
        if (value == null || value === "") return 0;
        // Asegúrate de que el valor sea una cadena antes de aplicar la limpieza
        const cleanedValue =
            typeof value === "string"
                ? value.replace(/,/g, "") // Elimina solo las comas
                : value.toString().replace(/,/g, "");
        // Convierte el valor limpio a un número entero
        return parseFloat(cleanedValue, 10) || 0; // Retorna 0 si no es un número válido
    };

    const urlSettings = {
         url: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1764&deploy=1",
    };

    const { formulario } = dataParams;

    try {
        const rest = nsrestlet.createLink(accountSettings, urlSettings);

        const body = await rest.put({
            rType: "ordenVenta",
            //ID de la orden de venta
            id: formulario.idEst,
            //ID de campo: custbody114
            custbody114: formulario?.custbody114 || 0,


            // FECHA DE VIGENCIA DE LA VENTA
            saleseffectivedate : transformarFecha(formulario?.saleseffectivedate, "saleseffectivedate") || 0,


            // PREC. DE VENTA MÍNIMO
            custbody18: cleanAndParseInteger(formulario?.custbody18) || 0,

            // COMISIÓN DEL ASESOR %
            custbody20: formulario?.custbody20 || 0,

            // % COMISIÓN DEL CORREDOR
            custbody14: formulario?.custbody14 || 0,

            // FONDOS DE COMPRA
            custbody37: formulario?.custbody37 || 0,

            // MOTIVO DE CANCELACIÓN DE RESERVA O VENTA CAIDA
            custbody115: formulario?.custbody115 || 0,

            //COMENTARIOS CANCELACIÓN DE RESERVA
            custbody116: formulario?.custbody116 || 0,

            // nota
            memo: formulario?.memo || 0,


            // PRECIO NETO
            pvneto: cleanAndParseInteger(formulario?.pvneto) || 0,

            // DIFERENCIA
            diferencia: cleanAndParseInteger(formulario?.custbody185) || 0,

            //chek reserva
            RESERVA: formulario?.pre_reserva || 0,

            //MONTO RESERVA :
            rateReserva: cleanAndParseInteger(formulario?.custbody52) || 0,


            // FECHA DE SERVA APLICADA
            custbody208: transformarFecha(formulario?.custbody208, "custbody208") || 0,

            // METODO DE PAGO
            custbody188: formulario?.custbody188 || 0,


            //COMPROBANTE PRERESERVA
            custbody189: formulario?.custbody189 || 0,

            // MONTO RESERVA APLICADA
            custbody207: cleanAndParseInteger(formulario?.custbody207) || 0,

            // MONTO TOTAL 
            custbody_ix_total_amount: cleanAndParseInteger(formulario?.custbody_ix_total_amount) || 0,

            //PRECIO DE LISTA
            custbody13: cleanAndParseInteger(formulario?.custbody13) || 0,

            //PRIMA TOTAL
            custbody39: cleanAndParseInteger(formulario?.custbody39) || 0,

            //PRIMA
            custbody60: formulario?.custbody60 || 0,
            
            // MONTO PRIMA NETA
            custbody_ix_salesorder_monto_prima: cleanAndParseInteger(formulario?.custbody_ix_salesorder_monto_prima) || 0,


            //MONTO DESCUENTO DIRECTO
            custbody132: cleanAndParseInteger(formulario?.custbody132) || 0,

            //CASHBACK 
            custbodyix_salesorder_cashback: cleanAndParseInteger(formulario?.custbodyix_salesorder_cashback) || 0,

            //EXTRAS SOBRE EL PRECIO DE LISTA   
            custbody185: cleanAndParseInteger(formulario?.custbody185) || 0,

            
            //MONTO EXTRAS SOBRE EL PRECIO DE LISTA
            custbody46: cleanAndParseInteger(formulario?.custbody46) || 0,

            //MONTO TOTAL DE CORTESÍAS
            custbody16: cleanAndParseInteger(formulario?.custbody16) || 0,

            //DESCRIPCIÓN DE EXTRAS SOBRE EL PRECIO DE LISTA
            custbody47: formulario?.custbody47 || "",


            //DESCRIPCIÓN DE LAS CORTESIAS
            custbody35: formulario?.custbody35 || "",

            //COMPROBANTE DE RESERVA
            custbody190: formulario?.custbody190 || "",


            //FECHA DE RESERVA
            fech_reserva: transformarFecha(formulario?.fech_reserva, "fech_reserva") || 0,


            //PRIMA FRACCIONADA
            custbody176 : formulario?.custbody176,

            //PRIMA 1 fecha
            custbody179_date : transformarFecha(formulario?.custbody179_date, "custbody179_date") || 0,

            // tractos prima 1
            custbody180 : formulario?.custbody180,

            // descripcion prima 1
            custbody193 : formulario?.custbody193,

            // monnto prima 1
            custbody179 : cleanAndParseInteger(formulario.custbody179),

            // prima chek 2 
            custbody177 : formulario?.custbody177,

            // prima chek 2 fecha
            custbody182_date : transformarFecha(formulario?.custbody182_date, "custbody182_date") || 0,

            // tractos prima 2
            custbody182 : formulario?.custbody182,

            // descripcion prima 2
            custbody194 : formulario?.custbody194,

            // monto prima 2
            custbody181 : cleanAndParseInteger(formulario.custbody181),

            // prima chek 3
            custbody178 : formulario?.custbody178,

            // prima chek 3 fecha
            custbody184_date : transformarFecha(formulario?.custbody184_date, "custbody184_date") || 0,

            // tractos prima 3
            custbody184 : formulario?.custbody184,

            // descripcion prima 3
            custbody195 : formulario?.custbody195,

            // monto prima 3
            custbody183 : cleanAndParseInteger(formulario.custbody183),


            prima_extra_uno : formulario?.prima_extra_uno,

            // monto prima 4
            monto_extra_uno : cleanAndParseInteger(formulario.monto_extra_uno),

            // fecha prima 4
            custbody184_uno_date : transformarFecha(formulario?.custbody184_uno_date, "custbody184_uno_date") || 0,

            // tractos prima 4
            monto_tracto_uno : formulario?.monto_tracto_uno,

            // descripcion prima 4
            desc_extra_uno : formulario?.desc_extra_uno,

            prima_extra_dos : formulario?.prima_extra_dos,

            // monto prima 5
            monto_extra_dos : cleanAndParseInteger(formulario.monto_extra_dos),


            // fecha prima 5
            custbody184_dos_date : transformarFecha(formulario?.custbody184_dos_date, "custbody184_dos_date") || 0,

            // tractos prima 5
            monto_tracto_dos : formulario?.monto_tracto_dos,

            // descripcion prima 5
            desc_extra_dos : formulario?.desc_extra_dos,

            // fecha de prereserva
            custbody206 : transformarFecha(formulario?.custbody206, "custbody206") || 0,


            prima_extra_tres : formulario?.prima_extra_tres,

            // monto prima 6
            monto_extra_tres : cleanAndParseInteger(formulario.monto_extra_tres),

            // fecha prima 6
            custbody184_tres_date : transformarFecha(formulario?.custbody184_tres_date, "custbody184_tres_date") || 0,

            // tractos prima 6
            monto_tracto_tres : formulario?.monto_tracto_tres,

            // descripcion prima 6
            desc_extra_tres : formulario?.desc_extra_tres,

            custbody75 : formulario?.custbody75,
            
            
            date_hito_6 : transformarFecha(formulario?.date_hito_6, "date_hito_6") || 0,

            custbody_ix_salesorder_hito6 : cleanAndParseInteger(formulario?.custbody_ix_salesorder_hito6),
            

            
            
            
            
            
            
            
            

       





            
            
        });

        return {
            msg: "Editar estimacion ",
            Detalle: body,
            status: 200,
        };
    } catch (error) {
        console.error("Error al editar estimacion:", error);
        throw error;
    }
};

module.exports = ordenVenta;
