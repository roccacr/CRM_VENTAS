// Carga las variables de entorno desde el archivo .env para configurar la aplicación
const dotenv = require("dotenv");
// Importa funciones de utilidad para gestionar respuestas HTTP estándar
const helpers = require("../utils/helpers");
// Importa el modelo para la autenticación de usuarios
const authenticated = require("../models/authenticated/authenticated");
// Importa el modelo para las operaciones y datos del módulo 'home'
const home = require("../models/home/home");
// Importa el modelo para gestionar operaciones relacionadas con los 'leads'
const leads = require("../models/leads/leads");
const leadNetsuite = require("../models/leads/leadNetsuite");
// require("../models/leads/cronsLeads.js"); // Importa cron jobs para la gestión automatizada de leads

// Importa el modelo para gestionar los eventos en calendarios
const calendars = require("../models/calendars/calendars");
// Importa el modelo para las operaciones de expedientes
const expedientes = require("../models/expedientes/expedientes");
const expedientesNetsuite = require("../models/expedientes/expedientesNetsuite");

// Modelos para operaciones de oportunidades
const oportunidad = require("../models/oportunidad/oportunidad");
const oportunidadNetsuite = require("../models/oportunidad/oportunidadNetsuite");

const estimacion = require("../models/estimacion/estimacion");

const ordenVenta = require("../models/ordenVenta/ordenVenta");

// Cargar variables de entorno al iniciar la aplicación
dotenv.config();

// Prefijo global para las rutas de la API
const API_PREFIX = "/api/v2.0";

/**
 * Middleware para validar el token de acceso.
 * Compara el token enviado en la solicitud con el token almacenado en las variables de entorno.
 *
 * @param {Object} req - Solicitud HTTP
 * @param {Object} res - Respuesta HTTP
 * @param {Function} next - Función que permite continuar con el siguiente middleware
 */
const validateAccessToken = (req, res, next) => {
    // Extraer el token de las variables de entorno
    const { TOKEN_ACCESS } = process.env;
    // Extraer el token enviado en la solicitud
    const { token_access } = req.body;

    // Verificar si los tokens coinciden
    if (TOKEN_ACCESS === token_access) {
        // Si el token es válido, continuar con el siguiente middleware
        next();
    } else {
        // Si el token no es válido, devolver un error 401 de acceso no autorizado
        res.status(401).json({
            statusCode: 401,
            message: "Unauthorized access. Invalid token.",
        });
    }
};

/**
 * Manejador genérico de solicitudes para las operaciones de modelos.
 * Ejecuta el método correspondiente al modelo con los datos proporcionados en la solicitud.
 *
 * @param {Object} model - Modelo que contiene el método a ejecutar
 * @param {string} method - Método del modelo que se va a ejecutar
 * @returns {Function} Función que maneja la solicitud HTTP y responde con los datos o errores.
 */
const handleRequest = (model, method) => async (req, res) => {
    try {
        // Ejecuta el método del modelo con los datos del cuerpo de la solicitud
        const response = await model[method](req.body);
        // Gestiona la respuesta exitosa utilizando el helper
        helpers.manageResponse(res, response, null);
    } catch (error) {
        // Gestiona los errores en caso de que falle la solicitud
        helpers.manageResponse(res, null, error);
    }
};

/**
 * Configuración de rutas para la API.
 * Define y registra las rutas dinámicamente en función de la configuración proporcionada.
 *
 * @param {Object} app - Instancia de Express
 */
module.exports = function (app) {
    // Ruta para verificar que la API está activa
    app.get("/", (_, res) => res.status(200).json({ message: "SHOWTIME API ACTIVE", status: "OK" }));

    // Configuración de las rutas por categoría y modelo
    const routesConfig = [
        {
            category: "Autenticación", // Categoría: Rutas de autenticación de usuarios
            model: authenticated, // Modelo asociado a la autenticación
            routes: [
                { path: "/login", method: "startSession" }, // Ruta para iniciar sesión y generar una nueva sesión de usuario
                { path: "/admins/validarUsuario", method: "SP_VALIDAR_EMAIL" }, // Validar si un correo electrónico ya está registrado
                { path: "/admins/recuperar_Contrasena", method: "SP_RECUPERAR_CONTRASENA" }, // Recuperar contraseña mediante correo electrónico
            ],
        },
        {
            category: "Home", // Categoría: Funcionalidades principales de la página de inicio
            model: home, // Modelo asociado al módulo Home
            routes: [
                { path: "/home/getAllBanners", method: "getAllBanners" }, // Ruta para obtener todos los banners de la página de inicio
                { path: "/home/getAllEventsHome", method: "getAllEventsHome" }, // Ruta para listar todos los eventos mostrados en la vista principal
                { path: "/home/updateEventStatus", method: "updateEventStatus" }, // Ruta para actualizar el estado de un evento específico
                { path: "/home/getMonthlyDatakpi", method: "fetchGetMonthlyDataKpi" }, // Ruta para obtener datos mensuales de KPIs
                { path: "/home/getMonthlyData", method: "getMonthlyData" }, // Ruta para obtener información agregada mensual
                { path: "/home/fetchupdateEventDate", method: "fetchupdateEventDate" }, // Ruta para actualizar la fecha de un evento específico
            ],
        },
        {
            category: "Leads", // Categoría: Gestión de leads y seguimiento
            model: leads, // Modelo asociado a los leads
            routes: [
                { path: "/leads/getAll_LeadsNew", method: "getAll_LeadsNew" }, // Ruta para obtener los leads nuevos
                { path: "/leads/getAll_LeadsAttention", method: "getAll_LeadsAttention" }, // Ruta para obtener los leads que requieren atención inmediata
                { path: "/leads/getBitacora", method: "getBitacora" }, // Ruta para obtener la bitácora de un lead específico
                { path: "/leads/getAll_LeadsComplete", method: "getAll_LeadsComplete" }, // Ruta para obtener todos los leads completos
                { path: "/leads/getAll_LeadsRepit", method: "getAll_LeadsRepit" }, // Ruta para obtener leads duplicados
                { path: "/leads/get_Specific_Lead", method: "get_Specific_Lead" }, // Ruta para obtener la información detallada de un lead específico
                { path: "/leads/insertBitcoraLead", method: "insertBitcoraLead" }, // Ruta para insertar un registro en la bitácora de un lead
                { path: "/leads/updateLeadActionApi", method: "updateLeadActionApi" }, // Ruta para actualizar una acción de un lead mediante la API
                { path: "/leads/getAllStragglers", method: "getAllStragglers" }, // Ruta para obtener leads rezagados o inactivos
                { path: "/leads/loss_reasons", method: "loss_reasons" }, // Ruta para obtener las razones de pérdida de leads
                { path: "/leads/setLostStatusForLeadTransactions", method: "loss_transactions" }, // Ruta para marcar las transacciones de un lead como perdidas
                { path: "/leads/getAllLeadsTotal", method: "getAllLeadsTotal" }, // Ruta para obtener un resumen total de leads y sus acciones
                { path: "/leads/getDataSelect_Campaing", method: "getDataSelect_Campaing" }, // Ruta para obtener las campañas disponibles
                { path: "/leads/getDataSelect_Proyect", method: "getDataSelect_Proyect" }, // Ruta para obtener los proyectos disponibles
                { path: "/leads/getDataSelect_Subsidiaria", method: "getDataSelect_Subsidiaria" }, // Ruta para obtener las subsidiarias disponibles
                { path: "/leads/getDataSelect_Admins", method: "getDataSelect_Admins" }, // Ruta para obtener la lista de administradores
                { path: "/leads/getDataSelect_Corredor", method: "getDataSelect_Corredor" }, // Ruta para obtener la lista de corredores
                { path: "/leads/getDataInformations_Lead", method: "getDataInformations_Lead" }, // Ruta para obtener información adicional de un lead
                { path: "/leads/eventos", method: "eventos" }, // Ruta para obtener los eventos del cliente
                { path: "/leads/oportunidades", method: "oportunidades" }, // Ruta para obtener los eventos del cliente
                { path: "/leads/update_LeadStatus", method: "update_LeadStatus" }, // Ruta para obtener los eventos del cliente
                
            ],
        },
        {
            category: "LeadsNetsuite", // Categoría: Integración con Netsuite para gestión de leads
            model: leadNetsuite, // Modelo asociado a la gestión de leads en Netsuite
            routes: [
                { path: "/leads/getDataLead_Netsuite", method: "getDataLead_Netsuite" }, // Ruta para obtener la información de un lead desde Netsuite
                { path: "/leads/createdNewLead_Netsuite", method: "createdNewLead_Netsuite" }, // Ruta para crear un nuevo lead en Netsuite
                { path: "/leads/editarInformacionLead_Netsuite", method: "editarInformacionLead_Netsuite" }, // Ruta para editar la información de un lead en Netsuite
            ],
        },
        {
            category: "Calendarios", // Categoría: Gestión de calendarios y eventos
            model: calendars, // Modelo asociado a la gestión de calendarios
            routes: [
                { path: "/calendars/get_Calendars", method: "get_Calendars" }, // Ruta para obtener todos los calendarios
                { path: "/calendars/createEvent", method: "createEvent" }, // Ruta para crear un nuevo evento en el calendario
                { path: "/calendars/getDataEevent", method: "getDataEevent" }, // Ruta para obtener información detallada de un evento
                { path: "/calendars/get_event_Citas", method: "get_event_Citas" }, // Ruta para verificar si un cliente tiene citas programadas
                { path: "/calendars/editEvent", method: "editEvent" }, // Ruta para editar un evento existente
                { path: "/calendars/update_event_MoveDate", method: "update_event_MoveDate" }, // Ruta para cambiar la fecha de un evento
                { path: "/calendars/update_Status_Event", method: "update_Status_Event" }, // Ruta para actualizar el estado de un evento
                { path: "/calendars/getAll_ListEvent", method: "getAll_ListEvent" }, // Ruta para obtener la lista completa de eventos
            ],
        },
        {
            category: "Expedientes", // Categoría: Gestión de expedientes
            model: expedientes, // Modelo asociado a la gestión de expedientes
            routes: [
                { path: "/expedientes/getAllExpedientes", method: "getFileList" }, // Ruta para obtener todos los expedientes
                { path: "/expedientes/getExpediente", method: "getExpediente" }, // Ruta para obtener todos los expedientes
            ],
        },
        {
            category: "ExpedientesNetsuite", // Categoría: Gestión de expedientes
            model: expedientesNetsuite, // Modelo asociado a la gestión de expedientes
            routes: [
                { path: "/expedientes/updateExpediente", method: "updateExpediente" }, // Ruta para actualizar un expediente existente
            ],
        },

        {
            category: "oportunidad", // Categoría: Gestión de expedientes
            model: oportunidad, // Modelo asociado a la gestión de expedientes
            routes: [
                { path: "/oportunidad/getUbicaciones", method: "getUbicaciones" }, // Retrieve available locations for opportunities
                { path: "/oportunidad/getClases", method: "getClases" }, // Retrieve available classes for opportunities
                //{ path: "/oportunidad/crear_Oportunidad", method: "crear_Oportunidad" }, // Create a new opportunity
                { path: "/oportunidad/getSpecificOportunidad", method: "getSpecificOportunidad" }, // Retrieve details of a specific opportunity
                { path: "/oportunidad/updateOpportunity_Probability", method: "updateOpportunity_Probability" }, // Update the probability of success for an opportunity
                { path: "/oportunidad/updateOpportunity_Status", method: "updateOpportunity_Status" }, // Update the status of an opportunity
                { path: "/oportunidad/get_Oportunidades", method: "get_Oportunidades" }, // ruta ara traer las oportunidades
            ],
        },

        {
            category: "oportunidadNetsuite", // Categoría: Gestión de expedientes
            model: oportunidadNetsuite, // Modelo asociado a la gestión de expedientes
            routes: [
                { path: "/oportunidad/crear_Oportunidad", method: "crear_Oportunidad" }, // Crear oportunidad en Netsuite
            ],
        },

        {
            category: "estimacion", // Categoría: Gestión de expedientes
            model: estimacion, // Modelo asociado a la gestión de expedientes
            routes: [
                { path: "/estimacion/CrearEstimacion", method: "crear_estimacion" }, // Crear oportunidad en Netsuite3
                { path: "/estimacion/ObtenerEstimacionesOportunidad", method: "ObtenerEstimacionesOportunidad" }, // Crear oportunidad en Netsuite
                { path: "/estimacion/extraerEstimacion", method: "extraerEstimacion" }, // Crear oportunidad en Netsuite
                { path: "/estimacion/editarEstimacion", method: "editarEstimacion" }, // Crear oportunidad en Netsuite
                { path: "/estimacion/enviarEstimacionComoPreReserva", method: "enviarEstimacionComoPreReserva" }, // Crear oportunidad en Netsuite
                { path: "/estimacion/actualizarEstimacionPreReserva", method: "actualizarEstimacionPreReserva" }, // Crear oportunidad en Netsuite
                { path: "/estimacion/caidaReserva", method: "caidaReserva" }, // Crear oportunidad en Netsuite
                { path: "/estimacion/ModificarEstimacionCliente", method: "ModificarEstimacionCliente" }, // Crear oportunidad en Netsuite
            ],
        },
        {
            category: "ordenVenta", // Categoría: Gestión de expedientes
            model: ordenVenta, // Modelo asociado a la gestión de expedientes
            routes: [
                { path: "/ordenVenta/listar", method: "enlistarOrdenesVenta" }, // Cextraer datos de ordenes de venta
                { path: "/ordenVenta/obtenerOrdendeventa", method: "obtenerOrdendeventa" }, // extarer datos de orden de venta
                { path: "/ordenVenta/aplicarComicion", method: "aplicarComicio" }, // actualizar datos de orden de venta
                { path: "/ordenVenta/crearOrdenVenta", method: "crearOrdenVenta" }, // actualizar datos de orden de venta
                { path: "/ordenVenta/insertarOrdenVentaBd", method: "insertarOrdenVentaBd" }, // Insertar datos de orden de venta en la base de datos
                
            ],
        },
    ];

    // Asignación de rutas dinámicamente
    routesConfig.forEach(({ category, model, routes }) => {
        routes.forEach(({ path, method }) => {
            // Define la ruta POST para cada método, validando el token antes de procesar la solicitud
            app.post(`${API_PREFIX}${path}`, validateAccessToken, handleRequest(model, method));
        });
    });
};
