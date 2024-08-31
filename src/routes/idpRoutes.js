const dotenv = require("dotenv");
const helpers = require("../utils/helpers");
const authenticated = require("../models/authenticated/authenticated");
const home = require("../models/home/home");

// Cargar variables de entorno
dotenv.config();

// Prefijo global para la API
const API_PREFIX = "/api/v2.0";

// Middleware para validar el token de acceso
const validateAccessToken = (req, res, next) => {
    const { TOKEN_ACCESS } = process.env;
    const { token_access } = req.body;

    if (TOKEN_ACCESS === token_access) {
        next();
    } else {
        res.status(401).json({
            statusCode: 401,
            message: "Unauthorized access. Invalid token.",
        });
    }
};

// Manejador genérico de solicitudes para operaciones de modelos
const handleRequest = (model, method) => async (req, res) => {
    try {
        const response = await model[method](req.body);
        helpers.manageResponse(res, response, null);
    } catch (error) {
        helpers.manageResponse(res, null, error);
    }
};

// Configurar rutas de la aplicación
module.exports = function (app) {
    // Ruta de verificación de salud de la API
    app.get("/", (_, res) => res.status(200).json({ message: "SHOWTIME API ACTIVE", status: "OK" }));

    // Configuración de rutas y métodos
    const routesConfig = [
        {
            category: "Autenticación",
            model: authenticated,
            routes: [{ path: "/login", method: "startSession" }],
        },
        {
            category: "Leads",
            model: home,
            routes: [
                { path: "/home/new", method: "fetchLeadsAsyncNew" },
                { path: "/home/attention", method: "fetchLeadsAsyncattention" },
            ],
        },
        {
            category: "Eventos",
            model: home,
            routes: [
                { path: "/events/home/events", method: "fetchEventsAsync" },
                { path: "/events/home/updateEventsStatusAsync", method: "updateEventsStatusAsync" },
            ],
        },
        {
            category: "Oportunidades",
            model: home,
            routes: [{ path: "/home/fetchOportunityAsync", method: "fetchOportunityAsync" }],
        },
        {
            category: "OrderSales",
            model: home,
            routes: [{ path: "/home/fetchAllOrderSale", method: "fetchAllOrderSale" }],
        },
    ];

    // Configuración y asignación de rutas
    routesConfig.forEach(({ category, model, routes }) => {
        routes.forEach(({ path, method }) => {
            app.post(`${API_PREFIX}${path}`, validateAccessToken, handleRequest(model, method));
        });
    });
};
