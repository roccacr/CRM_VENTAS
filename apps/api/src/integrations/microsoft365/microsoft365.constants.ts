/**
 * Unica ruta Graph de la foto de login. El cliente no elige otra.
 * Es `/me`: la foto sale del token de esa persona, no de un id que venga en la peticion.
 */
export const MICROSOFT_GRAPH_PROFILE_PHOTO_URL = "https://graph.microsoft.com/v1.0/me/photo/$value";

/**
 * Tope de la foto durante login y refresh. El calendario usa otro plazo.
 * Si Graph no contesta, la sesion sigue sin foto; no se queda esperando.
 */
export const MICROSOFT_GRAPH_FETCH_TIMEOUT_MS = 5_000;
