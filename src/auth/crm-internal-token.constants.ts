/**
 * Configuracion CRM ↔ API Kapso para auth servicio-a-servicio.
 *
 * Vive aca (no en common) porque es de esta integracion: common solo aporta
 * la politica generica (`InternalTokenGuard`). Si se agrega otro consumidor
 * interno (NetSuite, Postventa...), cada uno tendra su propio constants.
 */

/** Env var del token compartido. Ausente o "" → el guard responde 503. */
export const CRM_INTERNAL_TOKEN_ENV_KEY = "CRM_API_INTERNAL_TOKEN";

/**
 * Header fallback si el CRM no manda `Authorization: Bearer`.
 * Tambien esta en `SENSITIVE_HEADER_PATHS` para que Pino lo redacte.
 */
export const CRM_INTERNAL_TOKEN_HEADER = "x-crm-api-token";

/** Texto de los 401/503. No es un identificador tecnico ni un header. */
export const CRM_INTERNAL_TOKEN_SERVICE_LABEL = "CRM";
