const dotenv = require('dotenv');
dotenv.config(); // Carga las variables de entorno desde el archivo .env
const jwtSecret = process.env.JWT_SECRET;

var configParams = {
    oauthNetsuite: {
        consumer: {
            key: process.env.OAUTH_NETSUITE_CONSUMER_KEY,
            secret: process.env.OAUTH_NETSUITE_CONSUMER_SECRET,
        },
        token: {
            id: process.env.OAUTH_NETSUITE_TOKEN_ID,
            secret: process.env.OAUTH_NETSUITE_TOKEN_SECRET,
        },
        realm: process.env.OAUTH_NETSUITE_REALM,
        signature: process.env.OAUTH_NETSUITE_SIGNATURE,
    },
    database: {
        produccion: {
            host: "localhost",
            user: "root",
            password: "!Roccacrm",
            database: "crmdatabase-api",
            port: 3306,

        },
        pruebas: {
            host: "localhost",
            user: "root",
            password: "",
            database: "crmdatabase-api",
            port: 3306,
        },
    },
    jwtSecret: jwtSecret,
};





module.exports = configParams;

