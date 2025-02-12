// No es necesario require dotenv ya que GitHub Actions cargará las variables de entorno

// Carga las variables de entorno directamente desde GitHub Actions
const hostProduction = process.env.DB_HOST_PRODUCTION || "Valor por defecto si es null";
const userProduction = process.env.DB_USER_PRODUCTION || "Valor por defecto si es null";
const passProduction = process.env.DB_PASS_PRODUCTION || "Valor por defecto si es null";

console.log("🚀 --------------------------------------------------------🚀");
console.log("🚀 ~ file: config.js:8 ~ passProduction:", passProduction);
console.log("🚀 --------------------------------------------------------🚀");

const dbDevelopment = process.env.DB_NAME_DEVELOPMENT || "Valor por defecto si es null";
const dbProduction = process.env.DB_NAME_PRODUCTION || "Valor por defecto si es null";

const jwtSecret = process.env.JWT_SECRET;

// Configuración de parámetros basada en las variables de entorno
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
            host: hostProduction,
            user: userProduction,
            password: passProduction,
            database: dbProduction,
            port: 3306,
        },
        pruebas: {
            host: hostProduction,
            user: userProduction,
            password: passProduction,
            database: dbDevelopment,
            port: 3306,
        },
    },
    jwtSecret: jwtSecret,
};

// Exporta la configuración
module.exports = configParams;
