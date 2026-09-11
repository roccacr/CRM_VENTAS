/**
 * Constantes de bootstrap de la API (puerto, entornos, catalogo de env vars).
 *
 * Los secretos NUNCA se defaultan aca: si faltan, los flags `*Configured`
 * quedan en false y los guards fallan cerrados (503). Solo PORT / NODE_ENV /
 * LOG_LEVEL tienen default seguro para poder arrancar en local.
 */

/** Puerto local historico del API Kapso; coincide con lo que espera el CRM. */
export const DEFAULT_APP_PORT = 8002;

export const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Nombres de env vars que este API entiende.
 * Centralizados para no repetir literales en schema Zod, CORS y docs.
 * El token CRM vive en `auth/` (es de esa integracion); aca se reexporta
 * el resto del catalogo de bootstrap.
 */
export const APP_ENV_KEYS = {
    PORT: "PORT",
    NODE_ENV: "NODE_ENV",
    LOG_LEVEL: "LOG_LEVEL",
    KAPSO_API_KEY: "KAPSO_API_KEY",
    KAPSO_PLATFORM_WEBHOOK_SECRET: "KAPSO_PLATFORM_WEBHOOK_SECRET",
    KAPSO_WHATSAPP_WEBHOOK_SECRET: "KAPSO_WHATSAPP_WEBHOOK_SECRET",
    KAPSO_WHATSAPP_WEBHOOK_URL: "KAPSO_WHATSAPP_WEBHOOK_URL",
    KAPSO_ENVIO_TEMPLATE_INICIAL_ENABLED: "KAPSO_ENVIO_TEMPLATE_INICIAL_ENABLED",
    KAPSO_ENVIO_TEMPLATE_INICIAL_INTERVAL_MS: "KAPSO_ENVIO_TEMPLATE_INICIAL_INTERVAL_MS",
    KAPSO_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE: "KAPSO_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE",
    CRM_FRONTEND_ORIGINS: "CRM_FRONTEND_ORIGINS",
} as const;
