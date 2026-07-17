// ============================================================================
// IMPORTS
// ============================================================================

import * as Joi from "joi";

// ============================================================================
// TIPOS Y OPCIONES BASE
// ============================================================================

/** Shape generico de variables de entorno tal como llega desde `process.env`. */
type EnvShape = Record<string, unknown>;

/** Opciones globales de Joi aplicadas en el arranque de Nest. */
const validationOptions: Joi.ValidationOptions = {
  // Reporta todos los errores encontrados, no solo el primero.
  abortEarly: false,
  // Permite conversiones utiles como string -> number.
  convert: true,
};

// ============================================================================
// FRAGMENTOS DE ESQUEMA
// ============================================================================

/** Variables transversales de la aplicacion. */
const appEnvSchema = {
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().port().default(8002),
  API_PREFIX: Joi.string().default("api/v1"),
  CORS_ALLOWED_ORIGINS: Joi.string().allow("").default(""),
};

/** Credenciales y datos de conexion MySQL. */
const mysqlEnvSchema = {
  MYSQL_HOST: Joi.string().required(),
  MYSQL_PORT: Joi.number().port().required(),
  MYSQL_USER: Joi.string().required(),
  MYSQL_PASSWORD: Joi.string().allow("").required(),
  MYSQL_DATABASE: Joi.string().required(),
  MYSQL_RETRY_ATTEMPTS: Joi.number().integer().min(1).max(100).optional(),
  MYSQL_RETRY_DELAY_MS: Joi.number().integer().min(100).max(60000).optional(),
};

/** Variables especificas de integracion Kapso. */
const kapsoEnvSchema = {
  KAPSO_API_BASE_URL: Joi.string().uri().optional(),
  KAPSO_META_API_BASE_URL: Joi.string().uri().optional(),
  KAPSO_API_KEY: Joi.string().optional(),
  KAPSO_TEST_API_KEY: Joi.string().optional(),
  KAPSO_PROJECT_API_KEYS_JSON: Joi.string().optional(),
  KAPSO_PUBLIC_BASE_URL: Joi.string().uri().required(),
  KAPSO_SETUP_REDIRECT_BASE_URL: Joi.string().uri().optional(),
  KAPSO_MEDIA_STORAGE_PATH: Joi.string().optional(),
  KAPSO_MEDIA_MAX_FILE_SIZE_MB: Joi.number().integer().min(1).max(200).optional(),
  KAPSO_PLATFORM_WEBHOOK_SECRET: Joi.string().min(16).required(),
  KAPSO_WHATSAPP_WEBHOOK_SECRET: Joi.string().min(16).required(),
  KAPSO_PENDING_SYNC_INTERVAL_MS: Joi.number().integer().min(5000).optional(),
  KAPSO_PENDING_SYNC_BATCH_SIZE: Joi.number().integer().min(1).max(100).optional(),
};

// ============================================================================
// ESQUEMA COMPUESTO
// ============================================================================

/**
 * Esquema unificado de variables de entorno.
 * `.unknown(true)` permite variables adicionales del sistema sin fallar.
 */
const schema = Joi.object({
  ...appEnvSchema,
  ...mysqlEnvSchema,
  ...kapsoEnvSchema,
}).unknown(true);

// ============================================================================
// VALIDADOR EXPORTADO
// ============================================================================

/**
 * Valida y normaliza variables de entorno antes de cargar la configuracion.
 *
 * Lo usa `ConfigModule.forRoot({ validate: validateEnv })` para cortar el
 * arranque si falta una variable critica o llega con formato invalido.
 */
export function validateEnv(config: EnvShape): EnvShape {
  const { error, value } = schema.validate(config, validationOptions);

  if (error) {
    throw new Error(`Variables de entorno invalidas: ${error.message}`);
  }

  return value;
}
