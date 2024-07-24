import axios from "axios";

/********************************************** BASE API URL DEFINITION **********************************************/
// Define la URL base de la API
const apiUrl = window.location.hostname === "localhost" ? "http://localhost:7000/api/v2.0/" : "https://027b-186-4-2-178.ngrok-free.app/api/v2.0/";

console.log("🚀 -------------------------------------🚀");
console.log("🚀 ~ file: api.js:7 ~ apiUrl:", apiUrl);
console.log("🚀 -------------------------------------🚀");


// Define la URL base de la API para imágenes
const apiUrlImg = window.location.hostname === "localhost" ? "http://localhost:7000/api/v2.0/" : "https://027b-186-4-2-178.ngrok-free.app/api/v2.0/";



/********************************************** TOKEN DE ACCESO         **********************************************/

// Clave secreta (constante, debe almacenarse de forma segura)
const secretKey = "9e-@5Y4cHdQ)5wT!uL*BzR#e^T@6f2X!";





/********************************************** COMMON REQUEST DATA **********************************************/

/**
 * Objeto que contiene los datos comunes para todas las solicitudes a la API.
 * Estos datos se enviarán en cada solicitud a la API.
 *token de acceso para autenticación
    *database: Nombre de la base de datos (PRUEBAS O PRODUCCIÓN)
    *sqlQuery: Consulta SQL (inicialmente vacía)
    *type: Tipo de solicitud (cadena vacía por defecto)
*/
const commonRequestData = {
    token_access: "4jH6k-3m.b@s_T8",
    database: "pruebas",
    sqlQuery: "",
    type: "",
};

/********************************************** FUNCTION TO MAKE API REQUESTS **********************************************/

/**
 esta función se encarga de realizar solicitudes a la API, recibe dos parámetros:
    - endpoint: la ruta de la API a la que se realizará la solicitud
    - requestData: los datos que se enviarán en la solicitud
    La función retorna un objeto con dos propiedades:
    - ok: un booleano que indica si la solicitud fue exitosa o no
    - data: los datos obtenidos de la API (si la solicitud fue exitosa)
    - errorMessage: un mensaje de error (si la solicitud falla)
    - se envia commonRequestData y requestData en la solicitud
*/

const fetchData = async (endpoint, requestData) => {
    try {
        const url = `${apiUrl}${endpoint}`;
        const response = await axios.post(url, requestData, {
            headers: {
                "Content-Type": "application/json",
            },
        });
        return { ok: true, data: response.data };
    } catch (error) {
        return { ok: false, errorMessage: error.message };
    }
};

/*
    Esta función se encarga de realizar solicitudes a la API para enviar archivos, recibe dos parámetros:
    - endpoint: la ruta de la API a la que se realizará la solicitud
    - requestData: los datos que se enviarán en la solicitud
    La función retorna un objeto con dos propiedades:
    - ok: un booleano que indica si la solicitud fue exitosa o no
    - data: los datos obtenidos de la API (si la solicitud fue exitosa)
    - errorMessage: un mensaje de error (si la solicitud falla)
    - se envia commonRequestData y requestData en la solicitud
    -- en este metodo se utiliza unicamente para enviar archivos o imagenes
*/
const fetchDataFile = async (endpoint, requestData) => {
    try {
        // Construye la URL completa para la solicitud
        const url = `${apiUrl}${endpoint}`;
        // Configura la solicitud usando fetch. requestData ya debe incluir el objeto FormData adecuadamente configurado
        const response = await fetch(url, {
            method: "POST",
            body: requestData.formData, // requestData debe contener un objeto FormData que incluye todos los archivos y datos
        });
        // Parsear la respuesta como JSON
       const responseData = await response.json();

       return { ok: true, data: responseData };
    } catch (error) {
        // Retorna un objeto de error si la solicitud falla
        return { ok: false, errorMessage: error.message };
    }
};



/********************************************** EXPORT FUNCTIONS AND DATA **********************************************/

// Exporta funciones y datos comunes para su uso en otros módulos
export { fetchData, commonRequestData, secretKey, fetchDataFile, apiUrlImg };
