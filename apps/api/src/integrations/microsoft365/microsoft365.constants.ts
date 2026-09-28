/**
 * Endpoint Graph aprobado para leer la foto del usuario autenticado.
 */
export const MICROSOFT_GRAPH_PROFILE_PHOTO_URL = "https://graph.microsoft.com/v1.0/me/photo/$value";

/**
 * Tiempo maximo para leer Graph durante login/refresh.
 *
 * La autenticacion no debe quedarse colgada por una integracion externa.
 */
export const MICROSOFT_GRAPH_FETCH_TIMEOUT_MS = 5_000;
