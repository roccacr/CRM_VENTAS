// Importamos las configuraciones necesarias desde el archivo de configuración.
const config = require("../../config/config");
// Importamos el módulo 'nsrestlet' para realizar llamadas a la API de NetSuite Restlet.
const nsrestlet = require("nsrestlet");

const { executeStoredProcedure, executeQuery } = require("../conectionPool/conectionPool");

// Configuración de credenciales para acceder a NetSuite.
var accountSettings = {
    accountId: config.oauthNetsuite.realm,
    tokenKey: config.oauthNetsuite.token.id,
    tokenSecret: config.oauthNetsuite.token.secret,
    consumerKey: config.oauthNetsuite.consumer.key,
    consumerSecret: config.oauthNetsuite.consumer.secret,
};

// Definimos las URL del Restlet en NetSuite.
const urlSettings = {
    url: "https://4552704-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1763&deploy=1",
};

// Creamos un objeto que contendrá las funciones relacionadas con NetSuite.
const estimacion = {};

// Función para obtener un expediente de NetSuite por su ID.
estimacion.crear_estimacion = async ({ formulario }) => {
    // Transformar la fecha del campo "date_hito_1" del formulario y almacenarla en una variable.
    var fechaTransformada_1 = transformarFecha(formulario.date_hito_1, "date_hito_1");

    // Transformar la fecha del campo "date_hito_2" del formulario y almacenarla en una variable.
    var fechaTransformada_2 = transformarFecha(formulario.date_hito_2, "date_hito_2");

    // Transformar la fecha del campo "date_hito_3" del formulario y almacenarla en una variable.
    var fechaTransformada_3 = transformarFecha(formulario.date_hito_3, "date_hito_3");

    // Transformar la fecha del campo "date_hito_4" del formulario y almacenarla en una variable.
    var fechaTransformada_4 = transformarFecha(formulario.date_hito_4, "date_hito_4");

    // Transformar la fecha del campo "date_hito_5" del formulario y almacenarla en una variable.
    var fechaTransformada_5 = transformarFecha(formulario.date_hito_5, "date_hito_5");

    // Transformar la fecha del campo "date_hito_6" del formulario y almacenarla en una variable.
    var fechaTransformada_6 = transformarFecha(formulario.date_hito_6, "date_hito_6");

    // Transformar la fecha del campo "custbody206" del formulario y almacenarla en una variable.
    var fechaTransformada_7 = transformarFecha(formulario.custbody206, "custbody206");

    // Transformar la fecha del campo "custbody179_date" del formulario y almacenarla en una variable.
    var fechaTransformada_8 = transformarFecha(formulario.custbody179_date, "custbody179_date");

    // Transformar la fecha del campo "custbody182_date" del formulario y almacenarla en una variable.
    var fechaTransformada_9 = transformarFecha(formulario.custbody182_date, "custbody182_date");

    // Transformar la fecha del campo "custbody184_date" del formulario y almacenarla en una variable.
    var fechaTransformada_10 = transformarFecha(formulario.custbody184_date, "custbody184_date");

    // Transformar la fecha del campo "custbody184_uno_date" del formulario y almacenarla en una variable.
    var fechaTransformada_11 = transformarFecha(formulario.custbody184_uno_date, "custbody184_uno_date");

    // Transformar la fecha del campo "custbody184_dos_date" del formulario y almacenarla en una variable.
    var fechaTransformada_12 = transformarFecha(formulario.custbody184_dos_date, "custbody184_dos_date");

    // Transformar la fecha del campo "custbody184_tres_date" del formulario y almacenarla en una variable.
    var fechaTransformada_13 = transformarFecha(formulario.custbody184_tres_date, "custbody184_tres_date");

    // Transformar la fecha del campo "fech_reserva" del formulario y almacenarla en una variable.
    var fechaTransformada_14 = transformarFecha(formulario.fech_reserva, "fech_reserva");

    function transformarFecha(fecha, campo) {
        // Validar si la fecha es vacía o no válida
        if (!fecha || typeof fecha !== "string") {
            console.warn("⚠️ Fecha vacía o formato inválido. No se realiza la transformación.");
            return fecha; // Retorna null o un valor predeterminado según tu necesidad
        }

        
        // Verificar el formato de la fecha y limpiarla si es necesario
        let fechaLimpia = fecha;
        
        // Si la fecha ya tiene barras (posiblemente ya está transformada)
        if (fecha.includes("/")) {
            // Verificar si tiene formato correcto ya (DD/MM/YYYY)
            const partes = fecha.split("/");
            if (partes.length === 3) {
                return fecha; // Ya está en formato correcto
            }
            // Limpiar formato incorrecto
            fechaLimpia = fecha.replace(/\//g, "-");
        }
        
        // Dividir la fecha por guiones
        var partesFecha = fechaLimpia.split("-");
        
        // Verificar que tengamos exactamente 3 partes (año, mes, día)
        if (partesFecha.length !== 3) {
            console.warn(`⚠️ Formato de fecha inválido para ${campo}: ${fecha}`);
            return fecha;
        }
        
        var dia = partesFecha[2];
        var mes = partesFecha[1];
        var anio = partesFecha[0];

        console.log("fecha después de transformar", campo, `${dia}/${mes}/${anio}`);
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






    try {
        const rest = nsrestlet.createLink(accountSettings, urlSettings);

        const body = await rest.post({
            rType: "estimacion",
            custbody114: formulario.custbody114,
            /*MONTO TOTAL*/
            custbody_ix_total_amount: cleanAndParseInteger(formulario.custbody_ix_total_amount),
            /*OPORTUNIDAD*/
            opportunity: formulario.opportunity,
            /*PRECIO DE LISTA:formulario.*/
            custbody13: cleanAndParseInteger(formulario.custbody13),
            /*PRIMA TOTAL*/
            custbody39: cleanAndParseInteger(formulario.custbody39),
            /*PRIMA%*/
            custbody60: formulario.custbody60,
            /*MONTO PRIMA NETA%*/
            custbody_ix_salesorder_monto_prima: cleanAndParseInteger(formulario.custbody_ix_salesorder_monto_prima),
            /*MONTO DESCUENTO DIRECTO%*/
            custbody132: cleanAndParseInteger(formulario.custbody132),
            /*CASHBACK*/
            custbodyix_salesorder_cashback: formulario.custbodyix_salesorder_cashback,
            /*EXTRAS SOBRE EL PRECIO DE LISTA /diferencia*/
            custbody185: cleanAndParseInteger(formulario.custbody185),
            //MONTO EXTRAS SOBRE EL PRECIO DE LISTA / EXTRAS PAGADAS POR EL CLIENTE
            custbody46: cleanAndParseInteger(formulario.custbody46),
            //MONTO TOTAL DE CORTESÍAS
            custbody16: cleanAndParseInteger(formulario.custbody16),

            //DESCRIPCIÓN EXTRAS
            custbody47: formulario.custbody47,
            neta: cleanAndParseInteger(formulario.neta),
            fech_reserva: fechaTransformada_14,
            //DESCRIPCIÓN DE LAS CORTESIAS
            custbody35: formulario.custbody35,
            custbody75: formulario.custbody75,
            custbody67: formulario.custbody67,
            custbody_ix_salesorder_hito6: cleanAndParseInteger(formulario.custbody_ix_salesorder_hito6),
            custbody163: cleanAndParseInteger(formulario.custbody163),

            custbody62: formulario.custbody62,
            custbodyix_salesorder_hito1: cleanAndParseInteger(formulario.custbodyix_salesorder_hito1),
            custbody63: formulario.custbody63,
            custbody_ix_salesorder_hito2: cleanAndParseInteger(formulario.custbody_ix_salesorder_hito2),
            custbody64: formulario.custbody64,
            custbody_ix_salesorder_hito3: cleanAndParseInteger(formulario.custbody_ix_salesorder_hito3),
            custbody65: formulario.custbody65,
            custbody_ix_salesorder_hito4: cleanAndParseInteger(formulario.custbody_ix_salesorder_hito4),
            custbody66: formulario.custbody66,
            custbody_ix_salesorder_hito5: cleanAndParseInteger(formulario.custbody_ix_salesorder_hito5),
            hito_chek_uno: formulario.hito_chek_uno,
            hito_chek_dos: formulario.hito_chek_dos,
            hito_chek_tres: formulario.hito_chek_tres,
            hito_chek_cuatro: formulario.hito_chek_cuatro,
            hito_chek_cinco: formulario.hito_chek_cinco,
            hito_chek_seis: formulario.hito_chek_seis,
            date_hito_1: fechaTransformada_1,
            date_hito_2: fechaTransformada_2,
            date_hito_3: fechaTransformada_3,
            date_hito_4: fechaTransformada_4,
            date_hito_5: fechaTransformada_5,
            date_hito_6: fechaTransformada_6,
            custbody113: formulario.pre_reserva ? "T" : "F",
            custbody191: formulario.custbody191,
            custbody188: formulario.custbody188,
            custbody189: formulario.custbody189,
            custbody206: fechaTransformada_7,
            custbody190: formulario.custbody190,
            rateReserva: cleanAndParseInteger(formulario.custbody52),

            custbody176: formulario.custbody176 ? "T" : "F",
            custbody179: cleanAndParseInteger(formulario.custbody179),
            custbody180: formulario.custbody180,
            custbody193: formulario.custbody193,
            custbody179_date: fechaTransformada_8,

            custbody177: formulario.custbody177 ? "T" : "F",
            custbody181: cleanAndParseInteger(formulario.custbody181),
            custbody182: formulario.custbody182,
            custbody194: formulario.custbody194,
            custbody182_date: fechaTransformada_9,

            custbody178: formulario.custbody178 ? "T" : "F",
            custbody183: cleanAndParseInteger(formulario.custbody183),
            custbody184: formulario.custbody184,
            custbody195: formulario.custbody195,
            custbody184_date: fechaTransformada_10,

            prima_extra_uno: formulario.prima_extra_uno ? "T" : "F",
            monto_extra_uno: cleanAndParseInteger(formulario.monto_extra_uno),
            monto_tracto_uno: formulario.monto_tracto_uno,
            desc_extra_uno: formulario.desc_extra_uno,
            custbody184_uno_date: fechaTransformada_11,

            prima_extra_dos: formulario.prima_extra_dos ? "T" : "F",
            monto_extra_dos: cleanAndParseInteger(formulario.monto_extra_dos),
            monto_tracto_dos: formulario.monto_tracto_dos,
            desc_extra_dos: formulario.desc_extra_dos,
            custbody184_dos_date: fechaTransformada_12,

            prima_extra_tres: formulario.prima_extra_tres ? "T" : "F",
            monto_extra_tres: cleanAndParseInteger(formulario.monto_extra_tres),
            monto_tracto_tres: formulario.monto_tracto_tres,
            desc_extra_tres: formulario.desc_extra_tres,
            custbody184_tres_date: fechaTransformada_13,
        });
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

// Método para obtener las estimaciones relacionadas a una oportunidad específica
estimacion.ObtenerEstimacionesOportunidad = (dataParams) => {
    // Consulta SQL para seleccionar todas las estimaciones asociadas a una oportunidad específica,
    // ordenándolas por la fecha de caducidad en orden descendente.
    const query = "SELECT * FROM estimaciones WHERE idOportunidad_est = ? ORDER BY caduca DESC";

    // Parámetro que contiene el ID de la oportunidad para filtrar los resultados.
    const params = [dataParams.idOportunidad];

    // Llama a la función de ejecución de consultas en la base de datos.
    // Retorna los resultados obtenidos en base a:
    // - `query`: la consulta SQL.
    // - `params`: el ID de la oportunidad utilizado como filtro.
    // - `dataParams.database`: la base de datos en la que se ejecutará la consulta.
    return executeQuery(
        query, // Consulta SQL que se ejecutará
        params, // Parámetros necesarios para la consulta
        dataParams.database, // Conexión a la base de datos proporcionada
    );
};

estimacion.extarerEstimacionNetsuite = async (estimacionId) => {
    const urlSettings = {
        url: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1764&deploy=1",
    };
    try {
        const rest = nsrestlet.createLink(accountSettings, urlSettings);

        const body = await rest.get({ rType: "estimate", id: estimacionId });

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

// Método para obtener las estimaciones relacionadas a una oportunidad específica
estimacion.extraerEstimacion = async (dataParams) => {
    console.log("dataParams", dataParams);
    // Consulta SQL para seleccionar todas las estimaciones asociadas a una oportunidad específica,
    // ordenándolas por la fecha de caducidad en orden descendente.
    const query = "SELECT * FROM estimaciones WHERE idEstimacion_est = ? ";

    // Parámetro que contiene el ID de la oportunidad para filtrar los resultados.
    const params = [dataParams.idEstimacion];

    const result = await executeQuery(query, params, dataParams.database);



    const queryTotalOredenes = "SELECT id_ov_est FROM `ordenventa` WHERE `id_ov_est` = ? ";        

    // Parámetro que contiene el ID de la oportunidad para filtrar los resultados.
    const paramsTotalOredenes = [dataParams.idEstimacion];

    const resultTotalOredenes = await executeQuery(queryTotalOredenes, paramsTotalOredenes, dataParams.database);



    const resultNetsuite = await estimacion.extarerEstimacionNetsuite(dataParams.idEstimacion);

    console.log("resultNetsuite", resultNetsuite);

    const datosReales = {
        crm: result.data[0], // Propaga las propiedades de la primera fila
        netsuite: resultNetsuite, // Agrega la nueva propiedad\
        totalOredenes: resultTotalOredenes.data
    };

    return datosReales;
};

estimacion.editarEstimacion = async ({ formulario }) => {
    console.clear();
 


    // Transformar la fecha del campo "date_hito_1" del formulario y almacenarla en una variable.
    var fechaTransformada_1 = transformarFecha(formulario.date_hito_1, "date_hito_1");

    // Transformar la fecha del campo "date_hito_2" del formulario y almacenarla en una variable.
    var fechaTransformada_2 = transformarFecha(formulario.date_hito_2, "date_hito_2");

    // Transformar la fecha del campo "date_hito_3" del formulario y almacenarla en una variable.
    var fechaTransformada_3 = transformarFecha(formulario.date_hito_3, "date_hito_3");

    // Transformar la fecha del campo "date_hito_4" del formulario y almacenarla en una variable.
    var fechaTransformada_4 = transformarFecha(formulario.date_hito_4, "date_hito_4");

    // Transformar la fecha del campo "date_hito_5" del formulario y almacenarla en una variable.
    var fechaTransformada_5 = transformarFecha(formulario.date_hito_5, "date_hito_5");

    // Transformar la fecha del campo "date_hito_6" del formulario y almacenarla en una variable.
    var fechaTransformada_6 = transformarFecha(formulario.date_hito_6, "date_hito_6");

    // Transformar la fecha del campo "custbody206" del formulario y almacenarla en una variable.
    var fechaTransformada_7 = transformarFecha(formulario.custbody206, "custbody206");

    // Transformar la fecha del campo "custbody179_date" del formulario y almacenarla en una variable.
    var fechaTransformada_8 = transformarFecha(formulario.custbody179_date, "custbody179_date");

    // Transformar la fecha del campo "custbody182_date" del formulario y almacenarla en una variable.
    var fechaTransformada_9 = transformarFecha(formulario.custbody182_date, "custbody182_date");

    // Transformar la fecha del campo "custbody184_date" del formulario y almacenarla en una variable.
    var fechaTransformada_10 = transformarFecha(formulario.custbody184_date, "custbody184_date");

    // Transformar la fecha del campo "custbody184_uno_date" del formulario y almacenarla en una variable.
    var fechaTransformada_11 = transformarFecha(formulario.custbody184_uno_date, "custbody184_uno_date");

    // Transformar la fecha del campo "custbody184_dos_date" del formulario y almacenarla en una variable.
    var fechaTransformada_12 = transformarFecha(formulario.custbody184_dos_date, "custbody184_dos_date");

    // Transformar la fecha del campo "custbody184_tres_date" del formulario y almacenarla en una variable.
    var fechaTransformada_13 = transformarFecha(formulario.custbody184_tres_date, "custbody184_tres_date");

    // Transformar la fecha del campo "fech_reserva" del formulario y almacenarla en una variable.
    var fechaTransformada_14 = transformarFecha(formulario.fech_reserva, "fech_reserva");

    function transformarFecha(fecha, campo) {
        // Validar si la fecha es vacía o no válida
        if (!fecha || typeof fecha !== "string") {
            console.warn("⚠️ Fecha vacía o formato inválido. No se realiza la transformación.");
            return null; // Retorna null o un valor predeterminado según tu necesidad
        }

        
        // Verificar el formato de la fecha y limpiarla si es necesario
        let fechaLimpia = fecha;
        
        // Si la fecha ya tiene barras (posiblemente ya está transformada)
        if (fecha.includes("/")) {
            // Verificar si tiene formato correcto ya (DD/MM/YYYY)
            const partes = fecha.split("/");
            if (partes.length === 3) {
                return fecha; // Ya está en formato correcto
            }
            // Limpiar formato incorrecto
            fechaLimpia = fecha.replace(/\//g, "-");
        }
        
        // Dividir la fecha por guiones
        var partesFecha = fechaLimpia.split("-");
        
        // Verificar que tengamos exactamente 3 partes (año, mes, día)
        if (partesFecha.length !== 3) {
            console.warn(`⚠️ Formato de fecha inválido para ${campo}: ${fecha}`);
            return null;
        }
        
        var dia = partesFecha[2];
        var mes = partesFecha[1];
        var anio = partesFecha[0];

        console.log("fecha después de transformar", campo, `${dia}/${mes}/${anio}`);
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

    try {
        const rest = nsrestlet.createLink(accountSettings, urlSettings);

        const body = await rest.put({
            rType: "estimate",
            id: formulario.idEst,
            custbody114: formulario.custbody114,
            /*MONTO TOTAL*/
            custbody_ix_total_amount: cleanAndParseInteger(formulario.custbody_ix_total_amount),
            /*OPORTUNIDAD*/
            opportunity: formulario.opportunity,
            /*PRECIO DE LISTA:formulario.*/
            custbody13: cleanAndParseInteger(formulario.custbody13),
            /*PRIMA TOTAL*/
            custbody39: cleanAndParseInteger(formulario.custbody39),
            /*PRIMA%*/
            custbody60: formulario.custbody60,
            /*MONTO PRIMA NETA%*/
            custbody_ix_salesorder_monto_prima: cleanAndParseInteger(formulario.custbody_ix_salesorder_monto_prima),
            /*MONTO DESCUENTO DIRECTO%*/
            custbody132: cleanAndParseInteger(formulario.custbody132),
            /*CASHBACK*/
            custbodyix_salesorder_cashback: formulario.custbodyix_salesorder_cashback,
            /*EXTRAS SOBRE EL PRECIO DE LISTA /diferencia*/
            custbody185: cleanAndParseInteger(formulario.custbody185),
            //MONTO EXTRAS SOBRE EL PRECIO DE LISTA / EXTRAS PAGADAS POR EL CLIENTE
            custbody46: cleanAndParseInteger(formulario.custbody46),
            //MONTO TOTAL DE CORTESÍAS
            custbody16: cleanAndParseInteger(formulario.custbody16),

            //DESCRIPCIÓN EXTRAS
            custbody47: formulario.custbody47,
            neta: cleanAndParseInteger(formulario.neta),
            fech_reserva: fechaTransformada_14,
            //DESCRIPCIÓN DE LAS CORTESIAS
            custbody35: formulario.custbody35,
            custbody75: formulario.custbody75,
            custbody67: formulario.custbody67,
            custbody_ix_salesorder_hito6: cleanAndParseInteger(formulario.custbody_ix_salesorder_hito6),
            custbody163: cleanAndParseInteger(formulario.custbody163),

            custbody62: formulario.custbody62,
            custbodyix_salesorder_hito1: cleanAndParseInteger(formulario.custbodyix_salesorder_hito1),
            custbody63: formulario.custbody63,
            custbody_ix_salesorder_hito2: cleanAndParseInteger(formulario.custbody_ix_salesorder_hito2),
            custbody64: formulario.custbody64,
            custbody_ix_salesorder_hito3: cleanAndParseInteger(formulario.custbody_ix_salesorder_hito3),
            custbody65: formulario.custbody65,
            custbody_ix_salesorder_hito4: cleanAndParseInteger(formulario.custbody_ix_salesorder_hito4),
            custbody66: formulario.custbody66,
            custbody_ix_salesorder_hito5: cleanAndParseInteger(formulario.custbody_ix_salesorder_hito5),
            hito_chek_uno: formulario.hito_chek_uno,
            hito_chek_dos: formulario.hito_chek_dos,
            hito_chek_tres: formulario.hito_chek_tres,
            hito_chek_cuatro: formulario.hito_chek_cuatro,
            hito_chek_cinco: formulario.hito_chek_cinco,
            hito_chek_seis: formulario.hito_chek_seis,
            date_hito_1: fechaTransformada_1,
            date_hito_2: fechaTransformada_2,
            date_hito_3: fechaTransformada_3,
            date_hito_4: fechaTransformada_4,
            date_hito_5: fechaTransformada_5,
            date_hito_6: fechaTransformada_6,
            custbody113: formulario.pre_reserva ? "T" : "F",
            custbody191: formulario.custbody191,
            custbody188: formulario.custbody188,
            custbody189: formulario.custbody189,
            custbody206: fechaTransformada_7,
            custbody190: formulario.custbody190,
            rateReserva: cleanAndParseInteger(formulario.custbody52),

            custbody176: formulario.custbody176 ? "T" : "F",
            custbody179: cleanAndParseInteger(formulario.custbody179),
            custbody180: formulario.custbody180,
            custbody193: formulario.custbody193,
            custbody179_date: fechaTransformada_8,

            custbody177: formulario.custbody177 ? "T" : "F",
            custbody181: cleanAndParseInteger(formulario.custbody181),
            custbody182: formulario.custbody182,
            custbody194: formulario.custbody194,
            custbody182_date: fechaTransformada_9,

            custbody178: formulario.custbody178 ? "T" : "F",
            custbody183: cleanAndParseInteger(formulario.custbody183),
            custbody184: formulario.custbody184,
            custbody195: formulario.custbody195,
            custbody184_date: fechaTransformada_10,

            prima_extra_uno: formulario.prima_extra_uno ? "T" : "F",
            monto_extra_uno: cleanAndParseInteger(formulario.monto_extra_uno),
            monto_tracto_uno: formulario.monto_tracto_uno,
            desc_extra_uno: formulario.desc_extra_uno,
            custbody184_uno_date: fechaTransformada_11,

            prima_extra_dos: formulario.prima_extra_dos ? "T" : "F",
            monto_extra_dos: cleanAndParseInteger(formulario.monto_extra_dos),
            monto_tracto_dos: formulario.monto_tracto_dos,
            desc_extra_dos: formulario.desc_extra_dos,
            custbody184_dos_date: fechaTransformada_12,

            prima_extra_tres: formulario.prima_extra_tres ? "T" : "F",
            monto_extra_tres: cleanAndParseInteger(formulario.monto_extra_tres),
            monto_tracto_tres: formulario.monto_tracto_tres,
            desc_extra_tres: formulario.desc_extra_tres,
            custbody184_tres_date: fechaTransformada_13,
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

estimacion.enviarEstimacionComoPreReserva = (dataParams) => {
    // Retorna una nueva promesa que maneja la operación de enviar una estimación como pre-reserva.
    return new Promise(function (resolve, reject) {
        // Configuración de la URL para el Restlet de NetSuite.
        var urlSettings = {
            url: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1774&deploy=1",
        };
        try {
            // Crea un enlace al Restlet usando las configuraciones de cuenta y URL.
            var rest = nsrestlet.createLink(accountSettings, urlSettings);

            // Realiza una solicitud POST al Restlet con el tipo de solicitud y el ID de la estimación.
            rest.post({ rType: "prereserva", id: dataParams.idEstimacion })
                .then(function (body) {
                    // Si la solicitud es exitosa, resuelve la promesa con un objeto de respuesta.
                    let response = { msg: "Pre reserva: ", Detalle: body, status: 200 };
                    resolve(response);
                })
                .catch(function (error) {
                    // Maneja cualquier error que ocurra durante la solicitud POST.
                    reject(error);
                });
        } catch (err) {
            // Captura y registra cualquier error que ocurra al crear el enlace o realizar la solicitud.
            console.log(error);
        }
    });
};

estimacion.actualizarEstimacionPreReserva = async (dataParams) => {
    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0];

    const fecha_prereserva = dataParams.fecha_prereserva || formattedDate;
    // Consulta SQL para seleccionar todas las estimaciones asociadas a una oportunidad específica,
    // ordenándolas por la fecha de caducidad en orden descendente.
    const query = "UPDATE estimaciones SET pre_reserva=1, envioPreReserva=?, fechaClienteComprobante_est=? WHERE idEstimacion_est=?";

    // Parámetro que contiene el ID de la oportunidad para filtrar los resultados.
    const params = [formattedDate, fecha_prereserva, dataParams.idEstimacion];

    const result = await executeQuery(query, params, dataParams.database);

    return result;
};


/**
 * Realiza una solicitud POST al Restlet de NetSuite para enviar una estimación como caída.
 * 
 * @param {Object} estimacion - Objeto que contiene los datos de la estimación.
 * @param {number} estimacion.id - ID de la estimación.
 * @param {string} estimacion.motivo - Motivo de la caída.
 * @param {string} estimacion.comentario - Comentario de la caída.
 * @returns {Promise<Object>} Resultado de la ejecución de la consulta.
 */

estimacion.caidaReserva = (estimacion) => {

    // Retorna una nueva promesa que maneja la operación de enviar una estimación como pre-reserva.
    return new Promise(function (resolve, reject) {
        // Configuración de la URL para el Restlet de NetSuite.
        var urlSettings = {
            url: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1774&deploy=1",
        };
        try {
            // Crea un enlace al Restlet usando las configuraciones de cuenta y URL.
            var rest = nsrestlet.createLink(accountSettings, urlSettings);

            // Realiza una solicitud POST al Restlet con el tipo de solicitud y el ID de la estimación.
            rest.put({ rType: "caida", id: estimacion.id, motivo: estimacion.motivo, comentario: estimacion.comentario })
                .then(function (body) {
                    // Si la solicitud es exitosa, resuelve la promesa con un objeto de respuesta.
                    let response = { msg: "Caida: ", Detalle: body, status: 200 };
                    resolve(response);
                })
                .catch(function (error) {
                    // Maneja cualquier error que ocurra durante la solicitud POST.
                    reject(error);
                });
        } catch (err) {
            // Captura y registra cualquier error que ocurra al crear el enlace o realizar la solicitud.
            console.log(error);
        }
    });
 }


 /**
 * Modifica la estimación de un cliente y actualiza el estado del lead asociado.
 * 
 * @param {Object} dataParams - Parámetros necesarios para la actualización.
 * @param {number} dataParams.idEstimacion - ID de la estimación a modificar.
 * @param {number} dataParams.IdCliente - ID del cliente asociado.
 * @param {number} dataParams.status - Nuevo estado para el lead.
 * @param {Object} dataParams.database - Conexión a la base de datos.
 * @returns {Promise<Object>} Resultado de la ejecución de la consulta.
 */
 estimacion.ModificarEstimacionCliente = async ({ idEstimacion, IdCliente, status, database }) => {
    const formattedDate = new Date().toISOString().split('T')[0];

    // Actualiza la estimación marcándola como caída
    const result = await executeQuery(
        "UPDATE estimaciones SET status=0, pre_caida=1, envioPreReservaCaida=? WHERE idEstimacion_est=?",
        [formattedDate, idEstimacion],
        database
    );

    // Actualiza el estado del lead asociado
    const result2 = await executeQuery(
        "UPDATE leads SET status=? WHERE idinterno_lead=?",
        [status, IdCliente],
        database
    );

    return { result, result2 };
};


// Exportamos el módulo para su uso en otras partes del proyecto.
module.exports = estimacion;
