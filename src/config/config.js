const dotenv = require("dotenv");
dotenv.config(); // Carga las variables de entorno desde el archivo .env

const hostProduction = process.env.DB_HOST_PRODUCTION || "Valor por defecto si es null";
const userProduction = process.env.DB_USER_PRODUCTION || "Valor por defecto si es null";
const passProduction = process.env.DB_PASS_PRODUCTION || "Valor por defecto si es null";
const dbDevelopment = process.env.DB_NAME_DEVELOPMENT || "Valor por defecto si es null";
const dbProduction = process.env.DB_NAME_PRODUCTION || "Valor por defecto si es null";

console.log("hostProduction: ", hostProduction);
console.log("userProduction: ", userProduction);
console.log("passProduction: ", passProduction);
console.log("dbDevelopment: ", dbDevelopment);
console.log("dbProduction: ", dbProduction);

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
            host: "db-crms.cfxfgwugknzb.us-east-2.rds.amazonaws.com",
            user: "master_chief",
            password: "D8hPz3$K!rN4mQX2%#jA7T",
            database: "crmdatabase_ventas",
            port: 3306,
        },
        pruebas: {
            host: "db-crms.cfxfgwugknzb.us-east-2.rds.amazonaws.com",
            user: "master_chief",
            password: "D8hPz3$K!rN4mQX2%#jA7T",
            database: "crmdatabase_ventas",
            port: 3306,
        },
    },
    jwtSecret: jwtSecret,
};

module.exports = configParams;
