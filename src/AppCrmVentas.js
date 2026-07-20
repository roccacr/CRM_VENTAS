// Importación de módulos necesarios
const express = require("express"); // Framework web para Node.js
const morgan = require("morgan"); // Middleware de registro HTTP
const cors = require("cors"); // Middleware para habilitar CORS
const helmet = require("helmet"); // Middleware para mejorar la seguridad de la aplicación
require("dotenv").config(); // Carga variables de entorno desde un archivo .env

// Importar cron jobs para que se inicialicen
require("./models/leads/cronsLeads");
require("./models/leads/autoLoseUncontactedLeads");
require("./models/calendars/cronsCalendars");
require("./models/oportunidad/cronsOportunidad");

//npm install ua-parser-js

// Creación de la instancia de la aplicación Express
const app = express();

// Definición del puerto del servidor
// Usa la variable de entorno PORT si está disponible, de lo contrario usa 6000
const port = process.env.PORT || 7000;

// Configuración del puerto en la aplicación
app.set("port", port);

// Middleware de seguridad
// Helmet ayuda a proteger la aplicación configurando varios encabezados HTTP
app.use(helmet());

// Middleware para analizar cuerpos JSON en las solicitudes
// Se establece un límite de 1mb para prevenir ataques de denegación de servicio
app.use(express.json({ limit: "1mb" }));

// Middleware para analizar cuerpos de solicitud codificados en URL
// También se establece un límite de 1mb
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Middleware de registro HTTP
// Usa el formato 'combined' en producción para más detalles, 'dev' en desarrollo para claridad
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Lista de orígenes permitidos para CORS
// Se define como una constante para mayor seguridad y claridad
const allowedOrigins = ["http://localhost:5174","http://localhost:5173", "https://crm.roccacr.com", "https://test.roccacr.com", "https://4552704-sb1.app.netsuite.com", "https://crmtest.roccacr.com"];

// Configuración de CORS
app.use(
    cors({
        // Función para verificar si el origen de la solicitud está permitido
        origin: function (origin, callback) {
            // Rechaza solicitudes sin origen (por ejemplo, solicitudes directas al servidor)
            if (!origin) return callback(null, false);
            // Permite el origen si está en la lista de orígenes permitidos
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            } else {
                // Rechaza el origen si no está en la lista permitida
                const msg = "The origin of your request is not allowed by the CORS policy.";
                return callback(new Error(msg), false);
            }
        },
        // Métodos HTTP permitidos (incluyendo OPTIONS para preflight requests)
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        // Headers permitidos
        allowedHeaders: [
            "Origin",
            "X-Requested-With", 
            "Content-Type", 
            "Accept", 
            "Authorization",
            "Cache-Control",
            "Pragma"
        ],
        // Headers expuestos al cliente
        exposedHeaders: ["Content-Length", "X-Foo", "X-Bar"],
        // Permitir credenciales (cookies, headers de autorización)
        credentials: true,
        // Tiempo de caché para preflight requests (en segundos)
        maxAge: 86400, // 24 horas
    }),
);

// Manejar solicitudes OPTIONS (preflight requests) de manera explícita
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 horas
    res.sendStatus(200);
});

// Importación y configuración de rutas
// Las rutas se definen en un archivo separado para mejor organización
require("./routes/idpRoutes")(app);

// Manejador de errores global
// Captura errores no manejados en la aplicación
app.use((err, req, res, next) => {
    // Registra el error en la consola para depuración
    console.error(err.stack);
    // Envía una respuesta genérica de error al cliente
    res.status(500).send("Something went wrong!");
});

// Inicio del servidor
app.listen(app.get("port"), () => {
    console.log(`[CRM API] iniciado en puerto ${app.get("port")} - PID ${process.pid}`);
});
