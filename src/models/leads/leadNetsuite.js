// Requerimos el archivo de configuración donde están almacenadas las credenciales y configuraciones necesarias.
var config = require("../../config/config");

// Requerimos el módulo 'nsrestlet' que es utilizado para crear el enlace y realizar las llamadas a los servicios de NetSuite Restlet.
var nsrestlet = require("nsrestlet");

// Definimos el objeto 'accountSettings' que contiene las credenciales de autenticación para acceder a la API de NetSuite.
// Estas credenciales incluyen el ID de la cuenta, el token de acceso y los secretos del consumidor.
var accountSettings = {
    accountId: config.oauthNetsuite.realm, // ID de la cuenta de NetSuite
    tokenKey: config.oauthNetsuite.token.id, // Token de acceso (OAuth) para la autenticación
    tokenSecret: config.oauthNetsuite.token.secret, // Secreto del token (OAuth)
    consumerKey: config.oauthNetsuite.consumer.key, // Clave del consumidor (OAuth)
    consumerSecret: config.oauthNetsuite.consumer.secret, // Secreto del consumidor (OAuth)
};

// Definimos un objeto vacío 'leadNetsuite' para almacenar nuestras funciones relacionadas con NetSuite.
var leadNetsuite = {};

// Función asíncrona que obtiene datos de un lead desde NetSuite usando la API Restlet.
// Esta función toma como parámetro un objeto con 'idLead' que es el ID del lead que deseamos obtener.
leadNetsuite.getDataLead_Netsuite = async ({ idLead }) => {
    // Definimos los ajustes de la URL donde se encuentra el Restlet que vamos a consumir.
    const urlSettings = {
        url: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1764&deploy=1",
        // El parámetro 'script' indica el ID del script Restlet en NetSuite y 'deploy' es la versión del despliegue.
    };

    try {
        // Creamos el enlace a la API de NetSuite utilizando las configuraciones de cuenta y URL.
        const rest = nsrestlet.createLink(accountSettings, urlSettings);

        // Realizamos una solicitud GET al Restlet, enviando el tipo de recurso ('customer') y el ID del lead que queremos obtener.
        const body = await rest.get({ rType: "customer", id: idLead });

        // Si la solicitud es exitosa, construimos un objeto de respuesta con un mensaje, los detalles del lead y el estado HTTP 200.
        const response = {
            msg: "Obtener idLead: ", // Mensaje de éxito con el ID del lead
            Detalle: body, // Detalle de la respuesta obtenida desde NetSuite
            status: 200, // Código de estado HTTP que indica éxito
        };

        // Retornamos la respuesta exitosa.
        return response;
    } catch (error) {
        // En caso de error, lo capturamos y mostramos un mensaje de error en la consola.
        console.error("Error:", error);

        // Propagamos el error hacia arriba para que pueda ser manejado en el nivel superior si es necesario.
        throw error;
    }
};

// Exportamos el módulo 'leadNetsuite' para que pueda ser utilizado en otras partes del proyecto.
module.exports = leadNetsuite;
