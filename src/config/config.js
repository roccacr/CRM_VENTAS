const dotenv = require("dotenv");
dotenv.config(); // Carga las variables de entorno desde el archivo .env

const hostProduction = process.env.DB_HOST_PRODUCTION || "Valor por defecto si es null";
const userProduction = process.env.DB_USER_PRODUCTION || "Valor por defecto si es null";
const passProduction = process.env.DB_PASS_PRODUCTION || "Valor por defecto si es null";
const dbDevelopment = process.env.DB_NAME_DEVELOPMENT || "Valor por defecto si es null";
const dbProduction = process.env.DB_NAME_PRODUCTION || "Valor por defecto si es null";


const OAUTH_NETSUITE_CONSUMER_KEY = process.env.NETSUITE_CONSUMER_KEY;
const OAUTH_NETSUITE_CONSUMER_SECRET = process.env.NETSUITE_CONSUMER_SECRET;
const OAUTH_NETSUITE_TOKEN_ID = process.env.NETSUITE_TOKEN_ID;
const OAUTH_NETSUITE_TOKEN_SECRET = process.env.NETSUITE_TOKEN_SECRET;
const OAUTH_NETSUITE_REALM = process.env.NETSUITE_REALM;
const OAUTH_NETSUITE_SIGNATURE = process.env.OAUTH_NETSUITE_SIGNATURE;




const jwtSecret = process.env.JWT_SECRET;

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
            connectionLimit: 30, // Ajusta según la carga de tu aplicación
            queueLimit: 0, // No limitar las consultas en cola
        },
        pruebas: {
            host: hostProduction,
            user: userProduction,
            password: passProduction,
            database: dbDevelopment,
            port: 3306,
            waitForConnections: true,
            connectionLimit: 30, // Ajusta según la carga de tu aplicación
            queueLimit: 0, // No limitar las consultas en cola
        },
    },
    jwtSecret: jwtSecret,
};

module.exports = configParams;
