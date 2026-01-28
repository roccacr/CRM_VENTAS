const dotenv = require("dotenv");
dotenv.config(); // Carga las variables de entorno desde el archivo .env

const hostProduction = process.env.DB_HOST_PRODUCTION || "";
const userProduction = process.env.DB_USER_PRODUCTION || "";
const passProduction = process.env.DB_PASS_PRODUCTION || "";
const dbDevelopment = process.env.DB_NAME_DEVELOPMENT || "";
const dbProduction = process.env.DB_NAME_PRODUCTION || "";


const OAUTH_NETSUITE_CONSUMER_KEY = process.env.NETSUITE_CONSUMER_KEY;
const OAUTH_NETSUITE_CONSUMER_SECRET = process.env.NETSUITE_CONSUMER_SECRET;
const OAUTH_NETSUITE_TOKEN_ID = process.env.NETSUITE_TOKEN_ID;
const OAUTH_NETSUITE_TOKEN_SECRET = process.env.NETSUITE_TOKEN_SECRET;
const OAUTH_NETSUITE_REALM = process.env.NETSUITE_REALM;
const OAUTH_NETSUITE_SIGNATURE = process.env.OAUTH_NETSUITE_SIGNATURE;




const jwtSecret = process.env.JWT_SECRET;

// Configuración de correo electrónico
const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || ''
    },
    from: process.env.API_NOTIFICATION_EMAIL ,
    securityPrefix: process.env.API_SECURITY_PREFIX 
};

var configParams = {
    oauthNetsuite: {
        consumer: {
            key: OAUTH_NETSUITE_CONSUMER_KEY,
            secret: OAUTH_NETSUITE_CONSUMER_SECRET,
        },
        token: {
            id: OAUTH_NETSUITE_TOKEN_ID,
            secret: OAUTH_NETSUITE_TOKEN_SECRET,
        },
        realm: OAUTH_NETSUITE_REALM,
        signature: OAUTH_NETSUITE_SIGNATURE,
    },
    database: {
        produccion: {
            host: hostProduction,
            user: userProduction,
            password: passProduction,
            database: dbProduction,
            port: 3306,
            waitForConnections: true,
            connectionLimit: 30,
            queueLimit: 0,
        },
        pruebas: {
            host: hostProduction,
            user: userProduction,
            password: passProduction,
            database: dbDevelopment,
            port: 3306,
            waitForConnections: true,
            connectionLimit: 30,
            queueLimit: 0,
        },
    },
    email: emailConfig,
    jwtSecret: jwtSecret,
};

module.exports = configParams;
