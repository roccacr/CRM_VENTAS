/**
 * Namespace de configuración general de la aplicación Nest.
 *
 * Expone puerto, prefijo API, CORS y trust proxy como valores tipados bajo
 * la clave `app`, para que bootstrap y módulos no lean `process.env` a mano.
 */
import { registerAs } from "@nestjs/config";

/**
 * Registra el bloque `app` en ConfigModule.
 *
 * Centraliza defaults de runtime (puerto, versión, orígenes CORS) para
 * entornos locales y producción sin duplicar parsing en `main.ts`.
 */
export default registerAs("app", () => ({
  version: process.env.npm_package_version ?? "0.1.0",

  nodeEnv: process.env.NODE_ENV ?? "development",

  port: Number(process.env.PORT ?? 8002),

  apiPrefix: process.env.API_PREFIX ?? "api/v1",

  // Número exacto de proxies confiables delante de Express (seguridad de IP real).
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),

  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
}));
