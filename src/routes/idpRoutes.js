// Carga las variables de entorno desde el archivo .env
const dotenv = require("dotenv");
// Importa funciones de utilidad para gestionar respuestas HTTP
const helpers = require("../utils/helpers");
// Importa el modelo para la autenticación de usuarios
const authenticated = require("../models/authenticated/authenticated");
// Importa el modelo para las operaciones relacionadas con 'home'
const home = require("../models/home/home");
// Importa el modelo para las operaciones relacionadas con 'leads'
const leads = require("../models/leads/leads");


// Importa el modelo para las operaciones relacionadas con 'calendars'
const calendars = require("../models/calendars/calendars");

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
            category: "Autenticación", // Categoría: Autenticación
            model: authenticated, // Modelo asociado a la autenticación
            routes: [
                { path: "/login", method: "startSession" }, // Ruta para iniciar sesión
            ],
        },
        {
            category: "Home", // Categoría: Home
            model: home, // Modelo asociado a 'home'
            routes: [
                { path: "/home/getAllBanners", method: "getAllBanners" }, // Ruta para obtener todos los banners
                { path: "/home/getAllEventsHome", method: "getAllEventsHome" }, // Ruta para obtener todos los eventos del home
                { path: "/home/updateEventStatus", method: "updateEventStatus" }, // Ruta para actualizar el estado de un evento
                { path: "/home/getMonthlyDatakpi", method: "fetchGetMonthlyDataKpi" }, // Ruta para obtener los datos mensuales de KPIs
                { path: "/home/getMonthlyData", method: "getMonthlyData" }, // Ruta para obtener los datos mensuales
                { path: "/home/fetchupdateEventDate", method: "fetchupdateEventDate" }, // Ruta para actualizar la fecha de un evento
            ],
        },
        {
            category: "Leads", // Categoría: Leads
            model: leads, // Modelo asociado a 'leads'
            routes: [
                { path: "/leads/getAll_LeadsNew", method: "getAll_LeadsNew" }, // Ruta para obtener todos los leads nuevos
                { path: "/leads/getAll_LeadsAttention", method: "getAll_LeadsAttention" }, // Ruta para obtener los leads que requieren atención
                { path: "/leads/getBitacora", method: "getBitacora" }, // Ruta para obtener la bitácora de un lead específico
                { path: "/leads/getAll_LeadsComplete", method: "getAll_LeadsComplete" }, // Ruta para obtener todos los leads (completos)
                { path: "/leads/getAll_LeadsRepit", method: "getAll_LeadsRepit" }, // Ruta para obtener todos los leads repetidos
                { path: "/leads/get_Specific_Lead", method: "get_Specific_Lead" }, // Ruta para obtener todos los datos de un lead específico
            ],
        },

        {
            category: "calendars", // Categoría: calendars
            model: calendars, // Modelo asociado a 'calendars'
            routes: [
                { path: "/calendars/get_Calendars", method: "get_Calendars" }, // Ruta para obtener todos los eventos del calendars
                { path: "/calendars/createEvent", method: "createEvent" }, // Ruta para obtener todos los eventos del calendars
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