// Requerimos el archivo de configuración donde están almacenadas las credenciales y configuraciones necesarias.
var config = require("../../config/config");

const leads = require("./leads");

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


// Función para crear un nuevo lead en Netsuite utilizando los datos del formulario y el id del administrador de Netsuite
leadNetsuite.createdNewLead_Netsuite = async ({ formData, idnetsuite_admin, database }) => {
    // Extraer y validar los campos del formulario, proporcionando valores por defecto si son null o undefined
    const {
        firstname_new = "", // Nombre del cliente, vacío por defecto
        email_new = "", // Correo electrónico del cliente, vacío por defecto
        phone_new = "", // Teléfono del cliente, vacío por defecto
        comentario_cliente_new = "", // Comentarios del cliente, vacío por defecto
    } = formData;

    // Valores por defecto para campos que no siempre están presentes
    const lastname_new = "-"; // Apellido por defecto
    const middlename_new = "-"; // Segundo nombre por defecto

    // Validar y extraer los valores de los objetos select si no son null o undefined
    const campana_value = formData.campana_new?.value || null;
    const proyecto_value = formData.proyecto_new?.value || null;
    const subsidiary_value = formData.subsidiary_new?.value || null;
    const vendedor_value = formData.vendedor_new?.value || idnetsuite_admin;
    const corredor_value = formData.corredor_lead_new?.value || "";

    // URL para la solicitud POST al servicio RESTlet de Netsuite
    const urlSettings = {
        url: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1763&deploy=1",
    };

    try {
        // Crear el enlace RESTlet
        const rest = nsrestlet.createLink(accountSettings, urlSettings);

        // Hacer la solicitud POST al RESTlet con los datos del nuevo lead
        const body = await rest.post({
            rType: "lead",
            firstname: firstname_new,
            lastname: lastname_new,
            middlename: middlename_new,
            phone: phone_new,
            comentario_cliente: comentario_cliente_new,
            email: email_new,
            campana: campana_value,
            subsidiary: subsidiary_value,
            proyecto: proyecto_value,
            employee: vendedor_value,
            currency: 1, // Moneda fija (1 = dólar, depende del contexto)
            corredor_lead: corredor_value,
        });

        if (body.status === 200) {
            if ((typeof corredor_value === "number" && corredor_value > 0) || (typeof corredor_value === "string" && corredor_value !== "")) {
                await leads.insertInfo_extraLead(body.id, corredor_value, database);
            }
        }
        return { msg: "Crear Cliente desde Crm Netsuite", Detalle: body, status: 200 };
    } catch (error) {
        // Manejo de errores y logging
        console.error("Error al crear lead en Netsuite:", error);
        throw error;
    }
};
// Exportamos el módulo 'leadNetsuite' para que pueda ser utilizado en otras partes del proyecto.
module.exports = leadNetsuite;
