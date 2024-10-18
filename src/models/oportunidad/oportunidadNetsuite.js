// Importamos las configuraciones necesarias desde el archivo de configuración.
const config = require("../../config/config");
// Importamos el módulo 'nsrestlet' para realizar llamadas a la API de NetSuite Restlet.
const nsrestlet = require("nsrestlet");


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
    url: "https://4552704-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1763&deploy=1",
};

// Creamos un objeto que contendrá las funciones relacionadas con NetSuite.
const oportunidadNetsuite = {};

// Función para obtener un expediente de NetSuite por su ID.
oportunidadNetsuite.crear_Oportunidad = async ({ formValue, clientData }) => {
    try {
        const rest = nsrestlet.createLink(accountSettings, urlSettings);
        const body = await rest.post({
            rType: "oportunidad",
            entity: clientData.idinterno_lead,
            custbody38: formValue.expediente,
            entitystatus: formValue.estado,
            forecasttype: 2,
            probability: formValue.probabilidad,
            expectedclosedate: formValue.fechaCierrePrevista,
            custbody76: formValue.motivoCompra,
            custbody75: formValue.metodoPago,
            rangelow: formValue.precioLista,
            rangehigh: formValue.precioMinimo,
            projectedtotal: formValue.precioMinimo,
            subsidiary: clientData.idsubsidaria_lead,
            currency: 1,
            salesrep: clientData.id_empleado_lead,
            memo: formValue.memo,
            location: formValue.ubicacion,
            class: formValue.clase,
        });

        return {
            msg: "Crear Opportunity",
            Detalle: body,
            status: 200,
        };
    } catch (error) {
        console.error("Error al obtener oportuindad:", error);
        throw error;
    }
};




// Exportamos el módulo para su uso en otras partes del proyecto.
module.exports = oportunidadNetsuite;
