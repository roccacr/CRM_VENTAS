// Requerimos el archivo de configuración donde están almacenadas las credenciales y configuraciones necesarias.
var config = require("../../config/config");
const { executeQuery } = require("../conectionPool/conectionPool");

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

/**
 * Edita la información de un lead en NetSuite
 * @param {Object} params - Parámetros de la función
 * @param {Object} params.formData - Datos del formulario a actualizar
 * @param {string} params.idnetsuite_admin - ID del administrador de NetSuite
 * @returns {Promise} Respuesta de la actualización
 */
leadNetsuite.editarInformacionLead_Netsuite = async ({ formData,    database }) => {

    // Procesar nombre completo
    const nombres = formData.firstnames.split(/\s+/).filter(n => n.trim());
    const [nombre, primerApellido, ...restoApellidos] = nombres;
    const segundoApellido = restoApellidos.join(' ') || '.';

    // Validar información extra
    const camposInfoExtra = [
        'vatregnumber', 'custentity1', 'custentityestado_civil', 'altphone',
        'rango_edad', 'cantidad_hijos', 'custentity_ix_customer_profession',
        'defaultaddress'
    ];
    const informacion_Extra = camposInfoExtra.some(campo => formData[campo] === '') ? 0 : formData.informacion_Extra;

    // Validar corredor
    const corredor = formData.corredor_lead_edit.value !== 0 ? 1 : formData.corredor_extra;

    // Validar información extra adicional
    const camposInfoExtraDos = ['custentity77', 'custentity81', 'custentity82', 'custentity83'];
    const infromacion_extra = camposInfoExtraDos.some(campo => formData[campo] === '') ? 0 : formData.informacion_Extra;

    console.log(formData)

    const body = {
        tipos: "update_add_lead_id",
        id: formData.id,
        nombre,
        primerApellido,
        segundoApellido,
        comentario_cliente: formData.comentario_clientes,
        proyecto_new: formData.proyecto_new_edit.value,
        subsidiary_new: formData.subsidiary_new_edit.value,
        campana_new: formData.campana_new_edit.value,
        email: formData.emails,
        phone: formData.phones,
        employee: formData.employee,
        informacion_Extra,
        // Campos de información personal
        vatregnumber: formData.vatregnumber,
        custentity1: formData.custentity1,
        custentityestado_civil: formData.custentityestado_civil,
        altphone: formData.altphone,
        custentity11: formData.rango_edad?.replace(/[+-]/g, ''),
        custentityhijos_cliente: formData.cantidad_hijos,
        custentity_ix_customer_profession: formData.custentity_ix_customer_profession,
        // Campos de corredor
        corredor_extra: corredor,
        corredor_new: formData.corredor_lead_edit.value,
        // Campos de información extra
        infromacion_extra_dos: infromacion_extra,
        custentity77: formData.custentity77,
        custentity78: formData.custentity78,
        custentity79: formData.custentity79,
        custentity80: formData.custentityestado_civil_extra,
        custentity81: formData.custentity81,
        custentity82: formData.custentity82,
        custentity84: formData.custentity84
    };

    const urlSettings = {
        url: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1764&deploy=1"
    };

    try {
        const rest = nsrestlet.createLink(accountSettings, urlSettings);
        const response = await rest.put(body);

        if(response.status === 200){
            leadNetsuite.eliminar_LeadStatus(formData, database);
            leadNetsuite.update_LeadStatus(formData, database);
            leadNetsuite.update_LeadInformations(formData, database);

        }
        return {
            msg: "Actualizar cliente: ",
            Detalle: response,
        };
    } catch (error) {
        console.error("Error al actualizar lead:", error);
        throw error;
    }
};

/**
 * Construye el objeto de campos a actualizar para un lead
 * @param {Object} dataParams - Datos del lead a actualizar
 * @returns {Object} Objeto con los campos y valores a actualizar
 */
const buildLeadUpdateFields = (dataParams) => {
    return {
        nombre_lead: dataParams.firstnames,
        email_lead: dataParams.emails,
        telefono_lead: dataParams.phones,
        comentario_lead: dataParams.comentario_clientes,
        idproyecto_lead: dataParams.proyecto_new_edit.value,
        proyecto_lead: dataParams.proyecto_new_edit.label,
        idsubsidaria_lead: dataParams.subsidiary_new_edit.value,
        subsidiaria_lead: dataParams.subsidiary_new_edit.label,
        idcampana_lead: dataParams.campana_new_edit.value,
        campana_lead: dataParams.campana_new_edit.label
    };
};

/**
 * Construye la consulta SQL para actualizar un lead
 * @param {Object} updateFields - Campos a actualizar
 * @returns {string} Consulta SQL formateada
 */
const buildUpdateQuery = (updateFields) => {
    const setStatements = Object.entries(updateFields)
        .map(([field, value]) => `${field}="${value}"`)
        .join(',\n    ');
    
    return `UPDATE leads 
    SET 
    ${setStatements}
    WHERE idinterno_lead = ?`;
};

/**
 * Actualiza el estado de un lead en la base de datos local
 * @param {Object} dataParams - Parámetros del lead incluyendo datos y conexión a BD
 * @returns {Promise} Resultado de la ejecución de la consulta
 * @throws {Error} Si hay un error en la actualización
 */
leadNetsuite.update_LeadStatus = async (dataParams, database) => {
    try {
        // Construir campos a actualizar
        const updateFields = buildLeadUpdateFields(dataParams);
        
        // Generar consulta SQL
        const query = buildUpdateQuery(updateFields);
        
        // Ejecutar actualización
        return await executeQuery(
            query,
            [dataParams.id],
            database
        );
    } catch (error) {
        console.error('Error actualizando estado del lead:', error);
        throw new Error(`Error actualizando lead: ${error.message}`);
    }
};

/**
 * Construye el objeto con los campos básicos del lead
 * @param {Object} dataParams - Datos del lead
 * @returns {Object} Objeto con los campos básicos
 */
const buildBasicLeadFields = (dataParams) => ({
    cedula_lead: dataParams.vatregnumber,
    Nacionalidad_lead: dataParams.custentity1,
    Estado_ciLead: dataParams.custentityestado_civil,
    Edad_lead: dataParams.rango_edad,
    Profesion_lead: dataParams.custentity_ix_customer_profession,
    Hijos_lead: dataParams.cantidad_hijos,
    TelefonoAlternatovo_lead: dataParams.altphone,
    Direccion: dataParams.defaultaddress,
    Corredor_lead: dataParams.corredor_lead_edit.value
});

/**
 * Construye el objeto con los campos extra del lead
 * @param {Object} dataParams - Datos adicionales del lead
 * @returns {Object} Objeto con los campos extra
 */
const buildExtraLeadFields = (dataParams) => ({
    nombre_extra_lead: dataParams.custentity77,
    cedula_extra_lead: dataParams.custentity78,
    profesion_extra_lead: dataParams.custentity79,
    estado_civil_extra_lead: dataParams.custentityestado_civil,
    telefono_extra_lead: dataParams.custentity82,
    nacionalidad_extra_lead: dataParams.custentity81,
    email_extra_lead: dataParams.custentity84
});

/**
 * Construye el objeto con la información adicional del lead
 * @param {Object} dataParams - Información adicional del lead
 * @returns {Object} Objeto con la información adicional
 */
const buildAdditionalInfoFields = (dataParams) => ({
    info_extra_ingresos: dataParams.ingresos,
    info_extra_MotivoCompra: dataParams.motivo_compra,
    info_extra_MomentodeCompra: dataParams.momento_compra,
    info_extra_Trabajo: dataParams.lugar_trabajo,
    info_extra_OrigenFondo: dataParams.origen_fondos,
    info_extra_ZonaRecidencia: dataParams.zona_residencia
});

/**
 * Construye la consulta SQL para actualizar la información del lead
 * @param {Object} allFields - Todos los campos a actualizar
 * @returns {string} Consulta SQL formateada
 */
const buildLeadInfoUpdateQuery = (allFields) => {
    const setStatements = Object.entries(allFields)
        .map(([field, value]) => `${field}="${value}"`)
        .join(',\n        ');
    
    return `UPDATE info_extra_lead 
        SET 
        ${setStatements}
        WHERE id_lead_fk = ?`;
};

/**
 * Actualiza la información extra de un lead en la base de datos
 * @param {Object} dataParams - Parámetros del lead
 * @param {Object} database - Conexión a la base de datos
 * @returns {Promise} Resultado de la actualización
 * @throws {Error} Si hay un error en la actualización
 */
leadNetsuite.update_LeadInformations = async (dataParams, database) => {
    try {


        const query1 = `INSERT INTO info_extra_lead(id_lead_fk) VALUES (?)`
        
        await executeQuery(query1, [dataParams.id], database);




        // Combinar todos los campos en un solo objeto
        const allFields = {
            ...buildBasicLeadFields(dataParams),
            ...buildExtraLeadFields(dataParams),
            ...buildAdditionalInfoFields(dataParams)
        };

        // Construir y ejecutar la consulta
        const query = buildLeadInfoUpdateQuery(allFields);
        
        return await executeQuery(query, [dataParams.id], database);
    } catch (error) {
        console.error('Error actualizando información del lead:', error);
        throw new Error(`Error actualizando información del lead: ${error.message}`);
    }
};

leadNetsuite.eliminar_LeadStatus = async (dataParams, database) => {
    try {


    const query1 = `DELETE FROM info_extra_lead WHERE id_lead_fk = ?`
        
      return  await executeQuery(query1, [dataParams.id], database);  
    } catch (error) {
        console.error('Error actualizando información del lead:', error);
        throw new Error(`Error actualizando información del lead: ${error.message}`);
    }
};


// Exportamos el módulo 'leadNetsuite' para que pueda ser utilizado en otras partes del proyecto.
module.exports = leadNetsuite;
