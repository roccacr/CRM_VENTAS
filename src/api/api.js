import axios from "axios";

/********************************************** BASE API URL DEFINITION **********************************************/

/**
 * Determines the base API URL based on the environment (local or production).
 * @returns {string} - The base API URL.
 */
const getApiUrl = () => {
    return window.location.hostname === "localhost" 
        ? "https://api-node-v2.roccacr.com/api/v2.0/" 
        : "https://api-node-v2.roccacr.com/api/v2.0/";
};

/**
 * Determines the base API URL for images, similar to the base API URL.
 * @returns {string} - The base API URL for images.
 */
const getApiUrlImg = () => {
    return getApiUrl();
};

/**
 * Determines the database name to use based on the environment.
 * @returns {string} - The database name ('pruebas' or 'produccion').
 */
const getDatabaseName = () => {
    return window.location.hostname === "localhost" ? "pruebas" : "produccion";
};

const apiUrl = getApiUrl();
const apiUrlImg = getApiUrlImg();
const databaseuse = getDatabaseName();

/********************************************** TOKEN DE ACCESO **********************************************/

// Secret key used for authentication (should be stored securely)
const secretKey = "9e-@5Y4cHdQ)5wT!uL*BzR#e^T@6f2X!";

/********************************************** COMMON REQUEST DATA **********************************************/

/**
 * Provides common request data for all API requests.
 * @returns {Object} - An object containing common request data.
 */
const getCommonRequestData = () => {
    return {
        token_access: "4jH6k-3m.b@s_T8",
        database: databaseuse,
        sqlQuery: "",
        type: "",
    };
};

const commonRequestData = getCommonRequestData();

/********************************************** FUNCTION TO MAKE API REQUESTS **********************************************/

/**
 * Makes API requests.
 * @param {string} endpoint - The API endpoint to request.
 * @param {Object} requestData - The data to send with the request.
 * @returns {Object} - An object with properties 'ok', 'data', and 'errorMessage'.
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

/**
 * Makes API requests to send files.
 * @param {string} endpoint - The API endpoint to request.
 * @param {Object} requestData - The data to send with the request, must include a FormData object.
 * @returns {Object} - An object with properties 'ok', 'data', and 'errorMessage'.
 */
const fetchDataFile = async (endpoint, requestData) => {
    try {
        const url = `${apiUrl}${endpoint}`;
        const response = await fetch(url, {
            method: "POST",
            body: requestData.formData, // requestData must contain a FormData object including all files and data
        });
        const responseData = await response.json();
        return { ok: true, data: responseData };
    } catch (error) {
        return { ok: false, errorMessage: error.message };
    }
};

/********************************************** EXPORT FUNCTIONS AND DATA **********************************************/

// Export functions and common data for use in other modules
export { fetchData, commonRequestData, secretKey, fetchDataFile, apiUrlImg };
