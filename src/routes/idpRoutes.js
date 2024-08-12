const dotenv = require("dotenv");
const helpers = require("../utils/helpers");
const authenticated = require("../models/authenticated/authenticated");
const home = require("../models/home/home");

// Load environment variables
dotenv.config();

// Global API prefix
const API_PREFIX = "/api/v2.0";

/**
 * Middleware to validate the access token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateAccessToken = (req, res, next) => {
    if (process.env.TOKEN_ACCESS === req.body.token_access) {
        next();
    } else {
        res.status(401).json({
            statusCode: 401,
            message: "Unauthorized access. Invalid token.",
        });
    }
};

/**
 * Generic request handler for model operations
 * @param {Object} model - The model object containing the method to be called
 * @param {string} method - The name of the method to be called on the model
 * @returns {Function} Express middleware function to handle the request
 */
const handleRequest = (model, method) => (req, res) => {
    model[method](req.body)
        .then((resp) => helpers.manageResponse(res, resp, null))
        .catch((err) => helpers.manageResponse(res, null, err));
};

/**
 * Configure application routes
 * @param {Object} app - Express application instance
 */
module.exports = function (app) {
    // API health check route
    app.get("/", (_, res) => res.status(200).json({ message: "SHOWTIME API ACTIVE", status: "OK" }));

    // Authentication Routes
    // These routes handle user authentication processes
    const authRoutes = [{ path: "/login", method: "startSession" }];

    // Set up authentication routes
    authRoutes.forEach(({ path, method }) => {
        app.post(`${API_PREFIX}${path}`, validateAccessToken, handleRequest(authenticated, method));
    });

    // Lead Routes
    // These routes manage lead-related operations
    const leadRoutes = [
        { path: "/home/new", method: "fetchLeadsAsyncNew" },
        { path: "/home/attention", method: "fetchLeadsAsyncattention" },
    ];

    // Set up lead routes
    leadRoutes.forEach(({ path, method }) => {
        app.post(`${API_PREFIX}${path}`, validateAccessToken, handleRequest(home, method));
    });

    // Event Routes
    // These routes handle event-related operations
    const eventRoutes = [{ path: "/events/home/events", method: "fetchEventsAsync" }];

    // Set up event routes
    eventRoutes.forEach(({ path, method }) => {
        app.post(`${API_PREFIX}${path}`, validateAccessToken, handleRequest(home, method));
    });
};
