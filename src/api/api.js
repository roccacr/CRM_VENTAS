import axios from "axios";

/********************************************** BASE API URL DEFINITION **********************************************/

/**
 * Determines the base API URL based on the environment (local or production).
 * @returns {string} - The base API URL.
 */
const getApiUrl = () => {
  return window.location.hostname === "localhost"
    ? "http://localhost:7000/api/v2.0/"
    : "https://api-node-v2.roccacr.com/api/v2.0/";
};

const getKapsoApiUrl = () => {
  return window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api/v1/"
    : "https://kapso-crmventas.rdghub.com/api/v1/";
};

const isLocalEnvironment = () => {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  };

export const MSAL_CONFIG = {
    clientId: "5bdec38b-68b4-488a-a361-c9df7cd2fe3a",
    authority: "https://login.microsoftonline.com/52d206d1-13b5-4260-a65c-0b0cac860b1d",
    redirectUri: isLocalEnvironment() ? "http://localhost:5173/auth/login" : `${window.location.origin}/auth/login`,
    groupId: "46b0a57a-45ab-4534-8dde-cd4ba39e29b7",
  };

// For backward compatibility
export const MSAL_CLIENT_ID = MSAL_CONFIG.clientId;
export const MSAL_AUTHORITY = MSAL_CONFIG.authority;
export const MSAL_REDIRECT_URI = MSAL_CONFIG.redirectUri;
export const GRAPH_GROUP_ID = MSAL_CONFIG.groupId;

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
const kapsoApiUrl = getKapsoApiUrl();
const apiUrlImg = getApiUrlImg();
const databaseuse = getDatabaseName();
const frontendAccessToken = import.meta.env.VITE_TOKEN_ACCESS || "4jH6k-3m.b@s_T8";

/********************************************** COMMON REQUEST DATA **********************************************/

/**
 * Provides common request data for all API requests.
 * @returns {Object} - An object containing common request data.
 */
const getCommonRequestData = () => {
    return {
        token_access: frontendAccessToken,
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

const fetchKapsoData = async (endpoint) => {
  try {
    const url = `${kapsoApiUrl}${endpoint}`;
    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return { ok: true, data: response.data };
  } catch (error) {
    return { ok: false, errorMessage: error.message };
  }
};

/********************************************** EXPORT FUNCTIONS AND DATA **********************************************/

// Export functions and common data for use in other modules
export {
  fetchData,
  fetchKapsoData,
  commonRequestData,
  fetchDataFile,
  apiUrlImg,
};
