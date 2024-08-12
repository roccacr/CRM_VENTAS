// Importación de módulos necesarios
const dotenv = require("dotenv");
const helpers = require("../utils/helpers");
const multer = require("multer");
const authenticated = require("../models/authenticated/authenticated");
const leads = require("../models/leads/leads");

// Cargar variables de entorno
dotenv.config();

/**
 * Middleware para validar el token de acceso
 * @param {Object} req - Objeto de solicitud
 * @param {Object} res - Objeto de respuesta
 * @param {Function} next - Función para pasar al siguiente middleware
 */
const validateAccessToken = (req, res, next) => {
    const { token_access } = req.body;

    const expectedToken = process.env.TOKEN_ACCESS;

    if (expectedToken === token_access) {
        console.log("Token de acceso válido");
        next();
    } else {
        console.log("Token de acceso inválido");
        res.status(401).json({
            statusCode: 401,
            message: "Acceso no autorizado. Token inválido.",
        });
    }
};

/**
 * Configuración de rutas de la aplicación
 * @param {Object} app - Instancia de la aplicación Express
 */
module.exports = function (app) {
    // Ruta general para verificar el estado de la API
    app.get("/", (req, res) => {
        res.status(200).json({ message: "API SHOWTIME ACTIVA", status: "OK" });
    });

    /**
     * Función para manejar solicitudes y respuestas
     * @param {Object} model - Modelo de datos
     * @param {string} method - Método a ejecutar en el modelo
     * @param {Object} req - Objeto de solicitud
     * @param {Object} res - Objeto de respuesta
     */
    function handleRequest(model, method, req, res) {
        model[method](req.body)
            .then((resp) => helpers.manageResponse(res, resp, null))
            .catch((err) => helpers.manageResponse(res, null, err));
    }

    /**
     * Ruta para iniciar sesión
     * Primero valida el token de acceso y luego maneja la solicitud de inicio de sesión
     */
    app.post("/api/v2.0/login", validateAccessToken, (req, res) => {
        handleRequest(authenticated, "startSession", req, res);
    });

    /**
     * Ruta para extraer la lista de todos los clientes
     * Primero valida el token de acceso y luego maneja la solicitud a la base de datos
     */
    app.post("/api/v2.0/leads/home", validateAccessToken, (req, res) => {
        handleRequest(leads, "fetchLeadsAsync", req, res);
    });
};
