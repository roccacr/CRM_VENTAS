// Importamos las configuraciones necesarias desde el archivo de configuración.
const config = require("../../config/config");

// Importamos el módulo 'nsrestlet' para realizar llamadas a la API de NetSuite Restlet.
const nsrestlet = require("nsrestlet");
const expedientes = require("./expedientes");

// Configuración de credenciales para acceder a NetSuite.
const accountSettings = {
    accountId: config.oauthNetsuite.realm,
    tokenKey: config.oauthNetsuite.token.id,
    tokenSecret: config.oauthNetsuite.token.secret,
    consumerKey: config.oauthNetsuite.consumer.key,
    consumerSecret: config.oauthNetsuite.consumer.secret,
};

// Definimos las URL del Restlet en NetSuite.
const urlSettings = {
    url: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1764&deploy=1",
};

// Creamos un objeto que contendrá las funciones relacionadas con NetSuite.
const expedientesNetsuite = {};

// Función para obtener un expediente de NetSuite por su ID.
expedientesNetsuite.obtenerExp = async (exp) => {
    try {
        const rest = nsrestlet.createLink(accountSettings, urlSettings);
        const body = await rest.get({
            rType: "customrecord_ix_record_exp_unidades",
            id: exp,
        });
        return {
            msg: "Expediente obtenido exitosamente",
            Detalle: body,
            status: 200,
        };
    } catch (error) {
        console.error("Error al obtener expediente:", error);
        throw error;
    }
};

// Función para actualizar un expediente llamando a obtenerExp.
expedientesNetsuite.updateExpediente = async ({ id_expediente, database }) => {
    try {
        const result = await expedientesNetsuite.obtenerExp(id_expediente);
        const data = result.Detalle;

        const resulUpdate = await expedientes.updateFile(data, database, id_expediente);

        return resulUpdate;
    } catch (error) {
        console.error("Error en updateExpediente:", error);
        throw error;
    }
};

// Exportamos el módulo para su uso en otras partes del proyecto.
module.exports = expedientesNetsuite;
