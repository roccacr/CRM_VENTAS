// ============================================================================
// IMPORTS
// ============================================================================

import { registerAs } from "@nestjs/config";

// ============================================================================
// CONFIGURACION APP
// ============================================================================

/**
 * Namespace `app`.
 *
 * Agrupa configuracion transversal de la aplicacion:
 * - version expuesta en endpoints base;
 * - entorno de ejecucion;
 * - puerto HTTP;
 * - prefijo global de rutas;
 * - politicas CORS.
 */
export default registerAs("app", () => ({
  // Version del paquete npm; usa fallback cuando no corre bajo npm.
  version: process.env.npm_package_version ?? "0.1.0",

  // Entorno principal de ejecucion.
  nodeEnv: process.env.NODE_ENV ?? "development",

  // Puerto HTTP del servidor Nest.
  port: Number(process.env.PORT ?? 8002),

  // Prefijo global de la API REST.
  apiPrefix: process.env.API_PREFIX ?? "api/v1",

  /**
   * Lista plana de origins permitidos.
   * La variable acepta una cadena separada por comas.
   */
  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
}));
