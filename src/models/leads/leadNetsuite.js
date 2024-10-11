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
    // Extraer y validar los campos del formulario, proporcionando valores por defecto si son null o undefined.
    // En este caso, si algún campo no está presente o es null/undefined, se asigna un valor por defecto adecuado.
    const {
        firstname_new = "", // Nombre del cliente, vacío por defecto para evitar errores al procesar
        email_new = "", // Correo electrónico del cliente, vacío por defecto, se sugiere una validación más adelante
        phone_new = "", // Teléfono del cliente, vacío por defecto, se podría validar el formato en otra etapa
        comentario_cliente_new = "", // Comentarios del cliente, vacío por defecto si no se proporciona
    } = formData;

    // Valores por defecto para campos opcionales que no siempre estarán presentes en el formulario
    const lastname_new = "-"; // Apellido, se deja como un guion en caso de ser requerido en la integración de Netsuite
    const middlename_new = "-"; // Segundo nombre, igual se deja con un valor por defecto para cumplir con requisitos de Netsuite

    // Validar y extraer los valores de los objetos select si no son null o undefined.
    // Estos campos provienen de selects dinámicos en el formulario, como campañas, proyectos, y subsidiarias.
    const campana_value = formData.campana_new?.value || null; // Validación para obtener el id de la campaña seleccionada
    const proyecto_value = formData.proyecto_new?.value || null; // Id del proyecto, si fue seleccionado
    const subsidiary_value = formData.subsidiary_new?.value || null; // Id de la subsidiaria seleccionada, null si no existe
    const vendedor_value = formData.vendedor_new?.value || idnetsuite_admin; // Asignar el vendedor o usar el id del administrador por defecto
    const corredor_value = formData.corredor_lead_new?.value || ""; // Validar el valor del corredor, por defecto se asigna una cadena vacía

    // Configuración de la URL para la solicitud POST al servicio RESTlet de Netsuite
    const urlSettings = {
        url: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1763&deploy=1", // URL de la API en Netsuite
    };

    try {
        // Crear el enlace RESTlet utilizando la configuración de la cuenta y la URL proporcionada
        const rest = nsrestlet.createLink(accountSettings, urlSettings);

        // Hacer la solicitud POST al RESTlet con los datos del nuevo lead
        const body = await rest.post({
            rType: "lead", // Tipo de registro en Netsuite, en este caso, es un lead
            firstname: firstname_new, // Nombre del cliente
            lastname: lastname_new, // Apellido, usando el valor por defecto si no fue proporcionado
            middlename: middlename_new, // Segundo nombre del cliente
            phone: phone_new, // Teléfono del cliente
            comentario_cliente: comentario_cliente_new, // Comentarios proporcionados por el cliente
            email: email_new, // Correo electrónico del cliente, se sugiere validar el formato antes de esta etapa
            campana: campana_value, // Id de la campaña de marketing asociada
            subsidiary: subsidiary_value, // Subsidiaria del lead
            proyecto: proyecto_value, // Proyecto al que está asociado el lead
            employee: vendedor_value, // Vendedor asignado, que puede ser el administrador por defecto
            currency: 1, // Moneda, en este caso es 1 (dólares), verificar si es siempre aplicable
            corredor_lead: corredor_value, // Información del corredor asignado, si existe
        });

        // Verificar si la respuesta de Netsuite fue exitosa
        if (body.status === 200) {
            // Si el corredor está definido (numérico o string), se almacena la información adicional
            if ((typeof corredor_value === "number" && corredor_value > 0) || (typeof corredor_value === "string" && corredor_value !== "")) {
                let idLead = body.id; // Obtener el id del lead creado
                // Insertar información adicional sobre el lead en la base de datos local
                await leads.insertInfo_extraLead(idLead, corredor_value, database);
            }
        }

        // Retornar el mensaje de éxito y el detalle del lead creado
        return { msg: "Lead creado exitosamente desde CRM Netsuite", Detalle: body, status: 200 };
    } catch (error) {
        // Captura y manejo de errores al realizar la solicitud
        console.error("Error al crear lead en Netsuite:", error);
        throw error; // Lanzar el error para manejarlo en niveles superiores si es necesario
    }
};

// Exportamos el módulo 'leadNetsuite' para que pueda ser utilizado en otras partes del proyecto.
module.exports = leadNetsuite;
