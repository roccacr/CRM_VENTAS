/**
 * Constantes HTTP de bootstrap (prefix, nombre de servicio).
 *
 * Viven en `config/` porque las usan `main.ts`, health y el factory e2e:
 * si el prefix cambia, no puede divergir entre listen, probe y tests.
 */

/** Prefijo global de todas las rutas Nest (`GET /api/v1/health`, etc.). */
export const GLOBAL_API_PREFIX = "api/v1";

/** Nombre del proceso en health/liveness. Coincide con `package.json` name. */
export const SERVICE_NAME = "api-kapso-git";
