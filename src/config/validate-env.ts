/**
 * Validación de arranque de variables de entorno con Joi.
 *
 * Falla rápido si faltan secretos o conexiones críticas (MySQL, Redis, Entra,
 * Kapso), evitando levantar la API en un estado parcialmente configurado.
 */
import * as Joi from "joi";

/** Forma genérica de `process.env` / config pasada a `validate`. */
type EnvShape = Record<string, unknown>;

/**
 * Opciones Joi: convierte tipos y reporta todos los errores de una vez.
 *
 * `abortEarly: false` facilita corregir varias variables en un solo reinicio.
 */
const validationOptions: Joi.ValidationOptions = {
  abortEarly: false,
  convert: true,
};

/** Variables de runtime HTTP (puerto, CORS, trust proxy, rate limit). */
const appEnvSchema = {
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().port().default(8002),
  API_PREFIX: Joi.string().default("api/v1"),
  CORS_ALLOWED_ORIGINS: Joi.string().allow("").default(""),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(10).default(0),
  INTERNAL_RATE_LIMIT_PER_MINUTE: Joi.number().integer().min(1).max(10000).default(120),
};

/** Credenciales y opciones de reintento/migración MySQL. */
const mysqlEnvSchema = {
  MYSQL_HOST: Joi.string().required(),
  MYSQL_PORT: Joi.number().port().required(),
  MYSQL_USER: Joi.string().required(),
  MYSQL_PASSWORD: Joi.string().allow("").required(),
  MYSQL_DATABASE: Joi.string().required(),
  MYSQL_RETRY_ATTEMPTS: Joi.number().integer().min(1).max(100).optional(),
  MYSQL_RETRY_DELAY_MS: Joi.number().integer().min(100).max(60000).optional(),
  MYSQL_MIGRATIONS_RUN: Joi.boolean().truthy("true").falsy("false").default(false),
};

/** Conexión Redis usada por BullMQ. */
const redisEnvSchema = {
  REDIS_HOST: Joi.string().hostname().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow("").optional(),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
  REDIS_TLS: Joi.boolean().truthy("true").falsy("false").default(false),
};

/** Secretos y URLs de la integración Kapso / WhatsApp. */
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
  KAPSO_MEDIA_SIGNING_SECRET: Joi.string().min(32).required(),
  KAPSO_MEDIA_SIGNED_URL_TTL_SECONDS: Joi.number().integer().min(60).max(86400).default(3600),
  KAPSO_PLATFORM_WEBHOOK_SECRET: Joi.string().min(16).required(),
  KAPSO_WHATSAPP_WEBHOOK_SECRET: Joi.string().min(16).required(),
  // 0 desactiva el scheduler (tests / mantenimiento); >=5000 es operación normal.
  KAPSO_PENDING_SYNC_INTERVAL_MS: Joi.number().integer().min(0).optional(),
  KAPSO_LEAD_TEMPLATE_INTERVAL_MS: Joi.number().integer().min(0).optional(),
  KAPSO_PENDING_SYNC_BATCH_SIZE: Joi.number().integer().min(1).max(100).optional(),
};

/** Parámetros de Microsoft Entra ID para autenticación de la API. */
const securityEnvSchema = {
  ENTRA_TENANT_ID: Joi.string().guid().allow("").optional().default(""),
  ENTRA_API_AUDIENCE: Joi.string().allow("").optional().default(""),
  ENTRA_REQUIRED_SCOPE: Joi.string().default("Kapso.Access"),
  ENTRA_ALLOWED_CLIENT_IDS: Joi.string().allow("").optional().default(""),
  CRM_JWT_SECRET: Joi.string().optional(),
  JWT_SECRET: Joi.string().optional(),
};

/**
 * Esquema unificado de variables de entorno.
 *
 * `.unknown(true)` permite variables adicionales del sistema/CI sin fallar,
 * mientras las claves de negocio siguen siendo validadas estrictamente.
 */
const schema = Joi.object({
  ...appEnvSchema,
  ...mysqlEnvSchema,
  ...redisEnvSchema,
  ...kapsoEnvSchema,
  ...securityEnvSchema,
})
  .or("CRM_JWT_SECRET", "JWT_SECRET")
  .unknown(true);

/**
 * Valida y normaliza la configuración de entorno al arrancar Nest.
 *
 * ConfigModule invoca esta función antes de cargar namespaces; un error aquí
 * detiene el bootstrap con un mensaje agregando todas las fallas Joi.
 *
 * @param config - Mapa de variables (típicamente `process.env`)
 * @returns Configuración convertida según tipos Joi
 * @throws {Error} Si alguna variable requerida es inválida o falta
 */
export function validateEnv(config: EnvShape): EnvShape {
  const { error, value } = schema.validate(config, validationOptions);

  if (error) {
    throw new Error(`Variables de entorno invalidas: ${error.message}`);
  }

  const entraTenantId = String(value.ENTRA_TENANT_ID ?? "").trim();
  const entraAudience = String(value.ENTRA_API_AUDIENCE ?? "").trim();
  const entraAllowedClientIds = String(value.ENTRA_ALLOWED_CLIENT_IDS ?? "").trim();

  if ((entraTenantId || entraAudience) && !entraAllowedClientIds) {
    throw new Error("Variables de entorno invalidas: ENTRA_ALLOWED_CLIENT_IDS es requerido cuando Microsoft Entra esta configurado.");
  }

  return value;
}
