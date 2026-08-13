import { z } from 'zod';

/**
 * Configuración de aplicación (variables de entorno).
 *
 * Responsabilidades reales de este módulo:
 *   1. Validar PORT / NODE_ENV / LOG_LEVEL (con defaults seguros).
 *   2. Detectar presencia de secretos opcionales (KAPSO_*, CRM_*) sin exponerlos.
 *   3. Exponer AppConfig tipado para bootstrap (Pino, puerto, flags).
 *
 * Los secretos NUNCA viajan en AppConfig: solo flags *Configured.
 * El valor crudo sigue en process.env / ConfigService para quien lo necesite
 * (guards, verificación HMAC).
 */

export const DEFAULT_APP_PORT = 8002;

const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const;

/**
 * Error de configuración de la app.
 * Distingue "env inválido al arrancar" de errores de runtime HTTP/DB.
 */
export class AppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppConfigError';
  }
}

/**
 * Schema Zod: coerce + defaults + transform a AppConfig.
 * Boolean(secret) trata "" como no configurado (falsy) — intencional.
 */
const environmentSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_APP_PORT),
    NODE_ENV: z.enum(NODE_ENVIRONMENTS).default('development'),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    KAPSO_API_KEY: z.string().optional(),
    KAPSO_PLATFORM_WEBHOOK_SECRET: z.string().optional(),
    CRM_API_INTERNAL_TOKEN: z.string().optional(),
  })
  .transform((env) => ({
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    kapsoApiKeyConfigured: Boolean(env.KAPSO_API_KEY),
    kapsoPlatformWebhookSecretConfigured: Boolean(env.KAPSO_PLATFORM_WEBHOOK_SECRET),
    crmApiInternalTokenConfigured: Boolean(env.CRM_API_INTERNAL_TOKEN),
  }));

/** Config tipada de runtime (sin secretos en claro). */
export type AppConfig = z.infer<typeof environmentSchema>;

/**
 * Parsea y valida el entorno.
 *
 * @throws {AppConfigError} si PORT u otros campos no son usables
 */
export function parseAppConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AppConfig {
  const result = environmentSchema.safeParse(env);

  if (!result.success) {
    throw new AppConfigError(`Invalid environment configuration: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Hook de Nest ConfigModule.validate.
 * Valida el shape y devuelve el env crudo (Nest sigue leyendo process.env).
 */
export function validateEnvironment(env: Record<string, unknown>): Record<string, unknown> {
  parseAppConfig(env as NodeJS.ProcessEnv);
  return env;
}
