import { z } from 'zod';

/**
 * Schema de entorno: valida vars y expone AppConfig sin secretos en claro
 * (solo flags *Configured).
 */
const environmentSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(8002),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .default('info'),
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

/** Config tipada de la app (sin valores secretos). */
export type AppConfig = z.infer<typeof environmentSchema>;

/**
 * Parsea y valida el entorno.
 * @throws {Error} si PORT u otros campos son inválidos
 */
export function parseAppConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AppConfig {
  const result = environmentSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }

  return result.data;
}

/** Hook de Nest ConfigModule.validate. */
export function validateEnvironment(env: Record<string, unknown>): Record<string, unknown> {
  parseAppConfig(env as NodeJS.ProcessEnv);
  return env;
}
